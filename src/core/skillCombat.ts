/**
 * 五职业共用的技能战斗状态机。
 *
 * 本模块只解释传入的 Skill 配置，不知道“骷髅”“剑意”等内容名，也不读取 UI / 存档。
 * 所有时间使用整数毫秒，所有概率只消费调用方传入的 seeded Rng。
 */

import type { Rng } from './rng';
import { createPeriodicDamageState, type PeriodicDamageState } from './combatStatus';
import {
  commitAutoSkillCast,
  conditionSatisfied,
  createSkillCooldownState,
  levelScalarAt,
  selectAutoSkill,
  type ActiveSkillLoadoutEntry,
  type SkillConditionContext,
  type SkillCooldownState,
} from './skills';
import type {
  ActiveSkill,
  Combatant,
  Element,
  MonsterType,
  PassiveSkill,
  Skill,
  SkillEffect,
  SkillStatModifier,
  Stats,
} from './types';

export type SkillCombatSide = 'player' | 'monster';

export interface PassiveSkillLoadoutEntry {
  skill: PassiveSkill;
  level: number;
}

/** 召唤物数值必须由 data 层传入；缺定义时直接报配置错，不做内容兜底。 */
export interface SkillSummonDefinition {
  id: string;
  attackMultiplier: number;
  attackIntervalSec: number;
  element: Element;
  damageable?: boolean;
  maxHpRatio?: number;
  defenseRatio?: number;
  targetWeight?: number;
  maxConcurrent?: number;
}

export interface SkillCombatKit {
  active: readonly ActiveSkillLoadoutEntry[];
  passives: readonly PassiveSkillLoadoutEntry[];
  summons?: readonly SkillSummonDefinition[];
  /** 套装旧字段的兼容输入：0.18 表示技能伤害 +18%。 */
  skillDamageBonusRatio?: number;
}

export interface CreateSkillCombatKitOptions {
  skillLevels?: Readonly<Record<string, number>>;
  selectedActiveSkillIds?: readonly string[];
  summons?: readonly SkillSummonDefinition[];
  skillDamageBonusRatio?: number;
}

export interface SkillRuntimeStatus {
  id: string;
  stacks: number;
  maxStacks: number;
  expiresAtMs: number;
  source: SkillCombatSide;
  skillLevel: number;
  modifiersPerStack: boolean;
  modifiers: readonly SkillStatModifier[];
}

export interface TimedSkillModifier {
  modifier: SkillStatModifier;
  skillLevel: number;
  expiresAtMs: number;
  source: SkillCombatSide;
}

export interface RuntimeSkillTrigger {
  trigger: Extract<SkillEffect, { kind: 'trigger' }>;
  skillLevel: number;
  sourceSkillId: string;
  expiresAtMs: number | null;
  remainingTriggers: number | null;
}

export interface SkillShield {
  amount: number;
  expiresAtMs: number;
}

export interface SkillAvoidance {
  count: number;
  expiresAtMs: number;
}

export interface SkillControl {
  control: Extract<SkillEffect, { kind: 'control' }>['control'];
  strengthRatio: number;
  expiresAtMs: number;
}

export interface RuntimeSkillSummon {
  definition: SkillSummonDefinition;
  nextAttackAtMs: number;
  expiresAtMs: number;
  currentHp: number;
  maxHp: number;
  defense: number;
  skillState: SkillCombatState;
  periodicDamage: PeriodicDamageState;
}

export interface SkillCombatState {
  cooldowns: SkillCooldownState;
  statuses: readonly SkillRuntimeStatus[];
  modifiers: readonly TimedSkillModifier[];
  triggers: readonly RuntimeSkillTrigger[];
  shields: readonly SkillShield[];
  avoidances: readonly SkillAvoidance[];
  controls: readonly SkillControl[];
  summons: readonly RuntimeSkillSummon[];
}

export interface SkillModifierTotals {
  flat: Stats;
  ratio: Pick<Stats, 'atk' | 'def' | 'hp' | 'acc' | 'eva' | 'spd'>;
  critRatePoints: number;
  critDmgPoints: number;
  hitChancePoints: number;
  dodgeChancePoints: number;
  defenseIgnoreRatio: number;
  lifestealPoints: number;
  damageDoneRatio: number;
  damageTakenRatio: number;
  damageTakenFromSourceRatio: number;
  dotDamageRatio: number;
}

export type SkillTriggerEvent = Extract<SkillEffect, { kind: 'trigger' }>['event'];

export interface TriggerDispatchResult {
  state: SkillCombatState;
  effects: readonly { effect: SkillEffect; skillLevel: number; sourceSkillId: string }[];
}

/**
 * 当前没有技能栏 UI 时的唯一正式缺省：已解锁主动按优先级取前 4，被动全部装备。
 * M3-5 只需要传 selectedActiveSkillIds，不会改战斗执行规则。
 */
export function createSkillCombatKit(
  skills: readonly Skill[],
  playerLevel: number,
  options: CreateSkillCombatKitOptions = {},
): SkillCombatKit {
  if (!Number.isSafeInteger(playerLevel) || playerLevel < 1) {
    throw new Error(`createSkillCombatKit: 玩家等级非法：${playerLevel}`);
  }
  const unlocked = skills.filter((skill) => skill.unlockLevel <= playerLevel);
  const byId = new Map(unlocked.map((skill) => [skill.id, skill]));
  const selectedIds = options.selectedActiveSkillIds;
  let activeSkills: ActiveSkill[];
  if (selectedIds) {
    if (selectedIds.length > 4 || new Set(selectedIds).size !== selectedIds.length) {
      throw new Error('createSkillCombatKit: 主动技能栏必须是不重复的 0~4 个技能');
    }
    activeSkills = selectedIds.map((id) => {
      const skill = byId.get(id);
      if (!skill || skill.type !== 'active') {
        throw new Error(`createSkillCombatKit: 技能未解锁或不是主动技能：${id}`);
      }
      return skill;
    });
  } else {
    activeSkills = unlocked
      .filter((skill): skill is ActiveSkill => skill.type === 'active')
      .sort(
        (left, right) =>
          right.priority - left.priority ||
          right.unlockLevel - left.unlockLevel ||
          left.id.localeCompare(right.id),
      )
      .slice(0, 4);
  }

  const levelOf = (skill: Skill): number => {
    const level = options.skillLevels?.[skill.id] ?? 1;
    levelScalarAt({ base: 0 }, level);
    return level;
  };
  const kit: SkillCombatKit = {
    active: activeSkills.map((skill) => ({ skill, level: levelOf(skill) })),
    passives: unlocked
      .filter((skill): skill is PassiveSkill => skill.type === 'passive')
      .map((skill) => ({ skill, level: levelOf(skill) })),
    ...(options.summons ? { summons: options.summons } : {}),
    ...(options.skillDamageBonusRatio === undefined
      ? {}
      : { skillDamageBonusRatio: options.skillDamageBonusRatio }),
  };
  validateSkillCombatKit(kit);
  return kit;
}

export function createSkillCombatState(kit: SkillCombatKit): SkillCombatState {
  validateSkillCombatKit(kit);
  const triggers: RuntimeSkillTrigger[] = [];
  for (const entry of kit.passives) {
    collectPermanentTriggers(entry.skill.effects, entry.level, entry.skill.id, triggers);
  }
  return {
    cooldowns: createSkillCooldownState(kit.active),
    statuses: [],
    modifiers: [],
    triggers,
    shields: [],
    avoidances: [],
    controls: [],
    summons: [],
  };
}

export function expireSkillCombatState(
  state: SkillCombatState,
  elapsedMs: number,
): SkillCombatState {
  assertElapsedMs(elapsedMs);
  return {
    ...state,
    statuses: state.statuses.filter((status) => status.expiresAtMs > elapsedMs),
    modifiers: state.modifiers.filter((modifier) => modifier.expiresAtMs > elapsedMs),
    triggers: state.triggers.filter(
      (trigger) =>
        (trigger.expiresAtMs === null || trigger.expiresAtMs > elapsedMs) &&
        (trigger.remainingTriggers === null || trigger.remainingTriggers > 0),
    ),
    shields: state.shields.filter(
      (shield) => shield.expiresAtMs > elapsedMs && shield.amount > 0,
    ),
    avoidances: state.avoidances.filter(
      (avoidance) => avoidance.expiresAtMs > elapsedMs && avoidance.count > 0,
    ),
    controls: state.controls.filter((control) => control.expiresAtMs > elapsedMs),
    summons: state.summons
      .filter((summon) => summon.expiresAtMs > elapsedMs && summon.currentHp > 0)
      .map((summon) => ({
        ...summon,
        skillState: expireSkillCombatState(summon.skillState, elapsedMs),
      })),
  };
}

export function skillConditionContext(
  self: Combatant,
  selfMaxHp: number,
  target: Combatant,
  targetMaxHp: number,
  targetType: MonsterType,
  selfState: SkillCombatState,
  targetState: SkillCombatState,
): SkillConditionContext {
  const statusStacks: Record<string, number> = {};
  const selfStatusStacks: Record<string, number> = {};
  const targetStatusStacks: Record<string, number> = {};
  for (const status of selfState.statuses) {
    selfStatusStacks[status.id] = status.stacks;
  }
  for (const status of targetState.statuses) {
    targetStatusStacks[status.id] = status.stacks;
  }
  for (const status of [...selfState.statuses, ...targetState.statuses]) {
    statusStacks[status.id] = Math.max(statusStacks[status.id] ?? 0, status.stacks);
  }
  return {
    selfHpRatio: selfMaxHp > 0 ? Math.max(0, self.currentHp) / selfMaxHp : 0,
    targetHpRatio: targetMaxHp > 0 ? Math.max(0, target.currentHp) / targetMaxHp : 0,
    monsterType: targetType,
    statusStacks,
    selfStatusStacks,
    targetStatusStacks,
  };
}

export function selectSkillForAction(
  kit: SkillCombatKit,
  state: SkillCombatState,
  elapsedMs: number,
  context: SkillConditionContext,
): { entry: ActiveSkillLoadoutEntry; slotIndex: number; state: SkillCombatState } | null {
  const selection = selectAutoSkill(kit.active, state.cooldowns, elapsedMs, context);
  if (!selection) return null;
  return {
    ...selection,
    state: {
      ...state,
      cooldowns: commitAutoSkillCast(kit.active, state.cooldowns, selection, elapsedMs),
    },
  };
}

export function effectiveSkillCombatant(
  combatant: Combatant,
  kit: SkillCombatKit | undefined,
  state: SkillCombatState | undefined,
  context: SkillConditionContext,
  incomingSource?: SkillCombatSide,
): { combatant: Combatant; modifiers: SkillModifierTotals } {
  const totals = collectSkillModifiers(kit, state, context, incomingSource);
  const stats = applyModifierTotals(combatant.stats, totals);
  const combatBonuses = combatant.combatBonuses
    ? {
        ...combatant.combatBonuses,
        elementDamage: { ...combatant.combatBonuses.elementDamage },
        lifesteal: combatant.combatBonuses.lifesteal + totals.lifestealPoints,
      }
    : totals.lifestealPoints === 0
      ? undefined
      : {
          damageReduction: 0,
          lifesteal: totals.lifestealPoints,
          elementDamage: { fire: 0, ice: 0, thunder: 0 },
        };
  return {
    combatant: {
      ...combatant,
      stats,
      ...(combatBonuses ? { combatBonuses } : {}),
    },
    modifiers: totals,
  };
}

export function collectSkillModifiers(
  kit: SkillCombatKit | undefined,
  state: SkillCombatState | undefined,
  context: SkillConditionContext,
  incomingSource?: SkillCombatSide,
): SkillModifierTotals {
  const totals = zeroSkillModifierTotals();
  if (kit) {
    for (const entry of kit.passives) {
      collectModifierEffects(entry.skill.effects, entry.level, context, totals);
    }
  }
  if (state) {
    for (const timed of state.modifiers) {
      if (
        timed.modifier.unit === 'ratio' &&
        timed.modifier.stat === 'damageTakenFromSource' &&
        incomingSource !== undefined &&
        timed.source !== incomingSource
      ) {
        continue;
      }
      addModifier(totals, timed.modifier, timed.skillLevel, 1);
    }
    for (const status of state.statuses) {
      const multiplier = status.modifiersPerStack ? status.stacks : 1;
      for (const modifier of status.modifiers) {
        if (
          modifier.unit === 'ratio' &&
          modifier.stat === 'damageTakenFromSource' &&
          incomingSource !== undefined &&
          status.source !== incomingSource
        ) {
          continue;
        }
        addModifier(totals, modifier, status.skillLevel, multiplier);
      }
    }
  }
  return totals;
}

export function applySkillStatus(
  state: SkillCombatState,
  effect: Extract<SkillEffect, { kind: 'apply-status' }>,
  elapsedMs: number,
  source: SkillCombatSide,
  skillLevel = 1,
): SkillCombatState {
  assertPositiveDuration(effect.durationSec, `状态 ${effect.statusId}`);
  if (!Number.isSafeInteger(effect.stacks) || effect.stacks < 1) {
    throw new Error(`状态层数必须是正整数：${effect.statusId}`);
  }
  if (!Number.isSafeInteger(effect.maxStacks) || effect.maxStacks < effect.stacks) {
    throw new Error(`状态上限非法：${effect.statusId}`);
  }
  const durationMs = secondsToMs(effect.durationSec, `状态 ${effect.statusId}`);
  const statuses = [...state.statuses];
  const index = statuses.findIndex((status) => status.id === effect.statusId);
  const nextExpiry = elapsedMs + durationMs;
  if (index < 0) {
    statuses.push({
      id: effect.statusId,
      stacks: Math.min(effect.stacks, effect.maxStacks),
      maxStacks: effect.maxStacks,
      expiresAtMs: nextExpiry,
      source,
      skillLevel,
      modifiersPerStack: effect.modifiersPerStack ?? false,
      modifiers: effect.modifiers ?? [],
    });
  } else {
    const current = statuses[index]!;
    const stacks =
      effect.refresh === 'replace'
        ? Math.min(effect.stacks, effect.maxStacks)
        : Math.min(current.stacks + effect.stacks, effect.maxStacks);
    statuses[index] = {
      ...current,
      stacks,
      maxStacks: effect.maxStacks,
      source,
      skillLevel,
      modifiersPerStack: effect.modifiersPerStack ?? false,
      modifiers: effect.modifiers ?? [],
      expiresAtMs:
        effect.refresh === 'add-duration' ? current.expiresAtMs + durationMs : nextExpiry,
    };
  }
  return { ...state, statuses };
}

export function consumeSkillStatus(
  state: SkillCombatState,
  statusId: string,
  stacks: number | 'all',
): SkillCombatState {
  const statuses = state.statuses.flatMap((status) => {
    if (status.id !== statusId) return [status];
    const remaining = stacks === 'all' ? 0 : status.stacks - stacks;
    return remaining > 0 ? [{ ...status, stacks: remaining }] : [];
  });
  return { ...state, statuses };
}

export function skillStatusStacks(state: SkillCombatState, statusId: string): number {
  return state.statuses.find((status) => status.id === statusId)?.stacks ?? 0;
}

export function addTimedSkillModifier(
  state: SkillCombatState,
  modifier: SkillStatModifier,
  durationSec: number,
  elapsedMs: number,
  source: SkillCombatSide,
  skillLevel = 1,
): SkillCombatState {
  return {
    ...state,
    modifiers: [
      ...state.modifiers,
      {
        modifier,
        skillLevel,
        expiresAtMs: elapsedMs + secondsToMs(durationSec, '技能修正'),
        source,
      },
    ],
  };
}

export function registerRuntimeTrigger(
  state: SkillCombatState,
  trigger: Extract<SkillEffect, { kind: 'trigger' }>,
  skillLevel: number,
  sourceSkillId: string,
  elapsedMs: number,
  castScoped = false,
): SkillCombatState {
  const expiresAtMs =
    trigger.durationSec === undefined
      ? castScoped
        ? elapsedMs + 1
        : null
      : elapsedMs + secondsToMs(trigger.durationSec, `触发器 ${sourceSkillId}`);
  return {
    ...state,
    triggers: [
      ...state.triggers,
      {
        trigger,
        skillLevel,
        sourceSkillId,
        expiresAtMs,
        remainingTriggers: trigger.maxTriggers ?? null,
      },
    ],
  };
}

export function dispatchSkillTriggers(
  state: SkillCombatState,
  event: SkillTriggerEvent,
  context: SkillConditionContext,
  rng: Rng,
): TriggerDispatchResult {
  const triggers = [...state.triggers];
  const effects: { effect: SkillEffect; skillLevel: number; sourceSkillId: string }[] = [];
  for (let index = 0; index < triggers.length; index++) {
    const registration = triggers[index]!;
    if (registration.trigger.event !== event) continue;
    if (registration.trigger.when && !conditionSatisfied(registration.trigger.when, context)) {
      continue;
    }
    if (!rng.chance(registration.trigger.chance ?? 1)) continue;
    effects.push(
      ...registration.trigger.effects.map((effect) => ({
        effect,
        skillLevel: registration.skillLevel,
        sourceSkillId: registration.sourceSkillId,
      })),
    );
    if (registration.remainingTriggers !== null) {
      triggers[index] = {
        ...registration,
        remainingTriggers: registration.remainingTriggers - 1,
      };
    }
  }
  return { state: { ...state, triggers }, effects };
}

export function addSkillShield(
  state: SkillCombatState,
  amount: number,
  durationSec: number,
  elapsedMs: number,
): SkillCombatState {
  if (!Number.isFinite(amount) || amount < 0) throw new Error(`护盾数值非法：${amount}`);
  return {
    ...state,
    shields: [
      ...state.shields,
      { amount, expiresAtMs: elapsedMs + secondsToMs(durationSec, '护盾') },
    ],
  };
}

export function absorbDamageWithSkillShields(
  state: SkillCombatState,
  damage: number,
): { state: SkillCombatState; hpDamage: number; absorbed: number } {
  let remaining = Math.max(0, damage);
  let absorbed = 0;
  const shields = state.shields.map((shield) => ({ ...shield }));
  for (const shield of shields) {
    if (remaining <= 0) break;
    const used = Math.min(shield.amount, remaining);
    shield.amount -= used;
    remaining -= used;
    absorbed += used;
  }
  return {
    state: { ...state, shields: shields.filter((shield) => shield.amount > 0) },
    hpDamage: remaining,
    absorbed,
  };
}

export function addSkillAvoidance(
  state: SkillCombatState,
  count: number,
  durationSec: number,
  elapsedMs: number,
): SkillCombatState {
  if (!Number.isSafeInteger(count) || count < 1) throw new Error(`必闪次数非法：${count}`);
  return {
    ...state,
    avoidances: [
      ...state.avoidances,
      { count, expiresAtMs: elapsedMs + secondsToMs(durationSec, '必闪') },
    ],
  };
}

export function consumeSkillAvoidance(
  state: SkillCombatState,
): { state: SkillCombatState; avoided: boolean } {
  const avoidances = state.avoidances.map((avoidance) => ({ ...avoidance }));
  const active = avoidances.find((avoidance) => avoidance.count > 0);
  if (!active) return { state, avoided: false };
  active.count--;
  return {
    state: { ...state, avoidances: avoidances.filter((avoidance) => avoidance.count > 0) },
    avoided: true,
  };
}

export function addSkillControl(
  state: SkillCombatState,
  effect: Extract<SkillEffect, { kind: 'control' }>,
  elapsedMs: number,
): SkillCombatState {
  return {
    ...state,
    controls: [
      ...state.controls,
      {
        control: effect.control,
        strengthRatio: Math.max(0, effect.strengthRatio ?? 0),
        expiresAtMs: elapsedMs + secondsToMs(effect.durationSec, `控制 ${effect.control}`),
      },
    ],
  };
}

export function skillControlBlockUntil(state: SkillCombatState): number {
  return state.controls
    .filter((control) => control.control !== 'slow')
    .reduce((max, control) => Math.max(max, control.expiresAtMs), 0);
}

export function skillSlowRatio(state: SkillCombatState): number {
  return Math.min(
    0.9,
    state.controls
      .filter((control) => control.control === 'slow')
      .reduce((max, control) => Math.max(max, control.strengthRatio), 0),
  );
}

export function addSkillSummon(
  state: SkillCombatState,
  kit: SkillCombatKit,
  summonId: string,
  durationSec: number,
  elapsedMs: number,
  owner: Combatant,
): SkillCombatState {
  const definition = kit.summons?.find((entry) => entry.id === summonId);
  if (!definition) throw new Error(`[配置错误] 召唤技能缺少数值定义：${summonId}`);
  validateSummon(definition);
  const summon: RuntimeSkillSummon = {
    definition,
    nextAttackAtMs: elapsedMs + summonIntervalMs(definition),
    expiresAtMs: elapsedMs + secondsToMs(durationSec, `召唤物 ${summonId}`),
    maxHp: definition.damageable
      ? owner.stats.hp * (definition.maxHpRatio ?? 0)
      : owner.stats.hp,
    currentHp: definition.damageable
      ? owner.stats.hp * (definition.maxHpRatio ?? 0)
      : owner.stats.hp,
    defense: owner.stats.def * (definition.defenseRatio ?? 0),
    skillState: createSkillCombatState({ active: [], passives: [] }),
    periodicDamage: createPeriodicDamageState(),
  };
  const maxConcurrent = definition.maxConcurrent ?? 1;
  const others = state.summons.filter((entry) => entry.definition.id !== summonId);
  const same = state.summons.filter((entry) => entry.definition.id === summonId);
  const nextSame = maxConcurrent <= 1 ? [summon] : [...same, summon].slice(-maxConcurrent);
  return {
    ...state,
    summons: [...others, ...nextSame],
  };
}

/** 主人固定权重 1；返回 null 表示本次仍攻击主人。 */
export function selectWeightedSummonTarget(
  state: SkillCombatState,
  rng: Rng,
): string | null {
  const candidates = state.summons.filter(
    (summon) =>
      summon.definition.damageable === true &&
      summon.currentHp > 0 &&
      (summon.definition.targetWeight ?? 0) > 0,
  );
  if (candidates.length === 0) return null;
  const total = 1 + candidates.reduce((sum, summon) => sum + summon.definition.targetWeight!, 0);
  let cursor = rng.float(0, total);
  if (cursor < 1) return null;
  cursor -= 1;
  for (const summon of candidates) {
    cursor -= summon.definition.targetWeight!;
    if (cursor < 0) return summon.definition.id;
  }
  return null;
}

export function runtimeSummon(
  state: SkillCombatState,
  summonId: string,
): RuntimeSkillSummon | undefined {
  return state.summons.find(
    (summon) => summon.definition.id === summonId && summon.currentHp > 0,
  );
}

export function updateRuntimeSummon(
  state: SkillCombatState,
  summonId: string,
  update: (summon: RuntimeSkillSummon) => RuntimeSkillSummon,
): SkillCombatState {
  return {
    ...state,
    summons: state.summons
      .map((summon) => (summon.definition.id === summonId ? update(summon) : summon))
      .filter((summon) => summon.currentHp > 0),
  };
}

export function takeDueSummonAttacks(
  state: SkillCombatState,
  elapsedMs: number,
): { state: SkillCombatState; attacks: readonly SkillSummonDefinition[] } {
  const attacks: SkillSummonDefinition[] = [];
  const summons = state.summons.map((summon) => {
    let nextAttackAtMs = summon.nextAttackAtMs;
    const blockUntil = skillControlBlockUntil(summon.skillState);
    if (nextAttackAtMs <= elapsedMs && blockUntil > elapsedMs) {
      nextAttackAtMs = blockUntil;
    }
    const intervalMs = Math.round(
      summonIntervalMs(summon.definition) / (1 - skillSlowRatio(summon.skillState)),
    );
    while (nextAttackAtMs <= elapsedMs && nextAttackAtMs < summon.expiresAtMs) {
      attacks.push(summon.definition);
      nextAttackAtMs += intervalMs;
    }
    return { ...summon, nextAttackAtMs };
  });
  return { state: { ...state, summons }, attacks };
}

export function dispelSkillState(
  state: SkillCombatState,
  polarity: 'buff' | 'debuff',
  count: number | 'all',
): SkillCombatState {
  const limit = count === 'all' ? Number.POSITIVE_INFINITY : count;
  if (limit !== Number.POSITIVE_INFINITY && (!Number.isSafeInteger(limit) || limit < 1)) {
    throw new Error(`驱散数量非法：${count}`);
  }
  let removed = 0;
  const shouldRemove = (modifiers: readonly SkillStatModifier[]): boolean => {
    const sign = modifiers.reduce((sum, modifier) => sum + modifierSign(modifier), 0);
    return polarity === 'buff' ? sign >= 0 : sign < 0;
  };
  const statuses = state.statuses.filter((status) => {
    if (removed >= limit || !shouldRemove(status.modifiers)) return true;
    removed++;
    return false;
  });
  const modifiers = state.modifiers.filter((modifier) => {
    if (removed >= limit || !shouldRemove([modifier.modifier])) return true;
    removed++;
    return false;
  });
  const controls =
    polarity === 'debuff' && removed < limit
      ? state.controls.filter(() => {
          if (removed >= limit) return true;
          removed++;
          return false;
        })
      : state.controls;
  return { ...state, statuses, modifiers, controls };
}

export function statusScalingMultiplier(
  state: SkillCombatState,
  effect: Extract<SkillEffect, { kind: 'damage' }>,
): number {
  if (!effect.statusScaling) return 1;
  if (!effect.statusScaling.statusTarget) {
    throw new Error('[配置错误] statusScaling 必须显式声明 statusTarget');
  }
  return (
    1 +
    skillStatusStacks(state, effect.statusScaling.statusId) *
      effect.statusScaling.damageRatioPerStack
  );
}

export function consumeDamageScalingStatus(
  state: SkillCombatState,
  effect: Extract<SkillEffect, { kind: 'damage' }>,
): SkillCombatState {
  const scaling = effect.statusScaling;
  if (!scaling || scaling.consume === 'none') return state;
  return consumeSkillStatus(state, scaling.statusId, scaling.consume);
}

function collectPermanentTriggers(
  effects: readonly SkillEffect[],
  skillLevel: number,
  sourceSkillId: string,
  out: RuntimeSkillTrigger[],
  outerCondition?: Extract<SkillEffect, { kind: 'conditional' }>['when'],
): void {
  for (const effect of effects) {
    if (effect.kind === 'trigger') {
      out.push({
        trigger: outerCondition && !effect.when ? { ...effect, when: outerCondition } : effect,
        skillLevel,
        sourceSkillId,
        expiresAtMs: null,
        remainingTriggers: effect.maxTriggers ?? null,
      });
    } else if (effect.kind === 'conditional') {
      if (outerCondition) {
        throw new Error(`[配置错误] 被动触发器不支持嵌套多层条件：${sourceSkillId}`);
      }
      collectPermanentTriggers(effect.effects, skillLevel, sourceSkillId, out, effect.when);
    }
  }
}

function collectModifierEffects(
  effects: readonly SkillEffect[],
  skillLevel: number,
  context: SkillConditionContext,
  totals: SkillModifierTotals,
): void {
  for (const effect of effects) {
    if (effect.kind === 'modifier' && effect.durationSec === undefined) {
      addModifier(totals, effect.modifier, skillLevel, 1);
    } else if (effect.kind === 'conditional' && conditionSatisfied(effect.when, context)) {
      collectModifierEffects(effect.effects, skillLevel, context, totals);
    }
  }
}

function addModifier(
  totals: SkillModifierTotals,
  modifier: SkillStatModifier,
  skillLevel: number,
  stackMultiplier: number,
): void {
  if (modifier.unit === 'flat') {
    totals.flat[modifier.stat] += levelScalarAt(modifier.amount, skillLevel) * stackMultiplier;
    return;
  }
  if (modifier.unit === 'percentage-points') {
    const value = levelScalarAt(modifier.points, skillLevel) * stackMultiplier;
    switch (modifier.stat) {
      case 'critRate':
        totals.critRatePoints += value;
        return;
      case 'critDmg':
        totals.critDmgPoints += value;
        return;
      case 'hitChance':
        totals.hitChancePoints += value;
        return;
      case 'dodgeChance':
        totals.dodgeChancePoints += value;
        return;
      case 'defenseIgnore':
        totals.defenseIgnoreRatio += value / 100;
        return;
      case 'lifesteal':
        totals.lifestealPoints += value;
        return;
    }
  }
  const value = levelScalarAt(modifier.ratio, skillLevel) * stackMultiplier;
  switch (modifier.stat) {
    case 'atk':
    case 'def':
    case 'hp':
    case 'acc':
    case 'eva':
    case 'spd':
      totals.ratio[modifier.stat] += value;
      break;
    case 'armorPenetration':
      totals.defenseIgnoreRatio += value;
      break;
    case 'damageDone':
      totals.damageDoneRatio += value;
      break;
    case 'damageTaken':
      totals.damageTakenRatio += value;
      break;
    case 'damageTakenFromSource':
      totals.damageTakenFromSourceRatio += value;
      break;
    case 'dotDamage':
      totals.dotDamageRatio += value;
      break;
  }
}

function applyModifierTotals(stats: Stats, totals: SkillModifierTotals): Stats {
  return {
    atk: (stats.atk + totals.flat.atk) * Math.max(0, 1 + totals.ratio.atk),
    def: (stats.def + totals.flat.def) * Math.max(0, 1 + totals.ratio.def),
    hp: (stats.hp + totals.flat.hp) * Math.max(0, 1 + totals.ratio.hp),
    acc: (stats.acc + totals.flat.acc) * Math.max(0, 1 + totals.ratio.acc),
    eva: (stats.eva + totals.flat.eva) * Math.max(0, 1 + totals.ratio.eva),
    critRate: stats.critRate + totals.critRatePoints,
    critDmg: stats.critDmg + totals.critDmgPoints,
    spd: (stats.spd + totals.flat.spd) * Math.max(0.01, 1 + totals.ratio.spd),
  };
}

function zeroSkillModifierTotals(): SkillModifierTotals {
  return {
    flat: { atk: 0, def: 0, hp: 0, acc: 0, eva: 0, critRate: 0, critDmg: 0, spd: 0 },
    ratio: { atk: 0, def: 0, hp: 0, acc: 0, eva: 0, spd: 0 },
    critRatePoints: 0,
    critDmgPoints: 0,
    hitChancePoints: 0,
    dodgeChancePoints: 0,
    defenseIgnoreRatio: 0,
    lifestealPoints: 0,
    damageDoneRatio: 0,
    damageTakenRatio: 0,
    damageTakenFromSourceRatio: 0,
    dotDamageRatio: 0,
  };
}

function modifierSign(modifier: SkillStatModifier): number {
  if (modifier.unit === 'flat') return Math.sign(modifier.amount.base);
  if (modifier.unit === 'ratio') return Math.sign(modifier.ratio.base);
  return Math.sign(modifier.points.base);
}

function validateSkillCombatKit(kit: SkillCombatKit): void {
  createSkillCooldownState(kit.active);
  const ids = new Set<string>();
  for (const entry of [...kit.active, ...kit.passives]) {
    if (ids.has(entry.skill.id)) throw new Error(`技能配置重复：${entry.skill.id}`);
    ids.add(entry.skill.id);
    levelScalarAt({ base: 0 }, entry.level);
  }
  for (const summon of kit.summons ?? []) validateSummon(summon);
  if (
    kit.skillDamageBonusRatio !== undefined &&
    (!Number.isFinite(kit.skillDamageBonusRatio) || kit.skillDamageBonusRatio < 0)
  ) {
    throw new Error(`技能伤害加成非法：${kit.skillDamageBonusRatio}`);
  }
}

function validateSummon(summon: SkillSummonDefinition): void {
  if (!summon.id) throw new Error('召唤物 id 不能为空');
  if (!Number.isFinite(summon.attackMultiplier) || summon.attackMultiplier <= 0) {
    throw new Error(`召唤物攻击倍率非法：${summon.id}`);
  }
  if (summon.damageable) {
    for (const [label, value] of [
      ['maxHpRatio', summon.maxHpRatio],
      ['defenseRatio', summon.defenseRatio],
      ['targetWeight', summon.targetWeight],
    ] as const) {
      if (!Number.isFinite(value) || value! <= 0) {
        throw new Error(`可受击召唤物 ${label} 必须为正数：${summon.id}`);
      }
    }
  }
  if (
    summon.maxConcurrent !== undefined &&
    (!Number.isSafeInteger(summon.maxConcurrent) || summon.maxConcurrent < 1)
  ) {
    throw new Error(`召唤物 maxConcurrent 非法：${summon.id}`);
  }
  summonIntervalMs(summon);
}

function summonIntervalMs(summon: SkillSummonDefinition): number {
  if (!Number.isFinite(summon.attackIntervalSec) || summon.attackIntervalSec < 0.1) {
    throw new Error(`召唤物攻击间隔必须 >=0.1 秒：${summon.id}`);
  }
  const intervalMs = summon.attackIntervalSec * 1_000;
  if (!Number.isSafeInteger(intervalMs)) {
    throw new Error(`召唤物攻击间隔必须能精确换算为整数毫秒：${summon.id}`);
  }
  return intervalMs;
}

function secondsToMs(seconds: number, label: string): number {
  assertPositiveDuration(seconds, label);
  const milliseconds = seconds * 1_000;
  if (!Number.isSafeInteger(milliseconds)) {
    throw new Error(`${label} 必须能精确换算为整数毫秒：${seconds}`);
  }
  return milliseconds;
}

function assertPositiveDuration(seconds: number, label: string): void {
  if (!Number.isFinite(seconds) || seconds <= 0) throw new Error(`${label} 持续时间非法：${seconds}`);
}

function assertElapsedMs(elapsedMs: number): void {
  if (!Number.isSafeInteger(elapsedMs) || elapsedMs < 0) {
    throw new Error(`战斗时点必须是非负安全整数毫秒：${elapsedMs}`);
  }
}
