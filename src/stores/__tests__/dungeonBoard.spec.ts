/**
 * 秘境榜 store 的行为测试（docs/64 契约的客户端一侧）。
 *
 * 覆盖的验收红线：
 *   - **上报阶梯按深度升序**：服务端深度链要求第 d 层前必须已交第 d−1 层，
 *     顺序错了会被拒收，而拒收在 UI 上只是一条错误文案 —— 没有测试钉着，
 *     它坏了不会有任何东西变红
 *   - **阶梯跨部位**：一个档位下有 8 个部位门户，而链按 tier_id 取，
 *     所以只交当前部位会漏（玩家可能用武器打通 d1~d2、只在头冠留下 d3）
 *   - 默认展示玩家打过的最高档（docs/64 §3.1），不是晴蓝
 *   - 未配置 Supabase 时所有联机动作静默降级，绝不抛错、绝不阻塞游戏
 */

import 'fake-indexeddb/auto';
import { createPinia, setActivePinia } from 'pinia';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { clearSave } from '@/save/storage';
import { createSave, type SaveData } from '@/save/schema';
import { equipmentDungeonRecordKey } from '@/core/equipmentDungeon';
import { DUNGEON_BOARD_ENTRIES } from '@/core/dungeonBoard';
import { useGameStore } from '../game';
import { OPEN_BOARD_ENTRIES, useDungeonBoardStore } from '../dungeonBoard';

const NOW = Date.parse('2026-07-31T16:30:00+08:00');

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

/** 关卡 id 形如 equipment_weapon_azure；记录键再加 _d{层}。 */
function stageOf(slot: string, tierId: string): string {
  return `equipment_${slot}_${tierId}`;
}

/**
 * 造一份带秘境记录的存档。
 *
 * `entries` 是 [部位, 档位, 层] 三元组。这里顺带满足存档的两条不变量
 * （同档 1..d 不能缺层、depth 必须等于最深层），否则 schema 会拒。
 */
function saveWithRecords(entries: [string, string, number][]): SaveData {
  const save = createSave('夜见', 'swordsman', 60, NOW - 100_000);
  const deepest: Record<string, number> = {};
  for (const [slot, tierId, depth] of entries) {
    const key = equipmentDungeonRecordKey(stageOf(slot, tierId), depth);
    save.equipmentDungeon.records[key] = {
      clears: 1,
      firstClearedAt: NOW - depth * 1000,
      // 深层更慢，用来验证排序不是按用时而是按深度
      bestDurationMs: 1000 + depth * 100,
    };
    deepest[tierId] = Math.max(deepest[tierId] ?? 0, depth);
  }
  save.equipmentDungeon.depth = deepest;
  return save;
}

describe('本地阶梯推导', () => {
  it('★ 按深度升序，且跨部位一起交 —— 链按档取，不按部位', () => {
    const game = useGameStore();
    // 故意打乱写入顺序，并让同一档的三层分布在两个部位上
    game.loadFrom(
      saveWithRecords([
        ['weapon', 'azure', 3],
        ['head', 'azure', 1],
        ['weapon', 'azure', 2],
      ]),
    );
    const board = useDungeonBoardStore();

    const ladder = board.localLadder('azure');
    const depths = ladder.map((claim) => DUNGEON_BOARD_ENTRIES.find((e) => e.id === claim.dungeonId)!.depth);

    expect(depths).toEqual([1, 2, 3]);
    // 第 1 层来自头冠门户，第 2/3 层来自武器门户 —— 只交当前部位会漏掉第 1 层，
    // 而漏掉第 1 层会让第 2 层被服务端以「还没有上一层的记录」拒收
    expect(ladder[0]!.dungeonId).toBe(`${stageOf('head', 'azure')}_d1`);
    expect(ladder[1]!.dungeonId).toBe(`${stageOf('weapon', 'azure')}_d2`);
  });

  it('只包含本地真有记录的层，没打过的不会凭空上报', () => {
    const game = useGameStore();
    game.loadFrom(saveWithRecords([['weapon', 'azure', 1]]));
    const board = useDungeonBoardStore();

    expect(board.localLadder('azure')).toHaveLength(1);
    expect(board.localLadder('violet')).toHaveLength(0);
  });

  it('载荷只有 dungeonId / bestDurationMs / firstClearedAt —— 没有名次也没有 verified', () => {
    const game = useGameStore();
    game.loadFrom(saveWithRecords([['weapon', 'azure', 1]]));
    const board = useDungeonBoardStore();

    expect(Object.keys(board.localLadder('azure')[0]!).sort()).toEqual([
      'bestDurationMs',
      'dungeonId',
      'firstClearedAt',
    ]);
  });
});

describe('默认档位（docs/64 §3.1）', () => {
  it('默认落在玩家打过的最高档，不是晴蓝', () => {
    const game = useGameStore();
    game.loadFrom(
      saveWithRecords([
        ['weapon', 'azure', 1],
        ['weapon', 'auric', 1],
      ]),
    );
    const board = useDungeonBoardStore();

    expect(board.playedTierIds).toEqual(['azure', 'auric']);
    expect(board.defaultTierId).toBe('auric');
  });

  it('一层都没打过 → 落在第一个开放档，不炸', () => {
    const game = useGameStore();
    game.loadFrom(createSave('夜见', 'swordsman', 1, NOW - 100_000));
    const board = useDungeonBoardStore();

    expect(board.playedTierIds).toEqual([]);
    expect(board.defaultTierId).toBe(OPEN_BOARD_ENTRIES[0]!.tierId);
  });
});

describe('封着的档位不进 UI', () => {
  it('OPEN_BOARD_ENTRIES 里没有任何 sealed 层', () => {
    expect(OPEN_BOARD_ENTRIES.every((entry) => !entry.sealed)).toBe(true);
    expect(OPEN_BOARD_ENTRIES.length).toBeGreaterThan(0);
  });

  it('选择器三级都不为空：档位 → 部位 → 层', () => {
    const game = useGameStore();
    game.loadFrom(createSave('夜见', 'swordsman', 1, NOW - 100_000));
    const board = useDungeonBoardStore();

    const tierId = board.openTierIds[0]!;
    const stages = board.stagesInTier(tierId);
    expect(stages.length).toBeGreaterThan(0);
    // 8 个装备部位各一个门户
    expect(stages).toHaveLength(8);
    expect(board.depthsInStage(stages[0]!.stageId).length).toBeGreaterThan(0);
  });
});

describe('未配置联机时静默降级（绝不阻塞游戏）', () => {
  it('openBoard 不抛错，状态停在 unconfigured', async () => {
    const game = useGameStore();
    game.loadFrom(saveWithRecords([['weapon', 'azure', 1]]));
    const board = useDungeonBoardStore();

    await expect(board.openBoard()).resolves.toBeUndefined();
    expect(board.status).toBe('unconfigured');
    expect(board.rows).toEqual([]);
  });

  it('submitTierLadder 不抛错，也不会把成绩标记成已交', async () => {
    const game = useGameStore();
    game.loadFrom(saveWithRecords([['weapon', 'azure', 1]]));
    const board = useDungeonBoardStore();

    await expect(board.submitTierLadder('azure')).resolves.toBeUndefined();
    expect(board.lastSubmit).toBeNull();
  });

  it('notifyDungeonCleared 在未连线时是空操作，不会偷偷建连接', () => {
    const game = useGameStore();
    game.loadFrom(saveWithRecords([['weapon', 'azure', 1]]));
    const board = useDungeonBoardStore();

    expect(() => board.notifyDungeonCleared('azure')).not.toThrow();
    expect(board.status).not.toBe('ready');
  });
});
