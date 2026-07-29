import { describe, expect, it } from 'vitest';
import type { MonsterType } from '@/core/types';
import { rollLoot, type PityCounters } from '@/core/loot';
import { Rng } from '@/core/rng';
import { EQUIPMENT } from '../equipment';
import { requireItem } from '../items';
import { LOOT_TABLES, requireLootTable } from '../lootTables';
import { lootTableIdFor, MONSTERS } from '../monsters';
import { ALL_CHAPTERS } from '../regions';
import { REGION_MATERIAL_TIER_BY_MONSTER_TYPE } from '../materialSources';

const MONSTER_TYPES = ['normal', 'elite', 'boss'] as const satisfies readonly MonsterType[];

describe('章节区域材料掉落表', () => {
  it('区域 3/4 的真实普通怪、精英与 BOSS 使用完整的精良至史诗装备矩阵', () => {
    const expectedWeights = {
      normal: { fine: 3, rare: 0.6 },
      elite: { fine: 20, rare: 8, epic: 1 },
      boss: { fine: 20, rare: 40, epic: 12 },
    } as const;

    for (const chapter of ALL_CHAPTERS.filter(
      (candidate) => candidate.id.startsWith('3-') || candidate.id.startsWith('4-'),
    )) {
      const regionId = chapter.id.startsWith('3-') ? 'r3' : 'r4';

      for (const monsterType of MONSTER_TYPES) {
        const table = requireLootTable(lootTableIdFor(chapter.id, monsterType));
        const regionalEquipmentEntries = table.entries.filter((entry) =>
          entry.itemId.startsWith(`eq_${regionId}_`),
        );
        const hasRealSource =
          monsterType === 'normal' ||
          (monsterType === 'elite' && Boolean(chapter.elite)) ||
          (monsterType === 'boss' && Boolean(chapter.boss));
        if (!hasRealSource) {
          expect(regionalEquipmentEntries, `${chapter.id}/${monsterType} 空表不得暗投装备`).toEqual(
            [],
          );
          continue;
        }
        const expectedByQuality = expectedWeights[monsterType];

        expect(
          [...new Set(regionalEquipmentEntries.map((entry) => EQUIPMENT[entry.itemId]?.quality))]
            .sort(),
          `${chapter.id}/${monsterType} 品质`,
        ).toEqual(Object.keys(expectedByQuality).sort());

        for (const [quality, totalWeight] of Object.entries(expectedByQuality)) {
          const entries = regionalEquipmentEntries.filter(
            (entry) => EQUIPMENT[entry.itemId]?.quality === quality,
          );
          expect(entries, `${chapter.id}/${monsterType}/${quality} 八部位`).toHaveLength(8);
          expect(
            entries.reduce((sum, entry) => sum + entry.weight, 0),
            `${chapter.id}/${monsterType}/${quality} 总权重`,
          ).toBeCloseTo(totalWeight);

          for (const entry of entries) {
            expect(entry.weight).toBeCloseTo(totalWeight / 8);
            expect(entry.minCount).toBe(1);
            expect(entry.maxCount).toBe(1);
            expect(entry.pityCount).toBe(
              monsterType === 'boss' && quality === 'epic' ? 30 : undefined,
            );
          }
        }
      }
    }
  });

  it('区域 3/4 的 16 件精良装备均能从真实登场怪物的掉落表获得', () => {
    const reachableLootTableIds = new Set(
      Object.values(MONSTERS).map((monster) => monster.lootTableId),
    );
    const fineDefinitions = Object.values(EQUIPMENT).filter(
      (definition) =>
        (definition.id.startsWith('eq_r3_') || definition.id.startsWith('eq_r4_')) &&
        definition.quality === 'fine',
    );

    expect(fineDefinitions).toHaveLength(16);
    for (const definition of fineDefinitions) {
      const reachableSources = Object.values(LOOT_TABLES).filter(
        (table) =>
          reachableLootTableIds.has(table.id) &&
          table.entries.some((entry) => entry.itemId === definition.id),
      );
      expect(reachableSources.length, `${definition.id} 没有真实怪物来源`).toBeGreaterThan(0);
    }
  });

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
      { chapterId: '5-5', materialId: 'core_moltenheart' },
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
