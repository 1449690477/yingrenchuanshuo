/**
 * 进度榜领域 store（docs/63 §五 · P4）。
 *
 * 职责：从存档推导最深首通 → 上报（服务端过 L1/L2/L3）→ 拉榜缓存。
 * 边界（与 leaderboard / affectionBoard 同三条）：
 *   1. 所有网络失败静默降级，**绝不能阻塞游戏主流程**
 *   2. 榜单缓存 5 分钟，避免每次切页签都打请求
 *   3. 首通捕获处的自动上报**只在已连过榜的玩家身上发生**
 *      （status==='ready'）；没开过榜的玩家不偷偷联网，开榜时同步
 *
 * 这个榜是公开的开荒竞速，不是私事 —— 但与羁绊榜不同在：
 * 进度数据本地永远完整，联网只是「让全服看见」。
 */

import { computed, ref } from 'vue';
import { defineStore } from 'pinia';
import { useGameStore } from './game';
import {
  deepestProgressClaim,
  progressStageLabel,
  type ProgressBoardRow,
  type ProgressClaim,
} from '@/core/progressBoard';
import {
  fetchProgressBoard,
  submitProgressReport,
  type ProgressSubmitResult,
} from '@/net/progressBoard';
import { ensureAnonymousSession, isSupabaseConfigured } from '@/net/supabase';

export type ProgressBoardStatus = 'unconfigured' | 'connecting' | 'ready' | 'offline';

/** 榜单缓存有效期（与试炼榜/羁绊榜一致：5 分钟） */
export const PROGRESS_BOARD_CACHE_TTL_MS = 5 * 60 * 1000;

export const useProgressBoardStore = defineStore('progressBoard', () => {
  const game = useGameStore();

  const status = ref<ProgressBoardStatus>(isSupabaseConfigured ? 'offline' : 'unconfigured');
  const userId = ref<string | null>(null);
  const lastError = ref<string | null>(null);
  const syncing = ref(false);
  const boardLoading = ref(false);

  const boardCache = ref<{ at: number; rows: ProgressBoardRow[] } | null>(null);
  /** 最近一次同步的服务端回执（我的名次与榜上人数）。 */
  const lastSync = ref<ProgressSubmitResult | null>(null);

  // ─────────── 本地快照 ───────────

  /** 从存档推导最深首通 —— 不联网也能在「你的开荒」卡上展示。 */
  const localClaim = computed<ProgressClaim | null>(() => {
    const progress = game.save?.progress;
    if (!progress) return null;
    return deepestProgressClaim(progress.clearedStageIds, progress.stageFirstClearedAt);
  });

  const localStageLabel = computed(() =>
    localClaim.value ? progressStageLabel(localClaim.value.stageId) : null,
  );

  const localClearedCount = computed(() => game.save?.progress.clearedStageIds.length ?? 0);

  /** 本地有进度但榜上回执对不上（更深/更新）→ 提示有未同步的新进度。 */
  const hasUnsyncedProgress = computed(() => {
    const claim = localClaim.value;
    if (!claim) return false;
    const sync = lastSync.value;
    if (!sync) return true;
    return sync.deepestStageId !== claim.stageId;
  });

  const rows = computed<ProgressBoardRow[]>(() => boardCache.value?.rows ?? []);
  /** 超过多少百分比的同行旅人（弱名次口径：不给精确名次压力）。 */
  const myPercentile = computed<number | null>(() => {
    const sync = lastSync.value;
    if (!sync || !sync.verified || sync.rank <= 0 || sync.total <= 1) return null;
    return Math.max(0, Math.min(99, Math.round(((sync.total - sync.rank) / sync.total) * 100)));
  });

  // ─────────── 联机 ───────────

  async function connect(): Promise<boolean> {
    if (!isSupabaseConfigured) {
      status.value = 'unconfigured';
      return false;
    }
    if (status.value === 'ready' && userId.value) return true;
    status.value = 'connecting';
    try {
      const session = await ensureAnonymousSession();
      if (!session) {
        status.value = 'unconfigured';
        return false;
      }
      userId.value = session.userId;
      status.value = 'ready';
      lastError.value = null;
      return true;
    } catch (error) {
      status.value = 'offline';
      lastError.value = error instanceof Error ? error.message : '连接失败';
      return false;
    }
  }

  function cacheFresh(): boolean {
    return (
      boardCache.value !== null && Date.now() - boardCache.value.at < PROGRESS_BOARD_CACHE_TTL_MS
    );
  }

  /** 只拉榜（打开页签时）；带 5 分钟缓存。 */
  async function refreshBoard(force = false): Promise<void> {
    if (!(await connect())) return;
    if (!force && cacheFresh()) return;
    const session = await ensureAnonymousSession();
    if (!session || !userId.value) return;
    boardLoading.value = true;
    try {
      const fetched = await fetchProgressBoard(session.client, userId.value);
      boardCache.value = { at: Date.now(), rows: fetched };
      lastError.value = null;
    } catch (error) {
      lastError.value = error instanceof Error ? error.message : '进度榜读取失败';
    } finally {
      boardLoading.value = false;
    }
  }

  /**
   * 同步进度：上报当前最深首通 → 立即重拉榜单。
   *
   * 服务端 updated=false（另一设备已报更深）不是失败：本地快照本来就是
   * 「这台设备知道的」，静默收进 lastSync，不弹错误去惊吓正常玩家。
   */
  async function syncProgress(): Promise<ProgressSubmitResult | null> {
    const claim = localClaim.value;
    if (syncing.value || !game.save || !claim) return null;
    if (!(await connect())) return null;
    const session = await ensureAnonymousSession();
    if (!session || !userId.value) return null;
    syncing.value = true;
    try {
      const result = await submitProgressReport(session.client, claim);
      lastSync.value = result;
      boardCache.value = null;
      await refreshBoard(true);
      lastError.value = null;
      return result;
    } catch (error) {
      lastError.value = error instanceof Error ? error.message : '进度上传失败，请稍后重试';
      return null;
    } finally {
      syncing.value = false;
    }
  }

  /** 打开页签：连上 → 同步 → 拉榜（竞速榜的「开榜即最新」）。 */
  async function openBoard(): Promise<void> {
    if (!(await connect())) return;
    if (localClaim.value && hasUnsyncedProgress.value) {
      await syncProgress();
      return;
    }
    await refreshBoard();
  }

  /**
   * 首通捕获处的火忘上报（game.ts 写入点调用）。
   *
   * 只在已连过榜的玩家身上自动联网（status==='ready'）；其余玩家
   * 不偷偷建立连接 —— 他们的进度在本地安然无恙，开榜时同步。
   * 静默 fire-and-forget：任何失败都进 lastError，绝不阻塞战斗结算。
   */
  function notifyFirstClear(): void {
    if (status.value !== 'ready' || syncing.value) return;
    void syncProgress();
  }

  return {
    status,
    userId,
    lastError,
    syncing,
    boardLoading,
    boardCache,
    rows,
    lastSync,
    localClaim,
    localStageLabel,
    localClearedCount,
    hasUnsyncedProgress,
    myPercentile,
    connect,
    refreshBoard,
    syncProgress,
    openBoard,
    notifyFirstClear,
  };
});
