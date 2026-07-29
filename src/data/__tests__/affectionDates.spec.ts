import { describe, expect, it } from 'vitest';
import { completeAffectionStory, createAffectionState, isAffectionStoryUnlocked } from '@/core/affection';
import { CLASS_IDS } from '@/core/types';
import { AFFECTION_RULES } from '@/data/affectionRules';
import {
  AFFECTION_CHARACTERS,
  AFFECTION_STORIES,
  affectionMemoryDialogue,
  requireAffectionStory,
} from '../affection';
import {
  AFFECTION_DATES,
  AFFECTION_DATE_SLOT_META,
  AFFECTION_DATE_STORIES,
  affectionDateOrder,
  affectionDateStories,
  findAffectionDate,
} from '../affectionDates';

describe('A-4 约会日程：四角色第十二批约会剧情', () => {
  it('四角色各三幕，依次对应上午/午后/夜晚，时段文案齐备', () => {
    expect(AFFECTION_DATE_STORIES).toHaveLength(12);
    for (const classId of CLASS_IDS) {
      const dates = AFFECTION_DATES[classId];
      expect(dates).toHaveLength(3);
      expect(dates.map((date) => date.slot)).toEqual(['morning', 'afternoon', 'night']);
      for (const date of dates) {
        expect(date.story.classId).toBe(classId);
        const meta = AFFECTION_DATE_SLOT_META[date.slot];
        expect(meta.label.length).toBeGreaterThan(0);
        expect(meta.tagline.length).toBeGreaterThan(0);
      }
    }
  });

  it('幕次 10/11/12，门槛 3000/3500/4100，严格线性前置且一次性 +60', () => {
    for (const classId of CLASS_IDS) {
      const dates = AFFECTION_DATES[classId];
      expect(dates.map((date) => date.story.episode)).toEqual([10, 11, 12]);
      expect(dates.map((date) => date.story.unlockPoints)).toEqual([3_000, 3_500, 4_100]);
      expect(dates.map((date) => date.story.completionPoints)).toEqual([60, 60, 60]);

      const ninth = AFFECTION_CHARACTERS[classId].stories[8]!;
      expect(dates[0]!.story.requiredStoryIds).toEqual([ninth.id]);
      expect(dates[1]!.story.requiredStoryIds).toEqual([dates[0]!.story.id]);
      expect(dates[2]!.story.requiredStoryIds).toEqual([dates[1]!.story.id]);
    }
  });

  it('每幕 2~4 句开场、三等价选择、回应 2~3 句，并各回响第七/八/九幕的真实旧选择', () => {
    for (const date of AFFECTION_DATE_STORIES.map((story) => story)) {
      expect(date.openingDialogue.length).toBeGreaterThanOrEqual(2);
      expect(date.openingDialogue.length).toBeLessThanOrEqual(4);
      expect(date.choices).toHaveLength(3);
      expect(new Set(date.choices.map((choice) => choice.id)).size).toBe(3);
      for (const choice of date.choices) {
        expect(choice.responseDialogue.length).toBeGreaterThanOrEqual(2);
        expect(choice.responseDialogue.length).toBeLessThanOrEqual(3);
      }

      const callbacks = date.memoryCallbacks ?? [];
      expect(callbacks.length).toBeGreaterThanOrEqual(1);
      const characterStories = AFFECTION_CHARACTERS[date.classId].stories;
      for (const callback of callbacks) {
        const source = characterStories.find((story) => story.id === callback.fromStoryId);
        expect(source, `${date.id} 的回响来源必须真实存在`).toBeDefined();
        expect([7, 8, 9]).toContain(source!.episode);
        expect(source!.choices.some((choice) => choice.id === callback.choiceId)).toBe(true);
      }
      // 回响可被实际触发：按来源选择写入历史后，开场前应能取到回响台词
      const history = Object.fromEntries(
        callbacks.map((callback) => [callback.fromStoryId, callback.choiceId]),
      );
      expect(affectionMemoryDialogue(date, history)).toHaveLength(callbacks.length);
    }
  });

  it('第十二幕各绑定一张纯物件 CG，场景与 CG 均为唯一运行时路径', () => {
    const scenes = new Set<string>();
    const cgs: string[] = [];
    for (const classId of CLASS_IDS) {
      const dates = AFFECTION_DATES[classId];
      expect(dates[2]!.story.cgAsset).toBeDefined();
      for (const date of dates) {
        expect(scenes.has(date.story.backgroundAsset)).toBe(false);
        scenes.add(date.story.backgroundAsset);
      }
      cgs.push(dates[2]!.story.cgAsset!);
    }
    expect(new Set(cgs).size).toBe(4);
  });

  it('喵喵三幕依旧全程成年平等搭档表达，无禁忌话术', () => {
    const catkinText = JSON.stringify(AFFECTION_DATES.catkin);
    expect(catkinText).not.toMatch(/主人|宠物|饲养|收养/);
    expect(catkinText).toMatch(/搭档/);
  });

  it('约会剧情并入主数据后可被奖励管线原样查找与解锁', () => {
    for (const classId of CLASS_IDS) {
      expect(affectionDateStories(classId).map((story) => story.episode)).toEqual([10, 11, 12]);
      for (const date of AFFECTION_DATES[classId]) {
        expect(requireAffectionStory(classId, date.story.id)).toBe(date.story);
      }
    }
    expect(AFFECTION_STORIES).toHaveLength(48);
  });

  it('完成奖励严格一次性：心意不足/前置缺失/重复完成全部被拒', () => {
    const story = AFFECTION_DATES.swordsman[0]!.story;
    const state = createAffectionState(Date.parse('2026-07-28T12:00:00+08:00'), AFFECTION_RULES);
    const progress = state.characters.swordsman;

    // 前置缺失：第九幕未完成时即使心意够也不解锁
    progress.points = 5_000;
    expect(isAffectionStoryUnlocked(progress, story)).toBe(false);
    expect(completeAffectionStory(state, 'swordsman', story, 'pick_quiet_color', AFFECTION_RULES).ok).toBe(false);

    // 补上前置后解锁，完成后 +60 且写入选择历史
    progress.completedStoryIds.push('aff_swordsman_09_reciprocal');
    expect(isAffectionStoryUnlocked(progress, story)).toBe(true);
    const completed = completeAffectionStory(
      state,
      'swordsman',
      story,
      'pick_quiet_color',
      AFFECTION_RULES,
    );
    expect(completed.ok).toBe(true);
    if (!completed.ok) return;
    expect(completed.gainedPoints).toBe(60);
    expect(completed.state.characters.swordsman.points).toBe(5_060);
    expect(completed.state.characters.swordsman.choiceHistory[story.id]).toBe('pick_quiet_color');

    // 重复完成被拒：回看零奖励
    expect(
      completeAffectionStory(completed.state, 'swordsman', story, 'let_her_test_swing', AFFECTION_RULES),
    ).toEqual({ ok: false, reason: 'already-completed' });
  });

  it('约会查找助手：findAffectionDate 与 affectionDateOrder 行为稳定', () => {
    for (const classId of CLASS_IDS) {
      AFFECTION_DATES[classId].forEach((date, index) => {
        expect(findAffectionDate(date.story.id)).toBe(date);
        expect(affectionDateOrder(date.story.id)).toBe(index);
      });
    }
    expect(findAffectionDate('aff_swordsman_01_dawn')).toBeNull();
    expect(affectionDateOrder('aff_swordsman_01_dawn')).toBe(-1);
    expect(findAffectionDate('not_a_story')).toBeNull();
  });

  it('R1 演出标注：每幕都有逐句心情 cue 与强调标记，且标记全部闭合', () => {
    const VALID_MOODS = new Set(['calm', 'bright', 'shy', 'moved', 'playful']);
    for (const story of AFFECTION_DATE_STORIES) {
      const allLines = [
        ...story.openingDialogue,
        ...story.choices.flatMap((choice) => choice.responseDialogue),
        ...(story.memoryCallbacks ?? []).flatMap((callback) => callback.dialogue),
      ];
      const moodLines = allLines.filter((line) => line.mood !== undefined);
      expect(moodLines.length, story.id).toBeGreaterThanOrEqual(2);
      for (const line of moodLines) {
        expect(VALID_MOODS.has(line.mood!), `${story.id} ${line.mood}`).toBe(true);
      }
      // 每幕至少一处《…》强调，且全部成对闭合、内容非空
      const emphasized = allLines.filter((line) => line.text.includes('《'));
      expect(emphasized.length, story.id).toBeGreaterThanOrEqual(1);
      for (const line of allLines) {
        const opens = line.text.split('《').length - 1;
        const closes = line.text.split('》').length - 1;
        expect(opens, `${story.id}: ${line.text}`).toBe(closes);
        expect(line.text, story.id).not.toContain('《》');
      }
      // 记忆回响保持纯文本：那是她说过的原话，不加演出
      for (const callback of story.memoryCallbacks ?? []) {
        for (const line of callback.dialogue) {
          expect(line.text, `${story.id} memoryCallback`).not.toContain('《');
          expect(line.mood, `${story.id} memoryCallback`).toBeUndefined();
        }
      }
    }
  });
});
