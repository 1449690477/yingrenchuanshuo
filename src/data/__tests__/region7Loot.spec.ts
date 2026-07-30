import { describe, expect, it } from 'vitest';
import { REGION_7 } from '../region7';
import {
  REGION_7_FRAGMENT_LOOT_SOURCES,
  region7FragmentLootForTable,
} from '../region7Loot';

describe('R7 血月碎片独立来源', () => {
  it('与区域登记的三只精英和最终 BOSS 完全一致', () => {
    const declared = REGION_7.chapters.flatMap((chapter) => [
      ...(chapter.elite ? [`mon_${chapter.id}_elite`] : []),
      ...(chapter.boss ? [`mon_${chapter.id}_boss`] : []),
    ]);
    expect(REGION_7_FRAGMENT_LOOT_SOURCES.map((source) => source.monsterId)).toEqual(declared);
  });

  it('每个来源都有正权重、正数量与独立保底', () => {
    for (const source of REGION_7_FRAGMENT_LOOT_SOURCES) {
      expect(source.entry.itemId).toBe('frag_bloodmoon');
      expect(source.entry.weight).toBeGreaterThan(0);
      expect(source.entry.minCount).toBeGreaterThan(0);
      expect(source.entry.maxCount).toBeGreaterThanOrEqual(source.entry.minCount);
      expect(source.entry.pityCount).toBeGreaterThan(0);
      expect(region7FragmentLootForTable(source.lootTableId)).toEqual(source.entry);
      expect(region7FragmentLootForTable(source.lootTableId)).not.toBe(source.entry);
    }
  });
});
