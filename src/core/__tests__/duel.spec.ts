/**
 * 竞技场对决核心的单元测试。
 *
 * 这里锁住的最重要的性质与试炼相同 —— 「确定性」：
 * 服务端用同一份代码、同一个种子复算出的胜负与战报必须逐点一致，
 * 伪造战斗结果在结构上不可能（docs/52 §5.3）。
 */

import { describe, expect, it } from 'vitest';
import { CLASS_IDS, type Stats } from '../types';
import {
  arenaCandidateRanks,
  arenaCandidateSeed,
  arenaDayKey,
  arenaRankDiffMultiplier,
  arenaStreakMultiplier,
  arenaTierFor,
  arenaVictoryHonor,
  duelSeed,
  estimateDuelWinChance,
  buildArenaDuelSide,
  simulateDuel,
  type DuelSide,
} from '../duel';
import { fnv1a32 } from '../trial';
import {
  ARENA_DAILY_CHALLENGES,
  ARENA_MAX_ROUNDS,
  ARENA_OPPONENT_CANDIDATES,
  ARENA_OPPONENT_MAX_ABOVE,
  ARENA_RESET_HOUR_CST,
  ARENA_STAKES,
} from '@/data/arenaRules';
import { Rng } from '../rng';
import {
  applyClassMods,
  averageSkillMultiplier,
  baseStatsFor,
  makePlayer,
} from '../progression';
import { businessDayKey } from '../dayKey';
import type { OnHitElementalDamageTrigger } from '../equipmentSets';

/** 造一个裸装对决侧（不穿装备，纯职业基础属性）。 */
function nakedSide(
  cls: (typeof CLASS_IDS)[number],
  level: number,
  tweak?: (s: Stats) => Stats,
): DuelSide {
  const base = baseStatsFor(cls, level);
  const stats = applyClassMods(cls, tweak ? tweak(base) : base);
  return {
    combatant: makePlayer(`${cls}·Lv${level}`, level, stats),
    skillMultiplier: averageSkillMultiplier(level),
  };
}

const SEED = 0xabcdef;

describe('simulateDuel / 确定性', () => {
  it('竞技场构建完整转发试炼同源的逐击、致命伤与暴击触发数组', () => {
    const side = buildArenaDuelSide(
      {
        name: '测试',
        classId: 'swordsman',
        level: 60,
        equipped: new Array(8).fill(null),
      },
      'attacker',
    );
    expect(side.onHitTriggers).toEqual([]);
    expect(side.onLethalTriggers).toEqual([]);
    expect(side.onCritTriggers).toEqual([]);
  });

  it('同双方同种子，结果逐点一致（含战报日志）', () => {
    const a = nakedSide('swordsman', 60);
    const b = nakedSide('witch', 60);
    const r1 = simulateDuel(a, b, new Rng(SEED));
    const r2 = simulateDuel(a, b, new Rng(SEED));
    expect(r2).toEqual(r1);
    expect(r1.log.length).toBeGreaterThan(0);
  });

  it('不会修改入参（客户端快照要原样提交服务端）', () => {
    const a = nakedSide('swordsman', 60);
    const b = nakedSide('witch', 60);
    const hpBefore = a.combatant.currentHp;
    const bHpBefore = b.combatant.currentHp;
    simulateDuel(a, b, new Rng(SEED));
    expect(a.combatant.currentHp).toBe(hpBefore);
    expect(b.combatant.currentHp).toBe(bHpBefore);
  });
});

describe('simulateDuel / 胜负规则', () => {
  it('碾压局：挑战者击空对方 → attacker knockout 胜', () => {
    const a = nakedSide('swordsman', 60, (s) => ({ ...s, atk: s.atk * 80 }));
    const b = nakedSide('witch', 60);
    const r = simulateDuel(a, b, new Rng(SEED));
    expect(r.winner).toBe('attacker');
    expect(r.reason).toBe('knockout');
    expect(r.defenderHpRemainPct).toBe(0);
    expect(r.attackerHpRemainPct).toBeGreaterThan(0);
  });

  it('防守碾压局：defender 胜', () => {
    const a = nakedSide('swordsman', 60);
    const b = nakedSide('witch', 60, (s) => ({ ...s, atk: s.atk * 80 }));
    const r = simulateDuel(a, b, new Rng(SEED));
    expect(r.winner).toBe('defender');
    expect(r.reason).toBe('knockout');
  });

  it('双方打不动 + 属性完全一致 → 平局判防守方胜（hp-percent）', () => {
    const a = nakedSide('swordsman', 60, (s) => ({ ...s, atk: 0 }));
    const b = nakedSide('swordsman', 60, (s) => ({ ...s, atk: 0 }));
    const r = simulateDuel(a, b, new Rng(SEED));
    expect(r.winner).toBe('defender');
    expect(r.reason).toBe('hp-percent');
    expect(r.attackerHpRemainPct).toBe(1);
    expect(r.defenderHpRemainPct).toBe(1);
  });

  it('回合上限内挑战者血量百分比更高 → attacker hp-percent 胜', () => {
    // 挑战者攻击为正但远不足以击杀，防守方攻击为 0
    const a = nakedSide('swordsman', 60);
    const b = nakedSide('swordsman', 60, (s) => ({ ...s, atk: 0, hp: s.hp * 200 }));
    const r = simulateDuel(a, b, new Rng(SEED));
    expect(r.reason).toBe('hp-percent');
    expect(r.winner).toBe('attacker');
    expect(r.attackerHpRemainPct).toBe(1);
    expect(r.defenderHpRemainPct).toBeLessThan(1);
  });

  it('攻速更高的一方行动次数更多（与主线同一套 spd 规则）', () => {
    const a = nakedSide('catkin', 60, (s) => ({ ...s, spd: s.spd * 2, atk: 0 }));
    const b = nakedSide('catkin', 60, (s) => ({ ...s, atk: 0 }));
    const r = simulateDuel(a, b, new Rng(SEED));
    expect(r.attackerActions).toBeGreaterThan(r.defenderActions);
  });
});

describe('simulateDuel / 回合上限', () => {
  it('打不动的对决在 30 轮时间窗内终止，时长与行动数都有界', () => {
    const a = nakedSide('swordsman', 60, (s) => ({ ...s, atk: 0 }));
    const b = nakedSide('swordsman', 60, (s) => ({ ...s, atk: 0 }));
    const slowSpd = Math.min(a.combatant.stats.spd, b.combatant.stats.spd);
    const windowSec = ARENA_MAX_ROUNDS / slowSpd;
    const r = simulateDuel(a, b, new Rng(SEED));
    expect(r.durationSec).toBeLessThanOrEqual(windowSec + 0.11);
    expect(r.attackerActions).toBeLessThanOrEqual(ARENA_MAX_ROUNDS + 2);
    expect(r.defenderActions).toBeLessThanOrEqual(ARENA_MAX_ROUNDS + 2);
    expect(r.attackerActions).toBeGreaterThanOrEqual(ARENA_MAX_ROUNDS - 2);
  });

  it('非法输入直接抛错', () => {
    const a = nakedSide('swordsman', 60);
    const broken: DuelSide = {
      combatant: makePlayer('broken', 60, { ...baseStatsFor('witch', 60), hp: 0 }),
      skillMultiplier: 1,
    };
    expect(() => simulateDuel(a, broken, new Rng(SEED))).toThrow(/生命/);
    expect(() => simulateDuel({ ...a, skillMultiplier: 0 }, nakedSide('witch', 60), new Rng(SEED))).toThrow(
      /技能倍率/,
    );
  });
});

describe('simulateDuel / 战报日志', () => {
  it('日志只含 attacker/defender，序列单调递增', () => {
    const a = nakedSide('swordsman', 60);
    const b = nakedSide('witch', 60);
    const r = simulateDuel(a, b, new Rng(SEED));
    let last = 0;
    for (const ev of r.log) {
      expect(['attacker', 'defender']).toContain(ev.source);
      expect(['attacker', 'defender']).toContain(ev.target);
      expect(ev.sequence).toBeGreaterThan(last);
      last = ev.sequence;
    }
    const directCount = r.log.filter((ev) => ev.kind === 'direct-damage').length;
    expect(directCount).toBe(r.attackerActions + r.defenderActions);
  });

  it('on-hit 追加段进入日志并标注触发方与 triggerId', () => {
    const trigger: OnHitElementalDamageTrigger = {
      id: 'test-blaze',
      kind: 'elemental-damage',
      chance: 1,
      atkMultiplier: 0.5,
      element: 'fire',
    };
    const a: DuelSide = { ...nakedSide('swordsman', 60), onHitTriggers: [trigger] };
    const b = nakedSide('witch', 60);
    const r = simulateDuel(a, b, new Rng(SEED));
    const extra = r.log.filter((ev) => ev.kind === 'on-hit-elemental-damage');
    expect(extra.length).toBeGreaterThan(0);
    for (const ev of extra) {
      expect(ev.source).toBe('attacker');
      expect(ev.target).toBe('defender');
      expect(ev.triggerId).toBe('test-blaze');
    }
  });
});

describe('duelSeed / arenaDayKey', () => {
  it('种子公式与 docs/52 §5.3 一致，任一字段变化都改变种子', () => {
    const base = duelSeed('u1', 'u2', '2026-07-29', 1);
    expect(base).toBe(fnv1a32('u1|u2|2026-07-29|1'));
    expect(duelSeed('u1', 'u2', '2026-07-29', 2)).not.toBe(base);
    expect(duelSeed('u2', 'u1', '2026-07-29', 1)).not.toBe(base);
    expect(duelSeed('u1', 'u2', '2026-07-30', 1)).not.toBe(base);
    // 跨端确定：同输入重复计算逐位一致
    expect(duelSeed('u1', 'u2', '2026-07-29', 1)).toBe(base);
  });

  it('北京时间 04:00 日切：03:59 仍算昨天，04:00 进入今天', () => {
    // 2026-07-29 04:00:00 +08 = 2026-07-28 20:00:00 UTC
    const before = Date.UTC(2026, 6, 28, 19, 59, 59);
    const at = Date.UTC(2026, 6, 28, 20, 0, 0);
    expect(arenaDayKey(before)).toBe('2026-07-28');
    expect(arenaDayKey(at)).toBe('2026-07-29');
    // 与全局 businessDayKey 同一口径，不另起时区逻辑
    expect(arenaDayKey(at)).toBe(businessDayKey(at, ARENA_RESET_HOUR_CST));
  });
});

describe('estimateDuelWinChance / 胜率预估', () => {
  it('确定性：同两个 Build 两次预估逐点一致', () => {
    const a = nakedSide('swordsman', 60);
    const b = nakedSide('witch', 60);
    expect(estimateDuelWinChance(a, b)).toBe(estimateDuelWinChance(a, b));
  });

  it('镜像局胜率接近 50%', () => {
    const a = nakedSide('swordsman', 60);
    const b = nakedSide('swordsman', 60);
    const p = estimateDuelWinChance(a, b);
    expect(p).toBeGreaterThan(0.35);
    expect(p).toBeLessThan(0.65);
  });

  it('碾压局胜率接近 100%', () => {
    const a = nakedSide('swordsman', 60, (s) => ({ ...s, atk: s.atk * 80 }));
    const b = nakedSide('witch', 60);
    expect(estimateDuelWinChance(a, b, 40)).toBeGreaterThan(0.95);
  });

  it('非法模拟次数抛错', () => {
    const a = nakedSide('swordsman', 60);
    expect(() => estimateDuelWinChance(a, a, 0)).toThrow(/正整数/);
  });
});

describe('押注与荣誉结算', () => {
  it('排名差倍率分档正确', () => {
    expect(arenaRankDiffMultiplier(1)).toBe(1.2);
    expect(arenaRankDiffMultiplier(3)).toBe(1.2);
    expect(arenaRankDiffMultiplier(4)).toBe(1.6);
    expect(arenaRankDiffMultiplier(8)).toBe(1.6);
    expect(arenaRankDiffMultiplier(9)).toBe(2.2);
    expect(arenaRankDiffMultiplier(15)).toBe(2.2);
    expect(arenaRankDiffMultiplier(16)).toBe(1);
    expect(arenaRankDiffMultiplier(0)).toBe(1);
  });

  it('连胜倍率取满足条件的最高档', () => {
    expect(arenaStreakMultiplier(1)).toBe(1);
    expect(arenaStreakMultiplier(2)).toBe(1.2);
    expect(arenaStreakMultiplier(3)).toBe(1.5);
    expect(arenaStreakMultiplier(4)).toBe(1.5);
    expect(arenaStreakMultiplier(5)).toBe(2);
    expect(arenaStreakMultiplier(9)).toBe(2);
  });

  it('胜利荣誉 = 押注 × 排名差倍率 × 连胜倍率，上限 220', () => {
    expect(arenaVictoryHonor(50, 15, 5)).toBe(220);
    expect(arenaVictoryHonor(25, 5, 1)).toBe(40);
    expect(arenaVictoryHonor(10, 2, 2)).toBe(14);
    expect(arenaVictoryHonor(ARENA_STAKES[2], 9, 6)).toBe(220);
  });

  it('非法押注抛错', () => {
    expect(() => arenaVictoryHonor(0, 3, 1)).toThrow(/押注/);
    expect(() => arenaVictoryHonor(-10, 3, 1)).toThrow(/押注/);
  });
});

describe('arenaTierFor / 段位判定', () => {
  it('精确名次门槛优先', () => {
    expect(arenaTierFor(1, 1000).id).toBe('yingguan');
    expect(arenaTierFor(10, 1000).id).toBe('yingguan');
    expect(arenaTierFor(11, 1000).id).toBe('feiying');
    expect(arenaTierFor(100, 1000).id).toBe('feiying');
  });

  it('百分比门槛', () => {
    expect(arenaTierFor(101, 1000).id).toBe('hupo');
    expect(arenaTierFor(300, 1000).id).toBe('hupo');
    expect(arenaTierFor(301, 1000).id).toBe('feiyue');
    expect(arenaTierFor(600, 1000).id).toBe('feiyue');
    expect(arenaTierFor(601, 1000).id).toBe('qingying');
  });

  it('最低档永远兜底（参与就有奖励）', () => {
    expect(arenaTierFor(99999, 100000).id).toBe('qingying');
    expect(arenaTierFor(5, 5).id).toBe('yingguan');
  });

  it('非法排名抛错', () => {
    expect(() => arenaTierFor(0, 100)).toThrow(/排名/);
    expect(() => arenaTierFor(-3, 100)).toThrow(/排名/);
  });
});

describe('与试炼配置的口径一致性', () => {
  it('日切小时与每日次数是有意配置的常量', () => {
    expect(ARENA_RESET_HOUR_CST).toBe(4);
    expect(ARENA_DAILY_CHALLENGES).toBe(5);
  });
});

describe('arenaCandidateRanks / 候选对手窗口', () => {
  it('确定性：同名次同种子同一批候选', () => {
    expect(arenaCandidateRanks(50, 12345)).toEqual(arenaCandidateRanks(50, 12345));
    expect(arenaCandidateRanks(50, 12345)).not.toEqual(arenaCandidateRanks(50, 54321));
  });

  it('候选全部落在自己上方 1~15 名内且不重复', () => {
    const ranks = arenaCandidateRanks(50, 12345, ARENA_OPPONENT_MAX_ABOVE);
    expect(ranks.length).toBe(15);
    expect(new Set(ranks).size).toBe(15);
    for (const r of ranks) {
      expect(r).toBeGreaterThanOrEqual(35);
      expect(r).toBeLessThanOrEqual(49);
    }
  });

  it('窗口不足时返回全部可用名次', () => {
    expect(arenaCandidateRanks(4, 12345, 15).sort((a, b) => a - b)).toEqual([1, 2, 3]);
    expect(arenaCandidateRanks(2, 12345, 15)).toEqual([1]);
  });

  it('第 1 名没有候选（只能挑战上方的人）', () => {
    expect(arenaCandidateRanks(1, 12345)).toEqual([]);
  });

  it('默认取 3 个候选的调用方语义可用', () => {
    const ranks = arenaCandidateRanks(100, 777, ARENA_OPPONENT_CANDIDATES);
    expect(ranks.length).toBe(3);
    expect(new Set(ranks).size).toBe(3);
  });

  it('非法名次与数量抛错', () => {
    expect(() => arenaCandidateRanks(0, 1)).toThrow(/排名/);
    expect(() => arenaCandidateRanks(10, 1, 0)).toThrow(/候选数量/);
  });

  it('候选种子同人同天一致，跨天不同', () => {
    expect(arenaCandidateSeed('u1', '2026-07-29')).toBe(arenaCandidateSeed('u1', '2026-07-29'));
    expect(arenaCandidateSeed('u1', '2026-07-29')).not.toBe(arenaCandidateSeed('u1', '2026-07-30'));
    expect(arenaCandidateSeed('u1', '2026-07-29')).not.toBe(arenaCandidateSeed('u2', '2026-07-29'));
  });
});
