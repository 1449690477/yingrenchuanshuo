import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { dropChance, rollLoot, type PityCounters } from '../../core/loot';
import { Rng } from '../../core/rng';
import { CLASS_IDS, type ClassId } from '../../core/types';
import { ITEMS } from '../items';
import { LOOT_TABLES } from '../lootTables';
import { lootTableIdFor } from '../monsters';
import { ALL_CHAPTERS } from '../regions';
import { STAGES } from '../stages';

const REFORGE_MATERIAL_IDS = [
  'sand_crystal',
  'charm_bind',
  'sigil_swordsman',
  'sigil_witch',
  'sigil_shaman',
  'sigil_catkin',
  'sigil_kenshi',
  'crystal_resonance',
] as const;

const SIGIL_BY_CLASS: Readonly<Record<ClassId, string>> = {
  swordsman: 'sigil_swordsman',
  witch: 'sigil_witch',
  shaman: 'sigil_shaman',
  catkin: 'sigil_catkin',
  kenshi: 'sigil_kenshi',
};

describe('词条洗练材料产出', () => {
  it('8 种洗练材料及其正式图标均已登记', () => {
    for (const itemId of REFORGE_MATERIAL_IDS) {
      const item = ITEMS[itemId];
      expect(item, itemId).toBeDefined();
      expect(item!.kind, itemId).toBe('material');
      expect(item!.icon, itemId).toBe(`assets/items/${itemId}.png`);
      expect(existsSync(resolve('public', item!.icon)), `${itemId} → ${item!.icon}`).toBe(true);
    }
  });

  it('每章普通怪产凝晶砂、精英产定契符', () => {
    for (const chapter of ALL_CHAPTERS) {
      const normal = LOOT_TABLES[lootTableIdFor(chapter.id, 'normal')]!;
      const elite = LOOT_TABLES[lootTableIdFor(chapter.id, 'elite')]!;

      const sand = normal.entries.find((entry) => entry.itemId === 'sand_crystal');
      expect(sand, `${chapter.id}/normal 缺少凝晶砂`).toMatchObject({
        weight: 120,
        minCount: 1,
        maxCount: 2,
      });

      const bind = elite.entries.find((entry) => entry.itemId === 'charm_bind');
      expect(bind, `${chapter.id}/elite 缺少定契符`).toMatchObject({
        weight: 18,
        minCount: 1,
        maxCount: 1,
      });
    }
  });

  it('每章 BOSS 仅开放当前职业徽记，并提供低概率、80 点保底的同调结晶', () => {
    for (const chapter of ALL_CHAPTERS) {
      const table = LOOT_TABLES[lootTableIdFor(chapter.id, 'boss')]!;
      const resonance = table.entries.find((entry) => entry.itemId === 'crystal_resonance');
      expect(resonance, `${chapter.id}/boss 缺少同调结晶`).toMatchObject({
        weight: 0.25,
        minCount: 1,
        maxCount: 1,
        pityCount: 80,
      });

      for (const classId of CLASS_IDS) {
        const ownSigil = SIGIL_BY_CLASS[classId];
        const sigilEntry = table.entries.find((entry) => entry.itemId === ownSigil);
        expect(sigilEntry, `${chapter.id}/boss 缺少 ${classId} 徽记`).toMatchObject({
          classId,
          weight: 2,
          minCount: 1,
          maxCount: 1,
        });

        expect(
          dropChance(table, ownSigil, classId),
          `${chapter.id}/${classId} 徽记概率`,
        ).toBeGreaterThan(0);
        expect(
          dropChance(table, 'crystal_resonance', classId),
          `${chapter.id}/${classId} 同调结晶概率`,
        ).toBeGreaterThan(0);
        expect(dropChance(table, 'crystal_resonance', classId)).toBeLessThan(
          dropChance(table, ownSigil, classId),
        );

        for (const foreignClassId of CLASS_IDS.filter((id) => id !== classId)) {
          expect(
            dropChance(table, SIGIL_BY_CLASS[foreignClassId], classId),
            `${chapter.id}/${classId} 不得抽到 ${foreignClassId} 徽记`,
          ).toBe(0);
        }

        const pity: PityCounters = { [`${table.id}:crystal_resonance`]: 80 };
        const forced = rollLoot(table, new Rng(20260728), pity, classId);
        expect(
          forced.some((drop) => drop.itemId === 'crystal_resonance'),
          `${chapter.id}/${classId} 80 点保底未触发`,
        ).toBe(true);
        expect(pity[`${table.id}:crystal_resonance`]).toBe(0);
        expect(
          forced
            .filter((drop) => drop.itemId.startsWith('sigil_'))
            .every((drop) => drop.itemId === ownSigil),
          `${chapter.id}/${classId} 混入其他职业徽记`,
        ).toBe(true);
      }
    }
  });

  it('只有章节最终 BOSS 首通固定给 1 个同调结晶，普通最终关不给', () => {
    for (const chapter of ALL_CHAPTERS) {
      for (let stageIndex = 1; stageIndex <= 6; stageIndex++) {
        const stage = STAGES[`stage_${chapter.id}_${stageIndex}`]!;
        const resonanceRewards = stage.firstClearRewards.filter(
          (reward) => reward.itemId === 'crystal_resonance',
        );

        if (stageIndex === 6 && stage.bossId) {
          expect(resonanceRewards, `${chapter.id} 最终关首通`).toEqual([
            { itemId: 'crystal_resonance', count: 1 },
          ]);
        } else {
          expect(resonanceRewards, `${chapter.id} 第 ${stageIndex} 关不应提前给同调结晶`).toEqual(
            [],
          );
        }
      }
    }
  });
});
