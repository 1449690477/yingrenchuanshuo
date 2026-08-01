import { describe, expect, it } from 'vitest';
import { AFFECTION_RULES } from '@/data/affectionRules';
import {
  affectionDayKey,
  affectionGearChance,
  affectionInteractionsRemaining,
  affectionRewardSeed,
  affectionTierAt,
  applyAffectionCombatBonus,
  completeAffectionStory,
  createAffectionState,
  performAffectionGift,
  performAffectionInteraction,
  refreshAffectionDay,
  type AffectionRules,
  type AffectionStorySpec,
} from '../affection';

const beforeReset = Date.parse('2026-07-28T03:59:59+08:00');
const afterReset = Date.parse('2026-07-28T04:00:00+08:00');
const chat = { id: 'chat', points: 10, mood: 'bright' as const };
const favoriteGift = {
  id: 'gift_witch_star_ink',
  points: 18,
  mood: 'playful' as const,
  cost: { itemId: 'crystal_altar', count: 1 },
};
const gearPool = ['eq_heart_a', 'eq_heart_b', 'eq_heart_c'];

describe('affection state', () => {
  it('为五职业建立彼此独立的完整记录', () => {
    const state = createAffectionState(afterReset, AFFECTION_RULES);

    expect(Object.keys(state.characters).sort()).toEqual([
      'catkin',
      'kenshi',
      'shaman',
      'swordsman',
      'witch',
    ]);
    state.characters.witch.points = 77;
    expect(state.characters.swordsman.points).toBe(0);
    expect(state.characters.catkin.discoveredGearIds).toEqual([]);
    expect(state.characters.kenshi.discoveredGearIds).toEqual([]);
  });

  it('北京时间 04:00 日切且刷新不修改原状态', () => {
    expect(affectionDayKey(beforeReset, 4)).toBe('2026-07-27');
    expect(affectionDayKey(afterReset, 4)).toBe('2026-07-28');

    const state = createAffectionState(beforeReset, AFFECTION_RULES);
    state.characters.witch.interactionsToday = 3;
    const refreshed = refreshAffectionDay(state, afterReset, AFFECTION_RULES);

    expect(refreshed.characters.witch.interactionsToday).toBe(0);
    expect(refreshed.characters.witch.dayKey).toBe('2026-07-28');
    expect(state.characters.witch.interactionsToday).toBe(3);
    expect(state.characters.witch.dayKey).toBe('2026-07-27');
  });

  it('每天只允许四次有效互动，切职业不能互相消耗次数', () => {
    let state = createAffectionState(afterReset, AFFECTION_RULES);
    for (let index = 0; index < AFFECTION_RULES.dailyInteractionLimit; index++) {
      const result = performAffectionInteraction(
        state,
        'swordsman',
        chat,
        gearPool,
        42,
        afterReset,
        AFFECTION_RULES,
      );
      expect(result.ok).toBe(true);
      if (result.ok) state = result.state;
    }

    const blocked = performAffectionInteraction(
      state,
      'swordsman',
      chat,
      gearPool,
      42,
      afterReset,
      AFFECTION_RULES,
    );
    expect(blocked).toMatchObject({ ok: false, reason: 'daily-limit' });
    expect(affectionInteractionsRemaining(state, 'swordsman', afterReset, AFFECTION_RULES)).toBe(0);
    expect(affectionInteractionsRemaining(state, 'witch', afterReset, AFFECTION_RULES)).toBe(4);
  });
});

describe('affection rewards', () => {
  it('同存档种子与互动序号给出完全一致的状态和奖励', () => {
    const state = createAffectionState(afterReset, AFFECTION_RULES);
    const left = performAffectionInteraction(
      state,
      'shaman',
      chat,
      gearPool,
      20260728,
      afterReset,
      AFFECTION_RULES,
    );
    const right = performAffectionInteraction(
      state,
      'shaman',
      chat,
      gearPool,
      20260728,
      afterReset,
      AFFECTION_RULES,
    );

    expect(right).toEqual(left);
    expect(state.characters.shaman.totalInteractions).toBe(0);
    expect(affectionRewardSeed(20260728, 'shaman', 1)).toBe(
      affectionRewardSeed(20260728, 'shaman', 1),
    );
    expect(affectionRewardSeed(20260728, 'shaman', 2)).not.toBe(
      affectionRewardSeed(20260728, 'shaman', 1),
    );
  });

  it('连续 8 次后进入软保底，第 16 次必定掉落', () => {
    expect(affectionGearChance(0, AFFECTION_RULES)).toBe(0.03);
    expect(affectionGearChance(7, AFFECTION_RULES)).toBe(0.03);
    expect(affectionGearChance(8, AFFECTION_RULES)).toBeCloseTo(0.08);
    expect(affectionGearChance(15, AFFECTION_RULES)).toBe(1);

    const state = createAffectionState(afterReset, AFFECTION_RULES);
    state.characters.witch.gearPity = 15;
    const result = performAffectionInteraction(
      state,
      'witch',
      chat,
      gearPool,
      7,
      afterReset,
      AFFECTION_RULES,
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.gearReward).not.toBeNull();
    expect(result.gearReward?.chance).toBe(1);
    expect(result.state.characters.witch.gearPity).toBe(0);
  });

  it('集齐前缺件优先，集齐后才允许重复', () => {
    const alwaysDropRules: AffectionRules = {
      ...AFFECTION_RULES,
      dailyInteractionLimit: 10,
      gearBaseChance: 1,
    };
    let state = createAffectionState(afterReset, alwaysDropRules);
    const rewards: string[] = [];
    for (let index = 0; index < gearPool.length; index++) {
      const result = performAffectionInteraction(
        state,
        'catkin',
        chat,
        gearPool,
        88,
        afterReset,
        alwaysDropRules,
      );
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      state = result.state;
      rewards.push(result.gearReward!.defId);
      expect(result.gearReward?.newlyDiscovered).toBe(true);
    }
    expect(new Set(rewards).size).toBe(gearPool.length);
    expect(state.characters.catkin.discoveredGearIds).toHaveLength(gearPool.length);

    const duplicate = performAffectionInteraction(
      state,
      'catkin',
      chat,
      gearPool,
      88,
      afterReset,
      alwaysDropRules,
    );
    expect(duplicate.ok).toBe(true);
    if (duplicate.ok) expect(duplicate.gearReward?.newlyDiscovered).toBe(false);
  });
});

describe('affection gifts', () => {
  it('成功送礼原子扣除材料，并与普通互动共享次数、保底和种子序号', () => {
    const state = createAffectionState(afterReset, AFFECTION_RULES);
    const items = { crystal_altar: 2, petal_sakura: 9 };
    const result = performAffectionGift(
      state,
      items,
      'witch',
      favoriteGift,
      gearPool,
      20260728,
      afterReset,
      AFFECTION_RULES,
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.gainedPoints).toBe(18);
    expect(result.totalInteractions).toBe(1);
    expect(result.state.characters.witch).toMatchObject({
      points: 18,
      interactionsToday: 1,
      totalInteractions: 1,
      mood: 'playful',
    });
    expect(result.items).toEqual({ crystal_altar: 1, petal_sakura: 9 });
    expect(items).toEqual({ crystal_altar: 2, petal_sakura: 9 });
    expect(state.characters.witch.points).toBe(0);

    const asInteraction = performAffectionInteraction(
      state,
      'witch',
      favoriteGift,
      gearPool,
      20260728,
      afterReset,
      AFFECTION_RULES,
    );
    expect(asInteraction.ok).toBe(true);
    if (asInteraction.ok) {
      expect(result.gearReward).toEqual(asInteraction.gearReward);
      expect(result.state).toEqual(asInteraction.state);
    }
  });

  it('材料不足不消耗次数或保底，数量刚好时移除零值键', () => {
    const state = createAffectionState(afterReset, AFFECTION_RULES);
    state.characters.shaman.gearPity = 7;
    const missing = performAffectionGift(
      state,
      {},
      'shaman',
      favoriteGift,
      gearPool,
      9,
      afterReset,
      AFFECTION_RULES,
    );
    expect(missing).toMatchObject({
      ok: false,
      reason: 'missing-material',
      items: {},
    });
    expect(missing.state.characters.shaman).toMatchObject({
      interactionsToday: 0,
      totalInteractions: 0,
      gearPity: 7,
    });

    const exact = performAffectionGift(
      state,
      { crystal_altar: 1 },
      'shaman',
      favoriteGift,
      gearPool,
      9,
      afterReset,
      AFFECTION_RULES,
    );
    expect(exact.ok).toBe(true);
    if (exact.ok) expect(exact.items).toEqual({});
  });

  it('共享日限优先于材料检查，跨日失败也会交回刷新后的状态', () => {
    const state = createAffectionState(beforeReset, AFFECTION_RULES);
    state.characters.catkin.interactionsToday = AFFECTION_RULES.dailyInteractionLimit;
    state.characters.catkin.totalInteractions = AFFECTION_RULES.dailyInteractionLimit;

    const blocked = performAffectionGift(
      state,
      {},
      'catkin',
      favoriteGift,
      gearPool,
      17,
      beforeReset,
      AFFECTION_RULES,
    );
    expect(blocked).toMatchObject({ ok: false, reason: 'daily-limit' });

    const refreshedMissing = performAffectionGift(
      state,
      {},
      'catkin',
      favoriteGift,
      gearPool,
      17,
      afterReset,
      AFFECTION_RULES,
    );
    expect(refreshedMissing).toMatchObject({ ok: false, reason: 'missing-material' });
    expect(refreshedMissing.state.characters.catkin).toMatchObject({
      dayKey: '2026-07-28',
      interactionsToday: 0,
    });
  });

  it('拒绝非法礼物材料配置和被污染的背包数量', () => {
    const state = createAffectionState(afterReset, AFFECTION_RULES);
    expect(() =>
      performAffectionGift(
        state,
        { crystal_altar: 1 },
        'witch',
        { ...favoriteGift, cost: { itemId: '', count: 1 } },
        gearPool,
        1,
        afterReset,
        AFFECTION_RULES,
      ),
    ).toThrow('材料 ID 不能为空');
    expect(() =>
      performAffectionGift(
        state,
        { crystal_altar: -1 },
        'witch',
        favoriteGift,
        gearPool,
        1,
        afterReset,
        AFFECTION_RULES,
      ),
    ).toThrow('背包数量必须是非负整数');
  });
});

describe('affection stories and combat bonus', () => {
  const story: AffectionStorySpec = {
    id: 'witch_2',
    unlockPoints: 80,
    requiredStoryIds: ['witch_1'],
    completionPoints: 45,
    choices: [
      { id: 'near', mood: 'shy' },
      { id: 'kind', mood: 'moved' },
      { id: 'stars', mood: 'bright' },
    ],
  };

  it('剧情同时校验点数、前置、重复完成和选项', () => {
    const state = createAffectionState(afterReset, AFFECTION_RULES);
    expect(completeAffectionStory(state, 'witch', story, 'near', AFFECTION_RULES)).toEqual({
      ok: false,
      reason: 'locked',
    });

    state.characters.witch.points = 80;
    state.characters.witch.completedStoryIds.push('witch_1');
    expect(completeAffectionStory(state, 'witch', story, 'deleted', AFFECTION_RULES)).toEqual({
      ok: false,
      reason: 'invalid-choice',
    });

    const completed = completeAffectionStory(
      state,
      'witch',
      story,
      'near',
      AFFECTION_RULES,
    );
    expect(completed.ok).toBe(true);
    if (!completed.ok) return;
    expect(completed.state.characters.witch.points).toBe(125);
    expect(completed.state.characters.witch.choiceHistory.witch_2).toBe('near');
    expect(state.characters.witch.choiceHistory).toEqual({});
    expect(
      completeAffectionStory(
        completed.state,
        'witch',
        story,
        'near',
        AFFECTION_RULES,
      ),
    ).toEqual({ ok: false, reason: 'already-completed' });
  });

  it('阶段加护真实放大常规战斗属性，不伪造暴击与攻速', () => {
    expect(affectionTierAt(519, AFFECTION_RULES).label).toBe('默契');
    expect(affectionTierAt(520, AFFECTION_RULES).label).toBe('心动');

    const stats = {
      atk: 100,
      def: 80,
      hp: 1_000,
      acc: 50,
      eva: 30,
      critRate: 25,
      critDmg: 70,
      spd: 1.2,
    };
    expect(applyAffectionCombatBonus(stats, 520, AFFECTION_RULES)).toEqual({
      atk: 103.49999999999999,
      def: 82.8,
      hp: 1035,
      acc: 51.74999999999999,
      eva: 31.049999999999997,
      critRate: 25,
      critDmg: 70,
      spd: 1.2,
    });
  });
});
