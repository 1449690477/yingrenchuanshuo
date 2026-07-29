/**
 * 装备跨区升阶的纯计算层。
 *
 * 升阶只把一件区域装备换成下一地区的同部位、同品质定义；玩家已经投入的
 * 强化、胚子、词条与洗练共鸣全部原样保留。材料规则由 data 层传入，
 * 本文件不读取 Pinia、存档或 UI，也不消费 RNG。
 */

import type { EquipmentDef, EquipmentInstance } from './types';

export interface EquipmentAdvancementWallet {
  gold: number;
  items: Readonly<Record<string, number>>;
}

export interface EquipmentAdvancementRequirement {
  fineItemId: string;
  rareItemId: string;
  fineCount: number;
  rareCount: number;
  goldPerTargetLevel: number;
}

export interface EquipmentAdvancementCost {
  gold: number;
  items: Readonly<Record<string, number>>;
}

export type EquipmentAdvancementFailure =
  | {
      ok: false;
      reason: 'pending-affix-change';
    }
  | {
      ok: false;
      reason: 'level-locked';
      requiredLevel: number;
      playerLevel: number;
    }
  | {
      ok: false;
      reason: 'insufficient-gold';
      required: number;
      owned: number;
    }
  | {
      ok: false;
      reason: 'insufficient-item';
      itemId: string;
      required: number;
      owned: number;
    };

export interface EquipmentAdvancementSuccess {
  ok: true;
  equipment: EquipmentInstance;
  wallet: EquipmentAdvancementWallet;
  cost: EquipmentAdvancementCost;
  sourceDefId: string;
  targetDefId: string;
}

export type EquipmentAdvancementResult =
  | EquipmentAdvancementFailure
  | EquipmentAdvancementSuccess;

function assertNonNegativeSafeInteger(value: number, label: string): void {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new Error(`${label}必须是非负安全整数，收到 ${value}`);
  }
}

function assertPositiveSafeInteger(value: number, label: string): void {
  if (!Number.isSafeInteger(value) || value <= 0) {
    throw new Error(`${label}必须是正安全整数，收到 ${value}`);
  }
}

function assertAdvancementDefinitions(
  instance: EquipmentInstance,
  source: EquipmentDef,
  target: EquipmentDef,
): void {
  assertPositiveSafeInteger(source.level, '来源装备等级');
  assertPositiveSafeInteger(target.level, '目标装备等级');
  if (instance.defId !== source.id) {
    throw new Error(
      `[配置错误] 升阶实例与来源定义不一致：${instance.defId} !== ${source.id}`,
    );
  }
  if (target.id === source.id) {
    throw new Error(`[配置错误] 升阶来源与目标不能是同一装备：${source.id}`);
  }
  if (target.level <= source.level) {
    throw new Error(
      `[配置错误] 升阶目标等级必须高于来源：${source.id} Lv${source.level} → ${target.id} Lv${target.level}`,
    );
  }
  if (target.slot !== source.slot) {
    throw new Error(
      `[配置错误] 升阶不得改变部位：${source.id} ${source.slot} → ${target.id} ${target.slot}`,
    );
  }
  if (target.quality !== source.quality) {
    throw new Error(
      `[配置错误] 升阶不得偷偷改变品质：${source.id} ${source.quality} → ${target.id} ${target.quality}`,
    );
  }
  if (target.classId !== source.classId) {
    throw new Error(
      `[配置错误] 升阶不得改变职业限制：${source.id} → ${target.id}`,
    );
  }
  if (
    source.fixedTemplate ||
    target.fixedTemplate ||
    (source.fixedAffixes?.length ?? 0) > 0 ||
    (target.fixedAffixes?.length ?? 0) > 0 ||
    (source.extraAffixSlots ?? 0) > 0 ||
    (target.extraAffixSlots ?? 0) > 0 ||
    source.setId ||
    target.setId
  ) {
    throw new Error(
      `[配置错误] 固定模板、额外词条槽、套装或带固定词条的装备不能走区域升阶：${source.id} → ${target.id}`,
    );
  }
}

export function equipmentAdvancementCost(
  target: EquipmentDef,
  requirement: EquipmentAdvancementRequirement,
): EquipmentAdvancementCost {
  if (!requirement.fineItemId || !requirement.rareItemId) {
    throw new Error('[配置错误] 升阶材料 ID 不能为空');
  }
  if (requirement.fineItemId === requirement.rareItemId) {
    throw new Error('[配置错误] 升阶的 fine 与 rare 材料必须不同');
  }
  assertPositiveSafeInteger(requirement.fineCount, 'fine 材料数量');
  assertPositiveSafeInteger(requirement.rareCount, 'rare 材料数量');
  assertPositiveSafeInteger(requirement.goldPerTargetLevel, '每级金币成本');
  assertPositiveSafeInteger(target.level, '目标装备等级');

  const gold = target.level * requirement.goldPerTargetLevel;
  if (!Number.isSafeInteger(gold)) {
    throw new Error(`[配置错误] 升阶金币成本超出安全整数：${gold}`);
  }

  return {
    gold,
    items: {
      [requirement.fineItemId]: requirement.fineCount,
      [requirement.rareItemId]: requirement.rareCount,
    },
  };
}

function cloneEquipmentWithTarget(
  instance: EquipmentInstance,
  targetDefId: string,
): EquipmentInstance {
  return {
    ...instance,
    defId: targetDefId,
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

/**
 * 规划一次原子升阶。
 *
 * 返回成功结果前不会修改输入；调用方只有在 `ok === true` 后才可一次性写回
 * 新装备与钱包。未确认洗练候选是硬锁：不得自动采用、保留或清空。
 */
export function planEquipmentAdvancement(input: {
  instance: EquipmentInstance;
  sourceDefinition: EquipmentDef;
  targetDefinition: EquipmentDef;
  playerLevel: number;
  wallet: EquipmentAdvancementWallet;
  requirement: EquipmentAdvancementRequirement;
}): EquipmentAdvancementResult {
  const {
    instance,
    sourceDefinition,
    targetDefinition,
    playerLevel,
    wallet,
    requirement,
  } = input;

  assertAdvancementDefinitions(instance, sourceDefinition, targetDefinition);
  assertNonNegativeSafeInteger(playerLevel, '玩家等级');
  assertNonNegativeSafeInteger(wallet.gold, '钱包金币');
  for (const [itemId, count] of Object.entries(wallet.items)) {
    if (!itemId) throw new Error('[配置错误] 钱包物品 ID 不能为空');
    assertNonNegativeSafeInteger(count, `钱包物品 ${itemId} 数量`);
  }
  // 配置错误必须先暴露，不能被玩家当前等级或待确认候选掩盖。
  const cost = equipmentAdvancementCost(targetDefinition, requirement);

  if (instance.pendingAffixChange) {
    return { ok: false, reason: 'pending-affix-change' };
  }

  if (playerLevel < targetDefinition.level) {
    return {
      ok: false,
      reason: 'level-locked',
      requiredLevel: targetDefinition.level,
      playerLevel,
    };
  }

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
      return {
        ok: false,
        reason: 'insufficient-item',
        itemId,
        required,
        owned,
      };
    }
  }

  const nextItems = { ...wallet.items };
  for (const [itemId, required] of Object.entries(cost.items)) {
    const nextCount = (nextItems[itemId] ?? 0) - required;
    if (nextCount === 0) delete nextItems[itemId];
    else nextItems[itemId] = nextCount;
  }

  return {
    ok: true,
    equipment: cloneEquipmentWithTarget(instance, targetDefinition.id),
    wallet: {
      gold: wallet.gold - cost.gold,
      items: nextItems,
    },
    cost,
    sourceDefId: sourceDefinition.id,
    targetDefId: targetDefinition.id,
  };
}
