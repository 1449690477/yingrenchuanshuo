import 'fake-indexeddb/auto';
import { createPinia, setActivePinia } from 'pinia';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { clearSave } from '@/save/storage';
import { createSave } from '@/save/schema';
import { useGameStore } from '../game';

const sessionMock = { client: { __fake: true }, userId: 'u-self' };
vi.mock('@/net/supabase', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/net/supabase')>();
  return {
    ...actual,
    isSupabaseConfigured: true,
    ensureAnonymousSession: vi.fn(async () => sessionMock),
    getSupabaseClient: vi.fn(async () => sessionMock.client),
  };
});

const upsertProfile = vi.fn();
vi.mock('@/net/leaderboard', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/net/leaderboard')>();
  return { ...actual, upsertProfile: (...args: unknown[]) => upsertProfile(...args) };
});

const fetchGuildList = vi.fn();
const fetchMyGuild = vi.fn();
const fetchGuildDetail = vi.fn();
const fetchGuildExpedition = vi.fn();
const createGuild = vi.fn();
const joinGuild = vi.fn();
const joinGuildByCode = vi.fn();
const leaveGuild = vi.fn();
const updateGuildNotice = vi.fn();
const removeGuildMember = vi.fn();
const submitGuildExpedition = vi.fn();
const fetchGuildCommissionState = vi.fn();
vi.mock('@/net/guildCommissions', () => ({
  fetchGuildCommissionState: (...args: unknown[]) => fetchGuildCommissionState(...args),
}));
const fetchGuildStrongholdState = vi.fn();
const donateGuildMerit = vi.fn();
const claimGuildShopOffer = vi.fn();
vi.mock('@/net/guildStronghold', () => ({
  fetchGuildStrongholdState: (...args: unknown[]) => fetchGuildStrongholdState(...args),
  donateGuildMerit: (...args: unknown[]) => donateGuildMerit(...args),
  claimGuildShopOffer: (...args: unknown[]) => claimGuildShopOffer(...args),
}));

vi.mock('@/net/guild', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/net/guild')>();
  return {
    ...actual,
    fetchGuildList: (...args: unknown[]) => fetchGuildList(...args),
    fetchMyGuild: (...args: unknown[]) => fetchMyGuild(...args),
    fetchGuildDetail: (...args: unknown[]) => fetchGuildDetail(...args),
    fetchGuildExpedition: (...args: unknown[]) => fetchGuildExpedition(...args),
    createGuild: (...args: unknown[]) => createGuild(...args),
    joinGuild: (...args: unknown[]) => joinGuild(...args),
    joinGuildByCode: (...args: unknown[]) => joinGuildByCode(...args),
    leaveGuild: (...args: unknown[]) => leaveGuild(...args),
    updateGuildNotice: (...args: unknown[]) => updateGuildNotice(...args),
    removeGuildMember: (...args: unknown[]) => removeGuildMember(...args),
    submitGuildExpedition: (...args: unknown[]) => submitGuildExpedition(...args),
  };
});

import { useGuildStore } from '../guild';

const membership = {
  guild: {
    id: 'g-1',
    name: '樱灯庭',
    notice: '慢慢来',
    leaderId: 'u-self',
    reputation: 0,
    expeditionClears: 0,
    memberCount: 1,
    memberLimit: 20,
  },
  myRole: 'leader' as const,
  members: [
    {
      userId: 'u-self',
      displayName: '夜见',
      classId: 'swordsman' as const,
      level: 48,
      combatPower: 1000,
      role: 'leader' as const,
      joinedAt: '2026-07-30T00:00:00Z',
    },
  ],
};

const expedition = {
  guildId: 'g-1',
  expedition: {
    seasonId: 's1',
    weekIndex: 30,
    weekKey: 's1:w30',
    memberSnapshot: 1,
    target: 4000,
    progress: 500,
    completed: false,
    completedAt: null,
  },
  leaders: [],
  boss: {
    name: '坚壳·烬甲龙',
    element: 'fire',
    tiltId: 'shell',
    tiltName: '坚壳',
    hint: '攻击更有价值',
    bracketId: 'feiyue',
    bracketName: '绯月',
  },
  today: { attemptsUsed: 0, attemptsMax: 3, bestPoints: 0 },
};

const commissions = {
  dayKey: '2026-08-01',
  commissions: [
    { id: 'expedition-entry', name: '远征集结', description: '完成一次公会远征', contribution: 80 },
  ],
  progress: 80,
  target: 1800,
  completed: false,
  participants: 1,
  completedCommissionIds: ['expedition-entry'],
};

const stronghold = {
  seasonId: 's1',
  meritBalance: 5,
  stronghold: {
    progress: 12,
    commissionDays: 1,
    raidClears: 1,
    donatedMerits: 0,
    stageId: 'lantern' as const,
  },
  offers: [],
};

beforeEach(async () => {
  setActivePinia(createPinia());
  await clearSave();
  const game = useGameStore();
  const save = createSave('夜见', 'swordsman', 7, Date.now() - 1000);
  save.player.level = 48;
  game.loadFrom(save);
  for (const mock of [
    upsertProfile,
    fetchGuildList,
    fetchMyGuild,
    fetchGuildDetail,
    fetchGuildExpedition,
    createGuild,
    joinGuild,
    joinGuildByCode,
    leaveGuild,
    updateGuildNotice,
    removeGuildMember,
    submitGuildExpedition,
    fetchGuildCommissionState,
    fetchGuildStrongholdState,
    donateGuildMerit,
    claimGuildShopOffer,
  ])
    mock.mockReset();
  upsertProfile.mockResolvedValue(undefined);
  fetchGuildList.mockResolvedValue([]);
  fetchMyGuild.mockResolvedValue(membership);
  fetchGuildExpedition.mockResolvedValue(expedition);
  fetchGuildCommissionState.mockResolvedValue(commissions);
  fetchGuildStrongholdState.mockResolvedValue(stronghold);
  donateGuildMerit.mockResolvedValue(undefined);
  claimGuildShopOffer.mockResolvedValue(undefined);
});

afterEach(async () => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  await clearSave();
});

describe('公会 store 联机降级与刷新', () => {
  it('同步公开档案后读取成员和远征', async () => {
    const guild = useGuildStore();
    await guild.refresh();
    expect(guild.status).toBe('ready');
    expect(upsertProfile).toHaveBeenCalledTimes(1);
    expect(guild.membership?.guild.name).toBe('樱灯庭');
    expect(guild.expedition?.expedition.progress).toBe(500);
    expect(guild.commissions?.completedCommissionIds).toEqual(['expedition-entry']);
    expect(guild.stronghold?.meritBalance).toBe(5);
  });

  it('委托后端未部署时只收起建设板，不影响已上线公会和远征', async () => {
    fetchGuildCommissionState.mockRejectedValue(new Error('Could not find the function'));
    const guild = useGuildStore();
    await guild.refresh();
    expect(guild.lastError).toBeNull();
    expect(guild.expedition?.guildId).toBe('g-1');
    expect(guild.commissions).toBeNull();
  });

  it('据点后端未部署时只收起据点板，不影响团本和挂机入口', async () => {
    fetchGuildStrongholdState.mockRejectedValue(new Error('Could not find the function'));
    const guild = useGuildStore();
    await guild.refresh();
    expect(guild.lastError).toBeNull();
    expect(guild.expedition?.guildId).toBe('g-1');
    expect(guild.stronghold).toBeNull();
  });

  it('功勋捐献和收藏领取走统一的幂等操作与状态刷新', async () => {
    const guild = useGuildStore();
    await guild.refresh();
    await guild.donateMerit(5);
    await guild.claimShopOffer('moon-lantern');
    expect(donateGuildMerit).toHaveBeenCalledWith(expect.anything(), 's1', expect.any(String), 5);
    expect(claimGuildShopOffer).toHaveBeenCalledWith(
      expect.anything(),
      's1',
      expect.any(String),
      'moon-lantern',
    );
    expect(fetchGuildStrongholdState).toHaveBeenCalledTimes(3);
  });

  it('功勋捐献响应丢失后跨页面重试同一 requestId，不会重复扣款', async () => {
    const persisted = new Map<string, string>();
    vi.stubGlobal('localStorage', {
      getItem: (key: string) => persisted.get(key) ?? null,
      setItem: (key: string, value: string) => persisted.set(key, value),
      removeItem: (key: string) => persisted.delete(key),
    });
    donateGuildMerit.mockRejectedValueOnce(new Error('请求超时')).mockResolvedValueOnce(undefined);

    const firstGuild = useGuildStore();
    await firstGuild.refresh();
    await expect(firstGuild.donateMerit(5)).resolves.toBe(false);
    const firstRequestId = donateGuildMerit.mock.calls[0]![2] as string;
    expect(persisted.size).toBe(1);

    setActivePinia(createPinia());
    const nextGame = useGameStore();
    const nextSave = createSave('夜见', 'swordsman', 7, Date.now() - 1000);
    nextSave.player.level = 48;
    nextGame.loadFrom(nextSave);
    const nextGuild = useGuildStore();
    await nextGuild.refresh();
    await expect(nextGuild.donateMerit(5)).resolves.toBe(true);

    expect(donateGuildMerit.mock.calls[1]![2]).toBe(firstRequestId);
    expect(persisted.size).toBe(0);
  });

  it('新模块已部署后的真实读取错误必须显示，不能伪装成“准备中”', async () => {
    fetchGuildStrongholdState.mockRejectedValue(new Error('数据库超时'));
    const guild = useGuildStore();
    await guild.refresh();
    expect(guild.lastError).toContain('数据库超时');
  });

  it('网络失败只记录错误，不向挂机主流程抛出', async () => {
    fetchMyGuild.mockRejectedValue(new Error('网络连接失败'));
    const guild = useGuildStore();
    await expect(guild.refresh()).resolves.toBeUndefined();
    expect(guild.lastError).toContain('网络连接失败');
    expect(guild.loading).toBe(false);
  });

  it('未加入时读取开放公会列表', async () => {
    fetchMyGuild.mockResolvedValue(null);
    fetchGuildList.mockResolvedValue([{ id: 'g-2', name: '月樱', memberCount: 2 }]);
    const guild = useGuildStore();
    await guild.refresh();
    expect(fetchGuildList).toHaveBeenCalledTimes(1);
    expect(guild.guilds[0]?.name).toBe('月樱');
    expect(guild.expedition).toBeNull();
  });

  it('并发刷新共享同一次登录尝试且不重复拉取', async () => {
    const { ensureAnonymousSession } = await import('@/net/supabase');
    vi.mocked(ensureAnonymousSession).mockClear();
    const guild = useGuildStore();
    await Promise.all([guild.refresh(), guild.refresh(), guild.refresh()]);
    expect(vi.mocked(ensureAnonymousSession)).toHaveBeenCalledTimes(1);
    expect(fetchMyGuild).toHaveBeenCalledTimes(1);
    expect(guild.loading).toBe(false);
  });

  it('已加入公会后仍保留广场列表，可以浏览其他公会', async () => {
    fetchGuildList.mockResolvedValue([
      { id: 'g-1', name: '樱灯庭', memberCount: 1 },
      { id: 'g-9', name: '星野庭', memberCount: 18 },
    ]);
    const guild = useGuildStore();
    await guild.refresh();
    expect(guild.membership?.guild.id).toBe('g-1');
    expect(fetchGuildList).toHaveBeenCalledTimes(1);
    expect(guild.guilds.map((item) => item.name)).toContain('星野庭');
    expect(guild.expedition?.expedition.progress).toBe(500);
  });
});

describe('公会广场详情', () => {
  const detail = {
    guild: {
      id: 'g-9',
      name: '星野庭',
      notice: '周末一起远征',
      reputation: 320,
      expeditionClears: 2,
      memberCount: 18,
      memberLimit: 20,
      leaderName: '星见',
      createdAt: '2026-07-01T00:00:00Z',
    },
    members: [
      {
        userId: 'u-other',
        displayName: '星见',
        classId: 'mage' as const,
        level: 52,
        combatPower: 1800,
        role: 'leader' as const,
        joinedAt: '2026-07-01T00:00:00Z',
      },
    ],
    expedition: { weekKey: 's1:w30', progress: 2600, target: 8000, completed: false },
  };

  it('openDetail 读取任意公会的公开名册与远征进度', async () => {
    fetchGuildDetail.mockResolvedValue(detail);
    const guild = useGuildStore();
    await guild.refresh();
    await guild.openDetail('g-9');
    expect(guild.detailGuildId).toBe('g-9');
    expect(guild.detail?.members[0]?.displayName).toBe('星见');
    expect(guild.detail?.expedition?.progress).toBe(2600);
    guild.closeDetail();
    expect(guild.detailGuildId).toBeNull();
    expect(guild.detail).toBeNull();
  });

  it('后端缺详情函数时降级为名片展示且不报错', async () => {
    fetchGuildDetail.mockRejectedValue(
      new Error('Could not find the function public.guild_get_detail in the schema cache'),
    );
    fetchGuildList.mockResolvedValue([{ id: 'g-9', name: '星野庭', memberCount: 18 }]);
    const guild = useGuildStore();
    await guild.refresh();
    await guild.openDetail('g-9');
    expect(guild.detailUnsupported).toBe(true);
    expect(guild.lastError).toBeNull();
    expect(guild.detail?.guild.name).toBe('星野庭');
    expect(guild.detail?.members).toEqual([]);
    // 已标记降级后不再重复请求远端
    await guild.openDetail('g-1');
    expect(fetchGuildDetail).toHaveBeenCalledTimes(1);
    expect(guild.detail?.members[0]?.displayName).toBe('夜见');
  });

  it('加入公会后自动收起详情弹层', async () => {
    fetchGuildDetail.mockResolvedValue(detail);
    fetchMyGuild.mockResolvedValue(null);
    const guild = useGuildStore();
    await guild.refresh();
    await guild.openDetail('g-9');
    expect(guild.detailGuildId).toBe('g-9');
    joinGuild.mockResolvedValue(undefined);
    fetchMyGuild.mockResolvedValue({
      ...membership,
      guild: { ...membership.guild, id: 'g-9', name: '星野庭' },
    });
    await guild.joinGuild('g-9');
    expect(guild.detailGuildId).toBeNull();
  });
});

describe('公会邀请码', () => {
  it('凭邀请码加入成功时返回公会名片用于欢迎提示', async () => {
    fetchMyGuild.mockResolvedValue(null);
    joinGuildByCode.mockResolvedValue({ id: 'g-9', name: '星野庭' });
    const guild = useGuildStore();
    await guild.refresh();
    const joined = await guild.joinByCode('ABCD2345');
    expect(joinGuildByCode).toHaveBeenCalledWith(expect.anything(), 'ABCD2345');
    expect(joined?.name).toBe('星野庭');
  });

  it('邀请码无效时保持未加入并透出服务端错误', async () => {
    fetchMyGuild.mockResolvedValue(null);
    joinGuildByCode.mockRejectedValue(new Error('邀请码无效，请核对后再试'));
    const guild = useGuildStore();
    await guild.refresh();
    await expect(guild.joinByCode('XXXX9999')).resolves.toBeNull();
    expect(guild.membership).toBeNull();
    expect(guild.lastError).toContain('邀请码无效');
  });
});

describe('公会远征提交', () => {
  it('载荷只有搭配与请求标识，不含伤害或贡献', async () => {
    submitGuildExpedition.mockResolvedValue({
      ...expedition,
      today: { attemptsUsed: 1, attemptsMax: 3, bestPoints: 620 },
      result: {
        points: 620,
        improvedBy: 620,
        bestPoints: 620,
        attemptsUsed: 1,
        progress: 1120,
        target: 4000,
        completed: false,
        justCompleted: false,
        damage: 9000,
        damageTaken: 120,
        survived: true,
        durationSec: 60,
        combatPower: 1000,
      },
    });
    const guild = useGuildStore();
    await guild.refresh();
    const result = await guild.challenge();
    expect(fetchGuildCommissionState).toHaveBeenCalledTimes(2);
    expect(fetchGuildStrongholdState).toHaveBeenCalledTimes(2);
    expect(guild.commissions?.progress).toBe(80);
    expect(result?.points).toBe(620);
    const payload = submitGuildExpedition.mock.calls[0]![1] as Record<string, unknown>;
    expect(Object.keys(payload).sort()).toEqual(
      [
        'classId',
        'displayName',
        'equipped',
        'level',
        'requestId',
        'seasonId',
        // M3-5：远征由服务端跑真实战斗，技能栏必须一起送
        'selectedActiveSkillIds',
      ].sort(),
    );
    expect(payload).not.toHaveProperty('damage');
    expect(payload).not.toHaveProperty('points');
    expect(payload.equipped as unknown[]).toHaveLength(8);
  });

  it('挑战失败保留页面并允许使用同一幂等请求重试', async () => {
    submitGuildExpedition.mockRejectedValue(new Error('请求超时'));
    const guild = useGuildStore();
    await guild.refresh();
    await expect(guild.challenge()).resolves.toBeNull();
    await expect(guild.challenge()).resolves.toBeNull();
    const first = (submitGuildExpedition.mock.calls[0]![1] as { requestId: string }).requestId;
    const second = (submitGuildExpedition.mock.calls[1]![1] as { requestId: string }).requestId;
    expect(second).toBe(first);
    expect(guild.lastError).toContain('请求超时');
  });

  it('退出并加入另一公会后不会把旧公会的幂等请求带过去', async () => {
    submitGuildExpedition.mockRejectedValue(new Error('请求超时'));
    leaveGuild.mockResolvedValue(undefined);
    joinGuild.mockResolvedValue(undefined);
    const guild = useGuildStore();
    await guild.refresh();
    await guild.challenge();
    const oldRequestId = (submitGuildExpedition.mock.calls[0]![1] as { requestId: string })
      .requestId;

    fetchMyGuild.mockResolvedValue(null);
    await guild.leaveGuild();
    fetchMyGuild.mockResolvedValue({
      ...membership,
      guild: { ...membership.guild, id: 'g-2', name: '月樱庭' },
    });
    await guild.joinGuild('g-2');
    await guild.challenge();

    const newRequestId = (submitGuildExpedition.mock.calls[1]![1] as { requestId: string })
      .requestId;
    expect(newRequestId).not.toBe(oldRequestId);
  });
});
