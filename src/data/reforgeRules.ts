import type { AffixChangeOperation, AffixTier, ClassId } from '@/core/types';

export const REFORGE_UNLOCK_LEVEL = 12;
export const REFORGE_RESONANCE_MAX = 20;

export const REFORGE_MATERIAL_IDS = {
  reforge: 'stone_reforge',
  temper: 'sand_crystal',
  bind: 'charm_bind',
  resonance: 'crystal_resonance',
} as const;

export const CLASS_SIGIL_IDS: Readonly<Record<ClassId, string>> = {
  swordsman: 'sigil_swordsman',
  witch: 'sigil_witch',
  shaman: 'sigil_shaman',
  catkin: 'sigil_catkin',
};

export interface RegionReforgeMaterials {
  commonIds: readonly [string, string];
  fineId: string;
}

/**
 * 当前区域材料消耗端，承接 docs/42 的既有材料红线。
 * 区域 3/4 的物品随对应内容批次接入，但 ID 在策划中已经锁定。
 */
export const REGION_REFORGE_MATERIALS: Readonly<Record<string, RegionReforgeMaterials>> = {
  r1: { commonIds: ['petal_sakura', 'grass_soft'], fineId: 'bell_wood' },
  r2: { commonIds: ['jelly_cotton', 'straw_sleepy'], fineId: 'honey_bee' },
  r3: { commonIds: ['chitin_wing', 'moss_cave'], fineId: 'silk_spider' },
  r4: { commonIds: ['dust_bone', 'herb_moonlit'], fineId: 'rubbing_epitaph' },
};

export function requireRegionReforgeMaterials(regionId: string): RegionReforgeMaterials {
  const materials = REGION_REFORGE_MATERIALS[regionId];
  if (!materials) throw new Error(`[配置错误] 区域缺少洗练材料配置：${regionId}`);
  return materials;
}

/**
 * 洗练数值配置。core 只解释规则，不得在状态机里重复这些平衡数值。
 */
export const REFORGE_RULES = {
  reforge: {
    goldPerLevel: 50,
    materialEveryLevels: 5,
    materialBase: 1,
    regionCommonEach: 10,
    regionFine: 2,
  },
  temper: {
    goldPerLevel: 80,
    materialEveryLevels: 4,
  },
  bind: {
    /** 锁 N 条时，本次消耗 2^(N-1)；0 条不消耗。 */
    exponentOffset: 1,
  },
  resonate: {
    goldPerLevel: 300,
  },
  resonanceGain: {
    1: 2,
    2: 1,
    3: 0,
    4: -REFORGE_RESONANCE_MAX,
    5: -REFORGE_RESONANCE_MAX,
  } satisfies Record<AffixTier, number>,
} as const;

export const RANDOM_AFFIX_CHANGE_OPERATIONS = [
  'reforge',
  'temper',
  'inscribe',
] as const satisfies readonly AffixChangeOperation[];
