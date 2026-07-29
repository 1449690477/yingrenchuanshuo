/**
 * 绯焰碎片独立掉落表。
 *
 * 碎片不属于 ChapterSpec.materials；这里只向三只真实精英和最终 BOSS 的表
 * 注入，不能因为生成器预建了空 elite/boss 表就制造虚假来源。
 */

import type { LootEntry } from '@/core/types';
import { REGION_5_FRAGMENT_ID } from './region5';

export interface Region5FragmentLootSource {
  lootTableId: string;
  monsterId: string;
  monsterName: string;
  entry: Readonly<LootEntry>;
}

export const REGION_5_FRAGMENT_LOOT_SOURCES: readonly Region5FragmentLootSource[] = [
  {
    lootTableId: 'loot_5-2_elite',
    monsterId: 'mon_5-2_elite',
    monsterName: '熔岩卫娘',
    entry: {
      itemId: REGION_5_FRAGMENT_ID,
      weight: 0.8,
      minCount: 1,
      maxCount: 1,
      pityCount: 80,
    },
  },
  {
    lootTableId: 'loot_5-4_elite',
    monsterId: 'mon_5-4_elite',
    monsterName: '赤红神官',
    entry: {
      itemId: REGION_5_FRAGMENT_ID,
      weight: 1,
      minCount: 1,
      maxCount: 2,
      pityCount: 70,
    },
  },
  {
    lootTableId: 'loot_5-5_elite',
    monsterId: 'mon_5-5_elite',
    monsterName: '熔心圣侍',
    entry: {
      itemId: REGION_5_FRAGMENT_ID,
      weight: 1.2,
      minCount: 1,
      maxCount: 2,
      pityCount: 60,
    },
  },
  {
    lootTableId: 'loot_5-5_boss',
    monsterId: 'mon_5-5_boss',
    monsterName: '炎神官长·维斯塔',
    entry: {
      itemId: REGION_5_FRAGMENT_ID,
      weight: 1.4,
      minCount: 2,
      maxCount: 3,
      pityCount: 35,
    },
  },
] as const;

const REGION_5_FRAGMENT_LOOT_BY_TABLE = new Map(
  REGION_5_FRAGMENT_LOOT_SOURCES.map((source) => [source.lootTableId, source]),
);

export function region5FragmentLootForTable(
  lootTableId: string,
): LootEntry | undefined {
  const entry = REGION_5_FRAGMENT_LOOT_BY_TABLE.get(lootTableId)?.entry;
  return entry ? { ...entry } : undefined;
}

