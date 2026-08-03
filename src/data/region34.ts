/**
 * 区域 3～4 的独立内容声明。
 *
 * 这份文件先与运行时 REGIONS 解耦，方便在多 AI 协作期间完成素材和数值门禁，
 * 等掉落、强化与装备表全部就绪后再由 regions.ts 一次性接入，避免半成品区域
 * 污染当前可玩的区域 1～2。
 */

import type { RegionSpec } from './regions';
import type { MonsterMotionProfile } from './battleMotions';
import type { ClassId, EquipSlot } from '@/core/types';

export interface Region34MaterialSpec {
  id: string;
  name: string;
  tier: 'common' | 'fine' | 'rare';
  sellPrice: number;
  /** 区域材料只进入对应真实怪物类型的表，禁止所有表全塞。 */
  source: 'normal' | 'elite' | 'boss';
  desc: string;
  /** rare 材料的精确保底次数待数值策划确认后显式填写。 */
  pityCount?: number;
}

export const REGION_34_MATERIALS: readonly Region34MaterialSpec[] = [
  {
    id: 'chitin_wing',
    name: '虫翅碎片',
    tier: 'common',
    sellPrice: 8,
    source: 'normal',
    desc: '薄得透光，风一吹就会发出细细的铃音。',
  },
  {
    id: 'moss_cave',
    name: '洞窟苔藓',
    tier: 'common',
    sellPrice: 7,
    source: 'normal',
    desc: '在黑暗里也会微微发光，摸起来凉凉的。',
  },
  {
    id: 'silk_spider',
    name: '蛛丝束',
    tier: 'fine',
    sellPrice: 45,
    source: 'elite',
    desc: '比丝绸还韧，是织网蛛娘认真收好的手艺。',
  },
  {
    id: 'egg_broodmother',
    name: '虫母之卵',
    tier: 'rare',
    sellPrice: 320,
    source: 'boss',
    // 数值策划确认：BOSS 连续 12 次未掉则必掉。
    // 每日可打的 BOSS 次数有限，12 次约合两周日常，
    // 与 docs/44 的「凑满一套 ≤ 2 周」同一口径；极端非酋是这类游戏的主要流失原因。
    pityCount: 12,
    desc: '还在轻轻搏动，捧在手心时能感觉到一点暖意。',
  },
  {
    id: 'dust_bone',
    name: '骸骨粉',
    tier: 'common',
    sellPrice: 11,
    source: 'normal',
    desc: '月光一照就泛起银白微光的细粉。',
  },
  {
    id: 'herb_moonlit',
    name: '月见草',
    tier: 'common',
    sellPrice: 10,
    source: 'normal',
    desc: '只在墓园月色最柔和的时候悄悄开花。',
  },
  {
    id: 'rubbing_epitaph',
    name: '碑文拓片',
    tier: 'fine',
    sellPrice: 62,
    source: 'elite',
    desc: '拓下的字迹已经很淡，却仍能读出温柔的告别。',
  },
  {
    id: 'tear_eternal',
    name: '永眠之泪',
    tier: 'rare',
    sellPrice: 480,
    source: 'boss',
    // 数值策划确认：BOSS 连续 12 次未掉则必掉。
    // 每日可打的 BOSS 次数有限，12 次约合两周日常，
    // 与 docs/44 的「凑满一套 ≤ 2 周」同一口径；极端非酋是这类游戏的主要流失原因。
    pityCount: 12,
    desc: '像月光凝成的一滴泪，握住时安静得听不见风。',
  },
];

export const REGION_3: RegionSpec = {
  id: 'r3',
  index: 3,
  name: '虫娘洞窟',
  subtitle: '菌灯照亮会呼吸的地下秘境',
  levelFrom: 20,
  levelTo: 30,
  theme: ['#8edfc9', '#dff9f0'],
  mapAsset: 'assets/maps/r3.webp',
  chapters: [
    {
      id: '3-1',
      name: '洞窟入口',
      levelFrom: 20,
      levelTo: 22,
      element: 'ice',
      normals: ['岩甲虫娘', '灯笼蛾灵', '苔藓蜗牛', '水晶蚁兵'],
      materials: ['chitin_wing', 'moss_cave'],
      tutorial: '虫娘偏冰属性。换上炎属性武器后，挂机击杀会明显更快。',
      mapAsset: 'assets/maps/chapter-3-1.webp',
      battleAsset: 'assets/battlefields/chapter-3-1.webp',
    },
    {
      id: '3-2',
      name: '蛛网回廊',
      levelFrom: 22,
      levelTo: 24,
      element: 'ice',
      normals: ['丝囊蛛灵', '银线蛾娘', '网巢侦察蛛', '茧灯精'],
      elite: '织网蛛娘',
      materials: ['chitin_wing', 'moss_cave', 'silk_spider'],
      mapAsset: 'assets/maps/chapter-3-2.webp',
      battleAsset: 'assets/battlefields/chapter-3-2.webp',
    },
    {
      id: '3-3',
      name: '幽光菌道',
      levelFrom: 24,
      levelTo: 26,
      element: 'ice',
      normals: ['荧伞菇娘', '孢子团子', '蓝晶蠕灵', '菌灯甲虫'],
      materials: ['chitin_wing', 'moss_cave'],
      mapAsset: 'assets/maps/chapter-3-3.webp',
      battleAsset: 'assets/battlefields/chapter-3-3.webp',
    },
    {
      id: '3-4',
      name: '地底湖畔',
      levelFrom: 26,
      levelTo: 28,
      element: 'ice',
      normals: ['水萤虫灵', '洞湖螺娘', '冰壳水蚤', '月纹蝾螈'],
      materials: ['chitin_wing', 'moss_cave'],
      mapAsset: 'assets/maps/chapter-3-4.webp',
      battleAsset: 'assets/battlefields/chapter-3-4.webp',
    },
    {
      id: '3-5',
      name: '虫母巢穴',
      levelFrom: 28,
      levelTo: 30,
      element: 'ice',
      normals: ['护卵甲虫', '巢蜜蠕虫', '王纹飞蛾', '卵壳守卫'],
      elite: '虫巢近卫',
      boss: '虫母·缇娅',
      materials: ['chitin_wing', 'moss_cave', 'silk_spider', 'egg_broodmother'],
      mapAsset: 'assets/maps/chapter-3-5.webp',
      battleAsset: 'assets/battlefields/chapter-3-5.webp',
    },
  ],
};

export const REGION_4: RegionSpec = {
  id: 'r4',
  index: 4,
  name: '月下墓园',
  subtitle: '月光替长眠者守着安静的花',
  levelFrom: 30,
  levelTo: 40,
  theme: ['#b7c9ff', '#eeeaff'],
  mapAsset: 'assets/maps/r4.webp',
  chapters: [
    {
      id: '4-1',
      name: '墓园铁门',
      levelFrom: 30,
      levelTo: 32,
      element: 'none',
      normals: ['提灯小幽灵', '锈甲骷髅', '月见草灵', '铁门石像'],
      materials: ['dust_bone', 'herb_moonlit'],
      tutorial: '墓园的材料用来给装备升阶。稀有材料只有章节 BOSS 会掉，但有保底，不用担心。',
      mapAsset: 'assets/maps/chapter-4-1.webp',
      battleAsset: 'assets/battlefields/chapter-4-1.webp',
    },
    {
      id: '4-2',
      name: '无名碑林',
      levelFrom: 32,
      levelTo: 34,
      element: 'none',
      normals: ['墓碑萤火', '拓片纸灵', '无名幽魂', '石屑骨犬'],
      elite: '碑灵',
      materials: ['dust_bone', 'herb_moonlit', 'rubbing_epitaph'],
      mapAsset: 'assets/maps/chapter-4-2.webp',
      battleAsset: 'assets/battlefields/chapter-4-2.webp',
    },
    {
      id: '4-3',
      name: '骸骨回廊',
      levelFrom: 34,
      levelTo: 36,
      element: 'none',
      normals: ['骨灯侍从', '月白骷髅弓手', '回廊怨影', '灵柩甲虫'],
      materials: ['dust_bone', 'herb_moonlit'],
      mapAsset: 'assets/maps/chapter-4-3.webp',
      battleAsset: 'assets/battlefields/chapter-4-3.webp',
    },
    {
      id: '4-4',
      name: '月光礼拜堂',
      levelFrom: 36,
      levelTo: 38,
      element: 'none',
      normals: ['祷烛幽灵', '破钟天使像', '月纱亡灵', '银杯怨灵'],
      elite: '堕落修女',
      materials: ['dust_bone', 'herb_moonlit', 'rubbing_epitaph'],
      mapAsset: 'assets/maps/chapter-4-4.webp',
      battleAsset: 'assets/battlefields/chapter-4-4.webp',
    },
    {
      id: '4-5',
      name: '长眠之棺',
      levelFrom: 38,
      levelTo: 40,
      element: 'none',
      normals: ['王室幽魂', '棺纹石卫', '黑纱怨灵', '泪晶蝙蝠'],
      elite: '王棺守卫',
      boss: '亡灵公主·莉莉丝',
      materials: ['dust_bone', 'herb_moonlit', 'rubbing_epitaph', 'tear_eternal'],
      mapAsset: 'assets/maps/chapter-4-5.webp',
      battleAsset: 'assets/battlefields/chapter-4-5.webp',
    },
  ],
};

export const REGION_34: readonly RegionSpec[] = [REGION_3, REGION_4];

export interface Region34EquipmentThemeSpec {
  regionId: 'r3' | 'r4';
  themeName: string;
  visualKeywords: readonly string[];
  names: Readonly<Record<EquipSlot, string>>;
  weaponNames: Readonly<Record<ClassId, string>>;
}

/**
 * 新区装备只在这里登记美术主题与玩家可见名称。
 * 等级、品质和数值仍由 equipment.ts 的既有生成器统一负责，避免内容表
 * 复制战斗数值。
 */
export const REGION_34_EQUIPMENT_THEMES: readonly Region34EquipmentThemeSpec[] = [
  {
    regionId: 'r3',
    themeName: '虫甲系',
    visualKeywords: ['甲壳', '暗绿', '薄翅', '幽光'],
    names: {
      weapon: '晶壳双刃',
      head: '薄翼触角冠',
      body: '幽光虫甲裙',
      necklace: '蜕壳吊坠',
      bracelet: '蛛丝护腕',
      ring: '复眼晶戒',
      belt: '甲节腰封',
      shoes: '苔纹轻靴',
    },
    weaponNames: {
      swordsman: '晶壳双刃',
      witch: '幽晶魔导球',
      shaman: '虫翅灵扇',
      catkin: '幽晶裂爪',
      kenshi: '晶壳太刀',
    },
  },
  {
    regionId: 'r4',
    themeName: '月殇系',
    visualKeywords: ['幽蓝', '骨白', '月纹', '银辉'],
    names: {
      weapon: '月泪骨刃',
      head: '长眠月冠',
      body: '月殇礼裙',
      necklace: '永眠泪坠',
      bracelet: '碑文护腕',
      ring: '月见银戒',
      belt: '灵柩腰封',
      shoes: '幽步骨靴',
    },
    weaponNames: {
      swordsman: '月泪骨刃',
      witch: '月泪星杖',
      shaman: '永眠轮扇',
      catkin: '月铠巨爪',
      kenshi: '月泪太刀',
    },
  },
];

/** 怪物身份与战斗姿态同源登记；monsterVisuals.ts 据此拼出严格资源表。 */
export const REGION_34_MONSTER_MOTIONS: Readonly<Record<string, MonsterMotionProfile>> = {
  'mon_3-1_0': 'guard',
  'mon_3-1_1': 'flutter',
  'mon_3-1_2': 'sway',
  'mon_3-1_3': 'hopper',
  'mon_3-2_0': 'bounce',
  'mon_3-2_1': 'flutter',
  'mon_3-2_2': 'hopper',
  'mon_3-2_3': 'sway',
  'mon_3-2_elite': 'guard',
  'mon_3-3_0': 'sway',
  'mon_3-3_1': 'bounce',
  'mon_3-3_2': 'sway',
  'mon_3-3_3': 'hopper',
  'mon_3-4_0': 'flutter',
  'mon_3-4_1': 'sway',
  'mon_3-4_2': 'hopper',
  'mon_3-4_3': 'bounce',
  'mon_3-5_0': 'guard',
  'mon_3-5_1': 'sway',
  'mon_3-5_2': 'flutter',
  'mon_3-5_3': 'guard',
  'mon_3-5_elite': 'guard',
  'mon_3-5_boss': 'royal',
  'mon_4-1_0': 'flutter',
  'mon_4-1_1': 'hopper',
  'mon_4-1_2': 'sway',
  'mon_4-1_3': 'guard',
  'mon_4-2_0': 'flutter',
  'mon_4-2_1': 'flutter',
  'mon_4-2_2': 'sway',
  'mon_4-2_3': 'hopper',
  'mon_4-2_elite': 'guard',
  'mon_4-3_0': 'sway',
  'mon_4-3_1': 'guard',
  'mon_4-3_2': 'flutter',
  'mon_4-3_3': 'hopper',
  'mon_4-4_0': 'flutter',
  'mon_4-4_1': 'guard',
  'mon_4-4_2': 'sway',
  'mon_4-4_3': 'bounce',
  'mon_4-4_elite': 'royal',
  'mon_4-5_0': 'flutter',
  'mon_4-5_1': 'guard',
  'mon_4-5_2': 'sway',
  'mon_4-5_3': 'flutter',
  'mon_4-5_elite': 'guard',
  'mon_4-5_boss': 'royal',
};
