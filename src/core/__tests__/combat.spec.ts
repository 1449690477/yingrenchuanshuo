import { describe, it, expect } from 'vitest';
import { canSustain, estimateDps, estimateIncomingDps, simulateFight, timeToKill } from '../combat';
import { makeMonster, makePlayer } from '../progression';
import { Rng } from '../rng';
import type { Combatant, Stats } from '../types';

const s = (o: Partial<Stats> = {}): Stats => ({
  atk: 500,
  def: 200,
  hp: 4000,
  acc: 150,
  eva: 20,
  critRate: 10,
  critDmg: 50,
  spd: 1,
  ...o,
});

const mon = (level = 20) =>
  makeMonster({
    id: 'm',
    name: '怪',
    level,
    type: 'normal',
    element: 'none',
    lootTableId: 'l',
    sprite: '',
  });

describe('simulateFight', () => {
  it('碾压时玩家获胜', () => {
    const p = makePlayer('p', 20, s({ atk: 50000, hp: 999999 }));
    const r = simulateFight(p, mon(20), new Rng(1));
    expect(r.win).toBe(true);
    expect(r.kills).toBe(1);
    expect(r.damageDealt).toBeGreaterThan(0);
  });

  it('实力悬殊时玩家落败', () => {
    const p = makePlayer('p', 5, s({ atk: 1, hp: 10, def: 0 }));
    const r = simulateFight(p, mon(80), new Rng(2));
    expect(r.win).toBe(false);
  });

  it('同种子结果完全一致（可复现）', () => {
    const run = () => {
      const p = makePlayer('p', 20, s());
      return simulateFight(p, mon(20), new Rng(31337));
    };
    expect(run()).toEqual(run());
  });

  it('双方都打不动时在时间上限处终止，不死循环', () => {
    const p = makePlayer('p', 10, s({ atk: 0, hp: 1e9, spd: 1 }));
    const m: Combatant = makePlayer('m', 10, s({ atk: 0, hp: 1e9 }));
    const r = simulateFight(p, m, new Rng(3), { maxSeconds: 5 });
    expect(r.win).toBe(false);
    expect(r.duration).toBeLessThanOrEqual(5.05);
  });

  it('攻速更高则同等时间内输出更多', () => {
    const slow = makePlayer('p', 20, s({ spd: 0.5, atk: 300 }));
    const fast = makePlayer('p', 20, s({ spd: 2.0, atk: 300 }));
    const rSlow = simulateFight(slow, mon(40), new Rng(9), { maxSeconds: 10 });
    const rFast = simulateFight(fast, mon(40), new Rng(9), { maxSeconds: 10 });
    expect(rFast.damageDealt).toBeGreaterThan(rSlow.damageDealt);
  });
});

describe('estimateDps / timeToKill', () => {
  it('DPS 为 0 时击杀时间为无穷', () => {
    const p = makePlayer('p', 10, s({ atk: 0 }));
    expect(estimateDps(p, mon(10))).toBe(0);
    expect(timeToKill(p, mon(10))).toBe(Infinity);
  });

  it('击杀时间 = 血量 / DPS', () => {
    const p = makePlayer('p', 20, s());
    const m = mon(20);
    expect(timeToKill(p, m)).toBeCloseTo(m.stats.hp / estimateDps(p, m), 6);
  });

  it('技能倍率提高则击杀更快', () => {
    const p = makePlayer('p', 20, s());
    expect(timeToKill(p, mon(20), 2.0)).toBeLessThan(timeToKill(p, mon(20), 1.0));
  });

  it('模拟战斗耗时与期望击杀时间量级一致', () => {
    // 玩家必须能撑到打完，否则测的就是「玩家被打死用了多久」而不是击杀时间。
    // Lv30 怪攻击约 2465，4000 血两下就没了 —— 这里给足生存属性。
    const build = () => makePlayer('p', 30, s({ atk: 3000, hp: 500000, def: 5000 }));
    const expected = timeToKill(build(), mon(30));
    const result = simulateFight(build(), mon(30), new Rng(555));

    expect(result.win).toBe(true);
    expect(result.duration).toBeGreaterThan(expected * 0.6);
    expect(result.duration).toBeLessThan(expected * 1.6);
  });
});

describe('canSustain', () => {
  it('高血高攻可持续挂机', () => {
    const p = makePlayer('p', 40, s({ atk: 20000, hp: 100000, def: 3000 }));
    expect(canSustain(p, mon(20))).toBe(true);
  });

  it('脆皮打高级怪挂不住', () => {
    const p = makePlayer('p', 10, s({ atk: 50, hp: 100, def: 0 }));
    expect(canSustain(p, mon(90))).toBe(false);
  });

  it('打不动的怪一定挂不住', () => {
    const p = makePlayer('p', 10, s({ atk: 0 }));
    expect(canSustain(p, mon(10))).toBe(false);
  });
});

describe('estimateIncomingDps', () => {
  it('怪物等级越高对玩家威胁越大', () => {
    const p = makePlayer('p', 30, s());
    expect(estimateIncomingDps(p, mon(60))).toBeGreaterThan(estimateIncomingDps(p, mon(20)));
  });
});
