import { CRIT_RATE_CAP } from '@/data/constants';
import { instanceStatsForClass } from './equipment';
import { addStats, combatPower } from './formula';
import { applyClassMods, baseStatsFor } from './progression';
import type { ClassId, EquipmentDef, EquipmentInstance, Stats } from './types';

/**
 * 装备评分公式版本。
 *
 * 评分只会进入可重建的派生索引；以后调整公式时提升这里，不能借此提升 SAVE_VERSION。
 *
 * v2（docs/73 批 3）：combatPower 从固定线性加权改为乘法投影（真实 DPS/EHP 几何平均），
 * 评分随之变成「真实边际战力」——同一件装备对低基础职业的相对提升更大，属预期语义。
 */
export const EQUIPMENT_SCORE_VERSION = 2;

/** 已发生的强化投入与 +0 装备底子的两套稳定评分。 */
export interface EquipmentScores {
  current: number;
  base: number;
}

/**
 * 在装备自身需求等级的职业裸属性上计算单件边际战力。
 *
 * 固定参照让评分不受玩家当前等级、好感、其余七件装备和套装激活影响；
 * 同时给攻速一个完整角色基线，避免把不带攻速的局部属性直接送入战力公式后得到 0。
 */
function scoreStats(def: EquipmentDef, classId: ClassId, itemStats: Stats): number {
  const reference = baseStatsFor(classId, def.level);
  reference.critRate = Math.min(CRIT_RATE_CAP, reference.critRate);

  const combined = addStats(reference, itemStats);
  combined.critRate = Math.min(CRIT_RATE_CAP, combined.critRate);

  return Math.max(
    0,
    combatPower(applyClassMods(classId, combined), def.level) -
      combatPower(applyClassMods(classId, reference), def.level),
  );
}

/** 当前评分：包含这件实例已经真实获得的强化等级与逐级成长。 */
export function equipmentCurrentScore(
  def: EquipmentDef,
  inst: EquipmentInstance,
  classId: ClassId,
): number {
  return scoreStats(def, classId, instanceStatsForClass(def, inst, classId));
}

/**
 * 基础评分：将同一实例规范化为 +0，保留品质、基础胚子、固定词条和随机词条。
 *
 * 不预测尚未发生的强化随机结果；已经记录在数组中的历史增幅也不会进入这项评分。
 */
export function equipmentBaseScore(
  def: EquipmentDef,
  inst: EquipmentInstance,
  classId: ClassId,
): number {
  const normalized: EquipmentInstance = { ...inst, enhance: 0 };
  return scoreStats(def, classId, instanceStatsForClass(def, normalized, classId));
}

export function equipmentScores(
  def: EquipmentDef,
  inst: EquipmentInstance,
  classId: ClassId,
): EquipmentScores {
  return {
    current: equipmentCurrentScore(def, inst, classId),
    base: equipmentBaseScore(def, inst, classId),
  };
}
