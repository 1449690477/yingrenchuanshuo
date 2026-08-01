/**
 * 提交成绩前必须先同步等级（2026-08-01 线上事故的回归测试）。
 *
 * ── 事故 ──
 * `connect()` 在 status 已 ready 时提前返回，所以档案同步**每个会话只跑一次**；
 * 而 `submitBest()` 提交前不再同步。于是服务端那份 `profiles.level` 恒偏低，
 * 而 submit-trial 正是拿它当判据标尺 —— 等于用玩家几十分钟前的实力量他现在的成绩。
 * 新手最惨：一个会话 Lv1→Lv10，实测缺口 1075 倍，够格「单次即公开点名」。
 *
 * ── 为什么单开一个文件 ──
 * `leaderboard.spec.ts` 在文件级把 `isSupabaseConfigured` 钉成 false（它测的是
 * 离线降级），那条路径下 `submitBest` 一进门就返回 null，钉不住本条。
 *
 * ── 这里**不**声称什么 ──
 * `profiles.level` 由客户端上报、`sync-profile` 只做 1~120 的范围校验，
 * **它从来不是「服务端验证过的等级」**。所以补这次同步既没削弱防伪造
 * （本来就没有），也不该被当成一道防线 —— 它治的是老实玩家被旧标尺误判。
 */

import 'fake-indexeddb/auto';
import { createPinia, setActivePinia } from 'pinia';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { clearSave } from '@/save/storage';
import { createSave } from '@/save/schema';
import { useGameStore } from '../game';
import { useLeaderboardStore } from '../leaderboard';

const NOW = Date.parse('2026-07-29T17:56:00+08:00');

/** 调用顺序的记录带：本条测试的核心断言是「谁在谁之前」。 */
const calls: string[] = [];

vi.mock('@/net/supabase', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/net/supabase')>();
  return {
    ...actual,
    isSupabaseConfigured: true,
    getSupabaseClient: () => ({}) as never,
    ensureAnonymousSession: async () => ({ client: {} as never, userId: 'me' }),
  };
});

vi.mock('@/net/leaderboard', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/net/leaderboard')>();
  return {
    ...actual,
    upsertProfile: vi.fn(async (_client: unknown, input: { level: number }) => {
      calls.push(`sync:${input.level}`);
    }),
    submitTrialScore: vi.fn(async (_client: unknown, sub: { level: number }) => {
      calls.push(`submit:${sub.level}`);
      return { damage: 1000, rank: 1, total: 1, verified: true, improved: true };
    }),
    fetchPowerTop: async () => [],
    fetchMyPowerRank: async () => ({ kind: 'unranked' }) as const,
    fetchTrialTop: async () => [],
    fetchTrialNeighborhood: async () => [],
  };
});

// ⚠ 模块名是 milestones 不是 milestoneBoard。我第一版写错了名字，
// **vitest 对着不存在的模块 mock 时一声不吭，四条测试照样全绿** ——
// 是 vue-tsc 抓到的。又一次「失败长得跟成功一样」，记在这里提醒下一个人：
// mock 路径写错不会让测试红，只会让它偷偷打真网络。
vi.mock('@/net/milestones', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/net/milestones')>()),
  fetchMilestoneBoard: async () => [],
}));

beforeEach(async () => {
  setActivePinia(createPinia());
  await clearSave();
  calls.length = 0;
  vi.clearAllMocks();
  vi.useFakeTimers();
  vi.setSystemTime(NOW);
});

afterEach(async () => {
  vi.useRealTimers();
  await clearSave();
});

/**
 * 建档 + 打一局本地试炼，让 myBestThisWeek 有值（submitBest 的前提）。
 *
 * 返回 `level` 是**挑战之后**的实际等级，不是传进来那个 —— challengeTrial
 * 会发经验，低等级账号打一局就升好几级。写死入参会让断言在无关改动下变红。
 */
async function setupWithBest(level: number) {
  const game = useGameStore();
  const save = createSave('夜见', 'swordsman', 42, NOW - 100_000);
  save.player.level = level;
  game.loadFrom(save);
  const lb = useLeaderboardStore();
  lb.challengeTrial();
  return { game, lb, level: game.save!.player.level };
}

describe('提交成绩前的等级同步', () => {
  it('★ 会话内升过级：先同步新等级，再提交 —— 顺序不能反', async () => {
    const { game, lb, level } = await setupWithBest(1);
    await lb.connect();
    expect(calls).toEqual([`sync:${level}`]);

    // 玩家在同一个会话里继续升到 Lv10 —— 正是线上出事的那批新手
    game.save!.player.level = 10;
    await lb.submitBest();

    // 同步必须排在提交**前面**：晚一步的话服务端仍拿旧等级当标尺
    expect(calls).toEqual([`sync:${level}`, 'sync:10', 'submit:10']);
  });

  it('等级没变就不多发一次请求', async () => {
    const { lb, level } = await setupWithBest(45);
    await lb.connect();
    await lb.submitBest();

    expect(calls).toEqual([`sync:${level}`, `submit:${level}`]);
  });

  it('★ 同步失败也绝不挡住提交 —— 玩家的成绩比标尺新鲜度重要', async () => {
    const net = await import('@/net/leaderboard');
    vi.mocked(net.upsertProfile).mockImplementationOnce(async () => {
      calls.push('sync:boom');
      throw new Error('网络炸了');
    });

    const { game, lb } = await setupWithBest(1);
    await lb.connect();
    game.save!.player.level = 10;
    await lb.submitBest();

    // 首次 connect 的同步炸了，提交前那次补上，成绩照样交
    expect(calls.at(-1)).toBe('submit:10');
  });

  it('同步失败时不记住等级，下一次提交会重试', async () => {
    const net = await import('@/net/leaderboard');
    vi.mocked(net.upsertProfile).mockImplementationOnce(async () => {
      throw new Error('网络炸了');
    });

    const { lb, level } = await setupWithBest(45);
    await lb.connect(); // 这次同步失败，lastSyncedLevel 保持 null
    await lb.submitBest();

    // ⚠ 这里数的是**调用次数**而不是 calls 记录带：失败那次 mock 抛在记录之前，
    // 所以「重试过」和「压根没重试」在记录带上长得一模一样 —— 拿它断言等于没断言。
    expect(vi.mocked(net.upsertProfile)).toHaveBeenCalledTimes(2);
    expect(calls).toEqual([`sync:${level}`, `submit:${level}`]);
  });
});
