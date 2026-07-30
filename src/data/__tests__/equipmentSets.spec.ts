import { describe, expect, it } from 'vitest';
import { EQUIPMENT_DUNGEON_SETS } from '../equipmentDungeonSets';
import { EQUIPMENT_SETS, getEquipmentSet, requireEquipmentSet } from '../equipmentSets';
import {
  REGION_CRIMSON_FLAMEBURST_TRIGGER_ID,
  REGION_BLOODMOON_SET,
  REGION_BLOODMOON_SET_ID,
  REGION_CRIMSON_SET,
  REGION_CRIMSON_SET_ID,
  REGION_SHADOW_SET,
  REGION_SHADOW_SET_ID,
} from '../regionEquipmentSets';
import { ARENA_EQUIPMENT_SET, ARENA_SET_ID } from '../arenaEquipment';

describe('通用装备套装注册表', () => {
  it('完整聚合现有四套副本套装、区域套装与圣痕套，且保持同一权威定义', () => {
    expect(Object.keys(EQUIPMENT_SETS)).toEqual([
      'set_dungeon_azure',
      'set_dungeon_violet',
      'set_dungeon_auric',
      'set_dungeon_crimson',
      REGION_CRIMSON_SET_ID,
      REGION_SHADOW_SET_ID,
      REGION_BLOODMOON_SET_ID,
      ARENA_SET_ID,
    ]);
    for (const [id, definition] of Object.entries(EQUIPMENT_DUNGEON_SETS)) {
      expect(getEquipmentSet(id)).toBe(definition);
    }
    expect(getEquipmentSet(REGION_CRIMSON_SET_ID)).toBe(REGION_CRIMSON_SET);
    expect(getEquipmentSet(REGION_SHADOW_SET_ID)).toBe(REGION_SHADOW_SET);
    expect(getEquipmentSet(REGION_BLOODMOON_SET_ID)).toBe(REGION_BLOODMOON_SET);
    expect(getEquipmentSet(ARENA_SET_ID)).toBe(ARENA_EQUIPMENT_SET);
  });

  it('血月八件只展示静态称号徽记，不注册任何战斗字段', () => {
    expect(REGION_BLOODMOON_SET.bonuses).toEqual([
      expect.objectContaining({ pieces: 2, statPercent: { atk: 0.1 } }),
      expect.objectContaining({ pieces: 4, statFlat: { critRate: 8 } }),
      expect.objectContaining({ pieces: 6, skillMultiplierBonus: 0.18 }),
      {
        pieces: 8,
        label: '血月的眷属',
        description: '解锁同名称号与血月徽记外观（无战斗属性）',
      },
    ]);
    expect(REGION_BLOODMOON_SET.bonuses[3]).not.toHaveProperty('statPercent');
    expect(REGION_BLOODMOON_SET.bonuses[3]).not.toHaveProperty('statFlat');
    expect(REGION_BLOODMOON_SET.bonuses[3]).not.toHaveProperty('skillMultiplierBonus');
    expect(REGION_BLOODMOON_SET.bonuses[3]).not.toHaveProperty('onCritTriggers');
  });

  it('锁住现有四套的全部结算数值', () => {
    const numericContract = Object.fromEntries(
      Object.entries(EQUIPMENT_DUNGEON_SETS).map(([id, definition]) => [
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

  it('锁住绯焰六槽与 2 / 4 / 6 件真实结算，不伪装为技能倍率', () => {
    expect(REGION_CRIMSON_SET.pieceSlots).toEqual([
      'weapon',
      'head',
      'body',
      'necklace',
      'ring',
      'bracelet',
    ]);
    expect(REGION_CRIMSON_SET.bonuses).toEqual([
      {
        pieces: 2,
        label: '赤金火纹',
        description: '攻击 +8%',
        statPercent: { atk: 0.08 },
      },
      {
        pieces: 4,
        label: '祭火誓约',
        description: '暴击率 +6%，炎属性伤害 +12%',
        statFlat: { critRate: 6 },
        combatBonuses: { elementDamage: { fire: 12 } },
      },
      {
        pieces: 6,
        label: '绯焰',
        description: '每次直接命中有 15% 概率追加 120% 攻击力的炎爆伤害',
        onHitTriggers: [
          {
            id: REGION_CRIMSON_FLAMEBURST_TRIGGER_ID,
            kind: 'elemental-damage',
            chance: 0.15,
            atkMultiplier: 1.2,
            element: 'fire',
          },
        ],
      },
    ]);
    expect(REGION_CRIMSON_SET.bonuses.every((bonus) => !bonus.skillMultiplierBonus)).toBe(true);
  });

  it('未知套装查询不伪造定义，强制查询直接报错', () => {
    expect(getEquipmentSet('missing-set')).toBeUndefined();
    expect(() => requireEquipmentSet('missing-set')).toThrow('装备套装不存在');
  });
});
