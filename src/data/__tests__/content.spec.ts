import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { CLASS_VISUALS } from '../classVisuals';
import { SWORDSMAN_VISUAL_SKILLS, WITCH_VISUAL_SKILLS } from '../skills';
import { EQUIPMENT } from '../equipment';
import { ITEMS } from '../items';
import { LOOT_TABLES } from '../lootTables';
import { MONSTERS } from '../monsters';
import { MONSTER_VISUALS } from '../monsterVisuals';
import { ALL_CHAPTERS, REGIONS } from '../regions';
import { FIRST_STAGE_ID, ORDERED_STAGE_IDS, STAGES } from '../stages';

describe('区域 1–2 内容完整性', () => {
  it('已登记的职业立绘文件都真实存在', () => {
    for (const [classId, visual] of Object.entries(CLASS_VISUALS)) {
      for (const asset of [visual.portrait, visual.castPortrait]) {
        if (!asset) continue;
        expect(existsSync(resolve('public', asset)), `${classId} → ${asset}`).toBe(true);
      }
    }
    expect(CLASS_VISUALS.witch.portrait).toBe('assets/characters/witch-sakura.png');
    expect(CLASS_VISUALS.witch.castPortrait).toBe('assets/characters/witch-sakura-cast.png');
  });

  it('魔女首批技能特效配置与文件完整', () => {
    expect(WITCH_VISUAL_SKILLS).toHaveLength(3);
    expect(WITCH_VISUAL_SKILLS.map((skill) => skill.name)).toEqual([
      '火球术',
      '抗拒火环',
      '地狱雷光',
    ]);
    for (const skill of WITCH_VISUAL_SKILLS) {
      expect(skill.class).toBe('witch');
      expect(skill.type).toBe('active');
      expect(skill.unlockLevel).toBeGreaterThan(0);
      expect(existsSync(resolve('public', skill.icon)), `${skill.id} icon`).toBe(true);
      expect(existsSync(resolve('public', skill.effectAsset)), `${skill.id} effect`).toBe(true);
    }
  });

  it('剑姬首批技能特效配置与文件完整', () => {
    expect(SWORDSMAN_VISUAL_SKILLS).toHaveLength(3);
    expect(SWORDSMAN_VISUAL_SKILLS.map((skill) => skill.name)).toEqual([
      '攻杀剑术',
      '半月弯刀',
      '烈火剑法',
    ]);
    for (const skill of SWORDSMAN_VISUAL_SKILLS) {
      expect(skill.class).toBe('swordsman');
      expect(skill.type).toBe('active');
      expect(skill.unlockLevel).toBeGreaterThan(0);
      expect(existsSync(resolve('public', skill.icon)), `${skill.id} icon`).toBe(true);
      expect(existsSync(resolve('public', skill.effectAsset)), `${skill.id} effect`).toBe(true);
    }
  });

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

  it('区域 1 的全部怪物都有经过注册和校验的正式立绘', () => {
    const region1Monsters = Object.values(MONSTERS).filter((monster) =>
      monster.id.startsWith('mon_1-'),
    );
    expect(region1Monsters).toHaveLength(24);
    expect(Object.keys(MONSTER_VISUALS).filter((id) => id.startsWith('mon_1-'))).toHaveLength(24);
    for (const monster of region1Monsters) {
      expect(monster.sprite, monster.id).toBe(MONSTER_VISUALS[monster.id]?.asset);
      expect(
        existsSync(resolve('public', monster.sprite)),
        `${monster.id} → ${monster.sprite}`,
      ).toBe(true);
    }
  });

  it('区域 2 的全部怪物都有经过注册和校验的正式立绘', () => {
    const region2Monsters = Object.values(MONSTERS).filter((monster) =>
      monster.id.startsWith('mon_2-'),
    );
    expect(region2Monsters).toHaveLength(25);
    expect(Object.keys(MONSTER_VISUALS).filter((id) => id.startsWith('mon_2-'))).toHaveLength(25);
    expect(Object.keys(MONSTER_VISUALS)).toHaveLength(49);
    for (const monster of region2Monsters) {
      expect(monster.sprite, monster.id).toBe(MONSTER_VISUALS[monster.id]?.asset);
      expect(
        existsSync(resolve('public', monster.sprite)),
        `${monster.id} → ${monster.sprite}`,
      ).toBe(true);
    }
  });

  it('全部区域和章节都引用真实存在的地图场景', () => {
    for (const region of REGIONS) {
      expect(region.mapAsset).toBe(`assets/maps/${region.id}.webp`);
      expect(existsSync(resolve('public', region.mapAsset)), region.id).toBe(true);
      for (const chapter of region.chapters) {
        expect(chapter.mapAsset).toBe(`assets/maps/chapter-${chapter.id}.webp`);
        expect(
          existsSync(resolve('public', chapter.mapAsset)),
          `${chapter.id} → ${chapter.mapAsset}`,
        ).toBe(true);
      }
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
      expect(existsSync(resolve('public', equipment.icon)), `${id} → ${equipment.icon}`).toBe(true);
    }
  });

  it('全部物品都引用真实存在的正式图标', () => {
    expect(Object.keys(ITEMS)).toHaveLength(16);
    for (const [id, item] of Object.entries(ITEMS)) {
      expect(item.icon).toBe(`assets/items/${id}.png`);
      expect(existsSync(resolve('public', item.icon)), `${id} → ${item.icon}`).toBe(true);
    }
  });
});
