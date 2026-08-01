/**
 * 区域 6「幽影祀塔」的原子内容清单。
 *
 * R6 延续 R5 已验证的“数据、经济、套装、资产一起启用”边界：
 * 20 只普通怪、3 只精英、1 只 BOSS，五章各六关。石像苏醒只属于表现层，
 * 不附加无法应对的偷袭伤害。
 */

import type { ClassId, EquipSlot, Quality } from '@/core/types';
import type { MonsterMotionProfile } from './battleMotions';
import type { RegionSpec } from './regions';

export type Region6MaterialTier = 'common' | 'fine' | 'rare';

export interface Region6MaterialSpec {
  id: string;
  name: string;
  kind: 'material' | 'fragment';
  tier: Region6MaterialTier;
  sellPrice: number;
  source: 'normal' | 'elite' | 'boss' | 'set-special';
  desc: string;
  pityCount?: number;
}

export const REGION_6_MATERIALS: readonly Region6MaterialSpec[] = [
  {
    id: 'dust_statue',
    name: '石像碎屑',
    kind: 'material',
    tier: 'common',
    sellPrice: 26,
    source: 'normal',
    desc: '敲下来的石粉，还带着体温。',
  },
  {
    id: 'scroll_faded',
    name: '褪色经文',
    kind: 'material',
    tier: 'common',
    sellPrice: 24,
    source: 'normal',
    desc: '字迹已经看不清，纸却没坏。',
  },
  {
    id: 'wisp_shadow',
    name: '幽影残念',
    kind: 'material',
    tier: 'fine',
    sellPrice: 130,
    source: 'elite',
    desc: '教团成员留下的最后一点念头。',
  },
  {
    id: 'stone_void',
    name: '虚空祭石',
    kind: 'material',
    tier: 'rare',
    sellPrice: 1_100,
    source: 'boss',
    pityCount: 12,
    desc: '塔顶祭坛的核心，吸走靠近的光。',
  },
  {
    id: 'frag_shadow',
    name: '幽影碎片',
    kind: 'fragment',
    tier: 'rare',
    sellPrice: 900,
    source: 'set-special',
    desc: '幽影套的残片，握久了连影子都会变淡。',
  },
] as const;

export const REGION_6: RegionSpec = {
  id: 'r6',
  index: 6,
  name: '幽影祀塔',
  subtitle: '紫黑石阶通向无声的虚空祭坛',
  levelFrom: 52,
  levelTo: 65,
  theme: ['#6f5aa8', '#c4a9ef'],
  mapAsset: 'assets/maps/r6.webp',
  chapters: [
    {
      id: '6-1',
      name: '祀塔一层·石像回廊',
      levelFrom: 52,
      levelTo: 55,
      element: 'thunder',
      normals: ['眠石团子', '刻纹石偶', '黯光浮雕灵', '祀塔石翼兽'],
      materials: ['dust_statue', 'scroll_faded'],
      tutorial: '石像怪会在第一次受击时苏醒；它只改变入场演出，不会偷袭造成额外伤害。',
      mapAsset: 'assets/maps/chapter-6-1.webp',
      battleAsset: 'assets/battlefields/chapter-6-1.webp',
    },
    {
      id: '6-2',
      name: '祀塔三层·祭祀间',
      levelFrom: 55,
      levelTo: 58,
      element: 'thunder',
      normals: ['经卷纸灵', '幽灯侍从', '祷钟蝠灵', '黑纱祭偶'],
      elite: '幽影祭司',
      materials: ['dust_statue', 'scroll_faded', 'wisp_shadow'],
      mapAsset: 'assets/maps/chapter-6-2.webp',
      battleAsset: 'assets/battlefields/chapter-6-2.webp',
    },
    {
      id: '6-3',
      name: '祀塔五层·藏经阁',
      levelFrom: 58,
      levelTo: 60,
      element: 'thunder',
      normals: ['墨页书灵', '残烛经使', '锁链卷轴怪', '静默守书人'],
      materials: ['dust_statue', 'scroll_faded'],
      mapAsset: 'assets/maps/chapter-6-3.webp',
      battleAsset: 'assets/battlefields/chapter-6-3.webp',
    },
    {
      id: '6-4',
      name: '祀塔七层·禁忌之间',
      levelFrom: 60,
      levelTo: 63,
      element: 'thunder',
      normals: ['影纹侍女', '禁书咒灵', '虚像巡礼者', '紫晶神龛灵'],
      elite: '幽影教主候补',
      materials: ['dust_statue', 'scroll_faded', 'wisp_shadow'],
      mapAsset: 'assets/maps/chapter-6-4.webp',
      battleAsset: 'assets/battlefields/chapter-6-4.webp',
    },
    {
      id: '6-5',
      name: '塔顶·虚空祭坛',
      levelFrom: 63,
      levelTo: 65,
      element: 'thunder',
      normals: ['塔顶守望者', '虚空星灯', '祀影蛇灵', '诺瓦近侍'],
      elite: '塔顶司祭',
      boss: '幽影教主·诺瓦',
      materials: ['dust_statue', 'scroll_faded', 'wisp_shadow', 'stone_void'],
      mapAsset: 'assets/maps/chapter-6-5.webp',
      battleAsset: 'assets/battlefields/chapter-6-5.webp',
    },
  ],
};

export interface Region6EquipmentThemeSpec {
  regionId: 'r6';
  themeName: string;
  level: number;
  qualities: readonly Quality[];
  visualKeywords: readonly string[];
  names: Readonly<Record<EquipSlot, string>>;
  weaponNames: Readonly<Record<ClassId, string>>;
}

export const REGION_6_EQUIPMENT_THEME: Region6EquipmentThemeSpec = {
  regionId: 'r6',
  themeName: '幽石祀纹系',
  level: 56,
  qualities: ['rare', 'epic', 'legendary'],
  visualKeywords: ['紫黑', '石纹', '银灰', '教团徽记'],
  names: {
    weapon: '幽石祷刃',
    head: '石纹祀冠',
    body: '幽庭祭礼裙',
    necklace: '褪色经坠',
    bracelet: '镇影石镯',
    ring: '虚光誓戒',
    belt: '玄纹祀带',
    shoes: '静默行靴',
  },
  weaponNames: {
    swordsman: '幽石镇魂剑',
    witch: '幽烬祷星杖',
    shaman: '玄铃镇影扇',
    catkin: '夜影裂石爪',
    kenshi: '幽石镇魂刀',
  },
};

export const REGION_6_SET_ID = 'set_region_shadow';
export const REGION_6_FRAGMENT_ID = 'frag_shadow';
export const REGION_6_FRAGMENT_COST = 55;
export const REGION_6_SET_LEVEL = 62;
export const REGION_6_SET_QUALITY = 'legendary' satisfies Quality;
export const REGION_6_SET_SLOTS = [
  'weapon',
  'head',
  'body',
  'necklace',
  'bracelet',
  'ring',
  'belt',
  'shoes',
] as const satisfies readonly EquipSlot[];

export const REGION_6_SET_NAMES: Readonly<Record<(typeof REGION_6_SET_SLOTS)[number], string>> = {
  weapon: '诺瓦幽界刃',
  head: '幽影教皇冠',
  body: '诺瓦虚空礼装',
  necklace: '残月魂坠',
  bracelet: '镇魂幽镯',
  ring: '不灭影戒',
  belt: '虚空祀带',
  shoes: '无声影靴',
};

export const REGION_6_SET_WEAPON_NAMES: Readonly<Record<ClassId, string>> = {
  swordsman: '诺瓦幽界剑',
  witch: '诺瓦虚星杖',
  shaman: '诺瓦镇魂扇',
  catkin: '诺瓦影缚爪',
  kenshi: '诺瓦幽界太刀',
};

export function region6SetEquipmentId(slot: (typeof REGION_6_SET_SLOTS)[number]): string {
  return `eq_set_region_shadow_${slot}`;
}

/** 会伪装成石像并在首次受击时苏醒的怪物；只供表现层使用。 */
export const REGION_6_STATUE_MONSTER_IDS = [
  'mon_6-1_0',
  'mon_6-1_1',
  'mon_6-1_2',
  'mon_6-1_3',
  'mon_6-3_3',
] as const;

export const REGION_6_MONSTER_MOTIONS: Readonly<Record<string, MonsterMotionProfile>> = {
  'mon_6-1_0': 'bounce',
  'mon_6-1_1': 'guard',
  'mon_6-1_2': 'sway',
  'mon_6-1_3': 'guard',
  'mon_6-2_0': 'flutter',
  'mon_6-2_1': 'sway',
  'mon_6-2_2': 'flutter',
  'mon_6-2_3': 'bounce',
  'mon_6-2_elite': 'royal',
  'mon_6-3_0': 'flutter',
  'mon_6-3_1': 'sway',
  'mon_6-3_2': 'hopper',
  'mon_6-3_3': 'guard',
  'mon_6-4_0': 'sway',
  'mon_6-4_1': 'flutter',
  'mon_6-4_2': 'hopper',
  'mon_6-4_3': 'guard',
  'mon_6-4_elite': 'royal',
  'mon_6-5_0': 'guard',
  'mon_6-5_1': 'flutter',
  'mon_6-5_2': 'hopper',
  'mon_6-5_3': 'sway',
  'mon_6-5_elite': 'guard',
  'mon_6-5_boss': 'royal',
};
