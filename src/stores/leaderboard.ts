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
import { ensureAnonymousSession, getSupabaseClient, isSupabaseConfigured } from '@/net/supabase';
import {
  countStaleFormulaProfiles,
  fetchMyPowerRank,
  fetchPowerTop,
  fetchTrialNeighborhood,
  fetchTrialTop,
  submitTrialScore,
  trialEntryThreshold,
  trialNeighborhoodIsPreview,
  upsertProfile,
  type MyPowerRank,
  type PowerBoardRow,
  type TrialBoardFilter,
  type TrialBoardRow,
  type TrialSubmitResult,
} from '@/net/leaderboard';
import {
  fetchMilestoneBoard,
  submitMilestone,
  type MilestoneBoardRow,
  type MilestoneSubmitResult,
} from '@/net/milestones';
import { MILESTONE_LEVELS, isMilestoneLevel } from '@/data/milestoneRules';
import type { SupabaseClient } from '@supabase/supabase-js';
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

/**
 * 同职业邻域少于这个行数时，放宽到该分段的全职业榜（docs/51 §3.4 的缺省口径）。
 *
 * 开服初期人少：实测 8 条成绩被 3 个分段 × 4 个职业切成 12 个桶，
 * 同职业桶里往往只剩自己一个人 —— 「你 ±5 名」名义上是默认视图，
 * 实际看到的是一张空榜或一面镜子，追赶对象根本不存在。
 * 人多起来后同职业桶自然超过这个阈值，放宽会自动停止生效。
 */
export const TRIAL_NEIGHBORHOOD_MIN_ROWS = 3;

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

  /**
   * 上一次成功同步到服务端的等级（null = 本会话还没同步过）。
   *
   * 存在的理由：connect() 在 status 已经 ready 时提前返回，所以档案同步
   * **每个会话只跑一次**。玩家在这个会话里升多少级，服务端都不知道 ——
   * 而 submit-trial 是拿服务端那份 profiles.level 当判据标尺的。
   * 2026-08-01 的线上事故就是这么来的：新手一个会话从 Lv1 打到 Lv10，
   * 标尺还停在 Lv1，成绩被判成物理不可能。
   */
  const lastSyncedLevel = ref<number | null>(null);
  const lastError = ref<string | null>(null);
  const submitting = ref(false);

  // ─────────── 榜单缓存 ───────────
  const neighborhoodCache = ref<CacheSlot<TrialBoardRow[]> | null>(null);
  const topCache = ref<CacheSlot<TrialBoardRow[]> | null>(null);
  // myRank 不是裸数字：过渡期存在「战力是旧公式量的、与榜上的值不可比」这个
  // 真实状态，裸数字只能表达成一个编出来的名次（批3-3，见 net/leaderboard.ts）。
  const powerCache = ref<CacheSlot<{
    rows: PowerBoardRow[];
    myRank: MyPowerRank | null;
    /** 还有多少人的战力等着按新公式重算 —— 过渡期榜变短时给玩家一个解释。 */
    pendingRecalc: number;
  }> | null>(
    null,
  );
  const boardsLoading = ref(false);
  /** 当前邻域是否已放宽到全职业（UI 要如实说明，不能假装是同职业榜）。 */
  const neighborhoodWidened = ref(false);
  const milestoneCache = ref<CacheSlot<MilestoneBoardRow[]> | null>(null);
  const submittingMilestones = ref(false);

  // ─────────── 登顶速度榜（docs/51 §4 榜 4） ───────────

  /** 本地已记录的达成，按档位升序。 */
  const myMilestones = computed(() => game.save?.milestones ?? []);

  /** 还没上报服务端的达成。 */
  const pendingMilestones = computed(() => myMilestones.value.filter((m) => !m.submitted));

  /**
   * 默认展示哪一档：玩家**已达成的最高档**。
   *
   * 不默认展示「下一个要冲的档位」—— 那张榜上没有他，看不到自己的名次，
   * 也就拿不到胜任感反馈（docs/51 §5.1 同一个道理）。
   * 一档都没达成时退到最低档，让他先看见要追的那个数字。
   */
  const highestReachedMilestone = computed<number | null>(() =>
    myMilestones.value.length === 0
      ? null
      : myMilestones.value.reduce((best, m) => Math.max(best, m.level), 0),
  );
  /** 玩家手动切过档位后就固定住，不再被「已达成最高档」覆盖。 */
  const milestoneLevelOverride = ref<number | null>(null);
  const milestoneBoardLevel = computed<number>(
    () => milestoneLevelOverride.value ?? highestReachedMilestone.value ?? MILESTONE_LEVELS[0],
  );
  const milestoneRows = computed<MilestoneBoardRow[]>(() => milestoneCache.value?.value ?? []);

  /** 切换查看的档位；UI 分页签用。 */
  function selectMilestoneLevel(level: number): void {
    if (!isMilestoneLevel(level) || level === milestoneBoardLevel.value) return;
    milestoneLevelOverride.value = level;
    void refreshBoards();
  }

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
      list.find((b) => b.seasonId === TRIAL_SEASON_ID && b.weekIndex === weekIndex.value - 1) ??
      null
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

  /**
   * 同步一次公开档案，并记下同步时的等级。
   *
   * 失败**只吞不抛**：档案同步失败最多让战力榜数据旧一点，
   * 绝不能因此把玩家的成绩上传给挡掉。失败时不更新 lastSyncedLevel，
   * 所以下一次提交会自然重试。
   */
  async function syncProfileNow(
    client: Parameters<typeof upsertProfile>[0],
    level: number,
  ): Promise<void> {
    const save = game.save;
    if (!save) return;
    // 战力由服务端从这份搭配快照现算，客户端不再上报 game.cp
    // （docs/65 §六之二 方向 A）。
    const ok = await upsertProfile(client, {
      displayName: save.player.name,
      classId: save.player.classId,
      level,
      equipped: currentEquipped(),
    }).then(
      () => true,
      () => false,
    );
    if (ok) lastSyncedLevel.value = level;
  }

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
        // 档案同步是战力榜的数据源；失败只影响战力榜新鲜度，不影响试炼。
        // 战力由服务端从这份搭配快照现算，客户端不再上报 game.cp
        // （docs/65 §六之二 方向 A）。
        await syncProfileNow(session.client, save.player.level);
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

  /**
   * 拉同职业邻域；行数不足就退回该分段全职业榜。
   *
   * 只在薄桶时多打一次请求，人多之后第一次就够，不会常态双请求。
   */
  async function loadNeighborhood(
    client: SupabaseClient,
    filter: TrialBoardFilter & { classId: ClassId },
    myUserId: string,
  ): Promise<TrialBoardRow[]> {
    const sameClass = await fetchTrialNeighborhood(client, filter, myUserId);
    if (sameClass.length >= TRIAL_NEIGHBORHOOD_MIN_ROWS) {
      neighborhoodWidened.value = false;
      return sameClass;
    }
    const allClasses = await fetchTrialNeighborhood(
      client,
      { ...filter, classId: undefined },
      myUserId,
    );
    // 放宽只有在真的更满时才采纳，否则保持同职业口径（宁可薄也别换错口径）。
    if (allClasses.length > sameClass.length) {
      neighborhoodWidened.value = true;
      return allClasses;
    }
    neighborhoodWidened.value = false;
    return sameClass;
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
        // 邻域榜：同职业子榜里「你 ±5 名」—— 你每天真正追赶的对象。
        // 桶太薄时放宽到全职业（见 TRIAL_NEIGHBORHOOD_MIN_ROWS）。
        force || !cacheFresh(neighborhoodCache.value, key)
          ? loadNeighborhood(client, filter, userId.value)
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
              fetchMyPowerRank(client, userId.value, game.cp).catch(() => null),
              // 取不到就当 0：这个数只用于解释「榜为什么短」，失败不该让整块榜挂掉
              countStaleFormulaProfiles(client).catch(() => 0),
            ])
              .then(
                ([rows, myRank, pendingRecalc]) =>
                  (powerCache.value = {
                    at: Date.now(),
                    key: 'power',
                    value: { rows, myRank, pendingRecalc },
                  }),
              )
              .catch((error) => (lastError.value = String((error as Error).message ?? error)))
          : Promise.resolve(),
        // 速度榜：默认看玩家最近达成的那一档（见 milestoneBoardLevel）
        force || !cacheFresh(milestoneCache.value, `ms:${milestoneBoardLevel.value}`)
          ? fetchMilestoneBoard(client, milestoneBoardLevel.value, userId.value)
              .then(
                (rows) =>
                  (milestoneCache.value = {
                    at: Date.now(),
                    key: `ms:${milestoneBoardLevel.value}`,
                    value: rows,
                  }),
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

      // ★ 提交前先把等级同步上去（2026-08-01 线上事故的根治）。
      // submit-trial 拿服务端那份 profiles.level 当判据标尺，而 connect()
      // 在 status 已 ready 时提前返回 —— 整个会话只同步一次档案。
      // 于是玩家在会话内升的级服务端一无所知，标尺停在旧等级上：
      // 新手一个会话 Lv1→Lv10，成绩就会被判成物理不可能（实测缺口 1075 倍）。
      //
      // 只在等级真的变了时才补这一次请求，不是每次提交都发。
      //
      // ⚠ 说清楚它**不是**什么：profiles.level 由客户端上报、sync-profile
      // 只做 1~120 的范围校验，**它从来就不是「服务端验证过的等级」**。
      // 所以这里补同步既没有削弱防伪造（本来就没有），也别把它当防线看 ——
      // 它解决的是「老实玩家被旧标尺误判」，纯收益。
      if (lastSyncedLevel.value !== save.player.level) {
        await syncProfileNow(session.client, save.player.level);
      }

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

  /**
   * 上报所有未上报的里程碑（**玩家主动触发**）。
   *
   * 本文件顶部第 3 条边界：成绩上传不做自动上传（隐私 + 自主性）。
   * 里程碑同样是往公开榜发自己的数据，所以也必须等玩家点 —— 哪怕这意味着
   * 有人会忘记点。替他决定「把你的数据发出去」不是省事，是越界。
   *
   * 逐条提交而不是批量：某一档被服务端拒（等级交叉验证不过）不该拖累其他档。
   * 服务端返回 alreadyRecorded 也算成功 —— 多设备/断网重试下重复提交是正常路径。
   */
  async function submitPendingMilestones(): Promise<MilestoneSubmitResult[]> {
    const pending = pendingMilestones.value;
    if (pending.length === 0 || submittingMilestones.value) return [];
    if (!(await connect())) return [];
    const client = await getSupabaseClient();
    if (!client || !userId.value || !game.save) return [];

    submittingMilestones.value = true;
    const done: MilestoneSubmitResult[] = [];
    try {
      for (const record of [...pending]) {
        try {
          const result = await submitMilestone(client, {
            level: record.level,
            elapsedMs: record.elapsedMs,
          });
          game.markMilestoneSubmitted(record.level);
          done.push(result);
        } catch (error) {
          lastError.value = error instanceof Error ? error.message : '里程碑上报失败';
        }
      }
      if (done.length > 0) await refreshBoards(true);
      return done;
    } finally {
      submittingMilestones.value = false;
    }
  }

  const neighborhoodRows = computed<TrialBoardRow[]>(() => neighborhoodCache.value?.value ?? []);
  /** 我本周还没上榜，看到的是入榜门槛附近（docs/51 §5.1 的锚点回退）。 */
  const neighborhoodIsPreview = computed(() => trialNeighborhoodIsPreview(neighborhoodRows.value));
  /** 预览态下要超过的伤害数字；已上榜或空榜时为 null。 */
  const neighborhoodEntryThreshold = computed(() =>
    neighborhoodIsPreview.value ? trialEntryThreshold(neighborhoodRows.value) : null,
  );

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
    // 登顶速度榜
    myMilestones,
    pendingMilestones,
    highestReachedMilestone,
    milestoneBoardLevel,
    milestoneRows,
    submittingMilestones,
    selectMilestoneLevel,
    submitPendingMilestones,
    neighborhoodRows,
    neighborhoodIsPreview,
    neighborhoodEntryThreshold,
    neighborhoodWidened,
    topCache,
    powerCache,
    // 动作
    challengeTrial,
    connect,
    refreshBoards,
    submitBest,
  };
});
