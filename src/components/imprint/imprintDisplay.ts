/**
 * 烙印材料的 UI 展示表（docs/58 §3.1）。
 *
 * 材料物品本体要等激活批次才注册进 data/items.ts（claude 侧），
 * 在那之前 UI 只能拿到物品 id —— 名称与图标路径由本表提供。
 * id 定死在 data/imprintRules.ts，图标由 codex 交付到同名路径，
 * 两边都不许改名（claude 17:58 频道口径）。
 */

import type { EquipmentDungeonTierId } from '@/data/equipmentDungeonGear';
import { IMPRINT_CORE_ID, IMPRINT_CRYSTAL_IDS } from '@/data/imprintRules';

export interface ImprintMaterialDisplay {
  id: string;
  name: string;
}

/** 各档烙印晶展示名（与 docs/58 §3.1 材料表逐字一致） */
export const IMPRINT_CRYSTAL_DISPLAY: Readonly<Record<EquipmentDungeonTierId, ImprintMaterialDisplay>> = {
  azure: { id: IMPRINT_CRYSTAL_IDS.azure, name: '苍蓝烙印晶' },
  violet: { id: IMPRINT_CRYSTAL_IDS.violet, name: '绛紫烙印晶' },
  auric: { id: IMPRINT_CRYSTAL_IDS.auric, name: '辉金烙印晶' },
  crimson: { id: IMPRINT_CRYSTAL_IDS.crimson, name: '赤红烙印晶' },
};

/** 通用星纹核（全档稀有掉落，坏运气兜底） */
export const IMPRINT_CORE_DISPLAY: ImprintMaterialDisplay = {
  id: IMPRINT_CORE_ID,
  name: '星纹核',
};

/** 材料图标 URL；codex 的正式图标落地前 404 由调用方兜底（MaterialChip 已处理） */
export function imprintMaterialIconUrl(itemId: string): string {
  return `${import.meta.env.BASE_URL}assets/items/${itemId}.png`;
}
