/**
 * 羁绊榜领域 store（docs/63 §三 · P2）。
 *
 * 职责：从存档收集四角色心意快照 → 上报（服务端过下界）→ 拉榜缓存。
 * 与 leaderboard store 同三条边界：
 *   1. 所有网络失败静默降级，**绝不能阻塞游戏主流程**
 *   2. 榜单缓存 5 分钟，避免每次切页签都打请求
 *   3. 上报只能由玩家主动触发（点「同步心意」），不做自动上传
 *
 * 红线：这里只聚合四角色之和用于本地展示；发往服务端的单角色快照
 * 不落库，拉回来的榜上也只有总数（docs/63 §三）。
 */

import { computed, ref } from 'vue';
import { defineStore } from 'pinia';
import { useGameStore } from './game';
import { affectionTotalPoints } from '@/core/affectionBoard';
import { CLASS_IDS } from '@/core/types';
import {
  fetchAffectionBoard,
  submitAffectionReport,
  type AffectionBoardRow,
  type AffectionSubmission,
  type AffectionSubmitResult,
} from '@/net/affectionBoard';
import { ensureAnonymousSession, isSupabaseConfigured } from '@/net/supabase';

export type AffectionBoardStatus = 'unconfigured' | 'connecting' | 'ready' | 'offline';

/** 榜单缓存有效期（与试炼榜一致：5 分钟） */
export const AFFECTION_BOARD_CACHE_TTL_MS = 5 * 60 * 1000;

export const useAffectionBoardStore = defineStore('affectionBoard', () => {
  const game = useGameStore();

  const status = ref<AffectionBoardStatus>(isSupabaseConfigured ? 'offline' : 'unconfigured');
  const userId = ref<string | null>(null);
  const lastError = ref<string | null>(null);
  const syncing = ref(false);
  const boardLoading = ref(false);

  const boardCache = ref<{ at: number; rows: AffectionBoardRow[] } | null>(null);
  /** 最近一次同步的服务端回执（我的名次与榜上人数）。 */
  const lastSync = ref<AffectionSubmitResult | null>(null);

  // ─────────── 本地快照 ───────────

  /** 从存档收集四角色快照；单角色明细仅用于上报载荷，绝不展示。 */
  function collectClaims(): AffectionSubmission {
    const affection = game.save?.affection;
    if (!affection) return {};
    const claims: AffectionSubmission = {};
    for (const classId of CLASS_IDS) {
      const progress = affection.characters[classId];
      if (!progress) continue;
      claims[classId] = {
        points: progress.points,
        totalInteractions: progress.totalInteractions,
        // completedStoryIds 同时覆盖主剧情幕与约会幕（两者都走
        // completeAffectionStory 写入），幕数不会少报。
        storyCount: progress.completedStoryIds.length,
      };
    }
    return claims;
  }

  /** 本地心意总值 —— 不联网也能在「你的陪伴」卡上展示。 */
  const myAffectionTotal = computed(() => {
    const claims = collectClaims();
    return affectionTotalPoints(Object.values(claims));
  });

  /** 本地累计陪伴次数（四角色互动之和），陪伴卡强调「陪了多久」。 */
  const myTotalInteractions = computed(() => {
    const affection = game.save?.affection;
    if (!affection) return 0;
    return CLASS_IDS.reduce((sum, id) => sum + (affection.characters[id]?.totalInteractions ?? 0), 0);
  });

  const rows = computed<AffectionBoardRow[]>(() => boardCache.value?.rows ?? []);
  /** 超过多少百分比的同行旅人（弱名次口径：不给精确名次压力）。 */
  const myPercentile = computed<number | null>(() => {
    const sync = lastSync.value;
    if (!sync || sync.rank <= 0 || sync.total <= 1) return null;
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
    return boardCache.value !== null && Date.now() - boardCache.value.at < AFFECTION_BOARD_CACHE_TTL_MS;
  }

  /** 只拉榜（打开页签时）；带 5 分钟缓存。 */
  async function refreshBoard(force = false): Promise<void> {
    if (!(await connect())) return;
    if (!force && cacheFresh()) return;
    const session = await ensureAnonymousSession();
    if (!session || !userId.value) return;
    boardLoading.value = true;
    try {
      const fetched = await fetchAffectionBoard(session.client, userId.value);
      boardCache.value = { at: Date.now(), rows: fetched };
      lastError.value = null;
    } catch (error) {
      lastError.value = error instanceof Error ? error.message : '羁绊榜读取失败';
    } finally {
      boardLoading.value = false;
    }
  }

  /**
   * 同步心意（**玩家主动触发**）：上报当前快照 → 立即重拉榜单。
   *
   * 服务端 updated=false（触下界）不是失败：真实玩家数学上不可能走到，
   * 静默收进 lastSync，不弹错误去惊吓正常玩家。
   */
  async function syncAffection(): Promise<AffectionSubmitResult | null> {
    if (syncing.value || !game.save) return null;
    if (!(await connect())) return null;
    const session = await ensureAnonymousSession();
    if (!session || !userId.value) return null;
    syncing.value = true;
    try {
      const result = await submitAffectionReport(session.client, collectClaims());
      lastSync.value = result;
      boardCache.value = null;
      await refreshBoard(true);
      lastError.value = null;
      return result;
    } catch (error) {
      lastError.value = error instanceof Error ? error.message : '心意上传失败，请稍后重试';
      return null;
    } finally {
      syncing.value = false;
    }
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
    myAffectionTotal,
    myTotalInteractions,
    myPercentile,
    connect,
    refreshBoard,
    syncAffection,
  };
});
