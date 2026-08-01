import { describe, expect, it } from 'vitest';
import { CLASS_IDS } from '@/core/types';
import { AFFECTION_CHARACTERS } from '../affection';
import { AFFECTION_INTERLUDES, affectionInterludesForClass } from '../affectionInterludes';
import { AFFECTION_LETTERS, affectionLettersForClass } from '../affectionLetters';
import { AFFECTION_RULES } from '../affectionRules';

const COMPLETE_AFFECTION_CLASS_IDS = CLASS_IDS.filter((classId) => classId !== 'kenshi');

describe('Galgame R2a 陪伴内容数据', () => {
  it('四角色每个好感阶段各有 4 段闲聊，共 96 段', () => {
    expect(AFFECTION_INTERLUDES).toHaveLength(96);
    expect(new Set(AFFECTION_INTERLUDES.map((entry) => entry.id)).size).toBe(96);

    for (const classId of COMPLETE_AFFECTION_CLASS_IDS) {
      const entries = affectionInterludesForClass(classId);
      expect(entries).toHaveLength(24);
      for (const tier of AFFECTION_RULES.tiers) {
        const pool = entries.filter((entry) => entry.tierId === tier.id);
        expect(pool, `${classId}/${tier.id}`).toHaveLength(4);
        expect(pool.every((entry) => entry.minPoints === tier.minPoints)).toBe(true);
        expect(pool.every((entry) => entry.tierLabel === tier.label)).toBe(true);
      }
    }
    expect(affectionInterludesForClass('kenshi')).toEqual([]);
  });

  it('每段闲聊均为 2 句微剧情，带角色心情且没有奖励/次数配置', () => {
    for (const entry of AFFECTION_INTERLUDES) {
      expect(entry.title.trim().length, entry.id).toBeGreaterThan(2);
      expect(entry.dialogue).toHaveLength(2);
      expect(entry.dialogue[0]!.speaker, entry.id).toBeUndefined();
      expect(entry.dialogue[1]!.speaker, entry.id).toBeTruthy();
      expect(
        entry.dialogue.every((line) => line.text.trim().length > 8),
        entry.id,
      ).toBe(true);
      expect(JSON.stringify(entry), entry.id).not.toMatch(/reward|points|count|金币|战力/);
    }
  });

  it('四角色各有 4 封关键剧情来信，每封完整覆盖来源剧情的三个真实选项', () => {
    expect(AFFECTION_LETTERS).toHaveLength(16);
    expect(new Set(AFFECTION_LETTERS.map((entry) => entry.id)).size).toBe(16);

    for (const classId of COMPLETE_AFFECTION_CLASS_IDS) {
      const letters = affectionLettersForClass(classId);
      expect(letters).toHaveLength(4);
      expect(letters.map((entry) => entry.sourceEpisode)).toEqual([3, 6, 9, 12]);

      for (const entry of letters) {
        const source = AFFECTION_CHARACTERS[classId].stories.find(
          (story) => story.id === entry.requiredStoryId,
        );
        expect(source, entry.id).toBeDefined();
        expect(entry.variants.map((variant) => variant.choiceId).sort()).toEqual(
          source!.choices.map((choice) => choice.id).sort(),
        );
        for (const variant of entry.variants) {
          expect(variant.paragraphs).toHaveLength(2);
          expect(variant.paragraphs.every((paragraph) => paragraph.length >= 24)).toBe(true);
        }
      }
    }
  });

  it('来信保持第一人称回应与纯陪伴定位，不夹带数值奖励', () => {
    const text = JSON.stringify(AFFECTION_LETTERS);
    expect(text).toMatch(/我/);
    expect(text).not.toMatch(/金币|战力|掉落|奖励|抽取|购买/);
  });

  it('喵喵保持成年、平等搭档边界，不使用支配或宠物化称呼', () => {
    const catkinText = JSON.stringify([
      ...affectionInterludesForClass('catkin'),
      ...affectionLettersForClass('catkin'),
    ]);
    expect(catkinText).not.toMatch(/主人|宠物|饲养|收养|服从|命令我/);
    expect(catkinText).toMatch(/搭档|平等/);
  });
});
