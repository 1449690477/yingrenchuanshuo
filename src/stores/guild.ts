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
import { fetchGuildCommissionState, type GuildCommissionState } from '@/net/guildCommissions';
import {
  claimGuildShopOffer,
  donateGuildMerit,
  fetchGuildStrongholdState,
  type GuildShopOfferState,
  type GuildStrongholdState,
} from '@/net/guildStronghold';
import { SLOT_ORDER } from '@/data/constants';
import { TRIAL_SEASON_ID } from '@/data/trialRules';

export type GuildStatus = 'unconfigured' | 'connecting' | 'ready' | 'offline';

const PENDING_GUILD_ACTION_PREFIX = 'sakura-legend:guild-action:v1';
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/** 只把“后端尚未部署该 RPC”视为分阶段发布；网络和服务端错误必须显式冒泡。 */
async function optionalGuildModule<T>(loader: () => Promise<T>): Promise<T | null> {
  try {
    return await loader();
  } catch (error) {
    if (isMissingGuildFunctionError(error)) return null;
    throw error;
  }
}

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
  const commissions = ref<GuildCommissionState | null>(null);
  const stronghold = ref<GuildStrongholdState | null>(null);
  const lastResult = ref<GuildExpeditionResult | null>(null);
  const pendingChallengeId = ref<string | null>(null);
  /** 广场详情：当前展开的公会、加载态与后端缺函数降级标记。 */
  const detail = ref<GuildDetail | null>(null);
  const detailGuildId = ref<string | null>(null);
  const detailLoading = ref(false);
  const detailUnsupported = ref(false);
  const pendingActionIds = new Map<string, string>();

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

  function actionRequestKey(action: string): string | null {
    const currentUserId = userId.value;
    const guildId = membership.value?.guild.id;
    if (!currentUserId || !guildId) return null;
    return [PENDING_GUILD_ACTION_PREFIX, currentUserId, guildId, TRIAL_SEASON_ID, action]
      .map(encodeURIComponent)
      .join(':');
  }

  /**
   * 权威联机操作的 requestId 必须跨刷新保留：响应丢失后重试同一 ID，数据库才有机会
   * 返回第一次结算，而不是把玩家的同一次点击再扣一遍。
   */
  function pendingRequestId(key: string): string {
    const cached = pendingActionIds.get(key);
    if (cached) return cached;
    let stored: string | null = null;
    try {
      stored = typeof localStorage === 'undefined' ? null : localStorage.getItem(key);
    } catch {
      // 隐私模式禁用存储时仍保留本页内幂等；不伪造“已持久化”。
    }
    const requestId = stored && UUID_PATTERN.test(stored) ? stored : crypto.randomUUID();
    pendingActionIds.set(key, requestId);
    try {
      if (typeof localStorage !== 'undefined') localStorage.setItem(key, requestId);
    } catch {
      // 同上：内存账仍能保护当前页面的重试。
    }
    return requestId;
  }

  function completeRequest(key: string, requestId: string): void {
    if (pendingActionIds.get(key) === requestId) pendingActionIds.delete(key);
    try {
      if (typeof localStorage !== 'undefined' && localStorage.getItem(key) === requestId) {
        localStorage.removeItem(key);
      }
    } catch {
      // 存储不可用时没有持久项需要清理。
    }
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
        // 战力不再由客户端算完上报：sync-profile 拿这份搭配快照在服务端现算
        // （docs/65 §六之二 方向 A —— profiles 的写策略是 for all，
        //   客户端上报的战力等于自填名次）
        await upsertProfile(session.client, {
          displayName: current.displayName,
          classId: current.classId,
          level: current.level,
          equipped: current.equipped,
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
        commissions.value = null;
        stronghold.value = null;
        guilds.value = await listPromise;
      } else {
        const [nextGuilds, nextExpedition, nextCommissions, nextStronghold] = await Promise.all([
          listPromise,
          fetchGuildExpedition(client, TRIAL_SEASON_ID, snapshot().level),
          // 新公会模块尚未部署时不应让已有远征或挂机失效。
          optionalGuildModule(() => fetchGuildCommissionState(client)),
          optionalGuildModule(() => fetchGuildStrongholdState(client, TRIAL_SEASON_ID)),
        ]);
        guilds.value = nextGuilds;
        expedition.value = nextExpedition;
        commissions.value = nextCommissions;
        stronghold.value = nextStronghold;
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
        guild: {
          ...guild,
          leaderName: members.find((m) => m.role === 'leader')?.displayName ?? '',
          createdAt: '',
        },
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
  async function donateMerit(amount: number): Promise<boolean> {
    const key = actionRequestKey(`donation:${amount}`);
    if (!key) return false;
    const requestId = pendingRequestId(key);
    const ok = await mutate((client) =>
      donateGuildMerit(client, TRIAL_SEASON_ID, requestId, amount),
    );
    if (ok) completeRequest(key, requestId);
    return ok;
  }

  async function claimShopOffer(offerId: GuildShopOfferState['id']): Promise<boolean> {
    const key = actionRequestKey(`claim:${offerId}`);
    if (!key) return false;
    const requestId = pendingRequestId(key);
    const ok = await mutate((client) =>
      claimGuildShopOffer(client, TRIAL_SEASON_ID, requestId, offerId),
    );
    if (ok) completeRequest(key, requestId);
    return ok;
  }

  async function challenge(): Promise<GuildExpeditionResult | null> {
    if (!canChallenge.value || !(await connect())) return null;
    const client = await getSupabaseClient();
    if (!client) return null;
    challenging.value = true;
    const challengeKey = actionRequestKey('challenge');
    if (!challengeKey) {
      challenging.value = false;
      return null;
    }
    pendingChallengeId.value ??= pendingRequestId(challengeKey);
    try {
      const state = await submitGuildExpedition(client, {
        requestId: pendingChallengeId.value,
        seasonId: TRIAL_SEASON_ID,
        ...snapshot(),
      });
      expedition.value = state;
      lastResult.value = state.result ?? null;
      // 委托、功勋和据点都由同一次服务端复算远征触发；客户端只刷新只读快照。
      commissions.value = await optionalGuildModule(() => fetchGuildCommissionState(client));
      stronghold.value = await optionalGuildModule(() =>
        fetchGuildStrongholdState(client, TRIAL_SEASON_ID),
      );
      // 当天建设刚完成时，声望在服务器立即增加；同步名片以更新据点阶段展示。
      membership.value = await fetchMyGuild(client);
      completeRequest(challengeKey, pendingChallengeId.value);
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
    commissions,
    stronghold,
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
    donateMerit,
    claimShopOffer,
    openDetail,
    closeDetail,
    challenge,
    clearResult,
  };
});
