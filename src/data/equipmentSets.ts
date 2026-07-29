/**
 * 全游戏装备套装注册表。
 *
 * 核心结算只接收查询函数，不读取任何具体内容表；新增区域套装时只需在这里
 * 聚合其定义，所有战斗与战力入口便会使用同一份权威数据。
 */

import type { EquipmentSetDefinition } from '@/core/equipmentSets';
import { EQUIPMENT_DUNGEON_SETS } from './equipmentDungeonSets';
import { REGION_EQUIPMENT_SETS } from './regionEquipmentSets';

export const EQUIPMENT_SETS: Readonly<Record<string, EquipmentSetDefinition>> = {
  ...EQUIPMENT_DUNGEON_SETS,
  ...REGION_EQUIPMENT_SETS,
};

export function getEquipmentSet(id: string): EquipmentSetDefinition | undefined {
  return EQUIPMENT_SETS[id];
}

export function requireEquipmentSet(id: string): EquipmentSetDefinition {
  const definition = getEquipmentSet(id);
  if (!definition) throw new Error(`[配置错误] 装备套装不存在：${id}`);
  return definition;
}
