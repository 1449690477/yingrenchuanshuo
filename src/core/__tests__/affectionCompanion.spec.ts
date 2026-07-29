import { describe, expect, it } from 'vitest';
import {
  currentAffectionInterludePool,
  isAffectionMemoryUnlocked,
  resolveAffectionLetterVariant,
  selectAffectionInterlude,
  unlockedAffectionLetters,
  type AffectionCompanionProgress,
} from '../affectionCompanion';

const progress: AffectionCompanionProgress = {
  points: 250,
  totalInteractions: 7,
  completedStoryIds: ['story_01', 'story_02'],
  choiceHistory: {
    story_01: 'choice_a',
    story_02: 'choice_b',
  },
};

describe('好感陪伴 R2 纯逻辑', () => {
  const interludes = [
    { id: 'first_a', minPoints: 0 },
    { id: 'first_b', minPoints: 0 },
    { id: 'familiar_a', minPoints: 80 },
    { id: 'sync_a', minPoints: 240 },
    { id: 'sync_b', minPoints: 240 },
    { id: 'future', minPoints: 520 },
  ] as const;

  it('闲聊只使用当前最高已解锁阶段，不混入过期或未解锁台词', () => {
    expect(currentAffectionInterludePool(interludes, 250).map((entry) => entry.id)).toEqual([
      'sync_a',
      'sync_b',
    ]);
  });

  it('同存档与同 cursor 必然选中同一句，连续 cursor 完整轮播', () => {
    const first = selectAffectionInterlude(interludes, progress, 0);
    const repeated = selectAffectionInterlude(interludes, { ...progress }, 0);
    const second = selectAffectionInterlude(interludes, progress, 1);
    const wrapped = selectAffectionInterlude(interludes, progress, 2);

    expect(first).toBe(repeated);
    expect(second).not.toBe(first);
    expect(wrapped).toBe(first);
  });

  it('坏 points、坏 cursor 与缺失初始池都直接报错', () => {
    expect(() => currentAffectionInterludePool(interludes, -1)).toThrow('points');
    expect(() => selectAffectionInterlude(interludes, progress, 1.5)).toThrow('cursor');
    expect(() => currentAffectionInterludePool([{ id: 'late', minPoints: 80 }], 0)).toThrow(
      '缺少可用',
    );
  });

  it('来信只在所需剧情完成后出现，并按真实选项解析对应分支', () => {
    const letters = [
      {
        id: 'letter_01',
        requiredStoryId: 'story_01',
        variants: [
          { choiceId: 'choice_a', body: 'A' },
          { choiceId: 'choice_b', body: 'B' },
        ],
      },
      {
        id: 'letter_03',
        requiredStoryId: 'story_03',
        variants: [{ choiceId: 'choice_c', body: 'C' }],
      },
    ] as const;

    expect(unlockedAffectionLetters(letters, progress.completedStoryIds)).toEqual([letters[0]]);
    expect(resolveAffectionLetterVariant(letters[0], progress)).toEqual({
      choiceId: 'choice_a',
      body: 'A',
    });
    expect(resolveAffectionLetterVariant(letters[1], progress)).toBeNull();
  });

  it('完成记录与选择历史矛盾时不展示通用兜底信', () => {
    const letter = {
      id: 'letter_01',
      requiredStoryId: 'story_01',
      variants: [{ choiceId: 'choice_a' }],
    };
    expect(() => resolveAffectionLetterVariant(letter, { ...progress, choiceHistory: {} })).toThrow(
      '缺少对应选择历史',
    );
    expect(() =>
      resolveAffectionLetterVariant(letter, {
        ...progress,
        choiceHistory: { story_01: 'missing_choice' },
      }),
    ).toThrow('缺少选项');
  });

  it('回忆解锁只认剧情完成记录', () => {
    expect(isAffectionMemoryUnlocked('story_01', progress.completedStoryIds)).toBe(true);
    expect(isAffectionMemoryUnlocked('story_03', progress.completedStoryIds)).toBe(false);
  });
});
