/**
 * 竞技场 store 的行为测试。
 *
 * 覆盖 docs/52 的几条验收红线：
 *   - 未配置 / 断网时所有联机动作静默降级，绝不抛错、绝不阻塞游戏
 *   - 挑战前置守卫：次数用完、荣誉不足都在本地拦截，不打请求
 *   - 提交载荷里**没有胜负字段**（客户端不可能伪造战斗结果，§5.3）
 *   - 结算后状态以服务端为准（排名 / 荣誉 / 连胜 / 剩余次数）
 */

import 'fake-indexeddb/auto';
import { createPinia, setActivePinia } from 'pinia';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { clearSave } from '@/save/storage';
import { createSave } from '@/save/schema';
import { useGameStore } from '../game';

const sessionMock = { client: { __fake: true }, userId: 'u-test' };

vi.mock('@/net/supabase', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/net/supabase')>();
  return {
    ...actual,
    isSupabaseConfigured: true,
    ensureAnonymousSession: vi.fn(async () => sessionMock),
    getSupabaseClient: vi.fn(async () => sessionMock.client),
  };
});

const uploadArenaSnapshot = vi.fn();
const fetchArenaCandidates = vi.fn();
const submitArenaChallenge = vi.fn();
const fetchPendingArenaGrants = vi.fn();
const markArenaGrantClaimed = vi.fn();
const buyArenaShopEntry = vi.fn();

vi.mock('@/net/arena', () => ({
  uploadArenaSnapshot: (...args: unknown[]) => uploadArenaSnapshot(...args),
  fetchArenaCandidates: (...args: unknown[]) => fetchArenaCandidates(...args),
  submitArenaChallenge: (...args: unknown[]) => submitArenaChallenge(...args),
  fetchPendingArenaGrants: (...args: unknown[]) => fetchPendingArenaGrants(...args),
  markArenaGrantClaimed: (...args: unknown[]) => markArenaGrantClaimed(...args),
  buyArenaShopEntry: (...args: unknown[]) => buyArenaShopEntry(...args),
}));

import { useArenaStore } from '../arena';

const NOW = Date.parse('2026-07-29T17:56:00+08:00');

const CANDIDATE = {
  userId: 'u-opp-1',
  rank: 45,
  displayName: '对手甲',
  classId: 'witch' as const,
  combatPower: 12000,
  winRate: 0.62,
};

const BOARD_ME = {
  rank: 50,
  tier: 'feiyue',
  honor: 200,
  winStreak: 1,
  total: 300,
  attemptsLeft: 5,
  attemptsMax: 5,
};

beforeEach(async () => {
  setActivePinia(createPinia());
  await clearSave();
  vi.useFakeTimers();
  vi.setSystemTime(NOW);
  uploadArenaSnapshot.mockReset();
  fetchArenaCandidates.mockReset();
  submitArenaChallenge.mockReset();
  fetchPendingArenaGrants.mockReset();
  markArenaGrantClaimed.mockReset();
  buyArenaShopEntry.mockReset();
  fetchPendingArenaGrants.mockResolvedValue([]);
  markArenaGrantClaimed.mockResolvedValue(undefined);
  uploadArenaSnapshot.mockResolvedValue({
    rank: 50,
    tier: 'feiyue',
    honor: 200,
    winStreak: 1,
    total: 300,
    joined: false,
    joinHonor: 0,
  });
  fetchArenaCandidates.mockResolvedValue({
    me: { ...BOARD_ME },
    candidates: [CANDIDATE],
    revenge: [],
  });
});

afterEach(async () => {
  vi.useRealTimers();
  vi.restoreAllMocks();
  await clearSave();
});

async function setupGame(level = 45) {
  const game = useGameStore();
  const save = createSave('夜见', 'swordsman', 42, NOW - 100_000);
  save.player.level = level;
  game.loadFrom(save);
  return game;
}

describe('refresh / 进入竞技场', () => {
  it('上传快照并拉取候选，状态完整落进 store', async () => {
    await setupGame();
    const arena = useArenaStore();
    await arena.refresh();

    expect(arena.status).toBe('ready');
    expect(uploadArenaSnapshot).toHaveBeenCalledTimes(1);
    expect(fetchArenaCandidates).toHaveBeenCalledTimes(1);
    expect(arena.me?.rank).toBe(50);
    expect(arena.me?.honor).toBe(200);
    expect(arena.candidates).toHaveLength(1);
    expect(arena.candidates[0]?.winRate).toBe(0.62);
    expect(arena.lastError).toBeNull();
  });

  it('快照载荷：职业/等级/八槽齐全，不含任何战斗结果字段', async () => {
    await setupGame();
    const arena = useArenaStore();
    await arena.refresh();

    const payload = uploadArenaSnapshot.mock.calls[0]![1] as Record<string, unknown>;
    expect(payload.classId).toBe('swordsman');
    expect(payload.level).toBe(45);
    expect(Array.isArray(payload.equipped)).toBe(true);
    expect((payload.equipped as unknown[]).length).toBe(8);
    for (const key of Object.keys(payload)) {
      expect([
        'seasonId',
        'classId',
        'level',
        'displayName',
        'equipped',
        // M3-5：玩家编排的技能栏。服务端跑真实战斗要用它复算，
        // 不传的话服务端按默认技能算，与客户端本地结果对不上。
        'selectedActiveSkillIds',
        'skillLevels',
      ]).toContain(key);
    }
  });

  it('网络失败静默降级：lastError 记录，绝不抛出', async () => {
    await setupGame();
    uploadArenaSnapshot.mockRejectedValue(new Error('网络连接失败，请检查网络后重试'));
    const arena = useArenaStore();
    await expect(arena.refresh()).resolves.toBeUndefined();
    expect(arena.lastError).toContain('网络连接失败');
    expect(arena.me).toBeNull();
    expect(arena.loading).toBe(false);
  });
});

describe('challenge / 发起挑战', () => {
  function victoryResult() {
    return {
      won: true,
      reason: 'knockout' as const,
      honorDelta: 40,
      honor: 240,
      rankBefore: 50,
      rankAfter: 45,
      winStreak: 2,
      tier: 'hupo',
      attemptsLeft: 4,
      battle: {
        durationSec: 3.2,
        attackerHpRemainPct: 0.8,
        defenderHpRemainPct: 0,
        attackerDamage: 5000,
        defenderDamage: 800,
        log: [],
      },
    };
  }

  it('成功挑战：提交载荷只有「谁、押多少、搭配」，没有胜负字段', async () => {
    await setupGame();
    submitArenaChallenge.mockResolvedValue(victoryResult());
    const arena = useArenaStore();
    await arena.refresh();

    arena.stake = 25;
    const result = await arena.challenge(arena.candidates[0]!);
    expect(result?.won).toBe(true);

    const payload = submitArenaChallenge.mock.calls[0]![1] as Record<string, unknown>;
    expect(payload.defenderId).toBe('u-opp-1');
    expect(payload.stake).toBe(25);
    expect((payload.equipped as unknown[]).length).toBe(8);
    // 红线（§5.3）：客户端不提交胜负
    for (const key of Object.keys(payload)) {
      expect([
        'seasonId',
        'classId',
        'level',
        'displayName',
        'equipped',
        'defenderId',
        'stake',
        // M3-5：玩家编排的技能栏。服务端跑真实战斗要用它复算，
        // 不传的话服务端按默认技能算，与客户端本地结果对不上。
        'selectedActiveSkillIds',
        'skillLevels',
      ]).toContain(key);
    }
  });

  it('结算后状态以服务端为准，并自动刷新候选', async () => {
    await setupGame();
    submitArenaChallenge.mockResolvedValue(victoryResult());
    const arena = useArenaStore();
    await arena.refresh();
    // 挑战后自动刷新：服务端返回的新一轮状态就是结算后的真实状态
    fetchArenaCandidates.mockResolvedValue({
      me: { ...BOARD_ME, rank: 45, tier: 'hupo', honor: 240, winStreak: 2, attemptsLeft: 4 },
      candidates: [CANDIDATE],
    });
    await arena.challenge(arena.candidates[0]!);

    expect(arena.me?.rank).toBe(45);
    expect(arena.me?.honor).toBe(240);
    expect(arena.me?.winStreak).toBe(2);
    expect(arena.me?.attemptsLeft).toBe(4);
    expect(arena.me?.tier).toBe('hupo');
    expect(arena.lastBattle?.won).toBe(true);
    // refresh 收尾：上传 + 拉候选各再调一次
    expect(uploadArenaSnapshot.mock.calls.length).toBeGreaterThanOrEqual(2);
    expect(arena.challenging).toBe(false);
  });

  it('前置守卫：次数用完不发请求', async () => {
    await setupGame();
    fetchArenaCandidates.mockResolvedValue({
      me: { ...BOARD_ME, attemptsLeft: 0 },
      candidates: [CANDIDATE],
    });
    const arena = useArenaStore();
    await arena.refresh();

    const result = await arena.challenge(arena.candidates[0]!);
    expect(result).toBeNull();
    expect(arena.lastError).toContain('明天见');
    expect(submitArenaChallenge).not.toHaveBeenCalled();
  });

  it('前置守卫：荣誉不足不发请求', async () => {
    await setupGame();
    fetchArenaCandidates.mockResolvedValue({
      me: { ...BOARD_ME, honor: 5 },
      candidates: [CANDIDATE],
    });
    const arena = useArenaStore();
    await arena.refresh();
    arena.stake = 50;

    const result = await arena.challenge(arena.candidates[0]!);
    expect(result).toBeNull();
    expect(arena.lastError).toContain('荣誉印记不足');
    expect(submitArenaChallenge).not.toHaveBeenCalled();
  });

  it('挑战请求失败：错误落进 lastError，状态复位并兜底刷新', async () => {
    await setupGame();
    submitArenaChallenge.mockRejectedValue(new Error('排名已变动，请刷新候选'));
    const arena = useArenaStore();
    await arena.refresh();

    const result = await arena.challenge(arena.candidates[0]!);
    expect(result).toBeNull();
    expect(arena.lastError).toContain('排名已变动');
    expect(arena.challenging).toBe(false);
    expect(arena.lastBattle).toBeNull();
  });
});

describe('challengeRevenge / 复仇反击', () => {
  const REVENGE_ENTRY = {
    userId: 'u-opp-2',
    rank: 40,
    displayName: '对手乙',
    classId: 'shaman' as const,
    combatPower: 15000,
    winRate: 0.45,
    beatenAt: '2026-07-29T10:00:00+08:00',
    expiresAt: '2026-07-30T10:00:00+08:00',
  };

  function revengeResult() {
    return {
      won: true,
      reason: 'knockout' as const,
      honorDelta: 0,
      honor: 200,
      rankBefore: 50,
      rankAfter: 40,
      winStreak: 2,
      tier: 'hupo',
      attemptsLeft: 5,
      battle: {
        durationSec: 4.1,
        attackerHpRemainPct: 0.6,
        defenderHpRemainPct: 0,
        attackerDamage: 8000,
        defenderDamage: 1500,
        log: [],
      },
    };
  }

  it('refresh 解析反击机会列表', async () => {
    await setupGame();
    fetchArenaCandidates.mockResolvedValue({
      me: { ...BOARD_ME },
      candidates: [CANDIDATE],
      revenge: [REVENGE_ENTRY],
    });
    const arena = useArenaStore();
    await arena.refresh();

    expect(arena.revenge).toHaveLength(1);
    expect(arena.revenge[0]?.userId).toBe('u-opp-2');
    expect(arena.revenge[0]?.winRate).toBe(0.45);
    expect(arena.revenge[0]?.expiresAt).toContain('2026-07-30');
  });

  it('反击载荷：stake=0、isRevenge=true，不提交胜负', async () => {
    await setupGame();
    fetchArenaCandidates.mockResolvedValue({
      me: { ...BOARD_ME },
      candidates: [CANDIDATE],
      revenge: [REVENGE_ENTRY],
    });
    submitArenaChallenge.mockResolvedValue(revengeResult());
    const arena = useArenaStore();
    await arena.refresh();

    const result = await arena.challengeRevenge(arena.revenge[0]!);
    expect(result?.won).toBe(true);

    const payload = submitArenaChallenge.mock.calls[0]![1] as Record<string, unknown>;
    expect(payload.defenderId).toBe('u-opp-2');
    expect(payload.stake).toBe(0);
    expect(payload.isRevenge).toBe(true);
    for (const key of Object.keys(payload)) {
      expect([
        'seasonId',
        'classId',
        'level',
        'displayName',
        'equipped',
        'defenderId',
        'stake',
        'isRevenge',
        // M3-5：玩家编排的技能栏，服务端复算要用
        'selectedActiveSkillIds',
        'skillLevels',
      ]).toContain(key);
    }
  });

  it('反击不占每日次数、不查荣誉：次数为 0 / 荣誉为 0 也能发起', async () => {
    await setupGame();
    fetchArenaCandidates.mockResolvedValue({
      me: { ...BOARD_ME, attemptsLeft: 0, honor: 0 },
      candidates: [],
      revenge: [REVENGE_ENTRY],
    });
    submitArenaChallenge.mockResolvedValue(revengeResult());
    const arena = useArenaStore();
    await arena.refresh();

    const result = await arena.challengeRevenge(arena.revenge[0]!);
    expect(result?.won).toBe(true);
    expect(submitArenaChallenge).toHaveBeenCalledTimes(1);
    expect(arena.lastError).toBeNull();
  });

  it('反击窗口过期（服务端 400）：错误落进 lastError，兜底刷新', async () => {
    await setupGame();
    fetchArenaCandidates.mockResolvedValue({
      me: { ...BOARD_ME },
      candidates: [CANDIDATE],
      revenge: [],
    });
    submitArenaChallenge.mockRejectedValue(new Error('反击机会不存在或已过期'));
    const arena = useArenaStore();
    await arena.refresh();

    const result = await arena.challengeRevenge(REVENGE_ENTRY);
    expect(result).toBeNull();
    expect(arena.lastError).toContain('反击机会');
    expect(arena.challenging).toBe(false);
    expect(arena.lastBattle).toBeNull();
  });
});

describe('奖励同步 / 商店 / 碎片兑换', () => {
  const SETTLE_GRANT = {
    id: 'g-settle-1',
    kind: 'settle',
    dayKey: '2026-07-29',
    createdAt: '2026-07-30T04:10:00+08:00',
    payload: {
      tier: 'feiyue',
      tierName: '绯月',
      rank: 50,
      total: 300,
      tierHonor: 80,
      defense: { challenged: 3, held: 2, reward: 19 },
      boxes: [
        { boxId: 'box_starlight', honor: 55, items: { stone_reforge: 5, sand_crystal: 2 } },
      ],
    },
  };

  it('结算奖励直接进背包并标记 claimed，战报进 settleReports', async () => {
    await setupGame();
    fetchPendingArenaGrants.mockResolvedValue([SETTLE_GRANT]);
    const game = useGameStore();
    const reforgeBefore = game.save?.bag.items.stone_reforge ?? 0;
    const sandBefore = game.save?.bag.items.sand_crystal ?? 0;
    const arena = useArenaStore();
    await arena.refresh();

    expect(game.save?.bag.items.stone_reforge).toBe(reforgeBefore + 5);
    expect(game.save?.bag.items.sand_crystal).toBe(sandBefore + 2);
    expect(markArenaGrantClaimed).toHaveBeenCalledWith(expect.anything(), 'g-settle-1');
    expect(arena.settleReports).toHaveLength(1);
    expect(arena.settleReports[0]?.tierName).toBe('绯月');
    expect(arena.settleReports[0]?.defense.held).toBe(2);
    arena.dismissSettleReports();
    expect(arena.settleReports).toHaveLength(0);
  });

  it('商店兑换：服务端扣荣誉，装备实例以 grant id 为 uid 进背包（幂等）', async () => {
    await setupGame();
    fetchArenaCandidates.mockResolvedValue({
      me: { ...BOARD_ME, honor: 2000 },
      candidates: [CANDIDATE],
      revenge: [],
    });
    const game = useGameStore();
    buyArenaShopEntry.mockResolvedValue({ honor: 100 });
    fetchPendingArenaGrants.mockResolvedValue([
      {
        id: 'g-shop-1',
        kind: 'shop',
        dayKey: '2026-07-29',
        createdAt: '2026-07-29T18:00:00+08:00',
        payload: { entryId: 'arena_swordsman_weapon', defId: 'eq_arena_swordsman_triumph-verdict-blade', seed: 12345 },
      },
    ]);
    const arena = useArenaStore();
    await arena.refresh();

    const ok = await arena.buyShopEntry('arena_swordsman_weapon');
    expect(ok).toBe(true);
    expect(buyArenaShopEntry).toHaveBeenCalledWith(expect.anything(), {
      seasonId: expect.any(String),
      entryId: 'arena_swordsman_weapon',
      classId: 'swordsman',
    });
    expect(arena.me?.honor).toBe(100);
    const granted = game.save?.bag.equipment.filter((e) => e.uid === 'g-shop-1');
    expect(granted).toHaveLength(1);
    expect(granted?.[0]?.defId).toBe('eq_arena_swordsman_triumph-verdict-blade');
    expect(markArenaGrantClaimed).toHaveBeenCalledWith(expect.anything(), 'g-shop-1');
  });

  it('前置守卫：荣誉不足不发购买请求', async () => {
    await setupGame();
    fetchArenaCandidates.mockResolvedValue({
      me: { ...BOARD_ME, honor: 5 },
      candidates: [CANDIDATE],
      revenge: [],
    });
    const arena = useArenaStore();
    await arena.refresh();

    const ok = await arena.buyShopEntry('arena_swordsman_weapon');
    expect(ok).toBe(false);
    expect(arena.lastError).toContain('荣誉印记不足');
    expect(buyArenaShopEntry).not.toHaveBeenCalled();
  });

  it('碎片兑换：40 枚本地换一件本职业圣痕装备', async () => {
    await setupGame();
    const game = useGameStore();
    game.save!.bag.items.frag_stigma = 45;
    const arena = useArenaStore();
    await arena.refresh();

    const inst = arena.exchangeStigmaFragments('eq_arena_swordsman_triumph-laurel-crown');
    expect(inst).not.toBeNull();
    expect(inst?.defId).toBe('eq_arena_swordsman_triumph-laurel-crown');
    expect(game.save?.bag.items.frag_stigma).toBe(5);
    expect(game.save?.bag.equipment.some((e) => e.uid === inst?.uid)).toBe(true);

    // 别职业的不能换
    expect(arena.exchangeStigmaFragments('eq_arena_witch_starjudge-scale-staff')).toBeNull();
    expect(game.save?.bag.items.frag_stigma).toBe(5);
  });

  it('碎片不足 40 枚时不兑换', async () => {
    await setupGame();
    const game = useGameStore();
    game.save!.bag.items.frag_stigma = 39;
    const arena = useArenaStore();
    await arena.refresh();

    expect(arena.exchangeStigmaFragments('eq_arena_swordsman_triumph-laurel-crown')).toBeNull();
    expect(game.save?.bag.items.frag_stigma).toBe(39);
    expect(arena.lastError).toContain('碎片不足');
  });
});

describe('离线降级', () => {
  it('会话建立失败时 refresh 安静返回，状态为空', async () => {
    const { ensureAnonymousSession } = await import('@/net/supabase');
    vi.mocked(ensureAnonymousSession).mockResolvedValueOnce(null);
    await setupGame();
    const arena = useArenaStore();
    await expect(arena.refresh()).resolves.toBeUndefined();
    expect(arena.status).toBe('unconfigured');
    expect(arena.me).toBeNull();
    expect(uploadArenaSnapshot).not.toHaveBeenCalled();
  });
});
