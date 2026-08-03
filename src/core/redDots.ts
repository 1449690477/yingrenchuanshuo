/**
 * M3-11 · 信息型红点（可行动提示）核心判定。
 *
 * 设计依据（docs/40 / docs/41）：
 * - docs/40 红线：不做焦虑型红点、不做「限时不领就没了」的外部触发。
 * - docs/41 建议：改「信息型提示」——陈述事实（「体力补给可领」「有可强化项」），
 *   玩家可以无视；不做未读计数、不做数字角标、不闪烁。
 * - 因此本模块只回答「某类可行动事实是否存在」，不维护任何已读/未读状态；
 *   事实消失（领完 / 强化完 / 次数用尽）提示自然熄灭。
 *
 * 铁律 1 / 3 / 4：本模块是纯函数、零 UI 依赖、零副作用，必须配单元测试。
 */
import { ENHANCE_MATERIAL_IDS, ENHANCE_MAX, SLOT_ORDER } from '@/data/constants';
import { enhanceCost } from './enhance';
import type { EquipSlot, EquipmentInstance } from './types';

export type DotTabKey = 'idle' | 'bag' | 'growth' | 'dungeon' | 'rank' | 'more';

/** 评估输入：各可行动来源的原子计数 / 标志，全部可从存档状态纯计算。 */
export interface RedDotSnapshot {
  /** 今日体力补给剩余次数（0 ~ DAILY_STAMINA_CLAIM_MAX，M3-6）。 */
  staminaClaimRemaining: number;
  /** 挂机中待处理的奇遇事件数。 */
  pendingEncounterCount: number;
  /** 待确认洗练结果的装备件数（穿戴 + 背包）。 */
  pendingAffixCount: number;
  /** 已穿戴装备中可强化（未满级且资源足够一次）的件数。 */
  enhanceableEquipped: number;
  /** 当前职业可升级技能条数。 */
  skillUpgradeable: number;
  /** 装备副本今日剩余次数。 */
  dungeonAttemptsRemaining: number;
  /** 可获得好感互动的剩余次数。 */
  affectionInteractionsRemaining: number;
  /** 进度榜存在未同步的新进度。 */
  hasUnsyncedProgress: boolean;
  /** 已达成但尚未上传服务端复核的里程碑数。 */
  pendingMilestoneCount: number;
  /** 公会可领取的委托 / 据点奖励数（联机快照；首版由公会线接入时提供）。 */
  guildClaimableCount: number;
  /** 邮箱存在可领取附件（M4-5，信息型布尔；无未读计数）。 */
  hasClaimableMail: boolean;
  /** M4-1 日常任务：存在可领取的活跃度档位（信息型布尔，不计数）。 */
  dailyTierClaimable: boolean;
}

export interface RedDotState {
  idle: boolean;
  bag: boolean;
  growth: boolean;
  dungeon: boolean;
  rank: boolean;
  more: boolean;
}

/** 各 tab 的事实文案（信息型：陈述事实，不带计数、不带感叹号）。 */
export const RED_DOT_LABELS: Record<DotTabKey, string> = {
  idle: '挂机：今日体力补给可领、有奇遇待处理或日常宝箱可领',
  bag: '背包：有洗练结果待确认',
  growth: '养成：有可强化或可升级项',
  dungeon: '副本：装备副本还有挑战次数',
  rank: '排行：有未同步进度、好感可互动或里程碑待上报',
  more: '更多：有可领取的奖励',
};

export interface EnhanceableWallet {
  gold: number;
  items: Readonly<Record<string, number>>;
}

/**
 * 单件装备在给定资源下是否可强化一次。
 * 与 core/enhanceBatch 的资源预检同口径；保护符属玩家选择，不算硬前提。
 */
export function isEnhanceable(
  instance: EquipmentInstance,
  equipmentLevel: number,
  wallet: EnhanceableWallet,
): boolean {
  if (instance.enhance >= ENHANCE_MAX) return false;
  if (instance.pendingAffixChange) return false;
  const cost = enhanceCost(instance.enhance + 1, equipmentLevel);
  return (
    wallet.gold >= cost.gold &&
    (wallet.items[ENHANCE_MATERIAL_IDS.stone] ?? 0) >= cost.stone &&
    (wallet.items[ENHANCE_MATERIAL_IDS.ore] ?? 0) >= cost.ore &&
    (wallet.items[ENHANCE_MATERIAL_IDS.lucky] ?? 0) >= cost.lucky
  );
}

/** 待确认洗练结果的装备件数（已穿戴 + 背包）。 */
export function countPendingAffix(
  equipped: Readonly<Partial<Record<EquipSlot, EquipmentInstance | null>>>,
  bagEquipment: readonly EquipmentInstance[],
): number {
  let count = 0;
  for (const slot of SLOT_ORDER) {
    if (equipped[slot]?.pendingAffixChange) count += 1;
  }
  for (const instance of bagEquipment) {
    if (instance.pendingAffixChange) count += 1;
  }
  return count;
}

/** 汇总判定：任一来源存在可行动事实 → 对应 tab 亮起。 */
export function evaluateRedDots(snapshot: RedDotSnapshot): RedDotState {
  return {
    idle:
      snapshot.staminaClaimRemaining > 0 ||
      snapshot.pendingEncounterCount > 0 ||
      snapshot.dailyTierClaimable,
    bag: snapshot.pendingAffixCount > 0,
    growth: snapshot.enhanceableEquipped > 0 || snapshot.skillUpgradeable > 0,
    dungeon: snapshot.dungeonAttemptsRemaining > 0,
    rank:
      snapshot.hasUnsyncedProgress ||
      snapshot.affectionInteractionsRemaining > 0 ||
      snapshot.pendingMilestoneCount > 0,
    more: snapshot.guildClaimableCount > 0 || snapshot.hasClaimableMail,
  };
}
