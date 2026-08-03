import { describe, expect, it } from 'vitest';
import { applySignIn, signInStatus, type SignInState } from '../checkin';
import { SIGN_IN_CYCLE_REWARDS, SIGN_IN_MONTH_MILESTONES } from '@/data/checkin';

/** 从未签过的新号状态（与存档 v25 迁移默认值一致）。 */
const freshState: SignInState = {
  lastSignInDay: null,
  cycleClaimed: 0,
  monthKey: null,
  monthCount: 0,
};

describe('签到状态展示（signInStatus）', () => {
  it('新号当天可签，奖励位置从第 1 天开始，月度计数为 0', () => {
    const status = signInStatus(freshState, '2026-08-03');
    expect(status.claimable).toBe(true);
    expect(status.rewardIndex).toBe(0);
    expect(status.monthCount).toBe(0);
    expect(status.nextMilestoneDays).toBe(7);
  });

  it('当天已签则不可再签', () => {
    const state: SignInState = { ...freshState, lastSignInDay: '2026-08-03', cycleClaimed: 1, monthKey: '2026-08', monthCount: 1 };
    expect(signInStatus(state, '2026-08-03').claimable).toBe(false);
  });

  it('跨月后月度计数展示归零，里程碑回到最近一档', () => {
    const state: SignInState = { lastSignInDay: '2026-07-31', cycleClaimed: 9, monthKey: '2026-07', monthCount: 9 };
    const status = signInStatus(state, '2026-08-01');
    expect(status.claimable).toBe(true);
    expect(status.monthCount).toBe(0);
    expect(status.nextMilestoneDays).toBe(7);
  });

  it('拒绝非法日切 key', () => {
    expect(() => signInStatus(freshState, '2026/08/03')).toThrow('日切 key');
    expect(() => signInStatus(freshState, '')).toThrow('日切 key');
  });

  it('拒绝非法状态计数', () => {
    expect(() => signInStatus({ ...freshState, cycleClaimed: -1 }, '2026-08-03')).toThrow('cycleClaimed');
    expect(() => signInStatus({ ...freshState, monthCount: 1.5 }, '2026-08-03')).toThrow('monthCount');
  });
});

describe('签到结算（applySignIn）', () => {
  it('首次签到领取第 1 天奖励并写入日切 key', () => {
    const result = applySignIn(freshState, '2026-08-03');
    expect(result).not.toBeNull();
    expect(result?.rewardIndex).toBe(0);
    expect(result?.reward).toEqual(SIGN_IN_CYCLE_REWARDS[0]);
    expect(result?.state).toEqual({
      lastSignInDay: '2026-08-03',
      cycleClaimed: 1,
      monthKey: '2026-08',
      monthCount: 1,
    });
    expect(result?.milestone).toBeNull();
  });

  it('同一天重复签到返回 null，状态不变（幂等）', () => {
    const state: SignInState = { lastSignInDay: '2026-08-03', cycleClaimed: 1, monthKey: '2026-08', monthCount: 1 };
    expect(applySignIn(state, '2026-08-03')).toBeNull();
  });

  it('连续签到按七日循环推进，第 8 次回到第 1 天奖励', () => {
    let state = freshState;
    for (let day = 3; day <= 10; day += 1) {
      const result = applySignIn(state, `2026-08-${String(day).padStart(2, '0')}`);
      expect(result).not.toBeNull();
      state = result!.state;
    }
    expect(state.cycleClaimed).toBe(8);
    // 第 8 次签到领的是位置 0（八月初三～初十共 8 天连签）
    expect(signInStatus(state, '2026-08-11').rewardIndex).toBe(1);
  });

  it('断签不重置：隔几天再签，循环与月度计数都照常推进', () => {
    const first = applySignIn(freshState, '2026-08-01');
    // 断签 5 天，08-07 再来签
    const second = applySignIn(first!.state, '2026-08-07');
    expect(second).not.toBeNull();
    expect(second?.rewardIndex).toBe(1);
    expect(second?.state.cycleClaimed).toBe(2);
    expect(second?.state.monthCount).toBe(2);
  });

  it('月度里程碑：累计第 7 天随签到一并发放，第 6 / 8 天不发', () => {
    let state = freshState;
    let sixth: ReturnType<typeof applySignIn> = null;
    let seventh: ReturnType<typeof applySignIn> = null;
    let eighth: ReturnType<typeof applySignIn> = null;
    for (let day = 1; day <= 8; day += 1) {
      const result = applySignIn(state, `2026-08-${String(day).padStart(2, '0')}`);
      state = result!.state;
      if (day === 6) sixth = result;
      if (day === 7) seventh = result;
      if (day === 8) eighth = result;
    }
    expect(sixth?.milestone).toBeNull();
    expect(seventh?.milestone).toEqual(SIGN_IN_MONTH_MILESTONES[0]);
    expect(eighth?.milestone).toBeNull();
  });

  it('跨月后月度计数重新累计，里程碑可再次达成', () => {
    let state: SignInState = {
      lastSignInDay: '2026-07-07',
      cycleClaimed: 7,
      monthKey: '2026-07',
      monthCount: 7,
    };
    // 8 月连签 7 天：新月的第 7 天再次触发 7 天里程碑
    for (let day = 1; day <= 7; day += 1) {
      const result = applySignIn(state, `2026-08-${String(day).padStart(2, '0')}`);
      expect(result).not.toBeNull();
      state = result!.state;
      if (day < 7) expect(result?.milestone).toBeNull();
    }
    expect(state.monthCount).toBe(7);
    const final = applySignIn({ ...state, lastSignInDay: '2026-08-07' }, '2026-08-07');
    expect(final).toBeNull();
  });

  it('里程碑档位齐全且严格递增（数据表守卫）', () => {
    const days = SIGN_IN_MONTH_MILESTONES.map((entry) => entry.days);
    expect(days).toEqual([7, 14, 21, 28]);
    expect(SIGN_IN_CYCLE_REWARDS).toHaveLength(7);
    for (const reward of SIGN_IN_CYCLE_REWARDS) {
      expect((reward.gold ?? 0) >= 0 || (reward.stamina ?? 0) >= 0 || reward.items).toBeTruthy();
    }
  });

  it('拒绝非法输入', () => {
    expect(() => applySignIn(freshState, '20260803')).toThrow('日切 key');
  });
});
