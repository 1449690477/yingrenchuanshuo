import { describe, expect, it } from 'vitest';
import type { EquipmentDef, EquipmentInstance } from '../types';
import {
  baseEquipStats,
  createInstance,
  enhanceMultiplier,
  instanceStats,
  itemBaseValue,
  rollAffixes,
  totalEquipStats,
} from '../equipment';
import { Rng } from '../rng';
import { ENHANCE_MAX, ENHANCE_PER_LEVEL, QUALITY_AFFIX_COUNT, QUALITY_MUL } from '@/data/constants';

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
  it('+15 倍率来自配置，且百分比属性不受强化放大', () => {
    expect(enhanceMultiplier(ENHANCE_MAX)).toBeCloseTo(1 + ENHANCE_PER_LEVEL * ENHANCE_MAX, 8);

    const definition = def();
    const plain = instanceStats(definition, inst());
    const enhanced = instanceStats(definition, inst({ enhance: ENHANCE_MAX }));
    expect(enhanced.atk).toBeCloseTo(plain.atk * enhanceMultiplier(ENHANCE_MAX), 8);
    expect(enhanced.critRate).toBe(plain.critRate);
  });

  it('强化等级越界直接报错', () => {
    expect(() => enhanceMultiplier(-1)).toThrow();
    expect(() => enhanceMultiplier(ENHANCE_MAX + 1)).toThrow();
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

  it('同种子生成完全相同的装备实例', () => {
    const definition = def({ quality: 'legendary' });
    const make = () => createInstance(definition, new Rng(88), 'e88');
    expect(make()).toEqual(make());
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
