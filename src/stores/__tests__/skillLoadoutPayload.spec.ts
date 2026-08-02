/**
 * 技能栏必须同时进入「本地复算」与「上传载荷」（M3-5 发送环）。
 *
 * ── 守的是什么 ──
 * 客户端本地跑一次试炼算出伤害，服务端拿同一套快照复算，两者必须逐点一致。
 * 一旦只给其中一条路接上技能栏，另一条仍按职业默认顺序算 ——
 * **两边伤害对不上，而表现是「成绩被判不可信」，不是报错**。
 * 玩家看到的是「我打了这么高却没上榜」，没有任何地方会红。
 *
 * ── 为什么单开一个文件 ──
 * 与 `leaderboardLevelSync.spec.ts` 同理：`leaderboard.spec.ts` 在文件级把
 * `isSupabaseConfigured` 钉成 false，那条路径下 `submitBest` 一进门就返回 null。
 */

import 'fake-indexeddb/auto';
import { createPinia, setActivePinia } from 'pinia';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { clearSave } from '@/save/storage';
import { createSave } from '@/save/schema';
import { selectableActiveSkillIds } from '@/core/skillSlots';
import { useGameStore } from '../game';
import { useLeaderboardStore } from '../leaderboard';

const NOW = Date.parse('2026-08-02T12:00:00+08:00');

/** 记录上传载荷里的技能栏字段 —— 断言的对象就是它。 */
let submitted: { selectedActiveSkillIds?: readonly string[] } | null = null;

vi.mock('@/net/supabase', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/net/supabase')>()),
  isSupabaseConfigured: true,
  getSupabaseClient: () => ({}) as never,
  ensureAnonymousSession: async () => ({ client: {} as never, userId: 'me' }),
}));

vi.mock('@/net/leaderboard', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/net/leaderboard')>()),
  upsertProfile: vi.fn(async () => {}),
  submitTrialScore: vi.fn(async (_c: unknown, sub: Record<string, unknown>) => {
    submitted = sub as { selectedActiveSkillIds?: readonly string[] };
    return { damage: 1000, rank: 1, total: 1, verified: true, improved: true };
  }),
  fetchPowerTop: async () => [],
  fetchMyPowerRank: async () => ({ kind: 'unranked' }) as const,
  fetchTrialTop: async () => [],
  fetchTrialNeighborhood: async () => [],
}));

vi.mock('@/net/milestones', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/net/milestones')>()),
  fetchMilestoneBoard: async () => [],
}));

beforeEach(async () => {
  setActivePinia(createPinia());
  await clearSave();
  submitted = null;
  vi.clearAllMocks();
  vi.useFakeTimers();
  vi.setSystemTime(NOW);
});

afterEach(async () => {
  vi.useRealTimers();
  await clearSave();
});

function loadSave(activeSkillIds?: string[]) {
  const game = useGameStore();
  const save = createSave('夜见', 'swordsman', 42, NOW - 100_000);
  save.player.level = 60;
  if (activeSkillIds) save.player.activeSkillIds = activeSkillIds;
  game.loadFrom(save);
  return { game, lb: useLeaderboardStore() };
}

describe('技能栏进入上传载荷', () => {
  it('★ 玩家编排过：载荷里带的就是存档里那一份，逐项相同', async () => {
    const picked = selectableActiveSkillIds('swordsman', 60).slice(0, 2);
    expect(picked.length, '测试前提：剑姬 Lv60 应有至少两个可选主动技').toBe(2);
    const { lb } = loadSave([...picked]);
    lb.challengeTrial();
    await lb.submitBest();
    expect(submitted?.selectedActiveSkillIds).toEqual(picked);
  });

  it('★ 玩家没编排过：载荷里这个字段必须是 undefined —— 不许替他发明一个', async () => {
    // 补成 [] 会让服务端理解成「明确清空」⇒ 上场不带任何主动技；
    // 补成默认顺序会把玩家钉死在今天的默认表上。两种都改变了老玩家的行为，
    // 而这正是整条 M3-5 唯一要保证不发生的事。
    const { lb } = loadSave();
    lb.challengeTrial();
    await lb.submitBest();
    expect(submitted).not.toBeNull();
    expect(submitted!.selectedActiveSkillIds).toBeUndefined();
    expect(Object.hasOwn(submitted!, 'selectedActiveSkillIds')).toBe(true);
  });

  it('★ 本地复算确实吃了技能栏 —— 换一套编排，本地伤害必须跟着变', async () => {
    // 这条是「同源」的另一半：上一条证明载荷带上了，这条证明本地也用了。
    // 只证明其中一边的话，恰好就是那种「两边各算各的」的静默分歧。
    const pool = selectableActiveSkillIds('swordsman', 60);
    expect(pool.length).toBeGreaterThan(2);

    // 同一个存档里换编排再打一次。
    // ★ 成绩种子由「赛季+周次+分段+**搭配哈希**」决定，而搭配哈希只吃装备，
    // 所以两次的种子完全相同 —— 伤害若有差异，只可能来自技能栏本身。
    const { game, lb } = loadSave([pool[0]]);
    const damageA = lb.challengeTrial(NOW).result.damage;

    game.save!.player.activeSkillIds = [pool[pool.length - 1]];
    const damageB = lb.challengeTrial(NOW).result.damage;

    expect(damageA).toBeGreaterThan(0);
    expect(damageB).toBeGreaterThan(0);
    expect(damageA, '两套不同编排打出了完全相同的伤害，本地复算多半没吃技能栏').not.toBe(
      damageB,
    );
  });
});
