import { describe, expect, it } from 'vitest';
import { EQUIPMENT } from '../equipment';
import { ENHANCE_PROGRESSION } from '../enhanceProgression';
import { ITEMS } from '../items';
import { LOOT_TABLES } from '../lootTables';
import { MONSTERS } from '../monsters';
import { REGION_5, REGION_5_FRAGMENT_ID, REGION_5_SET_SLOTS } from '../region5';
import { REGION_5_FRAGMENT_LOOT_SOURCES } from '../region5Loot';
import { REGIONS } from '../regions';
import { STAGES } from '../stages';

describe('R5 原子激活', () => {
  it('区域、五章、三十关与二十四只怪物同时进入运行时', () => {
    expect(REGIONS.at(-1)).toBe(REGION_5);
    expect(REGION_5.chapters).toHaveLength(5);
    expect(Object.values(STAGES).filter((stage) => stage.chapterId.startsWith('5-'))).toHaveLength(
      30,
    );
    expect(Object.keys(MONSTERS).filter((id) => id.startsWith('mon_5-'))).toHaveLength(24);
    expect(
      Object.keys(ENHANCE_PROGRESSION).filter((id) => id.startsWith('5-')),
    ).toHaveLength(5);
  });

  it('普通传说只由真实最终 BOSS 表产出，绯焰整件不进入任何掉落表', () => {
    const crimsonIds = new Set(
      REGION_5_SET_SLOTS.map((slot) => `eq_set_region_crimson_${slot}`),
    );
    const legendaryIds = Object.keys(EQUIPMENT).filter((id) =>
      /^eq_r5_.+_legendary$/.test(id),
    );
    expect(legendaryIds).toHaveLength(8);

    const directDropTables = Object.values(LOOT_TABLES).filter((table) =>
      table.entries.some((entry) => legendaryIds.includes(entry.itemId)),
    );
    expect(directDropTables.map((table) => table.id)).toEqual(['loot_5-5_boss']);
    expect(LOOT_TABLES['loot_5-5_boss']?.pityGroups).toEqual([
      {
        id: 'r5-legendary',
        pityCount: 240,
        itemIds: legendaryIds,
      },
    ]);
    for (const table of Object.values(LOOT_TABLES)) {
      expect(
        table.entries.some((entry) => crimsonIds.has(entry.itemId)),
        table.id,
      ).toBe(false);
    }
  });

  it('通用碎片只注入三只真实精英和最终 BOSS，章节材料中没有碎片', () => {
    expect(ITEMS[REGION_5_FRAGMENT_ID]?.kind).toBe('fragment');
    expect(
      REGION_5.chapters.some((chapter) =>
        chapter.materials.includes(REGION_5_FRAGMENT_ID),
      ),
    ).toBe(false);
    expect(
      Object.values(LOOT_TABLES)
        .filter((table) =>
          table.entries.some((entry) => entry.itemId === REGION_5_FRAGMENT_ID),
        )
        .map((table) => table.id)
        .sort(),
    ).toEqual(
      REGION_5_FRAGMENT_LOOT_SOURCES.map((source) => source.lootTableId).sort(),
    );
  });
});
