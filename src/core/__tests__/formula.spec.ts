import { describe, it, expect } from 'vitest';
import {
  addStats,
  calcConfirmedElementalDamage,
  calcDamage,
  calcPeriodicDamage,
  clamp,
  combatBonusDamageMultiplier,
  combatPower,
  critMultiplier,
  damageReduction,
  effectiveElementMultiplier,
  effectiveElementMultiplierFor,
  elementMultiplier,
  expectedDamage,
  expectedConfirmedElementalDamage,
  hitChance,
  zeroStats,
} from '../formula';
import { Rng } from '../rng';
import { makePlayer } from '../progression';
import type { CombatBonuses, Stats } from '../types';
import { K_DEF, MIN_DAMAGE_RATIO } from '@/data/constants';

const stats = (o: Partial<Stats> = {}): Stats => ({
  atk: 100,
  def: 50,
  hp: 1000,
  acc: 100,
  eva: 10,
  critRate: 0,
  critDmg: 50,
  spd: 1,
  ...o,
});

const bonuses = (
  o: Partial<Omit<CombatBonuses, 'elementDamage'>> & {
    elementDamage?: Partial<CombatBonuses['elementDamage']>;
  } = {},
): CombatBonuses => ({
  damageReduction: o.damageReduction ?? 0,
  lifesteal: o.lifesteal ?? 0,
  elementDamage: {
    fire: o.elementDamage?.fire ?? 0,
    ice: o.elementDamage?.ice ?? 0,
    thunder: o.elementDamage?.thunder ?? 0,
  },
});

describe('clamp', () => {
  it('夹在区间内', () => {
    expect(clamp(5, 0, 10)).toBe(5);
    expect(clamp(-1, 0, 10)).toBe(0);
    expect(clamp(99, 0, 10)).toBe(10);
  });
});

describe('damageReduction', () => {
  it('def = K_DEF × 等级 时减伤正好 50%（docs/10 的设计锚点）', () => {
    const level = 60;
    expect(damageReduction(K_DEF * level, level)).toBeCloseTo(0.5, 6);
  });

  it('0 防御时不减伤', () => {
    expect(damageReduction(0, 10)).toBe(0);
  });

  it('单调递增但永远小于 1（防御永不无敌）', () => {
    const level = 30;
    let prev = -1;
    for (const def of [0, 100, 1000, 10000, 1e6, 1e9]) {
      const r = damageReduction(def, level);
      expect(r).toBeGreaterThan(prev);
      expect(r).toBeLessThan(1);
      prev = r;
    }
  });
});

describe('hitChance', () => {
  it('命中等于闪避时为基础值 0.75', () => {
    expect(hitChance(100, 100)).toBeCloseTo(0.75, 6);
  });

  it('下限 0.55，上限 1.0', () => {
    expect(hitChance(0, 100000)).toBe(0.55);
    expect(hitChance(100000, 0)).toBe(1.0);
  });
});

describe('critMultiplier', () => {
  it('基础暴伤 50 时为 2.0 倍', () => {
    expect(critMultiplier(50)).toBeCloseTo(2.0, 6);
  });
});

describe('elementMultiplier', () => {
  it('炎 → 冰 → 雷 → 炎 构成克制环', () => {
    expect(elementMultiplier('fire', 'ice')).toBe(1.25);
    expect(elementMultiplier('ice', 'thunder')).toBe(1.25);
    expect(elementMultiplier('thunder', 'fire')).toBe(1.25);
  });

  it('被克时为 0.85', () => {
    expect(elementMultiplier('ice', 'fire')).toBe(0.85);
    expect(elementMultiplier('thunder', 'ice')).toBe(0.85);
    expect(elementMultiplier('fire', 'thunder')).toBe(0.85);
  });

  it('同属性或无属性时为 1.0', () => {
    expect(elementMultiplier('fire', 'fire')).toBe(1.0);
    expect(elementMultiplier('none', 'fire')).toBe(1.0);
    expect(elementMultiplier('fire', 'none')).toBe(1.0);
  });
});

describe('装备战斗修正系数', () => {
  it('元素伤害只在攻击属性与词条属性匹配时加到基础克制系数', () => {
    const defender = makePlayer('冰目标', 10, stats(), 'ice');
    const fire = makePlayer(
      '炎攻击者',
      10,
      stats(),
      'fire',
      bonuses({ elementDamage: { fire: 10, ice: 50 } }),
    );
    const mismatch = makePlayer(
      '错配攻击者',
      10,
      stats(),
      'fire',
      bonuses({ elementDamage: { ice: 50 } }),
    );
    const neutral = makePlayer(
      '无属性攻击者',
      10,
      stats(),
      'none',
      bonuses({ elementDamage: { fire: 50 } }),
    );

    expect(effectiveElementMultiplier(fire, defender)).toBeCloseTo(1.35, 8);
    expect(effectiveElementMultiplier(mismatch, defender)).toBeCloseTo(1.25, 8);
    expect(effectiveElementMultiplier(neutral, defender)).toBe(1);
    expect(
      effectiveElementMultiplierFor('fire', defender.element, fire.combatBonuses?.elementDamage),
    ).toBeCloseTo(1.35, 8);
  });

  it('词条减伤使用百分点并限制在 0%~100%', () => {
    expect(
      combatBonusDamageMultiplier(
        makePlayer('目标', 10, stats(), 'none', bonuses({ damageReduction: 25 })),
      ),
    ).toBeCloseTo(0.75, 8);
    expect(
      combatBonusDamageMultiplier(
        makePlayer('目标', 10, stats(), 'none', bonuses({ damageReduction: 999 })),
      ),
    ).toBe(0);
  });
});

describe('确认命中后的追加元素伤害', () => {
  it('不进行第二次命中或暴击判定，只使用 seeded 浮动', () => {
    const defender = makePlayer('冰目标', 10, stats({ def: 0, eva: 999_999 }), 'ice');
    const alwaysCrit = makePlayer(
      '低命中高暴击攻击者',
      10,
      stats({ atk: 1_000, acc: 0, critRate: 100, critDmg: 999 }),
      'none',
      bonuses({ elementDamage: { fire: 12 } }),
    );
    const neverCrit = makePlayer(
      '低命中零暴击攻击者',
      10,
      stats({ atk: 1_000, acc: 0, critRate: 0, critDmg: 0 }),
      'none',
      bonuses({ elementDamage: { fire: 12 } }),
    );

    const highCritDamage = calcConfirmedElementalDamage(
      alwaysCrit,
      defender,
      1.2,
      'fire',
      new Rng(901),
    );
    const noCritDamage = calcConfirmedElementalDamage(
      neverCrit,
      defender,
      1.2,
      'fire',
      new Rng(901),
    );

    expect(highCritDamage).toBeGreaterThan(0);
    expect(highCritDamage).toBe(noCritDamage);
  });

  it('完整经过防御、目标减伤、炎克冰与炎伤加成', () => {
    const attacker = makePlayer(
      '炎爆攻击者',
      10,
      stats({ atk: 1_000 }),
      'none',
      bonuses({ elementDamage: { fire: 12 } }),
    );
    const defender = makePlayer(
      '冰目标',
      10,
      stats({ def: K_DEF * 10 }),
      'ice',
      bonuses({ damageReduction: 20 }),
    );

    // 防御 50% × 目标减伤 80% × (炎克冰 1.25 + 炎伤 0.12)。
    expect(expectedConfirmedElementalDamage(attacker, defender, 1.2, 'fire')).toBeCloseTo(
      1_000 * 1.2 * 0.5 * 0.8 * 1.37,
      8,
    );
  });
});

describe('持续伤害单跳', () => {
  it('不读取命中、暴击或 RNG，只走防御、减伤与指定元素', () => {
    const attacker = makePlayer(
      '流血来源',
      10,
      stats({ atk: 1_000, acc: 0, critRate: 100, critDmg: 999 }),
      'none',
      bonuses({ elementDamage: { fire: 12 } }),
    );
    const defender = makePlayer(
      '冰目标',
      10,
      stats({ def: K_DEF * 10, eva: 999_999 }),
      'ice',
      bonuses({ damageReduction: 20 }),
    );

    expect(calcPeriodicDamage(attacker, defender, 0.8, 'fire')).toBeCloseTo(
      1_000 * 0.8 * 0.5 * 0.8 * 1.37,
      8,
    );
    expect(() => calcPeriodicDamage(attacker, defender, -0.1)).toThrow('非负有限数');
  });
});

describe('calcDamage', () => {
  it('必定命中时伤害为正', () => {
    const rng = new Rng(1);
    const atk = makePlayer('p', 10, stats({ acc: 99999 }));
    const def = makePlayer('m', 10, stats({ eva: 0 }));
    const r = calcDamage(atk, def, 1.0, rng);
    expect(r.hit).toBe(true);
    expect(r.damage).toBeGreaterThan(0);
  });

  it('必定闪避时伤害为 0', () => {
    const rng = new Rng(1);
    const atk = makePlayer('p', 10, stats({ acc: 0 }));
    const def = makePlayer('m', 10, stats({ eva: 999999 }));
    const r = calcDamage(atk, def, 1.0, rng);
    expect(r.hit).toBe(false);
    expect(r.damage).toBe(0);
  });

  it('极高防御时仍有保底伤害 atk × 0.05', () => {
    const rng = new Rng(3);
    const atk = makePlayer('p', 10, stats({ atk: 1000, acc: 99999, critRate: 0 }));
    const def = makePlayer('m', 10, stats({ def: 1e9, eva: 0 }));
    const r = calcDamage(atk, def, 1.0, rng);
    expect(r.damage).toBeCloseTo(1000 * MIN_DAMAGE_RATIO, 6);
  });

  it('结果可复现（同种子同结果）', () => {
    const mk = () => {
      const rng = new Rng(777);
      const a = makePlayer('p', 20, stats({ critRate: 30 }));
      const d = makePlayer('m', 20, stats());
      return Array.from({ length: 20 }, () => calcDamage(a, d, 1.2, rng));
    };
    expect(mk()).toEqual(mk());
  });

  it('100% 暴击率时必定暴击，且伤害高于不暴击', () => {
    const a1 = makePlayer('p', 10, stats({ acc: 99999, critRate: 100 }));
    const a2 = makePlayer('p', 10, stats({ acc: 99999, critRate: 0 }));
    const d = makePlayer('m', 10, stats({ eva: 0 }));

    const r1 = calcDamage(a1, d, 1.0, new Rng(5));
    const r2 = calcDamage(a2, d, 1.0, new Rng(5));

    expect(r1.crit).toBe(true);
    expect(r2.crit).toBe(false);
    expect(r1.damage).toBeGreaterThan(r2.damage);
  });

  it('词条减伤与防御减伤相乘，逐击和期望伤害都按 20% 等比降低', () => {
    const attacker = makePlayer('p', 10, stats({ atk: 1000, acc: 99999, critRate: 0 }));
    const plain = makePlayer('m', 10, stats({ def: 100, eva: 0 }));
    const reduced = makePlayer(
      'm',
      10,
      stats({ def: 100, eva: 0 }),
      'none',
      bonuses({ damageReduction: 20 }),
    );

    const plainRoll = calcDamage(attacker, plain, 1, new Rng(80));
    const reducedRoll = calcDamage(attacker, reduced, 1, new Rng(80));
    expect(reducedRoll.damage / plainRoll.damage).toBeCloseTo(0.8, 8);
    expect(expectedDamage(attacker, reduced, 1) / expectedDamage(attacker, plain, 1)).toBeCloseTo(
      0.8,
      8,
    );
  });

  it('词条减伤在最终保底伤害前应用，100% 减伤仍保留 MIN_DAMAGE floor', () => {
    const attacker = makePlayer('p', 10, stats({ atk: 1000, acc: 99999, critRate: 0 }));
    const defender = makePlayer(
      'm',
      10,
      stats({ def: 100, eva: 0 }),
      'none',
      bonuses({ damageReduction: 100 }),
    );
    expect(calcDamage(attacker, defender, 1, new Rng(81)).damage).toBe(
      attacker.stats.atk * MIN_DAMAGE_RATIO,
    );
    expect(expectedDamage(attacker, defender, 1)).toBe(attacker.stats.atk * MIN_DAMAGE_RATIO);
  });

  it('匹配的元素伤害会同时提高逐击与期望伤害，错配词条不生效', () => {
    const defender = makePlayer('m', 10, stats({ def: 0, eva: 0 }), 'ice');
    const plain = makePlayer('p', 10, stats({ acc: 99999, critRate: 0 }), 'fire');
    const matched = makePlayer(
      'p',
      10,
      stats({ acc: 99999, critRate: 0 }),
      'fire',
      bonuses({ elementDamage: { fire: 10 } }),
    );
    const mismatched = makePlayer(
      'p',
      10,
      stats({ acc: 99999, critRate: 0 }),
      'fire',
      bonuses({ elementDamage: { thunder: 10 } }),
    );

    expect(calcDamage(matched, defender, 1, new Rng(82)).damage).toBeGreaterThan(
      calcDamage(plain, defender, 1, new Rng(82)).damage,
    );
    expect(calcDamage(mismatched, defender, 1, new Rng(82)).damage).toBeCloseTo(
      calcDamage(plain, defender, 1, new Rng(82)).damage,
      8,
    );
    expect(expectedDamage(matched, defender, 1)).toBeGreaterThan(
      expectedDamage(plain, defender, 1),
    );
  });
});

describe('expectedDamage', () => {
  it('与大量 calcDamage 采样的均值接近', () => {
    const a = makePlayer(
      'p',
      30,
      stats({ atk: 500, critRate: 25 }),
      'fire',
      bonuses({ elementDamage: { fire: 8 } }),
    );
    const d = makePlayer(
      'm',
      30,
      stats({ def: 300, eva: 40 }),
      'ice',
      bonuses({ damageReduction: 12 }),
    );

    const rng = new Rng(20260726);
    const N = 30000;
    let sum = 0;
    for (let i = 0; i < N; i++) sum += calcDamage(a, d, 1.5, rng).damage;

    const sampled = sum / N;
    const expected = expectedDamage(a, d, 1.5);

    // 允许 3% 误差
    expect(Math.abs(sampled - expected) / expected).toBeLessThan(0.03);
  });
});

describe('combatPower', () => {
  it('全零属性战力为 0 附近（spd 以 1.0 为基准）', () => {
    expect(combatPower({ ...zeroStats(), spd: 1.0 })).toBe(0);
  });

  it('属性提升则战力提升', () => {
    const base = stats();
    expect(combatPower({ ...base, atk: base.atk + 100 })).toBeGreaterThan(combatPower(base));
    expect(combatPower({ ...base, def: base.def + 100 })).toBeGreaterThan(combatPower(base));
    expect(combatPower({ ...base, hp: base.hp + 1000 })).toBeGreaterThan(combatPower(base));
  });

  it('防御的战力权重高于攻击（每点）', () => {
    const base = stats();
    const withAtk = combatPower({ ...base, atk: base.atk + 100 });
    const withDef = combatPower({ ...base, def: base.def + 100 });
    expect(withDef).toBeGreaterThan(withAtk);
  });
});

describe('addStats', () => {
  it('累加且不修改入参', () => {
    const a = zeroStats();
    const b = addStats(a, { atk: 10, hp: 100 });
    expect(b.atk).toBe(10);
    expect(b.hp).toBe(100);
    expect(a.atk).toBe(0);
  });
});
