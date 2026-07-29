import { describe, expect, it } from 'vitest';
import { applyEquipmentSetStats, resolveEquipmentSetBonuses } from '../equipmentSets';
import type { EquipmentDef, EquipmentInstance, EquipSlot, Stats } from '../types';
import { getEquipmentSet } from '@/data/equipmentSets';
import {
  REGION_CRIMSON_FLAMEBURST_TRIGGER_ID,
  REGION_CRIMSON_SET,
} from '@/data/regionEquipmentSets';

function definition(slot: EquipSlot): EquipmentDef {
  const common = {
    id: `test_crimson_${slot}`,
    name: slot,
    quality: 'legendary' as const,
    level: 50,
    icon: `${slot}.png`,
    appearanceId: `crimson-${slot}`,
    setId: REGION_CRIMSON_SET.id,
  };
  return slot === 'weapon' ? { ...common, slot, element: 'fire' } : { ...common, slot };
}

function instance(definition: EquipmentDef): EquipmentInstance {
  return {
    uid: `instance-${definition.slot}`,
    defId: definition.id,
    enhance: 0,
    baseRollPermille: 1000,
    enhanceGainPermille: [],
    enhanceLuck: {},
    affixes: [],
    reforgeResonance: 0,
    locked: false,
  };
}

const definitions = Object.fromEntries(
  REGION_CRIMSON_SET.pieceSlots.map((slot) => {
    const equipment = definition(slot);
    return [equipment.id, equipment];
  }),
) as Readonly<Record<string, EquipmentDef>>;

const pieces = REGION_CRIMSON_SET.pieceSlots.map((slot) => definitions[`test_crimson_${slot}`]!);
const defOf = (id: string) => definitions[id];

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

describe('绯焰套 2 / 4 / 6 件真实结算', () => {
  it('2 件只提供攻击 +8%', () => {
    const resolution = resolveEquipmentSetBonuses(
      pieces.slice(0, 2).map(instance),
      defOf,
      getEquipmentSet,
    );

    expect(applyEquipmentSetStats(baseStats, resolution).atk).toBeCloseTo(108, 8);
    expect(resolution.statFlat.critRate).toBe(0);
    expect(resolution.combatBonuses.elementDamage.fire).toBe(0);
    expect(resolution.onHitTriggers).toEqual([]);
  });

  it('4 件追加暴击率 6 点与炎伤 12 点', () => {
    const resolution = resolveEquipmentSetBonuses(
      pieces.slice(0, 4).map(instance),
      defOf,
      getEquipmentSet,
    );

    expect(applyEquipmentSetStats(baseStats, resolution).critRate).toBe(16);
    expect(resolution.combatBonuses).toEqual({
      damageReduction: 0,
      lifesteal: 0,
      elementDamage: { fire: 12, ice: 0, thunder: 0 },
    });
    expect(resolution.onHitTriggers).toEqual([]);
  });

  it('6 件追加唯一的 15% / 120% 炎爆逐击触发，不增加技能倍率', () => {
    const resolution = resolveEquipmentSetBonuses(pieces.map(instance), defOf, getEquipmentSet);

    expect(resolution.skillMultiplierBonus).toBe(0);
    expect(resolution.onHitTriggers).toEqual([
      {
        id: REGION_CRIMSON_FLAMEBURST_TRIGGER_ID,
        kind: 'elemental-damage',
        chance: 0.15,
        atkMultiplier: 1.2,
        element: 'fire',
      },
    ]);
  });
});
