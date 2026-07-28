import type { EquipmentDef, EquipmentInstance, Stats } from './types';
import { zeroStats } from './formula';
import {
  EQUIPMENT_DUNGEON_SETS,
  type EquipmentSetBonus,
  type EquipmentSetDefinition,
} from '@/data/equipmentDungeonSets';

export interface ActiveEquipmentSet {
  definition: EquipmentSetDefinition;
  equippedPieces: number;
  activeBonuses: readonly EquipmentSetBonus[];
  nextBonus: EquipmentSetBonus | null;
}

export interface EquipmentSetResolution {
  sets: readonly ActiveEquipmentSet[];
  statPercent: Stats;
  statFlat: Stats;
  skillMultiplierBonus: number;
}

/**
 * 按当前八个穿戴槽统计套装。
 *
 * 输入只读，输出全新对象；同一槽无法重复计数，背包中的未穿戴装备不会生效。
 */
export function resolveEquipmentSetBonuses(
  equipped: readonly (EquipmentInstance | null)[],
  defOf: (defId: string) => EquipmentDef | undefined,
): EquipmentSetResolution {
  const counts = new Map<string, number>();
  for (const instance of equipped) {
    if (!instance) continue;
    const definition = defOf(instance.defId);
    if (!definition) {
      throw new Error(`[配置错误] 装备定义不存在：${instance.defId}`);
    }
    if (!definition.setId) continue;
    counts.set(definition.setId, (counts.get(definition.setId) ?? 0) + 1);
  }

  const statPercent = zeroStats();
  const statFlat = zeroStats();
  let skillMultiplierBonus = 0;
  const sets: ActiveEquipmentSet[] = [];

  for (const [setId, equippedPieces] of counts) {
    const definition = EQUIPMENT_DUNGEON_SETS[setId];
    if (!definition) {
      throw new Error(`[配置错误] 装备引用了未登记套装：${setId}`);
    }
    const activeBonuses = definition.bonuses.filter(
      (bonus) => equippedPieces >= bonus.pieces,
    );
    const nextBonus =
      definition.bonuses.find((bonus) => equippedPieces < bonus.pieces) ?? null;
    for (const bonus of activeBonuses) {
      addPartialStats(statPercent, bonus.statPercent);
      addPartialStats(statFlat, bonus.statFlat);
      skillMultiplierBonus += bonus.skillMultiplierBonus ?? 0;
    }
    sets.push({ definition, equippedPieces, activeBonuses, nextBonus });
  }

  sets.sort((left, right) => right.equippedPieces - left.equippedPieces);
  return { sets, statPercent, statFlat, skillMultiplierBonus };
}

/** 百分比先作用于原属性，再加固定值；暴击率等百分点只走固定值。 */
export function applyEquipmentSetStats(
  stats: Stats,
  resolution: EquipmentSetResolution,
): Stats {
  return {
    atk: stats.atk * (1 + resolution.statPercent.atk) + resolution.statFlat.atk,
    def: stats.def * (1 + resolution.statPercent.def) + resolution.statFlat.def,
    hp: stats.hp * (1 + resolution.statPercent.hp) + resolution.statFlat.hp,
    acc: stats.acc * (1 + resolution.statPercent.acc) + resolution.statFlat.acc,
    eva: stats.eva * (1 + resolution.statPercent.eva) + resolution.statFlat.eva,
    critRate:
      stats.critRate * (1 + resolution.statPercent.critRate) +
      resolution.statFlat.critRate,
    critDmg:
      stats.critDmg * (1 + resolution.statPercent.critDmg) +
      resolution.statFlat.critDmg,
    spd: stats.spd * (1 + resolution.statPercent.spd) + resolution.statFlat.spd,
  };
}

function addPartialStats(target: Stats, source: Partial<Stats> | undefined): void {
  if (!source) return;
  for (const key of Object.keys(target) as (keyof Stats)[]) {
    target[key] += source[key] ?? 0;
  }
}
