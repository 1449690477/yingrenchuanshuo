/**
 * 装备副本「深度」纯逻辑（docs/66）。
 *
 * 深度替代等级门槛作为挑战轴：**进不进得去由「打不打得过」决定**。
 * 本模块只做计算 —— 不读时间、不掷骰、不碰存档。
 *
 * 三个核心保证，任何改动都不能破坏：
 *   1. 胚子锚点 = min(标称等级, 玩家等级, 内容顶等级)，**三元取小**
 *   2. 锚点表缺配直接抛错，不许回退默认值
 *   3. 深度只升不降（docs/40 红线：进度条不许倒退）
 */

import type { Quality } from './types';
import { typicalQualityAt, expectedFullGearCp } from '@/data/expectedPower';
import type { EquipmentDungeonTierId } from '@/data/equipmentDungeonGear';
import {
  DEPTH_BLANK_CHANCE,
  DEPTH_DIFFICULTY_K,
  DEPTH_PER_TIER,
  EQUIPMENT_DUNGEON_DEPTH_ANCHORS,
  type EquipmentDungeonDepthAnchor,
} from '@/data/equipmentDungeonDepthRules';

/** 各档已通过的最高深度；缺档或 0 表示该档一层都没过。 */
export type EquipmentDungeonDepthProgress = Readonly<
  Partial<Record<EquipmentDungeonTierId, number>>
>;

export type DepthBlockReason = 'ok' | 'previous-depth' | 'not-opened' | 'daily-limit';

export interface DepthEvaluation {
  unlocked: boolean;
  reason: DepthBlockReason;
  /** 该层的「地点等级」，只由档位与深度决定 */
  nominalLevel: number;
  /** 实际用于生成胚子的等级，三元取小的结果 */
  anchorLevel: number;
  blankQuality: Quality;
  recommendCp: number;
  /** 该层稳定后的胚子掉率；首破必掉不走这个数 */
  blankChance: number;
  /** 这一层是不是玩家的下一个「首破」——首破必掉 1 件胚子 */
  isFirstBreak: boolean;
}

/**
 * 锚点表守卫（docs/66 §3.1）。
 *
 * 照 `STAGE_PACING_FACTORS` 的做法：**缺配直接抛错，不许回退默认值**。
 * 将来加区域 8 的新档时，漏配必须当场炸出来 ——
 * 静默取默认值的错误在测试里极难发现，我们已经吃过两次亏
 * （milestones 表建好一整天零代码、分段自检写死已删除的 id）。
 */
export function requireDepthAnchor(
  tierId: EquipmentDungeonTierId,
): EquipmentDungeonDepthAnchor {
  const anchor = EQUIPMENT_DUNGEON_DEPTH_ANCHORS[tierId];
  if (!anchor) {
    throw new Error(
      `[配置错误] 装备副本档位 ${tierId} 未登记深度锚点 ` +
        `—— 新档位上线必须在 EQUIPMENT_DUNGEON_DEPTH_ANCHORS 里做锚点决策（docs/66 §3.1）`,
    );
  }
  return anchor;
}

function assertDepth(depth: number): void {
  if (!Number.isInteger(depth) || depth < 1 || depth > DEPTH_PER_TIER) {
    throw new Error(`[参数错误] 深度必须是 1~${DEPTH_PER_TIER} 的整数，收到 ${depth}`);
  }
}

/** 该层的「地点等级」：标称等级 = baseLevel + step × (depth − 1)。 */
export function depthNominalLevel(tierId: EquipmentDungeonTierId, depth: number): number {
  assertDepth(depth);
  const anchor = requireDepthAnchor(tierId);
  return anchor.baseLevel + anchor.step * (depth - 1);
}

/** 该层在当前内容下是否已开放（crimson 目前只开 d1，见 docs/66 §七）。 */
export function isDepthOpen(tierId: EquipmentDungeonTierId, depth: number): boolean {
  assertDepth(depth);
  return depth <= requireDepthAnchor(tierId).openDepths;
}

/**
 * ★ 胚子锚点 = min(标称等级, 玩家等级, 内容顶等级)。
 *
 * **三个约束缺一不可**，每一个都有真实反例（docs/66 §3.3、§6.1）：
 *   - 标称等级：低档给的东西必须更差，否则档位进阶失去意义
 *   - 玩家等级：越级挑战的回报是「更早拿到」，不是「拿到超模的」
 *   - 内容顶：`LEVEL_SOFT_CAP_MARGIN = 3`，玩家能到 Lv81 而主线装备
 *     最高只到内容顶 Lv78 —— 那 3 级里主线**没有装备可掉**，
 *     只用二元 min 会漏出 1.052× 超模
 *
 * 语义是「**地点给上限、你的时代做封顶**」，不是「按玩家等级发装备」：
 * 地点（档位 × 深度）定上限，玩家等级只能把它往下压、永远不能往上抬。
 * 这段措辞是留给后人的 —— 看到 min 里有 playerLevel 很容易误判，请不要改写。
 */
export function depthAnchorLevel(
  tierId: EquipmentDungeonTierId,
  depth: number,
  playerLevel: number,
  contentTopLevel: number,
): number {
  if (playerLevel < 1 || contentTopLevel < 1) {
    throw new Error(
      `[参数错误] 玩家等级与内容顶必须为正：playerLevel=${playerLevel} contentTop=${contentTopLevel}`,
    );
  }
  return Math.min(depthNominalLevel(tierId, depth), playerLevel, contentTopLevel);
}

/**
 * 胚子品质 = 锚点等级的主线**典型**品质。
 *
 * 取「典型」而不是「最好的可能」：主线运气好能掉出高一档的，
 * 副本给的是稳定画布。**这个差额是刻意保留的** —— 主线保住品质惊喜的上尾，
 * 两者定位就此分清，主线永远不会降级成「较差的画布」（docs/66 §3.4）。
 */
export function depthBlankQuality(
  tierId: EquipmentDungeonTierId,
  depth: number,
  playerLevel: number,
  contentTopLevel: number,
): Quality {
  return typicalQualityAt(depthAnchorLevel(tierId, depth, playerLevel, contentTopLevel));
}

/**
 * 该层的推荐战力 = `expectedFullGearCp(标称等级) × k(depth)`。
 *
 * **推荐战力与实际难度必须是同一个式子的两次读数** —— 怪物强度用同一个值标定。
 * 旧结构里推荐战力走公式、实际难度走手填的 `TIER_ENCOUNTER_SCALE`，
 * 两个旋钮之间没有反馈回路，于是绛紫档长期「战力比 0.76 却 100% 全胜」
 * 而没有任何门禁能发现（docs/66 §3.2）。
 */
export function depthRecommendCp(tierId: EquipmentDungeonTierId, depth: number): number {
  assertDepth(depth);
  const k = DEPTH_DIFFICULTY_K[depth - 1];
  if (k === undefined) {
    throw new Error(`[配置错误] DEPTH_DIFFICULTY_K 缺少第 ${depth} 层（docs/66 §3.2）`);
  }
  return Math.round(expectedFullGearCp(depthNominalLevel(tierId, depth)) * k);
}

/** 该层稳定后的胚子掉率；首破必掉不走这个数（docs/66 §4.2）。 */
export function depthBlankChance(depth: number): number {
  assertDepth(depth);
  const chance = DEPTH_BLANK_CHANCE[depth - 1];
  if (chance === undefined) {
    throw new Error(`[配置错误] DEPTH_BLANK_CHANCE 缺少第 ${depth} 层（docs/66 §4.2）`);
  }
  return chance;
}

/** 玩家在该档已通过的最高深度；没打过是 0。 */
export function clearedDepthOf(
  progress: EquipmentDungeonDepthProgress,
  tierId: EquipmentDungeonTierId,
): number {
  return progress[tierId] ?? 0;
}

/**
 * 深度链：只能挑战「已通过的最高深度 + 1」及以下。
 *
 * 这条替代了旧的 `unlockLevel`，而且比它更强：
 * **等级可以靠挂机堆，深度必须真的打赢过。**
 */
export function isDepthUnlocked(
  progress: EquipmentDungeonDepthProgress,
  tierId: EquipmentDungeonTierId,
  depth: number,
): boolean {
  assertDepth(depth);
  if (!isDepthOpen(tierId, depth)) return false;
  return depth <= clearedDepthOf(progress, tierId) + 1;
}

/**
 * 推进深度进度。**只升不降**（docs/40 红线），失败或重复通关都不会让它退。
 */
export function advanceDepth(
  progress: EquipmentDungeonDepthProgress,
  tierId: EquipmentDungeonTierId,
  clearedDepth: number,
): EquipmentDungeonDepthProgress {
  assertDepth(clearedDepth);
  return {
    ...progress,
    [tierId]: Math.max(clearedDepthOf(progress, tierId), clearedDepth),
  };
}

/** UI 与 store 的单一入口：一次拿全某一层要展示与判定的全部信息。 */
export function evaluateDungeonDepth(input: {
  progress: EquipmentDungeonDepthProgress;
  tierId: EquipmentDungeonTierId;
  depth: number;
  playerLevel: number;
  contentTopLevel: number;
  attemptsRemaining: number;
}): DepthEvaluation {
  const { progress, tierId, depth, playerLevel, contentTopLevel, attemptsRemaining } = input;
  const nominalLevel = depthNominalLevel(tierId, depth);
  const anchorLevel = depthAnchorLevel(tierId, depth, playerLevel, contentTopLevel);

  const reason: DepthBlockReason = !isDepthOpen(tierId, depth)
    ? 'not-opened'
    : depth > clearedDepthOf(progress, tierId) + 1
      ? 'previous-depth'
      : attemptsRemaining <= 0
        ? 'daily-limit'
        : 'ok';

  return {
    unlocked: reason === 'ok',
    reason,
    nominalLevel,
    anchorLevel,
    blankQuality: typicalQualityAt(anchorLevel),
    recommendCp: depthRecommendCp(tierId, depth),
    blankChance: depthBlankChance(depth),
    isFirstBreak: depth > clearedDepthOf(progress, tierId),
  };
}
