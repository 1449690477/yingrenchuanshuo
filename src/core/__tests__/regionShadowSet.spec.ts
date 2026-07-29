import { describe, expect, it } from 'vitest';
import { Rng } from '../rng';
import { simulateFight } from '../combat';
import { applyEquipmentSetStats, resolveEquipmentSetBonuses } from '../equipmentSets';
import type { Combatant, EquipmentDef, EquipmentInstance, EquipSlot, Stats } from '../types';
import { getEquipmentSet } from '@/data/equipmentSets';
import {
  REGION_SHADOW_SET,
  REGION_SHADOW_SURVIVAL_TRIGGER_ID,
} from '@/data/regionEquipmentSets';

function definition(slot: EquipSlot): EquipmentDef {
  const common = {
    id: `test_shadow_${slot}`,
    name: slot,
    quality: 'legendary' as const,
    level: 62,
    icon: `${slot}.png`,
    appearanceId: `shadow-${slot}`,
    setId: REGION_SHADOW_SET.id,
  };
  return slot === 'weapon' ? { ...common, slot, element: 'ice' } : { ...common, slot };
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
  REGION_SHADOW_SET.pieceSlots.map((slot) => {
    const equipment = definition(slot);
    return [equipment.id, equipment];
  }),
) as Readonly<Record<string, EquipmentDef>>;
const pieces = REGION_SHADOW_SET.pieceSlots.map((slot) => definitions[`test_shadow_${slot}`]!);
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

function combatant(name: string, stats: Stats): Combatant {
  return { name, level: 62, element: 'none', stats, currentHp: stats.hp };
}

describe('幽影套 2 / 4 / 6 / 8 件真实结算', () => {
  it('2 件生命 +10%，4 件再获得 6% 减伤', () => {
    const two = resolveEquipmentSetBonuses(
      pieces.slice(0, 2).map(instance),
      defOf,
      getEquipmentSet,
    );
    expect(applyEquipmentSetStats(baseStats, two).hp).toBe(1_100);
    expect(two.combatBonuses.damageReduction).toBe(0);
    expect(two.onLethalTriggers).toEqual([]);

    const four = resolveEquipmentSetBonuses(
      pieces.slice(0, 4).map(instance),
      defOf,
      getEquipmentSet,
    );
    expect(four.combatBonuses.damageReduction).toBe(6);
    expect(four.onLethalTriggers).toEqual([]);
  });

  it('6 件追加攻击 +12% 与暴击伤害 +20 点', () => {
    const resolution = resolveEquipmentSetBonuses(
      pieces.slice(0, 6).map(instance),
      defOf,
      getEquipmentSet,
    );
    const stats = applyEquipmentSetStats(baseStats, resolution);
    expect(stats.atk).toBeCloseTo(112, 8);
    expect(stats.critDmg).toBe(70);
    expect(resolution.onLethalTriggers).toEqual([]);
  });

  it('8 件每场只抵消第一次致命伤并恢复 30% 最大生命，下场战斗重新计数', () => {
    const resolution = resolveEquipmentSetBonuses(pieces.map(instance), defOf, getEquipmentSet);
    expect(resolution.onLethalTriggers).toEqual([
      {
        id: REGION_SHADOW_SURVIVAL_TRIGGER_ID,
        kind: 'lethal-recovery',
        healRatio: 0.3,
        activationsPerFight: 1,
      },
    ]);

    const monsterStats: Stats = {
      ...baseStats,
      atk: 10_000,
      def: 0,
      hp: 10_000,
      acc: 10_000,
      eva: 0,
      critRate: 0,
      spd: 1,
    };
    const playerStats: Stats = {
      ...baseStats,
      atk: 1,
      def: 0,
      hp: 1_000,
      acc: 10_000,
      eva: 0,
      critRate: 0,
      spd: 0.1,
    };

    const firstPlayer = combatant('玩家', playerStats);
    const firstFight = simulateFight(firstPlayer, combatant('怪物', monsterStats), new Rng(6262), {
      maxSeconds: 0.5,
      playerOnLethalTriggers: resolution.onLethalTriggers,
    });
    expect(firstPlayer.currentHp).toBe(300);
    expect(
      firstFight.events.filter((event) => event.event.kind === 'lethal-recovery'),
    ).toHaveLength(1);

    const continuedPlayer = combatant('玩家', playerStats);
    const continuedFight = simulateFight(
      continuedPlayer,
      combatant('怪物', monsterStats),
      new Rng(6262),
      {
        maxSeconds: 1.5,
        playerOnLethalTriggers: resolution.onLethalTriggers,
      },
    );
    expect(continuedPlayer.currentHp).toBe(0);
    expect(
      continuedFight.events.filter((event) => event.event.kind === 'lethal-recovery'),
    ).toHaveLength(1);

    const nextPlayer = combatant('玩家', playerStats);
    simulateFight(nextPlayer, combatant('怪物', monsterStats), new Rng(6262), {
      maxSeconds: 0.5,
      playerOnLethalTriggers: resolution.onLethalTriggers,
    });
    expect(nextPlayer.currentHp).toBe(300);
  });
});
