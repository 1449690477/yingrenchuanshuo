/**
 * 区域装备掉落品质矩阵。
 *
 * 装备定义决定“这个区域有哪些品质”，本表进一步决定不同怪物类型实际开放
 * 哪些品质与总权重。区域 5 起不能继续沿用一张全局表，否则普通怪会提前掉
 * 史诗、BOSS 又无法提供传说装备峰值。
 */

import type { MonsterType, Quality } from '@/core/types';

export type QualityWeightProfile = Readonly<
  Record<MonsterType, Readonly<Partial<Record<Quality, number>>>>
>;

export interface RegionLootProfile {
  qualityWeights: QualityWeightProfile;
  /** 只有真实 BOSS 表会使用；同组八部位只强制一件。 */
  bossQualityPity?: {
    quality: Quality;
    groupId: string;
    pityCount: number;
  };
}

/**
 * 区域 1～4 的现行权重。
 *
 * 某品质没有对应装备定义时会自然得到空列表，因此 R1/R2 仍维持自己的开放节奏。
 */
export const LEGACY_REGION_LOOT_PROFILE: RegionLootProfile = {
  qualityWeights: {
    normal: { common: 8, fine: 3, rare: 0.6 },
    elite: { common: 12, fine: 20, rare: 8, epic: 1 },
    boss: { fine: 20, rare: 40, epic: 12 },
  },
};

/**
 * R5 第一套装区：普通只出 rare，精英只出 rare/epic，
 * 最终 BOSS 才提供 epic/legendary。
 *
 * 传说档的最终权重与 240 次组保底会由 R5 真实经济模拟持续验收；这里是运行时
 * 唯一读取点，脚本不得另藏一套数字。
 */
export const REGION_5_LOOT_PROFILE: RegionLootProfile = {
  qualityWeights: {
    normal: { rare: 0.6 },
    elite: { rare: 8, epic: 1 },
    boss: { epic: 12, legendary: 0.12 },
  },
  bossQualityPity: {
    quality: 'legendary',
    groupId: 'r5-legendary',
    pityCount: 240,
  },
};

export const REGION_LOOT_PROFILES: Readonly<Record<string, RegionLootProfile>> = {
  r5: REGION_5_LOOT_PROFILE,
};

export function regionLootProfile(regionId: string): RegionLootProfile {
  return REGION_LOOT_PROFILES[regionId] ?? LEGACY_REGION_LOOT_PROFILE;
}

