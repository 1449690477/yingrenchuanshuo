/**
 * 试炼成绩的物理上界（docs/78 §六，2026-07-31 线上事故后补）。
 *
 * ## 为什么需要它：一个真实发生过的绕过
 *
 * submit-trial 会用**客户端自报的等级**做三件事：挑分段 Boss、组建角色、
 * 校验装备是否越级。三件都用同一个自报值，于是它们互相"自洽"——
 * 报 Lv81 + 一套 Lv81 装备，每一条校验都过，服务端老老实实算出 Lv81 的伤害。
 *
 * 线上实例（绿玩，2026-07-30 23:09）：真实档案 Lv13 / 战力 1593，
 * 却提交出 1,489,904 伤害 —— 而 Lv13 所在分段的 Boss 总血量只有 97,404。
 * **他报的伤害比整个 Boss 的血还多 15 倍**，因为那个数来自另一个分段。
 *
 * ## 判据形状：拿玩家的权威等级去算，而不是拿他自报的等级
 *
 * 服务端已经有一份不受本次提交影响的权威等级 —— `profiles.level`，
 * 由 sync-profile 从真实存档写入。用它算出「这个玩家在他真实等级上
 * 最多能打出多少」，超过就是物理不可能。
 *
 * 与 combatPowerBound 同一条职责边界：**拒绝物理上不可能，不拒绝比别人强得多。**
 * 满配肝帝把 Boss 打死（伤害 = Boss 满血）是完全合法的，本模块必须放行。
 *
 * 与 core 其余模块同规：纯函数，不碰 Vue / Pinia / storage / DOM。
 */

import type { ClassId, EquipmentInstance, EquipSlot } from './types';
import { EQUIPMENT } from '../data/equipment';
import { ENHANCE_GAIN_MAX, ENHANCE_MAX, EQUIPMENT_BASE_ROLL_MAX, SLOT_ORDER } from '../data/constants';
import { TRIAL_SEASON_ID } from '../data/trialRules';
import { itemBaseValue } from './equipment';
import {
  buildTrialCombatant,
  runTrial,
  trialBracketFor,
  trialScoreSeed,
  weeklyTrialBoss,
} from './trial';

/**
 * 词条与套装的余量。
 *
 * 上界探针不带词条（词条值按品阶随机，塞进"最强"构造里不诚实），
 * 而全 T5 词条相对新掉落最多再 +25%。取 1.5 与 combatPowerBound 的
 * COMBAT_POWER_HEADROOM 同值同理由 —— 两处上界的余量口径必须一致，
 * 否则同一个玩家在两条链上会得到不同的"可能/不可能"结论。
 */
export const TRIAL_DAMAGE_HEADROOM = 1.5;

/** 该槽位在该等级能穿到的最强定义：按真实基准值排序，不按名字或品质猜。 */
function strongestDefFor(slot: EquipSlot, level: number, classId: ClassId): string | null {
  let best: { id: string; value: number } | null = null;
  for (const def of Object.values(EQUIPMENT)) {
    if (def.slot !== slot) continue;
    if (def.level > level) continue;
    if (def.classId !== undefined && def.classId !== classId) continue;
    const value = itemBaseValue(def.level, def.quality);
    if (!best || value > best.value) best = { id: def.id, value };
  }
  return best?.id ?? null;
}

/** 物理上最强的一件：基础值满掷 + 全 +15 且每级都掷出最高增益。 */
function maxedInstance(defId: string, uid: string): EquipmentInstance {
  return {
    uid,
    defId,
    enhance: ENHANCE_MAX,
    // 与 combatPowerBound 的差异是刻意的：这里取掷值**上限**而不是下限。
    // 上界就该用上限 —— 用下限会把上界算低，让合法的欧皇变成"不可能"。
    baseRollPermille: EQUIPMENT_BASE_ROLL_MAX,
    enhanceGainPermille: Array<number>(ENHANCE_MAX).fill(ENHANCE_GAIN_MAX),
    enhanceLuck: {},
    affixes: [],
    reforgeResonance: 0,
    locked: false,
  };
}

const maxDamageCache = new Map<string, number>();

/**
 * 该等级该职业在指定周次**物理上能打出的最高试炼伤害**。
 *
 * 用玩家实际结算那条链路（buildTrialCombatant → runTrial），不另立公式。
 * 注意伤害天然被 Boss 血量封顶：把 Boss 打死就是这个分段的满伤，
 * 所以「伤害 = Boss 满血」是合法上限而不是异常。
 */
export function maxPlausibleTrialDamage(
  level: number,
  classId: ClassId,
  weekIndex: number,
): number {
  const key = `${level}:${classId}:${weekIndex}`;
  const cached = maxDamageCache.get(key);
  if (cached !== undefined) return cached;

  const equipped = SLOT_ORDER.map((slot, index) => {
    const defId = strongestDefFor(slot, level, classId);
    return defId ? maxedInstance(defId, `trial-ceiling-${index}`) : null;
  });
  const build = buildTrialCombatant({ name: '上界探针', classId, level, equipped });
  const bracketId = trialBracketFor(level).id;
  const boss = weeklyTrialBoss(TRIAL_SEASON_ID, weekIndex, bracketId);
  const seed = trialScoreSeed(TRIAL_SEASON_ID, weekIndex, bracketId, build.buildHash);
  const damage = runTrial(build, boss.combatant, seed).damage;

  maxDamageCache.set(key, damage);
  return damage;
}

/** 该等级该职业允许出现的最高试炼伤害（含词条余量）。 */
export function trialDamageCeiling(
  level: number,
  classId: ClassId,
  weekIndex: number,
): number {
  return maxPlausibleTrialDamage(level, classId, weekIndex) * TRIAL_DAMAGE_HEADROOM;
}

/**
 * 这条试炼成绩是否可能属于一个真实玩家。
 *
 * @param level **权威等级**（profiles.level，由 sync-profile 从真实存档写入），
 *              绝不能传客户端本次自报的等级 —— 那正是被伪造的那个值。
 */
export function isPlausibleTrialDamage(
  damage: number,
  level: number,
  classId: ClassId,
  weekIndex: number,
): boolean {
  if (!Number.isFinite(damage) || damage < 0) return false;
  if (!Number.isInteger(level) || level < 1 || level > 120) return false;
  return damage <= trialDamageCeiling(level, classId, weekIndex);
}
