export interface MonsterVisual {
  asset: string;
}

/**
 * 已完成制作和校验的怪物素材注册表。
 * 未进入本表的怪物会显示明确的文字占位，不会请求不存在的图片。
 */
export const MONSTER_VISUALS: Readonly<Record<string, MonsterVisual>> = {
  'mon_1-1_0': { asset: 'assets/monsters/r1/mon_1-1_0.png' },
  'mon_1-1_1': { asset: 'assets/monsters/r1/mon_1-1_1.png' },
  'mon_1-1_2': { asset: 'assets/monsters/r1/mon_1-1_2.png' },
  'mon_1-1_3': { asset: 'assets/monsters/r1/mon_1-1_3.png' },
  'mon_1-2_0': { asset: 'assets/monsters/r1/mon_1-2_0.png' },
  'mon_1-2_1': { asset: 'assets/monsters/r1/mon_1-2_1.png' },
  'mon_1-2_2': { asset: 'assets/monsters/r1/mon_1-2_2.png' },
  'mon_1-2_3': { asset: 'assets/monsters/r1/mon_1-2_3.png' },
  'mon_1-3_0': { asset: 'assets/monsters/r1/mon_1-3_0.png' },
  'mon_1-3_1': { asset: 'assets/monsters/r1/mon_1-3_1.png' },
  'mon_1-3_2': { asset: 'assets/monsters/r1/mon_1-3_2.png' },
  'mon_1-3_3': { asset: 'assets/monsters/r1/mon_1-3_3.png' },
  'mon_1-3_elite': { asset: 'assets/monsters/r1/mon_1-3_elite.png' },
  'mon_1-4_0': { asset: 'assets/monsters/r1/mon_1-4_0.png' },
  'mon_1-4_1': { asset: 'assets/monsters/r1/mon_1-4_1.png' },
  'mon_1-4_2': { asset: 'assets/monsters/r1/mon_1-4_2.png' },
  'mon_1-4_3': { asset: 'assets/monsters/r1/mon_1-4_3.png' },
  'mon_1-4_elite': { asset: 'assets/monsters/r1/mon_1-4_elite.png' },
  'mon_1-5_0': { asset: 'assets/monsters/r1/mon_1-5_0.png' },
  'mon_1-5_1': { asset: 'assets/monsters/r1/mon_1-5_1.png' },
  'mon_1-5_2': { asset: 'assets/monsters/r1/mon_1-5_2.png' },
  'mon_1-5_3': { asset: 'assets/monsters/r1/mon_1-5_3.png' },
  'mon_1-5_elite': { asset: 'assets/monsters/r1/mon_1-5_elite.png' },
  'mon_1-5_boss': { asset: 'assets/monsters/r1/mon_1-5_boss.png' },
};

export function getMonsterVisual(id: string): MonsterVisual | undefined {
  return MONSTER_VISUALS[id];
}
