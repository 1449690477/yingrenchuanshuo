/**
 * 区域 3～4 美术资产的唯一生产清单。
 *
 * 构建和校验脚本都从这里读取精确数量，禁止通过扫描目录把制作一半的文件
 * 静默带进运行时。
 */

export const REGION34_REGIONS = ['r3', 'r4'];
export const REGION34_SLOTS = [
  'weapon',
  'head',
  'body',
  'necklace',
  'bracelet',
  'ring',
  'belt',
  'shoes',
];

export const REGION34_MAPS = [
  { id: 'r3', region: 'r3', kind: 'region' },
  { id: 'chapter-3-1', region: 'r3', kind: 'chapter' },
  { id: 'chapter-3-2', region: 'r3', kind: 'chapter' },
  { id: 'chapter-3-3', region: 'r3', kind: 'chapter' },
  { id: 'chapter-3-4', region: 'r3', kind: 'chapter' },
  { id: 'chapter-3-5', region: 'r3', kind: 'chapter' },
  { id: 'r4', region: 'r4', kind: 'region' },
  { id: 'chapter-4-1', region: 'r4', kind: 'chapter' },
  { id: 'chapter-4-2', region: 'r4', kind: 'chapter' },
  { id: 'chapter-4-3', region: 'r4', kind: 'chapter' },
  { id: 'chapter-4-4', region: 'r4', kind: 'chapter' },
  { id: 'chapter-4-5', region: 'r4', kind: 'chapter' },
];

export const REGION34_BATTLEFIELDS = REGION34_MAPS.filter(
  (asset) => asset.kind === 'chapter',
).map((asset) => ({ id: asset.id, region: asset.region }));

export const REGION34_ITEMS = [
  { id: 'chitin_wing', region: 'r3' },
  { id: 'moss_cave', region: 'r3' },
  { id: 'silk_spider', region: 'r3' },
  { id: 'egg_broodmother', region: 'r3' },
  { id: 'dust_bone', region: 'r4' },
  { id: 'herb_moonlit', region: 'r4' },
  { id: 'rubbing_epitaph', region: 'r4' },
  { id: 'tear_eternal', region: 'r4' },
];

export const REGION34_EQUIPMENT = REGION34_REGIONS.flatMap((region) =>
  REGION34_SLOTS.map((slot) => ({ id: `${region}-${slot}`, region, slot })),
);

export const REGION34_MONSTERS = [
  { id: 'mon_3-1_0', region: 'r3', name: '岩甲虫娘', motion: 'guard' },
  { id: 'mon_3-1_1', region: 'r3', name: '灯笼蛾灵', motion: 'flutter' },
  { id: 'mon_3-1_2', region: 'r3', name: '苔藓蜗牛', motion: 'sway' },
  { id: 'mon_3-1_3', region: 'r3', name: '水晶蚁兵', motion: 'hopper' },
  { id: 'mon_3-2_0', region: 'r3', name: '丝囊蛛灵', motion: 'bounce' },
  { id: 'mon_3-2_1', region: 'r3', name: '银线蛾娘', motion: 'flutter' },
  { id: 'mon_3-2_2', region: 'r3', name: '网巢侦察蛛', motion: 'hopper' },
  { id: 'mon_3-2_3', region: 'r3', name: '茧灯精', motion: 'sway' },
  { id: 'mon_3-2_elite', region: 'r3', name: '织网蛛娘', motion: 'guard' },
  { id: 'mon_3-3_0', region: 'r3', name: '荧伞菇娘', motion: 'sway' },
  { id: 'mon_3-3_1', region: 'r3', name: '孢子团子', motion: 'bounce' },
  { id: 'mon_3-3_2', region: 'r3', name: '蓝晶蠕灵', motion: 'sway' },
  { id: 'mon_3-3_3', region: 'r3', name: '菌灯甲虫', motion: 'hopper' },
  { id: 'mon_3-4_0', region: 'r3', name: '水萤虫灵', motion: 'flutter' },
  { id: 'mon_3-4_1', region: 'r3', name: '洞湖螺娘', motion: 'sway' },
  { id: 'mon_3-4_2', region: 'r3', name: '冰壳水蚤', motion: 'hopper' },
  { id: 'mon_3-4_3', region: 'r3', name: '月纹蝾螈', motion: 'bounce' },
  { id: 'mon_3-5_0', region: 'r3', name: '护卵甲虫', motion: 'guard' },
  { id: 'mon_3-5_1', region: 'r3', name: '巢蜜蠕虫', motion: 'sway' },
  { id: 'mon_3-5_2', region: 'r3', name: '王纹飞蛾', motion: 'flutter' },
  { id: 'mon_3-5_3', region: 'r3', name: '卵壳守卫', motion: 'guard' },
  { id: 'mon_3-5_elite', region: 'r3', name: '虫巢近卫', motion: 'guard' },
  { id: 'mon_3-5_boss', region: 'r3', name: '虫母·缇娅', motion: 'royal' },
  { id: 'mon_4-1_0', region: 'r4', name: '提灯小幽灵', motion: 'flutter' },
  { id: 'mon_4-1_1', region: 'r4', name: '锈甲骷髅', motion: 'hopper' },
  { id: 'mon_4-1_2', region: 'r4', name: '月见草灵', motion: 'sway' },
  { id: 'mon_4-1_3', region: 'r4', name: '铁门石像', motion: 'guard' },
  { id: 'mon_4-2_0', region: 'r4', name: '墓碑萤火', motion: 'flutter' },
  { id: 'mon_4-2_1', region: 'r4', name: '拓片纸灵', motion: 'flutter' },
  { id: 'mon_4-2_2', region: 'r4', name: '无名幽魂', motion: 'sway' },
  { id: 'mon_4-2_3', region: 'r4', name: '石屑骨犬', motion: 'hopper' },
  { id: 'mon_4-2_elite', region: 'r4', name: '碑灵', motion: 'guard' },
  { id: 'mon_4-3_0', region: 'r4', name: '骨灯侍从', motion: 'sway' },
  { id: 'mon_4-3_1', region: 'r4', name: '月白骷髅弓手', motion: 'guard' },
  { id: 'mon_4-3_2', region: 'r4', name: '回廊怨影', motion: 'flutter' },
  { id: 'mon_4-3_3', region: 'r4', name: '灵柩甲虫', motion: 'hopper' },
  { id: 'mon_4-4_0', region: 'r4', name: '祷烛幽灵', motion: 'flutter' },
  { id: 'mon_4-4_1', region: 'r4', name: '破钟天使像', motion: 'guard' },
  { id: 'mon_4-4_2', region: 'r4', name: '月纱亡灵', motion: 'sway' },
  { id: 'mon_4-4_3', region: 'r4', name: '银杯怨灵', motion: 'bounce' },
  { id: 'mon_4-4_elite', region: 'r4', name: '堕落修女', motion: 'royal' },
  { id: 'mon_4-5_0', region: 'r4', name: '王室幽魂', motion: 'flutter' },
  { id: 'mon_4-5_1', region: 'r4', name: '棺纹石卫', motion: 'guard' },
  { id: 'mon_4-5_2', region: 'r4', name: '黑纱怨灵', motion: 'sway' },
  { id: 'mon_4-5_3', region: 'r4', name: '泪晶蝙蝠', motion: 'flutter' },
  { id: 'mon_4-5_elite', region: 'r4', name: '王棺守卫', motion: 'guard' },
  { id: 'mon_4-5_boss', region: 'r4', name: '亡灵公主·莉莉丝', motion: 'royal' },
];

export const REGION34_CLASSES = ['swordsman', 'witch', 'shaman', 'catkin'];
export const REGION34_VISIBLE_SLOTS = ['body', 'head', 'weapon'];
export const REGION34_MODULAR_LAYERS = REGION34_CLASSES.flatMap((classId) =>
  REGION34_REGIONS.flatMap((region) =>
    REGION34_VISIBLE_SLOTS.map((slot) => ({ classId, region, slot })),
  ),
);

export const REGION34_COUNTS = Object.freeze({
  maps: 12,
  battlefields: 10,
  monsters: 47,
  items: 8,
  equipment: 16,
  modularLayers: 24,
  runtimeWithoutModular: 93,
  runtimeTotal: 117,
});
