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
