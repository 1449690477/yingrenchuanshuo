import { describe, expect, it } from 'vitest';
import { EQUIPMENT_DUNGEON_SETS } from '../equipmentDungeonSets';
import { EQUIPMENT_SETS, getEquipmentSet, requireEquipmentSet } from '../equipmentSets';

describe('通用装备套装注册表', () => {
  it('完整聚合现有四套装备副本套装且保持同一权威定义', () => {
    expect(Object.keys(EQUIPMENT_SETS)).toEqual([
      'set_dungeon_azure',
      'set_dungeon_violet',
      'set_dungeon_auric',
      'set_dungeon_crimson',
    ]);
    for (const [id, definition] of Object.entries(EQUIPMENT_DUNGEON_SETS)) {
      expect(getEquipmentSet(id)).toBe(definition);
    }
  });

  it('锁住现有四套的全部结算数值', () => {
    const numericContract = Object.fromEntries(
      Object.entries(EQUIPMENT_SETS).map(([id, definition]) => [
        id,
        definition.bonuses.map((bonus) => ({
          pieces: bonus.pieces,
          statPercent: bonus.statPercent ?? null,
          statFlat: bonus.statFlat ?? null,
          skillMultiplierBonus: bonus.skillMultiplierBonus ?? null,
        })),
      ]),
    );

    expect(numericContract).toEqual({
      set_dungeon_azure: [
        {
          pieces: 2,
          statPercent: { atk: 0.04 },
          statFlat: null,
          skillMultiplierBonus: null,
        },
        {
          pieces: 4,
          statPercent: { hp: 0.08 },
          statFlat: null,
          skillMultiplierBonus: null,
        },
        {
          pieces: 6,
          statPercent: { def: 0.06 },
          statFlat: { critRate: 2 },
          skillMultiplierBonus: null,
        },
        {
          pieces: 8,
          statPercent: null,
          statFlat: null,
          skillMultiplierBonus: 0.05,
        },
      ],
      set_dungeon_violet: [
        {
          pieces: 2,
          statPercent: { atk: 0.06 },
          statFlat: null,
          skillMultiplierBonus: null,
        },
        {
          pieces: 4,
          statPercent: { hp: 0.1 },
          statFlat: null,
          skillMultiplierBonus: null,
        },
        {
          pieces: 6,
          statPercent: { def: 0.08 },
          statFlat: { critRate: 3 },
          skillMultiplierBonus: null,
        },
        {
          pieces: 8,
          statPercent: null,
          statFlat: null,
          skillMultiplierBonus: 0.08,
        },
      ],
      set_dungeon_auric: [
        {
          pieces: 2,
          statPercent: { atk: 0.09 },
          statFlat: null,
          skillMultiplierBonus: null,
        },
        {
          pieces: 4,
          statPercent: { hp: 0.14 },
          statFlat: null,
          skillMultiplierBonus: null,
        },
        {
          pieces: 6,
          statPercent: { def: 0.11 },
          statFlat: { critRate: 4 },
          skillMultiplierBonus: null,
        },
        {
          pieces: 8,
          statPercent: null,
          statFlat: null,
          skillMultiplierBonus: 0.12,
        },
      ],
      set_dungeon_crimson: [
        {
          pieces: 2,
          statPercent: { atk: 0.12 },
          statFlat: null,
          skillMultiplierBonus: null,
        },
        {
          pieces: 4,
          statPercent: { hp: 0.18 },
          statFlat: null,
          skillMultiplierBonus: null,
        },
        {
          pieces: 6,
          statPercent: { def: 0.15 },
          statFlat: { critRate: 5 },
          skillMultiplierBonus: null,
        },
        {
          pieces: 8,
          statPercent: null,
          statFlat: null,
          skillMultiplierBonus: 0.18,
        },
      ],
    });
  });

  it('未知套装查询不伪造定义，强制查询直接报错', () => {
    expect(getEquipmentSet('missing-set')).toBeUndefined();
    expect(() => requireEquipmentSet('missing-set')).toThrow('装备套装不存在');
  });
});
