/**
 * 进度榜 store 的行为测试。
 *
 * 覆盖 docs/63 §五 的验收红线：
 *   - 未配置 Supabase 时所有联机动作静默降级，绝不抛错、绝不阻塞游戏
 *   - 本地推导口径：最深首通 = 已通关集合里序号最大的一关
 *   - 弱名次口径：percentile 只在 verified 且有名次且榜上不止一人时给出
 */

import 'fake-indexeddb/auto';
import { createPinia, setActivePinia } from 'pinia';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { clearSave } from '@/save/storage';
import { createSave } from '@/save/schema';
import { ORDERED_STAGE_IDS, getStage } from '@/data/stages';
import { useGameStore } from '../game';
import { useProgressBoardStore } from '../progressBoard';

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

async function setupGame(clearedCount = 3) {
  const game = useGameStore();
  const save = createSave('夜见', 'swordsman', 42, NOW - 100_000);
  save.progress.clearedStageIds = ORDERED_STAGE_IDS.slice(0, clearedCount);
  // 最深关有时刻，前面的关没有（老档形状）
  save.progress.stageFirstClearedAt = {
    [ORDERED_STAGE_IDS[clearedCount - 1]!]: NOW - 5000,
  };
  game.loadFrom(save);
  return game;
}

describe('本地推导', () => {
  it('最深首通 = 已通关集合里序号最大的一关，带时刻', async () => {
    await setupGame(3);
    const board = useProgressBoardStore();

    expect(board.localClaim?.stageId).toBe(ORDERED_STAGE_IDS[2]);
    expect(board.localClaim?.firstClearedAt).toBe(NOW - 5000);
    expect(board.localClearedCount).toBe(3);
    expect(board.localStageLabel?.stageName).toBe(getStage(ORDERED_STAGE_IDS[2]!)!.name);
  });

  it('最深关缺时刻 → firstClearedAt 为 null（老档不补记）', async () => {
    const game = useGameStore();
    const save = createSave('夜见', 'swordsman', 42, NOW - 100_000);
    save.progress.clearedStageIds = ORDERED_STAGE_IDS.slice(0, 5);
    save.progress.stageFirstClearedAt = {};
    game.loadFrom(save);
    const board = useProgressBoardStore();

    expect(board.localClaim?.stageId).toBe(ORDERED_STAGE_IDS[4]);
    expect(board.localClaim?.firstClearedAt).toBeNull();
  });

  it('一关未通 → localClaim 为 null，不报错', () => {
    const board = useProgressBoardStore();

    expect(board.localClaim).toBeNull();
    expect(board.localClearedCount).toBe(0);
    expect(board.localStageLabel).toBeNull();
    expect(board.myPercentile).toBeNull();
  });

  it('回执与本地最深处对不上 → 有未同步进度；对上 → 没有', async () => {
    await setupGame(3);
    const board = useProgressBoardStore();

    expect(board.hasUnsyncedProgress).toBe(true);
    board.lastSync = {
      updated: true,
      deepestStageId: ORDERED_STAGE_IDS[2]!,
      deepestStageIndex: 2,
      firstClearedAt: NOW - 5000,
      verified: true,
      rank: 1,
      total: 1,
    };
    expect(board.hasUnsyncedProgress).toBe(false);
  });
});

describe('离线降级 / 未配置 Supabase', () => {
  it('status 是 unconfigured，联机动作安静失败，本地推导依然可用', async () => {
    await setupGame(3);
    const board = useProgressBoardStore();

    expect(board.status).toBe('unconfigured');
    await expect(board.refreshBoard()).resolves.toBeUndefined();
    await expect(board.syncProgress()).resolves.toBeNull();
    await expect(board.openBoard()).resolves.toBeUndefined();
    expect(board.rows).toEqual([]);
    expect(board.lastSync).toBeNull();
    // 本地推导依然可用 —— 开荒卡离线也能展示
    expect(board.localClaim?.stageId).toBe(ORDERED_STAGE_IDS[2]);
    // 火忘上报在未连榜时什么都不做，也绝不抛错
    expect(() => board.notifyFirstClear()).not.toThrow();
  });
});

describe('弱名次口径', () => {
  it('percentile 只在 verified 且有名次且榜上不止一人时给出', async () => {
    await setupGame(3);
    const board = useProgressBoardStore();

    expect(board.myPercentile).toBeNull();
    // 第 3 名 / 共 12 人 → 超过 75%
    board.lastSync = {
      updated: true,
      deepestStageId: ORDERED_STAGE_IDS[2]!,
      deepestStageIndex: 2,
      firstClearedAt: NOW - 5000,
      verified: true,
      rank: 3,
      total: 12,
    };
    expect(board.myPercentile).toBe(75);
    // 未通过校验 → 不给（榜上根本没有这行）
    board.lastSync = { ...board.lastSync, verified: false, rank: 0 };
    expect(board.myPercentile).toBeNull();
    // 榜上只有自己时不给百分比（0% 是一种嘲讽）
    board.lastSync = { ...board.lastSync, verified: true, rank: 1, total: 1 };
    expect(board.myPercentile).toBeNull();
    // 未入榜（rank 0）不给
    board.lastSync = { ...board.lastSync, rank: 0, total: 8 };
    expect(board.myPercentile).toBeNull();
  });
});
