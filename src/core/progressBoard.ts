/**
 * 进度榜（docs/63 §五 · P4，docs/51 §4 榜 3「开荒者的荣誉」）的纯函数层。
 *
 * 与里程碑/羁绊榜同一条根本约束：**服务端无法复算**。「你何时首通了
 * 这一关」是一段已经过去的历史，服务端手里没有任何东西能重建它。
 * 防线（与速度榜同构，claude 06:30 复核确认）：
 *
 *   L1 结构白名单   —— stageId ∈ ORDERED_STAGE_IDS；时刻落在
 *                       [2026-01-01, 服务端时间+5min] 窗口（与副本首通
 *                       时刻判据同源）。**序号永远由服务端从白名单推导，
 *                       客户端无权自称序号。**
 *   L2 只升不降     —— 专用表 progress_records 的原子 upsert（更深处才
 *                       覆盖；同深处只许补时刻、只许 verified false→true）。
 *                       表对客户端只有 select，没有任何写策略。
 *   L3 verified     —— 软旗标不硬拒：用同源 evaluateChapterGate 判定
 *                       （profiles.level 够 legacy-bypass 或 combat_power
 *                       过该章门槛才 verified）；伪造进度等于先把自己挂上
 *                       战力榜 —— 成本不对称（submit-milestone 同口径注释）。
 *
 * 为什么不走 profiles 加两列（docs/63 §五 的原始建议，已被撤回）：
 * profiles 的 own-row 写策略是 for all，已登录客户端可以直接 PATCH
 * 自己那行的任何列 —— 竞速榜挂上去等于把名次开放给客户端自填。
 * 专用表 RLS 只读 + service-role 写，照 milestones / dungeon_records 先例。
 */

import { ORDERED_STAGE_IDS, getStage } from '@/data/stages';
import { evaluateChapterGate } from './stageProgress';
import type { ClassId } from './types';

/** 首通时刻下界：赛季起点（2026-01-01），与副本首通时刻判据同一个窗口。 */
export const PROGRESS_CLAIM_MIN_AT = Date.parse('2026-01-01T00:00:00.000Z');

/** 客户端时钟漂移容差：时刻上界 = 服务端时间 + 5 分钟。 */
export const PROGRESS_CLAIM_CLOCK_SKEW_MS = 5 * 60 * 1000;

/**
 * 一次进度上报：最深首通的关卡 + 该关首通时刻。
 * firstClearedAt 为 null = 老档已通关但没有时刻记录 —— 不补记，
 * 「没有证据就不能主张更早」（docs/62 §4.1），同关排最后。
 */
export interface ProgressClaim {
  stageId: string;
  firstClearedAt: number | null;
}

/** 关卡在白名单里的推进序号（0 起）；未登记的 id 为 -1。 */
const STAGE_INDEX: ReadonlyMap<string, number> = new Map(
  ORDERED_STAGE_IDS.map((id, index) => [id, index]),
);

export function progressStageIndex(stageId: string): number {
  return STAGE_INDEX.get(stageId) ?? -1;
}

/**
 * 从存档推导最深首通：已通关集合里推进序号最大的那一关。
 * 一关未通 → null（榜上还没有这个人，英雄卡显示「尚未启程」）。
 * 未登记的白名单外 id 一律忽略（旧档可能留着已下线的关卡 id）。
 */
export function deepestProgressClaim(
  clearedStageIds: readonly string[],
  stageFirstClearedAt: Readonly<Record<string, number>>,
): ProgressClaim | null {
  let bestId: string | null = null;
  let bestIndex = -1;
  for (const stageId of clearedStageIds) {
    const index = progressStageIndex(stageId);
    if (index > bestIndex) {
      bestIndex = index;
      bestId = stageId;
    }
  }
  if (bestId === null) return null;
  const at = stageFirstClearedAt[bestId];
  return {
    stageId: bestId,
    firstClearedAt: typeof at === 'number' && Number.isFinite(at) ? at : null,
  };
}

/**
 * L1 结构白名单：关卡必须在推进链上；时刻要么缺席（老档），要么落在
 * [赛季起点, now+5min] 整数窗口内。now 由服务端传入（客户端时钟不可信）。
 */
export function isProgressClaimWellFormed(claim: ProgressClaim, now: number): boolean {
  if (progressStageIndex(claim.stageId) < 0) return false;
  const at = claim.firstClearedAt;
  if (at === null) return true;
  if (!Number.isInteger(at)) return false;
  return at >= PROGRESS_CLAIM_MIN_AT && at <= now + PROGRESS_CLAIM_CLOCK_SKEW_MS;
}

/** L3 判定所需的档案截面（profiles 表读出来的 level / combat_power）。 */
export interface ProgressGateProfile {
  level: number;
  combatPower: number;
}

export interface ProgressVerdict {
  /** false = 收下但不入榜（软旗标，不是惩罚） */
  verified: boolean;
  /** ok = 战力过门槛；legacy-bypass = 老档等级后门；cp-insufficient = 战力不到该章门槛 */
  verdict: 'ok' | 'legacy-bypass' | 'cp-insufficient';
}

/**
 * L3 可信度判定：与「这一关的游戏内进入门槛」同一份实现
 * （evaluateChapterGate，docs/57 §1.1 契约）—— 同一份口径不许两处实现。
 *
 * 判定的是「这个玩家有没有可能凭真实进度到过这关」：战力够该章门槛，
 * 或等级够老档后门（历史无上限时期升上去的等级早已到过这些内容）。
 * 伪造一条深进度需要先把自己的 profiles.combat_power 垫到门槛之上 ——
 * 那会同时把自己挂上战力榜被人看见（成本不对称）。
 *
 * 关卡未登记 / 章节未登记 → 抛配置错误（响亮地失败，不静默放行）。
 */
export function evaluateProgressClaim(
  claim: ProgressClaim,
  profile: ProgressGateProfile,
): ProgressVerdict {
  const stage = getStage(claim.stageId);
  if (!stage) throw new Error(`[配置错误] 进度榜关卡不存在：${claim.stageId}`);
  const gate = evaluateChapterGate(profile.combatPower, profile.level, stage.chapterId);
  if (gate.reason === 'cp') return { verified: false, verdict: 'cp-insufficient' };
  return { verified: true, verdict: gate.reason };
}

/** 榜单行（verified 行内排序后的展示截面）。 */
export interface ProgressBoardRow {
  rank: number;
  userId: string;
  displayName: string;
  avatarUrl: string | null;
  /** 只用于无头像时的占位立绘；进度榜本身不分职业。 */
  classId: ClassId;
  stageName: string;
  stageLevel: number;
  deepestStageIndex: number;
  /** 首通时刻（epoch ms）；老档无记录为 null。 */
  firstClearedAt: number | null;
  isMe: boolean;
}

/** 关卡展示名与等级；未登记 → 抛配置错误（与 evaluateChapterGate 同规）。 */
export function progressStageLabel(stageId: string): { stageName: string; stageLevel: number } {
  const stage = getStage(stageId);
  if (!stage) throw new Error(`[配置错误] 进度榜关卡不存在：${stageId}`);
  return { stageName: stage.name, stageLevel: stage.level };
}

/** 排序比较所需的最小截面（行/记录都满足）。 */
export interface ProgressSortKey {
  deepestStageIndex: number;
  firstClearedAt: number | null;
}

/**
 * 榜单顺序：更深者在前；同深处更早达成者在前；**无时刻的排在有时刻的
 * 之后** —— 不是惩罚，是「没有证据就不能主张更早」（docs/62 §4.1）。
 * a 严格排在 b 前时返回 true。
 */
export function progressRowBeatsRow(a: ProgressSortKey, b: ProgressSortKey): boolean {
  if (a.deepestStageIndex !== b.deepestStageIndex) {
    return a.deepestStageIndex > b.deepestStageIndex;
  }
  if (a.firstClearedAt === null) return false;
  if (b.firstClearedAt === null) return true;
  return a.firstClearedAt < b.firstClearedAt;
}
