import type { EquipmentDef, EquipmentInstance } from './types';
import { DECOMPOSE_GOLD_PER_LEVEL, QUALITY_MUL } from '@/data/constants';

/**
 * 装备分解价值。
 *
 * 品质必须参与回收价，否则同等级白装和神话装备价值相同，
 * 玩家会感觉高品质掉落只是换了边框。
 */
export function decomposeGold(def: EquipmentDef, instance: EquipmentInstance): number {
  if (instance.defId !== def.id) {
    throw new Error(`decomposeGold: 实例 ${instance.uid} 与定义 ${def.id} 不匹配`);
  }
  return Math.round(
    def.level * DECOMPOSE_GOLD_PER_LEVEL * QUALITY_MUL[def.quality] * (1 + instance.enhance),
  );
}
