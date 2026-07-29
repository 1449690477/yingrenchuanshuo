/**
 * 装备表 —— 生成器 + 人工命名。
 *
 * 每个区域为 8 个槽位各生成若干品质档的装备。
 * 基础属性**不在这里填** —— 由 core/equipment.ts 按
 * 「等级 × 品质 × 部位权重」算出（见 docs/12）。
 *
 * 这里只负责：名字、等级、品质、槽位、图标。
 */

import type {
  AffixKey,
  Element,
  EquipmentDef,
  EquipSlot,
  FixedAffix,
  Quality,
} from '@/core/types';
import { QUALITY_AFFIX_COUNT, SLOT_ORDER } from './constants';
import { AFFECTION_EQUIPMENT_LIST } from './affectionEquipment';
import { BOUTIQUE_THEME_LIST, boutiqueAppearanceId, boutiqueEquipmentId } from './boutique';
import { EQUIPMENT_DUNGEON_GEAR_LIST } from './equipmentDungeonGear';
import { REGION_34_EQUIPMENT_THEMES } from './region34';
import { BOUTIQUE_WEAPON_ELEMENTS, REGION_WEAPON_ELEMENTS } from './weaponElements';

/** 每个区域一套命名主题：8 个槽位各一个词根 */
interface NamingTheme {
  regionId: string;
  /** 装备等级基准 */
  level: number;
  /** 本区域武器的基础攻击属性；必须显式填写，禁止由词条反推。 */
  weaponElement: Element;
  /** 该区域产出的品质档 */
  qualities: Quality[];
  /** 同区域同部位共用基础图，品质由 UI 边框和光效表达 */
  icons: Record<EquipSlot, string>;
  names: Record<EquipSlot, string>;
}

const THEMES: NamingTheme[] = [
  {
    regionId: 'r1',
    // 白装 Lv2 即可穿，和 docs/14 的「Lv2 解锁装备穿戴」一致。
    level: 4,
    weaponElement: REGION_WEAPON_ELEMENTS.r1,
    qualities: ['common', 'fine', 'rare'],
    icons: {
      weapon: 'assets/equipment/r1/weapon.png',
      head: 'assets/equipment/r1/head.png',
      body: 'assets/equipment/r1/body.png',
      necklace: 'assets/equipment/r1/necklace.png',
      bracelet: 'assets/equipment/r1/bracelet.png',
      ring: 'assets/equipment/r1/ring.png',
      belt: 'assets/equipment/r1/belt.png',
      shoes: 'assets/equipment/r1/shoes.png',
    },
    names: {
      weapon: '樱枝短剑',
      head: '花冠',
      body: '樱色连衣裙',
      necklace: '花瓣项链',
      bracelet: '藤编手环',
      ring: '木铃戒',
      belt: '缎带腰封',
      shoes: '软草便鞋',
    },
  },
  {
    regionId: 'r2',
    level: 16,
    weaponElement: REGION_WEAPON_ELEMENTS.r2,
    qualities: ['fine', 'rare', 'epic'],
    icons: {
      weapon: 'assets/equipment/r2/weapon.png',
      head: 'assets/equipment/r2/head.png',
      body: 'assets/equipment/r2/body.png',
      necklace: 'assets/equipment/r2/necklace.png',
      bracelet: 'assets/equipment/r2/bracelet.png',
      ring: 'assets/equipment/r2/ring.png',
      belt: 'assets/equipment/r2/belt.png',
      shoes: 'assets/equipment/r2/shoes.png',
    },
    names: {
      weapon: '棉花糖锤',
      head: '稻草帽',
      body: '蜜蜂纹罩裙',
      necklace: '蜜滴吊坠',
      bracelet: '蜂蜡护腕',
      ring: '结晶戒',
      belt: '草编腰带',
      shoes: '蓬松绒靴',
    },
  },

  // 区域 3/4：主题与可见名称登记在 region34.ts，此处只补等级与品质档。
  // 品质上限停在史诗，传说留给区域 5 的第一个套装区，
  // 提前放开会让后面的区域没有东西可给（见 docs/44 品质开放节奏）。
  ...REGION_34_EQUIPMENT_THEMES.map((theme) => ({
    regionId: theme.regionId,
    level: theme.regionId === 'r3' ? 26 : 36,
    weaponElement: REGION_WEAPON_ELEMENTS[theme.regionId],
    qualities: ['fine', 'rare', 'epic'] as Quality[],
    icons: Object.fromEntries(
      SLOT_ORDER.map((slot) => [slot, `assets/equipment/${theme.regionId}/${slot}.png`]),
    ) as Record<EquipSlot, string>,
    names: theme.names,
  })),
];

/** 品质前缀，让同名装备在背包里能区分开 */
const QUALITY_PREFIX: Record<Quality, string> = {
  common: '',
  fine: '精制·',
  rare: '秘银·',
  epic: '灵纹·',
  legendary: '传世·',
  mythic: '神话·',
  prismatic: '心虹·',
  divine: '圣痕·',
};

/** 不同品质的等级偏移：高品质装备需求等级略高 */
const QUALITY_LEVEL_OFFSET: Record<Quality, number> = {
  common: -2,
  fine: 0,
  rare: 2,
  epic: 4,
  legendary: 6,
  mythic: 8,
  prismatic: 9,
  divine: 10,
};

function buildEquipment(): Record<string, EquipmentDef> {
  const out: Record<string, EquipmentDef> = {};

  for (const theme of THEMES) {
    for (const slot of SLOT_ORDER) {
      for (const quality of theme.qualities) {
        const id = `eq_${theme.regionId}_${slot}_${quality}`;
        const common = {
          id,
          name: QUALITY_PREFIX[quality] + theme.names[slot],
          quality,
          level: Math.max(1, theme.level + QUALITY_LEVEL_OFFSET[quality]),
          icon: theme.icons[slot],
          appearanceId: `${theme.regionId}-${slot}`,
        };
        out[id] =
          slot === 'weapon'
            ? { ...common, slot, element: theme.weaponElement }
            : { ...common, slot };
      }
    }
  }

  for (const theme of BOUTIQUE_THEME_LIST) {
    const percentile = theme.quality === 'epic' ? 0.6 : theme.quality === 'legendary' ? 0.75 : 0.9;
    for (const item of theme.items) {
      const id = boutiqueEquipmentId(theme.id, item.slot, item.classId);
      const iconName = item.classId ? `${item.slot}-${item.classId}.png` : `${item.slot}.png`;
      const common = {
        id,
        name: item.name,
        quality: theme.quality,
        level: theme.level,
        icon: `assets/equipment/shop/${theme.id}/${iconName}`,
        appearanceId: boutiqueAppearanceId(theme.id, item.slot, item.classId),
        fixedAffixes: boutiqueAffixes(
          item.slot,
          theme.level,
          QUALITY_AFFIX_COUNT[theme.quality],
          percentile,
        ),
        fixedTemplate: true,
        uniqueEffect: item.uniqueEffect,
        boutiqueTheme: theme.id,
        ...(item.classId ? { classId: item.classId } : {}),
      };
      out[id] =
        item.slot === 'weapon'
          ? { ...common, slot: item.slot, element: BOUTIQUE_WEAPON_ELEMENTS[theme.id] }
          : { ...common, slot: item.slot };
    }
  }

  for (const definition of EQUIPMENT_DUNGEON_GEAR_LIST) {
    if (out[definition.id]) {
      throw new Error(`[配置错误] 装备 ID 重复：${definition.id}`);
    }
    out[definition.id] = definition;
  }

  for (const entry of AFFECTION_EQUIPMENT_LIST) {
    const definition = entry.definition;
    if (out[definition.id]) {
      throw new Error(`[配置错误] 装备 ID 重复：${definition.id}`);
    }
    out[definition.id] = definition;
  }

  return out;
}

const BOUTIQUE_AFFIX_KEYS: Readonly<Record<EquipSlot, readonly AffixKey[]>> = {
  weapon: ['atk', 'critRate', 'critDmg', 'acc', 'spd', 'hp'],
  head: ['def', 'hp', 'acc', 'critRate', 'eva', 'critDmg'],
  body: ['def', 'hp', 'eva', 'acc', 'critRate', 'critDmg'],
  necklace: ['atk', 'critDmg', 'hp', 'critRate', 'acc', 'eva'],
  bracelet: ['atk', 'acc', 'def', 'critRate', 'hp', 'eva'],
  ring: ['atk', 'critRate', 'critDmg', 'acc', 'eva', 'hp'],
  belt: ['def', 'hp', 'eva', 'acc', 'critRate', 'critDmg'],
  shoes: ['eva', 'spd', 'def', 'hp', 'acc', 'critRate'],
};

/** 商店珍品用固定高档词条，掉落与购买获得的同款战力完全一致。 */
function boutiqueAffixes(
  slot: EquipSlot,
  level: number,
  count: number,
  percentile: number,
): FixedAffix[] {
  return BOUTIQUE_AFFIX_KEYS[slot]
    .slice(0, count)
    .map((key) => ({ key, value: boutiqueAffixValue(key, level, percentile) }));
}

function boutiqueAffixValue(key: AffixKey, level: number, percentile: number): number {
  const levelScale = Math.pow(level, 1.3);
  switch (key) {
    case 'atk':
      return Math.round((0.4 + 0.4 * percentile) * levelScale);
    case 'def':
      return Math.round((0.3 + 0.3 * percentile) * levelScale);
    case 'hp':
      return Math.round((4 + 4 * percentile) * levelScale);
    case 'acc':
      return Math.round((0.5 + 0.7 * percentile) * levelScale);
    case 'eva':
      return Math.round((0.4 + 0.6 * percentile) * levelScale);
    case 'critRate':
      return Math.round((0.5 + 2.5 * percentile) * 10) / 10;
    case 'critDmg':
      return Math.round((2 + 10 * percentile) * 10) / 10;
    case 'spd':
      return Math.round((0.01 + 0.04 * percentile) * 100) / 100;
    default:
      throw new Error(`[配置错误] 精品商店不支持固定词条：${key}`);
  }
}

export const EQUIPMENT: Record<string, EquipmentDef> = buildEquipment();

export function getEquipment(id: string): EquipmentDef | undefined {
  return EQUIPMENT[id];
}

export function requireEquipment(id: string): EquipmentDef {
  const equipment = EQUIPMENT[id];
  if (!equipment) throw new Error(`[配置错误] 装备定义不存在：${id}`);
  return equipment;
}

/** 某区域某品质的全部装备 id，掉落表生成时用 */
export function equipIdsOf(regionId: string, quality: Quality): string[] {
  return SLOT_ORDER.map((slot) => `eq_${regionId}_${slot}_${quality}`).filter(
    (id) => id in EQUIPMENT,
  );
}

/** 某区域产出的全部装备 id */
export function equipIdsOfRegion(regionId: string): string[] {
  return Object.keys(EQUIPMENT).filter((id) => id.startsWith(`eq_${regionId}_`));
}
