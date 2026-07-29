import { describe, expect, it } from 'vitest';
import { ENHANCE_MATERIAL_IDS } from '../constants';
import { ENHANCE_PROGRESSION } from '../enhanceProgression';
import { REGION_5 } from '../region5';
import { REGION_5_ENHANCE_PROGRESSION } from '../region5EnhanceProgression';

describe('R5 强化成长原子表', () => {
  it('完整覆盖五章，推荐目标不低于 R4 终章且单调上升', () => {
    expect(Object.keys(REGION_5_ENHANCE_PROGRESSION)).toEqual(
      REGION_5.chapters.map((chapter) => chapter.id),
    );

    let previousAll = ENHANCE_PROGRESSION['4-5']!.recommendedAllEnhance;
    let previousMain = ENHANCE_PROGRESSION['4-5']!.recommendedMainEnhance;
    for (const chapter of REGION_5.chapters) {
      const progression = REGION_5_ENHANCE_PROGRESSION[chapter.id]!;
      expect(progression.recommendedAllEnhance).toBeGreaterThanOrEqual(previousAll);
      expect(progression.recommendedMainEnhance).toBeGreaterThanOrEqual(previousMain);
      expect(progression.recommendedMainEnhance).toBeGreaterThanOrEqual(
        progression.recommendedAllEnhance,
      );
      expect(progression.recommendedMainEnhance).toBeLessThanOrEqual(15);
      previousAll = progression.recommendedAllEnhance;
      previousMain = progression.recommendedMainEnhance;
    }
  });

  it('首通强化石逐章、逐关增长，且 R5 首章不低于 R4 终章', () => {
    const r4Final = ENHANCE_PROGRESSION['4-5']!.firstClear.stoneByStage;
    let previousTotal = r4Final.reduce((sum, count) => sum + count, 0);

    for (const chapter of REGION_5.chapters) {
      const stones = REGION_5_ENHANCE_PROGRESSION[chapter.id]!.firstClear.stoneByStage;
      expect(stones).toHaveLength(6);
      stones.forEach((count, index) => {
        expect(count).toBeGreaterThanOrEqual(r4Final[index]!);
        if (index > 0) expect(count).toBeGreaterThanOrEqual(stones[index - 1]!);
      });
      const total = stones.reduce((sum, count) => sum + count, 0);
      expect(total).toBeGreaterThan(previousTotal);
      previousTotal = total;
    }
  });

  it('普通怪只供强化石，高阶材料只进入真实精英/BOSS 表且都有保底', () => {
    for (const chapter of REGION_5.chapters) {
      const progression = REGION_5_ENHANCE_PROGRESSION[chapter.id]!;
      expect(progression.loot.normal.entries).toHaveLength(1);
      expect(progression.loot.normal.entries[0]).toMatchObject({
        itemId: ENHANCE_MATERIAL_IDS.stone,
      });
      expect(progression.loot.normal.entries[0]!.pityCount).toBeUndefined();

      for (const monsterType of ['elite', 'boss'] as const) {
        if (
          (monsterType === 'elite' && !chapter.elite) ||
          (monsterType === 'boss' && !chapter.boss)
        ) {
          expect(progression.loot[monsterType].entries).toEqual([]);
          expect(progression.loot[monsterType].guaranteed).toEqual([]);
          continue;
        }
        for (const drop of progression.loot[monsterType].entries) {
          expect([
            ENHANCE_MATERIAL_IDS.ore,
            ENHANCE_MATERIAL_IDS.lucky,
            ENHANCE_MATERIAL_IDS.protection,
          ]).toContain(drop.itemId);
          expect(drop.pityCount).toBeGreaterThan(0);
        }
      }
    }
  });
});
