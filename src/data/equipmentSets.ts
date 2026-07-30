/**
 * 全游戏装备套装注册表。
 *
 * 核心结算只接收查询函数，不读取任何具体内容表；新增区域套装时只需在这里
 * 聚合其定义，所有战斗与战力入口便会使用同一份权威数据。
 *
 * 圣痕套（竞技场）是特例：它登记在总表里（件数统计、UI 展示都正常），
 * 但套装效果**只在竞技场内生效**（docs/53 §六 验收红线）。
 * 挂机 / 主线 / 试炼管线必须用 getFieldEquipmentSet —— 它给圣痕套返回
 * 剥离效果的同 id 定义；对决管线（core/duel.ts）才用 getEquipmentSet 拿全量。
 */

import type { EquipmentSetDefinition } from '@/core/equipmentSets';
import { ARENA_EQUIPMENT_SET, ARENA_SET_ID } from './arenaEquipment';
import { EQUIPMENT_DUNGEON_SETS } from './equipmentDungeonSets';
import { REGION_EQUIPMENT_SETS } from './regionEquipmentSets';

export const EQUIPMENT_SETS: Readonly<Record<string, EquipmentSetDefinition>> = {
  ...EQUIPMENT_DUNGEON_SETS,
  ...REGION_EQUIPMENT_SETS,
  [ARENA_SET_ID]: ARENA_EQUIPMENT_SET,
};

export function getEquipmentSet(id: string): EquipmentSetDefinition | undefined {
  return EQUIPMENT_SETS[id];
}

/** 圣痕套在竞技场外的空效果形态：件数照数、加成恒 0。 */
const ARENA_SET_FIELD_STUB: EquipmentSetDefinition = {
  ...ARENA_EQUIPMENT_SET,
  bonuses: [],
};

/**
 * 挂机 / 主线 / 试炼（PvE）管线专用套装查询。
 *
 * 与 getEquipmentSet 的唯一区别：圣痕套返回空效果定义 ——
 * 「套装效果在挂机 / 主线生效必须为 0」由这里结构性保证，
 * 而不是靠每个调用方自觉跳过。
 */
export function getFieldEquipmentSet(id: string): EquipmentSetDefinition | undefined {
  const definition = EQUIPMENT_SETS[id];
  if (!definition) return undefined;
  return definition.id === ARENA_SET_ID ? ARENA_SET_FIELD_STUB : definition;
}

export function requireEquipmentSet(id: string): EquipmentSetDefinition {
  const definition = getEquipmentSet(id);
  if (!definition) throw new Error(`[配置错误] 装备套装不存在：${id}`);
  return definition;
}
