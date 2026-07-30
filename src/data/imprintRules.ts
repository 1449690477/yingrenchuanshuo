/**
 * 套装烙印规则（docs/58 §二/§三）。
 *
 * 数值口径：每日 3 胜 ≈ 7.5 晶，烙一件 6 晶 ≈ 每天 1 件；
 * 2/4/6 件套到手日 ≈ D2 / D4~5 / D8~10 —— 套装是一到两周的流派养成线，
 * 不是解锁日毕业礼包。改这里的数字必须复跑装备副本平衡与经济门禁。
 */

import type { EquipmentDungeonTierId } from './equipmentDungeonGear';

/** 可烙印的套装（当前=四个副本套）。区域套/圣痕/心虹是身份，不可烙。 */
export const IMPRINTABLE_SET_IDS = [
  'set_dungeon_azure',
  'set_dungeon_violet',
  'set_dungeon_auric',
  'set_dungeon_crimson',
] as const;

export type ImprintableSetId = (typeof IMPRINTABLE_SET_IDS)[number];

export function isImprintableSetId(setId: string): setId is ImprintableSetId {
  return (IMPRINTABLE_SET_IDS as readonly string[]).includes(setId);
}

/** 套装 ↔ 副本档位（掉对应烙印晶；首通该档任意入口解锁该套可烙） */
export const IMPRINT_SET_TIER: Readonly<Record<ImprintableSetId, EquipmentDungeonTierId>> = {
  set_dungeon_azure: 'azure',
  set_dungeon_violet: 'violet',
  set_dungeon_auric: 'auric',
  set_dungeon_crimson: 'crimson',
};

/** 各档烙印晶物品 id（图标由 codex 按 docs/58 交付到同名路径） */
export const IMPRINT_CRYSTAL_IDS: Readonly<Record<EquipmentDungeonTierId, string>> = {
  azure: 'imprint_crystal_azure',
  violet: 'imprint_crystal_violet',
  auric: 'imprint_crystal_auric',
  crimson: 'imprint_crystal_crimson',
};

/** 通用星纹核物品 id */
export const IMPRINT_CORE_ID = 'imprint_core_star';

/** 晶支付路径：烙一件 6 晶 */
export const IMPRINT_CRYSTAL_COST = 6;
/** 核支付路径：1 核 + 2 晶（核是保底产物，给坏运气兜底） */
export const IMPRINT_CORE_ALT_CRYSTALS = 2;
/** 金币成本 = 装备等级 × 该系数 */
export const IMPRINT_GOLD_PER_LEVEL = 120;
