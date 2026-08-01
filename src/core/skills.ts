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
  selfStatusStacks?: Readonly<Record<string, number>>;
  targetStatusStacks?: Readonly<Record<string, number>>;
}

export interface ActiveSkillLoadoutEntry {
  skill: ActiveSkill;
  level: number;
}

/**
 * 稳定技能 ID → 下次可释放的战斗内毫秒时点。
 *
 * 使用绝对时点而不是每帧递减浮点冷却：相同战斗时间与配置必然得到相同结果，
 * 浏览器卡顿或 0.1 累加漂移不会让技能多放 / 少放一次。
 */
export type SkillCooldownState = Readonly<Record<string, number>>;

export interface AutoSkillSelection {
  entry: ActiveSkillLoadoutEntry;
  slotIndex: number;
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
      return statusStackFor(condition.target, condition.statusId, context) >= condition.stacks;
    case 'has-status':
      return statusStackFor(condition.target, condition.statusId, context) > 0;
  }
}

function statusStackFor(
  target: 'self' | 'primary-enemy' | undefined,
  statusId: string,
  context: SkillConditionContext,
): number {
  const source =
    target === 'self'
      ? context.selfStatusStacks
      : target === 'primary-enemy'
        ? context.targetStatusStacks
        : context.statusStacks;
  return source?.[statusId] ?? 0;
}

/** 被动永远不进入主动释放队列；主动条件不满足时必须跳过，不能空耗冷却。 */
export function canCastSkill(skill: Skill, context: SkillConditionContext): skill is ActiveSkill {
  return skill.type === 'active' && (!skill.castWhen || conditionSatisfied(skill.castWhen, context));
}

/**
 * 创建一场战斗独立的真实技能冷却状态。
 *
 * 所有技能开场可用；视觉层若要错峰只能改变演出，不得反向污染真实结算。
 */
export function createSkillCooldownState(
  loadout: readonly ActiveSkillLoadoutEntry[],
): SkillCooldownState {
  assertActiveSkillLoadout(loadout);
  return Object.fromEntries(loadout.map(({ skill }) => [skill.id, 0]));
}

/**
 * 从已经就绪且满足条件的主动技能里选出下一招。
 *
 * 排序只看：优先级降序 → 技能栏位置升序。条件不满足时直接检查下一项，
 * 不消耗该技能冷却；同一输入不会受对象键顺序影响。
 */
export function selectAutoSkill(
  loadout: readonly ActiveSkillLoadoutEntry[],
  cooldowns: SkillCooldownState,
  elapsedMs: number,
  context: SkillConditionContext,
): AutoSkillSelection | null {
  assertActiveSkillLoadout(loadout);
  assertElapsedMs(elapsedMs);
  assertCooldownState(loadout, cooldowns);

  let selected: AutoSkillSelection | null = null;
  for (const [slotIndex, entry] of loadout.entries()) {
    if ((cooldowns[entry.skill.id] ?? Infinity) > elapsedMs) continue;
    if (!canCastSkill(entry.skill, context)) continue;
    if (!selected || entry.skill.priority > selected.entry.skill.priority) {
      selected = { entry, slotIndex };
    }
  }
  return selected;
}

/**
 * 提交一次已经选中的真实施法，返回新的冷却表，不修改旧状态。
 */
export function commitAutoSkillCast(
  loadout: readonly ActiveSkillLoadoutEntry[],
  cooldowns: SkillCooldownState,
  selection: AutoSkillSelection,
  elapsedMs: number,
): SkillCooldownState {
  assertActiveSkillLoadout(loadout);
  assertElapsedMs(elapsedMs);
  assertCooldownState(loadout, cooldowns);

  const entry = loadout[selection.slotIndex];
  if (!entry || entry.skill.id !== selection.entry.skill.id) {
    throw new Error(`commitAutoSkillCast: 选择结果不属于当前技能栏：${selection.entry.skill.id}`);
  }
  const readyAtMs = cooldowns[entry.skill.id]!;
  if (readyAtMs > elapsedMs) {
    throw new Error(`commitAutoSkillCast: 技能仍在冷却：${entry.skill.id}`);
  }
  return {
    ...cooldowns,
    [entry.skill.id]: elapsedMs + cooldownMs(entry.skill),
  };
}

/** 返回某技能在指定时点的剩余真实冷却毫秒。 */
export function skillCooldownRemainingMs(
  cooldowns: SkillCooldownState,
  skillId: string,
  elapsedMs: number,
): number {
  assertElapsedMs(elapsedMs);
  const readyAtMs = cooldowns[skillId];
  if (readyAtMs === undefined) {
    throw new Error(`skillCooldownRemainingMs: 冷却表缺少技能：${skillId}`);
  }
  return Math.max(0, readyAtMs - elapsedMs);
}

function cooldownMs(skill: ActiveSkill): number {
  if (!Number.isFinite(skill.cooldownSec) || skill.cooldownSec <= 0) {
    throw new Error(`技能冷却必须为正数：${skill.id}`);
  }
  const milliseconds = skill.cooldownSec * 1_000;
  if (!Number.isSafeInteger(milliseconds)) {
    throw new Error(`技能冷却必须能精确换算为整数毫秒：${skill.id}`);
  }
  return milliseconds;
}

function assertElapsedMs(elapsedMs: number): void {
  if (!Number.isSafeInteger(elapsedMs) || elapsedMs < 0) {
    throw new Error(`战斗时点必须是非负安全整数毫秒：${elapsedMs}`);
  }
}

function assertActiveSkillLoadout(loadout: readonly ActiveSkillLoadoutEntry[]): void {
  if (loadout.length > 4) {
    throw new Error(`主动技能栏最多 4 个，收到 ${loadout.length}`);
  }
  const ids = new Set<string>();
  for (const { skill, level } of loadout) {
    if (skill.type !== 'active') {
      throw new Error(`主动技能栏不能放入被动技能：${skill.id}`);
    }
    if (ids.has(skill.id)) {
      throw new Error(`主动技能栏存在重复技能：${skill.id}`);
    }
    ids.add(skill.id);
    levelScalarAt({ base: 0 }, level);
    cooldownMs(skill);
  }
}

function assertCooldownState(
  loadout: readonly ActiveSkillLoadoutEntry[],
  cooldowns: SkillCooldownState,
): void {
  const expectedIds = loadout.map(({ skill }) => skill.id);
  const actualIds = Object.keys(cooldowns);
  if (
    actualIds.length !== expectedIds.length ||
    expectedIds.some((skillId) => !Object.hasOwn(cooldowns, skillId))
  ) {
    throw new Error('技能冷却表与当前技能栏不一致');
  }
  for (const skillId of expectedIds) {
    const readyAtMs = cooldowns[skillId];
    if (!Number.isSafeInteger(readyAtMs) || readyAtMs < 0) {
      throw new Error(`技能冷却时点非法：${skillId}`);
    }
  }
}
