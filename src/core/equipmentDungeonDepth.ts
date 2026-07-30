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

import type { EquipSlot, MonsterDef, Quality } from './types';
import { typicalQualityAt, expectedFullGearCp } from '@/data/expectedPower';
import { REGIONS } from '@/data/regions';
import { EQUIPMENT } from '@/data/equipment';
import { itemBaseValue } from './equipment';

/** 只认区域主线装备 `eq_r{n}_{部位}_{品质}`，不碰珍品/好感/竞技/副本旧装。 */
const REGIONAL_BLANK_ID = /^eq_r\d+_[a-z]+_[a-z]+$/;
import type { EquipmentDungeonTierId } from '@/data/equipmentDungeonGear';
import { QUALITY_ORDER } from '@/data/constants';
import {
  DEPTH_BLANK_CHANCE,
  DEPTH_DIFFICULTY_K,
  DEPTH_PER_TIER,
  DEPTH_ENCOUNTER_BASE,
  EQUIPMENT_DUNGEON_DEPTH_ANCHORS,
  REGION_BLANK_QUALITY_RANGE,
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
  return Math.max(
    Math.min(depthNominalLevel(tierId, depth), playerLevel, contentTopLevel),
    dungeonMinAnchorLevel(),
  );
}

/**
 * 锚点下界 = 最低档的档位等级（当前 azure 的 16）。
 *
 * 为什么需要：玩家等级低于副本入口时根本进不来，`min` 却会算出一个
 * 比任何主线装备都低的锚点 —— Lv1 的主线典型基准值是 0.6，
 * 而现存最弱的区域装备（r1 common Lv2）是 1.53，**比它高**，
 * 于是「取不超模的最强定义」找不到任何候选。
 *
 * 在源头补下界比让守卫抛错更对：那个状态在玩法上不可达，
 * 补下界让函数变成全域有定义的，而守卫仍然留着 ——
 * 将来若有人把区域装备的最低等级改高，它照样会炸出来。
 */
export function dungeonMinAnchorLevel(): number {
  const levels = Object.values(EQUIPMENT_DUNGEON_DEPTH_ANCHORS).map((a) => a.baseLevel);
  if (levels.length === 0) throw new Error('[配置错误] 深度锚点表为空');
  return Math.min(...levels);
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
  return Math.round(expectedFullGearCp(depthNominalLevel(tierId, depth)) * depthDifficultyK(depth));
}

/**
 * 把关卡的基础怪物按深度重新标定（docs/66 §3.2）。
 *
 * 这个函数取代了逐档手填的 `TIER_ENCOUNTER_SCALE`。原表实测跨档极差 **3.54×**
 * （苍蓝 2.69 / 绛紫 0.76），根因不只是「手填不准」，而是
 * **推荐战力走公式、实际难度走手填，两个旋钮之间没有反馈回路** ——
 * 于是绛紫档长期「战力比 0.76 却 100% 全胜」而没有任何门禁能发现。
 *
 * 改成同源之后，`k(depth)` 是唯一旋钮：怪物强度与推荐战力都由它推导，
 * 不可能再各自漂移。
 *
 * 血量按 k 全量放大、攻击只按 sqrt(k) 放大 —— docs/36 的既有结论：
 * 抬攻击会优先杀死低生命职业（辉金魔女曾因此胜率只有 47.5%），
 * 把压力放在血量与限时输出上，职业间差异更小。
 */
export function depthScaledMonster(
  base: MonsterDef,
  tierId: EquipmentDungeonTierId,
  depth: number,
): MonsterDef {
  const k = depthDifficultyK(depth);
  return {
    ...base,
    level: Math.max(1, depthNominalLevel(tierId, depth) - (base.type === 'boss' ? 0 : 2)),
    hpMul: (base.hpMul ?? 1) * DEPTH_ENCOUNTER_BASE.hp * k,
    atkMul: (base.atkMul ?? 1) * DEPTH_ENCOUNTER_BASE.atk * Math.sqrt(k),
  };
}

/** 难度系数，越界抛错而不是回退默认值。 */
export function depthDifficultyK(depth: number): number {
  assertDepth(depth);
  const k = DEPTH_DIFFICULTY_K[depth - 1];
  if (k === undefined) {
    throw new Error(`[配置错误] DEPTH_DIFFICULTY_K 缺少第 ${depth} 层（docs/66 §3.2）`);
  }
  return k;
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

/**
 * ★ 胚子品质 = clamp(typicalQualityAt(锚点), 该区最低品质, 该区最高品质)。
 *
 * 为什么必须夹：胚子取自**玩家当前区域的主线装备定义**（docs/66 §3.5 方案 A），
 * 而公式算出的品质该区**不一定存在**。实测缺口：
 * r2（Lv10-20）实有 [fine, rare, epic]，但 Lv10~14 的 typicalQualityAt 返回
 * common —— 五个等级取不到定义，直接空指针崩在结算上。
 *
 * 为什么夹了也不超模：区域装备本来就是玩家在该区刷主线能掉到的东西，
 * 所以无论夹到哪一档，胚子都是玩家**本来就能获得**的（docs/66 G-2）。
 * 这条保证是结构性的，不需要任何数值比较。
 */
export function blankQualityInRegion(regionId: string, anchorLevel: number): Quality {
  const range = REGION_BLANK_QUALITY_RANGE[regionId];
  if (!range) {
    throw new Error(
      `[配置错误] 区域 ${regionId} 未登记可用装备品质区间 ` +
        `—— 新区域上线必须在 REGION_BLANK_QUALITY_RANGE 里登记（docs/66 §3.5）`,
    );
  }
  const wanted = QUALITY_ORDER.indexOf(typicalQualityAt(anchorLevel));
  const lowest = QUALITY_ORDER.indexOf(range.lowest);
  const highest = QUALITY_ORDER.indexOf(range.highest);
  if (lowest < 0 || highest < 0 || lowest > highest) {
    throw new Error(`[配置错误] 区域 ${regionId} 的品质区间非法：${range.lowest}~${range.highest}`);
  }
  return QUALITY_ORDER[Math.min(Math.max(wanted, lowest), highest)]!;
}

/**
 * 锚点等级落在哪个区域。
 *
 * 区域边界是重叠的（r1 是 Lv1-10、r2 是 Lv10-20，Lv10 两边都算），
 * 取「levelFrom ≤ 锚点」中最靠后的那个 —— 单调、确定，
 * 边界等级归属更高的区域（Lv10 → r2），与玩家在边界时实际在打的内容一致。
 */
export function regionIdForLevel(level: number): string {
  let picked: string | undefined;
  for (const region of REGIONS) {
    if (region.levelFrom <= level) picked = region.id;
  }
  if (!picked) {
    // 低于第一个区域的起点：归第一个区域，新号 Lv1 会走到这里
    picked = REGIONS[0]?.id;
  }
  if (!picked) throw new Error('[配置错误] REGIONS 为空，无法定位胚子所属区域');
  return picked;
}

/**
 * ★ 胚子的装备定义（docs/66 §3.5 方案 A）。
 *
 * 胚子是**主线装备定义**，玩家刷主线本来就能掉到 —— 所以「副本产出不超过
 * 同期主线最强」是结构性的，不靠数值调参。
 *
 * ## 为什么按「基准值上界」选，而不是按「锚点所在区域」选
 *
 * 因为**区域装备的等级坐落在该区上沿**：r5 覆盖 Lv40-52，装备却是 48/50/52。
 * 「取锚点所在区域」于是必然给出高于锚点的装备，实测系统性超模：
 *
 *   Lv10 → r2 fine(Lv16) = **2.83×**（最严重）
 *   Lv40~49 → r5 epic(Lv50) = 1.03~1.35×
 *   Lv65~74 → r7 legendary(Lv75) = 1.02~1.21×
 *
 * 改判据：在**所有**区域的同部位定义里，取基准值不超过
 * 「锚点等级的主线典型基准值」的那一件中最强的。
 * 这样上界是**按真实定义算的**，不是按公式自证的 ——
 * 初版判据（取锚点所在区域）之所以没被 G-2 拦住，正是因为当时的 G-2
 * 拿公式和同一个公式比，从没看过真实定义，和 G-1 是同一个错。
 *
 * 副本给的额外价值是三样，都不击穿曲线：**定向部位**（选门户即选部位）、
 * **品质随深度往上走**、**胚子档与词条方差**（docs/66 §4.3 的显影对象）。
 */
export function blankDefinitionId(slot: EquipSlot, anchorLevel: number): string {
  const ceiling = itemBaseValue(anchorLevel, typicalQualityAt(anchorLevel));
  let best: { id: string; value: number } | undefined;

  for (const definition of Object.values(EQUIPMENT)) {
    if (definition.slot !== slot) continue;
    if (!REGIONAL_BLANK_ID.test(definition.id)) continue;
    // 带定义级 setId 的不能烙印（planImprint 的 def-set-conflict 分支），
    // 发一批不能烙印的胚子会直接违反 docs/58 红线
    if (definition.setId) continue;
    const value = itemBaseValue(definition.level, definition.quality);
    if (value > ceiling + 1e-9) continue;
    if (!best || value > best.value) best = { id: definition.id, value };
  }

  if (!best) {
    throw new Error(
      `[配置错误] 部位 ${slot} 在锚点 Lv${anchorLevel} 找不到任何不超模的主线胚子定义 ` +
        `—— 最低品质的区域装备也高于该等级的主线典型（docs/66 §3.5）`,
    );
  }
  return best.id;
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
