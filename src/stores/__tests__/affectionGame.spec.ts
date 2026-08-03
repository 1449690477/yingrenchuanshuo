import 'fake-indexeddb/auto';
import { createPinia, setActivePinia } from 'pinia';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createInstance } from '@/core/equipment';
import { Rng } from '@/core/rng';
import type { ClassId } from '@/core/types';
import { requireAffectionCharacter } from '@/data/affection';
import {
  AFFECTION_EQUIPMENT,
  requireAffectionEquipment,
} from '@/data/affectionEquipment';
import { requireAffectionGift } from '@/data/affectionGifts';
import { requireEquipment } from '@/data/equipment';
import { createSave } from '@/save/schema';
import { clearSave, loadSave } from '@/save/storage';
import { useGameStore } from '../game';
import { usePlayerStore } from '../player';
import { useSettingsStore } from '../settings';

const NOW = Date.parse('2026-07-28T10:00:00+08:00');
const BEFORE_DAILY_RESET = Date.parse('2026-07-28T03:59:00+08:00');
const AFTER_DAILY_RESET = Date.parse('2026-07-28T04:01:00+08:00');
const jsonClone = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;

function unlockAffectionGifts(save: ReturnType<typeof createSave>, classId: ClassId): void {
  const progress = save.affection.characters[classId];
  for (const story of requireAffectionCharacter(classId).stories.slice(0, 6)) {
    progress.completedStoryIds.push(story.id);
    progress.choiceHistory[story.id] = story.choices[0]!.id;
  }
  progress.points = 1_400;
}

beforeEach(async () => {
  vi.setSystemTime(NOW);
  setActivePinia(createPinia());
  await clearSave();
});

afterEach(async () => {
  vi.useRealTimers();
  await clearSave();
});

describe('affection store transaction', () => {
  it('当前职业好感阶段真实放大最终属性，player store 暴露同一份派生状态', () => {
    const game = useGameStore();
    const save = createSave('好感战力', 'witch', 20260728, NOW);
    game.loadFrom(save);
    const baseAtk = game.finalStats.atk;

    game.save!.affection.characters.witch.points = 1_400;

    expect(game.finalStats.atk).toBeCloseTo(baseAtk * 1.07, 8);
    expect(game.affectionTier?.id).toBe('vow');
    expect(game.affectionRemaining).toBe(4);

    const player = usePlayerStore();
    expect(player.affectionState).toBe(game.affectionState);
    expect(player.affectionProgress?.points).toBe(1_400);
    expect(player.affectionTier?.label).toBe('誓约');
    expect(player.affectionRemaining).toBe(4);
  });

  it('候选装备战力与真正穿上后的套装和好感结算完全一致', () => {
    const game = useGameStore();
    const save = createSave('候选战力', 'witch', 20260729, NOW);
    save.player.level = 90;
    save.affection.characters.witch.points = 900;
    save.equipped.head = createInstance(
      requireEquipment('eq_dungeon_azure_head_1'),
      new Rng(1),
      'set-head',
      save.player.classId,
    );
    const candidate = createInstance(
      requireEquipment('eq_dungeon_azure_body_witch'),
      new Rng(2),
      'set-body',
      save.player.classId,
    );
    save.bag.equipment.push(candidate);
    game.loadFrom(save);

    const predicted = game.equipmentCandidateCp(candidate);
    game.save!.equipped.body = candidate;

    expect(game.equipmentSetResolution.sets[0]?.equippedPieces).toBe(2);
    expect(game.cp).toBeCloseTo(predicted, 8);
  });

  it('M3-10：互动跨过好感情档位时战力真实上涨，必须留下正向飘字', () => {
    const game = useGameStore();
    const save = createSave('好感飘字', 'swordsman', 20260803, NOW);
    const interaction = requireAffectionCharacter('swordsman').interactions[0]!;
    // 把点数摆在「熟络」档（80 点）前一次互动的距离：这次互动正好跨档，
    // combatBonusRatio 0 → 0.01，战力必然上涨。档位加成见 src/data/affectionRules.ts。
    // 等级抬到 40：低等级时 1% 加成取整后不足 1 战力，会被 noteCpDelta 的取整抹掉。
    save.player.level = 40;
    save.affection.characters.swordsman.points = 80 - interaction.points;
    game.loadFrom(save);

    const result = game.interactWithCharacter('swordsman', interaction.id, NOW);

    expect(result.ok).toBe(true);
    expect(game.cpDelta).not.toBeNull();
    expect(game.cpDelta!.value).toBeGreaterThan(0);
  });

  it('每天只有四次有效互动，第五次不增加点数、保底或总次数', async () => {
    const game = useGameStore();
    game.loadFrom(createSave('互动上限', 'swordsman', 20260730, NOW));
    const interactionId = requireAffectionCharacter('swordsman').interactions[0]!.id;

    for (let index = 0; index < 4; index++) {
      const result = game.interactWithCharacter('swordsman', interactionId, NOW);
      expect(result.ok).toBe(true);
    }
    const before = jsonClone(game.save!.affection.characters.swordsman);
    const blocked = game.interactWithCharacter('swordsman', interactionId, NOW);

    expect(blocked).toMatchObject({ ok: false, reason: 'daily-limit' });
    expect(game.save!.affection.characters.swordsman).toEqual(before);
    expect(game.affectionRemaining).toBe(0);
    await game.persist();
  });

  it('04:00 跨日时刷新响应式剩余次数，不需要重载页面或先点一次按钮', () => {
    const beforeReset = Date.parse('2026-07-28T03:59:59+08:00');
    const afterReset = Date.parse('2026-07-28T04:00:01+08:00');
    vi.setSystemTime(beforeReset);
    const game = useGameStore();
    const save = createSave('跨日刷新', 'witch', 20260730, beforeReset);
    save.affection.characters.witch.interactionsToday = 4;
    save.affection.characters.witch.totalInteractions = 4;
    game.loadFrom(save);
    expect(game.affectionInteractionsRemaining).toBe(0);

    vi.setSystemTime(afterReset);
    game.refreshAffectionClock(afterReset);

    expect(game.affectionInteractionsRemaining).toBe(4);
  });

  it('玩家可以关闭好感互动短震，设置会持久化且不影响其他互动数据', async () => {
    const game = useGameStore();
    game.loadFrom(createSave('震动设置', 'witch', 20260730, NOW));
    const beforeAffection = jsonClone(game.save!.affection);
    const settings = useSettingsStore();

    expect(settings.settings?.haptics).toBe(true);
    expect(settings.setHaptics(false)).toBe(true);
    expect(settings.settings?.haptics).toBe(false);
    expect(game.save!.affection).toEqual(beforeAffection);

    await game.persist();
    expect((await loadSave())?.settings.haptics).toBe(false);
  });

  it('前置剧情未完成的互动会在 store 领域边界拒绝且不修改存档', () => {
    const game = useGameStore();
    game.loadFrom(createSave('互动解锁', 'witch', 20260730, NOW));
    const locked = requireAffectionCharacter('witch').interactions.find(
      (entry) => entry.requiredStoryId,
    )!;
    const before = jsonClone(game.save!.affection.characters.witch);

    expect(game.interactWithCharacter('witch', locked.id, NOW)).toEqual({
      ok: false,
      reason: 'interaction-locked',
    });
    expect(game.save!.affection.characters.witch).toEqual(before);
  });

  it('本次互动刚达到的新门槛装备会立即进入掉落池', () => {
    const game = useGameStore();
    const save = createSave('门槛掉落', 'swordsman', 20260730, NOW);
    save.player.level = 5;
    const progress = save.affection.characters.swordsman;
    progress.points = 30;
    progress.gearPity = 15;
    progress.discoveredGearIds = ['eq_affection_swordsman_morning-oath-sakura-crown'];
    game.loadFrom(save);
    const interactionId = requireAffectionCharacter('swordsman').interactions[0]!.id;

    const result = game.interactWithCharacter('swordsman', interactionId, NOW);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.gearReward?.defId).toBe(
      'eq_affection_swordsman_guardian-heart-petal-necklace',
    );
  });

  it('硬保底使用奖励种子生成一件锁定心虹装备，并原子推进 UID、图鉴和存档', async () => {
    const game = useGameStore();
    const save = createSave('心虹保底', 'catkin', 20260731, NOW);
    save.affection.characters.catkin.gearPity = 15;
    const beforeUid = save.nextUid;
    const beforeRngState = save.rngState;
    game.loadFrom(save);
    const interactionId = requireAffectionCharacter('catkin').interactions[0]!.id;

    const result = game.interactWithCharacter('catkin', interactionId, NOW);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.gearReward).not.toBeNull();
    expect(result.instance).toMatchObject({
      uid: `e${beforeUid}`,
      defId: result.gearReward?.defId,
      locked: true,
    });
    expect(game.save!.bag.equipment).toContainEqual(result.instance);
    expect(game.save!.nextUid).toBe(beforeUid + 1);
    expect(game.save!.rngState).toBe(beforeRngState);
    expect(game.save!.affection.characters.catkin.gearPity).toBe(0);
    expect(game.save!.affection.characters.catkin.discoveredGearIds).toContain(
      result.gearReward!.defId,
    );
    expect(game.lootLog[0]).toMatchObject({
      itemId: result.gearReward!.defId,
      quality: 'prismatic',
      isEquipment: true,
    });

    await game.persist();
    const loaded = await loadSave();
    expect(loaded?.bag.equipment).toContainEqual(result.instance);
    expect(loaded?.affection.characters.catkin.discoveredGearIds).toContain(
      result.gearReward!.defId,
    );
  });

  it('奖励配置损坏时整次互动回滚，不消费保底、图鉴、UID 或背包资产', () => {
    const game = useGameStore();
    const save = createSave('心虹事务', 'catkin', 20260731, NOW);
    save.affection.characters.catkin.gearPity = 15;
    game.loadFrom(save);
    const interactionId = requireAffectionCharacter('catkin').interactions[0]!.id;
    const rewardId = 'eq_affection_catkin_heartbeat-cat-ear-bow';
    const original = requireAffectionEquipment(rewardId);
    const registry = AFFECTION_EQUIPMENT as Record<string, typeof original | undefined>;
    const before = jsonClone(game.save);

    delete registry[rewardId];
    try {
      expect(() => game.interactWithCharacter('catkin', interactionId, NOW)).toThrow(
        `[配置错误] 心虹好感装备不存在：${rewardId}`,
      );
      expect(game.save).toEqual(before);
      expect(game.lootLog).toEqual([]);
    } finally {
      registry[rewardId] = original;
    }
  });

  it('礼物消耗现有掉落材料，并与普通互动共享次数、心虹保底和持久化', async () => {
    const game = useGameStore();
    const save = createSave('礼物事务', 'witch', 20260731, NOW);
    unlockAffectionGifts(save, 'witch');
    const gift = requireAffectionGift('witch', 'gift_witch_deviant_star_ink');
    save.bag.items[gift.cost.itemId] = 2;
    save.affection.characters.witch.gearPity = 15;
    const beforeUid = save.nextUid;
    game.loadFrom(save);

    const result = game.giveAffectionGift('witch', gift.id, NOW);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.gainedPoints).toBe(18);
    expect(result.instance).not.toBeNull();
    expect(game.save!.bag.items[gift.cost.itemId]).toBe(1);
    expect(game.save!.affection.characters.witch).toMatchObject({
      points: 1_418,
      interactionsToday: 1,
      totalInteractions: 1,
      gearPity: 0,
      mood: gift.mood,
    });
    expect(game.save!.nextUid).toBe(beforeUid + 1);
    expect(game.save!.bag.equipment).toContainEqual(result.instance);

    await game.persist();
    const loaded = await loadSave();
    expect(loaded?.bag.items[gift.cost.itemId]).toBe(1);
    expect(loaded?.affection.characters.witch.points).toBe(1_418);
    expect(loaded?.bag.equipment).toContainEqual(result.instance);
  });

  it('合心礼物支持一次消耗四份材料，并在恰好用完时移除背包零值键', () => {
    const game = useGameStore();
    const save = createSave('多材料礼物', 'catkin', 20260732, NOW);
    unlockAffectionGifts(save, 'catkin');
    const gift = requireAffectionGift('catkin', 'gift_catkin_victory_candy_pack');
    expect(gift.cost.count).toBe(4);
    save.bag.items[gift.cost.itemId] = gift.cost.count;
    game.loadFrom(save);

    const result = game.giveAffectionGift('catkin', gift.id, NOW);

    expect(result).toMatchObject({ ok: true, gainedPoints: 10 });
    expect(game.save!.bag.items).not.toHaveProperty(gift.cost.itemId);
    expect(game.save!.affection.characters.catkin).toMatchObject({
      interactionsToday: 1,
      totalInteractions: 1,
    });
  });

  it('礼物未解锁、材料不足和共享日限均不污染材料、保底或 UID', () => {
    const game = useGameStore();
    const gift = requireAffectionGift('catkin', 'gift_catkin_modular_field_case');

    const lockedSave = createSave('礼物锁定', 'catkin', 20260731, NOW);
    lockedSave.bag.items[gift.cost.itemId] = 3;
    game.loadFrom(lockedSave);
    const lockedBefore = jsonClone(game.save);
    expect(game.giveAffectionGift('catkin', gift.id, NOW)).toEqual({
      ok: false,
      reason: 'gift-locked',
    });
    expect(game.save).toEqual(lockedBefore);

    const missingSave = createSave('礼物缺料', 'catkin', 20260731, NOW);
    unlockAffectionGifts(missingSave, 'catkin');
    missingSave.affection.characters.catkin.gearPity = 9;
    game.loadFrom(missingSave);
    const missingBefore = jsonClone(game.save);
    expect(game.giveAffectionGift('catkin', gift.id, NOW)).toMatchObject({
      ok: false,
      reason: 'missing-material',
    });
    expect(game.save).toEqual(missingBefore);

    const limitedSave = createSave('礼物日限', 'catkin', 20260731, NOW);
    unlockAffectionGifts(limitedSave, 'catkin');
    limitedSave.bag.items[gift.cost.itemId] = 3;
    limitedSave.affection.characters.catkin.interactionsToday = 4;
    limitedSave.affection.characters.catkin.totalInteractions = 4;
    game.loadFrom(limitedSave);
    const limitedBefore = jsonClone(game.save);
    expect(game.giveAffectionGift('catkin', gift.id, NOW)).toMatchObject({
      ok: false,
      reason: 'daily-limit',
    });
    expect(game.save).toEqual(limitedBefore);
  });

  it('跨 04:00 后缺料失败仍持久化日切，且不推进保底、UID 或材料', async () => {
    vi.setSystemTime(BEFORE_DAILY_RESET);
    const game = useGameStore();
    const save = createSave('礼物跨日缺料', 'catkin', 20260733, BEFORE_DAILY_RESET);
    unlockAffectionGifts(save, 'catkin');
    const gift = requireAffectionGift('catkin', 'gift_catkin_modular_field_case');
    const progress = save.affection.characters.catkin;
    progress.interactionsToday = 4;
    progress.totalInteractions = 12;
    progress.gearPity = 9;
    const beforeUid = save.nextUid;
    game.loadFrom(save);

    const result = game.giveAffectionGift('catkin', gift.id, AFTER_DAILY_RESET);

    expect(result).toMatchObject({ ok: false, reason: 'missing-material' });
    expect(game.save!.affection.characters.catkin).toMatchObject({
      dayKey: '2026-07-28',
      interactionsToday: 0,
      totalInteractions: 12,
      gearPity: 9,
    });
    expect(game.save!.nextUid).toBe(beforeUid);
    expect(game.save!.bag.items).not.toHaveProperty(gift.cost.itemId);

    await vi.waitFor(async () => {
      const loaded = await loadSave();
      expect(loaded?.affection.characters.catkin).toMatchObject({
        dayKey: '2026-07-28',
        interactionsToday: 0,
        totalInteractions: 12,
        gearPity: 9,
      });
      expect(loaded?.nextUid).toBe(beforeUid);
      expect(loaded?.bag.items).not.toHaveProperty(gift.cost.itemId);
    });
  });

  it('礼物触发的心虹奖励配置损坏时，材料、好感、保底、图鉴和 UID 一起回滚', () => {
    const game = useGameStore();
    const save = createSave('礼物心虹回滚', 'catkin', 20260731, NOW);
    unlockAffectionGifts(save, 'catkin');
    const gift = requireAffectionGift('catkin', 'gift_catkin_modular_field_case');
    save.bag.items[gift.cost.itemId] = 2;
    save.affection.characters.catkin.gearPity = 15;
    game.loadFrom(save);

    const rewardId = 'eq_affection_catkin_heartbeat-cat-ear-bow';
    const original = requireAffectionEquipment(rewardId);
    const registry = AFFECTION_EQUIPMENT as Record<string, typeof original | undefined>;
    const before = jsonClone(game.save);

    delete registry[rewardId];
    try {
      expect(() => game.giveAffectionGift('catkin', gift.id, NOW)).toThrow(
        `[配置错误] 心虹好感装备不存在：${rewardId}`,
      );
      expect(game.save).toEqual(before);
      expect(game.lootLog).toEqual([]);
    } finally {
      registry[rewardId] = original;
    }
  });

  it('剧情选择只结算一次，成功结果和选择记忆写入持久化存档', async () => {
    const game = useGameStore();
    game.loadFrom(createSave('剧情记忆', 'shaman', 20260801, NOW));
    const story = requireAffectionCharacter('shaman').stories[0]!;
    const choice = story.choices[1]!;

    const result = game.completeAffectionStoryChoice('shaman', story.id, choice.id);

    expect(result).toMatchObject({
      ok: true,
      gainedPoints: story.completionPoints,
      mood: choice.mood,
    });
    expect(game.save!.affection.characters.shaman.completedStoryIds).toEqual([story.id]);
    expect(game.save!.affection.characters.shaman.choiceHistory[story.id]).toBe(choice.id);

    const before = jsonClone(game.save!.affection.characters.shaman);
    expect(game.completeAffectionStoryChoice('shaman', story.id, choice.id)).toEqual({
      ok: false,
      reason: 'already-completed',
    });
    expect(game.save!.affection.characters.shaman).toEqual(before);

    await game.persist();
    const loaded = await loadSave();
    expect(loaded?.affection.characters.shaman.choiceHistory[story.id]).toBe(choice.id);
  });

  it('四批十二幕按门槛线性开放，第四幕后等额结算且已完成幕不可重复领奖', () => {
    const game = useGameStore();
    game.loadFrom(createSave('六幕剧情', 'swordsman', 20260803, NOW));
    const stories = requireAffectionCharacter('swordsman').stories;

    const blockedSave = createSave('缺少第八幕', 'swordsman', 20260804, NOW);
    const blockedProgress = blockedSave.affection.characters.swordsman;
    blockedProgress.points = 2_600;
    for (const earlierStory of stories.slice(0, 7)) {
      blockedProgress.completedStoryIds.push(earlierStory.id);
      blockedProgress.choiceHistory[earlierStory.id] = earlierStory.choices[0]!.id;
    }
    game.loadFrom(blockedSave);
    const finalStory = stories[8]!;
    const beforeLockedAttempt = jsonClone(blockedProgress);
    expect(
      game.completeAffectionStoryChoice(
        'swordsman',
        finalStory.id,
        finalStory.choices[0]!.id,
      ),
    ).toEqual({ ok: false, reason: 'locked' });
    expect(game.save!.affection.characters.swordsman).toEqual(beforeLockedAttempt);

    game.loadFrom(createSave('六幕剧情', 'swordsman', 20260803, NOW));
    for (const story of stories) {
      game.save!.affection.characters.swordsman.points = story.unlockPoints;
      const choice = story.choices[story.episode % story.choices.length]!;
      const result = game.completeAffectionStoryChoice('swordsman', story.id, choice.id);

      expect(result).toMatchObject({
        ok: true,
        gainedPoints: story.completionPoints,
        mood: choice.mood,
      });
      if (story.episode >= 4) expect(story.completionPoints).toBe(60);
    }

    const progress = game.save!.affection.characters.swordsman;
    expect(progress.completedStoryIds).toEqual(stories.map((story) => story.id));
    expect(progress.points).toBe(4_160);
    const before = jsonClone(progress);
    expect(
      game.completeAffectionStoryChoice(
        'swordsman',
        finalStory.id,
        finalStory.choices[0]!.id,
      ),
    ).toEqual({ ok: false, reason: 'already-completed' });
    expect(game.save!.affection.characters.swordsman).toEqual(before);
  });

  it('未知互动是配置错误而不是静默失败，无存档则返回明确业务结果', () => {
    const game = useGameStore();
    expect(game.interactWithCharacter('witch', 'missing')).toEqual({
      ok: false,
      reason: 'no-save',
    });
    expect(game.giveAffectionGift('witch', 'gift_missing')).toEqual({
      ok: false,
      reason: 'no-save',
    });

    game.loadFrom(createSave('配置错误', 'witch', 20260802, NOW));
    expect(() => game.interactWithCharacter('witch', 'missing', NOW)).toThrow(
      '[配置错误] witch 的好感互动不存在：missing',
    );
    expect(() => game.giveAffectionGift('witch', 'gift_missing', NOW)).toThrow(
      '[配置错误] witch 的好感礼物不存在：gift_missing',
    );
  });
});
