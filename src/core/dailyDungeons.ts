/**
 * M4-4 · 日常材料副本核心逻辑（铁律 1：纯函数，零 UI / store 依赖）。
 *
 * 职责：
 * - 由业务日切 key 推导当日轮换主题（全游戏共用 dayKey 口径，docs/52 §九）；
 * - 难度门禁（等级 + 前置通过）与可挑战判定（次数上限）；
 * - 奖励结算口径（主题基础产量 × 难度倍率 + 金币）。
 *
 * 战斗与存档接线不在这里：store 层负责扣体力、记通过、发奖励。
 */

import {
  DAILY_DUNGEON_THEMES,
  DAILY_DUNGEON_TIERS,
  DAILY_DUNGEON_THEME_BASE,
  DAILY_DUNGEON_UNLOCK_LEVEL,
  DAILY_DUNGEON_RUNS_PER_TIER,
  DAILY_DUNGEON_WEEK_ROTATION,
  type DailyDungeonTheme,
  type DailyDungeonThemeId,
  type DailyDungeonTier,
  type DailyDungeonTierId,
} from '@/data/dailyDungeons';

const DAY_KEY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

/** 玩家进度快照（store 层从存档装配后传入）。 */
export interface DailyDungeonGateInput {
  /** 角色等级。 */
  level: number;
  /** 历史上通过过的难度 id（通过一次即永久解锁该档）。 */
  clearedTierIds: readonly DailyDungeonTierId[];
  /** 今天各难度已挑战次数（key = tierId）。 */
  todayRuns: Readonly<Partial<Record<DailyDungeonTierId, number>>>;
}

/** 单次挑战的结算结果形状（store 层据此落账）。 */
export interface DailyDungeonReward {
  /** 主题材料 id → 数量。 */
  items: Readonly<Record<string, number>>;
  /** 金币。 */
  gold: number;
}

export type DailyDungeonBlockReason =
  | 'level-locked'
  | 'tier-locked'
  | 'runs-exhausted'
  | 'unknown-tier';

function assertDayKey(dayKey: string): void {
  if (!DAY_KEY_PATTERN.test(dayKey)) {
    throw new Error(`[日常副本] dayKey 必须是 'YYYY-MM-DD' 日切 key，收到 ${dayKey}`);
  }
}

/**
 * 日切 key 对应的星期下标（0 = 周一，6 = 周日）。
 * dayKey 与 businessDayKey 同为 ISO 风格 'YYYY-MM-DD'，按 UTC 正午取星期
 * 不受时区影响。
 */
export function weekdayIndexOf(dayKey: string): number {
  assertDayKey(dayKey);
  const date = new Date(`${dayKey}T12:00:00Z`);
  return (date.getUTCDay() + 6) % 7;
}

/** 当日的轮换主题 id（轮换表长度恒为 7，见 spec 断言）。 */
export function dailyDungeonThemeIdOfDay(dayKey: string): DailyDungeonThemeId {
  assertDayKey(dayKey);
  const themeId = DAILY_DUNGEON_WEEK_ROTATION[weekdayIndexOf(dayKey)];
  if (!themeId) {
    throw new Error('[日常副本] 轮换表必须覆盖周一到周日共 7 天');
  }
  return themeId;
}

/** 当日主题的完整定义。 */
export function dailyDungeonOfDay(dayKey: string): DailyDungeonTheme {
  const themeId = dailyDungeonThemeIdOfDay(dayKey);
  const theme = DAILY_DUNGEON_THEMES.find((entry) => entry.id === themeId);
  if (!theme) {
    throw new Error(`[日常副本] 轮换表中的主题 ${themeId} 缺少定义`);
  }
  return theme;
}

/** 玩家当前已解锁的难度列表（等级 + 前置通过双重门禁）。 */
export function unlockedDailyDungeonTiers(input: DailyDungeonGateInput): DailyDungeonTier[] {
  assertGateInput(input);
  const cleared = new Set(input.clearedTierIds);
  return DAILY_DUNGEON_TIERS.filter((tier) => {
    if (input.level < tier.unlockLevel) return false;
    return tier.requiresTier === null || cleared.has(tier.requiresTier);
  });
}

/**
 * 某档难度今天能否挑战；不能则给出原因。
 * 次数按「每档各计」而不是全副本合计（DAILY_DUNGEON_RUNS_PER_TIER）。
 */
export function canChallengeDailyDungeon(
  input: DailyDungeonGateInput,
  tierId: DailyDungeonTierId,
): { ok: true; tier: DailyDungeonTier } | { ok: false; reason: DailyDungeonBlockReason } {
  assertGateInput(input);
  const tier = DAILY_DUNGEON_TIERS.find((entry) => entry.id === tierId);
  if (!tier) return { ok: false, reason: 'unknown-tier' };
  if (input.level < DAILY_DUNGEON_UNLOCK_LEVEL || input.level < tier.unlockLevel) {
    return { ok: false, reason: 'level-locked' };
  }
  if (tier.requiresTier !== null && !input.clearedTierIds.includes(tier.requiresTier)) {
    return { ok: false, reason: 'tier-locked' };
  }
  const runs = input.todayRuns[tierId] ?? 0;
  if (runs >= DAILY_DUNGEON_RUNS_PER_TIER) {
    return { ok: false, reason: 'runs-exhausted' };
  }
  return { ok: true, tier };
}

/** 一次挑战成功的奖励（主题材料 × 难度倍率 + 金币）。 */
export function dailyDungeonReward(
  themeId: DailyDungeonThemeId,
  tierId: DailyDungeonTierId,
): DailyDungeonReward {
  const theme = DAILY_DUNGEON_THEMES.find((entry) => entry.id === themeId);
  const tier = DAILY_DUNGEON_TIERS.find((entry) => entry.id === tierId);
  if (!theme) throw new Error(`[日常副本] 未知主题 ${themeId}`);
  if (!tier) throw new Error(`[日常副本] 未知难度 ${tierId}`);
  const base = DAILY_DUNGEON_THEME_BASE[themeId];
  return {
    items: { [theme.materialId]: base * tier.materialReward },
    gold: tier.goldReward,
  };
}

function assertGateInput(input: DailyDungeonGateInput): void {
  if (!Number.isInteger(input.level) || input.level < 1) {
    throw new Error(`[日常副本] level 必须是正整数，收到 ${input.level}`);
  }
}
