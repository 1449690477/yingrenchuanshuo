/**
 * 一键强化的纯逻辑调度层。
 *
 * 单次成败、消耗公式与强化增幅仍分别由 enhance.ts / equipment.ts 负责；
 * 本模块只编排资源预检、安全保护、单件连续强化与全身均衡轮转。
 */

import { ENHANCE_BREAK_FROM, ENHANCE_MATERIAL_IDS, ENHANCE_MAX, LUCK_FULL } from '@/data/constants';
import {
  attemptEnhance,
  enhanceCost,
  enhanceRule,
  type EnhanceCost,
  type EnhanceResult,
} from './enhance';
import { rollEnhanceGainPermille, type EnhanceGainGrade, type PermilleRoll } from './equipment';
import { Rng } from './rng';
import type { EquipmentInstance } from './types';

/** 防止异常配置或资源数量让一次点击长期占用主线程。 */
export const ENHANCE_BATCH_MAX_ATTEMPTS = 1024;

/** 均衡强化依次完成这些全身阶段，避免单件装备先吃光全部资源。 */
export const ENHANCE_BATCH_MILESTONES = [5, 9, 12, 15] as const;

/** 强化增幅子随机流的模块盐；与既有单次强化结果保持完全兼容。 */
const ENHANCE_GAIN_DERIVE_SALT = 0x73616b75;

export type EnhanceBatchStrategy = 'single' | 'balanced';

export interface EnhanceBatchWallet {
  gold: number;
  items: Record<string, number>;
}

export interface EnhanceBatchCandidate {
  instance: EquipmentInstance;
  /** 装备定义的需求等级，用于可信地重算金币消耗。 */
  equipmentLevel: number;
  /**
   * 调用方按 SLOT_ORDER 传入的顺序。
   * 均衡策略只依赖这个稳定序号，不依赖传入数组恰好已经排好序。
   */
  order: number;
}

export interface EnhanceBatchInput {
  rngState: number;
  wallet: EnhanceBatchWallet;
  candidates: readonly EnhanceBatchCandidate[];
  targetLevel: number;
  strategy: EnhanceBatchStrategy;
  /** 可降低单次操作上限，但不得突破模块硬上限。 */
  maxAttempts?: number;
}

export type EnhanceBatchBlockReason =
  | 'insufficient-gold'
  | 'insufficient-stone'
  | 'insufficient-ore'
  | 'insufficient-lucky'
  | 'insufficient-protection';

export interface EnhanceBatchBlockedEvent {
  uid: string;
  reason: EnhanceBatchBlockReason;
  currentLevel: number;
  /** 本次原本要冲击的强化等级。 */
  targetLevel: number;
  milestone: number;
  round: number;
  cost: EnhanceCost;
}

export interface EnhanceBatchAttemptEvent {
  /** 从 1 开始的本次批量操作尝试序号。 */
  attempt: number;
  /** 均衡策略的轮次；单件策略中等于尝试序号。 */
  round: number;
  uid: string;
  milestone: number;
  equipmentLevel: number;
  order: number;
  useProtection: boolean;
  cost: EnhanceCost;
  result: EnhanceResult;
  /** 只有首次成功到达该等级时才有值；掉级后重回不会重掷。 */
  gainRoll: PermilleRoll<EnhanceGainGrade> | null;
}

export type EnhanceBatchStopReason =
  'target-reached' | 'no-candidates' | 'blocked' | 'attempt-limit';

export interface EnhanceBatchResult {
  /** 与输入 candidates 顺序一致的深克隆实例。 */
  instances: EquipmentInstance[];
  wallet: EnhanceBatchWallet;
  nextRngState: number;
  attempts: EnhanceBatchAttemptEvent[];
  blocked: EnhanceBatchBlockedEvent[];
  stopReason: EnhanceBatchStopReason;
}

interface WorkingCandidate {
  inputIndex: number;
  equipmentLevel: number;
  order: number;
  instance: EquipmentInstance;
}

interface PlannedAttempt {
  cost: EnhanceCost;
  luck: number;
  useProtection: boolean;
}

/**
 * 复刻既有强化增幅盐值算法。
 *
 * 字符串按 JavaScript UTF-16 code unit 逐个散列，不能改成 code point 遍历，
 * 否则含 emoji 的旧装备 uid 会得到不同的强化增幅。
 */
export function enhanceGainSalt(uid: string, targetLevel: number): number {
  let hash = ENHANCE_GAIN_DERIVE_SALT;
  for (let index = 0; index < uid.length; index += 1) {
    hash = Math.imul(hash ^ uid.charCodeAt(index), 0x01000193);
  }
  return (hash ^ targetLevel) >>> 0;
}

/**
 * 执行单件连续强化或全身均衡强化。
 *
 * 输入资产、装备及其嵌套数组/对象一律不会被修改。任何资源预检失败发生在
 * attemptEnhance 之前，因此不会推进 RNG。
 */
export function enhanceBatch(input: EnhanceBatchInput): EnhanceBatchResult {
  assertInput(input);

  const maxAttempts = input.maxAttempts ?? ENHANCE_BATCH_MAX_ATTEMPTS;
  const wallet = cloneWallet(input.wallet);
  const working = input.candidates.map<WorkingCandidate>((candidate, inputIndex) => ({
    inputIndex,
    equipmentLevel: candidate.equipmentLevel,
    order: candidate.order,
    instance: cloneEquipmentInstance(candidate.instance),
  }));
  const attempts: EnhanceBatchAttemptEvent[] = [];
  const blocked: EnhanceBatchBlockedEvent[] = [];
  const rng = new Rng(1);
  rng.setState(input.rngState);

  const finish = (stopReason: EnhanceBatchStopReason): EnhanceBatchResult => ({
    instances: working
      .slice()
      .sort((left, right) => left.inputIndex - right.inputIndex)
      .map((candidate) => candidate.instance),
    wallet,
    nextRngState: rng.getState(),
    attempts,
    blocked,
    stopReason,
  });

  if (working.length === 0) return finish('no-candidates');

  if (input.strategy === 'single') {
    if (working.length !== 1) {
      throw new Error('enhanceBatch: single 策略必须且只能传入一件装备');
    }

    const candidate = working[0]!;
    while (candidate.instance.enhance < input.targetLevel) {
      if (attempts.length >= maxAttempts) return finish('attempt-limit');

      const round = attempts.length + 1;
      const planned = planAttempt(candidate, wallet);
      if ('reason' in planned) {
        blocked.push(
          makeBlockedEvent(candidate, planned.reason, planned.cost, input.targetLevel, round),
        );
        return finish('blocked');
      }

      attempts.push(
        executeAttempt(candidate, wallet, rng, planned, input.targetLevel, round, attempts.length),
      );
    }
    return finish('target-reached');
  }

  const ordered = working
    .slice()
    .sort((left, right) => left.order - right.order || left.inputIndex - right.inputIndex);
  const blockedIndexes = new Set<number>();
  let round = 0;

  for (const milestone of milestonesFor(input.targetLevel)) {
    while (ordered.some((candidate) => candidate.instance.enhance < milestone)) {
      const pending = ordered.filter(
        (candidate) =>
          candidate.instance.enhance < milestone && !blockedIndexes.has(candidate.inputIndex),
      );
      if (pending.length === 0) return finish('blocked');

      round += 1;
      let attemptedThisRound = false;

      // pending 是本轮快照：同一件装备在这一轮中最多尝试一次。
      for (const candidate of pending) {
        if (attempts.length >= maxAttempts) return finish('attempt-limit');

        const planned = planAttempt(candidate, wallet);
        if ('reason' in planned) {
          blockedIndexes.add(candidate.inputIndex);
          blocked.push(makeBlockedEvent(candidate, planned.reason, planned.cost, milestone, round));
          continue;
        }

        attempts.push(
          executeAttempt(candidate, wallet, rng, planned, milestone, round, attempts.length),
        );
        attemptedThisRound = true;
      }

      if (!attemptedThisRound) return finish('blocked');
    }
  }

  return finish('target-reached');
}

function planAttempt(
  candidate: WorkingCandidate,
  wallet: EnhanceBatchWallet,
): PlannedAttempt | { reason: EnhanceBatchBlockReason; cost: EnhanceCost } {
  const targetLevel = candidate.instance.enhance + 1;
  const cost = enhanceCost(targetLevel, candidate.equipmentLevel);
  const rule = enhanceRule(targetLevel);
  const luck = candidate.instance.enhanceLuck[String(targetLevel)] ?? 0;
  const guaranteed = rule.rate < 1 && luck === LUCK_FULL;
  const useProtection = targetLevel >= ENHANCE_BREAK_FROM && !guaranteed;

  if (wallet.gold < cost.gold) return { reason: 'insufficient-gold', cost };
  if (itemCount(wallet, ENHANCE_MATERIAL_IDS.stone) < cost.stone) {
    return { reason: 'insufficient-stone', cost };
  }
  if (itemCount(wallet, ENHANCE_MATERIAL_IDS.ore) < cost.ore) {
    return { reason: 'insufficient-ore', cost };
  }
  if (itemCount(wallet, ENHANCE_MATERIAL_IDS.lucky) < cost.lucky) {
    return { reason: 'insufficient-lucky', cost };
  }
  if (useProtection && itemCount(wallet, ENHANCE_MATERIAL_IDS.protection) < 1) {
    return { reason: 'insufficient-protection', cost };
  }

  return { cost, luck, useProtection };
}

function executeAttempt(
  candidate: WorkingCandidate,
  wallet: EnhanceBatchWallet,
  rng: Rng,
  planned: PlannedAttempt,
  milestone: number,
  round: number,
  attemptIndex: number,
): EnhanceBatchAttemptEvent {
  const { instance } = candidate;
  wallet.gold -= planned.cost.gold;
  debitItem(wallet, ENHANCE_MATERIAL_IDS.stone, planned.cost.stone);
  debitItem(wallet, ENHANCE_MATERIAL_IDS.ore, planned.cost.ore);
  debitItem(wallet, ENHANCE_MATERIAL_IDS.lucky, planned.cost.lucky);

  const result = attemptEnhance(
    {
      level: instance.enhance,
      luck: planned.luck,
      useProtection: planned.useProtection,
    },
    rng,
  );

  // 批量强化在碎裂段只允许“幸运保底”或“自动保护”两条安全路径。
  if (result.nextLevel === null || result.outcome === 'broken') {
    throw new Error('enhanceBatch: 安全规则失效，批量强化不得碎裂装备');
  }
  if (result.protectionConsumed) {
    debitItem(wallet, ENHANCE_MATERIAL_IDS.protection, 1);
  }

  let gainRoll: PermilleRoll<EnhanceGainGrade> | null = null;
  const targetKey = String(result.targetLevel);
  if (result.outcome === 'success') {
    const gainIndex = result.targetLevel - 1;
    if (instance.enhanceGainPermille[gainIndex] === 0) {
      gainRoll = rollEnhanceGainPermille(
        rng.derive(enhanceGainSalt(instance.uid, result.targetLevel)),
      );
      instance.enhanceGainPermille[gainIndex] = gainRoll.permille;
    }
    delete instance.enhanceLuck[targetKey];
  } else if (result.nextLuck !== null) {
    instance.enhanceLuck[targetKey] = result.nextLuck;
  }
  instance.enhance = result.nextLevel;

  return {
    attempt: attemptIndex + 1,
    round,
    uid: instance.uid,
    milestone,
    equipmentLevel: candidate.equipmentLevel,
    order: candidate.order,
    useProtection: planned.useProtection,
    cost: planned.cost,
    result,
    gainRoll,
  };
}

function makeBlockedEvent(
  candidate: WorkingCandidate,
  reason: EnhanceBatchBlockReason,
  cost: EnhanceCost,
  milestone: number,
  round: number,
): EnhanceBatchBlockedEvent {
  return {
    uid: candidate.instance.uid,
    reason,
    currentLevel: candidate.instance.enhance,
    targetLevel: candidate.instance.enhance + 1,
    milestone,
    round,
    cost,
  };
}

function milestonesFor(targetLevel: number): number[] {
  return [...ENHANCE_BATCH_MILESTONES.filter((milestone) => milestone < targetLevel), targetLevel];
}

function cloneEquipmentInstance(instance: EquipmentInstance): EquipmentInstance {
  return {
    ...instance,
    enhanceGainPermille: [...instance.enhanceGainPermille],
    enhanceLuck: { ...instance.enhanceLuck },
    affixes: instance.affixes.map((affix) => ({ ...affix })),
  };
}

function cloneWallet(wallet: EnhanceBatchWallet): EnhanceBatchWallet {
  return {
    gold: wallet.gold,
    items: { ...wallet.items },
  };
}

function itemCount(wallet: EnhanceBatchWallet, itemId: string): number {
  return wallet.items[itemId] ?? 0;
}

function debitItem(wallet: EnhanceBatchWallet, itemId: string, count: number): void {
  if (count === 0) return;
  const next = itemCount(wallet, itemId) - count;
  if (next === 0) delete wallet.items[itemId];
  else wallet.items[itemId] = next;
}

function assertInput(input: EnhanceBatchInput): void {
  if (!Number.isInteger(input.rngState) || input.rngState < 0 || input.rngState > 0xffff_ffff) {
    throw new Error(`enhanceBatch: rngState 必须是 uint32，收到 ${input.rngState}`);
  }
  if (
    !Number.isInteger(input.targetLevel) ||
    input.targetLevel < 1 ||
    input.targetLevel > ENHANCE_MAX
  ) {
    throw new Error(`enhanceBatch: 目标等级必须在 1~${ENHANCE_MAX}，收到 ${input.targetLevel}`);
  }
  if (input.strategy !== 'single' && input.strategy !== 'balanced') {
    throw new Error(`enhanceBatch: 未知策略 ${String(input.strategy)}`);
  }

  const maxAttempts = input.maxAttempts ?? ENHANCE_BATCH_MAX_ATTEMPTS;
  if (
    !Number.isInteger(maxAttempts) ||
    maxAttempts < 1 ||
    maxAttempts > ENHANCE_BATCH_MAX_ATTEMPTS
  ) {
    throw new Error(
      `enhanceBatch: maxAttempts 必须在 1~${ENHANCE_BATCH_MAX_ATTEMPTS}，收到 ${maxAttempts}`,
    );
  }

  assertNonNegativeSafeInteger(input.wallet.gold, 'wallet.gold');
  for (const [itemId, count] of Object.entries(input.wallet.items)) {
    assertNonNegativeSafeInteger(count, `wallet.items.${itemId}`);
  }

  const uids = new Set<string>();
  input.candidates.forEach((candidate, index) => {
    if (!Number.isInteger(candidate.equipmentLevel) || candidate.equipmentLevel < 1) {
      throw new Error(`enhanceBatch: 第 ${index + 1} 件装备的 equipmentLevel 必须是正整数`);
    }
    if (!Number.isInteger(candidate.order) || candidate.order < 0) {
      throw new Error(`enhanceBatch: 第 ${index + 1} 件装备的 order 必须是非负整数`);
    }
    if (
      !Number.isInteger(candidate.instance.enhance) ||
      candidate.instance.enhance < 0 ||
      candidate.instance.enhance > ENHANCE_MAX
    ) {
      throw new Error(`enhanceBatch: 装备 ${candidate.instance.uid} 的强化等级不合法`);
    }
    if (candidate.instance.enhanceGainPermille.length !== ENHANCE_MAX) {
      throw new Error(
        `enhanceBatch: 装备 ${candidate.instance.uid} 的强化增幅必须固定为 ${ENHANCE_MAX} 格`,
      );
    }
    if (uids.has(candidate.instance.uid)) {
      throw new Error(`enhanceBatch: 装备 uid 重复：${candidate.instance.uid}`);
    }
    uids.add(candidate.instance.uid);
  });
}

function assertNonNegativeSafeInteger(value: number, label: string): void {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new Error(`enhanceBatch: ${label} 必须是非负安全整数，收到 ${value}`);
  }
}
