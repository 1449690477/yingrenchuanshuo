/**
 * 成就核心（M4-7）。
 *
 * 纯函数（铁律 1）：输入存档快照，输出每条成就的达成态 / 进度与档位奖励。
 * 不读存档、不触 UI、不接 RNG。
 *
 * 设计口径（docs/14 + 数值线 2026-08-03 裁定）：
 * - 统一模型：每条成就 = 某个统计值达到目标值，进度 = min(当前值, 目标)。
 * - 奖励 = 档位制战斗乘区：每解锁 20 条 +0.5%，80 条封顶 +2.0%。
 * - 不进 CP、仅本地 PvE（试炼 / 竞技服务端复算无本地成就状态，纳入即失真）。
 */
import { ACHIEVEMENTS, type AchievementDef } from '@/data/achievements';

export type AchievementCategory = 'battle' | 'growth' | 'collect' | 'explore' | 'cultivate';

export type AchievementStat =
  | 'totalKills'
  | 'bossKillKinds'
  | 'bossKills'
  | 'level'
  | 'cp'
  | 'gold'
  | 'equipmentCodexCount'
  | 'monsterCodexCount'
  | 'epicCount'
  | 'legendaryCount'
  | 'totalCodexCount'
  | 'clearedChapterCount'
  | 'clearedStageCount'
  | 'enhanceCount'
  | 'reforgeCount'
  | 'sweepCount'
  | 'affectionCount'
  | 'arenaCount'
  | 'dungeonCount';

/** 评估输入：各统计口径的当前值，全部由上层从存档状态纯计算。 */
export interface AchievementInput {
  totalKills: number;
  bossKillKinds: number;
  bossKills: number;
  level: number;
  cp: number;
  gold: number;
  equipmentCodexCount: number;
  monsterCodexCount: number;
  epicCount: number;
  legendaryCount: number;
  totalCodexCount: number;
  clearedChapterCount: number;
  clearedStageCount: number;
  /** 以下计数类依赖 v27 stats 扩展字段（只增不减）。 */
  enhanceCount: number;
  reforgeCount: number;
  sweepCount: number;
  affectionCount: number;
  arenaCount: number;
  dungeonCount: number;
}

export interface AchievementResult {
  id: string;
  achieved: boolean;
  /** min(当前值, 目标值)：达成后不再增长。 */
  progress: number;
}

export interface AchievementEvaluation {
  results: readonly AchievementResult[];
  achievedCount: number;
  /** 档位制战斗乘区（%）：floor(解锁数 / 20) × 0.5，封顶 2.0。 */
  bonusPercent: number;
}

/** 每解锁多少条成就升一档。 */
export const ACHIEVEMENT_BONUS_STEP = 20;
/** 每档奖励（%）。 */
export const ACHIEVEMENT_BONUS_PERCENT_PER_STEP = 0.5;
/** 奖励封顶（%）。 */
export const ACHIEVEMENT_BONUS_MAX_PERCENT = 2.0;

export function evaluateAchievements(input: AchievementInput): AchievementEvaluation {
  const results: AchievementResult[] = ACHIEVEMENTS.map((def: AchievementDef) => {
    const current = input[def.stat] ?? 0;
    return {
      id: def.id,
      achieved: current >= def.target,
      progress: Math.min(current, def.target),
    };
  });
  const achievedCount = results.reduce((count, result) => (result.achieved ? count + 1 : count), 0);
  const bonusPercent = Math.min(
    Math.floor(achievedCount / ACHIEVEMENT_BONUS_STEP) * ACHIEVEMENT_BONUS_PERCENT_PER_STEP,
    ACHIEVEMENT_BONUS_MAX_PERCENT,
  );
  return { results, achievedCount, bonusPercent };
}
