import { describe, expect, it } from 'vitest';
import type { MonsterType } from '@/core/types';
import { rollLoot, type PityCounters } from '@/core/loot';
import { Rng } from '@/core/rng';
import { requireItem } from '../items';
import { requireLootTable } from '../lootTables';
import { lootTableIdFor } from '../monsters';
import { ALL_CHAPTERS } from '../regions';
import { REGION_MATERIAL_TIER_BY_MONSTER_TYPE } from '../materialSources';

const MONSTER_TYPES = ['normal', 'elite', 'boss'] as const satisfies readonly MonsterType[];

describe('章节区域材料掉落表', () => {
  it('普通 / 精英 / BOSS 只接收 common / fine / rare，不再复制章节全量材料', () => {
    for (const chapter of ALL_CHAPTERS) {
      for (const monsterType of MONSTER_TYPES) {
        const table = requireLootTable(lootTableIdFor(chapter.id, monsterType));
        const expectedTier = REGION_MATERIAL_TIER_BY_MONSTER_TYPE[monsterType];
        const expectedIds = chapter.materials.filter(
          (materialId) => requireItem(materialId).tier === expectedTier,
        );
        const actualIds = table.entries
          .filter((entry) => chapter.materials.includes(entry.itemId))
          .map((entry) => entry.itemId);

        expect(actualIds, `${chapter.id}/${monsterType}`).toEqual(expectedIds);
        for (const entry of table.entries.filter((candidate) =>
          actualIds.includes(candidate.itemId),
        )) {
          expect(entry.minCount).toBe(monsterType === 'boss' ? 3 : 1);
          expect(entry.maxCount).toBe(
            monsterType === 'boss' ? 6 : monsterType === 'elite' ? 3 : 2,
          );
          if (monsterType !== 'boss') {
            expect(entry.pityCount).toBeUndefined();
          }
        }
      }
    }
  });

  it('所有已开放 rare 区域材料只存在于 BOSS 表，且 12 次保底真实触发', () => {
    const rareSources = ALL_CHAPTERS.flatMap((chapter) =>
      chapter.materials
        .filter((materialId) => requireItem(materialId).tier === 'rare')
        .map((materialId) => ({ chapterId: chapter.id, materialId })),
    );

    expect(rareSources).toEqual([
      { chapterId: '1-5', materialId: 'core_barrier' },
      { chapterId: '2-5', materialId: 'crystal_altar' },
      { chapterId: '3-5', materialId: 'egg_broodmother' },
      { chapterId: '4-5', materialId: 'tear_eternal' },
    ]);

    for (const { chapterId, materialId } of rareSources) {
      for (const monsterType of ['normal', 'elite'] as const) {
        expect(
          requireLootTable(lootTableIdFor(chapterId, monsterType)).entries.some(
            (entry) => entry.itemId === materialId,
          ),
        ).toBe(false);
      }

      const table = requireLootTable(lootTableIdFor(chapterId, 'boss'));
      const entry = table.entries.find((candidate) => candidate.itemId === materialId);
      expect(entry?.pityCount, `${chapterId}/${materialId}`).toBe(12);

      const pity: PityCounters = { [`${table.id}:${materialId}`]: 12 };
      const result = rollLoot(table, new Rng(20260729), pity, 'swordsman');
      expect(result.some((drop) => drop.itemId === materialId)).toBe(true);
      expect(pity[`${table.id}:${materialId}`]).toBe(0);
    }
  });

  it('3-4 没有精英时不再展示或暗投蛛丝束', () => {
    const chapter = ALL_CHAPTERS.find((candidate) => candidate.id === '3-4');
    expect(chapter?.elite).toBeUndefined();
    expect(chapter?.materials).toEqual(['chitin_wing', 'moss_cave']);
    for (const monsterType of MONSTER_TYPES) {
      expect(
        requireLootTable(lootTableIdFor('3-4', monsterType)).entries.some(
          (entry) => entry.itemId === 'silk_spider',
        ),
      ).toBe(false);
    }
  });
});
