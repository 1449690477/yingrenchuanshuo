import { describe, expect, it } from 'vitest';
import { ENHANCE_MATERIAL_IDS } from '../constants';
import { ENHANCE_PROGRESSION } from '../enhanceProgression';
import { REGION_7 } from '../region7';
import { REGION_7_ENHANCE_PROGRESSION } from '../region7EnhanceProgression';

describe('R7 强化成长原子表', () => {
  it('覆盖五章并从 R6 终章单调接续', () => {
    expect(Object.keys(REGION_7_ENHANCE_PROGRESSION)).toEqual(
      REGION_7.chapters.map((chapter) => chapter.id),
    );
    let previousAll = ENHANCE_PROGRESSION['6-5']!.recommendedAllEnhance;
    let previousMain = ENHANCE_PROGRESSION['6-5']!.recommendedMainEnhance;
    for (const chapter of REGION_7.chapters) {
      const progression = REGION_7_ENHANCE_PROGRESSION[chapter.id]!;
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

  it('首通强化石逐章、逐关增长', () => {
    let previousTotal = ENHANCE_PROGRESSION['6-5']!.firstClear.stoneByStage.reduce(
      (sum, count) => sum + count,
      0,
    );
    for (const chapter of REGION_7.chapters) {
      const stones = REGION_7_ENHANCE_PROGRESSION[chapter.id]!.firstClear.stoneByStage;
      expect(stones).toHaveLength(6);
      stones.forEach((count, index) => {
        if (index > 0) expect(count).toBeGreaterThanOrEqual(stones[index - 1]!);
      });
      const total = stones.reduce((sum, count) => sum + count, 0);
      expect(total).toBeGreaterThan(previousTotal);
      previousTotal = total;
    }
  });

  it('普通怪只供强化石，高阶材料只进入真实精英与 BOSS 表且有保底', () => {
    for (const chapter of REGION_7.chapters) {
      const progression = REGION_7_ENHANCE_PROGRESSION[chapter.id]!;
      expect(progression.loot.normal.entries).toHaveLength(1);
      expect(progression.loot.normal.entries[0]?.itemId).toBe(ENHANCE_MATERIAL_IDS.stone);
      for (const monsterType of ['elite', 'boss'] as const) {
        if (
          (monsterType === 'elite' && !chapter.elite) ||
          (monsterType === 'boss' && !chapter.boss)
        ) {
          expect(progression.loot[monsterType].entries).toEqual([]);
          continue;
        }
        for (const drop of progression.loot[monsterType].entries) {
          expect(drop.pityCount).toBeGreaterThan(0);
        }
      }
    }
  });
});
