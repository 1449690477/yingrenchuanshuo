import { describe, expect, it } from 'vitest';
import type { EquipmentDef, EquipmentInstance, Stats } from '../types';
import {
  applyEquipmentSetStats,
  resolveEquipmentSetBonuses,
} from '../equipmentSets';
import { EQUIPMENT } from '@/data/equipment';
import { ENHANCE_MAX } from '@/data/constants';

function instance(defId: string, uid: string): EquipmentInstance {
  return {
    uid,
    defId,
    enhance: 0,
    baseRollPermille: 1000,
    enhanceGainPermille: Array<number>(ENHANCE_MAX).fill(0),
    enhanceLuck: {},
    affixes: [],
    reforgeResonance: 0,
    locked: false,
  };
}

const baseStats: Stats = {
  atk: 100,
  def: 80,
  hp: 1_000,
  acc: 100,
  eva: 50,
  critRate: 10,
  critDmg: 50,
  spd: 1,
};

describe('装备副本套装共鸣', () => {
  it('只统计已穿戴件，按 2/4/6/8 件逐档激活', () => {
    const ids = [
      'eq_dungeon_crimson_weapon_witch',
      'eq_dungeon_crimson_body_witch',
      'eq_dungeon_crimson_head_1',
      'eq_dungeon_crimson_necklace_1',
      'eq_dungeon_crimson_bracelet_1',
      'eq_dungeon_crimson_ring_1',
      'eq_dungeon_crimson_belt_1',
      'eq_dungeon_crimson_shoes_1',
    ];

    const four = resolveEquipmentSetBonuses(
      ids.slice(0, 4).map((id, index) => instance(id, `e${index + 1}`)),
      (id) => EQUIPMENT[id],
    );
    expect(four.sets[0]).toMatchObject({
      equippedPieces: 4,
      activeBonuses: [{ pieces: 2 }, { pieces: 4 }],
      nextBonus: { pieces: 6 },
    });
    expect(four.statPercent).toMatchObject({ atk: 0.12, hp: 0.18, def: 0 });
    expect(four.skillMultiplierBonus).toBe(0);

    const eight = resolveEquipmentSetBonuses(
      ids.map((id, index) => instance(id, `e${index + 1}`)),
      (id) => EQUIPMENT[id],
    );
    expect(eight.sets[0]?.activeBonuses).toHaveLength(4);
    expect(eight.sets[0]?.nextBonus).toBeNull();
    expect(eight.statPercent).toMatchObject({ atk: 0.12, hp: 0.18, def: 0.15 });
    expect(eight.statFlat.critRate).toBe(5);
    expect(eight.skillMultiplierBonus).toBe(0.18);
  });

  it('不同套装分别计数，未达两件不会偷跑属性', () => {
    const resolution = resolveEquipmentSetBonuses(
      [
        instance('eq_dungeon_azure_weapon_witch', 'e1'),
        instance('eq_dungeon_violet_body_witch', 'e2'),
      ],
      (id) => EQUIPMENT[id],
    );

    expect(resolution.sets).toHaveLength(2);
    expect(resolution.sets.every((set) => set.activeBonuses.length === 0)).toBe(true);
    expect(resolution.statPercent).toEqual({
      atk: 0,
      def: 0,
      hp: 0,
      acc: 0,
      eva: 0,
      critRate: 0,
      critDmg: 0,
      spd: 0,
    });
  });

  it('百分比与固定值按明确顺序改变最终属性，输入不被修改', () => {
    const original = { ...baseStats };
    const resolution = resolveEquipmentSetBonuses(
      [
        instance('eq_dungeon_azure_weapon_witch', 'e1'),
        instance('eq_dungeon_azure_body_witch', 'e2'),
        instance('eq_dungeon_azure_head_1', 'e3'),
        instance('eq_dungeon_azure_necklace_1', 'e4'),
        instance('eq_dungeon_azure_bracelet_1', 'e5'),
        instance('eq_dungeon_azure_ring_1', 'e6'),
      ],
      (id) => EQUIPMENT[id],
    );

    const result = applyEquipmentSetStats(baseStats, resolution);
    expect(result).toMatchObject({
      atk: 104,
      hp: 1_080,
      critRate: 12,
      acc: 100,
      eva: 50,
      critDmg: 50,
      spd: 1,
    });
    expect(result.def).toBeCloseTo(84.8);
    expect(baseStats).toEqual(original);
  });

  it('缺失装备定义或套装登记时直接报错，不用兜底掩盖配置错误', () => {
    expect(() =>
      resolveEquipmentSetBonuses([instance('missing', 'e1')], () => undefined),
    ).toThrow('装备定义不存在');

    const unknownSetDef: EquipmentDef = {
      id: 'bad',
      name: '坏配置',
      slot: 'ring',
      quality: 'rare',
      level: 1,
      icon: 'bad.png',
      appearanceId: 'r1-ring',
      setId: 'missing-set',
    };
    expect(() =>
      resolveEquipmentSetBonuses([instance('bad', 'e1')], () => unknownSetDef),
    ).toThrow('未登记套装');
  });
});
