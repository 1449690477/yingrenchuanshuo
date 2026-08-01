/**
 * 战斗与战力公式。
 * 全部定义见 docs/10-数值与战斗.md 第二节。
 *
 * 本文件是纯函数，无状态，随机性一律通过参数传入 Rng。
 */

import type { Combatant, CombatBonuses, DamageResult, Element, Stats } from './types';
import type { Rng } from './rng';
import { makeMonster } from './progression';
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
  return effectiveElementMultiplierFor(
    attacker.element,
    defender.element,
    attacker.combatBonuses?.elementDamage,
  );
}

/**
 * 指定本伤害段元素时的实际属性系数。
 *
 * 追加炎爆等伤害段必须读取它自己的元素，而不是偷用当前武器元素；这样即使
 * 未来玩家切换武器，固定为 fire 的触发仍会正确吃炎伤与属性克制。
 */
export function effectiveElementMultiplierFor(
  attackerElement: Element,
  defenderElement: Element,
  elementDamage?: Partial<CombatBonuses['elementDamage']>,
): number {
  const base = elementMultiplier(attackerElement, defenderElement);
  if (attackerElement === 'none') return base;
  const bonusPoints = elementDamage?.[attackerElement] ?? 0;
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

  const variance = rng.float(DAMAGE_VARIANCE_MIN, DAMAGE_VARIANCE_MAX);
  const critMul = crit ? critMultiplier(attacker.stats.critDmg) : 1;

  return {
    damage: damageAfterConfirmedHit(
      attacker,
      defender,
      skillMultiplier,
      attacker.element,
      variance,
      critMul,
    ),
    hit: true,
    crit,
  };
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

  const avgVariance = (DAMAGE_VARIANCE_MIN + DAMAGE_VARIANCE_MAX) / 2;
  const avgCritMul = 1 + critP * (critMultiplier(attacker.stats.critDmg) - 1);
  return (
    hitP *
    damageAfterConfirmedHit(
      attacker,
      defender,
      skillMultiplier,
      attacker.element,
      avgVariance,
      avgCritMul,
    )
  );
}

/**
 * 已由一个直接伤害段确认命中后，结算一段不暴击的追加元素伤害。
 *
 * 不再进行命中或暴击判定，只推进一次浮动 RNG；调用方也不得给这段伤害吸血
 * 或再次送进 on-hit 管线。防御、目标减伤、属性克制与同系元素伤害仍完整生效。
 */
export function calcConfirmedElementalDamage(
  attacker: Combatant,
  defender: Combatant,
  atkMultiplier: number,
  element: Exclude<Element, 'none'>,
  rng: Rng,
): number {
  const variance = rng.float(DAMAGE_VARIANCE_MIN, DAMAGE_VARIANCE_MAX);
  return damageAfterConfirmedHit(attacker, defender, atkMultiplier, element, variance, 1);
}

/** calcConfirmedElementalDamage 的无随机期望值版本，供挂机与实战共用同一数学。 */
export function expectedConfirmedElementalDamage(
  attacker: Combatant,
  defender: Combatant,
  atkMultiplier: number,
  element: Exclude<Element, 'none'>,
): number {
  const avgVariance = (DAMAGE_VARIANCE_MIN + DAMAGE_VARIANCE_MAX) / 2;
  return damageAfterConfirmedHit(attacker, defender, atkMultiplier, element, avgVariance, 1);
}

/**
 * 确定性的持续伤害单跳结算。
 *
 * 状态施加时对来源攻击与目标防御做一次伤害快照；不做命中、浮动或暴击判定，
 * 也不消费 RNG。调用方必须把结果放进持续状态时钟，不能重新送入 on-hit 管线。
 */
export function calcPeriodicDamage(
  attacker: Combatant,
  defender: Combatant,
  atkMultiplier: number,
  element: Element = attacker.element,
): number {
  if (!Number.isFinite(atkMultiplier) || atkMultiplier < 0) {
    throw new Error(`持续伤害攻击倍率必须是非负有限数：${atkMultiplier}`);
  }
  if (atkMultiplier === 0 || attacker.stats.atk <= 0) return 0;
  return damageAfterConfirmedHit(attacker, defender, atkMultiplier, element, 1, 1);
}

/**
 * 战力。这只是给玩家看的单一数字指标，用来判断能不能打过某关。
 * 它不参与任何战斗计算。
 *
 * docs/73 批 3（P0-4）重定价：旧版是固定线性权重求和
 * （atk×2 + def×3 + hp×0.15 + acc×1 + eva×1.2 + critRate×250/100 + critDmg×80/100，
 * 再整体乘攻速），而暴击/暴伤的真实价值 ∝ 攻击 × (0.5 + 暴伤/100)，
 * 随等级与装备一起膨胀 —— 固定价让面板对暴击的定价错约 40 倍
 * （docs/73 A2，N2 门禁实测跨度最大 3310×）。
 * 批 3 按「乘法形」重定价：crit/spd 权重从玩家自身属性派生（小督小项），
 * 战力 = 玩家打锚点参考怪的单次期望输出（含攻速）× 扛锚点参考怪的攻击次数
 * 期望（EHP）的几何平均。由此每个属性的面板相对导数恒等于真实 DPS/EHP
 * 相对导数（N2 门禁目标 ≤ 1.20×，实测 ≤ 1.02×），且对非典型构建同样成立
 * —— 构建耦合而不是等级耦合。
 *
 * 批 3-1 锚点化：参考怪与减伤分母两侧全部钉在固定锚点
 * REFERENCE_MONSTER_LEVEL（Lv1），不再随玩家等级走 ——
 * ① 升级不换装不再掉战力（旧版同级参考怪口径 10 级掉 28.7%）；
 * ② level 参数删除，函数回到纯 (stats) 单参，调用点连锁改动归零；
 * ③ 锚点怪属性是确定函数（progression.makeMonster），无运行时随机与
 * 外部依赖；服务端复算与客户端走同一份 core，天然一致。
 *
 * 数字尺度（锚 Lv1，剑士典型养成实测）：Lv1≈61 / Lv81≈23.4 万 / Lv120≈24.2 万。
 */
export const REFERENCE_MONSTER_LEVEL = 1;

export function combatPowerValue(stats: Stats): number {
  const m = makeMonster({
    id: 'ref',
    name: 'ref',
    level: REFERENCE_MONSTER_LEVEL,
    type: 'normal',
    element: 'none',
    lootTableId: 'ref',
    sprite: '',
  }).stats;

  const critAvgP = 1 + clamp(stats.critRate / 100, 0, 1) * (critMultiplier(stats.critDmg) - 1);
  const critAvgM = 1 + clamp(m.critRate / 100, 0, 1) * (critMultiplier(m.critDmg) - 1);
  const avgVariance = (DAMAGE_VARIANCE_MIN + DAMAGE_VARIANCE_MAX) / 2;

  // 输出侧：打锚点参考怪的单次期望伤害 × 攻速（与 expectedDamage 同构）。
  const dps =
    stats.spd *
    hitChance(stats.acc, m.eva) *
    avgVariance *
    stats.atk *
    (1 - damageReduction(m.def, REFERENCE_MONSTER_LEVEL)) *
    critAvgP;

  // 生存侧：扛锚点参考怪的攻击次数期望（EHP = hp ÷ 怪物单次期望伤害）。
  const perHit =
    hitChance(m.acc, stats.eva) *
    avgVariance *
    m.atk *
    (1 - damageReduction(stats.def, REFERENCE_MONSTER_LEVEL)) *
    critAvgM;
  // 没有生命就没有战力：hp<=0 时 EHP 无意义，直接归 0（避免 sqrt(dps*Infinity) 的 NaN 路径）。
  // 真实玩家经 baseStatsFor 必有 hp>0；这只覆盖探针与构造数据。
  if (stats.hp <= 0) return 0;
  const ehp = perHit > 0 ? stats.hp / perHit : Number.POSITIVE_INFINITY;

  const value = Math.sqrt(dps * ehp);
  return Number.isFinite(value) ? value : 0;
}

/** 取整后的战力展示值。排序与门禁请用 combatPowerValue（取整会抹掉小步长导数）。 */
export function combatPower(stats: Stats): number {
  return Math.round(combatPowerValue(stats));
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

function damageAfterConfirmedHit(
  attacker: Combatant,
  defender: Combatant,
  atkMultiplier: number,
  element: Element,
  variance: number,
  critMul: number,
): number {
  const base = attacker.stats.atk * atkMultiplier;
  const reduction = damageReduction(defender.stats.def, attacker.level);
  const bonusDamageMul = combatBonusDamageMultiplier(defender);
  const elemMul = effectiveElementMultiplierFor(
    element,
    defender.element,
    attacker.combatBonuses?.elementDamage,
  );
  const raw = base * (1 - reduction) * bonusDamageMul * variance * critMul * elemMul;
  const floor = attacker.stats.atk * MIN_DAMAGE_RATIO;
  return Math.max(floor, raw);
}
