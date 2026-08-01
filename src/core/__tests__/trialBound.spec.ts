import { describe, expect, it } from 'vitest';
import {
  TRIAL_DAMAGE_HEADROOM,
  isPlausibleTrialDamage,
  maxPlausibleTrialDamage,
  trialBracketDamageCeiling,
  trialDamageCeiling,
} from '../trialBound';
import { trialBracketFor, trialWeekIndex, weeklyTrialBoss } from '../trial';
import { TRIAL_SEASON_ID, TRIAL_BRACKETS } from '../../data/trialRules';
import { judgeCheatEvidence } from '../cheatEvidence';
import { CLASS_IDS } from '../types';

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

  it('五职业在同一等级都有非零上界 —— 任一职业算不出上界都会变成系统性误伤', () => {
    for (const c of CLASS_IDS) {
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

describe('试炼判据 · 会话内升级滞后不得误伤（老板红线）', () => {
  // 背景：档案同步每个会话只跑一次（stores/leaderboard.ts connect() 的提前返回），
  // 提交成绩时不重新同步，于是权威等级恒**偏低**。若拿它本身当标尺，
  // 升级最快的新玩家会被判成超标最狠的作弊者。
  it('★ 段内任何等级滞后都不误伤：段顶满配的真实伤害不超过段底玩家的判定上界', () => {
    for (const bracket of TRIAL_BRACKETS) {
      const topReal = maxPlausibleTrialDamage(bracket.maxLevel, 'catkin', WEEK);
      expect(
        isPlausibleTrialDamage(topReal, bracket.minLevel, 'catkin', WEEK),
        `${bracket.id}：档案停在段底 Lv${bracket.minLevel}、实际已到段顶 Lv${bracket.maxLevel} 时被误判`,
      ).toBe(true);
    }
  });

  it('★ 新手段最狠：Lv1 档案 + Lv10 实力，改前超 1000 倍会被直接公示', () => {
    const bud = TRIAL_BRACKETS[0]!;
    const topReal = maxPlausibleTrialDamage(bud.maxLevel, 'catkin', WEEK);
    // 旧做法（按权威等级本身）会判成作弊，且倍率高到够格公开点名
    const oldBound = trialDamageCeiling(bud.minLevel, 'catkin', WEEK);
    const oldVerdict = judgeCheatEvidence({
      source: 'submit-trial',
      claimField: 'trial_damage',
      claimedValue: topReal,
      boundValue: oldBound,
      boundKind: 'upper',
      priorEvidenceCount: 0,
    });
    expect(oldVerdict.shouldPublish).toBe(true); // ← 这就是当时的红线事故
    // 新做法（按段顶）判为正常
    expect(isPlausibleTrialDamage(topReal, bud.minLevel, 'catkin', WEEK)).toBe(true);
  });

  it('段顶标尺不会把跨分段伪造放过 —— 绿玩那条实例仍然抓得住', () => {
    // 权威 Lv13（分段 b_moon，段顶 Lv23），却报出王冠段满血伤害
    const forged = 1_489_904;
    expect(isPlausibleTrialDamage(forged, 13, 'catkin', WEEK)).toBe(false);
    const bound = trialBracketDamageCeiling(13, 'catkin', WEEK);
    expect(forged / bound).toBeGreaterThan(10); // 仍达「极端倍率单次即可公示」
  });

  it('段顶上界对同段内所有等级是同一个数 —— 整段共用一把尺才谈得上免疫', () => {
    const bracket = trialBracketFor(60);
    const atBottom = trialBracketDamageCeiling(bracket.minLevel, 'catkin', WEEK);
    const atTop = trialBracketDamageCeiling(bracket.maxLevel, 'catkin', WEEK);
    const inMiddle = trialBracketDamageCeiling(
      Math.floor((bracket.minLevel + bracket.maxLevel) / 2),
      'catkin',
      WEEK,
    );
    expect(atBottom).toBe(atTop);
    expect(inMiddle).toBe(atTop);
  });
});
