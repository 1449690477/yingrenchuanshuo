/**
 * 区域 8 强化成长配置。
 *
 * 从 R7 终章全身 +15 单调接续：区域 8 全程维持推荐 15/15（ENHANCE_MAX），
 * 前两章蓄力、第三章起完整供给；掉落量与首通奖励按章节递增，
 * 最终数量由 scripts/region8-economy.mts 对真实波次和成本校准（docs/84 §三）。
 */

import type { LootEntry, LootResult, MonsterType } from '@/core/types';
import { ENHANCE_MATERIAL_IDS } from './constants';
import type {
  ChapterEnhanceProgression,
  EnhanceLootSource,
} from './enhanceProgression';

const MATERIAL = {
  ...ENHANCE_MATERIAL_IDS,
  reforge: 'stone_reforge',
} as const;

function entry(
  itemId: string,
  weight: number,
  minCount: number,
  maxCount: number,
  pityCount?: number,
): LootEntry {
  return {
    itemId,
    weight,
    minCount,
    maxCount,
    ...(pityCount === undefined ? {} : { pityCount }),
  };
}

function source(
  entries: readonly LootEntry[] = [],
  guaranteed: readonly LootEntry[] = [],
): EnhanceLootSource {
  return { entries, guaranteed };
}

function chapter(
  chapterId: string,
  recommendedAllEnhance: number,
  recommendedMainEnhance: number,
  stoneByStage: ChapterEnhanceProgression['firstClear']['stoneByStage'],
  loot: Readonly<Record<MonsterType, EnhanceLootSource>>,
  finalBonus: readonly LootResult[],
): ChapterEnhanceProgression {
  return {
    chapterId,
    recommendedAllEnhance,
    recommendedMainEnhance,
    loot,
    firstClear: { stoneByStage, finalBonus },
  };
}

const EMPTY = source();

export const REGION_8_ENHANCE_PROGRESSION: Readonly<
  Record<string, ChapterEnhanceProgression>
> = {
  '8-1': chapter(
    '8-1',
    15,
    15,
    [820, 890, 965, 1_045, 1_135, 1_545],
    {
      normal: source([entry(MATERIAL.stone, 3.4, 33, 50)]),
      elite: EMPTY,
      boss: EMPTY,
    },
    [
      { itemId: MATERIAL.reforge, count: 13 },
      { itemId: MATERIAL.ore, count: 300 },
      { itemId: MATERIAL.lucky, count: 21 },
      { itemId: MATERIAL.protection, count: 14 },
    ],
  ),
  '8-2': chapter(
    '8-2',
    15,
    15,
    [865, 940, 1_020, 1_105, 1_200, 1_635],
    {
      normal: source([entry(MATERIAL.stone, 3.5, 34, 51)]),
      elite: source([
        entry(MATERIAL.ore, 0.55, 1, 4, 19),
        entry(MATERIAL.protection, 0.005, 1, 1, 540),
      ]),
      boss: EMPTY,
    },
    [
      { itemId: MATERIAL.reforge, count: 14 },
      { itemId: MATERIAL.ore, count: 330 },
      { itemId: MATERIAL.lucky, count: 23 },
      { itemId: MATERIAL.protection, count: 15 },
    ],
  ),
  '8-3': chapter(
    '8-3',
    15,
    15,
    [910, 990, 1_075, 1_165, 1_270, 1_725],
    {
      normal: source([entry(MATERIAL.stone, 3.6, 35, 52)]),
      elite: EMPTY,
      boss: EMPTY,
    },
    [
      { itemId: MATERIAL.reforge, count: 15 },
      { itemId: MATERIAL.ore, count: 360 },
      { itemId: MATERIAL.lucky, count: 24 },
      { itemId: MATERIAL.protection, count: 16 },
    ],
  ),
  '8-4': chapter(
    '8-4',
    15,
    15,
    [960, 1_045, 1_135, 1_230, 1_340, 1_825],
    {
      normal: source([entry(MATERIAL.stone, 3.7, 36, 53)]),
      elite: source([
        entry(MATERIAL.ore, 0.58, 1, 4, 18),
        entry(MATERIAL.lucky, 0.005, 1, 1, 600),
        entry(MATERIAL.protection, 0.005, 1, 1, 520),
      ]),
      boss: EMPTY,
    },
    [
      { itemId: MATERIAL.reforge, count: 16 },
      { itemId: MATERIAL.ore, count: 390 },
      { itemId: MATERIAL.lucky, count: 26 },
      { itemId: MATERIAL.protection, count: 17 },
    ],
  ),
  '8-5': chapter(
    '8-5',
    15,
    15,
    [1_015, 1_105, 1_200, 1_300, 1_415, 1_930],
    {
      normal: source([entry(MATERIAL.stone, 3.8, 37, 54)]),
      elite: source([
        entry(MATERIAL.ore, 0.6, 1, 4, 17),
        entry(MATERIAL.protection, 0.005, 1, 1, 500),
      ]),
      boss: source([entry(MATERIAL.ore, 2.4, 4, 9, 6)]),
    },
    [
      { itemId: MATERIAL.reforge, count: 17 },
      { itemId: MATERIAL.ore, count: 430 },
      { itemId: MATERIAL.lucky, count: 28 },
      { itemId: MATERIAL.protection, count: 18 },
    ],
  ),
};
