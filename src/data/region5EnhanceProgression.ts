/**
 * 区域 5 强化成长配置。
 *
 * 这份表先独立于 ENHANCE_PROGRESSION；区域 5 原子启用时再整体展开。
 * 数量由 scripts/region5-economy.mts 读取真实波次、击杀速度、装备获取节奏与
 * 强化纯函数验证，不能在 UI 或掉落生成器里复制。
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

export const REGION_5_ENHANCE_PROGRESSION: Readonly<
  Record<string, ChapterEnhanceProgression>
> = {
  '5-1': chapter(
    '5-1',
    12,
    14,
    [330, 365, 400, 440, 480, 650],
    {
      normal: source([entry(MATERIAL.stone, 3.2, 20, 30)]),
      elite: EMPTY,
      boss: EMPTY,
    },
    [
      { itemId: MATERIAL.reforge, count: 4 },
      { itemId: MATERIAL.ore, count: 30 },
    ],
  ),
  '5-2': chapter(
    '5-2',
    12,
    14,
    [350, 385, 420, 460, 505, 700],
    {
      normal: source([entry(MATERIAL.stone, 3.4, 20, 30)]),
      elite: source([entry(MATERIAL.ore, 0.6, 1, 2, 40)]),
      boss: EMPTY,
    },
    [
      { itemId: MATERIAL.reforge, count: 4 },
      { itemId: MATERIAL.ore, count: 45 },
      { itemId: MATERIAL.protection, count: 2 },
    ],
  ),
  '5-3': chapter(
    '5-3',
    13,
    14,
    [370, 405, 445, 485, 530, 740],
    {
      normal: source([entry(MATERIAL.stone, 3.6, 21, 31)]),
      elite: EMPTY,
      boss: EMPTY,
    },
    [
      { itemId: MATERIAL.reforge, count: 5 },
      { itemId: MATERIAL.ore, count: 60 },
      { itemId: MATERIAL.lucky, count: 2 },
    ],
  ),
  '5-4': chapter(
    '5-4',
    13,
    15,
    [390, 430, 470, 510, 560, 780],
    {
      normal: source([entry(MATERIAL.stone, 3.8, 21, 32)]),
      elite: source([
        entry(MATERIAL.ore, 0.7, 1, 2, 35),
        entry(MATERIAL.lucky, 0.003, 1, 1, 650),
        entry(MATERIAL.protection, 0.002, 1, 1, 800),
      ]),
      boss: EMPTY,
    },
    [
      { itemId: MATERIAL.reforge, count: 5 },
      { itemId: MATERIAL.ore, count: 80 },
      { itemId: MATERIAL.lucky, count: 3 },
      { itemId: MATERIAL.protection, count: 3 },
    ],
  ),
  '5-5': chapter(
    '5-5',
    13,
    15,
    [420, 460, 500, 545, 600, 840],
    {
      normal: source([entry(MATERIAL.stone, 4, 22, 32)]),
      elite: source([
        entry(MATERIAL.ore, 0.8, 1, 2, 31),
        entry(MATERIAL.lucky, 0.003, 1, 1, 1_000),
        entry(MATERIAL.protection, 0.002, 1, 1, 1_200),
      ]),
      boss: source([
        entry(MATERIAL.ore, 0.4, 1, 2, 46),
        entry(MATERIAL.lucky, 0.003, 1, 1, 750),
        entry(MATERIAL.protection, 0.002, 1, 1, 1_100),
      ]),
    },
    [
      { itemId: MATERIAL.reforge, count: 6 },
      // 真实技能栏接管挂机后，高阶材料供需略低于 1.02 下界；把差额放在
      // 终章首通的确定性奖励里，避免继续抬随机掉率和保底方差。
      { itemId: MATERIAL.ore, count: 200 },
      { itemId: MATERIAL.lucky, count: 8 },
      { itemId: MATERIAL.protection, count: 8 },
    ],
  ),
};
