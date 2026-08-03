/**
 * 日常任务核心（M4-1）。
 *
 * 纯函数（铁律 1）：不读存档、不触 UI、不读时钟外状态。
 * 日切统一走 businessDayKey（北京 04:00），与好感/试炼/红点同一口径。
 *
 * 状态模型：
 * - day：当前日切 key；与存档里的 day 不同时自动重置进度与已领档位。
 * - progress：任务 id → 当日累计进度（封顶 target，不超）。
 * - claimedTiers：当日已领取的活跃度档位（threshold 值列表）。
 * 活跃度 = 所有已完成任务（progress >= target）的 activity 之和。
 */
import { businessDayKey } from './dayKey';
import { ACTIVITY_TIERS, DAILY_TASKS, type DailyTaskId } from '@/data/dailyTasks';

export interface DailyTaskState {
  /** 当前日切 key（'YYYY-MM-DD'）。 */
  day: string;
  /** 任务 id → 当日累计进度（已封顶）。 */
  progress: Readonly<Record<DailyTaskId, number>>;
  /** 当日已领取的活跃度档位（threshold 值）。 */
  claimedTiers: readonly number[];
}

export function createDailyTaskState(now: number): DailyTaskState {
  const progress = Object.fromEntries(DAILY_TASKS.map((t) => [t.id, 0])) as Record<
    DailyTaskId,
    number
  >;
  return { day: businessDayKey(now), progress, claimedTiers: [] };
}

/**
 * 把状态对齐到「当前日切」：跨日时重置进度与已领档位。
 * 返回新对象，不修改入参。
 */
export function alignDailyTaskDay(state: DailyTaskState, now: number): DailyTaskState {
  const today = businessDayKey(now);
  if (state.day === today) return state;
  return createDailyTaskState(now);
}

/** 累计一条任务的进度（封顶 target；跨日自动重置）。 */
export function recordDailyTaskProgress(
  state: DailyTaskState,
  taskId: DailyTaskId,
  delta: number,
  now: number,
): DailyTaskState {
  const aligned = alignDailyTaskDay(state, now);
  const def = DAILY_TASKS.find((t) => t.id === taskId);
  if (!def) return aligned;
  const current = aligned.progress[taskId] ?? 0;
  const next = Math.min(def.target, Math.max(0, current + Math.max(0, delta)));
  return {
    ...aligned,
    progress: { ...aligned.progress, [taskId]: next },
  };
}

/** 当日已完成任务的总活跃度（0~80）。 */
export function dailyActivity(state: DailyTaskState, now: number): number {
  const aligned = alignDailyTaskDay(state, now);
  return DAILY_TASKS.filter((t) => (aligned.progress[t.id] ?? 0) >= t.target).reduce(
    (sum, t) => sum + t.activity,
    0,
  );
}

/**
 * 当前可领取的最低档位；没有可领的返回 null。
 * 已领过的档位不重复领。
 */
export function nextClaimableTier(
  state: DailyTaskState,
  now: number,
): { threshold: number; rewardId: string } | null {
  const aligned = alignDailyTaskDay(state, now);
  const activity = dailyActivity(aligned, now);
  for (const tier of ACTIVITY_TIERS) {
    if (activity >= tier.threshold && !aligned.claimedTiers.includes(tier.threshold)) {
      return tier;
    }
  }
  return null;
}

/** 领取一个活跃度档位；无可领返回 null。 */
export function claimActivityTier(
  state: DailyTaskState,
  now: number,
): { state: DailyTaskState; tier: { threshold: number; rewardId: string } } | null {
  const aligned = alignDailyTaskDay(state, now);
  const tier = nextClaimableTier(aligned, now);
  if (!tier) return null;
  return {
    state: {
      ...aligned,
      claimedTiers: [...aligned.claimedTiers, tier.threshold],
    },
    tier,
  };
}
