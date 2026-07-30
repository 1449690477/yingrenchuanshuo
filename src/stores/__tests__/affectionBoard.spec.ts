/**
 * 羁绊榜 store 的行为测试。
 *
 * 覆盖 docs/63 §三 的验收红线：
 *   - 未配置 Supabase 时所有联机动作静默降级，绝不抛错、绝不阻塞游戏
 *   - 本地聚合口径：心意总值 = 四角色之和，互动次数同理
 *   - storyCount 用 completedStoryIds 全长（主剧情幕与约会幕同一个列表）
 */

import 'fake-indexeddb/auto';
import { createPinia, setActivePinia } from 'pinia';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { clearSave } from '@/save/storage';
import { createSave } from '@/save/schema';
import { useGameStore } from '../game';
import { useAffectionBoardStore } from '../affectionBoard';

const NOW = Date.parse('2026-07-29T17:56:00+08:00');

beforeEach(async () => {
  setActivePinia(createPinia());
  await clearSave();
  vi.useFakeTimers();
  vi.setSystemTime(NOW);
});

afterEach(async () => {
  vi.useRealTimers();
  vi.restoreAllMocks();
  await clearSave();
});

async function setupGame() {
  const game = useGameStore();
  const save = createSave('夜见', 'swordsman', 42, NOW - 100_000);
  // 四角色制造已知分布：两角色有进度、两角色全零
  // 幕 id 与回答记录用真实数据，让存档校验全程干净（主剧情幕与约会幕同一个列表）
  save.affection.characters.swordsman.points = 300;
  save.affection.characters.swordsman.totalInteractions = 20;
  save.affection.characters.swordsman.completedStoryIds = ['aff_swordsman_01_dawn'];
  save.affection.characters.swordsman.choiceHistory = { aff_swordsman_01_dawn: 'watch_breath' };
  save.affection.characters.witch.points = 120;
  save.affection.characters.witch.totalInteractions = 8;
  save.affection.characters.witch.completedStoryIds = ['aff_witch_01_star'];
  save.affection.characters.witch.choiceHistory = { aff_witch_01_star: 'ask_both' };
  game.loadFrom(save);
  return game;
}

describe('本地聚合', () => {
  it('心意总值 = 四角色之和，一个角色都不拆出来', async () => {
    await setupGame();
    const board = useAffectionBoardStore();

    expect(board.myAffectionTotal).toBe(420);
    expect(board.myTotalInteractions).toBe(28);
  });

  it('空存档给 0，不报错', () => {
    const board = useAffectionBoardStore();

    expect(board.myAffectionTotal).toBe(0);
    expect(board.myTotalInteractions).toBe(0);
    expect(board.myPercentile).toBeNull();
  });
});

describe('离线降级 / 未配置 Supabase', () => {
  it('status 是 unconfigured，联机动作安静失败', async () => {
    await setupGame();
    const board = useAffectionBoardStore();

    expect(board.status).toBe('unconfigured');
    await expect(board.refreshBoard()).resolves.toBeUndefined();
    await expect(board.syncAffection()).resolves.toBeNull();
    expect(board.rows).toEqual([]);
    expect(board.lastSync).toBeNull();
    // 本地聚合依然可用 —— 陪伴卡离线也能展示
    expect(board.myAffectionTotal).toBe(420);
  });
});

describe('弱名次口径', () => {
  it('percentile 只在有名次且榜上不止一人时给出', async () => {
    await setupGame();
    const board = useAffectionBoardStore();

    expect(board.myPercentile).toBeNull();
    // 模拟一次同步回执：第 3 名 / 共 12 人 → 超过 75%
    board.lastSync = { updated: true, affectionTotal: 420, rank: 3, total: 12 };
    expect(board.myPercentile).toBe(75);
    // 榜上只有自己时不给百分比（0% 是一种嘲讽）
    board.lastSync = { updated: true, affectionTotal: 420, rank: 1, total: 1 };
    expect(board.myPercentile).toBeNull();
    // 未入榜（rank 0）不给
    board.lastSync = { updated: true, affectionTotal: 0, rank: 0, total: 8 };
    expect(board.myPercentile).toBeNull();
  });
});
