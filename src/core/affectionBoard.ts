/**
 * 羁绊榜的纯逻辑（docs/63 §三 · P2）。
 *
 * 与 core 其余模块同规：不碰 Vue / Pinia / storage / DOM，
 * 因为 Edge Function 会通过 Deno 直接 import 本文件做服务端校验 ——
 * 客户端与服务端必须跑同一份判定（docs/63 §六.1：同一份口径不许两处实现）。
 */

import {
  AFFECTION_DAILY_INTERACTION_LIMIT,
  AFFECTION_MAX_POINTS_PER_CHARACTER,
  AFFECTION_MAX_SINGLE_POINTS,
  AFFECTION_PLAUSIBILITY_MARGIN,
  AFFECTION_STORY_CAP_PER_CHARACTER,
  AFFECTION_STORY_COMPLETION_POINTS,
} from '../data/affectionBoardRules';

/** 单角色上报的最小形状（存档与网络载荷共用这个口径）。 */
export interface AffectionBoardClaim {
  /** 当前心意点数 */
  points: number;
  /** 累计互动次数（含送礼；剧情幕完成不计入） */
  totalInteractions: number;
  /** 已完成剧情幕数（主剧情 + 约会） */
  storyCount: number;
}

/**
 * 羁绊榜总分 = 四角色心意之和。
 *
 * 红线（docs/63 §三）：榜上只有这个总数，**任何 UI 不得拆出单角色明细** ——
 * 谁给谁刷了多少好感是私事。
 */
export function affectionTotalPoints(claims: readonly AffectionBoardClaim[]): number {
  return claims.reduce((sum, claim) => sum + claim.points, 0);
}

/**
 * 结构合法性：数值范围是否可能由真实存档产生。
 * 不满足 = 客户端构造了结构上不可能存在的快照，直接拒绝（同速度榜 L1）。
 */
export function isAffectionClaimWellFormed(claim: AffectionBoardClaim): boolean {
  return (
    Number.isInteger(claim.points) &&
    claim.points >= 0 &&
    claim.points <= AFFECTION_MAX_POINTS_PER_CHARACTER &&
    Number.isInteger(claim.totalInteractions) &&
    claim.totalInteractions >= 0 &&
    Number.isInteger(claim.storyCount) &&
    claim.storyCount >= 0 &&
    claim.storyCount <= AFFECTION_STORY_CAP_PER_CHARACTER
  );
}

/**
 * 合理性判定：心意是否可能由「互动次数 × 单次上限 + 幕数 × 单幕上限」产出。
 *
 * 服务端无法复算好感（「你陪了她多少次」是无法重建的历史），
 * 这是唯一防线（docs/63 §三：好感有硬性日上限，
 * totalInteractions × 单次上限就是一条天然下界）。
 *
 * 账龄参与判定：互动有 4 次/角色/日的硬上限，注册 N 天的账号
 * 互动次数不可能超过 4N —— totalInteractions 本身也要过这关，
 * 否则虚报次数会让点数下界形同虚设。
 *
 * 宁可放过也不误伤（与速度榜同原则）：真实玩家的数值离下界有
 * 数量级距离，下界的职责是挡住「改存档顶格 40 万」这种荒谬声明。
 */
export function isPlausibleAffectionClaim(
  claim: AffectionBoardClaim,
  accountAgeMs: number,
): boolean {
  if (!isAffectionClaimWellFormed(claim)) return false;
  const accountDays = Math.max(0, Math.floor(accountAgeMs / 86_400_000));
  const interactionCap = AFFECTION_DAILY_INTERACTION_LIMIT * (accountDays + 1);
  if (claim.totalInteractions > interactionCap * AFFECTION_PLAUSIBILITY_MARGIN) {
    return false;
  }
  const pointsCap =
    (Math.min(claim.totalInteractions, interactionCap) * AFFECTION_MAX_SINGLE_POINTS +
      claim.storyCount * AFFECTION_STORY_COMPLETION_POINTS) *
    AFFECTION_PLAUSIBILITY_MARGIN;
  return claim.points <= pointsCap;
}

/** 心意总值的人话展示：「12,345 心意」。榜单与你的卡共用。 */
export function formatAffectionTotal(total: number): string {
  return `${Math.max(0, Math.round(total)).toLocaleString('zh-CN')} 心意`;
}
