/**
 * 区域 6 强化成长配置。
 *
 * 目标从 R5 终章的全身 +13 / 主养 +15 单调接续，到 R6 后半段全身 +14；
 * 所有数量由 scripts/region6-economy.mts 对真实波次与成本做收支门禁。
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

export const REGION_6_ENHANCE_PROGRESSION: Readonly<
  Record<string, ChapterEnhanceProgression>
> = {
  '6-1': chapter(
    '6-1',
    13,
    15,
    [500, 545, 590, 645, 705, 960],
    {
      normal: source([entry(MATERIAL.stone, 4.2, 24, 35)]),
      elite: EMPTY,
      boss: EMPTY,
    },
    [
      { itemId: MATERIAL.reforge, count: 6 },
      { itemId: MATERIAL.ore, count: 100 },
      { itemId: MATERIAL.lucky, count: 8 },
      { itemId: MATERIAL.protection, count: 6 },
    ],
  ),
  '6-2': chapter(
    '6-2',
    13,
    15,
    [530, 575, 625, 680, 745, 1_010],
    {
      normal: source([entry(MATERIAL.stone, 4.4, 24, 36)]),
      elite: source([
        entry(MATERIAL.ore, 0.9, 1, 3, 28),
        entry(MATERIAL.protection, 0.003, 1, 1, 650),
      ]),
      boss: EMPTY,
    },
    [
      { itemId: MATERIAL.reforge, count: 7 },
      { itemId: MATERIAL.ore, count: 130 },
      { itemId: MATERIAL.lucky, count: 11 },
      { itemId: MATERIAL.protection, count: 8 },
    ],
  ),
  '6-3': chapter(
    '6-3',
    14,
    15,
    [560, 610, 660, 720, 785, 1_070],
    {
      normal: source([entry(MATERIAL.stone, 4.6, 25, 37)]),
      elite: EMPTY,
      boss: EMPTY,
    },
    [
      { itemId: MATERIAL.reforge, count: 7 },
      { itemId: MATERIAL.ore, count: 160 },
      { itemId: MATERIAL.lucky, count: 14 },
      { itemId: MATERIAL.protection, count: 9 },
    ],
  ),
  '6-4': chapter(
    '6-4',
    14,
    15,
    [590, 640, 695, 755, 825, 1_125],
    {
      normal: source([entry(MATERIAL.stone, 4.8, 25, 38)]),
      elite: source([
        entry(MATERIAL.ore, 1, 1, 3, 24),
        entry(MATERIAL.lucky, 0.004, 1, 1, 700),
        entry(MATERIAL.protection, 0.004, 1, 1, 620),
      ]),
      boss: EMPTY,
    },
    [
      { itemId: MATERIAL.reforge, count: 8 },
      { itemId: MATERIAL.ore, count: 200 },
      { itemId: MATERIAL.lucky, count: 17 },
      { itemId: MATERIAL.protection, count: 11 },
    ],
  ),
  '6-5': chapter(
    '6-5',
    14,
    15,
    [620, 675, 730, 795, 870, 1_190],
    {
      normal: source([entry(MATERIAL.stone, 5, 26, 39)]),
      elite: source([
        entry(MATERIAL.ore, 1.1, 1, 3, 22),
        entry(MATERIAL.lucky, 0.004, 1, 1, 650),
        entry(MATERIAL.protection, 0.004, 1, 1, 580),
      ]),
      boss: source([
        entry(MATERIAL.ore, 0.6, 2, 4, 34),
        entry(MATERIAL.lucky, 0.004, 1, 1, 560),
        entry(MATERIAL.protection, 0.005, 1, 1, 500),
      ]),
    },
    [
      { itemId: MATERIAL.reforge, count: 9 },
      { itemId: MATERIAL.ore, count: 280 },
      { itemId: MATERIAL.lucky, count: 21 },
      { itemId: MATERIAL.protection, count: 14 },
    ],
  ),
};
