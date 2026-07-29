import { describe, expect, it } from 'vitest';
import { REGION_6 } from '../region6';
import {
  REGION_6_FRAGMENT_LOOT_SOURCES,
  region6FragmentLootForTable,
} from '../region6Loot';

describe('R6 幽影碎片独立来源', () => {
  it('与区域登记的三只精英和最终 BOSS 完全一致', () => {
    const declared = REGION_6.chapters.flatMap((chapter) => [
      ...(chapter.elite ? [`mon_${chapter.id}_elite`] : []),
      ...(chapter.boss ? [`mon_${chapter.id}_boss`] : []),
    ]);
    expect(REGION_6_FRAGMENT_LOOT_SOURCES.map((source) => source.monsterId)).toEqual(declared);
  });

  it('每个来源都有正权重、正数量与独立保底', () => {
    for (const source of REGION_6_FRAGMENT_LOOT_SOURCES) {
      expect(source.entry.itemId).toBe('frag_shadow');
      expect(source.entry.weight).toBeGreaterThan(0);
      expect(source.entry.minCount).toBeGreaterThan(0);
      expect(source.entry.maxCount).toBeGreaterThanOrEqual(source.entry.minCount);
      expect(source.entry.pityCount).toBeGreaterThan(0);
      expect(region6FragmentLootForTable(source.lootTableId)).toEqual(source.entry);
      expect(region6FragmentLootForTable(source.lootTableId)).not.toBe(source.entry);
    }
  });
});
