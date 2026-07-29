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

import type { Combatant, CombatResult } from './types';
import type { Rng } from './rng';
import {
  calcConfirmedElementalDamage,
  calcDamage,
  expectedConfirmedElementalDamage,
  expectedDamage,
  hitChance,
} from './formula';
import {
  assertOnHitElementalDamageTrigger,
  type OnHitElementalDamageTrigger,
} from './equipmentSets';
import { IDLE_FREE_DAMAGE_RATIO, IDLE_SUSTAIN_HINT_EFFICIENCY } from '@/data/constants';

/** 单场战斗的时间上限（秒），防止打不动时死循环 */
const MAX_FIGHT_SECONDS = 300;

/** 模拟步长（秒）。0.1 秒足够精确，且 300 秒战斗只要 3000 步。 */
const TICK = 0.1;

export interface FightOptions {
  /** 玩家平均技能倍率。默认 1.0（普攻） */
  playerSkillMultiplier?: number;
  /** 怪物平均技能倍率 */
  monsterSkillMultiplier?: number;
  /** 玩家每个直接伤害段命中后独立判定的触发。 */
  playerOnHitTriggers?: readonly OnHitElementalDamageTrigger[];
  /** 为未来怪物机制预留的同一逐击接口。 */
  monsterOnHitTriggers?: readonly OnHitElementalDamageTrigger[];
  /** 时间上限 */
  maxSeconds?: number;
}

export interface DirectDamageSegmentEvent {
  kind: 'direct-damage';
  damage: number;
  hit: boolean;
  crit: boolean;
  element: Combatant['element'];
}

export interface OnHitElementalDamageEvent {
  kind: 'on-hit-elemental-damage';
  damage: number;
  triggerId: string;
  element: Exclude<Combatant['element'], 'none'>;
}

export type DamageSegmentEvent = DirectDamageSegmentEvent | OnHitElementalDamageEvent;

export interface DamageSegmentResolution {
  direct: DirectDamageSegmentEvent;
  /** 顺序固定为直接伤害、随后各个已触发追加段；视觉只能消费这些结算事件。 */
  events: readonly DamageSegmentEvent[];
}

export interface CombatTimelineEvent {
  sequence: number;
  source: 'player' | 'monster';
  target: 'player' | 'monster';
  event: DamageSegmentEvent;
}

export interface SimulatedFightResult extends CombatResult {
  /** 已按目标剩余生命截断为实际伤害，可直接供表现层消费。 */
  events: readonly CombatTimelineEvent[];
}

export interface CombatEstimateOptions {
  playerOnHitTriggers?: readonly OnHitElementalDamageTrigger[];
  monsterOnHitTriggers?: readonly OnHitElementalDamageTrigger[];
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
): DamageSegmentResolution {
  for (const trigger of onHitTriggers) {
    assertOnHitElementalDamageTrigger(trigger);
  }
  const directResult = calcDamage(attacker, defender, skillMultiplier, rng);
  const direct: DirectDamageSegmentEvent = {
    kind: 'direct-damage',
    damage: directResult.damage,
    hit: directResult.hit,
    crit: directResult.crit,
    element: attacker.element,
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
): number {
  let total = expectedDamage(attacker, defender, skillMultiplier);
  const directHitChance = hitChance(attacker.stats.acc, defender.stats.eva);
  for (const trigger of onHitTriggers) {
    assertOnHitElementalDamageTrigger(trigger);
    total +=
      directHitChance *
      trigger.chance *
      expectedConfirmedElementalDamage(attacker, defender, trigger.atkMultiplier, trigger.element);
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
  const events: CombatTimelineEvent[] = [];

  const playerInterval = 1 / Math.max(0.01, player.stats.spd);
  const monsterInterval = 1 / Math.max(0.01, monster.stats.spd);

  while (ticks < maxTicks && player.currentHp > 0 && monster.currentHp > 0) {
    ticks++;
    playerCd -= TICK;
    monsterCd -= TICK;

    if (playerCd <= 0) {
      playerCd += playerInterval;
      const segment = resolveDamageSegment(player, monster, pMul, rng, opts.playerOnHitTriggers);
      damageDealt += applyDamageSegment(player, monster, segment, 'player', events);
      if (monster.currentHp <= 0) break;
    }

    if (monsterCd <= 0) {
      monsterCd += monsterInterval;
      const segment = resolveDamageSegment(monster, player, mMul, rng, opts.monsterOnHitTriggers);
      damageTaken += applyDamageSegment(monster, player, segment, 'monster', events);
    }
  }

  const win = monster.currentHp <= 0 && player.currentHp > 0;

  return {
    win,
    duration: ticks * TICK,
    damageDealt,
    damageTaken,
    kills: win ? 1 : 0,
    events,
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
): number {
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
): number {
  const dps = estimateDps(player, monster, skillMultiplier, onHitTriggers);
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
): number {
  const lifestealPoints = player.combatBonuses?.lifesteal ?? 0;
  // on-hit 追加段明确不吸血，因此这里只取直接伤害段期望，不能复用含触发的 estimateDps。
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
  const playerDps = estimateDps(player, monster, skillMultiplier, options.playerOnHitTriggers);
  const incomingDps = estimateIncomingDps(player, monster, 1, options.monsterOnHitTriggers);
  const lifestealPerSecond = estimateLifestealPerSecond(player, monster, skillMultiplier);
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
 * 结算一次实际伤害与吸血。
 *
 * 吸血只按目标剩余生命内的非过量伤害计算；回复后生命不得超过最大生命。
 */
function applyDamageAndLifesteal(
  attacker: Combatant,
  defender: Combatant,
  rolledDamage: number,
): number {
  const actualDamage = Math.min(Math.max(0, defender.currentHp), Math.max(0, rolledDamage));
  defender.currentHp = Math.max(0, defender.currentHp - actualDamage);

  const lifestealPoints = attacker.combatBonuses?.lifesteal ?? 0;
  const healing = actualDamage * (Math.max(0, lifestealPoints) / 100);
  attacker.currentHp = Math.min(attacker.stats.hp, attacker.currentHp + healing);
  return actualDamage;
}

function applyDamageSegment(
  attacker: Combatant,
  defender: Combatant,
  resolution: DamageSegmentResolution,
  source: 'player' | 'monster',
  timeline: CombatTimelineEvent[],
): number {
  let total = 0;
  for (const event of resolution.events) {
    const actualDamage =
      event.kind === 'direct-damage'
        ? applyDamageAndLifesteal(attacker, defender, event.damage)
        : applyDamageOnly(defender, event.damage);
    total += actualDamage;

    // 命中失败也作为直接段事件保留，方便未来表现层显示 MISS；追加段若因直接段
    // 已击杀目标而变成 0 实际伤害则不播放一段假的炎爆飘字。
    if (event.kind === 'on-hit-elemental-damage' && actualDamage <= 0) continue;
    timeline.push({
      sequence: timeline.length + 1,
      source,
      target: source === 'player' ? 'monster' : 'player',
      event: { ...event, damage: actualDamage },
    });
  }
  return total;
}

function applyDamageOnly(defender: Combatant, rolledDamage: number): number {
  const actualDamage = Math.min(Math.max(0, defender.currentHp), Math.max(0, rolledDamage));
  defender.currentHp = Math.max(0, defender.currentHp - actualDamage);
  return actualDamage;
}
