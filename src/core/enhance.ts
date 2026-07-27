/**
 * 装备强化的单次判定。
 *
 * 本模块只负责规则计算，不读写背包、材料或存档。调用方需要把当前强化
 * 等级与幸运值传入，并使用返回值原子地更新装备和消耗品。
 */

import {
  ENHANCE_BREAK_FROM,
  ENHANCE_DOWNGRADE_FROM,
  ENHANCE_MAX,
  ENHANCE_RATES,
  LUCK_FULL,
} from '@/data/constants';
import type { Rng } from './rng';

export type EnhanceFailure = 'none' | 'downgrade' | 'break';

export interface EnhanceRule {
  targetLevel: number;
  /** 0~1 的成功率。 */
  rate: number;
  /** 失败时的等级惩罚；none 表示等级保持不变。 */
  failure: EnhanceFailure;
}

export interface EnhanceAttempt {
  /** 当前强化等级。+15 已满级，不能再作为强化输入。 */
  level: number;
  /**
   * 当前「装备 uid × 目标等级」幸运桶的值。
   *
   * 掉级后再次冲其他目标等级时，调用方必须读取那个目标自己的桶，不能把
   * 本次返回的幸运值挪用过去。
   */
  luck: number;
  /** 仅碎裂段可使用，且只有实际失败才会消耗。 */
  useProtection: boolean;
}

export type EnhanceOutcome = 'success' | 'failed' | 'downgraded' | 'broken' | 'protected';

export interface EnhanceResult {
  outcome: EnhanceOutcome;
  previousLevel: number;
  targetLevel: number;
  /** null 表示装备已经碎裂。 */
  nextLevel: number | null;
  previousLuck: number;
  /**
   * 当前目标等级幸运桶的新值；装备碎裂时为 null，调用方应删除该装备的
   * 全部幸运桶。成功只清空当前目标等级的桶。
   */
  nextLuck: number | null;
  /** 本次目标等级的基础成功率，单位为 0~1。 */
  rate: number;
  /** 仅表示幸运值满触发的保底，不包含基础成功率 100% 的等级。 */
  guaranteed: boolean;
  /** 保护符只在碎裂段实际失败时消耗。 */
  protectionConsumed: boolean;
}

/**
 * 查询目标强化等级的成功率与失败惩罚。
 */
export function enhanceRule(targetLevel: number): EnhanceRule {
  if (!Number.isInteger(targetLevel) || targetLevel < 1 || targetLevel > ENHANCE_MAX) {
    throw new Error(`enhanceRule: 目标等级必须在 1~${ENHANCE_MAX}，收到 ${targetLevel}`);
  }

  const rate = ENHANCE_RATES[targetLevel];
  if (rate === undefined || !Number.isFinite(rate) || rate <= 0 || rate > 1) {
    throw new Error(`enhanceRule: +${targetLevel} 的成功率配置无效`);
  }

  let failure: EnhanceFailure = 'none';
  if (targetLevel >= ENHANCE_BREAK_FROM) {
    failure = 'break';
  } else if (targetLevel >= ENHANCE_DOWNGRADE_FROM) {
    failure = 'downgrade';
  }

  return { targetLevel, rate, failure };
}

/**
 * 一次失败增加的幸运值。
 *
 * rate 使用 0~1 小数，例如 8% 传 0.08，结果为 ceil(1 / 0.08) = 13。
 */
export function luckGainForRate(rate: number): number {
  if (!Number.isFinite(rate) || rate <= 0 || rate > 1) {
    throw new Error(`luckGainForRate: 成功率必须在 (0, 1]，收到 ${rate}`);
  }
  return Math.ceil(1 / rate);
}

/**
 * 判定一次强化。
 *
 * 每个合法尝试固定推进 RNG 一次，便于按「一次操作对应一格随机流」复盘。
 * 即使基础成功率为 100% 或幸运值已满，也不会跳过这次随机数消费。
 */
export function attemptEnhance(attempt: EnhanceAttempt, rng: Rng): EnhanceResult {
  const { level, luck, useProtection } = attempt;

  if (!Number.isInteger(level) || level < 0 || level >= ENHANCE_MAX) {
    throw new Error(
      `attemptEnhance: 当前强化等级必须在 0~${ENHANCE_MAX - 1}，收到 ${level}`,
    );
  }
  if (!Number.isInteger(luck) || luck < 0 || luck > LUCK_FULL) {
    throw new Error(`attemptEnhance: 幸运值必须在 0~${LUCK_FULL}，收到 ${luck}`);
  }
  if (typeof useProtection !== 'boolean') {
    throw new Error('attemptEnhance: useProtection 必须是布尔值');
  }

  const targetLevel = level + 1;
  const rule = enhanceRule(targetLevel);
  if (useProtection && rule.failure !== 'break') {
    throw new Error(`attemptEnhance: 保护符只能用于 +${ENHANCE_BREAK_FROM} 及以上目标`);
  }

  const guaranteed = rule.rate < 1 && luck === LUCK_FULL;
  const rolledSuccess = rng.chance(rule.rate);
  const succeeded = guaranteed || rolledSuccess;

  if (succeeded) {
    return {
      outcome: 'success',
      previousLevel: level,
      targetLevel,
      nextLevel: targetLevel,
      previousLuck: luck,
      nextLuck: 0,
      rate: rule.rate,
      guaranteed,
      protectionConsumed: false,
    };
  }

  const nextLuck = Math.min(LUCK_FULL, luck + luckGainForRate(rule.rate));
  const common = {
    previousLevel: level,
    targetLevel,
    previousLuck: luck,
    nextLuck,
    rate: rule.rate,
    guaranteed: false,
  };

  if (rule.failure === 'downgrade') {
    return {
      outcome: 'downgraded',
      ...common,
      nextLevel: level - 1,
      protectionConsumed: false,
    };
  }

  if (rule.failure === 'break') {
    if (useProtection) {
      return {
        outcome: 'protected',
        ...common,
        nextLevel: level,
        protectionConsumed: true,
      };
    }
    return {
      outcome: 'broken',
      ...common,
      nextLevel: null,
      nextLuck: null,
      protectionConsumed: false,
    };
  }

  return {
    outcome: 'failed',
    ...common,
    nextLevel: level,
    protectionConsumed: false,
  };
}
