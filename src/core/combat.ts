/**
 * 战斗模拟。
 *
 * 提供两种精度：
 *   - simulateFight：逐次攻击掷骰，用于真实战斗和测试
 *   - estimateDps：期望值计算，用于挂机产出估算（快几个数量级）
 *
 * 挂机游戏里 99% 的战斗结算走 estimateDps，
 * 只有玩家正在看的那一场才需要 simulateFight。
 */

import type {
  Combatant,
  CombatResult,
  MonsterType,
  SkillEffect,
  SkillTarget,
} from './types';
import { Rng } from './rng';
import {
  adjustedHitChance,
  calcConfirmedElementalDamage,
  calcDamage,
  calcPeriodicDamage,
  expectedConfirmedElementalDamage,
  expectedDamage,
  type DamageFormulaOptions,
} from './formula';
import {
  damageHitMultipliers,
  conditionSatisfied,
  levelScalarAt,
  type SkillConditionContext,
} from './skills';
import {
  absorbDamageWithSkillShields,
  addSkillAvoidance,
  addSkillControl,
  addSkillShield,
  addSkillSummon,
  addTimedSkillModifier,
  applySkillStatus,
  consumeDamageScalingStatus,
  consumeSkillAvoidance,
  consumeSkillStatus,
  createSkillCombatState,
  dispatchSkillTriggers,
  dispelSkillState,
  effectiveSkillCombatant,
  expireSkillCombatState,
  registerRuntimeTrigger,
  runtimeSummon,
  selectWeightedSummonTarget,
  selectSkillForAction,
  skillConditionContext,
  skillControlBlockUntil,
  skillSlowRatio,
  statusScalingMultiplier,
  takeDueSummonAttacks,
  updateRuntimeSummon,
  type SkillCombatKit,
  type SkillCombatState,
} from './skillCombat';
import {
  assertOnCritPeriodicDamageTrigger,
  assertOnLethalRecoveryTrigger,
  assertOnHitElementalDamageTrigger,
  type OnCritPeriodicDamageTrigger,
  type OnLethalRecoveryTrigger,
  type OnHitElementalDamageTrigger,
} from './equipmentSets';
import {
  advancePeriodicDamage,
  applyPeriodicDamage,
  createPeriodicDamageState,
  type PeriodicDamageState,
  type PeriodicDamageTick,
} from './combatStatus';
import { IDLE_FREE_DAMAGE_RATIO, IDLE_SUSTAIN_HINT_EFFICIENCY } from '@/data/constants';

/** 单场战斗的时间上限（秒），防止打不动时死循环 */
const MAX_FIGHT_SECONDS = 300;
/** 挂机技能轮转取两个完整 60 秒长冷却周期，兼顾稳态精度与前台计算成本。 */
const SKILL_ESTIMATE_SECONDS = 120;

/** 模拟步长（秒）。0.1 秒足够精确，且 300 秒战斗只要 3000 步。 */
const TICK = 0.1;
const TICK_MS = 100;
const EMPTY_SKILL_KIT: SkillCombatKit = { active: [], passives: [] };

interface FightOptionsCommon {
  /** 玩家技能条件看到的目标类型。 */
  playerTargetType?: MonsterType;
  /** 怪物 / PvP 对手技能条件看到的目标类型。 */
  monsterTargetType?: MonsterType;
  /** 玩家每个直接伤害段命中后独立判定的触发。 */
  playerOnHitTriggers?: readonly OnHitElementalDamageTrigger[];
  /** 为未来怪物机制预留的同一逐击接口。 */
  monsterOnHitTriggers?: readonly OnHitElementalDamageTrigger[];
  /** 玩家受到致命伤害时可触发的每场战斗防护。 */
  playerOnLethalTriggers?: readonly OnLethalRecoveryTrigger[];
  /** 怪物受到致命伤害时可触发的同一接口。 */
  monsterOnLethalTriggers?: readonly OnLethalRecoveryTrigger[];
  /** 玩家每个直接暴击独立触发的回复与持续伤害。 */
  playerOnCritTriggers?: readonly OnCritPeriodicDamageTrigger[];
  /** 怪物侧同一真实暴击接口。 */
  monsterOnCritTriggers?: readonly OnCritPeriodicDamageTrigger[];
  /** 时间上限 */
  maxSeconds?: number;
  /** 挂机轮转估算专用：目标死亡后以同一满血模板继续，技能冷却不重置。 */
  repeatTargetOnDefeat?: boolean;
}

type PlayerSkillSource =
  | {
      /** 玩家真实技能栏；与旧平均倍率严格互斥。 */
      playerSkillKit: SkillCombatKit;
      playerSkillMultiplier?: never;
    }
  | {
      /** 玩家旧平均技能倍率；仅供尚未迁移的兼容调用。 */
      playerSkillMultiplier?: number;
      playerSkillKit?: never;
    };

type MonsterSkillSource =
  | {
      /** PvP 防守方等可使用同一真实技能栏；与旧平均倍率严格互斥。 */
      monsterSkillKit: SkillCombatKit;
      monsterSkillMultiplier?: never;
    }
  | {
      /** 怪物旧平均技能倍率；仅供尚未迁移的兼容调用。 */
      monsterSkillMultiplier?: number;
      monsterSkillKit?: never;
    };

export type FightOptions = FightOptionsCommon & PlayerSkillSource & MonsterSkillSource;

export interface DirectDamageSegmentEvent {
  kind: 'direct-damage';
  damage: number;
  hit: boolean;
  crit: boolean;
  element: Combatant['element'];
  skillId?: string;
  hitIndex?: number;
  hitCount?: number;
}

export interface OnHitElementalDamageEvent {
  kind: 'on-hit-elemental-damage';
  damage: number;
  triggerId: string;
  element: Combatant['element'];
}

export type DamageSegmentEvent = DirectDamageSegmentEvent | OnHitElementalDamageEvent;

export interface LethalRecoveryEvent {
  kind: 'lethal-recovery';
  /** 回复事件本身不造成伤害，保留字段让通用时间线可直接累计伤害。 */
  damage: 0;
  healing: number;
  triggerId: string;
}

export interface OnCritRecoveryEvent {
  kind: 'on-crit-recovery';
  damage: 0;
  healing: number;
  triggerId: string;
}

export interface PeriodicDamageEvent {
  kind: 'periodic-damage';
  damage: number;
  hit: true;
  crit: false;
  element: Combatant['element'];
  triggerId: string;
  statusId: string;
  stacks: number;
}

export type RecoveryEvent = LethalRecoveryEvent | OnCritRecoveryEvent;

export interface DamageSegmentResolution {
  direct: DirectDamageSegmentEvent;
  /** 顺序固定为直接伤害、随后各个已触发追加段；视觉只能消费这些结算事件。 */
  events: readonly DamageSegmentEvent[];
}

export interface CombatTimelineEvent {
  sequence: number;
  source: 'player' | 'monster';
  target: 'player' | 'monster';
  /** 目标方的可受击召唤物；未填写表示命中角色本人。 */
  targetSummonId?: string;
  event: DamageSegmentEvent | RecoveryEvent | PeriodicDamageEvent;
}

export interface SimulatedFightResult extends CombatResult {
  /** 已按目标剩余生命截断为实际伤害，可直接供表现层消费。 */
  events: readonly CombatTimelineEvent[];
  /** 被动生命修正后的真实战斗上限；没有技能栏时等于 Combatant.stats.hp。 */
  playerMaxHp: number;
  monsterMaxHp: number;
  /** 未受当前生命缺口截断的真实吸血潜力；挂机承伤模型直接读取。 */
  lifestealPotential: number;
}

export interface CombatEstimateOptions {
  playerOnHitTriggers?: readonly OnHitElementalDamageTrigger[];
  monsterOnHitTriggers?: readonly OnHitElementalDamageTrigger[];
  playerSkillKit?: SkillCombatKit;
  playerTargetType?: MonsterType;
}

/**
 * 解析一个直接伤害段。
 *
 * 一次调用严格代表一段伤害，而不是一次技能。直接段未命中时不触发；命中后每个
 * 触发器独立使用 seeded RNG。追加段不会再次进入本函数，因此不会递归。
 */
export function resolveDamageSegment(
  attacker: Combatant,
  defender: Combatant,
  skillMultiplier: number,
  rng: Rng,
  onHitTriggers: readonly OnHitElementalDamageTrigger[] = [],
  formulaOptions: DamageFormulaOptions = {},
  onHitFormulaOptions: DamageFormulaOptions = formulaOptions,
): DamageSegmentResolution {
  for (const trigger of onHitTriggers) {
    assertOnHitElementalDamageTrigger(trigger);
  }
  const directResult = calcDamage(attacker, defender, skillMultiplier, rng, formulaOptions);
  const direct: DirectDamageSegmentEvent = {
    kind: 'direct-damage',
    damage: directResult.damage,
    hit: directResult.hit,
    crit: directResult.crit,
    element: formulaOptions.element ?? attacker.element,
  };
  const events: DamageSegmentEvent[] = [direct];
  if (!direct.hit) return { direct, events };

  for (const trigger of onHitTriggers) {
    if (!rng.chance(trigger.chance)) continue;
    events.push({
      kind: 'on-hit-elemental-damage',
      triggerId: trigger.id,
      element: trigger.element,
      damage: calcConfirmedElementalDamage(
        attacker,
        defender,
        trigger.atkMultiplier,
        trigger.element,
        rng,
        onHitFormulaOptions,
      ),
    });
  }
  return { direct, events };
}

/** resolveDamageSegment 的无随机期望值；挂机与逐击战斗共享相同触发定义与伤害公式。 */
export function expectedDamageSegment(
  attacker: Combatant,
  defender: Combatant,
  skillMultiplier: number,
  onHitTriggers: readonly OnHitElementalDamageTrigger[] = [],
  formulaOptions: DamageFormulaOptions = {},
): number {
  let total = expectedDamage(attacker, defender, skillMultiplier, formulaOptions);
  const directHitChance = adjustedHitChance(attacker, defender, formulaOptions);
  for (const trigger of onHitTriggers) {
    assertOnHitElementalDamageTrigger(trigger);
    total +=
      directHitChance *
      trigger.chance *
      expectedConfirmedElementalDamage(
        attacker,
        defender,
        trigger.atkMultiplier,
        trigger.element,
        formulaOptions,
      );
  }
  return total;
}

/**
 * 模拟一场 1v1 战斗，直到一方倒下或超时。
 *
 * 注意：会修改传入 Combatant 的 currentHp。调用方如需保留原状态请自行拷贝。
 */
export function simulateFight(
  player: Combatant,
  monster: Combatant,
  rng: Rng,
  opts: FightOptions = {},
): SimulatedFightResult {
  // 类型在编译期阻止双传；运行时检查同时保护 Edge / JS 调用与反序列化边界。
  if (opts.playerSkillKit && opts.playerSkillMultiplier !== undefined) {
    throw new Error('[战斗技能来源错误] 玩家真实技能栏与旧平均倍率不能同时传入');
  }
  if (opts.monsterSkillKit && opts.monsterSkillMultiplier !== undefined) {
    throw new Error('[战斗技能来源错误] 怪物真实技能栏与旧平均倍率不能同时传入');
  }
  const pMul = opts.playerSkillMultiplier ?? 1.0;
  const mMul = opts.monsterSkillMultiplier ?? 1.0;
  const maxSeconds = opts.maxSeconds ?? MAX_FIGHT_SECONDS;

  // 用整数计步再乘 TICK，而不是累加浮点数。
  // 累加 0.1 会有浮点漂移：加 50 次得到 4.999999999999998，
  // 导致战斗多跑一帧、时间上限失准。
  let ticks = 0;
  const maxTicks = Math.ceil(maxSeconds / TICK);

  let playerCd = 0;
  let monsterCd = 0;
  let damageDealt = 0;
  let damageTaken = 0;
  let lifestealPotential = 0;
  let kills = 0;
  const events: CombatTimelineEvent[] = [];
  const playerLethalUses = createLethalTriggerUses(opts.playerOnLethalTriggers);
  let monsterLethalUses = createLethalTriggerUses(opts.monsterOnLethalTriggers);
  let playerPeriodicDamage = createPeriodicDamageState();
  let monsterPeriodicDamage = createPeriodicDamageState();
  let playerSkillState = createSkillCombatState(opts.playerSkillKit ?? EMPTY_SKILL_KIT);
  let monsterSkillState = createSkillCombatState(opts.monsterSkillKit ?? EMPTY_SKILL_KIT);

  const initialPlayerContext: SkillConditionContext = {
    selfHpRatio: 1,
    targetHpRatio: 1,
    monsterType: opts.playerTargetType ?? 'normal',
    statusStacks: {},
  };
  const initialMonsterContext: SkillConditionContext = {
    selfHpRatio: 1,
    targetHpRatio: 1,
    monsterType: opts.monsterTargetType ?? 'normal',
    statusStacks: {},
  };
  const playerMaxHp = effectiveSkillCombatant(
    player,
    opts.playerSkillKit,
    playerSkillState,
    initialPlayerContext,
  ).combatant.stats.hp;
  const monsterMaxHp = effectiveSkillCombatant(
    monster,
    opts.monsterSkillKit,
    monsterSkillState,
    initialMonsterContext,
  ).combatant.stats.hp;
  if (opts.playerSkillKit && player.currentHp === player.stats.hp) player.currentHp = playerMaxHp;
  if (opts.monsterSkillKit && monster.currentHp === monster.stats.hp) monster.currentHp = monsterMaxHp;

  for (const trigger of opts.playerOnCritTriggers ?? []) {
    assertOnCritPeriodicDamageTrigger(trigger);
  }
  for (const trigger of opts.monsterOnCritTriggers ?? []) {
    assertOnCritPeriodicDamageTrigger(trigger);
  }

  const contextFor = (
    source: 'player' | 'monster',
    primarySummonId?: string,
  ): SkillConditionContext => {
    const targetSide = source === 'player' ? 'monster' : 'player';
    const targetSummon = primarySummonId
      ? runtimeSummon(
          targetSide === 'player' ? playerSkillState : monsterSkillState,
          primarySummonId,
        )
      : undefined;
    const target = targetSummon ? summonCombatantFor(targetSummon) : combatantOf(targetSide);
    const targetMaxHp = targetSummon ? targetSummon.maxHp : maxHpOf(targetSide);
    const targetState = targetSummon
      ? targetSummon.skillState
      : targetSide === 'player'
        ? playerSkillState
        : monsterSkillState;
    return skillConditionContext(
      combatantOf(source),
      maxHpOf(source),
      target,
      targetMaxHp,
      source === 'player'
        ? opts.playerTargetType ?? 'normal'
        : opts.monsterTargetType ?? 'normal',
      source === 'player' ? playerSkillState : monsterSkillState,
      targetState,
    );
  };

  const viewsFor = (source: 'player' | 'monster', primarySummonId?: string) => {
    const sourceContext = contextFor(source, primarySummonId);
    const targetContext = contextFor(source === 'player' ? 'monster' : 'player');
    if (source === 'player') {
      return {
        attacker: effectiveSkillCombatant(
          player,
          opts.playerSkillKit,
          playerSkillState,
          sourceContext,
        ),
        defender: effectiveSkillCombatant(
          monster,
          opts.monsterSkillKit,
          monsterSkillState,
          targetContext,
          'player',
        ),
      };
    }
    return {
      attacker: effectiveSkillCombatant(
        monster,
        opts.monsterSkillKit,
        monsterSkillState,
        sourceContext,
      ),
      defender: effectiveSkillCombatant(
        player,
        opts.playerSkillKit,
        playerSkillState,
        targetContext,
        'monster',
      ),
    };
  };

  const setSkillState = (source: 'player' | 'monster', state: SkillCombatState): void => {
    if (source === 'player') playerSkillState = state;
    else monsterSkillState = state;
  };
  const getSkillState = (source: 'player' | 'monster'): SkillCombatState =>
    source === 'player' ? playerSkillState : monsterSkillState;
  const combatantOf = (source: 'player' | 'monster'): Combatant =>
    source === 'player' ? player : monster;
  const maxHpOf = (source: 'player' | 'monster'): number =>
    source === 'player' ? playerMaxHp : monsterMaxHp;
  const kitOf = (source: 'player' | 'monster'): SkillCombatKit | undefined =>
    source === 'player' ? opts.playerSkillKit : opts.monsterSkillKit;
  const opposite = (source: 'player' | 'monster'): 'player' | 'monster' =>
    source === 'player' ? 'monster' : 'player';

  interface CastProgress {
    hitTarget: boolean;
    hitAny: boolean;
    hitSummonIds: Set<string>;
    primarySummonId?: string;
  }

  interface CombatUnitRef {
    side: 'player' | 'monster';
    summonId?: string;
  }

  const summonCombatantFor = (summon: NonNullable<ReturnType<typeof runtimeSummon>>): Combatant => ({
    name: summon.definition.id,
    level: 1,
    element: 'none',
    stats: {
      atk: 0,
      def: summon.defense,
      hp: summon.maxHp,
      acc: 0,
      eva: 0,
      critRate: 0,
      critDmg: 0,
      spd: 0.01,
    },
    currentHp: summon.currentHp,
  });

  const unitState = (ref: CombatUnitRef): SkillCombatState => {
    if (!ref.summonId) return getSkillState(ref.side);
    const summon = runtimeSummon(getSkillState(ref.side), ref.summonId);
    if (!summon) throw new Error(`[战斗状态错误] 找不到存活召唤物：${ref.summonId}`);
    return summon.skillState;
  };

  const setUnitState = (ref: CombatUnitRef, state: SkillCombatState): void => {
    if (!ref.summonId) {
      setSkillState(ref.side, state);
      return;
    }
    setSkillState(
      ref.side,
      updateRuntimeSummon(getSkillState(ref.side), ref.summonId, (summon) => ({
        ...summon,
        skillState: state,
      })),
    );
  };

  const unitHpRatio = (ref: CombatUnitRef): number => {
    if (!ref.summonId) {
      return combatantOf(ref.side).currentHp / Math.max(1, maxHpOf(ref.side));
    }
    const summon = runtimeSummon(getSkillState(ref.side), ref.summonId);
    return summon ? summon.currentHp / Math.max(1, summon.maxHp) : 0;
  };

  const unitCombatant = (ref: CombatUnitRef): Combatant => {
    if (!ref.summonId) return combatantOf(ref.side);
    const summon = runtimeSummon(getSkillState(ref.side), ref.summonId);
    if (!summon) throw new Error(`[战斗状态错误] 找不到存活召唤物：${ref.summonId}`);
    const combatant = summonCombatantFor(summon);
    combatant.level = combatantOf(ref.side).level;
    return combatant;
  };

  const unitMaxHp = (ref: CombatUnitRef): number => {
    if (!ref.summonId) return maxHpOf(ref.side);
    return runtimeSummon(getSkillState(ref.side), ref.summonId)?.maxHp ?? 0;
  };

  const setUnitHp = (ref: CombatUnitRef, currentHp: number): void => {
    if (!ref.summonId) {
      combatantOf(ref.side).currentHp = currentHp;
      return;
    }
    setSkillState(
      ref.side,
      updateRuntimeSummon(getSkillState(ref.side), ref.summonId, (summon) => ({
        ...summon,
        currentHp,
      })),
    );
  };

  const liveSummonRefs = (
    side: 'player' | 'monster',
    damageableOnly = false,
  ): CombatUnitRef[] =>
    getSkillState(side).summons
      .filter(
        (summon) =>
          summon.currentHp > 0 && (!damageableOnly || summon.definition.damageable === true),
      )
      .map((summon) => ({ side, summonId: summon.definition.id }));

  const lowestHpSummonTarget = (side: 'player' | 'monster'): string | undefined => {
    let lowestHp = combatantOf(side).currentHp;
    let summonId: string | undefined;
    for (const summon of getSkillState(side).summons) {
      if (
        summon.definition.damageable === true &&
        summon.currentHp > 0 &&
        summon.currentHp < lowestHp
      ) {
        lowestHp = summon.currentHp;
        summonId = summon.definition.id;
      }
    }
    return summonId;
  };

  const effectTargets = (
    source: 'player' | 'monster',
    targetSpec: SkillTarget,
    cast: CastProgress,
    eventSource?: 'player' | 'monster',
  ): CombatUnitRef[] => {
    const enemy = opposite(source);
    switch (targetSpec.kind) {
      case 'self':
        return [{ side: source }];
      case 'all-allies':
        return [{ side: source }, ...liveSummonRefs(source)];
      case 'event-source':
        return [{ side: eventSource ?? enemy }];
      case 'hit-enemies':
        return [
          ...(cast.hitTarget ? [{ side: enemy } satisfies CombatUnitRef] : []),
          ...[...cast.hitSummonIds]
            .filter((summonId) => runtimeSummon(getSkillState(enemy), summonId))
            .map((summonId) => ({ side: enemy, summonId })),
        ];
      case 'primary-enemy':
        if (!cast.primarySummonId) return [{ side: enemy }];
        return runtimeSummon(getSkillState(enemy), cast.primarySummonId)
          ? [{ side: enemy, summonId: cast.primarySummonId }]
          : [];
      case 'enemies': {
        const targets = [
          { side: enemy } satisfies CombatUnitRef,
          ...liveSummonRefs(enemy, true),
        ];
        return targetSpec.count === 'all' ? targets : targets.slice(0, targetSpec.count);
      }
    }
  };

  const formulaOptionsFor = (
    source: 'player' | 'monster',
    effect: Extract<SkillEffect, { kind: 'damage' }> | null,
    skillDamage: boolean,
    element?: Combatant['element'],
    primarySummonId?: string,
  ): DamageFormulaOptions => {
    const views = viewsFor(source, primarySummonId);
    const kit = kitOf(source);
    const skillBonus = skillDamage
      ? (views.attacker.combatant.combatBonuses?.skillDamage ?? 0) / 100 +
        (kit?.skillDamageBonusRatio ?? 0)
      : 0;
    return {
      ...(element ? { element } : {}),
      defenseIgnoreRatio:
        (effect?.defenseIgnoreRatio ?? 0) + views.attacker.modifiers.defenseIgnoreRatio,
      damageDoneRatio: views.attacker.modifiers.damageDoneRatio + skillBonus,
      damageTakenRatio: views.defender.modifiers.damageTakenRatio,
      damageTakenFromSourceRatio: views.defender.modifiers.damageTakenFromSourceRatio,
      hitChancePoints: views.attacker.modifiers.hitChancePoints,
      dodgeChancePoints: views.defender.modifiers.dodgeChancePoints,
      dotDamageRatio: views.attacker.modifiers.dotDamageRatio,
    };
  };

  const absorbResolution = (
    target: 'player' | 'monster',
    resolution: DamageSegmentResolution,
  ): DamageSegmentResolution => {
    let state = getSkillState(target);
    const absorbedEvents = resolution.events.map((event) => {
      const absorbed = absorbDamageWithSkillShields(state, event.damage);
      state = absorbed.state;
      return { ...event, damage: absorbed.hpDamage };
    });
    setSkillState(target, state);
    return {
      direct: absorbedEvents[0] as DirectDamageSegmentEvent,
      events: absorbedEvents,
    };
  };

  const dispatchRuntimeEvent = (
    owner: 'player' | 'monster',
    target: 'player' | 'monster',
    event: Parameters<typeof dispatchSkillTriggers>[1],
    cast: CastProgress,
    eventSource?: 'player' | 'monster',
    triggerDamage = 0,
  ): void => {
    const primarySummonId =
      cast.primarySummonId && runtimeSummon(getSkillState(target), cast.primarySummonId)
        ? cast.primarySummonId
        : undefined;
    const dispatched = dispatchSkillTriggers(
      getSkillState(owner),
      event,
      contextFor(owner, primarySummonId),
      rng,
    );
    setSkillState(owner, dispatched.state);
    for (const triggered of dispatched.effects) {
      executeEffect(
        owner,
        target,
        triggered.effect,
        triggered.skillLevel,
        triggered.sourceSkillId,
        cast,
        eventSource,
        false,
        triggerDamage,
      );
    }
  };

  const applyDirectResolution = (
    source: 'player' | 'monster',
    rawResolution: DamageSegmentResolution,
    cast: CastProgress,
    skillId?: string,
    hitIndex?: number,
    hitCount?: number,
    allowTriggers = true,
  ): { damage: number; directCrit: boolean; lifestealPotential: number } => {
    const target = opposite(source);
    const decorated: DamageSegmentResolution = {
      direct: { ...rawResolution.direct, ...(skillId ? { skillId, hitIndex, hitCount } : {}) },
      events: rawResolution.events.map((event, index) =>
        index === 0 && event.kind === 'direct-damage'
          ? { ...event, ...(skillId ? { skillId, hitIndex, hitCount } : {}) }
          : event,
      ),
    };
    const resolution = absorbResolution(target, decorated);
    const sourceView = viewsFor(source).attacker.combatant;
    sourceView.currentHp = combatantOf(source).currentHp;
    const applied = applyDamageSegment(
      sourceView,
      combatantOf(target),
      resolution,
      source,
      events,
      target === 'player' ? opts.playerOnLethalTriggers : opts.monsterOnLethalTriggers,
      target === 'player' ? playerLethalUses : monsterLethalUses,
    );
    combatantOf(source).currentHp = sourceView.currentHp;
    if (resolution.direct.hit) {
      cast.hitTarget = true;
      cast.hitAny = true;
    }
    if (allowTriggers) {
      if (resolution.direct.hit) {
        dispatchRuntimeEvent(source, target, 'on-hit', cast);
        if (resolution.direct.crit) dispatchRuntimeEvent(source, target, 'on-crit', cast);
      } else {
        dispatchRuntimeEvent(target, source, 'on-dodge', cast, source);
      }
      if (applied.damage > 0) {
        dispatchRuntimeEvent(target, source, 'on-damage-taken', cast, source, applied.damage);
        dispatchRuntimeEvent(target, source, 'on-low-hp', cast, source);
      }
    }
    return applied;
  };

  const resolveDirectDamage = (
    source: 'player' | 'monster',
    multiplier: number,
    formulaOptions: DamageFormulaOptions,
    cast: CastProgress,
    skillId?: string,
    hitIndex?: number,
    hitCount?: number,
    allowTriggers = true,
    onHitFormulaOptions: DamageFormulaOptions = formulaOptions,
    targetSummonId?: string,
  ): {
    damage: number;
    directCrit: boolean;
    lifestealPotential: number;
    targetSummonId?: string;
  } => {
    const target = opposite(source);
    const resolvedTargetSummonId = targetSummonId
    const targetSummon = resolvedTargetSummonId
      ? runtimeSummon(getSkillState(target), resolvedTargetSummonId)
      : undefined;
    if (targetSummon) {
      let summonState = targetSummon.skillState;
      const avoidance = consumeSkillAvoidance(summonState);
      summonState = avoidance.state;
      const summonCombatant = summonCombatantFor(targetSummon);
      summonCombatant.level = combatantOf(target).level;
      const sourceView = viewsFor(source, resolvedTargetSummonId).attacker.combatant;
      sourceView.currentHp = combatantOf(source).currentHp;
      const summonContext = skillConditionContext(
        summonCombatant,
        targetSummon.maxHp,
        sourceView,
        maxHpOf(source),
        'normal',
        summonState,
        getSkillState(source),
      );
      const summonView = effectiveSkillCombatant(
        summonCombatant,
        undefined,
        summonState,
        summonContext,
        source,
      );
      const summonFormulaOptions: DamageFormulaOptions = {
        ...formulaOptions,
        damageTakenRatio: summonView.modifiers.damageTakenRatio,
        damageTakenFromSourceRatio: summonView.modifiers.damageTakenFromSourceRatio,
        dodgeChancePoints: summonView.modifiers.dodgeChancePoints,
      };
      const raw: DamageSegmentResolution = avoidance.avoided
        ? {
            direct: {
              kind: 'direct-damage',
              damage: 0,
              hit: false,
              crit: false,
              element: summonFormulaOptions.element ?? sourceView.element,
            },
            events: [
              {
                kind: 'direct-damage',
                damage: 0,
                hit: false,
                crit: false,
                element: summonFormulaOptions.element ?? sourceView.element,
              },
            ],
          }
        : resolveDamageSegment(
            sourceView,
            summonView.combatant,
            multiplier,
            rng,
            source === 'player' ? opts.playerOnHitTriggers : opts.monsterOnHitTriggers,
            summonFormulaOptions,
            onHitFormulaOptions,
          );
      const shieldedEvents = raw.events.map((event) => {
        const shielded = absorbDamageWithSkillShields(summonState, event.damage);
        summonState = shielded.state;
        return { ...event, damage: shielded.hpDamage };
      });
      const resolution: DamageSegmentResolution = {
        direct: {
          ...(shieldedEvents[0] as DirectDamageSegmentEvent),
          ...(skillId ? { skillId, hitIndex, hitCount } : {}),
        },
        events: shieldedEvents.map((event, index) =>
          index === 0 && event.kind === 'direct-damage'
            ? { ...event, ...(skillId ? { skillId, hitIndex, hitCount } : {}) }
            : event,
        ),
      };
      const timelineStart = events.length;
      const applied = applyDamageSegment(
        sourceView,
        summonCombatant,
        resolution,
        source,
        events,
      );
      combatantOf(source).currentHp = sourceView.currentHp;
      lifestealPotential += applied.lifestealPotential;
      for (let index = timelineStart; index < events.length; index++) {
        events[index] = { ...events[index]!, targetSummonId: resolvedTargetSummonId };
      }
      setSkillState(
        target,
        updateRuntimeSummon(getSkillState(target), resolvedTargetSummonId!, (summon) => ({
          ...summon,
          currentHp: summonCombatant.currentHp,
          skillState: summonState,
        })),
      );
      if (resolution.direct.hit) {
        cast.hitAny = true;
        cast.hitSummonIds.add(resolvedTargetSummonId!);
        if (allowTriggers) {
          dispatchRuntimeEvent(source, target, 'on-hit', cast);
          if (resolution.direct.crit) dispatchRuntimeEvent(source, target, 'on-crit', cast);
        }
      }
      return { ...applied, targetSummonId: resolvedTargetSummonId };
    }
    const avoidance = consumeSkillAvoidance(getSkillState(target));
    setSkillState(target, avoidance.state);
    if (avoidance.avoided) {
      const miss: DamageSegmentResolution = {
        direct: {
          kind: 'direct-damage',
          damage: 0,
          hit: false,
          crit: false,
          element: formulaOptions.element ?? combatantOf(source).element,
        },
        events: [
          {
            kind: 'direct-damage',
            damage: 0,
            hit: false,
            crit: false,
            element: formulaOptions.element ?? combatantOf(source).element,
          },
        ],
      };
      return applyDirectResolution(
        source,
        miss,
        cast,
        skillId,
        hitIndex,
        hitCount,
        allowTriggers,
      );
    }
    const views = viewsFor(source);
    const resolution = resolveDamageSegment(
      views.attacker.combatant,
      views.defender.combatant,
      multiplier,
      rng,
      source === 'player' ? opts.playerOnHitTriggers : opts.monsterOnHitTriggers,
      formulaOptions,
      onHitFormulaOptions,
    );
    const applied = applyDirectResolution(
      source,
      resolution,
      cast,
      skillId,
      hitIndex,
      hitCount,
      allowTriggers,
    );
    lifestealPotential += applied.lifestealPotential;
    return applied;
  };

  const applyEquipmentCritTriggers = (
    source: 'player' | 'monster',
    targetRef: CombatUnitRef,
  ): void => {
    const triggers =
      source === 'player' ? opts.playerOnCritTriggers : opts.monsterOnCritTriggers;
    if (!triggers?.length) return;
    const attacker = viewsFor(source, targetRef.summonId).attacker.combatant;
    const formulaOptions = formulaOptionsFor(
      source,
      null,
      false,
      undefined,
      targetRef.summonId,
    );
    attacker.currentHp = combatantOf(source).currentHp;
    if (targetRef.summonId) {
      const summon = runtimeSummon(getSkillState(targetRef.side), targetRef.summonId);
      if (!summon) return;
      const periodicDamage = resolveOnCritTriggers(
        attacker,
        summonCombatantFor(summon),
        triggers,
        source,
        ticks * TICK_MS,
        summon.periodicDamage,
        events,
        formulaOptions,
      );
      combatantOf(source).currentHp = attacker.currentHp;
      setSkillState(
        targetRef.side,
        updateRuntimeSummon(getSkillState(targetRef.side), targetRef.summonId, (current) => ({
          ...current,
          periodicDamage,
        })),
      );
      return;
    }
    if (targetRef.side === 'player') {
      playerPeriodicDamage = resolveOnCritTriggers(
        attacker,
        player,
        triggers,
        source,
        ticks * TICK_MS,
        playerPeriodicDamage,
        events,
        formulaOptions,
      );
    } else {
      monsterPeriodicDamage = resolveOnCritTriggers(
        attacker,
        monster,
        triggers,
        source,
        ticks * TICK_MS,
        monsterPeriodicDamage,
        events,
        formulaOptions,
      );
    }
    combatantOf(source).currentHp = attacker.currentHp;
  };

  function executeEffect(
    source: 'player' | 'monster',
    target: 'player' | 'monster',
    effect: SkillEffect,
    skillLevel: number,
    sourceSkillId: string,
    cast: CastProgress,
    eventSource?: 'player' | 'monster',
    allowTriggers = true,
    triggerDamage = 0,
  ): void {
    switch (effect.kind) {
      case 'damage': {
        if (effect.statusScaling && !effect.statusScaling.statusTarget) {
          throw new Error(`[配置错误] statusScaling 缺少 statusTarget：${sourceSkillId}`);
        }
        const targets = effectTargets(source, effect.target, cast, eventSource).filter(
          (ref) => ref.side !== source || ref.summonId !== undefined,
        );
        if (targets.length === 0) return;
        const selfScalingSnapshot = getSkillState(source);
        const passiveIds = new Set(kitOf(source)?.passives.map(({ skill }) => skill.id) ?? []);
        const execute =
          effect.execute?.upgrade && passiveIds.has(effect.execute.upgrade.passiveSkillId)
            ? effect.execute.upgrade
            : effect.execute;
        const hits = damageHitMultipliers(effect, skillLevel);
        for (const targetRef of targets) {
          if (combatantOf(targetRef.side).currentHp <= 0) break;
          if (targetRef.summonId && !runtimeSummon(getSkillState(targetRef.side), targetRef.summonId)) {
            continue;
          }
          const targetScalingSnapshot = unitState(targetRef);
          const scalingSnapshot =
            effect.statusScaling?.statusTarget === 'self'
              ? selfScalingSnapshot
              : targetScalingSnapshot;
          const scaling = statusScalingMultiplier(scalingSnapshot, effect);
          const executeMultiplier =
            execute && unitHpRatio(targetRef) <= execute.targetHpRatioAtMost
              ? 1 + levelScalarAt(execute.bonusDamageRatio, skillLevel)
              : 1;
          for (const [index, hitMultiplier] of hits.entries()) {
            if (unitHpRatio(targetRef) <= 0) break;
            const applied = resolveDirectDamage(
              source,
              hitMultiplier * scaling * executeMultiplier,
              formulaOptionsFor(source, effect, true, effect.element, targetRef.summonId),
              cast,
              sourceSkillId,
              index + 1,
              hits.length,
              allowTriggers,
              formulaOptionsFor(source, null, false, undefined, targetRef.summonId),
              targetRef.summonId,
            );
            if (source === 'player') damageDealt += applied.damage;
            else damageTaken += applied.damage;
            if (applied.directCrit) applyEquipmentCritTriggers(source, targetRef);
          }
          if (
            effect.statusScaling?.statusTarget === 'damage-target' &&
            (!targetRef.summonId || runtimeSummon(getSkillState(targetRef.side), targetRef.summonId))
          ) {
            setUnitState(
              targetRef,
              consumeDamageScalingStatus(unitState(targetRef), effect),
            );
          }
        }
        if (effect.statusScaling?.statusTarget === 'self') {
          setSkillState(source, consumeDamageScalingStatus(getSkillState(source), effect));
        }
        return;
      }
      case 'periodic-damage': {
        const ticksCount = effect.ticks;
        if (!Number.isSafeInteger(ticksCount) || ticksCount < 1) {
          throw new Error(`[配置错误] 持续伤害跳数非法：${sourceSkillId}`);
        }
        const durationMs = effect.durationSec * 1_000;
        if (!Number.isSafeInteger(durationMs) || durationMs <= 0 || durationMs % ticksCount !== 0) {
          throw new Error(`[配置错误] 持续伤害时长必须按跳数整除：${sourceSkillId}`);
        }
        const attackerView = viewsFor(source).attacker.combatant;
        for (const targetRef of effectTargets(source, effect.target, cast, eventSource)) {
          if (targetRef.side === source && !targetRef.summonId) continue;
          if (targetRef.summonId && !runtimeSummon(getSkillState(targetRef.side), targetRef.summonId)) {
            continue;
          }
          const baseOptions = formulaOptionsFor(
            source,
            null,
            true,
            effect.element,
            targetRef.summonId,
          );
          let defenderView = viewsFor(source).defender;
          if (targetRef.summonId) {
            const defender = unitCombatant(targetRef);
            const context = skillConditionContext(
              defender,
              unitMaxHp(targetRef),
              attackerView,
              maxHpOf(source),
              'normal',
              unitState(targetRef),
              getSkillState(source),
            );
            defenderView = effectiveSkillCombatant(
              defender,
              undefined,
              unitState(targetRef),
              context,
              source,
            );
          }
          const options: DamageFormulaOptions = {
            ...baseOptions,
            damageTakenRatio: defenderView.modifiers.damageTakenRatio,
            damageTakenFromSourceRatio: defenderView.modifiers.damageTakenFromSourceRatio,
            dodgeChancePoints: defenderView.modifiers.dodgeChancePoints,
          };
          const input = {
            statusId: `${sourceSkillId}:periodic`,
            triggerId: sourceSkillId,
            source,
            element: effect.element ?? attackerView.element,
            damagePerTick: calcPeriodicDamage(
              attackerView,
              defenderView.combatant,
              levelScalarAt(effect.totalMultiplier, skillLevel) / ticksCount,
              effect.element ?? attackerView.element,
              options,
            ),
            stacks: 1,
            maxStacks: effect.maxStacks ?? 1,
            durationMs,
            tickIntervalMs: durationMs / ticksCount,
            refresh: 'duration' as const,
          };
          if (targetRef.summonId) {
            setSkillState(
              targetRef.side,
              updateRuntimeSummon(
                getSkillState(targetRef.side),
                targetRef.summonId,
                (summon) => ({
                  ...summon,
                  periodicDamage: applyPeriodicDamage(
                    summon.periodicDamage,
                    input,
                    ticks * TICK_MS,
                  ),
                }),
              ),
            );
          } else if (targetRef.side === 'player') {
            playerPeriodicDamage = applyPeriodicDamage(playerPeriodicDamage, input, ticks * TICK_MS);
          } else {
            monsterPeriodicDamage = applyPeriodicDamage(monsterPeriodicDamage, input, ticks * TICK_MS);
          }
        }
        return;
      }
      case 'heal': {
        for (const targetRef of effectTargets(source, effect.target, cast, eventSource)) {
          const unit = unitCombatant(targetRef);
          const maxHp = unitMaxHp(targetRef);
          const healing = Math.min(
            Math.max(0, maxHp - unit.currentHp),
            maxHp * levelScalarAt(effect.maxHpRatio, skillLevel),
          );
          setUnitHp(targetRef, unit.currentHp + healing);
        }
        return;
      }
      case 'shield': {
        for (const targetRef of effectTargets(source, effect.target, cast, eventSource)) {
          const amount = unitMaxHp(targetRef) * levelScalarAt(effect.maxHpRatio, skillLevel);
          setUnitState(
            targetRef,
            addSkillShield(unitState(targetRef), amount, effect.durationSec, ticks * TICK_MS),
          );
        }
        return;
      }
      case 'modifier': {
        if (effect.durationSec === undefined) {
          throw new Error(`[配置错误] 主动/触发修正必须声明持续时间：${sourceSkillId}`);
        }
        for (const targetRef of effectTargets(source, effect.target, cast, eventSource)) {
          setUnitState(
            targetRef,
            addTimedSkillModifier(
              unitState(targetRef),
              effect.modifier,
              effect.durationSec,
              ticks * TICK_MS,
              source,
              skillLevel,
            ),
          );
        }
        return;
      }
      case 'apply-status': {
        for (const targetRef of effectTargets(source, effect.target, cast, eventSource)) {
          setUnitState(
            targetRef,
            applySkillStatus(unitState(targetRef), effect, ticks * TICK_MS, source, skillLevel),
          );
        }
        return;
      }
      case 'consume-status': {
        for (const targetRef of effectTargets(source, effect.target, cast, eventSource)) {
          setUnitState(
            targetRef,
            consumeSkillStatus(unitState(targetRef), effect.statusId, effect.stacks),
          );
        }
        return;
      }
      case 'control': {
        for (const targetRef of effectTargets(source, effect.target, cast, eventSource)) {
          if (!rng.chance(effect.chance)) continue;
          setUnitState(
            targetRef,
            addSkillControl(unitState(targetRef), effect, ticks * TICK_MS),
          );
        }
        return;
      }
      case 'trigger':
        setSkillState(
          source,
          registerRuntimeTrigger(
            getSkillState(source),
            effect,
            skillLevel,
            sourceSkillId,
            ticks * TICK_MS,
            effect.durationSec === undefined,
          ),
        );
        return;
      case 'conditional':
        if (conditionSatisfied(effect.when, contextFor(source, cast.primarySummonId))) {
          for (const nested of effect.effects) {
            executeEffect(
              source,
              target,
              nested,
              skillLevel,
              sourceSkillId,
              cast,
              eventSource,
              allowTriggers,
              triggerDamage,
            );
          }
        }
        return;
      case 'avoid-next-hit':
        setSkillState(
          source,
          addSkillAvoidance(
            getSkillState(source),
            effect.count,
            effect.durationSec,
            ticks * TICK_MS,
          ),
        );
        return;
      case 'summon': {
        const kit = kitOf(source);
        if (!kit) throw new Error(`[配置错误] 没有技能栏却执行召唤：${sourceSkillId}`);
        setSkillState(
          source,
          addSkillSummon(
            getSkillState(source),
            kit,
            effect.summonId,
            effect.durationSec,
            ticks * TICK_MS,
            viewsFor(source).attacker.combatant,
          ),
        );
        return;
      }
      case 'dispel': {
        for (const targetRef of effectTargets(source, effect.target, cast, eventSource)) {
          setUnitState(
            targetRef,
            dispelSkillState(unitState(targetRef), effect.polarity, effect.count),
          );
        }
        return;
      }
      case 'reflect-trigger-damage': {
        if (triggerDamage <= 0) return;
        const reflected =
          triggerDamage * Math.max(0, levelScalarAt(effect.damageRatio, skillLevel));
        for (const targetRef of effectTargets(source, effect.target, cast, eventSource)) {
          if (targetRef.side === source && !targetRef.summonId) continue;
          const shielded = absorbDamageWithSkillShields(unitState(targetRef), reflected);
          setUnitState(targetRef, shielded.state);
          const targetUnit = unitCombatant(targetRef);
          const applied = applyDamageOnly(
            targetUnit,
            shielded.hpDamage,
            targetRef.summonId
              ? []
              : targetRef.side === 'player'
                ? opts.playerOnLethalTriggers
                : opts.monsterOnLethalTriggers,
            targetRef.summonId
              ? new Map()
              : targetRef.side === 'player'
                ? playerLethalUses
                : monsterLethalUses,
          );
          setUnitHp(targetRef, targetUnit.currentHp);
          if (source === 'player') damageDealt += applied.damage;
          else damageTaken += applied.damage;
          events.push({
            sequence: events.length + 1,
            source,
            target: targetRef.side,
            ...(targetRef.summonId ? { targetSummonId: targetRef.summonId } : {}),
            event: {
              kind: 'on-hit-elemental-damage',
              damage: applied.damage,
              triggerId: sourceSkillId,
              element: combatantOf(source).element,
            },
          });
        }
        return;
      }
    }
  }

  const castSkill = (
    source: 'player' | 'monster',
    primarySummonId: string | undefined,
  ): boolean => {
    const kit = kitOf(source);
    if (!kit) return false;
    const selected = selectSkillForAction(
      kit,
      getSkillState(source),
      ticks * TICK_MS,
      contextFor(source, primarySummonId),
    );
    if (!selected) return false;
    setSkillState(source, selected.state);
    const target = opposite(source);
    const cast: CastProgress = {
      hitTarget: false,
      hitAny: false,
      hitSummonIds: new Set(),
      primarySummonId,
    };
    // 同一次施法内的 on-hit / on-crit 契约必须在第一段伤害前挂上；配置表的书写
    // 顺序只控制结算效果，不得让“伤害写在触发器前面”悄悄吃掉本次触发。
    for (const effect of selected.entry.skill.effects) {
      if (effect.kind !== 'trigger') continue;
      executeEffect(
        source,
        target,
        effect,
        selected.entry.level,
        selected.entry.skill.id,
        cast,
      );
    }
    for (const effect of selected.entry.skill.effects) {
      if (effect.kind === 'trigger') continue;
      executeEffect(
        source,
        target,
        effect,
        selected.entry.level,
        selected.entry.skill.id,
        cast,
      );
      if (combatantOf(target).currentHp <= 0) break;
    }
    if (cast.hitAny) {
      dispatchRuntimeEvent(source, target, 'after-skill-resolved', cast);
    }
    return true;
  };

  const basicAttack = (
    source: 'player' | 'monster',
    multiplier: number,
    primarySummonId: string | undefined,
  ): void => {
    const cast: CastProgress = {
      hitTarget: false,
      hitAny: false,
      hitSummonIds: new Set(),
      primarySummonId,
    };
    const applied = resolveDirectDamage(
      source,
      multiplier,
      formulaOptionsFor(source, null, false, undefined, primarySummonId),
      cast,
      undefined,
      undefined,
      undefined,
      true,
      formulaOptionsFor(source, null, false, undefined, primarySummonId),
      cast.primarySummonId,
    );
    if (source === 'player') damageDealt += applied.damage;
    else damageTaken += applied.damage;
    if (applied.directCrit) {
      applyEquipmentCritTriggers(source, {
        side: opposite(source),
        ...(applied.targetSummonId ? { summonId: applied.targetSummonId } : {}),
      });
    }
  };

  const advanceSummons = (source: 'player' | 'monster'): void => {
    const due = takeDueSummonAttacks(getSkillState(source), ticks * TICK_MS);
    setSkillState(source, due.state);
    for (const summon of due.attacks) {
      if (combatantOf(opposite(source)).currentHp <= 0) break;
      const target = opposite(source);
      const primarySummonId =
        summon.targeting === 'lowest-hp-enemy'
          ? lowestHpSummonTarget(target)
          : selectWeightedSummonTarget(getSkillState(target), rng) ?? undefined;
      const cast: CastProgress = {
        hitTarget: false,
        hitAny: false,
        hitSummonIds: new Set(),
        primarySummonId,
      };
      const applied = resolveDirectDamage(
        source,
        summon.attackMultiplier,
        formulaOptionsFor(source, null, false, summon.element, cast.primarySummonId),
        cast,
        summon.id,
        1,
        1,
        true,
        formulaOptionsFor(source, null, false, undefined, cast.primarySummonId),
        cast.primarySummonId,
      );
      if (source === 'player') damageDealt += applied.damage;
      else damageTaken += applied.damage;
      if (applied.directCrit) {
        applyEquipmentCritTriggers(source, {
          side: target,
          ...(applied.targetSummonId ? { summonId: applied.targetSummonId } : {}),
        });
      }
    }
  };

  const advanceSummonPeriodics = (
    owner: 'player' | 'monster',
    elapsedMs: number,
  ): void => {
    const summonIds = getSkillState(owner).summons.map((summon) => summon.definition.id);
    for (const summonId of summonIds) {
      const summon = runtimeSummon(getSkillState(owner), summonId);
      if (!summon) continue;
      const summonCombatant = summonCombatantFor(summon);
      summonCombatant.level = combatantOf(owner).level;
      const timelineStart = events.length;
      const advanced = applyPeriodicDamageAdvance(
        summonCombatant,
        summon.periodicDamage,
        elapsedMs,
        events,
        [],
        new Map(),
        summon.skillState,
      );
      for (let index = timelineStart; index < events.length; index++) {
        events[index] = { ...events[index]!, targetSummonId: summonId };
      }
      if (owner === 'monster') damageDealt += advanced.damage;
      else damageTaken += advanced.damage;
      setSkillState(
        owner,
        updateRuntimeSummon(getSkillState(owner), summonId, (current) => ({
          ...current,
          currentHp: summonCombatant.currentHp,
          periodicDamage: advanced.state,
          skillState: advanced.skillState,
        })),
      );
    }
  };

  const continueAfterTargetDefeat = (): boolean => {
    if (monster.currentHp > 0) return true;
    kills++;
    if (!opts.repeatTargetOnDefeat) return false;
    monster.currentHp = monsterMaxHp;
    monsterCd = 0;
    monsterPeriodicDamage = createPeriodicDamageState();
    monsterSkillState = createSkillCombatState(opts.monsterSkillKit ?? EMPTY_SKILL_KIT);
    monsterLethalUses = createLethalTriggerUses(opts.monsterOnLethalTriggers);
    return true;
  };

  while (ticks < maxTicks && player.currentHp > 0 && monster.currentHp > 0) {
    ticks++;
    const elapsedMs = ticks * TICK_MS;
    playerCd -= TICK;
    monsterCd -= TICK;
    playerSkillState = expireSkillCombatState(playerSkillState, elapsedMs);
    monsterSkillState = expireSkillCombatState(monsterSkillState, elapsedMs);

    const monsterPeriodicAdvance = applyPeriodicDamageAdvance(
      monster,
      monsterPeriodicDamage,
      elapsedMs,
      events,
      opts.monsterOnLethalTriggers,
      monsterLethalUses,
      monsterSkillState,
    );
    monsterPeriodicDamage = monsterPeriodicAdvance.state;
    monsterSkillState = monsterPeriodicAdvance.skillState;
    damageDealt += monsterPeriodicAdvance.damage;
    if (monsterPeriodicAdvance.damage > 0) {
      const cast: CastProgress = { hitTarget: true, hitAny: true, hitSummonIds: new Set() };
      dispatchRuntimeEvent(
        'monster',
        'player',
        'on-damage-taken',
        cast,
        'player',
        monsterPeriodicAdvance.damage,
      );
      dispatchRuntimeEvent('monster', 'player', 'on-low-hp', cast, 'player');
    }
    if (!continueAfterTargetDefeat()) break;

    const playerPeriodicAdvance = applyPeriodicDamageAdvance(
      player,
      playerPeriodicDamage,
      elapsedMs,
      events,
      opts.playerOnLethalTriggers,
      playerLethalUses,
      playerSkillState,
    );
    playerPeriodicDamage = playerPeriodicAdvance.state;
    playerSkillState = playerPeriodicAdvance.skillState;
    damageTaken += playerPeriodicAdvance.damage;
    if (playerPeriodicAdvance.damage > 0) {
      const cast: CastProgress = { hitTarget: true, hitAny: true, hitSummonIds: new Set() };
      dispatchRuntimeEvent(
        'player',
        'monster',
        'on-damage-taken',
        cast,
        'monster',
        playerPeriodicAdvance.damage,
      );
      dispatchRuntimeEvent('player', 'monster', 'on-low-hp', cast, 'monster');
    }
    if (player.currentHp <= 0) break;

    advanceSummonPeriodics('player', elapsedMs);
    advanceSummonPeriodics('monster', elapsedMs);
    advanceSummons('player');
    if (!continueAfterTargetDefeat()) break;
    advanceSummons('monster');
    if (player.currentHp <= 0) break;

    if (playerCd <= 0 && skillControlBlockUntil(playerSkillState) <= elapsedMs) {
      const view = viewsFor('player').attacker.combatant;
      playerCd += 1 / (Math.max(0.01, view.stats.spd) * (1 - skillSlowRatio(playerSkillState)));
      const primarySummonId =
        selectWeightedSummonTarget(monsterSkillState, rng) ?? undefined;
      if (!castSkill('player', primarySummonId)) basicAttack('player', pMul, primarySummonId);
      if (!continueAfterTargetDefeat()) break;
    }

    if (monsterCd <= 0 && skillControlBlockUntil(monsterSkillState) <= elapsedMs) {
      const view = viewsFor('monster').attacker.combatant;
      monsterCd += 1 / (Math.max(0.01, view.stats.spd) * (1 - skillSlowRatio(monsterSkillState)));
      const primarySummonId =
        selectWeightedSummonTarget(playerSkillState, rng) ?? undefined;
      if (!castSkill('monster', primarySummonId)) basicAttack('monster', mMul, primarySummonId);
    }
  }

  const win = kills > 0 && player.currentHp > 0;

  return {
    win,
    duration: ticks * TICK,
    damageDealt,
    damageTaken,
    kills,
    events,
    playerMaxHp,
    monsterMaxHp,
    lifestealPotential,
  };
}

/**
 * 玩家对某怪物的每秒伤害期望。
 * 挂机产出的核心输入。
 */
export function estimateDps(
  player: Combatant,
  monster: Combatant,
  skillMultiplier = 1.0,
  onHitTriggers: readonly OnHitElementalDamageTrigger[] = [],
  skillKit?: SkillCombatKit,
  targetType: MonsterType = 'normal',
): number {
  if (skillKit) {
    return estimateRealSkillRotation(player, monster, skillKit, onHitTriggers, targetType).dps;
  }
  return expectedDamageSegment(player, monster, skillMultiplier, onHitTriggers) * player.stats.spd;
}

/**
 * 击杀一只该怪物需要多少秒。
 * 返回 Infinity 表示打不动（DPS 为 0）。
 */
export function timeToKill(
  player: Combatant,
  monster: Combatant,
  skillMultiplier = 1.0,
  onHitTriggers: readonly OnHitElementalDamageTrigger[] = [],
  skillKit?: SkillCombatKit,
  targetType: MonsterType = 'normal',
): number {
  const dps = estimateDps(player, monster, skillMultiplier, onHitTriggers, skillKit, targetType);
  if (dps <= 0) return Infinity;
  return monster.stats.hp / dps;
}

/**
 * 怪物对玩家的每秒伤害期望。
 * 用于判断玩家能不能在这张图长期挂机而不死。
 */
export function estimateIncomingDps(
  player: Combatant,
  monster: Combatant,
  skillMultiplier = 1.0,
  onHitTriggers: readonly OnHitElementalDamageTrigger[] = [],
): number {
  return estimateDps(monster, player, skillMultiplier, onHitTriggers);
}

/** 玩家每秒期望吸血量；只按真实输出管线计算，不把吸血当作基础属性。 */
export function estimateLifestealPerSecond(
  player: Combatant,
  monster: Combatant,
  skillMultiplier = 1.0,
  skillKit?: SkillCombatKit,
  targetType: MonsterType = 'normal',
): number {
  const lifestealPoints = player.combatBonuses?.lifesteal ?? 0;
  if (skillKit) {
    return estimateRealSkillRotation(player, monster, skillKit, [], targetType)
      .lifestealPerSecond;
  }
  // on-hit 追加段明确不吸血，因此这里只取直接伤害段期望。
  return (
    expectedDamage(player, monster, skillMultiplier) *
    player.stats.spd *
    (Math.max(0, lifestealPoints) / 100)
  );
}

export interface CombatPressure {
  /** 玩家对当前怪物的期望 DPS。 */
  playerDps: number;
  /** 不含吸血抵消时，怪物对玩家的期望 DPS。 */
  incomingDps: number;
  /** 玩家每秒从真实输出中获得的期望回复。 */
  lifestealPerSecond: number;
  /** 按纯输出击杀当前怪物所需秒数。 */
  fightSeconds: number;
  /** 一场战斗扣除吸血后承受的总伤害。 */
  damagePerFight: number;
  /** 一场净承伤占玩家最大生命的比例。 */
  damageRatio: number;
  /** 超过免费承伤区间的比例。 */
  excessDamageRatio: number;
  /** 承伤后的挂机效率，合法战斗中始终大于 0 且不超过 1。 */
  efficiency: number;
}

/**
 * 计算一场战斗给挂机带来的承伤压力。
 *
 * 这不是死亡模拟：超额承伤解释为战后恢复占用的时间，因此只让产出变慢。
 * 防御、生命、伤害减免和吸血都会通过同一条真实伤害管线改变结果。
 */
export function combatPressure(
  player: Combatant,
  monster: Combatant,
  skillMultiplier = 1.0,
  options: CombatEstimateOptions = {},
): CombatPressure {
  const skillEstimate = options.playerSkillKit
    ? estimateRealSkillRotation(
        player,
        monster,
        options.playerSkillKit,
        options.playerOnHitTriggers ?? [],
        options.playerTargetType ?? 'normal',
      )
    : undefined;
  const playerDps =
    skillEstimate?.dps ??
    estimateDps(player, monster, skillMultiplier, options.playerOnHitTriggers);
  const incomingDps = estimateIncomingDps(player, monster, 1, options.monsterOnHitTriggers);
  const lifestealPerSecond =
    skillEstimate?.lifestealPerSecond ??
    estimateLifestealPerSecond(player, monster, skillMultiplier);
  const fightSeconds =
    playerDps > 0 && monster.stats.hp > 0 ? monster.stats.hp / playerDps : Infinity;
  const netIncomingDps = Math.max(0, incomingDps - lifestealPerSecond);
  const damagePerFight = Number.isFinite(fightSeconds) ? netIncomingDps * fightSeconds : Infinity;
  const damageRatio =
    player.stats.hp > 0 && Number.isFinite(damagePerFight)
      ? damagePerFight / player.stats.hp
      : Infinity;
  const excessDamageRatio = Number.isFinite(damageRatio)
    ? Math.max(0, damageRatio - IDLE_FREE_DAMAGE_RATIO)
    : Infinity;
  const efficiency = Number.isFinite(excessDamageRatio) ? 1 / (1 + excessDamageRatio) : 0;

  return {
    playerDps,
    incomingDps,
    lifestealPerSecond,
    fightSeconds,
    damagePerFight,
    damageRatio,
    excessDamageRatio,
    efficiency,
  };
}

/** 承伤软模型的挂机效率 η。 */
export function combatEfficiency(
  player: Combatant,
  monster: Combatant,
  skillMultiplier = 1.0,
  options: CombatEstimateOptions = {},
): number {
  return combatPressure(player, monster, skillMultiplier, options).efficiency;
}

/**
 * 是否低于“建议换图”的承伤提示线。
 *
 * 只用于提示，不得据此停止挂机；效率模型本身不会把合法战斗压到 0。
 */
export function canSustain(
  player: Combatant,
  monster: Combatant,
  skillMultiplier = 1.0,
  options: CombatEstimateOptions = {},
): boolean {
  return (
    combatEfficiency(player, monster, skillMultiplier, options) >= IDLE_SUSTAIN_HINT_EFFICIENCY
  );
}

/**
 * 挂机期望不再另写一套“平均倍率”：用同一真实解释器跑两个固定种子样本，
 * 目标死亡后立刻以同模板复活，但玩家技能冷却 / 状态 / 召唤不重置。这样 120 秒内
 * 会真实轮转所有技能，也保留每只怪的血线、斩杀、过量伤害、DOT 清除与多段截断；
 * 只把目标攻击置 0，避免输出估算混入生存失败。
 */
interface SkillRotationEstimate {
  dps: number;
  lifestealPerSecond: number;
}

function estimateRealSkillRotation(
  player: Combatant,
  monster: Combatant,
  skillKit: SkillCombatKit,
  onHitTriggers: readonly OnHitElementalDamageTrigger[],
  targetType: MonsterType,
): SkillRotationEstimate {
  const sampleSeeds = [0x51a7e11, 0x7b3d902] as const;
  let totalDps = 0;
  let totalLifesteal = 0;
  for (const seed of sampleSeeds) {
    const source: Combatant = {
      ...player,
      stats: { ...player.stats },
      currentHp: player.stats.hp,
      ...(player.combatBonuses
        ? {
            combatBonuses: {
              ...player.combatBonuses,
              elementDamage: { ...player.combatBonuses.elementDamage },
            },
          }
        : {}),
    };
    const target: Combatant = {
      ...monster,
      stats: { ...monster.stats, atk: 0, critRate: 0 },
      currentHp: monster.stats.hp,
      ...(monster.combatBonuses
        ? {
            combatBonuses: {
              ...monster.combatBonuses,
              elementDamage: { ...monster.combatBonuses.elementDamage },
            },
          }
        : {}),
    };
    const result = simulateFight(source, target, new Rng(seed), {
      maxSeconds: SKILL_ESTIMATE_SECONDS,
      repeatTargetOnDefeat: true,
      playerSkillKit: skillKit,
      playerTargetType: targetType,
      playerOnHitTriggers: onHitTriggers,
    });
    totalDps += result.duration > 0 ? result.damageDealt / result.duration : 0;
    totalLifesteal +=
      result.duration > 0 ? result.lifestealPotential / result.duration : 0;
  }
  return {
    dps: totalDps / sampleSeeds.length,
    lifestealPerSecond: totalLifesteal / sampleSeeds.length,
  };
}

/**
 * 结算一次实际伤害与吸血。
 *
 * 吸血只按目标剩余生命内的非过量伤害计算；回复后生命不得超过最大生命。
 */
interface AppliedDamage {
  damage: number;
  recovery: LethalRecoveryEvent | null;
  lifestealPotential: number;
}

function createLethalTriggerUses(
  triggers: readonly OnLethalRecoveryTrigger[] = [],
): Map<string, number> {
  const uses = new Map<string, number>();
  for (const trigger of triggers) {
    assertOnLethalRecoveryTrigger(trigger);
    if (uses.has(trigger.id)) {
      throw new Error(`[配置错误] 重复的致命伤触发 ID：${trigger.id}`);
    }
    uses.set(trigger.id, 0);
  }
  return uses;
}

function applyDamageAndLifesteal(
  attacker: Combatant,
  defender: Combatant,
  rolledDamage: number,
  lethalTriggers: readonly OnLethalRecoveryTrigger[] = [],
  lethalUses: Map<string, number> = new Map(),
): AppliedDamage {
  const actualDamage = Math.min(Math.max(0, defender.currentHp), Math.max(0, rolledDamage));
  defender.currentHp = Math.max(0, defender.currentHp - actualDamage);

  const lifestealPoints = attacker.combatBonuses?.lifesteal ?? 0;
  const lifestealPotential = actualDamage * (Math.max(0, lifestealPoints) / 100);
  const healing = lifestealPotential;
  attacker.currentHp = Math.min(attacker.stats.hp, attacker.currentHp + healing);
  return {
    damage: actualDamage,
    recovery: resolveLethalRecovery(defender, lethalTriggers, lethalUses),
    lifestealPotential,
  };
}

function applyDamageSegment(
  attacker: Combatant,
  defender: Combatant,
  resolution: DamageSegmentResolution,
  source: 'player' | 'monster',
  timeline: CombatTimelineEvent[],
  defenderLethalTriggers: readonly OnLethalRecoveryTrigger[] = [],
  defenderLethalUses: Map<string, number> = new Map(),
): { damage: number; directCrit: boolean; lifestealPotential: number } {
  let total = 0;
  let lifestealPotential = 0;
  for (const event of resolution.events) {
    const applied =
      event.kind === 'direct-damage'
        ? applyDamageAndLifesteal(
            attacker,
            defender,
            event.damage,
            defenderLethalTriggers,
            defenderLethalUses,
          )
        : applyDamageOnly(
            defender,
            event.damage,
            defenderLethalTriggers,
            defenderLethalUses,
          );
    const actualDamage = applied.damage;
    total += actualDamage;
    lifestealPotential += applied.lifestealPotential;

    // 命中失败也作为直接段事件保留，方便未来表现层显示 MISS；追加段若因直接段
    // 已击杀目标而变成 0 实际伤害则不播放一段假的炎爆飘字。
    if (event.kind === 'on-hit-elemental-damage' && actualDamage <= 0) continue;
    timeline.push({
      sequence: timeline.length + 1,
      source,
      target: source === 'player' ? 'monster' : 'player',
      event: { ...event, damage: actualDamage },
    });
    if (applied.recovery) {
      timeline.push({
        sequence: timeline.length + 1,
        source: source === 'player' ? 'monster' : 'player',
        target: source === 'player' ? 'monster' : 'player',
        event: applied.recovery,
      });
    }
  }
  return {
    damage: total,
    directCrit: resolution.direct.hit && resolution.direct.crit,
    lifestealPotential,
  };
}

function resolveOnCritTriggers(
  attacker: Combatant,
  defender: Combatant,
  triggers: readonly OnCritPeriodicDamageTrigger[] = [],
  source: 'player' | 'monster',
  elapsedMs: number,
  periodicState: PeriodicDamageState,
  timeline: CombatTimelineEvent[],
  formulaOptions: DamageFormulaOptions = {},
): PeriodicDamageState {
  let state = periodicState;
  for (const trigger of triggers) {
    assertOnCritPeriodicDamageTrigger(trigger);
    const healing = Math.min(
      Math.max(0, attacker.stats.hp - attacker.currentHp),
      attacker.stats.hp * trigger.healMaxHpRatio,
    );
    attacker.currentHp += healing;
    timeline.push({
      sequence: timeline.length + 1,
      source,
      target: source,
      event: {
        kind: 'on-crit-recovery',
        damage: 0,
        healing,
        triggerId: trigger.id,
      },
    });

    if (defender.currentHp <= 0) continue;
    const durationMs = trigger.durationSec * 1_000;
    const element = trigger.element ?? attacker.element;
    state = applyPeriodicDamage(
      state,
      {
        statusId: trigger.statusId,
        triggerId: trigger.id,
        source,
        element,
        damagePerTick: calcPeriodicDamage(
          attacker,
          defender,
          trigger.atkMultiplierPerTick,
          element,
          formulaOptions,
        ),
        stacks: 1,
        maxStacks: trigger.maxStacks,
        durationMs,
        tickIntervalMs: durationMs / trigger.ticks,
        refresh: trigger.refresh,
      },
      elapsedMs,
    );
  }
  return state;
}

function applyPeriodicDamageAdvance(
  defender: Combatant,
  state: PeriodicDamageState,
  elapsedMs: number,
  timeline: CombatTimelineEvent[],
  defenderLethalTriggers: readonly OnLethalRecoveryTrigger[] = [],
  defenderLethalUses: Map<string, number> = new Map(),
  skillState: SkillCombatState = createSkillCombatState(EMPTY_SKILL_KIT),
): { state: PeriodicDamageState; skillState: SkillCombatState; damage: number } {
  const advanced = advancePeriodicDamage(state, elapsedMs);
  let damage = 0;
  let nextSkillState = skillState;
  for (const tick of advanced.ticks) {
    if (defender.currentHp <= 0) break;
    const shielded = absorbDamageWithSkillShields(nextSkillState, tick.damage);
    nextSkillState = shielded.state;
    const applied = applyDamageOnly(
      defender,
      shielded.hpDamage,
      defenderLethalTriggers,
      defenderLethalUses,
    );
    damage += applied.damage;
    pushPeriodicDamageEvent(timeline, tick, applied.damage);
    if (applied.recovery) {
      timeline.push({
        sequence: timeline.length + 1,
        source: tick.source === 'player' ? 'monster' : 'player',
        target: tick.source === 'player' ? 'monster' : 'player',
        event: applied.recovery,
      });
    }
  }
  return { state: advanced.state, skillState: nextSkillState, damage };
}

function pushPeriodicDamageEvent(
  timeline: CombatTimelineEvent[],
  tick: PeriodicDamageTick,
  damage: number,
): void {
  timeline.push({
    sequence: timeline.length + 1,
    source: tick.source,
    target: tick.source === 'player' ? 'monster' : 'player',
    event: {
      kind: 'periodic-damage',
      damage,
      hit: true,
      crit: false,
      element: tick.element,
      triggerId: tick.triggerId,
      statusId: tick.statusId,
      stacks: tick.stacks,
    },
  });
}

function applyDamageOnly(
  defender: Combatant,
  rolledDamage: number,
  lethalTriggers: readonly OnLethalRecoveryTrigger[] = [],
  lethalUses: Map<string, number> = new Map(),
): AppliedDamage {
  const actualDamage = Math.min(Math.max(0, defender.currentHp), Math.max(0, rolledDamage));
  defender.currentHp = Math.max(0, defender.currentHp - actualDamage);
  return {
    damage: actualDamage,
    recovery: resolveLethalRecovery(defender, lethalTriggers, lethalUses),
    lifestealPotential: 0,
  };
}

function resolveLethalRecovery(
  defender: Combatant,
  triggers: readonly OnLethalRecoveryTrigger[],
  uses: Map<string, number>,
): LethalRecoveryEvent | null {
  if (defender.currentHp > 0) return null;
  for (const trigger of triggers) {
    assertOnLethalRecoveryTrigger(trigger);
    const used = uses.get(trigger.id);
    if (used === undefined) {
      throw new Error(`[战斗错误] 致命伤触发没有初始化：${trigger.id}`);
    }
    if (used >= trigger.activationsPerFight) continue;
    uses.set(trigger.id, used + 1);
    const healing = defender.stats.hp * trigger.healRatio;
    defender.currentHp = Math.min(defender.stats.hp, Math.max(Number.EPSILON, healing));
    return {
      kind: 'lethal-recovery',
      damage: 0,
      healing: defender.currentHp,
      triggerId: trigger.id,
    };
  }
  return null;
}
