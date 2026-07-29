/**
 * 排行榜领域 store（docs/51 §7）。
 *
 * 职责：连接 core（试炼规则）与 net（Supabase IO），负责缓存与状态。
 * 三条不可违反的边界：
 *   1. 所有网络失败静默降级，**绝不能阻塞游戏主流程**（断网可玩）
 *   2. 榜单拉取结果缓存 5 分钟，避免每次切页签都打请求
 *   3. 成绩上传只能由玩家主动触发，不做自动上传（隐私 + 自主性）
 */

import { computed, ref } from 'vue';
import { defineStore } from 'pinia';
import { useGameStore } from './game';
import {
  ensureAnonymousSession,
  getSupabaseClient,
  isSupabaseConfigured,
} from '@/net/supabase';
import {
  fetchMyPowerRank,
  fetchPowerTop,
  fetchTrialNeighborhood,
  fetchTrialTop,
  submitTrialScore,
  upsertProfile,
  type PowerBoardRow,
  type TrialBoardRow,
  type TrialSubmitResult,
} from '@/net/leaderboard';
import {
  buildTrialCombatant,
  runTrial,
  trialBracketFor,
  trialScoreSeed,
  trialWeekIndex,
  weeklyTrialBoss,
  type TrialRunResult,
} from '@/core/trial';
import { TRIAL_SEASON_ID, type TrialBracket } from '@/data/trialRules';
import { SLOT_ORDER } from '@/data/constants';
import type { TrialBest } from '@/save/schema';
import type { ClassId, EquipmentInstance } from '@/core/types';

export type LeaderboardStatus = 'unconfigured' | 'connecting' | 'ready' | 'offline';

/** 榜单缓存有效期（docs/51 §7：5 分钟） */
export const LEADERBOARD_CACHE_TTL_MS = 5 * 60 * 1000;

interface CacheSlot<T> {
  at: number;
  key: string;
  value: T;
}

export interface TrialChallengeOutcome {
  result: TrialRunResult;
  /** 是否刷新了本周个人纪录 */
  improved: boolean;
  best: TrialBest;
}

export const useLeaderboardStore = defineStore('leaderboard', () => {
  const game = useGameStore();

  // ─────────── 联机状态 ───────────
  const status = ref<LeaderboardStatus>(isSupabaseConfigured ? 'offline' : 'unconfigured');
  const userId = ref<string | null>(null);
  const lastError = ref<string | null>(null);
  const submitting = ref(false);

  // ─────────── 榜单缓存 ───────────
  const neighborhoodCache = ref<CacheSlot<TrialBoardRow[]> | null>(null);
  const topCache = ref<CacheSlot<TrialBoardRow[]> | null>(null);
  const powerCache = ref<CacheSlot<{ rows: PowerBoardRow[]; myRank: number | null }> | null>(
    null,
  );
  const boardsLoading = ref(false);

  // ─────────── 本周上下文 ───────────
  const weekIndex = computed(() => trialWeekIndex(Date.now()));
  const bracket = computed<TrialBracket>(() => trialBracketFor(game.player?.level ?? 1));
  const classId = computed<ClassId>(() => game.player?.classId ?? 'swordsman');
  const boss = computed(() => weeklyTrialBoss(TRIAL_SEASON_ID, weekIndex.value, bracket.value.id));

  const myBestThisWeek = computed<TrialBest | null>(() => {
    const list = game.save?.trial.bests ?? [];
    return (
      list.find(
        (b) =>
          b.seasonId === TRIAL_SEASON_ID &&
          b.weekIndex === weekIndex.value &&
          b.bracketId === bracket.value.id,
      ) ?? null
    );
  });

  /** 上周任意分段的最好成绩，用于「比上周」对照。 */
  const lastWeekBest = computed<TrialBest | null>(() => {
    const list = game.save?.trial.bests ?? [];
    return (
      list.find(
        (b) => b.seasonId === TRIAL_SEASON_ID && b.weekIndex === weekIndex.value - 1,
      ) ?? null
    );
  });

  /**
   * 环比增幅；只在上升时给出（docs/51 §5.3 红线：
   * 箭头只在上升时出现，下降不显示箭头、不显示红色）。
   */
  const weekOverWeekGain = computed<number | null>(() => {
    const cur = myBestThisWeek.value;
    const prev = lastWeekBest.value;
    if (!cur || !prev || prev.damage <= 0 || cur.damage <= prev.damage) return null;
    return (cur.damage - prev.damage) / prev.damage;
  });

  // ─────────── 本地挑战 ───────────

  function currentEquipped(): (EquipmentInstance | null)[] {
    const save = game.save;
    if (!save) throw new Error('[排行榜] 没有存档');
    return SLOT_ORDER.map((s) => save.equipped[s]);
  }

  /**
   * 跑一次本周试炼。
   *
   * 确定性：成绩种子由「赛季+周次+分段+搭配哈希」决定，同一套搭配永远
   * 打出同一个数字；玩家上传后服务端用同一份 core 复算，结果逐点一致。
   */
  function challengeTrial(now = Date.now()): TrialChallengeOutcome {
    const save = game.save;
    if (!save) throw new Error('[排行榜] 没有存档');
    const build = buildTrialCombatant({
      name: save.player.name,
      classId: save.player.classId,
      level: save.player.level,
      equipped: currentEquipped(),
    });
    const week = trialWeekIndex(now);
    const currentBracket = trialBracketFor(save.player.level);
    const currentBoss = weeklyTrialBoss(TRIAL_SEASON_ID, week, currentBracket.id);
    const seed = trialScoreSeed(TRIAL_SEASON_ID, week, currentBracket.id, build.buildHash);
    const result = runTrial(build, currentBoss.combatant, seed);

    const prev = myBestThisWeek.value;
    const improved = !prev || result.damage > prev.damage;
    if (improved) {
      const record: TrialBest = {
        seasonId: TRIAL_SEASON_ID,
        weekIndex: week,
        bracketId: currentBracket.id,
        classId: save.player.classId,
        damage: result.damage,
        at: now,
        submitted: false,
      };
      game.recordTrialBest(record);
      return { result, improved: true, best: record };
    }
    return { result, improved: false, best: prev! };
  }

  // ─────────── 联机 ───────────

  /** 建立会话并同步公开档案；所有失败都收进 status/lastError，绝不抛出。 */
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
      const save = game.save;
      if (save) {
        // 档案同步是战力榜的数据源；失败只影响战力榜新鲜度，不影响试炼
        await upsertProfile(session.client, {
          id: session.userId,
          displayName: save.player.name,
          classId: save.player.classId,
          level: save.player.level,
          combatPower: game.cp,
        }).catch(() => undefined);
      }
      return true;
    } catch (error) {
      status.value = 'offline';
      lastError.value = error instanceof Error ? error.message : '连接失败';
      return false;
    }
  }

  function cacheFresh(slot: CacheSlot<unknown> | null, key: string): boolean {
    return slot !== null && slot.key === key && Date.now() - slot.at < LEADERBOARD_CACHE_TTL_MS;
  }

  /** 拉取三块榜单；带 5 分钟缓存，force 可绕过。 */
  async function refreshBoards(force = false): Promise<void> {
    if (!(await connect())) return;
    const client = await getSupabaseClient();
    if (!client || !userId.value) return;

    const filter = {
      seasonId: TRIAL_SEASON_ID,
      weekIndex: weekIndex.value,
      bracketId: bracket.value.id,
      classId: classId.value,
    };
    const key = `${filter.seasonId}:${filter.weekIndex}:${filter.bracketId}:${filter.classId}`;
    boardsLoading.value = true;
    try {
      await Promise.all([
        // 邻域榜：同职业子榜里「你 ±5 名」—— 你每天真正追赶的对象
        force || !cacheFresh(neighborhoodCache.value, key)
          ? fetchTrialNeighborhood(client, filter, userId.value)
              .then((rows) => (neighborhoodCache.value = { at: Date.now(), key, value: rows }))
              .catch((error) => (lastError.value = String((error as Error).message ?? error)))
          : Promise.resolve(),
        // 全服总榜：同分段全职业前 100 —— 远景，不是日常目标
        force || !cacheFresh(topCache.value, key)
          ? fetchTrialTop(client, { ...filter, classId: undefined }, userId.value)
              .then((rows) => (topCache.value = { at: Date.now(), key, value: rows }))
              .catch((error) => (lastError.value = String((error as Error).message ?? error)))
          : Promise.resolve(),
        force || !powerCache.value || Date.now() - powerCache.value.at > LEADERBOARD_CACHE_TTL_MS
          ? Promise.all([
              fetchPowerTop(client, userId.value),
              fetchMyPowerRank(client, game.cp).catch(() => null),
            ])
              .then(
                ([rows, myRank]) =>
                  (powerCache.value = { at: Date.now(), key: 'power', value: { rows, myRank } }),
              )
              .catch((error) => (lastError.value = String((error as Error).message ?? error)))
          : Promise.resolve(),
      ]);
    } finally {
      boardsLoading.value = false;
    }
  }

  /**
   * 上传本周最好成绩（玩家主动触发）。
   *
   * 载荷只有搭配快照，没有伤害数字 —— 伤害由服务端复算产生（docs/51 §6.3）。
   */
  async function submitBest(): Promise<TrialSubmitResult | null> {
    const best = myBestThisWeek.value;
    const save = game.save;
    if (!best || !save || submitting.value) return null;
    submitting.value = true;
    try {
      const session = await ensureAnonymousSession();
      if (!session) return null;
      userId.value = session.userId;
      status.value = 'ready';
      const result = await submitTrialScore(session.client, {
        seasonId: TRIAL_SEASON_ID,
        weekIndex: best.weekIndex,
        bracketId: best.bracketId,
        classId: save.player.classId,
        level: save.player.level,
        displayName: save.player.name,
        equipped: currentEquipped(),
      });
      if (result.verified) {
        game.markTrialBestSubmitted(best.seasonId, best.weekIndex, best.bracketId);
      }
      // 榜单缓存立即失效，下一拍重新拉取让玩家看到自己的名次
      neighborhoodCache.value = null;
      topCache.value = null;
      await refreshBoards();
      lastError.value = null;
      return result;
    } catch (error) {
      lastError.value = error instanceof Error ? error.message : '上传失败，请稍后重试';
      return null;
    } finally {
      submitting.value = false;
    }
  }

  return {
    // 状态
    status,
    userId,
    lastError,
    submitting,
    boardsLoading,
    // 本周上下文
    weekIndex,
    bracket,
    classId,
    boss,
    myBestThisWeek,
    lastWeekBest,
    weekOverWeekGain,
    // 榜单数据
    neighborhoodCache,
    topCache,
    powerCache,
    // 动作
    challengeTrial,
    connect,
    refreshBoards,
    submitBest,
  };
});
