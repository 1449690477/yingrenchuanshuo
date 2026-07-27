import type {
  ActiveSkill,
  LevelScalar,
  MonsterType,
  Skill,
  SkillCondition,
  SkillEffect,
} from './types';

export interface SkillConditionContext {
  selfHpRatio: number;
  targetHpRatio: number;
  monsterType: MonsterType;
  statusStacks: Readonly<Record<string, number>>;
}

/** 读取某技能等级下的成长数值；技能等级从 1 开始。 */
export function levelScalarAt(scalar: LevelScalar, skillLevel: number): number {
  if (!Number.isSafeInteger(skillLevel) || skillLevel < 1) {
    throw new Error(`levelScalarAt: 技能等级必须是 >= 1 的整数，收到 ${skillLevel}`);
  }
  const value = scalar.base + (scalar.perLevel ?? 0) * (skillLevel - 1);
  if (scalar.max === undefined) return value;
  return (scalar.perLevel ?? 0) >= 0 ? Math.min(value, scalar.max) : Math.max(value, scalar.max);
}

/**
 * 把一次技能的总倍率按多段权重拆开。
 *
 * hitWeights 只表达节奏与分配，不会让「255% 六段」变成 255% × 6。
 */
export function damageHitMultipliers(
  effect: Extract<SkillEffect, { kind: 'damage' }>,
  skillLevel: number,
): readonly number[] {
  const totalMultiplier = levelScalarAt(effect.multiplier, skillLevel);
  const weights = effect.hitWeights ?? [1];
  if (weights.length === 0 || weights.some((weight) => !Number.isFinite(weight) || weight <= 0)) {
    throw new Error('damageHitMultipliers: 多段权重必须是非空正数数组');
  }
  const totalWeight = weights.reduce((sum, weight) => sum + weight, 0);
  return weights.map((weight) => (totalMultiplier * weight) / totalWeight);
}

export function conditionSatisfied(
  condition: SkillCondition,
  context: SkillConditionContext,
): boolean {
  switch (condition.kind) {
    case 'self-hp-at-most':
      return context.selfHpRatio <= condition.ratio;
    case 'target-hp-at-most':
      return context.targetHpRatio <= condition.ratio;
    case 'monster-type':
      return condition.types.includes(context.monsterType);
    case 'status-stacks-at-least':
      return (context.statusStacks[condition.statusId] ?? 0) >= condition.stacks;
    case 'has-status':
      return (context.statusStacks[condition.statusId] ?? 0) > 0;
  }
}

/** 被动永远不进入主动释放队列；主动条件不满足时必须跳过，不能空耗冷却。 */
export function canCastSkill(skill: Skill, context: SkillConditionContext): skill is ActiveSkill {
  return skill.type === 'active' && (!skill.castWhen || conditionSatisfied(skill.castWhen, context));
}
