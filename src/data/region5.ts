/**
 * 区域 5「熔岩神殿」的原子内容清单。
 *
 * 这里同时登记关卡、怪物身份、材料、普通装备主题与绯焰六件套的稳定 ID。
 * 运行时只允许在掉落、强化、套装、资产与经济门禁全部就绪后一次性接入，
 * 避免出现能进入新区却缺图、缺材料用途或缺真实套装结算的半成品状态。
 */

import type { ClassId, EquipSlot, Quality } from '@/core/types';
import type { MonsterMotionProfile } from './battleMotions';
import type { RegionSpec } from './regions';

export type Region5MaterialTier = 'common' | 'fine' | 'rare';

export interface Region5MaterialSpec {
  id: string;
  name: string;
  kind: 'material' | 'fragment';
  tier: Region5MaterialTier;
  sellPrice: number;
  source: 'normal' | 'elite' | 'boss' | 'set-special';
  desc: string;
  /** 普通区域 rare 材料继续沿用 BOSS 单物品保底。 */
  pityCount?: number;
}

export const REGION_5_MATERIALS: readonly Region5MaterialSpec[] = [
  {
    id: 'slag_lava',
    name: '熔岩渣',
    kind: 'material',
    tier: 'common',
    sellPrice: 20,
    source: 'normal',
    desc: '还没完全冷却，捧在手里有点烫。',
  },
  {
    id: 'shard_scorched',
    name: '焦岩片',
    kind: 'material',
    tier: 'common',
    sellPrice: 18,
    source: 'normal',
    desc: '被祭火烧了很多年，敲一下会碎。',
  },
  {
    id: 'ember_ritual',
    name: '祭火余烬',
    kind: 'material',
    tier: 'fine',
    sellPrice: 95,
    source: 'elite',
    desc: '神官们供奉的火种，永远不灭。',
  },
  {
    id: 'core_moltenheart',
    name: '熔心结晶',
    kind: 'material',
    tier: 'rare',
    sellPrice: 760,
    source: 'boss',
    pityCount: 12,
    desc: '神殿深处的心脏，还在缓慢跳动。',
  },
  {
    id: 'frag_crimson',
    name: '绯焰碎片',
    kind: 'fragment',
    tier: 'rare',
    sellPrice: 620,
    source: 'set-special',
    desc: '绯焰套的残片，凑齐能重铸一件。',
  },
] as const;

export const REGION_5: RegionSpec = {
  id: 'r5',
  index: 5,
  name: '熔岩神殿',
  subtitle: '赤金火纹照亮不熄的誓约',
  levelFrom: 40,
  levelTo: 52,
  theme: ['#f27a70', '#ffe5bd'],
  mapAsset: 'assets/maps/r5.webp',
  chapters: [
    {
      id: '5-1',
      name: '焦土外环',
      levelFrom: 40,
      levelTo: 42,
      element: 'fire',
      normals: ['灰烬团子', '熔壳蜥灵', '火星飞蛾', '焦岩甲虫'],
      materials: ['slag_lava', 'shard_scorched'],
      tutorial: '炎属性怪物登场。攻击元素仍只由武器决定，换装前可先查看武器详情。',
      mapAsset: 'assets/maps/chapter-5-1.webp',
      battleAsset: 'assets/battlefields/chapter-5-1.webp',
    },
    {
      id: '5-2',
      name: '熔岩桥',
      levelFrom: 42,
      levelTo: 45,
      element: 'fire',
      normals: ['岩浆史莱姆', '火羽蝠灵', '红晶守卫', '链桥火铃'],
      elite: '熔岩卫娘',
      materials: ['slag_lava', 'shard_scorched', 'ember_ritual'],
      mapAsset: 'assets/maps/chapter-5-2.webp',
      battleAsset: 'assets/battlefields/chapter-5-2.webp',
    },
    {
      id: '5-3',
      name: '神殿前庭',
      levelFrom: 45,
      levelTo: 47,
      element: 'fire',
      normals: ['祈火灯灵', '赤纹石像', '香灰狐灵', '金焰甲兵'],
      materials: ['slag_lava', 'shard_scorched'],
      mapAsset: 'assets/maps/chapter-5-3.webp',
      battleAsset: 'assets/battlefields/chapter-5-3.webp',
    },
    {
      id: '5-4',
      name: '祭火大厅',
      levelFrom: 47,
      levelTo: 50,
      element: 'fire',
      normals: ['火纱侍从', '祭盘精灵', '烛冠火灵', '赤绸舞灵'],
      elite: '赤红神官',
      materials: ['slag_lava', 'shard_scorched', 'ember_ritual'],
      mapAsset: 'assets/maps/chapter-5-4.webp',
      battleAsset: 'assets/battlefields/chapter-5-4.webp',
    },
    {
      id: '5-5',
      name: '熔心圣所',
      levelFrom: 50,
      levelTo: 52,
      element: 'fire',
      normals: ['熔心守卫', '焰羽圣灵', '金瞳火蛇', '誓火侍女'],
      elite: '熔心圣侍',
      boss: '炎神官长·维斯塔',
      materials: ['slag_lava', 'shard_scorched', 'ember_ritual', 'core_moltenheart'],
      mapAsset: 'assets/maps/chapter-5-5.webp',
      battleAsset: 'assets/battlefields/chapter-5-5.webp',
    },
  ],
};

export interface Region5EquipmentThemeSpec {
  regionId: 'r5';
  themeName: string;
  level: number;
  qualities: readonly Quality[];
  visualKeywords: readonly string[];
  names: Readonly<Record<EquipSlot, string>>;
  weaponNames: Readonly<Record<ClassId, string>>;
}

export const REGION_5_EQUIPMENT_THEME: Region5EquipmentThemeSpec = {
  regionId: 'r5',
  themeName: '绯金火纹系',
  level: 46,
  qualities: ['rare', 'epic', 'legendary'],
  visualKeywords: ['赤红', '鎏金', '火纹', '透明熔晶'],
  names: {
    weapon: '绯金誓刃',
    head: '火纹祭冠',
    body: '赤焰祭礼裙',
    necklace: '余烬心坠',
    bracelet: '熔纹护腕',
    ring: '誓火金戒',
    belt: '赤金绶带',
    shoes: '焰步短靴',
  },
  weaponNames: {
    swordsman: '绯金誓刃',
    witch: '熔晶焰心杖',
    shaman: '赤羽祭火扇',
    catkin: '绯焰裂晶爪',
  },
};

export const REGION_5_SET_ID = 'set_region_crimson';
export const REGION_5_FRAGMENT_ID = 'frag_crimson';
export const REGION_5_FRAGMENT_COST = 40;
export const REGION_5_SET_LEVEL = 50;
export const REGION_5_SET_QUALITY = 'legendary' satisfies Quality;
export const REGION_5_SET_SLOTS = [
  'weapon',
  'head',
  'body',
  'necklace',
  'ring',
  'bracelet',
] as const satisfies readonly EquipSlot[];

export const REGION_5_SET_NAMES: Readonly<
  Record<(typeof REGION_5_SET_SLOTS)[number], string>
> = {
  weapon: '维斯塔誓焰刃',
  head: '绯焰圣冠',
  body: '绯焰誓约礼装',
  necklace: '熔心誓坠',
  ring: '不灭焰戒',
  bracelet: '赤金焰护',
};

export const REGION_5_SET_WEAPON_NAMES: Readonly<Record<ClassId, string>> = {
  swordsman: '维斯塔誓焰刃',
  witch: '维斯塔焰心杖',
  shaman: '维斯塔燎天扇',
  catkin: '维斯塔焰羽爪',
};

export function region5SetEquipmentId(
  slot: (typeof REGION_5_SET_SLOTS)[number],
): string {
  return `eq_set_region_crimson_${slot}`;
}

/** 怪物身份与动作性格同源，资产 manifest 和运行时注册表共用。 */
export const REGION_5_MONSTER_MOTIONS: Readonly<Record<string, MonsterMotionProfile>> = {
  'mon_5-1_0': 'bounce',
  'mon_5-1_1': 'hopper',
  'mon_5-1_2': 'flutter',
  'mon_5-1_3': 'guard',
  'mon_5-2_0': 'bounce',
  'mon_5-2_1': 'flutter',
  'mon_5-2_2': 'guard',
  'mon_5-2_3': 'sway',
  'mon_5-2_elite': 'royal',
  'mon_5-3_0': 'flutter',
  'mon_5-3_1': 'guard',
  'mon_5-3_2': 'hopper',
  'mon_5-3_3': 'guard',
  'mon_5-4_0': 'sway',
  'mon_5-4_1': 'bounce',
  'mon_5-4_2': 'flutter',
  'mon_5-4_3': 'sway',
  'mon_5-4_elite': 'royal',
  'mon_5-5_0': 'guard',
  'mon_5-5_1': 'flutter',
  'mon_5-5_2': 'hopper',
  'mon_5-5_3': 'sway',
  'mon_5-5_elite': 'guard',
  'mon_5-5_boss': 'royal',
};
