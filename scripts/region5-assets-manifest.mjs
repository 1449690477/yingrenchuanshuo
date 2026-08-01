/**
 * 区域 5「熔岩神殿」美术资产的唯一运行时清单。
 *
 * 主仓只提交本清单、PROMPTS、源图 SHA 锁、运行时压缩资产与联系表。
 * ImageGen 原图和 alpha 母版进入独立 Git LFS 美术源仓，禁止复制回主仓。
 */

export const REGION5_CLASSES = ['swordsman', 'witch', 'shaman', 'catkin', 'kenshi'];
export const REGION5_VISIBLE_SLOTS = ['body', 'head', 'weapon'];
export const REGION5_SLOTS = [
  'weapon',
  'head',
  'body',
  'necklace',
  'bracelet',
  'ring',
  'belt',
  'shoes',
];
export const REGION5_SET_SLOTS = [
  'weapon',
  'head',
  'body',
  'necklace',
  'ring',
  'bracelet',
];

export const REGION5_MAPS = [
  { id: 'r5', kind: 'region' },
  { id: 'chapter-5-1', kind: 'chapter' },
  { id: 'chapter-5-2', kind: 'chapter' },
  { id: 'chapter-5-3', kind: 'chapter' },
  { id: 'chapter-5-4', kind: 'chapter' },
  { id: 'chapter-5-5', kind: 'chapter' },
];

export const REGION5_BATTLEFIELDS = REGION5_MAPS.filter(
  (asset) => asset.kind === 'chapter',
).map(({ id }) => ({ id }));

export const REGION5_ITEMS = [
  { id: 'slag_lava', kind: 'material' },
  { id: 'shard_scorched', kind: 'material' },
  { id: 'ember_ritual', kind: 'material' },
  { id: 'core_moltenheart', kind: 'material' },
  { id: 'frag_crimson', kind: 'fragment' },
];

export const REGION5_EQUIPMENT = REGION5_SLOTS.map((slot) => ({
  id: `r5-${slot}`,
  family: 'region',
  slot,
}));

export const REGION5_SET_EQUIPMENT = REGION5_SET_SLOTS.map((slot) => ({
  id: `r5-crimson-${slot}`,
  family: 'set',
  slot,
}));

export const REGION5_MONSTERS = [
  { id: 'mon_5-1_0', name: '灰烬团子', motion: 'bounce' },
  { id: 'mon_5-1_1', name: '熔壳蜥灵', motion: 'hopper' },
  { id: 'mon_5-1_2', name: '火星飞蛾', motion: 'flutter' },
  { id: 'mon_5-1_3', name: '焦岩甲虫', motion: 'guard' },
  { id: 'mon_5-2_0', name: '岩浆史莱姆', motion: 'bounce' },
  { id: 'mon_5-2_1', name: '火羽蝠灵', motion: 'flutter' },
  { id: 'mon_5-2_2', name: '红晶守卫', motion: 'guard' },
  { id: 'mon_5-2_3', name: '链桥火铃', motion: 'sway' },
  { id: 'mon_5-2_elite', name: '熔岩卫娘', motion: 'royal' },
  { id: 'mon_5-3_0', name: '祈火灯灵', motion: 'flutter' },
  { id: 'mon_5-3_1', name: '赤纹石像', motion: 'guard' },
  { id: 'mon_5-3_2', name: '香灰狐灵', motion: 'hopper' },
  { id: 'mon_5-3_3', name: '金焰甲兵', motion: 'guard' },
  { id: 'mon_5-4_0', name: '火纱侍从', motion: 'sway' },
  { id: 'mon_5-4_1', name: '祭盘精灵', motion: 'bounce' },
  { id: 'mon_5-4_2', name: '烛冠火灵', motion: 'flutter' },
  { id: 'mon_5-4_3', name: '赤绸舞灵', motion: 'sway' },
  { id: 'mon_5-4_elite', name: '赤红神官', motion: 'royal' },
  { id: 'mon_5-5_0', name: '熔心守卫', motion: 'guard' },
  { id: 'mon_5-5_1', name: '焰羽圣灵', motion: 'flutter' },
  { id: 'mon_5-5_2', name: '金瞳火蛇', motion: 'hopper' },
  { id: 'mon_5-5_3', name: '誓火侍女', motion: 'sway' },
  { id: 'mon_5-5_elite', name: '熔心圣侍', motion: 'guard' },
  { id: 'mon_5-5_boss', name: '炎神官长·维斯塔', motion: 'royal' },
];

export const REGION5_MODULAR_LAYERS = REGION5_CLASSES.flatMap((classId) =>
  REGION5_VISIBLE_SLOTS.map((slot) => ({
    classId,
    family: 'region',
    slot,
    id: `${classId}-r5-${slot}`,
  })),
);

export const REGION5_SET_MODULAR_LAYERS = REGION5_CLASSES.flatMap((classId) =>
  REGION5_VISIBLE_SLOTS.map((slot) => ({
    classId,
    family: 'set',
    slot,
    id: `${classId}-r5-crimson-${slot}`,
  })),
);

export const REGION5_COUNTS = Object.freeze({
  maps: 6,
  battlefields: 5,
  monsters: 24,
  items: 5,
  equipment: 8,
  setEquipment: 6,
  modularLayers: 15,
  setModularLayers: 15,
  regionContentRuntime: 55,
  regionSetRuntime: 18,
  runtimeTotal: 84,
});
