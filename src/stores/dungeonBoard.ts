/**
 * 秘境榜领域 store（docs/51 §4 榜 5 · 网络层契约 docs/64）。
 *
 * 职责：从存档 records 推导本地阶梯 → 按档升序上报 → 按层拉榜缓存。
 * 边界（与 leaderboard / progressBoard / affectionBoard 同三条）：
 *   1. 所有网络失败静默降级，**绝不能阻塞游戏主流程**
 *   2. 榜单缓存 5 分钟，且**按层各缓存各的**（一层一张榜）
 *   3. 没开过榜的玩家不偷偷联网，开榜时才同步
 *
 * ── 与另外三个榜不同的那一条：上报是「一条阶梯」而不是「一条成绩」 ──
 * 服务端的深度链要求提交第 d 层前必须已有第 d−1 层的可信记录
 * （core/dungeonBoard.ts `meetsDungeonDepthChain`），所以这里**必须按
 * 深度升序逐层提交**，不能只交玩家正在看的那一层。
 *
 * 链是**按档独立**的（服务端取链时只按 tier_id 过滤），所以只补当前档
 * 就够了 —— 这不只是省请求，它本身就是正确的：别的档没交不会给
 * 当前档留下断链。
 *
 * **★ 链按档而不按部位，这一条容易看错。** 一个档位下有 8 个部位门户
 * （武器/头冠/…），但玩法上的深度进度是**按档**存的
 * （`equipmentDungeon.depth` 是 Record<档位, 深度>），所以服务端只按
 * tier_id 取链是对的、与玩法模型一致。**推论是：一档的阶梯要跨 8 个
 * 部位一起按深度升序交**，只交当前部位会漏 —— 玩家完全可能用武器门户
 * 打通了 d1~d2、却只在头冠门户留下 d3 的记录。
 *
 * **不要改成并发提交。** 第 d 层能不能收下，取决于第 d−1 层是否已经
 * 落库，并发会让深层随机撞上「还没有上一层的记录」而被拒 —— 且因为
 * 依赖时序，它只在网络慢的时候偶发，极难复现。
 */

import { computed, ref } from 'vue';
import { defineStore } from 'pinia';
import { useGameStore } from './game';
import { DUNGEON_BOARD_ENTRIES, type DungeonBoardEntry } from '@/core/dungeonBoard';
import {
  EQUIPMENT_DUNGEON_TIERS,
  type EquipmentDungeonTierId,
} from '@/data/equipmentDungeonGear';
import { EQUIPMENT_DUNGEON_STAGES } from '@/data/equipmentDungeons';
import { SLOT_LABELS } from '@/data/constants';
import {
  fetchDungeonBoard,
  submitDungeonRecord,
  type DungeonBoardRow,
  type DungeonSubmitResult,
} from '@/net/dungeonBoard';
import { ensureAnonymousSession, isSupabaseConfigured } from '@/net/supabase';

export type DungeonBoardStatus = 'unconfigured' | 'connecting' | 'ready' | 'offline';

/** 榜单缓存有效期（与试炼榜/进度榜/羁绊榜一致：5 分钟） */
export const DUNGEON_BOARD_CACHE_TTL_MS = 5 * 60 * 1000;

/** 当前真的能打、也真的能上榜的层（封着的档位一律不进 UI）。 */
export const OPEN_BOARD_ENTRIES: readonly DungeonBoardEntry[] = DUNGEON_BOARD_ENTRIES.filter(
  (entry) => !entry.sealed,
);

/** 一次要交上去的成绩（形状与 net 层载荷一致）。 */
interface LadderClaim {
  dungeonId: string;
  bestDurationMs: number;
  firstClearedAt: number;
}

export const useDungeonBoardStore = defineStore('dungeonBoard', () => {
  const game = useGameStore();

  const status = ref<DungeonBoardStatus>(isSupabaseConfigured ? 'offline' : 'unconfigured');
  const userId = ref<string | null>(null);
  const lastError = ref<string | null>(null);
  const syncing = ref(false);
  const boardLoading = ref(false);

  /** 按层各缓存各的：一层一张榜，切层不该把别层的缓存冲掉。 */
  const boardCache = ref<Record<string, { at: number; rows: DungeonBoardRow[] }>>({});
  const selectedDungeonId = ref<string | null>(null);
  const lastSubmit = ref<DungeonSubmitResult | null>(null);

  /**
   * 每档最近一次成功交上去的阶梯指纹。
   *
   * 没变就不重交 —— 契约说「每次开榜重报」是常态，但那指的是**一条**
   * 成绩；这里一档最多五层，每次切页签都全交一遍等于五倍请求，
   * 而绝大多数时候本地一个字都没变。
   */
  const submittedLadder = ref<Record<string, string>>({});

  // ─────────── 本地快照 ───────────

  const records = computed(() => game.save?.equipmentDungeon.records ?? {});

  /**
   * 某一档：玩家本地真有记录的层，**按深度升序**（提交顺序就是它）。
   *
   * 跨该档全部 8 个部位门户，理由见文件头 —— 链按档取，不按部位。
   * 上限是 8 部位 × 5 层 = 40 条，但那是「八个部位全刷满五层」的完成度
   * 玩家才会到的数，且只在指纹变化时交一次；普通玩家通常只有个位数。
   */
  function localLadder(tierId: EquipmentDungeonTierId): LadderClaim[] {
    const owned = records.value;
    return OPEN_BOARD_ENTRIES.filter((entry) => entry.tierId === tierId)
      .filter((entry) => owned[entry.id] !== undefined)
      .sort((a, b) => a.depth - b.depth)
      .map((entry) => {
        const record = owned[entry.id]!;
        return {
          dungeonId: entry.id,
          bestDurationMs: record.bestDurationMs,
          firstClearedAt: record.firstClearedAt,
        };
      });
  }

  /** 玩家打过的档（有任意一层记录）。 */
  const playedTierIds = computed<EquipmentDungeonTierId[]>(() => {
    const owned = records.value;
    const played = new Set<EquipmentDungeonTierId>();
    for (const entry of OPEN_BOARD_ENTRIES) {
      if (owned[entry.id] !== undefined) played.add(entry.tierId);
    }
    return EQUIPMENT_DUNGEON_TIERS.filter((tier) => played.has(tier.id)).map((tier) => tier.id);
  });

  /**
   * 默认展示玩家打过的**最高**档（docs/64 §3.1），不是晴蓝。
   *
   * 低档的用时会成批撞在 200ms 下界上（满级玩家人人秒杀），
   * 点开就是一屏 0.2 秒，玩家的第一反应是「这榜坏了」。
   */
  const defaultTierId = computed<EquipmentDungeonTierId | null>(() => {
    const played = playedTierIds.value;
    if (played.length > 0) return played[played.length - 1]!;
    return OPEN_BOARD_ENTRIES[0]?.tierId ?? null;
  });

  /** 当前开放的档位（UI 第二排胶囊）。 */
  const openTierIds = computed<EquipmentDungeonTierId[]>(() => {
    const open = new Set(OPEN_BOARD_ENTRIES.map((entry) => entry.tierId));
    return EQUIPMENT_DUNGEON_TIERS.filter((tier) => open.has(tier.id)).map((tier) => tier.id);
  });

  /** 某档下的部位门户（UI 第一排胶囊），按 SLOT_ORDER 稳定排序。 */
  function stagesInTier(
    tierId: EquipmentDungeonTierId,
  ): { stageId: string; slotLabel: string }[] {
    const seen = new Map<string, string>();
    for (const entry of OPEN_BOARD_ENTRIES) {
      if (entry.tierId !== tierId || seen.has(entry.stageId)) continue;
      const stage = EQUIPMENT_DUNGEON_STAGES[entry.stageId];
      if (stage) seen.set(entry.stageId, SLOT_LABELS[stage.slot]);
    }
    return [...seen].map(([stageId, slotLabel]) => ({ stageId, slotLabel }));
  }

  /** 某个部位门户下可选的层（UI 第三排胶囊，升序）。 */
  function depthsInStage(stageId: string): DungeonBoardEntry[] {
    return OPEN_BOARD_ENTRIES.filter((entry) => entry.stageId === stageId).sort(
      (a, b) => a.depth - b.depth,
    );
  }

  const selectedStageId = computed<string | null>(() => selectedEntry.value?.stageId ?? null);

  const selectedEntry = computed<DungeonBoardEntry | null>(() => {
    const id = selectedDungeonId.value;
    if (!id) return null;
    return OPEN_BOARD_ENTRIES.find((entry) => entry.id === id) ?? null;
  });

  const selectedTierId = computed<EquipmentDungeonTierId | null>(
    () => selectedEntry.value?.tierId ?? defaultTierId.value,
  );

  const rows = computed<DungeonBoardRow[]>(() => {
    const id = selectedDungeonId.value;
    if (!id) return [];
    return boardCache.value[id]?.rows ?? [];
  });

  const myRow = computed<DungeonBoardRow | null>(
    () => rows.value.find((row) => row.isMe) ?? null,
  );

  /** 我在这一层的本地成绩（没上榜也能看见自己打了多快）。 */
  const myLocalRecord = computed(() => {
    const id = selectedDungeonId.value;
    if (!id) return null;
    return records.value[id] ?? null;
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

  function cacheFresh(dungeonId: string): boolean {
    const cached = boardCache.value[dungeonId];
    return cached !== undefined && Date.now() - cached.at < DUNGEON_BOARD_CACHE_TTL_MS;
  }

  /** 拉某一层的榜（带 5 分钟缓存）。 */
  async function refreshBoard(dungeonId: string, force = false): Promise<void> {
    if (!(await connect())) return;
    if (!force && cacheFresh(dungeonId)) return;
    const session = await ensureAnonymousSession();
    if (!session || !userId.value) return;
    boardLoading.value = true;
    try {
      const fetched = await fetchDungeonBoard(session.client, dungeonId, userId.value);
      boardCache.value = { ...boardCache.value, [dungeonId]: { at: Date.now(), rows: fetched } };
      lastError.value = null;
    } catch (error) {
      lastError.value = error instanceof Error ? error.message : '秘境榜读取失败';
    } finally {
      boardLoading.value = false;
    }
  }

  /**
   * 把某一档的本地阶梯**按深度升序逐层**交上去。
   *
   * 三条不要改的地方：
   *   1. **顺序串行**：深层依赖浅层已落库，见文件头
   *   2. **中途失败就停**：第 d 层没进去，第 d+1 层必然被链拒，
   *      继续交只是白打请求 + 多一条误导性错误
   *   3. `improved === false` **不是失败**：没打得更快时它就是常态，
   *      契约明写 UI 不许拿它当错误提示
   */
  async function submitTierLadder(
    tierId: EquipmentDungeonTierId,
    force = false,
  ): Promise<void> {
    const ladder = localLadder(tierId);
    if (ladder.length === 0 || syncing.value) return;

    const signature = JSON.stringify(ladder);
    if (!force && submittedLadder.value[tierId] === signature) return;

    if (!(await connect())) return;
    const session = await ensureAnonymousSession();
    if (!session || !userId.value) return;

    syncing.value = true;
    try {
      for (const claim of ladder) {
        const result = await submitDungeonRecord(session.client, claim);
        lastSubmit.value = result;
      }
      submittedLadder.value = { ...submittedLadder.value, [tierId]: signature };
      lastError.value = null;
    } catch (error) {
      // 交到一半失败：指纹不写，下次开榜会从头重来一遍（幂等，重复提交
      // 不会改写更好的记录，见 core 的 mergeDungeonRecord）。
      lastError.value = error instanceof Error ? error.message : '秘境成绩上报失败';
    } finally {
      syncing.value = false;
    }
  }

  /** 切层：先换选中项让 UI 立刻响应，再补数据。 */
  async function selectDungeon(dungeonId: string): Promise<void> {
    selectedDungeonId.value = dungeonId;
    await refreshBoard(dungeonId);
  }

  /**
   * 打开页签：选默认层 → **先拉榜显示** → 后台补交阶梯。
   *
   * **顺序是先拉后交，这一条别改回去。** 一档的阶梯最多 40 条
   * （8 部位 × 5 层），若先交后拉，玩家开榜要盯着转圈等几十个请求跑完
   * 才看得到榜。先拉能立刻出画面；补交在后台跑，跑完若真有改写
   * （improved）再静默刷新当前层。
   */
  async function openBoard(): Promise<void> {
    if (!(await connect())) return;

    if (!selectedDungeonId.value) {
      const tierId = defaultTierId.value;
      if (!tierId) return;
      const ladder = localLadder(tierId);
      // 打过的档：默认落在他打到的最深那层（docs/64 §3.1）；没打过：第 1 层
      const fallback = depthsInStage(stagesInTier(tierId)[0]?.stageId ?? '')[0]?.id ?? null;
      selectedDungeonId.value = ladder[ladder.length - 1]?.dungeonId ?? fallback;
    }

    const id = selectedDungeonId.value;
    if (id) await refreshBoard(id, true);

    const tierId = selectedTierId.value;
    if (!tierId) return;
    void submitTierLadder(tierId).then(() => {
      // 只有真的改写了记录才值得再打一次读请求
      if (lastSubmit.value?.improved && selectedDungeonId.value) {
        void refreshBoard(selectedDungeonId.value, true);
      }
    });
  }

  /**
   * 副本通关后的火忘上报（DungeonView 结算处调用）。
   *
   * 只在已连过榜的玩家身上自动联网；其余人的成绩在本地安然无恙，
   * 开榜时一次补齐。任何失败都只进 lastError，绝不阻塞结算。
   */
  function notifyDungeonCleared(tierId: EquipmentDungeonTierId): void {
    if (status.value !== 'ready' || syncing.value) return;
    void submitTierLadder(tierId);
  }

  return {
    status,
    userId,
    lastError,
    syncing,
    boardLoading,
    boardCache,
    selectedDungeonId,
    selectedEntry,
    selectedTierId,
    selectedStageId,
    lastSubmit,
    rows,
    myRow,
    myLocalRecord,
    playedTierIds,
    defaultTierId,
    openTierIds,
    localLadder,
    stagesInTier,
    depthsInStage,
    connect,
    refreshBoard,
    submitTierLadder,
    selectDungeon,
    openBoard,
    notifyDungeonCleared,
  };
});
