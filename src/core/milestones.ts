/**
 * 登顶速度榜的纯逻辑（docs/51 §4 榜 4）。
 *
 * 与 core 其余模块同规：不碰 Vue / Pinia / storage / DOM，
 * 因为 Edge Function 会通过 Deno 直接 import 本文件做服务端校验 ——
 * 客户端与服务端必须跑同一份判定，否则「合理性」两边不一致。
 */

import {
  MILESTONE_LEVELS,
  MILESTONE_MIN_ELAPSED_MS,
  isMilestoneLevel,
} from '../data/milestoneRules';

/** 一条里程碑成绩的最小形状（存档与网络载荷共用这个口径）。 */
export interface MilestoneClaim {
  /** 档位等级 */
  level: number;
  /** 从建号到首次达成的用时（毫秒） */
  elapsedMs: number;
}

/**
 * 这次升级跨过了哪些还没记录过的档位。
 *
 * 一次结算跨多级是常态（离线收益、区域解锁后囤积经验一次性释放），
 * 所以要返回**全部**新跨过的档位而不只是最高的那个。
 *
 * `prevLevel` 用「>」而不是「>=」：等级正好等于档位时算达成，
 * 所以从 Lv20 升到 Lv21 不会重复触发 Lv20。
 */
export function newlyReachedMilestones(
  prevLevel: number,
  nextLevel: number,
  alreadyRecordedLevels: readonly number[],
): number[] {
  if (nextLevel <= prevLevel) return [];
  const recorded = new Set(alreadyRecordedLevels);
  return MILESTONE_LEVELS.filter(
    (level) => level > prevLevel && level <= nextLevel && !recorded.has(level),
  );
}

/**
 * 用时 = 达成时刻 − 建号时刻，下限 1ms。
 *
 * 为什么要夹下限：数据库有 `elapsed_ms > 0` 约束，而系统时钟回拨或存档
 * 被改过都可能让差值 ≤ 0。夹到 1ms 而不是抛错 —— 它随后会被合理性下界
 * 判为不可信（`verified = false`，移出展示但保留数据），
 * 这比让一次正常升级崩在存档写入上要好。
 */
export function milestoneElapsedMs(createdAt: number, reachedAt: number): number {
  return Math.max(1, Math.round(reachedAt - createdAt));
}

/**
 * 合理性判定：用时是否达到该档位的硬下界。
 *
 * 服务端复算不了「你何时到达 Lv60」（不像试炼伤害可以逐点重跑），
 * 所以这是唯一的防线。未知档位一律判不可信 ——
 * 客户端能声明任意 level，白名单之外不该进榜。
 */
export function isPlausibleMilestone(claim: MilestoneClaim): boolean {
  if (!isMilestoneLevel(claim.level)) return false;
  if (!Number.isFinite(claim.elapsedMs) || claim.elapsedMs <= 0) return false;
  return claim.elapsedMs >= MILESTONE_MIN_ELAPSED_MS[claim.level];
}

/** 用时的人话展示：「3 天 4 小时」。榜单与存档详情共用。 */
export function formatElapsed(elapsedMs: number): string {
  const totalMinutes = Math.max(0, Math.floor(elapsedMs / 60_000));
  const days = Math.floor(totalMinutes / 1440);
  const hours = Math.floor((totalMinutes % 1440) / 60);
  const minutes = totalMinutes % 60;
  if (days > 0) return hours > 0 ? `${days} 天 ${hours} 小时` : `${days} 天`;
  if (hours > 0) return minutes > 0 ? `${hours} 小时 ${minutes} 分` : `${hours} 小时`;
  return `${minutes} 分`;
}
