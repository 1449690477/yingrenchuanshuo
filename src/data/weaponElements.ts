import type { BoutiqueThemeId, Element } from '@/core/types';
import type { EquipmentDungeonTierId } from './equipmentDungeonGear';

/**
 * 区域主题武器的基础攻击属性。
 *
 * 区域 2 在 2-5 首次教学冰系怪物，区域 2/3 的炎武器提供可追溯的克制来源；
 * 区域 1/4 暂无属性玩法依据，必须显式登记为 none，不能由词条反推。
 */
export const REGION_WEAPON_ELEMENTS = {
  r1: 'none',
  r2: 'fire',
  r3: 'fire',
  r4: 'none',
  r5: 'fire',
} as const satisfies Readonly<Record<string, Element>>;

/**
 * 精品武器补齐三系可追溯来源：莓果炎、月糖冰、蔷薇雷。
 * 纸箱键帽套保留无属性，避免所有精品都被强行塞进元素流派。
 */
export const BOUTIQUE_WEAPON_ELEMENTS = {
  'berry-cream': 'fire',
  'moon-sugar': 'ice',
  'rose-night': 'thunder',
  'cardboard-cat': 'none',
} as const satisfies Readonly<Record<BoutiqueThemeId, Element>>;

/** 装备副本按色彩主题提供中后期三系接续，元素仍只来自武器静态定义。 */
export const EQUIPMENT_DUNGEON_WEAPON_ELEMENTS = {
  azure: 'ice',
  violet: 'thunder',
  auric: 'fire',
  crimson: 'thunder',
} as const satisfies Readonly<Record<EquipmentDungeonTierId, Element>>;

/** 武器详情统一使用这份玩家可读标签，避免各界面各自解释同一元素。 */
export const WEAPON_ELEMENT_LABELS = {
  none: '无属性武器',
  fire: '炎属性武器',
  ice: '冰属性武器',
  thunder: '雷属性武器',
} as const satisfies Readonly<Record<Element, string>>;
