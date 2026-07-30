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
const fetchGuildExpedition = vi.fn();
const createGuild = vi.fn();
const joinGuild = vi.fn();
const leaveGuild = vi.fn();
const updateGuildNotice = vi.fn();
const removeGuildMember = vi.fn();
const submitGuildExpedition = vi.fn();
vi.mock('@/net/guild', () => ({
  fetchGuildList: (...args: unknown[]) => fetchGuildList(...args),
  fetchMyGuild: (...args: unknown[]) => fetchMyGuild(...args),
  fetchGuildExpedition: (...args: unknown[]) => fetchGuildExpedition(...args),
  createGuild: (...args: unknown[]) => createGuild(...args),
  joinGuild: (...args: unknown[]) => joinGuild(...args),
  leaveGuild: (...args: unknown[]) => leaveGuild(...args),
  updateGuildNotice: (...args: unknown[]) => updateGuildNotice(...args),
  removeGuildMember: (...args: unknown[]) => removeGuildMember(...args),
  submitGuildExpedition: (...args: unknown[]) => submitGuildExpedition(...args),
}));

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
    fetchGuildExpedition,
    createGuild,
    joinGuild,
    leaveGuild,
    updateGuildNotice,
    removeGuildMember,
    submitGuildExpedition,
  ])
    mock.mockReset();
  upsertProfile.mockResolvedValue(undefined);
  fetchGuildList.mockResolvedValue([]);
  fetchMyGuild.mockResolvedValue(membership);
  fetchGuildExpedition.mockResolvedValue(expedition);
});

afterEach(async () => {
  vi.restoreAllMocks();
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
    expect(result?.points).toBe(620);
    const payload = submitGuildExpedition.mock.calls[0]![1] as Record<string, unknown>;
    expect(Object.keys(payload).sort()).toEqual(
      ['classId', 'displayName', 'equipped', 'level', 'requestId', 'seasonId'].sort(),
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
});
