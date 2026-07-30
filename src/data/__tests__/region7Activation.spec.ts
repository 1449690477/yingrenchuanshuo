import { describe, expect, it } from 'vitest';
import { EQUIPMENT } from '../equipment';
import { ENHANCE_PROGRESSION } from '../enhanceProgression';
import { ITEMS } from '../items';
import { LOOT_TABLES } from '../lootTables';
import { MONSTERS } from '../monsters';
import { REGION_7, REGION_7_FRAGMENT_ID, REGION_7_SET_SLOTS } from '../region7';
import { REGION_7_FRAGMENT_LOOT_SOURCES } from '../region7Loot';
import { REGIONS } from '../regions';
import { STAGES } from '../stages';

describe('R7 原子激活', () => {
  it('区域、五章、三十关与二十四只怪物同时进入运行时', () => {
    expect(REGIONS.at(-1)).toBe(REGION_7);
    expect(Object.values(STAGES).filter((stage) => stage.chapterId.startsWith('7-'))).toHaveLength(
      30,
    );
    expect(Object.keys(MONSTERS).filter((id) => id.startsWith('mon_7-'))).toHaveLength(24);
    expect(Object.keys(ENHANCE_PROGRESSION).filter((id) => id.startsWith('7-'))).toHaveLength(5);
  });

  it('普通传说只由真实精英与最终 BOSS 产出，血月整件不进入掉落表', () => {
    const bloodmoonIds = new Set(
      REGION_7_SET_SLOTS.map((slot) => `eq_set_region_bloodmoon_${slot}`),
    );
    const legendaryIds = Object.keys(EQUIPMENT).filter((id) =>
      /^eq_r7_.+_legendary$/.test(id),
    );
    expect(legendaryIds).toHaveLength(8);
    expect(
      Object.values(LOOT_TABLES)
        .filter((table) => table.entries.some((entry) => legendaryIds.includes(entry.itemId)))
        .map((table) => table.id),
    ).toEqual(['loot_7-2_elite', 'loot_7-4_elite', 'loot_7-5_elite', 'loot_7-5_boss']);
    for (const table of Object.values(LOOT_TABLES)) {
      expect(table.entries.some((entry) => bloodmoonIds.has(entry.itemId)), table.id).toBe(false);
    }
  });

  it('血月碎片只注入三只精英与最终 BOSS', () => {
    expect(ITEMS[REGION_7_FRAGMENT_ID]?.kind).toBe('fragment');
    expect(REGION_7.chapters.some((chapter) => chapter.materials.includes(REGION_7_FRAGMENT_ID))).toBe(
      false,
    );
    expect(
      Object.values(LOOT_TABLES)
        .filter((table) =>
          table.entries.some((entry) => entry.itemId === REGION_7_FRAGMENT_ID),
        )
        .map((table) => table.id)
        .sort(),
    ).toEqual(REGION_7_FRAGMENT_LOOT_SOURCES.map((source) => source.lootTableId).sort());
  });
});
