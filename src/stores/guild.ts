/** 公会领域 store：联机失败只降级公会页，绝不阻塞本地挂机。 */

import { computed, ref } from 'vue';
import { defineStore } from 'pinia';
import { useGameStore } from './game';
import { ensureAnonymousSession, getSupabaseClient, isSupabaseConfigured } from '@/net/supabase';
import { upsertProfile } from '@/net/leaderboard';
import {
  createGuild as createGuildRequest,
  fetchGuildDetail as fetchGuildDetailRequest,
  fetchGuildExpedition,
  fetchGuildList,
  fetchMyGuild,
  isMissingGuildFunctionError,
  joinGuild as joinGuildRequest,
  joinGuildByCode as joinGuildByCodeRequest,
  leaveGuild as leaveGuildRequest,
  removeGuildMember as removeGuildMemberRequest,
  submitGuildExpedition,
  updateGuildNotice as updateGuildNoticeRequest,
  type GuildDetail,
  type GuildExpeditionResult,
  type GuildExpeditionState,
  type GuildMembershipState,
  type GuildSummary,
} from '@/net/guild';
import { buildTrialCombatant } from '@/core/trial';
import { SLOT_ORDER } from '@/data/constants';
import { TRIAL_SEASON_ID } from '@/data/trialRules';

export type GuildStatus = 'unconfigured' | 'connecting' | 'ready' | 'offline';

export const useGuildStore = defineStore('guild', () => {
  const game = useGameStore();
  const status = ref<GuildStatus>(isSupabaseConfigured ? 'offline' : 'unconfigured');
  const userId = ref<string | null>(null);
  const lastError = ref<string | null>(null);
  const loading = ref(false);
  const mutating = ref(false);
  const challenging = ref(false);
  const membership = ref<GuildMembershipState | null>(null);
  const guilds = ref<GuildSummary[]>([]);
  const expedition = ref<GuildExpeditionState | null>(null);
  const lastResult = ref<GuildExpeditionResult | null>(null);
  const pendingChallengeId = ref<string | null>(null);
  /** 广场详情：当前展开的公会、加载态与后端缺函数降级标记。 */
  const detail = ref<GuildDetail | null>(null);
  const detailGuildId = ref<string | null>(null);
  const detailLoading = ref(false);
  const detailUnsupported = ref(false);

  const isLeader = computed(() => membership.value?.myRole === 'leader');
  const attemptsLeft = computed(() => {
    const today = expedition.value?.today;
    return today ? Math.max(0, today.attemptsMax - today.attemptsUsed) : 0;
  });
  const canChallenge = computed(() =>
    Boolean(membership.value && expedition.value && attemptsLeft.value > 0 && !challenging.value),
  );

  function equipped() {
    const save = game.save;
    if (!save) throw new Error('[公会] 没有存档');
    return SLOT_ORDER.map((slot) => save.equipped[slot]);
  }

  function snapshot() {
    const save = game.save;
    if (!save) throw new Error('[公会] 没有存档');
    return {
      classId: save.player.classId,
      level: save.player.level,
      displayName: save.player.name,
      equipped: equipped(),
    };
  }

  let connectPromise: Promise<boolean> | null = null;

  async function connect(): Promise<boolean> {
    if (!isSupabaseConfigured) {
      status.value = 'unconfigured';
      return false;
    }
    if (status.value === 'ready' && userId.value) return true;
    // 并发调用共享同一次登录尝试，避免慢网络下重复匿名注册
    connectPromise ??= (async () => {
      status.value = 'connecting';
      try {
        const session = await ensureAnonymousSession();
        if (!session) {
          status.value = 'unconfigured';
          return false;
        }
        const current = snapshot();
        const power = buildTrialCombatant({ name: current.displayName, ...current }).combatPower;
        await upsertProfile(session.client, {
          id: session.userId,
          displayName: current.displayName,
          classId: current.classId,
          level: current.level,
          combatPower: power,
        });
        userId.value = session.userId;
        status.value = 'ready';
        lastError.value = null;
        return true;
      } catch (error) {
        status.value = 'offline';
        lastError.value = error instanceof Error ? error.message : '公会连接失败';
        return false;
      }
    })().finally(() => {
      connectPromise = null;
    });
    return connectPromise;
  }

  async function refresh(): Promise<void> {
    if (loading.value) return;
    loading.value = true;
    try {
      if (!(await connect())) return;
      const client = await getSupabaseClient();
      if (!client) return;
      const previousGuildId = membership.value?.guild.id ?? null;
      const nextMembership = await fetchMyGuild(client);
      const nextGuildId = nextMembership?.guild.id ?? null;
      if (previousGuildId !== nextGuildId) {
        pendingChallengeId.value = null;
        lastResult.value = null;
      }
      membership.value = nextMembership;
      if (previousGuildId !== nextGuildId) closeDetail();
      // 无论是否已加入公会，都保持广场列表可见——已加入的玩家也能浏览其他公会。
      const listPromise = fetchGuildList(client);
      if (!membership.value) {
        expedition.value = null;
        guilds.value = await listPromise;
      } else {
        const [nextGuilds, nextExpedition] = await Promise.all([
          listPromise,
          fetchGuildExpedition(client, TRIAL_SEASON_ID, snapshot().level),
        ]);
        guilds.value = nextGuilds;
        expedition.value = nextExpedition;
      }
      lastError.value = null;
    } catch (error) {
      lastError.value = error instanceof Error ? error.message : '公会状态读取失败';
    } finally {
      loading.value = false;
    }
  }

  async function mutate(
    action: (client: NonNullable<Awaited<ReturnType<typeof getSupabaseClient>>>) => Promise<void>,
  ) {
    if (mutating.value || !(await connect())) return false;
    const client = await getSupabaseClient();
    if (!client) return false;
    mutating.value = true;
    lastError.value = null; // 清掉上一次操作的残留错误，避免横幅挂到下一次刷新结束
    try {
      await action(client);
      await refresh();
      lastError.value = null;
      return true;
    } catch (error) {
      lastError.value = error instanceof Error ? error.message : '公会操作失败';
      return false;
    } finally {
      mutating.value = false;
    }
  }

  const createGuild = (name: string) => mutate((client) => createGuildRequest(client, name));
  const joinGuild = (guildId: string) => mutate((client) => joinGuildRequest(client, guildId));
  const leaveGuild = () => mutate((client) => leaveGuildRequest(client));

  /** 凭邀请码加入；成功时返回公会名片用于欢迎提示。 */
  async function joinByCode(code: string): Promise<{ id: string; name: string } | null> {
    let joined: { id: string; name: string } | null = null;
    const ok = await mutate(async (client) => {
      joined = await joinGuildByCodeRequest(client, code);
    });
    return ok ? joined : null;
  }

  /** 后端缺详情 RPC 时，用广场列表/我的公会数据拼一份名片降级展示。 */
  function fallbackDetail(guildId: string): GuildDetail | null {
    if (membership.value?.guild.id === guildId) {
      const { guild, members } = membership.value;
      return {
        guild: { ...guild, leaderName: members.find((m) => m.role === 'leader')?.displayName ?? '', createdAt: '' },
        members,
        expedition: null,
      };
    }
    const summary = guilds.value.find((item) => item.id === guildId);
    if (!summary) return null;
    return { guild: { ...summary, leaderName: '', createdAt: '' }, members: [], expedition: null };
  }

  async function openDetail(guildId: string): Promise<void> {
    if (detailLoading.value) return;
    detailGuildId.value = guildId;
    detail.value = null;
    if (detailUnsupported.value || !(await connect())) {
      detail.value = fallbackDetail(guildId);
      return;
    }
    const client = await getSupabaseClient();
    if (!client) return;
    detailLoading.value = true;
    try {
      detail.value = await fetchGuildDetailRequest(client, guildId);
      lastError.value = null;
    } catch (error) {
      if (isMissingGuildFunctionError(error)) {
        detailUnsupported.value = true;
        detail.value = fallbackDetail(guildId);
      } else {
        lastError.value = error instanceof Error ? error.message : '公会详情读取失败';
        detailGuildId.value = null;
      }
    } finally {
      detailLoading.value = false;
    }
  }

  function closeDetail(): void {
    detailGuildId.value = null;
    detail.value = null;
  }
  const updateNotice = (notice: string) =>
    mutate((client) => updateGuildNoticeRequest(client, notice));
  const removeMember = (memberId: string) =>
    mutate((client) => removeGuildMemberRequest(client, memberId));

  async function challenge(): Promise<GuildExpeditionResult | null> {
    if (!canChallenge.value || !(await connect())) return null;
    const client = await getSupabaseClient();
    if (!client) return null;
    challenging.value = true;
    pendingChallengeId.value ??= crypto.randomUUID();
    try {
      const state = await submitGuildExpedition(client, {
        requestId: pendingChallengeId.value,
        seasonId: TRIAL_SEASON_ID,
        ...snapshot(),
      });
      expedition.value = state;
      lastResult.value = state.result ?? null;
      pendingChallengeId.value = null;
      lastError.value = null;
      return lastResult.value;
    } catch (error) {
      const message = error instanceof Error ? error.message : '远征挑战失败';
      await refresh().catch(() => undefined);
      lastError.value = message;
      return null;
    } finally {
      challenging.value = false;
    }
  }

  function clearResult() {
    lastResult.value = null;
  }

  return {
    status,
    userId,
    lastError,
    loading,
    mutating,
    challenging,
    membership,
    guilds,
    expedition,
    lastResult,
    detail,
    detailGuildId,
    detailLoading,
    detailUnsupported,
    isLeader,
    attemptsLeft,
    canChallenge,
    connect,
    refresh,
    createGuild,
    joinGuild,
    joinByCode,
    leaveGuild,
    updateNotice,
    removeMember,
    openDetail,
    closeDetail,
    challenge,
    clearResult,
  };
});
