import { describe, it, expect } from 'vitest';
import {
  canSustain,
  combatEfficiency,
  combatPressure,
  estimateDps,
  estimateIncomingDps,
  estimateLifestealPerSecond,
  simulateFight,
  timeToKill,
} from '../combat';
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

  it('吸血只按目标剩余生命内的实际伤害回复，不把过量伤害算进去', () => {
    const player = makePlayer(
      'p',
      20,
      s({ atk: 50_000, hp: 1_000, acc: 99_999, critRate: 0 }),
      'none',
      {
        damageReduction: 0,
        lifesteal: 100,
        elementDamage: { fire: 0, ice: 0, thunder: 0 },
      },
    );
    player.currentHp = 100;
    const target = makePlayer('m', 20, s({ hp: 100, def: 0, eva: 0, atk: 0 }));

    const result = simulateFight(player, target, new Rng(91));
    expect(result.win).toBe(true);
    expect(result.damageDealt).toBe(100);
    expect(player.currentHp).toBe(200);
    expect(target.currentHp).toBe(0);
  });

  it('吸血回复不能超过当前最大生命', () => {
    const player = makePlayer(
      'p',
      20,
      s({ atk: 50_000, hp: 1_000, acc: 99_999, critRate: 0 }),
      'none',
      {
        damageReduction: 0,
        lifesteal: 100,
        elementDamage: { fire: 0, ice: 0, thunder: 0 },
      },
    );
    player.currentHp = 950;
    const target = makePlayer('m', 20, s({ hp: 100, def: 0, eva: 0, atk: 0 }));

    simulateFight(player, target, new Rng(92));
    expect(player.currentHp).toBe(1_000);
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

  it('期望吸血会抵消期望承伤，从不可持续变为可持续', () => {
    const monster = makePlayer(
      'm',
      1,
      s({ atk: 50, hp: 1_000, def: 0, acc: 99_999, eva: 0, critRate: 0 }),
    );
    const plain = makePlayer(
      'p',
      1,
      s({ atk: 100, hp: 100, def: 0, acc: 99_999, eva: 0, critRate: 0 }),
    );
    const draining = makePlayer(
      'p',
      1,
      s({ atk: 100, hp: 100, def: 0, acc: 99_999, eva: 0, critRate: 0 }),
      'none',
      {
        damageReduction: 0,
        lifesteal: 50,
        elementDamage: { fire: 0, ice: 0, thunder: 0 },
      },
    );

    expect(canSustain(plain, monster)).toBe(false);
    expect(estimateLifestealPerSecond(draining, monster)).toBeCloseTo(
      estimateDps(draining, monster) * 0.5,
      8,
    );
    expect(canSustain(draining, monster)).toBe(true);
  });
});

describe('combatPressure / combatEfficiency', () => {
  it('承伤 25% 以内效率保持 100%，超过后严格按 1/(1+超额) 衰减', () => {
    const player = makePlayer('p', 20, s({ atk: 2_000, hp: 2_000, def: 100 }));
    const monster = mon(20);
    const pressure = combatPressure(player, monster);

    const expected =
      pressure.damageRatio <= 0.25 ? 1 : 1 / (1 + pressure.damageRatio - 0.25);
    expect(pressure.efficiency).toBeCloseTo(expected, 10);
    expect(combatEfficiency(player, monster)).toBeCloseTo(expected, 10);
  });

  it('同等输出下，生命、防御、减伤和吸血都会真实提高挂机效率', () => {
    const monster = makePlayer(
      'm',
      20,
      s({ atk: 1_000, hp: 12_000, def: 100, acc: 99_999, eva: 0, critRate: 0 }),
    );
    const baseStats = s({
      atk: 1_200,
      hp: 1_000,
      def: 0,
      acc: 99_999,
      eva: 0,
      critRate: 0,
    });
    const plain = makePlayer('plain', 20, baseStats);
    const healthy = makePlayer('healthy', 20, { ...baseStats, hp: 2_000 });
    const armored = makePlayer('armored', 20, { ...baseStats, def: 1_000 });
    const reduced = makePlayer('reduced', 20, baseStats, 'none', {
      damageReduction: 30,
      lifesteal: 0,
      elementDamage: { fire: 0, ice: 0, thunder: 0 },
    });
    const draining = makePlayer('draining', 20, baseStats, 'none', {
      damageReduction: 0,
      lifesteal: 20,
      elementDamage: { fire: 0, ice: 0, thunder: 0 },
    });
    const baseline = combatEfficiency(plain, monster);

    expect(combatEfficiency(healthy, monster)).toBeGreaterThan(baseline);
    expect(combatEfficiency(armored, monster)).toBeGreaterThan(baseline);
    expect(combatEfficiency(reduced, monster)).toBeGreaterThan(baseline);
    expect(combatEfficiency(draining, monster)).toBeGreaterThan(baseline);
  });

  it('极端越级时效率明显下降但仍大于 0，不制造死亡或产出归零硬墙', () => {
    const fragile = makePlayer('p', 1, s({ atk: 50, hp: 10, def: 0 }));
    const efficiency = combatEfficiency(fragile, mon(120));

    expect(efficiency).toBeGreaterThan(0);
    expect(efficiency).toBeLessThan(0.3);
  });
});

describe('estimateIncomingDps', () => {
  it('怪物等级越高对玩家威胁越大', () => {
    const p = makePlayer('p', 30, s());
    expect(estimateIncomingDps(p, mon(60))).toBeGreaterThan(estimateIncomingDps(p, mon(20)));
  });
});
