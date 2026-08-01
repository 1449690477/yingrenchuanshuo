import { describe, it, expect } from 'vitest';
import {
  canSustain,
  combatEfficiency,
  combatPressure,
  expectedDamageSegment,
  estimateDps,
  estimateIncomingDps,
  estimateLifestealPerSecond,
  resolveDamageSegment,
  simulateFight,
  timeToKill,
} from '../combat';
import { makeMonster, makePlayer } from '../progression';
import { Rng } from '../rng';
import { calcPeriodicDamage, expectedConfirmedElementalDamage } from '../formula';
import { createSkillCombatKit } from '../skillCombat';
import type { OnCritPeriodicDamageTrigger } from '../equipmentSets';
import type { Combatant, Skill, Stats } from '../types';
import { REGION_CRIMSON_SET } from '@/data/regionEquipmentSets';

const FLAMEBURST = REGION_CRIMSON_SET.bonuses.flatMap((bonus) => bonus.onHitTriggers ?? [])[0]!;
const BLOODMOON: OnCritPeriodicDamageTrigger = {
  id: 'test-bloodmoon',
  kind: 'crit-periodic-damage',
  healMaxHpRatio: 0.03,
  statusId: 'bleed',
  atkMultiplierPerTick: 0.08,
  ticks: 4,
  durationSec: 4,
  maxStacks: 1,
  refresh: 'duration',
};

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
  it('真实技能栏与旧平均倍率双传时立即暴露调用错误', () => {
    const player = makePlayer('p', 20, s());
    const target = makePlayer('m', 20, s());
    const invalid = {
      playerSkillMultiplier: 7,
      playerSkillKit: createSkillCombatKit([], 20),
    } as unknown as import('../combat').FightOptions;

    expect(() => simulateFight(player, target, new Rng(0x51a11), invalid)).toThrow(
      '玩家真实技能栏与旧平均倍率不能同时传入',
    );
  });

  it('套装技能伤害 0.18 按比例放大真实技能段约 1.18 倍', () => {
    const skill: Skill = {
      id: 'set-ratio-contract',
      name: '套装比例合同',
      class: 'kenshi',
      type: 'active',
      element: 'none',
      unlockLevel: 1,
      cooldownSec: 60,
      priority: 1,
      effects: [
        {
          kind: 'damage',
          target: { kind: 'primary-enemy' },
          multiplier: { base: 2 },
        },
      ],
      icon: '',
      desc: '',
    };
    const run = (skillDamageBonusRatio: number) =>
      simulateFight(
        makePlayer('p', 20, s({ atk: 1_000, acc: 99_999, critRate: 0, spd: 0.01 })),
        makePlayer('m', 20, s({ atk: 0, hp: 1_000_000, def: 0, eva: 0, spd: 0.01 })),
        new Rng(0x18),
        {
          maxSeconds: 0.1,
          playerSkillKit: createSkillCombatKit([skill], 20, { skillDamageBonusRatio }),
        },
      ).events.find(
        (event) =>
          event.source === 'player' &&
          event.event.kind === 'direct-damage' &&
          event.event.skillId === skill.id,
      );

    const baseline = run(0);
    const boosted = run(0.18);
    expect(baseline?.event.kind).toBe('direct-damage');
    expect(boosted?.event.kind).toBe('direct-damage');
    if (baseline?.event.kind !== 'direct-damage' || boosted?.event.kind !== 'direct-damage') {
      throw new Error('测试缺少真实技能伤害事件');
    }
    expect(boosted.event.damage).toBeCloseTo(baseline.event.damage * 1.18, 8);
  });

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

  it('炎爆事件使用实际伤害，且追加段不产生吸血或递归触发', () => {
    const player = makePlayer(
      'p',
      20,
      s({ atk: 1_000, hp: 100_000, acc: 99_999, critRate: 0, spd: 1 }),
      'fire',
      {
        damageReduction: 0,
        lifesteal: 100,
        elementDamage: { fire: 12, ice: 0, thunder: 0 },
      },
    );
    player.currentHp = 100;
    const target = makePlayer(
      'm',
      20,
      s({ atk: 0, hp: 100_000, def: 0, eva: 0, critRate: 0, spd: 0.01 }),
      'ice',
    );
    const guaranteed = { ...FLAMEBURST, chance: 1 };

    const result = simulateFight(player, target, new Rng(902), {
      maxSeconds: 0.1,
      playerOnHitTriggers: [guaranteed],
    });
    const playerEvents = result.events.filter((event) => event.source === 'player');
    const direct = playerEvents.find((event) => event.event.kind === 'direct-damage');
    const burst = playerEvents.find((event) => event.event.kind === 'on-hit-elemental-damage');

    expect(direct?.event.damage).toBeGreaterThan(0);
    expect(burst?.event).toMatchObject({
      kind: 'on-hit-elemental-damage',
      triggerId: FLAMEBURST.id,
      element: 'fire',
    });
    expect(playerEvents).toHaveLength(2);
    // 100% 吸血只回复直接段；炎爆即使造成真实伤害也不再吸一次。
    expect(player.currentHp).toBeCloseTo(100 + direct!.event.damage, 8);
    expect(result.damageDealt).toBeCloseTo(
      playerEvents.reduce((sum, event) => sum + event.event.damage, 0),
      8,
    );
  });

  it('暴击回血后按固定时钟结算四次流血，流血不暴击、不吸血、不递归触发', () => {
    const player = makePlayer(
      'p',
      20,
      s({
        atk: 100,
        hp: 1_000,
        acc: 99_999,
        critRate: 100,
        critDmg: 50,
        spd: 0.01,
      }),
      'none',
      {
        damageReduction: 0,
        lifesteal: 100,
        elementDamage: { fire: 0, ice: 0, thunder: 0 },
      },
    );
    player.currentHp = 100;
    const target = makePlayer(
      'm',
      20,
      s({ atk: 0, hp: 10_000, def: 0, eva: 0, critRate: 0, spd: 0.01 }),
    );

    const result = simulateFight(player, target, new Rng(907), {
      maxSeconds: 4.1,
      playerOnCritTriggers: [BLOODMOON],
    });
    const direct = result.events.find(
      (event) => event.source === 'player' && event.event.kind === 'direct-damage',
    );
    const recoveries = result.events.filter(
      (event) => event.event.kind === 'on-crit-recovery',
    );
    const bleeding = result.events.filter(
      (event) => event.event.kind === 'periodic-damage',
    );

    expect(direct?.event.kind).toBe('direct-damage');
    expect(recoveries).toHaveLength(1);
    expect(recoveries[0]?.event).toMatchObject({
      kind: 'on-crit-recovery',
      healing: 30,
      triggerId: BLOODMOON.id,
    });
    expect(bleeding).toHaveLength(4);
    expect(
      bleeding.every(
        ({ event }) =>
          event.kind === 'periodic-damage' &&
          event.statusId === 'bleed' &&
          event.damage === 8 &&
          event.hit &&
          !event.crit,
      ),
    ).toBe(true);
    if (!direct || direct.event.kind !== 'direct-damage') {
      throw new Error('测试缺少玩家直接伤害事件');
    }
    // 100% 吸血只作用于开场直接段；4 次流血不会再回复 32 点生命。
    expect(player.currentHp).toBeCloseTo(100 + direct.event.damage + 30, 8);
    expect(result.damageDealt).toBeCloseTo(direct.event.damage + 32, 8);
  });

  it('装备暴击持续伤害快照同一时刻的攻防动态修正', () => {
    const attacker = makePlayer(
      'p',
      20,
      s({ atk: 1_000, hp: 100_000, acc: 99_999, critRate: 100, spd: 0.01 }),
    );
    const defender = makePlayer(
      'm',
      20,
      s({ atk: 0, hp: 100_000, def: 1_000, eva: 0, critRate: 0, spd: 0.01 }),
    );
    const offense: Skill = {
      id: 'periodic-offense',
      name: '持续伤害强化',
      class: 'kenshi',
      type: 'passive',
      element: 'none',
      unlockLevel: 1,
      effects: [
        {
          kind: 'modifier',
          target: { kind: 'self' },
          modifier: { unit: 'ratio', stat: 'damageDone', ratio: { base: 0.5 } },
        },
        {
          kind: 'modifier',
          target: { kind: 'self' },
          modifier: { unit: 'ratio', stat: 'dotDamage', ratio: { base: 0.25 } },
        },
        {
          kind: 'modifier',
          target: { kind: 'self' },
          modifier: { unit: 'percentage-points', stat: 'defenseIgnore', points: { base: 50 } },
        },
      ],
      icon: '',
      desc: '',
    };
    const vulnerability: Skill = {
      id: 'periodic-vulnerability',
      name: '承伤加深',
      class: 'swordsman',
      type: 'passive',
      element: 'none',
      unlockLevel: 1,
      effects: [
        {
          kind: 'modifier',
          target: { kind: 'self' },
          modifier: { unit: 'ratio', stat: 'damageTaken', ratio: { base: 0.2 } },
        },
        {
          kind: 'modifier',
          target: { kind: 'self' },
          modifier: {
            unit: 'ratio',
            stat: 'damageTakenFromSource',
            ratio: { base: 0.1 },
          },
        },
      ],
      icon: '',
      desc: '',
    };

    const result = simulateFight(attacker, defender, new Rng(1907), {
      maxSeconds: 1.1,
      playerSkillKit: createSkillCombatKit([offense], 20),
      monsterSkillKit: createSkillCombatKit([vulnerability], 20),
      playerOnCritTriggers: [BLOODMOON],
    });
    const periodic = result.events.find((event) => event.event.kind === 'periodic-damage');
    const expected = calcPeriodicDamage(
      attacker,
      defender,
      BLOODMOON.atkMultiplierPerTick,
      attacker.element,
      {
        defenseIgnoreRatio: 0.5,
        damageDoneRatio: 0.5,
        dotDamageRatio: 0.25,
        damageTakenRatio: 0.2,
        damageTakenFromSourceRatio: 0.1,
      },
    );

    expect(periodic?.event.kind).toBe('periodic-damage');
    expect(periodic?.event.damage).toBeCloseTo(expected, 8);
  });
});

describe('逐伤害段 on-hit 解析', () => {
  it('直接段未命中时不判定炎爆，命中后每一段各有一次机会', () => {
    const missAttacker = makePlayer('p', 20, s({ acc: 0, critRate: 0 }), 'fire');
    const untouchable = makePlayer('m', 20, s({ eva: 999_999, def: 0 }), 'ice');
    const miss = resolveDamageSegment(missAttacker, untouchable, 1, new Rng(1), [
      { ...FLAMEBURST, chance: 1 },
    ]);
    expect(miss.direct.hit).toBe(false);
    expect(miss.events).toEqual([miss.direct]);

    const attacker = makePlayer('p', 20, s({ acc: 99_999, critRate: 0 }), 'fire');
    const target = makePlayer('m', 20, s({ eva: 0, def: 0 }), 'ice');
    const rng = new Rng(904);
    const first = resolveDamageSegment(attacker, target, 0.5, rng, [{ ...FLAMEBURST, chance: 1 }]);
    const second = resolveDamageSegment(attacker, target, 0.5, rng, [{ ...FLAMEBURST, chance: 1 }]);
    expect(first.events.filter((event) => event.kind === 'on-hit-elemental-damage')).toHaveLength(
      1,
    );
    expect(second.events.filter((event) => event.kind === 'on-hit-elemental-damage')).toHaveLength(
      1,
    );
  });

  it('15% seeded 逐击采样与挂机期望使用同一数学', () => {
    const attacker = makePlayer('p', 50, s({ atk: 2_000, acc: 99_999, critRate: 35 }), 'fire', {
      damageReduction: 0,
      lifesteal: 0,
      elementDamage: { fire: 12, ice: 0, thunder: 0 },
    });
    const target = makePlayer('m', 50, s({ hp: 1e12, def: 1_000, eva: 0, critRate: 0 }), 'ice', {
      damageReduction: 10,
      lifesteal: 0,
      elementDamage: { fire: 0, ice: 0, thunder: 0 },
    });
    const rng = new Rng(905);
    const samples = 40_000;
    let total = 0;
    let triggers = 0;
    for (let index = 0; index < samples; index++) {
      const segment = resolveDamageSegment(attacker, target, 1.4, rng, [FLAMEBURST]);
      total += segment.events.reduce((sum, event) => sum + event.damage, 0);
      triggers += segment.events.filter((event) => event.kind === 'on-hit-elemental-damage').length;
    }

    expect(triggers / samples).toBeCloseTo(0.15, 2);
    const expected = expectedDamageSegment(attacker, target, 1.4, [FLAMEBURST]);
    expect(Math.abs(total / samples - expected) / expected).toBeLessThan(0.02);
  });

  it('挂机逐击期望与实战共享动态命中的硬上下限', () => {
    const attacker = makePlayer('p', 20, s({ atk: 1_000, acc: 100, critRate: 0 }), 'fire');
    const target = makePlayer('m', 20, s({ def: 0, eva: 100 }), 'ice');
    const guaranteed = { ...FLAMEBURST, chance: 1 };
    const triggeredDamage = expectedConfirmedElementalDamage(
      attacker,
      target,
      guaranteed.atkMultiplier,
      guaranteed.element,
    );

    const lowerBase = expectedDamageSegment(attacker, target, 1, [], {
      dodgeChancePoints: 999,
    });
    const lowerWithTrigger = expectedDamageSegment(attacker, target, 1, [guaranteed], {
      dodgeChancePoints: 999,
    });
    expect(lowerWithTrigger - lowerBase).toBeCloseTo(triggeredDamage * 0.55, 8);

    const upperBase = expectedDamageSegment(attacker, target, 1, [], {
      hitChancePoints: 999,
    });
    const upperWithTrigger = expectedDamageSegment(attacker, target, 1, [guaranteed], {
      hitChancePoints: 999,
    });
    expect(upperWithTrigger - upperBase).toBeCloseTo(triggeredDamage, 8);
  });

  it('拒绝越界触发配置，不用概率 clamp 掩盖数据错误', () => {
    const attacker = makePlayer('p', 20, s({ acc: 0 }), 'fire');
    const target = makePlayer('m', 20, s({ eva: 999_999 }), 'ice');
    expect(() =>
      resolveDamageSegment(attacker, target, 1, new Rng(906), [{ ...FLAMEBURST, chance: -0.1 }]),
    ).toThrow('触发概率');
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

  it('绯焰触发提高 DPS 与击杀速度，但不伪装成技能倍率', () => {
    const p = makePlayer('p', 20, s(), 'fire', {
      damageReduction: 0,
      lifesteal: 0,
      elementDamage: { fire: 12, ice: 0, thunder: 0 },
    });
    const target = mon(20);
    expect(estimateDps(p, target, 1, [FLAMEBURST])).toBeGreaterThan(estimateDps(p, target, 1));
    expect(timeToKill(p, target, 1, [FLAMEBURST])).toBeLessThan(timeToKill(p, target, 1));
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

    const expected = pressure.damageRatio <= 0.25 ? 1 : 1 / (1 + pressure.damageRatio - 0.25);
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
