/**
 * 区域 7「血月峡谷」的原子内容清单。
 *
 * docs/59 是本批权威修订层：五章三十关、二十四只怪物、两档普通装备与
 * 八件血月套必须同批启用。旧 docs/44 的八件战斗效果已经删除，满套只展示
 * 称号与徽记，不把强度折回六件效果。
 */

import type { ClassId, EquipSlot, Quality } from '@/core/types';
import type { MonsterMotionProfile } from './battleMotions';
import type { RegionSpec } from './regions';

export type Region7MaterialTier = 'common' | 'fine' | 'rare';

export interface Region7MaterialSpec {
  id: string;
  name: string;
  kind: 'material' | 'fragment';
  tier: Region7MaterialTier;
  sellPrice: number;
  source: 'normal' | 'elite' | 'boss' | 'set-special';
  desc: string;
  pityCount?: number;
}

export const REGION_7_MATERIALS: readonly Region7MaterialSpec[] = [
  {
    id: 'dew_bloodmist',
    name: '血雾凝露',
    kind: 'material',
    tier: 'common',
    sellPrice: 34,
    source: 'normal',
    desc: '沼泽上的红雾凝成的水珠。',
  },
  {
    id: 'herb_soulbreak',
    name: '断魂草',
    kind: 'material',
    tier: 'common',
    sellPrice: 32,
    source: 'normal',
    desc: '长在崖边，闻久了会走神。',
  },
  {
    id: 'horn_demon',
    name: '恶魔之角',
    kind: 'material',
    tier: 'fine',
    sellPrice: 175,
    source: 'elite',
    desc: '小恶魔娘换牙一样会自然脱落。',
  },
  {
    id: 'eye_bloodmoon',
    name: '血月之瞳',
    kind: 'material',
    tier: 'rare',
    sellPrice: 1_600,
    source: 'boss',
    pityCount: 12,
    desc: '望进去能看见另一个月亮。',
  },
  {
    id: 'frag_bloodmoon',
    name: '血月碎片',
    kind: 'fragment',
    tier: 'rare',
    sellPrice: 1_300,
    source: 'set-special',
    desc: '血月套的残片，边缘会随月相改变。',
  },
] as const;

export const REGION_7: RegionSpec = {
  id: 'r7',
  index: 7,
  name: '血月峡谷',
  subtitle: '赤月照着雾海，也照亮峡谷尽头的祭台',
  levelFrom: 65,
  levelTo: 78,
  theme: ['#8e263f', '#e86f8e'],
  mapAsset: 'assets/maps/r7.webp',
  chapters: [
    {
      id: '7-1',
      name: '峡谷入口',
      levelFrom: 65,
      levelTo: 68,
      element: 'fire',
      normals: ['血月绒蝠', '峡谷灯笼鬼', '赤晶角兔', '雾行小恶魔'],
      materials: ['dew_bloodmist', 'herb_soulbreak'],
      tutorial: '血月峡谷的敌人偏炎属性；新区雷属性武器能够克制它们。',
      mapAsset: 'assets/maps/chapter-7-1.webp',
      battleAsset: 'assets/battlefields/chapter-7-1.webp',
    },
    {
      id: '7-2',
      name: '血雾沼泽',
      levelFrom: 68,
      levelTo: 70,
      element: 'fire',
      normals: ['血沼软泥怪', '绯雾魅灵', '沼泽魔蕈娘', '血苔团子'],
      elite: '血雾魔女',
      materials: ['dew_bloodmist', 'herb_soulbreak', 'horn_demon'],
      mapAsset: 'assets/maps/chapter-7-2.webp',
      battleAsset: 'assets/battlefields/chapter-7-2.webp',
    },
    {
      id: '7-3',
      name: '断魂崖',
      levelFrom: 70,
      levelTo: 73,
      element: 'fire',
      normals: ['断魂崖鸦', '赤藤攀行者', '崖风魅影', '魂灯角兽'],
      materials: ['dew_bloodmist', 'herb_soulbreak'],
      mapAsset: 'assets/maps/chapter-7-3.webp',
      battleAsset: 'assets/battlefields/chapter-7-3.webp',
    },
    {
      id: '7-4',
      name: '恶魔集会所',
      levelFrom: 73,
      levelTo: 76,
      element: 'fire',
      normals: ['恶魔侍童', '月痕石像鬼', '红缎魅灵', '三叉戟小鬼'],
      elite: '小恶魔娘三姐妹',
      materials: ['dew_bloodmist', 'herb_soulbreak', 'horn_demon'],
      mapAsset: 'assets/maps/chapter-7-4.webp',
      battleAsset: 'assets/battlefields/chapter-7-4.webp',
    },
    {
      id: '7-5',
      name: '血月祭台',
      levelFrom: 76,
      levelTo: 78,
      element: 'fire',
      normals: ['血月祭司', '猩红祷灵', '月蚀守卫', '莉莉姆近侍'],
      elite: '血月大祭司',
      boss: '血月恶魔·莉莉姆',
      materials: ['dew_bloodmist', 'herb_soulbreak', 'horn_demon', 'eye_bloodmoon'],
      mapAsset: 'assets/maps/chapter-7-5.webp',
      battleAsset: 'assets/battlefields/chapter-7-5.webp',
    },
  ],
};

export interface Region7EquipmentThemeSpec {
  regionId: 'r7';
  themeName: string;
  level: number;
  qualities: readonly Quality[];
  visualKeywords: readonly string[];
  names: Readonly<Record<EquipSlot, string>>;
  weaponNames: Readonly<Record<ClassId, string>>;
}

export const REGION_7_EQUIPMENT_THEME: Region7EquipmentThemeSpec = {
  regionId: 'r7',
  themeName: '血月峡谷系',
  level: 69,
  qualities: ['epic', 'legendary'],
  visualKeywords: ['血红', '玄黑', '银白月纹', '恶魔角'],
  names: {
    weapon: '血月断魂刃',
    head: '赤角月冠',
    body: '绯雾峡谷礼装',
    necklace: '血雾凝露坠',
    bracelet: '恶魔角镯',
    ring: '月蚀誓戒',
    belt: '玄红束魂带',
    shoes: '断崖夜行靴',
  },
  weaponNames: {
    swordsman: '血月断魂剑',
    witch: '月蚀绯星杖',
    shaman: '赤雾引魂扇',
    catkin: '血月裂魂双爪',
  },
};

export const REGION_7_SET_ID = 'set_region_bloodmoon';
export const REGION_7_FRAGMENT_ID = 'frag_bloodmoon';
/** docs/59：成本照 R6 现行参数，不采用旧 docs/44 的 70 碎片。 */
export const REGION_7_FRAGMENT_COST = 55;
export const REGION_7_SET_LEVEL = 76;
export const REGION_7_SET_QUALITY = 'legendary' satisfies Quality;
export const REGION_7_SET_SLOTS = [
  'weapon',
  'head',
  'body',
  'necklace',
  'bracelet',
  'ring',
  'belt',
  'shoes',
] as const satisfies readonly EquipSlot[];

export const REGION_7_SET_NAMES: Readonly<Record<(typeof REGION_7_SET_SLOTS)[number], string>> = {
  weapon: '莉莉姆月蚀刃',
  head: '血月眷属冠',
  body: '莉莉姆深红礼装',
  necklace: '月瞳魂坠',
  bracelet: '恶魔誓镯',
  ring: '月蚀血戒',
  belt: '深红束魂带',
  shoes: '绯雾踏月靴',
};

export const REGION_7_SET_WEAPON_NAMES: Readonly<Record<ClassId, string>> = {
  swordsman: '莉莉姆月蚀剑',
  witch: '莉莉姆血星杖',
  shaman: '莉莉姆唤月扇',
  catkin: '莉莉姆绯月双爪',
};

export const REGION_7_COMPLETION_TITLE = '血月的眷属';
export const REGION_7_COMPLETION_BADGE = 'assets/equipment/sets/r7-bloodmoon/badge.png';

export function region7SetEquipmentId(slot: (typeof REGION_7_SET_SLOTS)[number]): string {
  return `eq_set_region_bloodmoon_${slot}`;
}

export const REGION_7_MONSTER_MOTIONS: Readonly<Record<string, MonsterMotionProfile>> = {
  'mon_7-1_0': 'flutter',
  'mon_7-1_1': 'sway',
  'mon_7-1_2': 'hopper',
  'mon_7-1_3': 'bounce',
  'mon_7-2_0': 'bounce',
  'mon_7-2_1': 'sway',
  'mon_7-2_2': 'hopper',
  'mon_7-2_3': 'bounce',
  'mon_7-2_elite': 'royal',
  'mon_7-3_0': 'flutter',
  'mon_7-3_1': 'sway',
  'mon_7-3_2': 'flutter',
  'mon_7-3_3': 'guard',
  'mon_7-4_0': 'hopper',
  'mon_7-4_1': 'guard',
  'mon_7-4_2': 'sway',
  'mon_7-4_3': 'bounce',
  'mon_7-4_elite': 'royal',
  'mon_7-5_0': 'sway',
  'mon_7-5_1': 'flutter',
  'mon_7-5_2': 'guard',
  'mon_7-5_3': 'hopper',
  'mon_7-5_elite': 'royal',
  'mon_7-5_boss': 'royal',
};
