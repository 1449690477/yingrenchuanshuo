/**
 * 血月碎片独立掉落来源。
 *
 * docs/59 要求完整沿用 R6 的四来源、权重、数量与保底结构，只替换内容身份。
 * 碎片不混入章节材料，保证普通怪不会越权产出套装进度。
 */

import type { LootEntry } from '@/core/types';
import { REGION_7_FRAGMENT_ID } from './region7';

export interface Region7FragmentLootSource {
  lootTableId: string;
  monsterId: string;
  monsterName: string;
  entry: Readonly<LootEntry>;
}

export const REGION_7_FRAGMENT_LOOT_SOURCES: readonly Region7FragmentLootSource[] = [
  {
    lootTableId: 'loot_7-2_elite',
    monsterId: 'mon_7-2_elite',
    monsterName: '血雾魔女',
    entry: {
      itemId: REGION_7_FRAGMENT_ID,
      weight: 0.4,
      minCount: 1,
      maxCount: 2,
      pityCount: 300,
    },
  },
  {
    lootTableId: 'loot_7-4_elite',
    monsterId: 'mon_7-4_elite',
    monsterName: '小恶魔娘三姐妹',
    entry: {
      itemId: REGION_7_FRAGMENT_ID,
      weight: 0.48,
      minCount: 1,
      maxCount: 2,
      pityCount: 260,
    },
  },
  {
    lootTableId: 'loot_7-5_elite',
    monsterId: 'mon_7-5_elite',
    monsterName: '血月大祭司',
    entry: {
      itemId: REGION_7_FRAGMENT_ID,
      weight: 0.52,
      minCount: 1,
      maxCount: 2,
      pityCount: 240,
    },
  },
  {
    lootTableId: 'loot_7-5_boss',
    monsterId: 'mon_7-5_boss',
    monsterName: '血月恶魔·莉莉姆',
    entry: {
      itemId: REGION_7_FRAGMENT_ID,
      weight: 0.4,
      minCount: 2,
      maxCount: 4,
      pityCount: 240,
    },
  },
] as const;

const REGION_7_FRAGMENT_LOOT_BY_TABLE = new Map(
  REGION_7_FRAGMENT_LOOT_SOURCES.map((source) => [source.lootTableId, source]),
);

export function region7FragmentLootForTable(lootTableId: string): LootEntry | undefined {
  const entry = REGION_7_FRAGMENT_LOOT_BY_TABLE.get(lootTableId)?.entry;
  return entry ? { ...entry } : undefined;
}
