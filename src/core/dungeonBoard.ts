/**
 * 秘境榜的纯逻辑（docs/51 §4 榜 5，网络层契约见 docs/64）。
 *
 * 与 core 其余模块同规：不碰 Vue / Pinia / storage / DOM ——
 * Edge Function 会通过 Deno 直接 import 本文件做服务端校验，
 * 客户端与服务端必须跑同一份判定（docs/61 §2.2 的教训）。
 *
 * ── 2026-07-31 · 随 docs/66 深度模型改造 ──
 * 旧版的 L3 是「玩家等级 ≥ 副本 unlockLevel」。深度模型删掉了等级门槛，
 * 那条判定会**退化成恒真** —— 一个失效了还不会变红的安全判定，
 * 比报错危险得多（这个风险是 claude-drops 在预警里点名的，谢）。
 * 现在换成**深度链**：要提交第 d 层，你必须已经有第 d−1 层的可信记录。
 * 关键在于这条链查的是**服务端自己的表**，不是客户端自称的存档 ——
 * 客户端报什么都不作数，证据得是它此前一层层交上来的成绩。
 */

import {
  DUNGEON_CLOCK_SKEW_TOLERANCE_MS,
  DUNGEON_FIRST_CLEAR_EPOCH_MS,
} from '../data/dungeonBoardRules';
import { EQUIPMENT_DUNGEON_STAGE_LIST } from '../data/equipmentDungeons';
import {
  EQUIPMENT_DUNGEON_TIERS,
  type EquipmentDungeonTierId,
} from '../data/equipmentDungeonGear';
import { EQUIPMENT_DUNGEON_DEPTH_ANCHORS } from '../data/equipmentDungeonDepthRules';
import { equipmentDungeonRecordKey } from './equipmentDungeon';

/** 一条秘境成绩的最小形状（存档、网络载荷、服务端校验共用这个口径）。 */
export interface DungeonClearClaim {
  /** 层 id，与存档 records 的键一致，如 equipment_weapon_auric_d3 */
  dungeonId: string;
  /** 该层的历史最快通关用时（毫秒） */
  bestDurationMs: number;
  /** 首通时刻（毫秒时间戳），并列时的排序依据 */
  firstClearedAt: number;
}

/** 一层可上榜秘境的榜单元信息（展示与校验共用这一份）。 */
export interface DungeonBoardEntry {
  /** 与存档 records 的键、与 dungeon_records.dungeon_id 完全一致 */
  id: string;
  /** 「武器炉·琥珀蔷薇匣 · 第 3 层」 */
  name: string;
  stageId: string;
  tierId: EquipmentDungeonTierId;
  /** 1 起算的层数 */
  depth: number;
  /**
   * 该档位是否尚未开放（EQUIPMENT_DUNGEON_TIERS 的 comingSoon）。
   *
   * 封着的档位任何人都打不到，此刻收到它的成绩必然是伪造 —— 直接拒收。
   * **这也是本榜不必等内容更新的原因**：解封只是把 comingSoon 去掉，
   * 白名单随数据自动放开，服务端一行都不用改。区域 7 上线当天实测过一次。
   */
  sealed: boolean;
}

/**
 * 全部可上榜的层：每个关卡 × 该档**实际开放**的层数。
 *
 * 榜单的「一座」是**关卡的某一层**而不是关卡：不同深度是难度完全不同的
 * 战斗，用时放在一起排没有意义。id 直接用存档记录键，由
 * equipmentDungeonRecordKey 生成而不是在这里拼字符串。
 *
 * 用 openDepths 而不是 DEPTH_PER_TIER：crimson 当前只开 1 层
 * （内容顶 Lv78 < 标称 81，三元 min 之后 d2~d5 与 d1 数值完全等价）。
 * 给数值上等价的层各开一张榜，等于把同一场战斗的成绩切成五份。
 * 内容顶抬上去、openDepths 放开时，这里自动跟随。
 */
export const DUNGEON_BOARD_ENTRIES: readonly DungeonBoardEntry[] =
  EQUIPMENT_DUNGEON_STAGE_LIST.flatMap((stage) => {
    const tier = EQUIPMENT_DUNGEON_TIERS.find((candidate) => candidate.id === stage.tierId);
    const anchor = EQUIPMENT_DUNGEON_DEPTH_ANCHORS[stage.tierId];
    return Array.from({ length: anchor.openDepths }, (_, index) => {
      const depth = index + 1;
      return {
        id: equipmentDungeonRecordKey(stage.id, depth),
        name: `${stage.name} · 第 ${depth} 层`,
        stageId: stage.id,
        tierId: stage.tierId,
        depth,
        sealed: tier?.comingSoon === true,
      };
    });
  });

const ENTRY_BY_ID: Readonly<Record<string, DungeonBoardEntry>> = Object.fromEntries(
  DUNGEON_BOARD_ENTRIES.map((entry) => [entry.id, entry]),
);

export function dungeonBoardEntry(dungeonId: string): DungeonBoardEntry | undefined {
  return ENTRY_BY_ID[dungeonId];
}

/** 该层此刻是否接受成绩：存在、且档位已解封。 */
export function isBoardableDungeon(dungeonId: string): boolean {
  const entry = ENTRY_BY_ID[dungeonId];
  return entry !== undefined && !entry.sealed;
}

/** 已解封（当前真的能打）的层 id，服务端白名单与测试都用它。 */
export const BOARDABLE_DUNGEON_IDS: readonly string[] = DUNGEON_BOARD_ENTRIES.filter(
  (entry) => !entry.sealed,
).map((entry) => entry.id);

/**
 * 用时的取值格律：战斗按 0.1 秒一帧推进，用时 = 帧数 × 100ms，
 * 所以任何真实成绩都是 100 的整数倍。
 *
 * 这是最便宜的一层防线 —— 手写的「1337ms」当场露馅，
 * 而它不需要知道玩家有多强。
 */
export const DUNGEON_DURATION_GRANULARITY_MS = 100;

/**
 * 用时下界：两波各至少一帧。
 *
 * **不是**「典型玩家用时 × 余量」。秘境没有等级上限，满级玩家去打低档低层
 * 一帧一波是合法玩法，统计型下界会把他们全误判。
 *
 * 有 dungeonFloorIsReachable 的测试守着这条：它真的跑一场碾压战斗，
 * 断言用时正好等于这个下界 —— 若将来改了帧长或波数，测试立刻红，
 * 而不是让服务端悄悄按错的格律判定。
 */
export const DUNGEON_MIN_DURATION_MS = DUNGEON_DURATION_GRANULARITY_MS * 2;

/**
 * 用时上界：单波超过 90 秒（EQUIPMENT_DUNGEON_RULES.maxFightSeconds）
 * 就是打不动，判负而不是通关；所以一条**胜利**记录不可能超过两波上限。
 *
 * 上界的作用不是抓作弊，而是抓「把毫秒当秒填」这类单位错误 ——
 * 一旦漏进榜单，榜尾会出现 3000 秒的记录，玩家会以为榜坏了。
 */
export const DUNGEON_MAX_DURATION_MS = 90_000 * 2;

/** 用时是否物理上可能（格律 + 上下界）。 */
export function isPlausibleDungeonDuration(durationMs: number): boolean {
  if (!Number.isInteger(durationMs)) return false;
  if (durationMs % DUNGEON_DURATION_GRANULARITY_MS !== 0) return false;
  return durationMs >= DUNGEON_MIN_DURATION_MS && durationMs <= DUNGEON_MAX_DURATION_MS;
}

/** 首通时刻是否在合理区间（不早于项目诞生、不晚于服务端时间 + 容差）。 */
export function isPlausibleFirstClearedAt(firstClearedAt: number, now: number): boolean {
  if (!Number.isFinite(firstClearedAt)) return false;
  if (firstClearedAt < DUNGEON_FIRST_CLEAR_EPOCH_MS) return false;
  return firstClearedAt <= now + DUNGEON_CLOCK_SKEW_TOLERANCE_MS;
}

/**
 * 合理性总判定 —— 客户端与服务端唯一的一份实现。
 *
 * 不通过 = verified false（移出展示、保留数据、不封号，docs/51 §6），
 * 不是报错给玩家看。
 */
export function isPlausibleDungeonClaim(claim: DungeonClearClaim, now: number): boolean {
  if (!isBoardableDungeon(claim.dungeonId)) return false;
  if (!isPlausibleDungeonDuration(claim.bestDurationMs)) return false;
  return isPlausibleFirstClearedAt(claim.firstClearedAt, now);
}

/**
 * 深度链：要提交第 d 层，必须已经有同档第 d−1 层的**可信**记录。
 *
 * 这条取代了旧的「等级 ≥ unlockLevel」。两个理由：
 *   1. 深度模型删掉了 unlockLevel，旧判定会退化成恒真 —— 一个失效了
 *      还不会变红的安全判定
 *   2. 等级可以挂机堆，深度必须真的打赢过；而且服务端有独立证据
 *
 * `clearedDepth` 必须来自**服务端自己的 dungeon_records**，不能来自
 * 客户端上报的存档字段。差别是根本性的：前者是服务端一层层收下来的
 * 成绩，后者是被判断的人自己的声明。
 *
 * 第 1 层永远放行 —— 那是这条链的起点，没有起点就没人能开始。
 * 换设备的玩家把本地阶梯按深度升序补交即可，链会一层层建起来。
 */
export function meetsDungeonDepthChain(dungeonId: string, clearedDepth: number): boolean {
  const entry = dungeonBoardEntry(dungeonId);
  if (!entry) return false;
  return entry.depth <= clearedDepth + 1;
}

export interface DungeonRecordRow {
  bestDurationMs: number;
  firstClearedAt: number;
  verified: boolean;
}

/**
 * 已有记录与新成绩怎么合并。
 *
 * 与里程碑（一次性历史事实，on conflict do nothing）相反：最快用时是
 * **可以刷新的成绩**，每次挑战都可能更快，所以取两者更小的那个。
 * 首通时刻同样取更早的那个 —— 它是历史事实，只会被「更早的证据」修正。
 *
 * 一条不可信的成绩永远不许改写已有记录：否则「先老实报一条，再报一条
 * 伪造的更快用时」就能把榜刷穿，而 verified 只是个展示开关拦不住它。
 * 反过来，可信成绩允许覆盖此前不可信的行 —— 玩家用真实成绩自证之后，
 * 不该被自己早先那条坏数据永久拖着。
 */
export function mergeDungeonRecord(
  existing: DungeonRecordRow,
  incoming: DungeonRecordRow,
): { row: DungeonRecordRow; changed: boolean } {
  if (!incoming.verified) return { row: existing, changed: false };

  const row: DungeonRecordRow = {
    bestDurationMs: existing.verified
      ? Math.min(existing.bestDurationMs, incoming.bestDurationMs)
      : incoming.bestDurationMs,
    firstClearedAt: existing.verified
      ? Math.min(existing.firstClearedAt, incoming.firstClearedAt)
      : incoming.firstClearedAt,
    verified: true,
  };
  const changed =
    row.bestDurationMs !== existing.bestDurationMs ||
    row.firstClearedAt !== existing.firstClearedAt ||
    row.verified !== existing.verified;
  return { row, changed };
}

/** 用时的人话展示：「37.1 秒」。榜单与副本详情共用，避免两处各写一份。 */
export function formatDungeonDuration(durationMs: number): string {
  if (durationMs < 60_000) return `${(durationMs / 1000).toFixed(1)} 秒`;
  const minutes = Math.floor(durationMs / 60_000);
  const seconds = ((durationMs % 60_000) / 1000).toFixed(1);
  return `${minutes} 分 ${seconds} 秒`;
}
