/**
 * 区域 8「龙渊魔城」的原子内容清单。
 *
 * docs/84 是本批权威数值修订层（小衡 08-03 拍板）：五章三十关、二十只普通怪
 * 加精英与 BOSS、主题品质组含首个 mythic 档、龙渊套锚 Lv90/mythic 且只做
 * 称号展示（与血月套同规则，无战斗效果）。docs/11 §区域 8 是章节/怪物名权威。
 */

import type { ClassId, EquipSlot, Quality } from '@/core/types';
import type { MonsterMotionProfile } from './battleMotions';
import type { RegionSpec } from './regions';

export type Region8MaterialTier = 'common' | 'fine' | 'rare';

export interface Region8MaterialSpec {
  id: string;
  name: string;
  kind: 'material' | 'fragment';
  tier: Region8MaterialTier;
  sellPrice: number;
  source: 'normal' | 'elite' | 'boss' | 'set-special';
  desc: string;
  pityCount?: number;
}

export const REGION_8_MATERIALS: readonly Region8MaterialSpec[] = [
  {
    id: 'scale_dragon',
    name: '龙鳞片',
    kind: 'material',
    tier: 'common',
    sellPrice: 42,
    source: 'normal',
    desc: '城墙上随处能捡到的暗金龙鳞，还带着余温。',
  },
  {
    id: 'ember_furnace',
    name: '熔炉余烬',
    kind: 'material',
    tier: 'common',
    sellPrice: 40,
    source: 'normal',
    desc: '熔铸工坊的炉灰里没烧尽的火种。',
  },
  {
    id: 'bone_dragon',
    name: '龙骨残片',
    kind: 'material',
    tier: 'fine',
    sellPrice: 220,
    source: 'elite',
    desc: '龙骸广场的骨龙身上掉落的旧鳞骨。',
  },
  {
    id: 'blood_dragon',
    name: '龙血精粹',
    kind: 'material',
    tier: 'rare',
    sellPrice: 2_000,
    source: 'boss',
    pityCount: 12,
    desc: '法芙娜心头血凝成的暗红结晶。',
  },
  {
    id: 'frag_dragonabyss',
    name: '龙渊碎片',
    kind: 'fragment',
    tier: 'rare',
    sellPrice: 0,
    source: 'set-special',
    desc: '凑齐后可唤出龙渊套装的残响。',
  },
];

export const REGION_8: RegionSpec = {
  id: 'r8',
  index: 8,
  name: '龙渊魔城',
  subtitle: '龙焰烧穿了天顶，魔城在深渊上继续呼吸',
  levelFrom: 78,
  levelTo: 92,
  theme: ['#6b4f2a', '#f0c75e'],
  mapAsset: 'assets/maps/r8.webp',
  chapters: [
    {
      id: '8-1',
      name: '魔城外墙',
      levelFrom: 78,
      levelTo: 81,
      element: 'ice',
      normals: ['城墙卫龙蜥', '锈甲魔像兵', '城垛夜鸦', '燃灯石魔'],
      materials: ['scale_dragon', 'ember_furnace'],
      tutorial: '魔城的敌人偏冰属性；炎属性武器能持续克制它们。',
      mapAsset: 'assets/maps/chapter-8-1.webp',
      battleAsset: 'assets/battlefields/chapter-8-1.webp',
    },
    {
      id: '8-2',
      name: '龙骸广场',
      levelFrom: 81,
      levelTo: 84,
      element: 'ice',
      normals: ['骸骨龙蜥', '广场怨灵', '断翼龙裔', '墓碑食腐者'],
      elite: '骨龙',
      materials: ['scale_dragon', 'ember_furnace', 'bone_dragon'],
      mapAsset: 'assets/maps/chapter-8-2.webp',
      battleAsset: 'assets/battlefields/chapter-8-2.webp',
    },
    {
      id: '8-3',
      name: '熔铸工坊',
      levelFrom: 84,
      levelTo: 86,
      element: 'ice',
      normals: ['熔炉火精', '铁砧魔童', '淬火龙纹傀儡', '煤灰蝠娘'],
      materials: ['scale_dragon', 'ember_furnace'],
      mapAsset: 'assets/maps/chapter-8-3.webp',
      battleAsset: 'assets/battlefields/chapter-8-3.webp',
    },
    {
      id: '8-4',
      name: '龙血回廊',
      levelFrom: 86,
      levelTo: 89,
      element: 'ice',
      normals: ['龙血蠕虫', '廊柱龙纹守卫', '血池魅影', '龙鳞蛾'],
      elite: '龙血侍女',
      materials: ['scale_dragon', 'ember_furnace', 'bone_dragon'],
      mapAsset: 'assets/maps/chapter-8-4.webp',
      battleAsset: 'assets/battlefields/chapter-8-4.webp',
    },
    {
      id: '8-5',
      name: '龙渊王座',
      levelFrom: 89,
      levelTo: 92,
      element: 'ice',
      normals: ['王座龙卫', '龙焰使徒', '深渊眼魔', '龙魂缠影'],
      elite: '龙渊近卫',
      boss: '龙渊之主·法芙娜',
      materials: ['scale_dragon', 'ember_furnace', 'bone_dragon', 'blood_dragon'],
      mapAsset: 'assets/maps/chapter-8-5.webp',
      battleAsset: 'assets/battlefields/chapter-8-5.webp',
    },
  ],
};

export interface Region8EquipmentThemeSpec {
  regionId: 'r8';
  themeName: string;
  level: number;
  qualities: readonly Quality[];
  visualKeywords: readonly string[];
  names: Readonly<Record<EquipSlot, string>>;
  weaponNames: Readonly<Record<ClassId, string>>;
}

export const REGION_8_EQUIPMENT_THEME: Region8EquipmentThemeSpec = {
  regionId: 'r8',
  themeName: '龙渊系',
  level: 84,
  qualities: ['epic', 'legendary', 'mythic'],
  visualKeywords: ['龙鳞', '暗金', '深渊', '熔火'],
  names: {
    weapon: '龙渊断罪刃',
    head: '龙角魔冠',
    body: '龙鳞魔城礼装',
    necklace: '龙心吊坠',
    bracelet: '龙纹护腕',
    ring: '深渊龙戒',
    belt: '龙骨腰封',
    shoes: '龙焰战靴',
  },
  weaponNames: {
    swordsman: '龙渊断罪剑',
    witch: '龙焰魔导珠',
    shaman: '龙骨引魂扇',
    catkin: '龙渊裂爪',
    kenshi: '龙渊太刀',
  },
};

export const REGION_8_SET_ID = 'set_region_dragonabyss';
export const REGION_8_FRAGMENT_ID = 'frag_dragonabyss';
/** docs/84：成本照 r7 现行参数（55），经济脚本以门禁定稿。 */
export const REGION_8_FRAGMENT_COST = 55;
export const REGION_8_SET_LEVEL = 90;
export const REGION_8_SET_QUALITY = 'mythic' satisfies Quality;
export const REGION_8_SET_SLOTS = [
  'weapon',
  'head',
  'body',
  'necklace',
  'bracelet',
  'ring',
  'belt',
  'shoes',
] as const satisfies readonly EquipSlot[];

export const REGION_8_SET_NAMES: Readonly<Record<(typeof REGION_8_SET_SLOTS)[number], string>> = {
  weapon: '法芙娜灭世刃',
  head: '龙渊支配者冠',
  body: '龙之主深红礼装',
  necklace: '龙心渊坠',
  bracelet: '龙威誓镯',
  ring: '魔城龙戒',
  belt: '龙脊束带',
  shoes: '龙焰渊行靴',
};

export const REGION_8_SET_WEAPON_NAMES: Readonly<Record<ClassId, string>> = {
  swordsman: '法芙娜灭世剑',
  witch: '龙渊灭世珠',
  shaman: '龙魂引渡扇',
  catkin: '法芙娜裂渊爪',
  kenshi: '法芙娜灭世刀',
};

export const REGION_8_COMPLETION_TITLE = '龙渊的征服者';
export const REGION_8_COMPLETION_BADGE = 'assets/equipment/sets/r8-dragonabyss/badge.png';

export function region8SetEquipmentId(slot: EquipSlot): string {
  return `eq_r8_set_${slot}`;
}

export const REGION_8_MONSTER_MOTIONS: Readonly<Record<string, MonsterMotionProfile>> = {
  'mon_8-1_0': 'guard',
  'mon_8-1_1': 'sway',
  'mon_8-1_2': 'flutter',
  'mon_8-1_3': 'guard',
  'mon_8-2_0': 'hopper',
  'mon_8-2_1': 'sway',
  'mon_8-2_2': 'flutter',
  'mon_8-2_3': 'bounce',
  'mon_8-2_elite': 'royal',
  'mon_8-3_0': 'bounce',
  'mon_8-3_1': 'hopper',
  'mon_8-3_2': 'guard',
  'mon_8-3_3': 'flutter',
  'mon_8-4_0': 'sway',
  'mon_8-4_1': 'guard',
  'mon_8-4_2': 'sway',
  'mon_8-4_3': 'flutter',
  'mon_8-4_elite': 'royal',
  'mon_8-5_0': 'guard',
  'mon_8-5_1': 'flutter',
  'mon_8-5_2': 'sway',
  'mon_8-5_3': 'sway',
  'mon_8-5_elite': 'royal',
  'mon_8-5_boss': 'royal',
};
