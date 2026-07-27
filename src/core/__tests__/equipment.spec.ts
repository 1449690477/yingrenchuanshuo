import { describe, expect, it } from 'vitest';
import type { EquipmentDef, EquipmentInstance } from '../types';
import {
  baseEquipStats,
  createFixedInstance,
  createInstance,
  enhanceGainGrade,
  enhanceMultiplier,
  forgeStageAt,
  instanceStatBreakdown,
  instanceStats,
  itemBaseValue,
  rollBasePermille,
  rollAffixes,
  rollEnhanceGainPermille,
  totalEquipStats,
} from '../equipment';
import { Rng } from '../rng';
import {
  AFFIX_POOL,
  ENHANCE_MAX,
  ENHANCE_PER_LEVEL,
  ENHANCE_TOTAL_GAIN_CAP_PERMILLE,
  EQUIPMENT_BASE_AUTO_LOCK_MIN,
  EQUIPMENT_BASE_ROLL_MAX,
  EQUIPMENT_BASE_ROLL_MIN,
  QUALITY_AFFIX_COUNT,
  QUALITY_MUL,
  SLOT_AFFIX_WEIGHT_MUL,
  SLOT_ORDER,
} from '@/data/constants';

function def(overrides: Partial<EquipmentDef> = {}): EquipmentDef {
  return {
    id: 'eq_test',
    name: '测试戒指',
    slot: 'ring',
    quality: 'rare',
    level: 20,
    icon: '',
    appearanceId: 'test-ring',
    ...overrides,
  };
}

function inst(overrides: Partial<EquipmentInstance> = {}): EquipmentInstance {
  return {
    uid: 'e1',
    defId: 'eq_test',
    enhance: 0,
    baseRollPermille: 1000,
    enhanceGainPermille: Array<number>(ENHANCE_MAX).fill(0),
    enhanceLuck: {},
    affixes: [],
    locked: false,
    ...overrides,
  };
}

describe('装备基础属性', () => {
  it('等级和品质越高，数值基准越高', () => {
    expect(itemBaseValue(20, 'common')).toBeGreaterThan(itemBaseValue(10, 'common'));
    expect(itemBaseValue(20, 'rare') / itemBaseValue(20, 'common')).toBeCloseTo(
      QUALITY_MUL.rare,
      8,
    );
  });

  it('百分比属性只随品质变化，不随等级膨胀', () => {
    const low = baseEquipStats(def({ level: 1 }));
    const high = baseEquipStats(def({ level: 120 }));

    expect(high.atk).toBeGreaterThan(low.atk);
    expect(high.critRate).toBe(low.critRate);
    expect(high.critDmg).toBe(low.critDmg);
  });

  it('非法装备等级直接报错', () => {
    expect(() => itemBaseValue(0, 'common')).toThrow();
    expect(() => itemBaseValue(1.5, 'common')).toThrow();
  });
});

describe('强化与实例属性', () => {
  it('旧版每级 8% 记录在 +15 时仍精确为 2.2 倍，且百分比属性不受放大', () => {
    const legacyGains = Array<number>(ENHANCE_MAX).fill(ENHANCE_PER_LEVEL * 1000);
    expect(enhanceMultiplier(ENHANCE_MAX, legacyGains)).toBeCloseTo(
      1 + ENHANCE_PER_LEVEL * ENHANCE_MAX,
      8,
    );

    const definition = def();
    const plain = instanceStats(definition, inst());
    const enhanced = instanceStats(
      definition,
      inst({ enhance: ENHANCE_MAX, enhanceGainPermille: legacyGains }),
    );
    expect(enhanced.atk).toBeCloseTo(plain.atk * enhanceMultiplier(ENHANCE_MAX, legacyGains), 8);
    expect(enhanced.critRate).toBe(plain.critRate);
  });

  it('胚子只放大绝对基础属性，不放大百分比属性与词条', () => {
    const definition = def({
      slot: 'weapon',
      fixedAffixes: [{ key: 'atk', value: 100 }],
    });
    const standard = instanceStats(definition, inst({ affixes: [{ key: 'atk', value: 50 }] }));
    const miracle = instanceStats(
      definition,
      inst({
        baseRollPermille: 1200,
        affixes: [{ key: 'atk', value: 50 }],
      }),
    );
    const base = baseEquipStats(definition);

    expect(miracle.atk - standard.atk).toBeCloseTo(base.atk * 0.2, 8);
    expect(miracle.critRate).toBe(standard.critRate);
  });

  it('强化总增幅受 ×2.35 硬上限约束', () => {
    const allMiracle = Array<number>(ENHANCE_MAX).fill(125);
    expect(enhanceMultiplier(ENHANCE_MAX, allMiracle)).toBe(
      1 + ENHANCE_TOTAL_GAIN_CAP_PERMILLE / 1000,
    );
  });

  it('强化等级、隐藏基础浮动和逐级记录非法时直接报错', () => {
    const empty = Array<number>(ENHANCE_MAX).fill(0);
    expect(() => enhanceMultiplier(-1, empty)).toThrow();
    expect(() => enhanceMultiplier(ENHANCE_MAX + 1, empty)).toThrow();
    expect(() => enhanceMultiplier(1, empty)).toThrow('第 1 格增幅不能为 0');
    expect(() => enhanceMultiplier(0, [0])).toThrow('固定为');
    expect(() => instanceStats(def(), inst({ baseRollPermille: 799 }))).toThrow('隐藏基础浮动');
  });

  it('基础、固定词条、随机词条按来源分区且总属性只相加一次', () => {
    const definition = def({
      slot: 'weapon',
      fixedAffixes: [
        { key: 'atk', value: 10 },
        { key: 'critRate', value: 2 },
      ],
    });
    const equipment = inst({
      enhance: 1,
      baseRollPermille: 1200,
      enhanceGainPermille: [80, ...Array<number>(ENHANCE_MAX - 1).fill(0)],
      affixes: [
        { key: 'atk', value: 20 },
        { key: 'critDmg', value: 3 },
      ],
    });
    const breakdown = instanceStatBreakdown(definition, equipment);
    const definedBase = baseEquipStats(definition);

    expect(breakdown.base.atk).toBeCloseTo(definedBase.atk * 1.2 * 1.08, 8);
    expect(breakdown.base.critRate).toBe(definedBase.critRate);
    expect(breakdown.fixedAffixes.atk).toBe(10);
    expect(breakdown.fixedAffixes.critRate).toBe(2);
    expect(breakdown.randomAffixes.atk).toBe(20);
    expect(breakdown.randomAffixes.critDmg).toBe(3);
    expect(breakdown.total.atk).toBeCloseTo(breakdown.base.atk + 30, 8);
    expect(instanceStats(definition, equipment)).toEqual(breakdown.total);
  });

  it('暴击、暴伤和攻速不受隐藏浮动或强化放大', () => {
    const gains = [125, ...Array<number>(ENHANCE_MAX - 1).fill(0)];
    for (const definition of [def({ slot: 'ring' }), def({ slot: 'shoes' })]) {
      const standard = instanceStatBreakdown(definition, inst()).base;
      const grown = instanceStatBreakdown(
        definition,
        inst({ enhance: 1, baseRollPermille: 1200, enhanceGainPermille: gains }),
      ).base;
      expect(grown.critRate).toBe(standard.critRate);
      expect(grown.critDmg).toBe(standard.critDmg);
      expect(grown.spd).toBe(standard.spd);
    }
  });

  it('强化不会放大固定词条或随机词条', () => {
    const definition = def({ fixedAffixes: [{ key: 'atk', value: 10 }] });
    const plain = instanceStatBreakdown(
      definition,
      inst({ affixes: [{ key: 'atk', value: 20 }] }),
    );
    const enhanced = instanceStatBreakdown(
      definition,
      inst({
        enhance: 1,
        enhanceGainPermille: [125, ...Array<number>(ENHANCE_MAX - 1).fill(0)],
        affixes: [{ key: 'atk', value: 20 }],
      }),
    );
    expect(enhanced.fixedAffixes).toEqual(plain.fixedAffixes);
    expect(enhanced.randomAffixes).toEqual(plain.randomAffixes);
  });

  it('全身属性累加，缺失的配置定义必须暴露错误', () => {
    const definition = def();
    const one = instanceStats(definition, inst());
    const total = totalEquipStats([inst(), inst({ uid: 'e2' })], () => definition);
    expect(total.atk).toBeCloseTo(one.atk * 2, 8);

    expect(() => totalEquipStats([inst()], () => undefined)).toThrow('装备定义不存在');
  });
});

describe('随机词条', () => {
  it('数量由品质配置决定，同一件装备不重复 key', () => {
    const definition = def({ quality: 'epic' });
    const affixes = rollAffixes(definition, new Rng(2026));
    expect(affixes).toHaveLength(QUALITY_AFFIX_COUNT.epic);
    expect(new Set(affixes.map((affix) => affix.key)).size).toBe(affixes.length);
  });

  it('固定词条占用品质词条名额且不会重复 key', () => {
    const definition = def({
      quality: 'epic',
      fixedAffixes: [
        { key: 'atk', value: 10 },
        { key: 'critRate', value: 2 },
      ],
    });
    const random = rollAffixes(definition, new Rng(2027));
    expect(random).toHaveLength(1);
    expect(random.some((affix) => affix.key === 'atk' || affix.key === 'critRate')).toBe(false);
  });

  it('同种子生成完全相同的装备实例', () => {
    const definition = def({ quality: 'legendary' });
    const make = () => createInstance(definition, new Rng(88), 'e88');
    expect(make()).toEqual(make());
  });

  it('隐藏基础浮动遵循 65/33/2 分布，范围为 80%~120%', () => {
    const rolls = Array.from({ length: 10_000 }, (_, seed) =>
      rollBasePermille(new Rng(seed + 1)),
    );
    const low = rolls.filter(({ permille }) => permille < 1000).length / rolls.length;
    const competitive =
      rolls.filter(({ permille }) => permille >= 1000 && permille < EQUIPMENT_BASE_AUTO_LOCK_MIN)
        .length / rolls.length;
    const protectedRate = rolls.filter(({ autoLock }) => autoLock).length / rolls.length;

    expect(
      rolls.every(
        ({ permille }) =>
          permille >= EQUIPMENT_BASE_ROLL_MIN && permille <= EQUIPMENT_BASE_ROLL_MAX,
      ),
    ).toBe(true);
    expect(low).toBeGreaterThan(0.62);
    expect(low).toBeLessThan(0.68);
    expect(competitive).toBeGreaterThan(0.3);
    expect(competitive).toBeLessThan(0.36);
    expect(protectedRate).toBeGreaterThan(0.01);
    expect(protectedRate).toBeLessThan(0.03);
    expect(
      rolls.every(({ permille, autoLock }) =>
        autoLock ? permille >= EQUIPMENT_BASE_AUTO_LOCK_MIN : permille < EQUIPMENT_BASE_AUTO_LOCK_MIN,
      ),
    ).toBe(true);
  });

  it('强化增幅最低不低于旧版，低概率出现奇迹档', () => {
    const rolls = Array.from({ length: 1000 }, (_, seed) =>
      rollEnhanceGainPermille(new Rng(seed + 1)),
    );

    expect(rolls.every(({ permille }) => permille >= 80 && permille <= 125)).toBe(true);
    expect(rolls.some(({ grade }) => grade === 'excellent')).toBe(true);
    expect(rolls.some(({ grade }) => grade === 'miracle')).toBe(true);
    expect(enhanceGainGrade(80)).toBe('stable');
    expect(enhanceGainGrade(83)).toBe('excellent');
    expect(enhanceGainGrade(110)).toBe('miracle');
    expect(() => enhanceGainGrade(100)).toThrow('未配置');
  });

  it('最高隐藏区间会自动锁定，确定精品则保持固定 100% 模板', () => {
    let protectedSeed = 0;
    for (let seed = 1; seed < 10_000; seed++) {
      if (rollBasePermille(new Rng(seed)).autoLock) {
        protectedSeed = seed;
        break;
      }
    }
    expect(protectedSeed).toBeGreaterThan(0);
    const protectedDrop = createInstance(def(), new Rng(protectedSeed), 'protected');
    expect(protectedDrop.baseRollPermille).toBeGreaterThanOrEqual(EQUIPMENT_BASE_AUTO_LOCK_MIN);
    expect(protectedDrop.locked).toBe(true);

    expect(createFixedInstance(def(), 'shop', true)).toMatchObject({
      baseRollPermille: 1000,
      enhance: 0,
      enhanceGainPermille: Array<number>(ENHANCE_MAX).fill(0),
      enhanceLuck: {},
      affixes: [],
      locked: true,
    });
  });

  it('攻速词条保留两位小数，不会被四舍五入成 0', () => {
    const speedValues: number[] = [];
    for (let seed = 1; seed <= 200; seed++) {
      const affixes = rollAffixes(def({ quality: 'legendary' }), new Rng(seed));
      const speed = affixes.find((affix) => affix.key === 'spd');
      if (speed) speedValues.push(speed.value);
    }

    expect(speedValues.length).toBeGreaterThan(0);
    expect(speedValues.every((value) => value >= 0.01 && value <= 0.05)).toBe(true);
  });
});

describe('部位词条倾向', () => {
  it('配置覆盖全部部位且倍率均为正数', () => {
    expect(Object.keys(SLOT_AFFIX_WEIGHT_MUL).sort()).toEqual([...SLOT_ORDER].sort());
    for (const weights of Object.values(SLOT_AFFIX_WEIGHT_MUL)) {
      expect(Object.values(weights).every((weight) => Number.isFinite(weight) && weight! > 0)).toBe(
        true,
      );
    }
  });

  it('武器攻击与鞋子闪避/攻速更常见，但其他合法词条仍会出现', () => {
    const sample = (slot: EquipmentDef['slot']) => {
      const keys = Array.from({ length: 6000 }, (_, seed) =>
        rollAffixes(def({ slot, quality: 'fine' }), new Rng(seed + 1))[0]!.key,
      );
      return keys;
    };
    const weapon = sample('weapon');
    const shoes = sample('shoes');

    expect(weapon.filter((key) => key === 'atk').length / weapon.length).toBeGreaterThan(0.25);
    expect(shoes.filter((key) => key === 'eva' || key === 'spd').length / shoes.length).toBeGreaterThan(
      0.15,
    );
    expect(new Set(weapon)).toEqual(new Set(AFFIX_POOL.map((entry) => entry.key)));
    expect(new Set(shoes)).toEqual(new Set(AFFIX_POOL.map((entry) => entry.key)));
  });
});

describe('锻造外观阶段', () => {
  it.each([
    [0, 'original'],
    [4, 'original'],
    [5, 'gleam'],
    [8, 'gleam'],
    [9, 'radiant'],
    [11, 'radiant'],
    [12, 'starforged'],
    [14, 'starforged'],
    [15, 'sakura'],
  ] as const)('+%i 对应 %s', (level, stage) => {
    expect(forgeStageAt(level)).toBe(stage);
  });

  it('拒绝越界等级', () => {
    expect(() => forgeStageAt(-1)).toThrow();
    expect(() => forgeStageAt(16)).toThrow();
  });
});
