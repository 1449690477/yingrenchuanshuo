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
import { calcDamage, expectedDamage } from './formula';

/** 单场战斗的时间上限（秒），防止打不动时死循环 */
const MAX_FIGHT_SECONDS = 300;

/** 模拟步长（秒）。0.1 秒足够精确，且 300 秒战斗只要 3000 步。 */
const TICK = 0.1;

export interface FightOptions {
  /** 玩家平均技能倍率。默认 1.0（普攻） */
  playerSkillMultiplier?: number;
  /** 怪物平均技能倍率 */
  monsterSkillMultiplier?: number;
  /** 时间上限 */
  maxSeconds?: number;
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
): CombatResult {
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

  const playerInterval = 1 / Math.max(0.01, player.stats.spd);
  const monsterInterval = 1 / Math.max(0.01, monster.stats.spd);

  while (ticks < maxTicks && player.currentHp > 0 && monster.currentHp > 0) {
    ticks++;
    playerCd -= TICK;
    monsterCd -= TICK;

    if (playerCd <= 0) {
      playerCd += playerInterval;
      const r = calcDamage(player, monster, pMul, rng);
      monster.currentHp -= r.damage;
      damageDealt += r.damage;
      if (monster.currentHp <= 0) break;
    }

    if (monsterCd <= 0) {
      monsterCd += monsterInterval;
      const r = calcDamage(monster, player, mMul, rng);
      player.currentHp -= r.damage;
      damageTaken += r.damage;
    }
  }

  const win = monster.currentHp <= 0 && player.currentHp > 0;

  return {
    win,
    duration: ticks * TICK,
    damageDealt,
    damageTaken,
    kills: win ? 1 : 0,
  };
}

/**
 * 玩家对某怪物的每秒伤害期望。
 * 挂机产出的核心输入。
 */
export function estimateDps(player: Combatant, monster: Combatant, skillMultiplier = 1.0): number {
  return expectedDamage(player, monster, skillMultiplier) * player.stats.spd;
}

/**
 * 击杀一只该怪物需要多少秒。
 * 返回 Infinity 表示打不动（DPS 为 0）。
 */
export function timeToKill(player: Combatant, monster: Combatant, skillMultiplier = 1.0): number {
  const dps = estimateDps(player, monster, skillMultiplier);
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
): number {
  return expectedDamage(monster, player, skillMultiplier) * monster.stats.spd;
}

/**
 * 挂机可持续性判断。
 *
 * 玩家在一场战斗中承受的伤害如果超过血量上限的 SAFE_RATIO，
 * 就认为这张图挂不住（会死，需要吃药或者换图）。
 */
const SAFE_RATIO = 0.6;

export function canSustain(player: Combatant, monster: Combatant, skillMultiplier = 1.0): boolean {
  const ttk = timeToKill(player, monster, skillMultiplier);
  if (!Number.isFinite(ttk)) return false;
  const incoming = estimateIncomingDps(player, monster) * ttk;
  return incoming < player.stats.hp * SAFE_RATIO;
}
