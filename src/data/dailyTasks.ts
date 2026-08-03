/**
 * 日常任务定义（M4-1，docs/14 日常循环）。
 *
 * 内容与代码分离（铁律 2）：本文件只描述任务本身（做什么/目标/活跃度），
 * 不包含任何逻辑。8 条任务覆盖游戏核心循环：挂机/推关/扫荡/强化/洗练/
 * 好感/副本/竞技。
 */
export type DailyTaskId =
  | 'idle-minutes'
  | 'challenge'
  | 'sweep'
  | 'enhance'
  | 'reforge'
  | 'affection'
  | 'dungeon'
  | 'arena';

export interface DailyTaskDef {
  id: DailyTaskId;
  /** 玩家可见的任务名。 */
  label: string;
  /** 目标值（分钟/次数）。 */
  target: number;
  /** 单位文案。 */
  unit: string;
  /** 完成该任务获得的活跃度。 */
  activity: number;
}

/** 8 条日常任务：每条 10 活跃度，全做完 = 80 活跃度。 */
export const DAILY_TASKS: readonly DailyTaskDef[] = [
  { id: 'idle-minutes', label: '挂机 30 分钟', target: 30, unit: '分钟', activity: 10 },
  { id: 'challenge', label: '挑战关卡 3 次', target: 3, unit: '次', activity: 10 },
  { id: 'sweep', label: '扫荡 5 次', target: 5, unit: '次', activity: 10 },
  { id: 'enhance', label: '强化装备 1 次', target: 1, unit: '次', activity: 10 },
  { id: 'reforge', label: '洗练词条 1 次', target: 1, unit: '次', activity: 10 },
  { id: 'affection', label: '好感互动 1 次', target: 1, unit: '次', activity: 10 },
  { id: 'dungeon', label: '打装备副本 1 次', target: 1, unit: '次', activity: 10 },
  { id: 'arena', label: '竞技场挑战 1 次', target: 1, unit: '次', activity: 10 },
];

export interface ActivityTier {
  /** 需要累计活跃度达到的阈值。 */
  threshold: number;
  /** 档位奖励 id（发放逻辑在 store，这里只做标识）。 */
  rewardId: string;
}

/** 四档活跃度宝箱：20 / 40 / 60 / 80。 */
export const ACTIVITY_TIERS: readonly ActivityTier[] = [
  { threshold: 20, rewardId: 'daily_tier_1' },
  { threshold: 40, rewardId: 'daily_tier_2' },
  { threshold: 60, rewardId: 'daily_tier_3' },
  { threshold: 80, rewardId: 'daily_tier_4' },
];

/** 一次活跃度宝箱可发放的奖励形状（与签到/体力补给同口径）。 */
export interface DailyTierReward {
  /** 金币。 */
  gold?: number;
  /** 体力（入账时按体力上限截断，与每日补给同口径）。 */
  stamina?: number;
  /** 材料 / 消耗品：itemId → 数量（沿用 bag.items 的既有 id）。 */
  items?: Readonly<Record<string, number>>;
}

/**
 * 四档活跃度宝箱奖励（信息型福利，量级对齐签到：保守补充，不参与产出曲线）。
 * 20/40/60 为小补给，80 全完成大奖。
 */
export const ACTIVITY_TIER_REWARDS: Readonly<Record<string, DailyTierReward>> = {
  daily_tier_1: { gold: 5000, stamina: 20 },
  daily_tier_2: { gold: 8000, items: { stone_enhance: 3 } },
  daily_tier_3: { gold: 12000, items: { ore_black: 30 } },
  daily_tier_4: { gold: 20000, stamina: 60, items: { lucky_nine: 2 } },
};
