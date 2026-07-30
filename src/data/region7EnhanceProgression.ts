/**
 * 区域 7 强化成长配置。
 *
 * 从 R6 终章全身 +14 / 主养 +15 单调接续，前两章继续蓄力，第三章起逐步完成
 * 全身 +15。最终数量由 scripts/region7-economy.mts 对真实波次和成本校准。
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

export const REGION_7_ENHANCE_PROGRESSION: Readonly<
  Record<string, ChapterEnhanceProgression>
> = {
  '7-1': chapter(
    '7-1',
    14,
    15,
    [680, 735, 795, 860, 935, 1_270],
    {
      normal: source([entry(MATERIAL.stone, 3, 28, 42)]),
      elite: EMPTY,
      boss: EMPTY,
    },
    [
      { itemId: MATERIAL.reforge, count: 10 },
      { itemId: MATERIAL.ore, count: 190 },
      { itemId: MATERIAL.lucky, count: 16 },
      { itemId: MATERIAL.protection, count: 10 },
    ],
  ),
  '7-2': chapter(
    '7-2',
    14,
    15,
    [715, 775, 840, 910, 990, 1_345],
    {
      normal: source([entry(MATERIAL.stone, 3.1, 29, 43)]),
      elite: source([
        entry(MATERIAL.ore, 0.48, 1, 4, 21),
        entry(MATERIAL.protection, 0.004, 1, 1, 580),
      ]),
      boss: EMPTY,
    },
    [
      { itemId: MATERIAL.reforge, count: 11 },
      { itemId: MATERIAL.ore, count: 220 },
      { itemId: MATERIAL.lucky, count: 18 },
      { itemId: MATERIAL.protection, count: 12 },
    ],
  ),
  '7-3': chapter(
    '7-3',
    15,
    15,
    [750, 815, 885, 960, 1_045, 1_420],
    {
      normal: source([entry(MATERIAL.stone, 3.2, 30, 44)]),
      elite: EMPTY,
      boss: EMPTY,
    },
    [
      { itemId: MATERIAL.reforge, count: 12 },
      { itemId: MATERIAL.ore, count: 250 },
      { itemId: MATERIAL.lucky, count: 19 },
      { itemId: MATERIAL.protection, count: 13 },
    ],
  ),
  '7-4': chapter(
    '7-4',
    15,
    15,
    [790, 855, 930, 1_010, 1_100, 1_500],
    {
      normal: source([entry(MATERIAL.stone, 3.3, 31, 46)]),
      elite: source([
        entry(MATERIAL.ore, 0.52, 1, 4, 20),
        entry(MATERIAL.lucky, 0.005, 1, 1, 620),
        entry(MATERIAL.protection, 0.005, 1, 1, 540),
      ]),
      boss: EMPTY,
    },
    [
      { itemId: MATERIAL.reforge, count: 13 },
      { itemId: MATERIAL.ore, count: 280 },
      { itemId: MATERIAL.lucky, count: 21 },
      { itemId: MATERIAL.protection, count: 16 },
    ],
  ),
  '7-5': chapter(
    '7-5',
    15,
    15,
    [830, 900, 980, 1_065, 1_160, 1_590],
    {
      normal: source([entry(MATERIAL.stone, 3.4, 32, 48)]),
      elite: source([
        entry(MATERIAL.ore, 0.59, 1, 4, 19),
        entry(MATERIAL.lucky, 0.005, 1, 1, 580),
        entry(MATERIAL.protection, 0.005, 1, 1, 510),
      ]),
      boss: source([
        entry(MATERIAL.ore, 0.29, 2, 5, 30),
        entry(MATERIAL.lucky, 0.005, 1, 1, 500),
        entry(MATERIAL.protection, 0.006, 1, 1, 450),
      ]),
    },
    [
      { itemId: MATERIAL.reforge, count: 15 },
      { itemId: MATERIAL.ore, count: 320 },
      { itemId: MATERIAL.lucky, count: 23 },
      { itemId: MATERIAL.protection, count: 19 },
    ],
  ),
};
