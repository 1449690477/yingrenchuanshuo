import { describe, expect, it } from 'vitest';
import { ENCOUNTERS, encounterIdsForProgress } from '../encounters';
import { ALL_CHAPTERS, requireRegionOfChapter } from '../regions';

describe('奇遇章节开放配置', () => {
  it('区域 2 的三个奇遇按 2-2、2-3、2-5 逐步开放', () => {
    expect(encounterIdsForProgress('r2', new Set(['2-1']))).toEqual([]);
    expect(encounterIdsForProgress('r2', new Set(['2-1', '2-2']))).toEqual(['enc_r2_napper']);
    expect(encounterIdsForProgress('r2', new Set(['2-1', '2-2', '2-3']))).toEqual([
      'enc_r2_napper',
      'enc_r2_honey',
    ]);
    expect(encounterIdsForProgress('r2', new Set(['2-1', '2-2', '2-3', '2-4', '2-5']))).toEqual([
      'enc_r2_napper',
      'enc_r2_honey',
      'enc_r2_altar',
    ]);
  });

  it('每项奇遇材料在开放章节或更早章节已有本地区来源', () => {
    for (const encounter of Object.values(ENCOUNTERS)) {
      const unlockChapter = ALL_CHAPTERS.find(
        (chapter) => chapter.id === encounter.unlockChapterId,
      );
      expect(unlockChapter, `${encounter.id} 开放章节不存在`).toBeDefined();
      if (!unlockChapter) continue;

      const region = requireRegionOfChapter(unlockChapter.id);
      expect(encounter.regionIds, `${encounter.id} 开放章节不在配置地区`).toContain(region.id);
      const unlockIndex = region.chapters.findIndex((chapter) => chapter.id === unlockChapter.id);
      const availableMaterials = new Set(
        region.chapters.slice(0, unlockIndex + 1).flatMap((chapter) => chapter.materials),
      );

      for (const choice of encounter.choices) {
        for (const itemId of Object.keys(choice.costs?.items ?? {})) {
          expect(
            availableMaterials.has(itemId),
            `${encounter.id}/${choice.id} 的 ${itemId} 在 ${unlockChapter.id} 尚无来源`,
          ).toBe(true);
        }
      }
    }
  });
});
