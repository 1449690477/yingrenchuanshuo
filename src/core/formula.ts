/**
 * 战斗与战力公式。
 * 全部定义见 docs/10-数值与战斗.md 第二节。
 *
 * 本文件是纯函数，无状态，随机性一律通过参数传入 Rng。
 */

import type { Combatant, DamageResult, Element, Stats } from './types';
import type { Rng } from './rng';
import {
  CRIT_BASE,
  DAMAGE_VARIANCE_MAX,
  DAMAGE_VARIANCE_MIN,
  ELEMENT_BEATS,
  ELEM_ADVANTAGE,
  ELEM_DISADVANTAGE,
  ELEM_NEUTRAL,
  HIT_BASE,
  HIT_DIVISOR,
  HIT_MAX,
  HIT_MIN,
  K_DEF,
  MIN_DAMAGE_RATIO,
  CP_WEIGHTS,
} from '@/data/constants';

export function clamp(v: number, min: number, max: number): number {
  return v < min ? min : v > max ? max : v;
}

/**
 * 减伤率，0~1。
 * 采用除法减伤而非传奇原版的「攻击 - 防御」减法，
 * 理由见 docs/10：减法会导致高防御时完全打不动，放置游戏里等于卡死。
 */
export function damageReduction(def: number, attackerLevel: number): number {
  const denom = def + K_DEF * Math.max(1, attackerLevel);
  if (denom <= 0) return 0;
  return def / denom;
}

/** 命中率，0.55 ~ 1.0 */
export function hitChance(acc: number, eva: number): number {
  return clamp(HIT_BASE + (acc - eva) / HIT_DIVISOR, HIT_MIN, HIT_MAX);
}

/** 暴击倍率 */
export function critMultiplier(critDmg: number): number {
  return CRIT_BASE + critDmg / 100;
}

/** 属性克制系数 */
export function elementMultiplier(attacker: Element, defender: Element): number {
  if (attacker === 'none' || defender === 'none') return ELEM_NEUTRAL;
  if (ELEMENT_BEATS[attacker] === defender) return ELEM_ADVANTAGE;
  if (ELEMENT_BEATS[defender] === attacker) return ELEM_DISADVANTAGE;
  return ELEM_NEUTRAL;
}

/**
 * 实际属性系数。
 *
 * elemDmg 只认攻击者当前属性；无属性攻击或词条属性不匹配时不生效。
 * 百分点换算成小数后直接加在基础克制系数上。
 */
export function effectiveElementMultiplier(attacker: Combatant, defender: Combatant): number {
  const base = elementMultiplier(attacker.element, defender.element);
  if (attacker.element === 'none') return base;
  const bonusPoints = attacker.combatBonuses?.elementDamage[attacker.element] ?? 0;
  return base + Math.max(0, bonusPoints) / 100;
}

/** 装备伤害减免的剩余伤害倍率；与防御减伤相乘。 */
export function combatBonusDamageMultiplier(defender: Combatant): number {
  const reductionPoints = defender.combatBonuses?.damageReduction ?? 0;
  return 1 - clamp(reductionPoints / 100, 0, 1);
}

/**
 * 单次攻击的伤害结算。
 *
 * 最终伤害 = atk × 技能倍率 × (1 - 防御减伤) × (1 - 词条减伤)
 *            × 浮动 × 暴击 × 属性系数
 * 且不低于 atk × MIN_DAMAGE_RATIO
 */
export function calcDamage(
  attacker: Combatant,
  defender: Combatant,
  skillMultiplier: number,
  rng: Rng,
): DamageResult {
  const hit = rng.chance(hitChance(attacker.stats.acc, defender.stats.eva));
  if (!hit) return { damage: 0, hit: false, crit: false };

  const crit = rng.chance(clamp(attacker.stats.critRate / 100, 0, 1));

  const base = attacker.stats.atk * skillMultiplier;
  const reduction = damageReduction(defender.stats.def, attacker.level);
  const bonusDamageMul = combatBonusDamageMultiplier(defender);
  const variance = rng.float(DAMAGE_VARIANCE_MIN, DAMAGE_VARIANCE_MAX);
  const critMul = crit ? critMultiplier(attacker.stats.critDmg) : 1;
  const elemMul = effectiveElementMultiplier(attacker, defender);

  const raw = base * (1 - reduction) * bonusDamageMul * variance * critMul * elemMul;
  const floor = attacker.stats.atk * MIN_DAMAGE_RATIO;

  return { damage: Math.max(floor, raw), hit: true, crit };
}

/**
 * 期望伤害（不掷骰）。
 * 用于挂机产出估算和推荐战力计算 —— 挂机不需要逐次模拟，
 * 用期望值算 DPS 精度足够且快几个数量级。
 */
export function expectedDamage(
  attacker: Combatant,
  defender: Combatant,
  skillMultiplier: number,
): number {
  const hitP = hitChance(attacker.stats.acc, defender.stats.eva);
  const critP = clamp(attacker.stats.critRate / 100, 0, 1);

  const base = attacker.stats.atk * skillMultiplier;
  const reduction = damageReduction(defender.stats.def, attacker.level);
  const bonusDamageMul = combatBonusDamageMultiplier(defender);
  const avgVariance = (DAMAGE_VARIANCE_MIN + DAMAGE_VARIANCE_MAX) / 2;
  const avgCritMul = 1 + critP * (critMultiplier(attacker.stats.critDmg) - 1);
  const elemMul = effectiveElementMultiplier(attacker, defender);

  const raw = base * (1 - reduction) * bonusDamageMul * avgVariance * avgCritMul * elemMul;
  const floor = attacker.stats.atk * MIN_DAMAGE_RATIO;

  return hitP * Math.max(floor, raw);
}

/**
 * 战力。这只是给玩家看的单一数字指标，用来判断能不能打过某关。
 * 它不参与任何战斗计算。
 */
export function combatPower(stats: Stats): number {
  const base =
    stats.atk * CP_WEIGHTS.atk +
    stats.def * CP_WEIGHTS.def +
    stats.hp * CP_WEIGHTS.hp +
    stats.acc * CP_WEIGHTS.acc +
    stats.eva * CP_WEIGHTS.eva +
    (stats.critRate / 100) * CP_WEIGHTS.critRate +
    (stats.critDmg / 100) * CP_WEIGHTS.critDmg;

  // 攻速是 DPS 的乘数，不是加数 —— 见 ADR-009。
  // 旧版用 (spd - 1) × 1500 作为加项，导致攻速 0.9 的魔女
  // 在 Lv1 被扣掉 150 战力（总战力才 200 出头），直接打不了第一关。
  return Math.round(base * stats.spd);
}

/** 空属性，用于累加 */
export function zeroStats(): Stats {
  return { atk: 0, def: 0, hp: 0, acc: 0, eva: 0, critRate: 0, critDmg: 0, spd: 0 };
}

/** 属性相加（返回新对象，不修改入参） */
export function addStats(a: Stats, b: Partial<Stats>): Stats {
  return {
    atk: a.atk + (b.atk ?? 0),
    def: a.def + (b.def ?? 0),
    hp: a.hp + (b.hp ?? 0),
    acc: a.acc + (b.acc ?? 0),
    eva: a.eva + (b.eva ?? 0),
    critRate: a.critRate + (b.critRate ?? 0),
    critDmg: a.critDmg + (b.critDmg ?? 0),
    spd: a.spd + (b.spd ?? 0),
  };
}
