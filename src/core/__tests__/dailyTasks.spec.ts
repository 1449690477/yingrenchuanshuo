import { describe, expect, it } from 'vitest';
import {
  ACTIVITY_TIERS,
  DAILY_TASKS,
} from '@/data/dailyTasks';
import {
  alignDailyTaskDay,
  claimActivityTier,
  claimActivityTierAt,
  createDailyTaskState,
  dailyActivity,
  nextClaimableTier,
  recordDailyTaskProgress,
} from '../dailyTasks';

const NOW = 1_800_000_000_000;

describe('dailyTasks', () => {
  it('8 条任务、四档活跃度（20/40/60/80），全做完 = 80 活跃度', () => {
    expect(DAILY_TASKS).toHaveLength(8);
    expect(ACTIVITY_TIERS.map((t) => t.threshold)).toEqual([20, 40, 60, 80]);
    expect(DAILY_TASKS.reduce((s, t) => s + t.activity, 0)).toBe(80);
  });

  it('初始状态：当日、全 0 进度、无可领档位', () => {
    const s = createDailyTaskState(NOW);
    expect(s.day).toBeDefined();
    expect(Object.values(s.progress).every((v) => v === 0)).toBe(true);
    expect(s.claimedTiers).toEqual([]);
    expect(nextClaimableTier(s, NOW)).toBeNull();
  });

  it('进度累计封顶：同任务多次记录不超 target', () => {
    let s = createDailyTaskState(NOW);
    s = recordDailyTaskProgress(s, 'challenge', 2, NOW);
    s = recordDailyTaskProgress(s, 'challenge', 2, NOW);
    expect(s.progress.challenge).toBe(3); // target = 3
  });

  it('完成 2 条任务（20 活跃度）后可领第一档', () => {
    let s = createDailyTaskState(NOW);
    s = recordDailyTaskProgress(s, 'challenge', 3, NOW); // 10 活跃度
    s = recordDailyTaskProgress(s, 'sweep', 5, NOW); // 10 活跃度
    expect(dailyActivity(s, NOW)).toBe(20);
    expect(nextClaimableTier(s, NOW)).toMatchObject({ threshold: 20 });
  });

  it('领取后档位不重复领；下一档需继续累计', () => {
    let s = createDailyTaskState(NOW);
    s = recordDailyTaskProgress(s, 'challenge', 3, NOW);
    s = recordDailyTaskProgress(s, 'sweep', 5, NOW);
    const claim = claimActivityTier(s, NOW);
    expect(claim).not.toBeNull();
    const after = claim!.state;
    expect(after.claimedTiers).toEqual([20]);
    expect(nextClaimableTier(after, NOW)).toBeNull(); // 活跃度仍 20，40 档未到
  });

  it('活跃度 40 时按序领 20、40 两档', () => {
    let s = createDailyTaskState(NOW);
    s = recordDailyTaskProgress(s, 'challenge', 3, NOW);
    s = recordDailyTaskProgress(s, 'sweep', 5, NOW);
    s = recordDailyTaskProgress(s, 'enhance', 1, NOW);
    s = recordDailyTaskProgress(s, 'reforge', 1, NOW);
    const first = claimActivityTier(s, NOW)!;
    const second = claimActivityTier(first.state, NOW)!;
    expect(first.tier.threshold).toBe(20);
    expect(second.tier.threshold).toBe(40);
    expect(second.state.claimedTiers).toEqual([20, 40]);
  });

  it('按档领取：指定档位达成且未领可领，未达成/重复领返回 null', () => {
    let s = createDailyTaskState(NOW);
    s = recordDailyTaskProgress(s, 'challenge', 3, NOW);
    s = recordDailyTaskProgress(s, 'sweep', 5, NOW);
    // 活跃度 20：领 20 成功，领 40 被拒
    const ok = claimActivityTierAt(s, 20, NOW);
    expect(ok).not.toBeNull();
    expect(ok!.tier.threshold).toBe(20);
    expect(ok!.state.claimedTiers).toEqual([20]);
    expect(claimActivityTierAt(s, 40, NOW)).toBeNull();
    // 重复领 20 被拒
    expect(claimActivityTierAt(ok!.state, 20, NOW)).toBeNull();
    // 全 8 条完成 = 80 活跃度，直接领 80 档
    let full = createDailyTaskState(NOW);
    for (const task of DAILY_TASKS) {
      full = recordDailyTaskProgress(full, task.id, task.target, NOW);
    }
    const last = claimActivityTierAt(full, 80, NOW);
    expect(last).not.toBeNull();
    expect(last!.tier.rewardId).toBe('daily_tier_4');
  });

  it('跨日自动重置进度与已领档位', () => {
    const tomorrow = NOW + 24 * 3_600_000;
    let s = createDailyTaskState(NOW);
    s = recordDailyTaskProgress(s, 'challenge', 3, NOW);
    s = recordDailyTaskProgress(s, 'sweep', 5, NOW);
    const claim = claimActivityTier(s, NOW)!;
    const nextDay = alignDailyTaskDay(claim.state, tomorrow);
    expect(nextDay.day).not.toBe(claim.state.day);
    expect(Object.values(nextDay.progress).every((v) => v === 0)).toBe(true);
    expect(nextDay.claimedTiers).toEqual([]);
    expect(dailyActivity(nextDay, tomorrow)).toBe(0);
  });
});
