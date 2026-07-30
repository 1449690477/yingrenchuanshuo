import type {
  Affix,
  AffixChangeOperation,
  AffixKey,
  ClassId,
  EquipmentDef,
  EquipmentInstance,
} from './types';
import {
  pickProfessionAffixSpec,
  rollAffixForKey,
  rollAffixTier,
  rollAffixValue,
} from './equipment';
import { Rng } from './rng';
import {
  AFFIX_POOL,
  AFFIX_TIERS,
  isAffixGenerationActive,
  isAffixGenerationLevelUnlocked,
  isAffixSettlementActive,
  PROFESSION_AFFIX_POOLS,
  QUALITY_PROFESSION_AFFIX_COUNT,
  type AffixPoolEntry,
  type ProfessionAffixPoolEntry,
} from '@/data/constants';
import {
  CLASS_SIGIL_IDS,
  RANDOM_AFFIX_CHANGE_OPERATIONS,
  REFORGE_MATERIAL_IDS,
  REFORGE_RESONANCE_MAX,
  REFORGE_RULES,
} from '@/data/reforgeRules';

export interface ReforgeWallet {
  gold: number;
  items: Record<string, number>;
}

export interface ReforgeRegionMaterials {
  commonIds: readonly [string, string];
  fineId: string;
}

export interface AffixChangeCost {
  gold: number;
  items: Record<string, number>;
}

export type AffixChangeBlockReason =
  | 'pending-result'
  | 'no-random-affixes'
  | 'invalid-locks'
  | 'all-affixes-locked'
  | 'invalid-target'
  | 'deferred-affix'
  | 'max-tier'
  | 'no-candidate'
  | 'insufficient-gold'
  | 'insufficient-item';

export interface PlanAffixChangeInput {
  instance: EquipmentInstance;
  definition: EquipmentDef;
  operation: AffixChangeOperation;
  classId: ClassId;
  /**
   * 本次临时锁定的随机词条下标。操作完成后自动解除，不写入装备实例。
   * 随机洗练会从剩余下标中等概率选择一条。
   */
  lockedIndices?: readonly number[];
  /** 同调是确定性操作，必须由玩家明确选择目标。 */
  targetIndex?: number;
  regionMaterials: ReforgeRegionMaterials;
  wallet: ReforgeWallet;
  rngState: number;
}

export type PlanAffixChangeResult =
  | {
      ok: false;
      reason: AffixChangeBlockReason;
      itemId?: string;
      required?: number;
      owned?: number;
    }
  | {
      ok: true;
      instance: EquipmentInstance;
      wallet: ReforgeWallet;
      nextRngState: number;
      targetIndex: number;
      previous: Affix;
      candidate: Affix;
      cost: AffixChangeCost;
      pityTriggered: boolean;
      resonanceBefore: number;
      resonanceAfter: number;
    };

export interface ResolveAffixChangeResult {
  instance: EquipmentInstance;
  adopted: boolean;
  previous: Affix;
  candidate: Affix;
}

/**
 * 锁定成本。文案中的 1 / 2 / 4 / 8 表示“本次锁 N 条的总价”，
 * 因此 N=0 不收费，N>=1 时为 2^(N-1)。
 */
export function bindMaterialCost(lockedCount: number): number {
  if (!Number.isInteger(lockedCount) || lockedCount < 0) {
    throw new Error(`bindMaterialCost: 锁定条数必须是非负整数，收到 ${lockedCount}`);
  }
  if (lockedCount === 0) return 0;
  const cost = 2 ** (lockedCount - REFORGE_RULES.bind.exponentOffset);
  if (!Number.isSafeInteger(cost)) throw new Error('bindMaterialCost: 锁定成本超过安全整数');
  return cost;
}

/** 根据候选品阶推进单件装备的霉运保护；T4/T5 会清零。 */
export function resonanceAfterRoll(current: number, tier: Affix['tier']): number {
  assertResonance(current);
  const gain = REFORGE_RULES.resonanceGain[tier];
  if (gain < 0) return 0;
  return Math.min(REFORGE_RESONANCE_MAX, current + gain);
}

/**
 * 开始一次洗练原子计划。
 *
 * 所有随机、费用和候选先在克隆对象里完整计算；只有 ok=true 时，store 才能
 * 一次性写回钱包、RNG 与装备。装备原词条保持不变，候选写入 pending。
 */
export function planAffixChange(input: PlanAffixChangeInput): PlanAffixChangeResult {
  validateInput(input);
  if (input.instance.pendingAffixChange) return { ok: false, reason: 'pending-result' };
  // 判据是「有没有可洗的随机词条」，不是「是不是固定模板」。
  // 固定词条写在 def.fixedAffixes、不在实例里，洗练根本碰不到它们；
  // 实例的 affixes 只有额外槽位那几条 —— 那正是留给玩家洗的养成空间。
  // 旧写法把 fixedTemplate 整类挡在门外，导致商店红装、好感虹装的
  // 额外槽形同虚设（所有者反馈「红装还不如掉落黄装」的直接原因之一）。
  if (input.instance.affixes.length === 0) {
    return { ok: false, reason: 'no-random-affixes' };
  }

  const randomOperation = isRandomOperation(input.operation);
  const lockedIndices = normalizeLockedIndices(
    input.lockedIndices ?? [],
    input.instance.affixes.length,
  );
  if (!lockedIndices) return { ok: false, reason: 'invalid-locks' };
  if (!randomOperation && lockedIndices.length > 0) {
    return { ok: false, reason: 'invalid-locks' };
  }
  if (input.operation === 'inscribe' && lockedIndices.length > 0) {
    return { ok: false, reason: 'invalid-locks' };
  }

  const txRng = new Rng(1);
  txRng.setState(input.rngState);
  const unlocked = input.instance.affixes
    .map((_, index) => index)
    .filter((index) => !lockedIndices.includes(index));
  if (randomOperation && unlocked.length === 0) {
    return { ok: false, reason: 'all-affixes-locked' };
  }

  const eligible = randomOperation
    ? unlocked.filter(
        (index) =>
          (input.operation !== 'inscribe' ||
            isProfessionAffixSlot(
              input.definition.quality,
              input.instance.affixes.length,
              index,
            )) &&
          hasCandidateForTarget(input, index),
      )
    : unlocked;
  if (randomOperation && eligible.length === 0) {
    if (
      input.operation === 'temper' &&
      unlocked.some((index) => !isAffixSettlementActive(input.instance.affixes[index]!.key))
    ) {
      return { ok: false, reason: 'deferred-affix' };
    }
    return { ok: false, reason: 'no-candidate' };
  }

  const targetIndex = randomOperation
    ? txRng.pick(eligible)
    : validateTargetIndex(input.targetIndex, input.instance.affixes.length);
  if (targetIndex === null) return { ok: false, reason: 'invalid-target' };

  const previous = input.instance.affixes[targetIndex]!;
  if (
    (input.operation === 'temper' || input.operation === 'resonate') &&
    !isAffixSettlementActive(previous.key)
  ) {
    return { ok: false, reason: 'deferred-affix' };
  }
  if (input.operation === 'resonate' && previous.tier >= 5) {
    return { ok: false, reason: 'max-tier' };
  }

  const pityTriggered = randomOperation && input.instance.reforgeResonance >= REFORGE_RESONANCE_MAX;
  const candidate = rollCandidate(input, targetIndex, previous, txRng, pityTriggered);

  const cost = affixChangeCost(
    input.operation,
    input.definition.level,
    previous.tier,
    lockedIndices.length,
    input.classId,
    input.regionMaterials,
  );
  const afford = checkAfford(input.wallet, cost);
  if (afford) return afford;

  const nextWallet = debitCost(input.wallet, cost);
  const resonanceBefore = input.instance.reforgeResonance;
  const resonanceAfter = randomOperation
    ? resonanceAfterRoll(resonanceBefore, candidate.tier)
    : resonanceBefore;
  const nextInstance = cloneInstance(input.instance);
  nextInstance.reforgeResonance = resonanceAfter;
  nextInstance.pendingAffixChange = {
    operation: input.operation,
    affixIndex: targetIndex,
    candidate: { ...candidate },
  };

  return {
    ok: true,
    instance: nextInstance,
    wallet: nextWallet,
    nextRngState: randomOperation ? txRng.getState() : input.rngState,
    targetIndex,
    previous: { ...previous },
    candidate: { ...candidate },
    cost,
    pityTriggered,
    resonanceBefore,
    resonanceAfter,
  };
}

/** 处理“采用 / 保留原样”；两条路径都只清除已持久化候选，不再收费。 */
export function resolvePendingAffixChange(
  instance: EquipmentInstance,
  decision: 'adopt' | 'keep',
): ResolveAffixChangeResult {
  const pending = instance.pendingAffixChange;
  if (!pending) throw new Error('resolvePendingAffixChange: 装备没有待处理洗练结果');
  const previous = instance.affixes[pending.affixIndex];
  if (!previous) {
    throw new Error(`resolvePendingAffixChange: 候选下标越界 ${pending.affixIndex}`);
  }

  const next = cloneInstance(instance);
  if (decision === 'adopt') {
    next.affixes[pending.affixIndex] = { ...pending.candidate };
  }
  delete next.pendingAffixChange;
  return {
    instance: next,
    adopted: decision === 'adopt',
    previous: { ...previous },
    candidate: { ...pending.candidate },
  };
}

export function affixChangeCost(
  operation: AffixChangeOperation,
  equipmentLevel: number,
  currentTier: Affix['tier'],
  lockedCount: number,
  classId: ClassId,
  regionMaterials: ReforgeRegionMaterials,
): AffixChangeCost {
  if (!Number.isInteger(equipmentLevel) || equipmentLevel < 1) {
    throw new Error(`affixChangeCost: 装备等级必须是正整数，收到 ${equipmentLevel}`);
  }
  if (!Number.isInteger(currentTier) || currentTier < 1 || currentTier > 5) {
    throw new Error(`affixChangeCost: 词条品阶必须在 1~5，收到 ${currentTier}`);
  }
  if (operation === 'inscribe' && lockedCount !== 0) {
    throw new Error('affixChangeCost: 铭刻只改写预留职业槽，不接受定契');
  }
  const items: Record<string, number> = {};
  const add = (itemId: string, count: number) => {
    if (!itemId) throw new Error('affixChangeCost: 材料 id 不能为空');
    if (!Number.isSafeInteger(count) || count < 0) {
      throw new Error(`affixChangeCost: ${itemId} 数量不合法 ${count}`);
    }
    if (count > 0) items[itemId] = (items[itemId] ?? 0) + count;
  };

  let gold: number;
  if (operation === 'reforge' || operation === 'inscribe') {
    gold = equipmentLevel * REFORGE_RULES.reforge.goldPerLevel;
    add(
      REFORGE_MATERIAL_IDS.reforge,
      Math.ceil(equipmentLevel / REFORGE_RULES.reforge.materialEveryLevels) +
        REFORGE_RULES.reforge.materialBase,
    );
    assertRegionMaterials(regionMaterials);
    for (const itemId of regionMaterials.commonIds) {
      add(itemId, REFORGE_RULES.reforge.regionCommonEach);
    }
    add(regionMaterials.fineId, REFORGE_RULES.reforge.regionFine);
    if (operation === 'inscribe') add(CLASS_SIGIL_IDS[classId], 1);
  } else if (operation === 'temper') {
    gold = equipmentLevel * REFORGE_RULES.temper.goldPerLevel;
    add(
      REFORGE_MATERIAL_IDS.temper,
      Math.ceil(equipmentLevel / REFORGE_RULES.temper.materialEveryLevels) + currentTier,
    );
  } else {
    gold = equipmentLevel * REFORGE_RULES.resonate.goldPerLevel;
    add(REFORGE_MATERIAL_IDS.resonance, currentTier);
  }

  if (isRandomOperation(operation) && operation !== 'inscribe') {
    add(REFORGE_MATERIAL_IDS.bind, bindMaterialCost(lockedCount));
  } else if (lockedCount !== 0) {
    throw new Error('affixChangeCost: 同调不接受临时锁定');
  }
  return { gold, items };
}

function rollCandidate(
  input: PlanAffixChangeInput,
  targetIndex: number,
  previous: Affix,
  rng: Rng,
  guaranteedHigh: boolean,
): Affix {
  if (input.operation === 'resonate') {
    return promoteAffix(previous);
  }
  if (input.operation === 'temper') {
    const spec = requireAffixSpec(previous.key);
    const tier = rollAffixTier(rng, guaranteedHigh);
    return {
      key: previous.key,
      tier,
      value: rollAffixValue(spec, input.definition.level, tier, rng),
      ...(previous.element ? { element: previous.element } : {}),
    };
  }

  const candidates = replacementCandidates(input, targetIndex);
  if (candidates.length === 0) {
    throw new Error(`[内部错误] 已选中的洗练槽 ${targetIndex} 没有候选，目标过滤与生成逻辑不一致`);
  }
  const picked = isProfessionTarget(input, targetIndex)
    ? pickProfessionAffixSpec(asProfessionCandidates(candidates), rng)
    : rng.weighted(candidates, (spec) => spec.weight);
  return rollAffixForKey(picked.key, input.definition.level, rng, guaranteedHigh);
}

/**
 * 随机操作是否能在指定槽生成候选。这里只做确定性集合判断，不消耗 RNG。
 * 先过滤槽、再等概率选槽，避免随机撞到职业死槽后误报整件装备不可洗。
 */
function hasCandidateForTarget(input: PlanAffixChangeInput, targetIndex: number): boolean {
  if (input.operation === 'temper') {
    const key = input.instance.affixes[targetIndex]!.key;
    requireAffixSpec(key);
    return isAffixSettlementActive(key);
  }
  return replacementCandidates(input, targetIndex).length > 0;
}

function replacementCandidates(
  input: PlanAffixChangeInput,
  targetIndex: number,
): readonly AffixPoolEntry[] {
  const previous = input.instance.affixes[targetIndex]!;
  const pool = isProfessionTarget(input, targetIndex)
    ? PROFESSION_AFFIX_POOLS[input.classId]
    : AFFIX_POOL;
  const occupied = new Set<AffixKey>([
    ...(input.definition.fixedAffixes ?? []).map((affix) => affix.key),
    ...input.instance.affixes.filter((_, index) => index !== targetIndex).map((affix) => affix.key),
    previous.key,
  ]);
  return pool.filter(
    (spec) =>
      isAffixGenerationActive(spec.key) &&
      isAffixGenerationLevelUnlocked(spec.key, input.definition.level) &&
      !occupied.has(spec.key),
  );
}

function isProfessionTarget(input: PlanAffixChangeInput, targetIndex: number): boolean {
  return isProfessionAffixSlot(
    input.definition.quality,
    input.instance.affixes.length,
    targetIndex,
  );
}

function asProfessionCandidates(
  candidates: readonly AffixPoolEntry[],
): readonly ProfessionAffixPoolEntry[] {
  if (candidates.some((entry) => !('balanceRole' in entry))) {
    throw new Error('[配置错误] 职业词条候选缺少 balanceRole');
  }
  return candidates as readonly ProfessionAffixPoolEntry[];
}

export function promoteAffix(affix: Affix): Affix {
  if (affix.tier >= 5) throw new Error('promoteAffix: T5 词条不能继续提升');
  const current = AFFIX_TIERS.find((entry) => entry.tier === affix.tier)!;
  const next = AFFIX_TIERS.find((entry) => entry.tier === affix.tier + 1)!;
  const spec = requireAffixSpec(affix.key);
  const precision = 10 ** spec.decimals;
  return {
    ...affix,
    tier: next.tier,
    value: Math.round(affix.value * (next.multiplier / current.multiplier) * precision) / precision,
  };
}

export function isProfessionAffixSlot(
  quality: EquipmentDef['quality'],
  affixCount: number,
  targetIndex: number,
): boolean {
  const reserved = Math.min(QUALITY_PROFESSION_AFFIX_COUNT[quality], affixCount);
  return reserved > 0 && targetIndex >= affixCount - reserved;
}

function requireAffixSpec(key: AffixKey): AffixPoolEntry {
  const spec =
    AFFIX_POOL.find((entry) => entry.key === key) ??
    Object.values(PROFESSION_AFFIX_POOLS)
      .flat()
      .find((entry) => entry.key === key);
  if (!spec) throw new Error(`[配置错误] 词条池不存在：${key}`);
  return spec;
}

function isRandomOperation(
  operation: AffixChangeOperation,
): operation is (typeof RANDOM_AFFIX_CHANGE_OPERATIONS)[number] {
  return (RANDOM_AFFIX_CHANGE_OPERATIONS as readonly string[]).includes(operation);
}

function normalizeLockedIndices(indices: readonly number[], affixCount: number): number[] | null {
  if (
    indices.some((index) => !Number.isInteger(index) || index < 0 || index >= affixCount) ||
    new Set(indices).size !== indices.length
  ) {
    return null;
  }
  return [...indices].sort((a, b) => a - b);
}

function validateTargetIndex(index: number | undefined, affixCount: number): number | null {
  return Number.isInteger(index) && index! >= 0 && index! < affixCount ? index! : null;
}

function checkAfford(
  wallet: ReforgeWallet,
  cost: AffixChangeCost,
): Extract<PlanAffixChangeResult, { ok: false }> | null {
  if (wallet.gold < cost.gold) {
    return {
      ok: false,
      reason: 'insufficient-gold',
      required: cost.gold,
      owned: wallet.gold,
    };
  }
  for (const [itemId, required] of Object.entries(cost.items)) {
    const owned = wallet.items[itemId] ?? 0;
    if (owned < required) {
      return { ok: false, reason: 'insufficient-item', itemId, required, owned };
    }
  }
  return null;
}

function debitCost(wallet: ReforgeWallet, cost: AffixChangeCost): ReforgeWallet {
  const items = { ...wallet.items };
  for (const [itemId, count] of Object.entries(cost.items)) {
    const next = items[itemId]! - count;
    if (next === 0) delete items[itemId];
    else items[itemId] = next;
  }
  return { gold: wallet.gold - cost.gold, items };
}

function cloneInstance(instance: EquipmentInstance): EquipmentInstance {
  return {
    ...instance,
    enhanceGainPermille: [...instance.enhanceGainPermille],
    enhanceLuck: { ...instance.enhanceLuck },
    affixes: instance.affixes.map((affix) => ({ ...affix })),
    ...(instance.pendingAffixChange
      ? {
          pendingAffixChange: {
            ...instance.pendingAffixChange,
            candidate: { ...instance.pendingAffixChange.candidate },
          },
        }
      : {}),
  };
}

function assertRegionMaterials(region: ReforgeRegionMaterials): void {
  const ids = [...region.commonIds, region.fineId];
  if (ids.some((id) => !id) || new Set(ids).size !== ids.length) {
    throw new Error('affixChangeCost: 区域洗练材料必须是两个不同 common 与一个 fine');
  }
}

function assertResonance(value: number): void {
  if (!Number.isInteger(value) || value < 0 || value > REFORGE_RESONANCE_MAX) {
    throw new Error(`洗练共鸣值必须是 0~${REFORGE_RESONANCE_MAX} 的整数，收到 ${value}`);
  }
}

function validateInput(input: PlanAffixChangeInput): void {
  if (input.instance.defId !== input.definition.id) {
    throw new Error(
      `planAffixChange: 装备实例 ${input.instance.defId} 与定义 ${input.definition.id} 不一致`,
    );
  }
  assertResonance(input.instance.reforgeResonance);
  if (!Number.isInteger(input.wallet.gold) || input.wallet.gold < 0) {
    throw new Error(`planAffixChange: 金币必须是非负整数，收到 ${input.wallet.gold}`);
  }
  for (const [itemId, count] of Object.entries(input.wallet.items)) {
    if (!itemId || !Number.isInteger(count) || count < 0) {
      throw new Error(`planAffixChange: 材料数量不合法 ${itemId}=${count}`);
    }
  }
}
