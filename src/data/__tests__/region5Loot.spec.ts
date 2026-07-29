import { describe, expect, it } from 'vitest';
import { REGION_5 } from '../region5';
import {
  REGION_5_FRAGMENT_LOOT_SOURCES,
  region5FragmentLootForTable,
} from '../region5Loot';

describe('R5 绯焰碎片独立来源', () => {
  it('只登记三只真实精英与最终 BOSS', () => {
    expect(
      REGION_5_FRAGMENT_LOOT_SOURCES.map(({ monsterId }) => monsterId),
    ).toEqual([
      'mon_5-2_elite',
      'mon_5-4_elite',
      'mon_5-5_elite',
      'mon_5-5_boss',
    ]);

    const declaredSpecialIds = REGION_5.chapters.flatMap((chapter) => [
      ...(chapter.elite ? [`mon_${chapter.id}_elite`] : []),
      ...(chapter.boss ? [`mon_${chapter.id}_boss`] : []),
    ]);
    expect(REGION_5_FRAGMENT_LOOT_SOURCES.map(({ monsterId }) => monsterId)).toEqual(
      declaredSpecialIds,
    );
  });

  it('每个来源使用正权重、正数量与独立保底', () => {
    for (const source of REGION_5_FRAGMENT_LOOT_SOURCES) {
      expect(source.entry.itemId).toBe('frag_crimson');
      expect(source.entry.weight).toBeGreaterThan(0);
      expect(source.entry.minCount).toBeGreaterThan(0);
      expect(source.entry.maxCount).toBeGreaterThanOrEqual(source.entry.minCount);
      expect(source.entry.pityCount).toBeGreaterThan(0);
      expect(region5FragmentLootForTable(source.lootTableId)).toEqual(source.entry);
      expect(region5FragmentLootForTable(source.lootTableId)).not.toBe(source.entry);
    }
  });

  it('预生成但没有真实怪物的空表不会得到碎片', () => {
    for (const tableId of [
      'loot_5-1_elite',
      'loot_5-1_boss',
      'loot_5-2_boss',
      'loot_5-3_elite',
      'loot_5-3_boss',
      'loot_5-4_boss',
    ]) {
      expect(region5FragmentLootForTable(tableId), tableId).toBeUndefined();
    }
  });
});
