import { describe, expect, it } from 'vitest';
import { EQUIPMENT } from '../equipment';
import { ITEMS } from '../items';
import { LOOT_TABLES } from '../lootTables';
import { MONSTERS } from '../monsters';
import { ALL_CHAPTERS, REGIONS } from '../regions';
import { FIRST_STAGE_ID, ORDERED_STAGE_IDS, STAGES } from '../stages';

describe('区域 1–2 内容完整性', () => {
  it('数量达到 M2 内容目标', () => {
    expect(REGIONS).toHaveLength(2);
    expect(ALL_CHAPTERS).toHaveLength(10);
    expect(Object.keys(STAGES)).toHaveLength(60);
    expect(Object.keys(MONSTERS)).toHaveLength(49);
    expect(Object.keys(EQUIPMENT)).toHaveLength(48);
    expect(Object.keys(LOOT_TABLES)).toHaveLength(30);
  });

  it('所有 id 唯一且关卡顺序从第一关开始', () => {
    expect(new Set(ORDERED_STAGE_IDS).size).toBe(ORDERED_STAGE_IDS.length);
    expect(FIRST_STAGE_ID).toBe('stage_1-1_1');
    expect(ORDERED_STAGE_IDS[0]).toBe(FIRST_STAGE_ID);
  });

  it('每关都引用存在的章节、怪物和掉落表', () => {
    const chapterIds = new Set(ALL_CHAPTERS.map((chapter) => chapter.id));
    for (const stage of Object.values(STAGES)) {
      expect(chapterIds.has(stage.chapterId), stage.id).toBe(true);
      expect(stage.waves.length, stage.id).toBeGreaterThan(0);
      expect(LOOT_TABLES[stage.lootTableId], stage.id).toBeDefined();
      expect(stage.firstClearRewards.length, stage.id).toBeGreaterThan(0);
      for (const reward of stage.firstClearRewards) {
        expect(
          EQUIPMENT[reward.itemId] ?? ITEMS[reward.itemId],
          `${stage.id} 首通奖励 → ${reward.itemId}`,
        ).toBeDefined();
        expect(reward.count).toBeGreaterThan(0);
      }

      const waveMonsterIds = stage.waves.flatMap((wave) =>
        wave.monsters.map((monster) => monster.id),
      );
      expect(waveMonsterIds.length, stage.id).toBeGreaterThan(0);
      for (const monsterId of waveMonsterIds) {
        expect(MONSTERS[monsterId], `${stage.id} → ${monsterId}`).toBeDefined();
      }
      if (stage.bossId) {
        expect(MONSTERS[stage.bossId]?.type, stage.id).toBe('boss');
        expect(waveMonsterIds, stage.id).toContain(stage.bossId);
      }
    }
  });

  it('每只怪物都引用存在的掉落表', () => {
    for (const monster of Object.values(MONSTERS)) {
      expect(LOOT_TABLES[monster.lootTableId], monster.id).toBeDefined();
      expect(monster.level).toBeGreaterThan(0);
    }
  });

  it('所有掉落项都能解析成装备或物品，权重和数量合法', () => {
    for (const table of Object.values(LOOT_TABLES)) {
      expect(table.rolls).toBeGreaterThanOrEqual(0);
      expect(table.entries.length, table.id).toBeGreaterThan(0);
      for (const entry of [...table.entries, ...(table.guaranteed ?? [])]) {
        expect(
          EQUIPMENT[entry.itemId] ?? ITEMS[entry.itemId],
          `${table.id} → ${entry.itemId}`,
        ).toBeDefined();
        expect(entry.weight).toBeGreaterThanOrEqual(0);
        expect(entry.minCount).toBeGreaterThan(0);
        expect(entry.maxCount).toBeGreaterThanOrEqual(entry.minCount);
      }
    }
  });

  it('装备定义满足槽位、等级和品质基本约束', () => {
    for (const [id, equipment] of Object.entries(EQUIPMENT)) {
      expect(equipment.id).toBe(id);
      expect(equipment.level).toBeGreaterThan(0);
      expect(equipment.name.length).toBeGreaterThan(0);
      expect(equipment.icon.length).toBeGreaterThan(0);
    }
  });
});
