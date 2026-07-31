import { describe, expect, it } from 'vitest';
import {
  TRIAL_DAMAGE_HEADROOM,
  isPlausibleTrialDamage,
  maxPlausibleTrialDamage,
  trialDamageCeiling,
} from '../trialBound';
import { trialBracketFor, trialWeekIndex, weeklyTrialBoss } from '../trial';
import { TRIAL_SEASON_ID } from '../../data/trialRules';

/** 用一个固定周次，避免读数随真实时间漂移。 */
const WEEK = trialWeekIndex(Date.parse('2026-07-30T12:00:00Z'));

describe('试炼伤害上界 · 不许误伤真实玩家', () => {
  it('把 Boss 打死（满伤）是合法的 —— 这是肝帝的正常形态，不是异常', () => {
    const bossHp = weeklyTrialBoss(TRIAL_SEASON_ID, WEEK, trialBracketFor(81).id).combatant.stats
      .hp;
    expect(isPlausibleTrialDamage(bossHp, 81, 'swordsman', WEEK)).toBe(true);
  });

  it('上界随等级单调不减 —— 高等级不该比低等级更容易被判违规', () => {
    let prev = 0;
    for (const lv of [13, 30, 45, 60, 81]) {
      const ceiling = trialDamageCeiling(lv, 'catkin', WEEK);
      expect(ceiling).toBeGreaterThanOrEqual(prev);
      prev = ceiling;
    }
  });

  it('四职业在同一等级都有非零上界 —— 任一职业算不出上界都会变成系统性误伤', () => {
    for (const c of ['swordsman', 'witch', 'shaman', 'catkin'] as const) {
      expect(maxPlausibleTrialDamage(65, c, WEEK)).toBeGreaterThan(0);
    }
  });

  it('上界含词条余量，且余量与战力上界同值（两条链口径必须一致）', () => {
    const raw = maxPlausibleTrialDamage(65, 'catkin', WEEK);
    expect(trialDamageCeiling(65, 'catkin', WEEK)).toBeCloseTo(raw * TRIAL_DAMAGE_HEADROOM, 5);
    expect(TRIAL_DAMAGE_HEADROOM).toBe(1.5);
  });
});

describe('试炼伤害上界 · 线上真实事故回归（绿玩，2026-07-30）', () => {
  /**
   * 真实数据：档案 Lv13 / 战力 1593，却提交出 1,489,904 伤害。
   * 那个数是 b_crown 分段 Boss 的满血，而 Lv13 属于 b_moon —— 他报的伤害
   * 比自己分段整个 Boss 的血还多 15 倍。这条断言钉住这次绕过不会复现。
   */
  it('Lv13 报出跨分段的 149 万伤害 → 判定为物理不可能', () => {
    expect(isPlausibleTrialDamage(1_489_904, 13, 'catkin', WEEK)).toBe(false);
  });

  it('同一条成绩换成真实的 Lv81 玩家 → 判定为合法（不能一刀切）', () => {
    expect(isPlausibleTrialDamage(1_489_904, 81, 'swordsman', WEEK)).toBe(true);
  });

  /**
   * 分段 Boss 是按该分段**上沿**标定的，所以分段下沿的玩家打不满它 ——
   * Lv13 的物理极限约 3.9 万，而 b_moon 的 Boss 有 9.7 万血。
   * 这条断言钉住的是「上界必须落在自己分段的量级内」：
   * 无论打不打得死，都不可能摸到另一个分段 149 万的量级。
   */
  it('Lv13 的上界落在自己分段量级内，与跨分段的 149 万差两个数量级', () => {
    const moonBossHp = weeklyTrialBoss(TRIAL_SEASON_ID, WEEK, trialBracketFor(13).id).combatant
      .stats.hp;
    const ceiling = trialDamageCeiling(13, 'catkin', WEEK);
    expect(ceiling).toBeLessThan(moonBossHp);
    expect(ceiling).toBeLessThan(1_489_904 / 10);
  });
});

describe('试炼伤害上界 · 非法输入不判为作弊', () => {
  it('非有限数、负数、越界等级一律判不可信而不是构成证据', () => {
    expect(isPlausibleTrialDamage(Number.NaN, 60, 'catkin', WEEK)).toBe(false);
    expect(isPlausibleTrialDamage(-1, 60, 'catkin', WEEK)).toBe(false);
    expect(isPlausibleTrialDamage(100, 0, 'catkin', WEEK)).toBe(false);
    expect(isPlausibleTrialDamage(100, 121, 'catkin', WEEK)).toBe(false);
  });
});
