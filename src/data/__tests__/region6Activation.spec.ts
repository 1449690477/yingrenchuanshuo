import { describe, expect, it } from 'vitest';
import { EQUIPMENT } from '../equipment';
import { ENHANCE_PROGRESSION } from '../enhanceProgression';
import { ITEMS } from '../items';
import { LOOT_TABLES } from '../lootTables';
import { MONSTERS } from '../monsters';
import { REGION_6, REGION_6_FRAGMENT_ID, REGION_6_SET_SLOTS } from '../region6';
import { REGION_6_FRAGMENT_LOOT_SOURCES } from '../region6Loot';
import { REGIONS } from '../regions';
import { STAGES } from '../stages';

describe('R6 原子激活', () => {
  it('区域、五章、三十关与二十四只怪物同时进入运行时', () => {
    expect(REGIONS.at(-1)).toBe(REGION_6);
    expect(Object.values(STAGES).filter((stage) => stage.chapterId.startsWith('6-'))).toHaveLength(
      30,
    );
    expect(Object.keys(MONSTERS).filter((id) => id.startsWith('mon_6-'))).toHaveLength(24);
    expect(Object.keys(ENHANCE_PROGRESSION).filter((id) => id.startsWith('6-'))).toHaveLength(5);
  });

  it('普通传说只由最终 BOSS 产出，幽影整件不进入掉落表', () => {
    const shadowIds = new Set(
      REGION_6_SET_SLOTS.map((slot) => `eq_set_region_shadow_${slot}`),
    );
    const legendaryIds = Object.keys(EQUIPMENT).filter((id) =>
      /^eq_r6_.+_legendary$/.test(id),
    );
    expect(legendaryIds).toHaveLength(8);
    expect(
      Object.values(LOOT_TABLES)
        .filter((table) => table.entries.some((entry) => legendaryIds.includes(entry.itemId)))
        .map((table) => table.id),
    ).toEqual(['loot_6-5_boss']);
    for (const table of Object.values(LOOT_TABLES)) {
      expect(table.entries.some((entry) => shadowIds.has(entry.itemId)), table.id).toBe(false);
    }
  });

  it('幽影碎片只注入三只精英与最终 BOSS', () => {
    expect(ITEMS[REGION_6_FRAGMENT_ID]?.kind).toBe('fragment');
    expect(REGION_6.chapters.some((chapter) => chapter.materials.includes(REGION_6_FRAGMENT_ID))).toBe(
      false,
    );
    expect(
      Object.values(LOOT_TABLES)
        .filter((table) =>
          table.entries.some((entry) => entry.itemId === REGION_6_FRAGMENT_ID),
        )
        .map((table) => table.id)
        .sort(),
    ).toEqual(REGION_6_FRAGMENT_LOOT_SOURCES.map((source) => source.lootTableId).sort());
  });
});
