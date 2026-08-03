/**
 * 称号核心（M4-9）。
 *
 * 纯函数（铁律 1）：输入统计快照（与成就共用 AchievementInput），
 * 输出每个称号的解锁态 / 进度，以及装备校验。
 *
 * 设计口径（docs/14）：
 * - 称号 = 成就获得（获得条件复用成就统计口径），Lv30 起系统开放。
 * - 玩家可装备一个称号用于展示；属性奖励与成就同口径（战斗乘区、不进 CP）。
 * - 装备态字段（equippedTitleId）待版本号安排，本模块只做解锁判定与校验。
 */
import { TITLES } from '@/data/titles';
import type { AchievementInput } from './achievements';

export interface TitleResult {
  id: string;
  unlocked: boolean;
  /** min(当前值, 目标值)。 */
  progress: number;
}

export function evaluateUnlockedTitles(input: AchievementInput): readonly TitleResult[] {
  return TITLES.map((title) => {
    const current = input[title.stat] ?? 0;
    return {
      id: title.id,
      unlocked: current >= title.target,
      progress: Math.min(current, title.target),
    };
  });
}

/** 装备校验：称号必须已解锁才可装备（防止通过存档直接填 id 展示未获得称号）。 */
export function isTitleEquippable(
  titleId: string,
  unlockedIds: ReadonlySet<string>,
): boolean {
  if (!TITLES.some((title) => title.id === titleId)) return false;
  return unlockedIds.has(titleId);
}
