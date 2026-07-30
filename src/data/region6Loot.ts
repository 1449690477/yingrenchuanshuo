/**
 * 幽影碎片独立掉落来源。
 *
 * 与 R5 相同，碎片不属于章节区域材料，只注入三只真实精英与最终 BOSS。
 * 权重、数量与保底由 scripts/region6-economy.mts 持续验收。
 */

import type { LootEntry } from '@/core/types';
import { REGION_6_FRAGMENT_ID } from './region6';

export interface Region6FragmentLootSource {
  lootTableId: string;
  monsterId: string;
  monsterName: string;
  entry: Readonly<LootEntry>;
}

export const REGION_6_FRAGMENT_LOOT_SOURCES: readonly Region6FragmentLootSource[] = [
  {
    lootTableId: 'loot_6-2_elite',
    monsterId: 'mon_6-2_elite',
    monsterName: '幽影祭司',
    entry: {
      itemId: REGION_6_FRAGMENT_ID,
      weight: 0.4,
      minCount: 1,
      maxCount: 2,
      pityCount: 300,
    },
  },
  {
    lootTableId: 'loot_6-4_elite',
    monsterId: 'mon_6-4_elite',
    monsterName: '幽影教主候补',
    entry: {
      itemId: REGION_6_FRAGMENT_ID,
      weight: 0.48,
      minCount: 1,
      maxCount: 2,
      pityCount: 260,
    },
  },
  {
    lootTableId: 'loot_6-5_elite',
    monsterId: 'mon_6-5_elite',
    monsterName: '塔顶司祭',
    entry: {
      itemId: REGION_6_FRAGMENT_ID,
      weight: 0.52,
      minCount: 1,
      maxCount: 2,
      pityCount: 240,
    },
  },
  {
    lootTableId: 'loot_6-5_boss',
    monsterId: 'mon_6-5_boss',
    monsterName: '幽影教主·诺瓦',
    entry: {
      itemId: REGION_6_FRAGMENT_ID,
      weight: 0.4,
      minCount: 2,
      maxCount: 4,
      pityCount: 240,
    },
  },
] as const;

const REGION_6_FRAGMENT_LOOT_BY_TABLE = new Map(
  REGION_6_FRAGMENT_LOOT_SOURCES.map((source) => [source.lootTableId, source]),
);

export function region6FragmentLootForTable(lootTableId: string): LootEntry | undefined {
  const entry = REGION_6_FRAGMENT_LOOT_BY_TABLE.get(lootTableId)?.entry;
  return entry ? { ...entry } : undefined;
}
