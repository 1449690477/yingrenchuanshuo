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

  it('两条角色线各有三幕主线与一件日常，前置和记忆回调都指向合法选择', () => {
    for (const characterId of ['char_akane', 'char_sui']) {
      const arcs = Object.values(ENCOUNTERS)
        .filter((encounter) => encounter.storyArc?.characterId === characterId)
        .sort((a, b) => a.storyArc!.episode - b.storyArc!.episode);
      expect(
        arcs.map((encounter) => encounter.storyArc!.episode),
        characterId,
      ).toEqual([1, 2, 3, 4]);
      expect(arcs.slice(0, 3).every((encounter) => !encounter.storyArc!.repeatable)).toBe(true);
      expect(arcs[3]?.storyArc?.repeatable).toBe(true);

      for (const [index, encounter] of arcs.entries()) {
        const arc = encounter.storyArc!;
        expect(new Set(arc.storyChoices.map((choice) => choice.id)).size).toBe(2);
        expect(arc.storyChoices.every((choice) => choice.responseDialogue.length > 0)).toBe(true);
        if (index === 0) expect(arc.requiredEncounterIds).toEqual([]);
        else expect(arc.requiredEncounterIds).toEqual([arcs[index - 1]!.id]);

        for (const callback of arc.memoryCallbacks ?? []) {
          expect(arc.requiredEncounterIds).toContain(callback.fromEncounterId);
          const source = ENCOUNTERS[callback.fromEncounterId];
          expect(source?.storyArc?.characterId).toBe(characterId);
          expect(
            source?.storyArc?.storyChoices.some((choice) => choice.id === callback.choiceId),
          ).toBe(true);
          expect(callback.dialogue.length).toBeGreaterThan(0);
        }
      }
      expect(
        arcs.slice(1, 3).every((encounter) => encounter.storyArc!.memoryCallbacks?.length),
      ).toBe(true);
    }
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
