import { describe, expect, it } from 'vitest';
import type { EquipmentDef, EquipmentInstance } from '../types';
import {
  baseEquipStats,
  baseRollGrade,
  createFixedInstance,
  createInstance,
  enhanceGainGrade,
  enhanceMultiplier,
  forgeStageAt,
  instanceStats,
  itemBaseValue,
  rollBasePermille,
  rollAffixes,
  rollEnhanceGainPermille,
  totalEquipStats,
} from '../equipment';
import { Rng } from '../rng';
import {
  ENHANCE_MAX,
  ENHANCE_PER_LEVEL,
  ENHANCE_TOTAL_GAIN_CAP_PERMILLE,
  EQUIPMENT_BASE_ROLL_MAX,
  EQUIPMENT_BASE_ROLL_MIN,
  QUALITY_AFFIX_COUNT,
  QUALITY_MUL,
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

  it('强化等级、胚子和逐级记录非法时直接报错', () => {
    const empty = Array<number>(ENHANCE_MAX).fill(0);
    expect(() => enhanceMultiplier(-1, empty)).toThrow();
    expect(() => enhanceMultiplier(ENHANCE_MAX + 1, empty)).toThrow();
    expect(() => enhanceMultiplier(1, empty)).toThrow('第 1 格增幅不能为 0');
    expect(() => enhanceMultiplier(0, [0])).toThrow('固定为');
    expect(() => instanceStats(def(), inst({ baseRollPermille: 999 }))).toThrow('胚子倍率');
  });

  it('固定词条与随机词条都会叠加', () => {
    const stats = instanceStats(
      def({ fixedAffixes: [{ key: 'atk', value: 10 }] }),
      inst({ affixes: [{ key: 'atk', value: 20 }] }),
    );
    expect(stats.atk).toBeCloseTo(baseEquipStats(def()).atk + 30, 8);
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

  it('掉落胚子始终位于 100%~120%，并能掷出精工与奇迹档', () => {
    const rolls = Array.from({ length: 1000 }, (_, seed) => rollBasePermille(new Rng(seed + 1)));

    expect(
      rolls.every(
        ({ permille }) =>
          permille >= EQUIPMENT_BASE_ROLL_MIN && permille <= EQUIPMENT_BASE_ROLL_MAX,
      ),
    ).toBe(true);
    expect(rolls.some(({ grade }) => grade === 'refined')).toBe(true);
    expect(rolls.some(({ grade }) => grade === 'miracle')).toBe(true);
    expect(baseRollGrade(1000)).toBe('steady');
    expect(baseRollGrade(1061)).toBe('refined');
    expect(baseRollGrade(1200)).toBe('miracle');
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

  it('奇迹胚子会自动锁定，确定珍品则保持固定 100% 胚子', () => {
    let miracleSeed = 0;
    for (let seed = 1; seed < 10_000; seed++) {
      if (rollBasePermille(new Rng(seed)).grade === 'miracle') {
        miracleSeed = seed;
        break;
      }
    }
    expect(miracleSeed).toBeGreaterThan(0);
    expect(createInstance(def(), new Rng(miracleSeed), 'miracle').locked).toBe(true);

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
