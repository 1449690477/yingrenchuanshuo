/**
 * 竞技场领域 store（docs/52 §三 核心循环、§十 UI 要点）。
 *
 * 职责：连接 core（对决规则）与 net（Edge Function IO），负责状态与缓存。
 * 三条不可违反的边界（与排行榜 store 相同）：
 *   1. 所有网络失败静默降级，**绝不能阻塞游戏主流程**（断网可玩单机）
 *   2. 挑战只能由玩家主动触发；次数用完就是今天玩完了，不提示、不催促、
 *      不卖次数（docs/52 §3.1）
 *   3. 客户端不提交胜负 —— 只提交「挑战谁、押多少、当前搭配」
 */

import { computed, ref } from 'vue';
import { defineStore } from 'pinia';
import { grantEquipment } from '@/save/grantEquipment';
import { useGameStore } from './game';
import {
  ensureAnonymousSession,
  getSupabaseClient,
  isSupabaseConfigured,
} from '@/net/supabase';
import {
  buyArenaShopEntry,
  fetchArenaCandidates,
  fetchPendingArenaGrants,
  markArenaGrantClaimed,
  submitArenaChallenge,
  uploadArenaSnapshot,
  type ArenaBoardState,
  type ArenaCandidate,
  type ArenaChallengeResult,
  type ArenaRevengeEntry,
  type ArenaSettlePayload,
  type ArenaShopGrantPayload,
  type ArenaSnapshotPayload,
} from '@/net/arena';
import { createInstance } from '@/core/equipment';
import { Rng } from '@/core/rng';
import { fnv1a32 } from '@/core/trial';
import { ARENA_EQUIPMENT, arenaEquipmentForClass } from '@/data/arenaEquipment';
import { ARENA_FRAGMENT_EXCHANGE_COST, ARENA_SHOP_ENTRIES } from '@/data/arenaShop';
import { ARENA_STAKES } from '@/data/arenaRules';
import { TRIAL_SEASON_ID } from '@/data/trialRules';
import { SLOT_ORDER } from '@/data/constants';
import type { EquipmentInstance } from '@/core/types';

export type ArenaStatus = 'unconfigured' | 'connecting' | 'ready' | 'offline';

/** 赛季与试炼共用 seasons 表的同一行（新赛季开启时与试炼一起递增）。 */
export const ARENA_SEASON_ID = TRIAL_SEASON_ID;

export const useArenaStore = defineStore('arena', () => {
  const game = useGameStore();

  // ─────────── 联机状态 ───────────
  const status = ref<ArenaStatus>(isSupabaseConfigured ? 'offline' : 'unconfigured');
  const userId = ref<string | null>(null);
  const lastError = ref<string | null>(null);

  // ─────────── 竞技场状态 ───────────
  const me = ref<ArenaBoardState | null>(null);
  const candidates = ref<ArenaCandidate[]>([]);
  /** 反击机会（§六）：24h 内攻破过我防线、可零成本反击一次的对手 */
  const revenge = ref<ArenaRevengeEntry[]>([]);
  const loading = ref(false);
  const challenging = ref(false);
  /** 当前选中的押注档位，默认标准档 */
  const stake = ref<number>(ARENA_STAKES[1]);
  /** 最近一场战果（战报回放与结算弹层的数据源） */
  const lastBattle = ref<ArenaChallengeResult | null>(null);
  /** 首次进入竞技场的入场提示（只出现一次） */
  const joined = ref(false);
  const joinHonor = ref(0);

  // ─────────── 奖励与商店 ───────────
  /** 刚同步进背包的每日结算战报（防线战报条的数据源，最新在前） */
  const settleReports = ref<(ArenaSettlePayload & { dayKey: string })[]>([]);
  const buying = ref(false);

  /** 当前职业的荣誉商店货架（附带装备定义供 UI 取图标/名称）。 */
  const shopEntries = computed(() => {
    const classId = game.save?.player.classId;
    if (!classId) return [];
    return ARENA_SHOP_ENTRIES.filter((entry) => entry.classId === classId).map((entry) => ({
      ...entry,
      definition: arenaEquipmentForClass(classId).find((def) => def.slot === entry.slot)!,
    }));
  });

  /** 圣痕碎片数量（客户端背包材料，40 换 1 在本地完成）。 */
  const stigmaFragments = computed(() => game.save?.bag.items.frag_stigma ?? 0);

  const attemptsLeft = computed(() => me.value?.attemptsLeft ?? 0);
  const canChallenge = computed(
    () =>
      status.value === 'ready' &&
      !challenging.value &&
      attemptsLeft.value > 0 &&
      candidates.value.length > 0,
  );

  function currentEquipped(): (EquipmentInstance | null)[] {
    const save = game.save;
    if (!save) throw new Error('[竞技场] 没有存档');
    return SLOT_ORDER.map((s) => save.equipped[s]);
  }

  function snapshotPayload(): ArenaSnapshotPayload {
    const save = game.save;
    if (!save) throw new Error('[竞技场] 没有存档');
    return {
      seasonId: ARENA_SEASON_ID,
      classId: save.player.classId,
      level: save.player.level,
      displayName: save.player.name,
      equipped: currentEquipped(),
    };
  }

  /** 建立会话；所有失败都收进 status/lastError，绝不抛出。 */
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

  /**
   * 进入/刷新竞技场：上传当前搭配（防守快照随之保持最新），
   * 再拉今日候选与我的状态。
   */
  async function refresh(): Promise<void> {
    if (!(await connect())) return;
    const client = await getSupabaseClient();
    if (!client) return;
    loading.value = true;
    try {
      const snapshot = await uploadArenaSnapshot(client, snapshotPayload());
      joined.value = snapshot.joined;
      joinHonor.value = snapshot.joinHonor;
      // 先同步待领奖励（结算荣誉已在服务端入账），再拉候选 —— 显示的荣誉是加完的
      await syncGrants(client);
      const board = await fetchArenaCandidates(client, ARENA_SEASON_ID);
      me.value = board.me;
      candidates.value = board.candidates;
      revenge.value = board.revenge ?? [];
      lastError.value = null;
    } catch (error) {
      lastError.value = error instanceof Error ? error.message : '竞技场读取失败';
    } finally {
      loading.value = false;
    }
  }

  /**
   * 挑战一位候选对手。
   * 成功后立即用服务端结算更新本地状态，并刷新候选（排名已变）；
   * 所有失败静默收进 lastError，不抛出、不阻塞游戏。
   */
  async function challenge(candidate: ArenaCandidate): Promise<ArenaChallengeResult | null> {
    if (!(await connect())) return null;
    const client = await getSupabaseClient();
    if (!client) return null;
    if (challenging.value) return null;
    if (attemptsLeft.value <= 0) {
      lastError.value = '今日挑战次数已用完，明天见';
      return null;
    }
    if ((me.value?.honor ?? 0) < stake.value) {
      lastError.value = '荣誉印记不足，换个押注档位试试';
      return null;
    }

    challenging.value = true;
    try {
      const result = await submitArenaChallenge(client, {
        ...snapshotPayload(),
        defenderId: candidate.userId,
        stake: stake.value,
      });
      lastBattle.value = result;
      if (me.value) {
        me.value = {
          ...me.value,
          rank: result.rankAfter,
          tier: result.tier,
          honor: result.honor,
          winStreak: result.winStreak,
          attemptsLeft: result.attemptsLeft,
        };
      }
      lastError.value = null;
      // 排名已变，候选窗口跟着变；刷新失败不影响战果展示
      await refresh().catch(() => undefined);
      return result;
    } catch (error) {
      // 409 类状态漂移：先刷新让 UI 回到真实状态，再把挑战错误呈现给玩家
      // （refresh 成功会清掉 lastError，所以顺序不能反）
      await refresh().catch(() => undefined);
      lastError.value = error instanceof Error ? error.message : '挑战发起失败';
      return null;
    } finally {
      challenging.value = false;
    }
  }

  /** 消耗完次数或离开页面时清掉战果弹层。 */
  function clearLastBattle(): void {
    lastBattle.value = null;
  }

  /**
   * 把服务端待发的奖励同步进背包（docs/53 §4.3：直接进背包，不用点领取）。
   *
   * 每条奖励入库后立即标记 claimed；若在「入库 → 标记」之间崩溃，
   * 下次会重复发一次箱子物品（荣誉在服务端已入账，不受影响）——
   * 这个窗口只有几毫秒，换来的是存档 schema 零改动（docs/53 §六验收红线）。
   */
  async function syncGrants(client: import('@supabase/supabase-js').SupabaseClient): Promise<void> {
    const grants = await fetchPendingArenaGrants(client);
    if (grants.length === 0) return;
    const save = game.save;
    if (!save) return;

    const newReports: (ArenaSettlePayload & { dayKey: string })[] = [];
    for (const grant of grants) {
      if (grant.kind === 'settle') {
        const payload = grant.payload as ArenaSettlePayload;
        for (const box of payload.boxes) {
          for (const [itemId, count] of Object.entries(box.items)) {
            save.bag.items[itemId] = (save.bag.items[itemId] ?? 0) + count;
          }
        }
        newReports.push({ ...payload, dayKey: grant.dayKey });
      } else {
        const payload = grant.payload as ArenaShopGrantPayload;
        // 幂等：装备 uid 就是 grant id，已在背包则跳过生成直接确认
        const already = save.bag.equipment.some((equip) => equip.uid === grant.id);
        const definition = ARENA_EQUIPMENT[payload.defId];
        if (!already && definition) {
          grantEquipment(save, [
            createInstance(definition, new Rng(payload.seed >>> 0), grant.id, save.player.classId),
          ]);
        }
      }
      await markArenaGrantClaimed(client, grant.id);
    }
    if (newReports.length > 0) {
      settleReports.value = [...newReports.reverse(), ...settleReports.value].slice(0, 7);
    }
  }

  /** 荣誉商店兑换：服务端原子扣荣誉，奖励记录随下次同步进背包。 */
  async function buyShopEntry(entryId: string): Promise<boolean> {
    if (!(await connect())) return false;
    const client = await getSupabaseClient();
    if (!client) return false;
    if (buying.value) return false;
    const entry = ARENA_SHOP_ENTRIES.find((candidate) => candidate.id === entryId);
    if (!entry) {
      lastError.value = '货架不存在';
      return false;
    }
    if ((me.value?.honor ?? 0) < entry.price) {
      lastError.value = '荣誉印记不足';
      return false;
    }

    buying.value = true;
    try {
      const { honor } = await buyArenaShopEntry(client, {
        seasonId: ARENA_SEASON_ID,
        entryId,
        classId: game.save!.player.classId,
      });
      if (me.value) me.value = { ...me.value, honor };
      lastError.value = null;
      // 立刻同步：装备马上进背包，玩家不用等下一次刷新
      await syncGrants(client);
      return true;
    } catch (error) {
      lastError.value = error instanceof Error ? error.message : '兑换失败';
      return false;
    } finally {
      buying.value = false;
    }
  }

  /**
   * 圣痕碎片兑换（40 换 1，docs/53 §4.2）：碎片是客户端背包材料，
   * 与绯焰套碎片合成同一模式，纯本地完成，不经过服务端。
   */
  function exchangeStigmaFragments(defId: string): EquipmentInstance | null {
    const save = game.save;
    if (!save) return null;
    const definition = ARENA_EQUIPMENT[defId];
    if (!definition || definition.classId !== save.player.classId) {
      lastError.value = '这件圣痕装备不属于你的职业';
      return null;
    }
    if ((save.bag.items.frag_stigma ?? 0) < ARENA_FRAGMENT_EXCHANGE_COST) {
      lastError.value = '圣痕碎片不足';
      return null;
    }
    save.bag.items.frag_stigma -= ARENA_FRAGMENT_EXCHANGE_COST;
    if (save.bag.items.frag_stigma === 0) delete save.bag.items.frag_stigma;
    const uid = `e${save.nextUid}`;
    const instance = createInstance(
      definition,
      new Rng(fnv1a32(`frag|${save.player.name}|${save.nextUid}|${defId}`)),
      uid,
      save.player.classId,
    );
    save.nextUid++;
    grantEquipment(save, [instance]);
    lastError.value = null;
    return instance;
  }

  /** 看完结算战报后清掉（不影响已入库的奖励）。 */
  function dismissSettleReports(): void {
    settleReports.value = [];
  }

  /**
   * 复仇反击（§六）：对 24h 内攻破过我防线的对手零成本反击一次。
   * 不消耗每日挑战次数、不需要荣誉印记；胜负由服务端复算，
   * 荣誉不变，赢了只拿回排名（服务端会校验窗口与消耗状态）。
   */
  async function challengeRevenge(entry: ArenaRevengeEntry): Promise<ArenaChallengeResult | null> {
    if (!(await connect())) return null;
    const client = await getSupabaseClient();
    if (!client) return null;
    if (challenging.value) return null;

    challenging.value = true;
    try {
      const result = await submitArenaChallenge(client, {
        ...snapshotPayload(),
        defenderId: entry.userId,
        stake: 0,
        isRevenge: true,
      });
      lastBattle.value = result;
      if (me.value) {
        me.value = {
          ...me.value,
          rank: result.rankAfter,
          tier: result.tier,
          honor: result.honor,
          winStreak: result.winStreak,
          attemptsLeft: result.attemptsLeft,
        };
      }
      lastError.value = null;
      // 机会已消耗、排名已变；刷新失败不影响战果展示
      await refresh().catch(() => undefined);
      return result;
    } catch (error) {
      // 窗口过期/机会已消耗等状态漂移：先刷新回到真实状态，再呈现错误
      await refresh().catch(() => undefined);
      lastError.value = error instanceof Error ? error.message : '反击发起失败';
      return null;
    } finally {
      challenging.value = false;
    }
  }

  return {
    status,
    userId,
    lastError,
    me,
    candidates,
    revenge,
    loading,
    challenging,
    stake,
    lastBattle,
    joined,
    joinHonor,
    settleReports,
    buying,
    shopEntries,
    stigmaFragments,
    attemptsLeft,
    canChallenge,
    connect,
    refresh,
    challenge,
    challengeRevenge,
    buyShopEntry,
    exchangeStigmaFragments,
    dismissSettleReports,
    clearLastBattle,
  };
});
