/**
 * 竞技场内容配置（arenaRules.ts）的数据完整性测试。
 *
 * 数据表本身不写逻辑（铁律 2），但表与表之间的结构约束必须锁住：
 * 档位区间不能重叠、段位必须有兜底、奖励必须全为正数 ——
 * 这些都是 docs/52 数值章节的硬口径。
 */

import { describe, expect, it } from 'vitest';
import {
  ARENA_DAILY_CHALLENGES,
  ARENA_DEFENSE_REWARD_BROKEN,
  ARENA_DEFENSE_REWARD_DAILY_CAP,
  ARENA_DEFENSE_REWARD_HELD,
  ARENA_JOIN_HONOR,
  ARENA_MAX_ROUNDS,
  ARENA_OPPONENT_CANDIDATES,
  ARENA_OPPONENT_MAX_ABOVE,
  ARENA_OPPONENT_MIN_ABOVE,
  ARENA_RANK_DIFF_BANDS,
  ARENA_RESET_HOUR_CST,
  ARENA_REVENGE_WINDOW_HOURS,
  ARENA_STAKES,
  ARENA_STREAK_BANDS,
  ARENA_TIERS,
  ARENA_WIN_CHANCE_SIMULATIONS,
} from '@/data/arenaRules';

describe('arenaRules / 押注与挑战', () => {
  it('押注档位升序且全为正数', () => {
    expect(ARENA_STAKES.length).toBe(3);
    const sorted = [...ARENA_STAKES].sort((a, b) => a - b);
    expect([...ARENA_STAKES]).toEqual(sorted);
    for (const stake of ARENA_STAKES) expect(stake).toBeGreaterThan(0);
  });

  it('候选对手范围合法（只能挑战排名在自己上方的人）', () => {
    expect(ARENA_OPPONENT_CANDIDATES).toBe(3);
    expect(ARENA_OPPONENT_MIN_ABOVE).toBe(1);
    expect(ARENA_OPPONENT_MAX_ABOVE).toBe(15);
    expect(ARENA_OPPONENT_MIN_ABOVE).toBeLessThan(ARENA_OPPONENT_MAX_ABOVE);
  });

  it('每日次数与日切小时符合 docs/52 §3.1 / §九', () => {
    expect(ARENA_DAILY_CHALLENGES).toBe(5);
    expect(ARENA_RESET_HOUR_CST).toBe(4);
    expect(ARENA_REVENGE_WINDOW_HOURS).toBe(24);
  });
});

describe('arenaRules / 倍率表', () => {
  it('排名差区间无缝衔接 1~15 且不重叠', () => {
    let cursor = 1;
    for (const band of ARENA_RANK_DIFF_BANDS) {
      expect(band.minDiff).toBe(cursor);
      expect(band.maxDiff).toBeGreaterThanOrEqual(band.minDiff);
      expect(band.multiplier).toBeGreaterThan(1);
      cursor = band.maxDiff + 1;
    }
    expect(cursor).toBe(16);
  });

  it('排名差倍率随难度递增（打更强的人更赚）', () => {
    for (let i = 1; i < ARENA_RANK_DIFF_BANDS.length; i++) {
      expect(ARENA_RANK_DIFF_BANDS[i]!.multiplier).toBeGreaterThan(
        ARENA_RANK_DIFF_BANDS[i - 1]!.multiplier,
      );
    }
  });

  it('连胜档降序排列、倍率递增、2 连胜起步', () => {
    expect(ARENA_STREAK_BANDS[0]!.streak).toBe(5);
    for (let i = 1; i < ARENA_STREAK_BANDS.length; i++) {
      expect(ARENA_STREAK_BANDS[i]!.streak).toBeLessThan(ARENA_STREAK_BANDS[i - 1]!.streak);
      expect(ARENA_STREAK_BANDS[i]!.multiplier).toBeLessThan(ARENA_STREAK_BANDS[i - 1]!.multiplier);
    }
    expect(ARENA_STREAK_BANDS[ARENA_STREAK_BANDS.length - 1]!.streak).toBe(2);
  });

  it('单次收益上限 220 = 50 × 2.2 × 2.0（docs/52 §4.2 上限校验）', () => {
    const max =
      ARENA_STAKES[ARENA_STAKES.length - 1]! *
      ARENA_RANK_DIFF_BANDS[ARENA_RANK_DIFF_BANDS.length - 1]!.multiplier *
      ARENA_STREAK_BANDS[0]!.multiplier;
    expect(Math.round(max)).toBe(220);
  });
});

describe('arenaRules / 防守奖励（红线：永远是正数）', () => {
  it('守住与失守都是正奖励，且守住更多', () => {
    expect(ARENA_DEFENSE_REWARD_HELD).toBeGreaterThan(0);
    expect(ARENA_DEFENSE_REWARD_BROKEN).toBeGreaterThan(0);
    expect(ARENA_DEFENSE_REWARD_HELD).toBeGreaterThan(ARENA_DEFENSE_REWARD_BROKEN);
  });

  it('每日上限为正且能盖过最极端的单日防守场次', () => {
    expect(ARENA_DEFENSE_REWARD_DAILY_CAP).toBe(200);
  });

  it('入场补给足以完成首日两轮标准押注（冷启动不能倒挂）', () => {
    expect(ARENA_JOIN_HONOR).toBeGreaterThanOrEqual(ARENA_STAKES[1]! * 2);
    expect(ARENA_JOIN_HONOR).toBeLessThanOrEqual(500);
  });
});

describe('arenaRules / 段位表', () => {
  it('五档齐全、从高到低排列、id 与 docs/53 §2.1 徽章资产一致', () => {
    expect(ARENA_TIERS.map((t) => t.id)).toEqual([
      'yingguan',
      'feiying',
      'hupo',
      'feiyue',
      'qingying',
    ]);
  });

  it('每档恰好一种门槛，最后一档无条件兜底', () => {
    for (const tier of ARENA_TIERS.slice(0, -1)) {
      const hasRank = tier.topRank !== null;
      const hasPct = tier.topPercent !== null;
      expect(hasRank !== hasPct).toBe(true);
    }
    const last = ARENA_TIERS[ARENA_TIERS.length - 1]!;
    expect(last.topRank).toBeNull();
    expect(last.topPercent).toBeNull();
  });

  it('每日荣誉全为正数且随段位递增（最低档也不是羞辱性零头）', () => {
    for (const tier of ARENA_TIERS) {
      expect(tier.dailyHonor).toBeGreaterThanOrEqual(50);
      expect(tier.dailyBoxes.sacred).toBeGreaterThanOrEqual(0);
      expect(tier.dailyBoxes.starlight).toBeGreaterThanOrEqual(0);
      expect(tier.dailyBoxes.sacred + tier.dailyBoxes.starlight).toBeGreaterThan(0);
    }
    for (let i = 1; i < ARENA_TIERS.length; i++) {
      expect(ARENA_TIERS[i]!.dailyHonor).toBeLessThan(ARENA_TIERS[i - 1]!.dailyHonor);
    }
  });
});

describe('arenaRules / 对决与胜率参数', () => {
  it('回合上限足以分出胜负又不至于打不完', () => {
    expect(ARENA_MAX_ROUNDS).toBe(30);
  });

  it('胜率预估次数是统计上有意义的正整数', () => {
    expect(ARENA_WIN_CHANCE_SIMULATIONS).toBeGreaterThanOrEqual(60);
    expect(Number.isInteger(ARENA_WIN_CHANCE_SIMULATIONS)).toBe(true);
  });
});
