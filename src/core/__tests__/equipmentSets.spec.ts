import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import type { EquipmentDef, EquipmentInstance, Stats } from '../types';
import {
  applyEquipmentSetStats,
  resolveEquipmentSetBonuses,
  type EquipmentSetDefinition,
} from '../equipmentSets';

function instance(defId: string, uid: string): EquipmentInstance {
  return {
    uid,
    defId,
    enhance: 0,
    baseRollPermille: 1000,
    enhanceGainPermille: [],
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

const ALL_SLOTS = [
  'weapon',
  'head',
  'body',
  'necklace',
  'bracelet',
  'ring',
  'belt',
  'shoes',
] as const;

const TEST_SETS: Readonly<Record<string, EquipmentSetDefinition>> = {
  set_alpha: {
    id: 'set_alpha',
    name: '测试甲套',
    pieceSlots: ALL_SLOTS,
    bonuses: [
      {
        pieces: 2,
        label: '甲二件',
        description: '攻击 +10%',
        statPercent: { atk: 0.1 },
      },
      {
        pieces: 4,
        label: '甲四件',
        description: '生命 +20%',
        statPercent: { hp: 0.2 },
        combatBonuses: { elementDamage: { fire: 5 } },
      },
      {
        pieces: 6,
        label: '甲六件',
        description: '防御 +15%，暴击率 +3%',
        statPercent: { def: 0.15 },
        statFlat: { critRate: 3 },
        onHitTriggers: [
          {
            id: 'set_alpha:burst',
            kind: 'elemental-damage',
            chance: 0.25,
            atkMultiplier: 1.1,
            element: 'fire',
          },
        ],
      },
      {
        pieces: 8,
        label: '甲八件',
        description: '平均技能倍率 +0.12',
        skillMultiplierBonus: 0.12,
      },
    ],
  },
  set_beta: {
    id: 'set_beta',
    name: '测试乙套',
    pieceSlots: ALL_SLOTS,
    bonuses: [
      {
        pieces: 2,
        label: '乙二件',
        description: '生命 +8%',
        statPercent: { hp: 0.08 },
      },
    ],
  },
};

const EQUIPMENT_DEFS: Readonly<Record<string, EquipmentDef>> = Object.fromEntries([
  ...Array.from({ length: 8 }, (_, index) => [
    `alpha_${index}`,
    equipmentDef(`alpha_${index}`, 'set_alpha'),
  ]),
  ...Array.from({ length: 2 }, (_, index) => [
    `beta_${index}`,
    equipmentDef(`beta_${index}`, 'set_beta'),
  ]),
]);

function equipmentDef(id: string, setId: string): EquipmentDef {
  return {
    id,
    name: id,
    slot: 'ring',
    quality: 'rare',
    level: 1,
    icon: `${id}.png`,
    appearanceId: id,
    setId,
  };
}

const equipmentDefOf = (id: string): EquipmentDef | undefined => EQUIPMENT_DEFS[id];
const setDefOf = (id: string): EquipmentSetDefinition | undefined => TEST_SETS[id];

describe('通用装备套装共鸣', () => {
  it('只统计已穿戴件，按 2/4/6/8 件逐档激活', () => {
    const ids = Array.from({ length: 8 }, (_, index) => `alpha_${index}`);

    const four = resolveEquipmentSetBonuses(
      ids.slice(0, 4).map((id, index) => instance(id, `e${index + 1}`)),
      equipmentDefOf,
      setDefOf,
    );
    expect(four.sets[0]).toMatchObject({
      equippedPieces: 4,
      activeBonuses: [{ pieces: 2 }, { pieces: 4 }],
      nextBonus: { pieces: 6 },
    });
    expect(four.statPercent).toMatchObject({ atk: 0.1, hp: 0.2, def: 0 });
    expect(four.combatBonuses.elementDamage.fire).toBe(5);
    expect(four.onHitTriggers).toEqual([]);
    expect(four.skillMultiplierBonus).toBe(0);

    const eight = resolveEquipmentSetBonuses(
      ids.map((id, index) => instance(id, `e${index + 1}`)),
      equipmentDefOf,
      setDefOf,
    );
    expect(eight.sets[0]?.activeBonuses).toHaveLength(4);
    expect(eight.sets[0]?.nextBonus).toBeNull();
    expect(eight.statPercent).toMatchObject({ atk: 0.1, hp: 0.2, def: 0.15 });
    expect(eight.statFlat.critRate).toBe(3);
    expect(eight.combatBonuses).toEqual({
      damageReduction: 0,
      lifesteal: 0,
      elementDamage: { fire: 5, ice: 0, thunder: 0 },
    });
    expect(eight.onHitTriggers).toEqual([
      {
        id: 'set_alpha:burst',
        kind: 'elemental-damage',
        chance: 0.25,
        atkMultiplier: 1.1,
        element: 'fire',
      },
    ]);
    expect(eight.skillMultiplierBonus).toBe(0.12);
  });

  it('两个不同 setId 混穿时分别计数并独立激活', () => {
    const resolution = resolveEquipmentSetBonuses(
      [
        instance('alpha_0', 'e1'),
        instance('beta_0', 'e2'),
        instance('alpha_1', 'e3'),
        instance('beta_1', 'e4'),
      ],
      equipmentDefOf,
      setDefOf,
    );

    expect(resolution.sets).toHaveLength(2);
    expect(
      resolution.sets.map((set) => ({
        id: set.definition.id,
        pieces: set.equippedPieces,
        active: set.activeBonuses.map((bonus) => bonus.pieces),
      })),
    ).toEqual([
      { id: 'set_alpha', pieces: 2, active: [2] },
      { id: 'set_beta', pieces: 2, active: [2] },
    ]);
    expect(resolution.statPercent).toMatchObject({ atk: 0.1, hp: 0.08 });
  });

  it('百分比与固定值按明确顺序改变最终属性，输入不被修改', () => {
    const original = { ...baseStats };
    const resolution = resolveEquipmentSetBonuses(
      Array.from({ length: 6 }, (_, index) => instance(`alpha_${index}`, `e${index + 1}`)),
      equipmentDefOf,
      setDefOf,
    );

    const result = applyEquipmentSetStats(baseStats, resolution);
    expect(result).toMatchObject({
      hp: 1_200,
      critRate: 13,
      acc: 100,
      eva: 50,
      critDmg: 50,
      spd: 1,
    });
    expect(result.atk).toBeCloseTo(110);
    expect(result.def).toBeCloseTo(92);
    expect(baseStats).toEqual(original);
  });

  it('缺失装备定义或套装登记时直接报错，不用兜底掩盖配置错误', () => {
    expect(() =>
      resolveEquipmentSetBonuses([instance('missing', 'e1')], () => undefined, setDefOf),
    ).toThrow('装备定义不存在');

    const unknownSetDef = equipmentDef('bad', 'missing-set');
    expect(() =>
      resolveEquipmentSetBonuses(
        [instance('bad', 'e1')],
        () => unknownSetDef,
        () => undefined,
      ),
    ).toThrow('未登记套装');
  });

  it('套装部位与逐击触发配置非法时直接报错', () => {
    const limitedSet: EquipmentSetDefinition = {
      id: 'set_limited',
      name: '双槽套装',
      pieceSlots: ['weapon', 'head'],
      bonuses: [
        {
          pieces: 2,
          label: '非法触发',
          description: '测试',
          onHitTriggers: [
            {
              id: 'bad-trigger',
              kind: 'elemental-damage',
              chance: 1.01,
              atkMultiplier: 1,
              element: 'fire',
            },
          ],
        },
      ],
    };
    const disallowed = equipmentDef('limited_ring', 'set_limited');
    expect(() =>
      resolveEquipmentSetBonuses(
        [instance(disallowed.id, 'e1')],
        () => disallowed,
        () => limitedSet,
      ),
    ).toThrow('不包含部位');

    const allowed = { ...disallowed, slot: 'weapon', element: 'fire' } as EquipmentDef;
    expect(() =>
      resolveEquipmentSetBonuses(
        [instance(allowed.id, 'e1'), instance(allowed.id, 'e2')],
        () => allowed,
        () => limitedSet,
      ),
    ).toThrow('触发概率');
  });

  it('核心实现不依赖任何具体 data 表', () => {
    const source = readFileSync(resolve('src/core/equipmentSets.ts'), 'utf8');
    expect(source).not.toMatch(/from\s+['"](?:@\/data\/|\.\.\/data\/)/);
  });
});
