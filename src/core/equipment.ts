/**
 * 装备属性计算。
 * 公式见 docs/12-装备体系.md，两类属性的区别见 ADR-006。
 */

import type { Affix, EquipmentDef, EquipmentInstance, ForgeStage, Quality, Stats } from './types';
import type { Rng } from './rng';
import { addStats, zeroStats } from './formula';
import {
  AFFIX_POOL,
  ENHANCE_GAIN_TIERS,
  ENHANCE_MAX,
  ENHANCE_TOTAL_GAIN_CAP_PERMILLE,
  EQUIPMENT_BASE_ROLL_MAX,
  EQUIPMENT_BASE_ROLL_MIN,
  EQUIPMENT_BASE_ROLL_TIERS,
  FORGE_STAGE_THRESHOLDS,
  ITEM_BASE,
  ITEM_POW,
  ITEM_SCALE,
  QUALITY_AFFIX_COUNT,
  QUALITY_MUL,
  QUALITY_PCT_SCALE,
  SLOT_PCT_WEIGHTS,
  SLOT_WEIGHTS,
} from '@/data/constants';

export type BaseRollGrade = (typeof EQUIPMENT_BASE_ROLL_TIERS)[number]['id'];
export type EnhanceGainGrade = (typeof ENHANCE_GAIN_TIERS)[number]['id'];

export interface PermilleRoll<TGrade extends string> {
  grade: TGrade;
  permille: number;
}

/** 装备基准值：随等级 L^1.35 与品质增长 */
export function itemBaseValue(level: number, quality: Quality): number {
  if (!Number.isInteger(level) || level < 1) {
    throw new Error(`itemBaseValue: 等级必须是正整数，收到 ${level}`);
  }
  return ITEM_BASE * Math.pow(level, ITEM_POW) * QUALITY_MUL[quality] * ITEM_SCALE;
}

/**
 * 装备的基础属性（不含随机词条、不含强化）。
 *
 * 数值型属性乘基准值（随等级增长）；
 * 百分比型属性只乘品质系数（不随等级增长）—— 见 ADR-006。
 */
export function baseEquipStats(def: EquipmentDef): Stats {
  const baseValue = itemBaseValue(def.level, def.quality);
  const pctScale = QUALITY_PCT_SCALE[def.quality];
  const out = zeroStats();

  for (const [key, w] of Object.entries(SLOT_WEIGHTS[def.slot]) as [keyof Stats, number][]) {
    out[key] += baseValue * w;
  }
  for (const [key, w] of Object.entries(SLOT_PCT_WEIGHTS[def.slot]) as [keyof Stats, number][]) {
    out[key] += pctScale * w;
  }
  return out;
}

/**
 * 按实例已固定的逐级增幅计算强化倍率。
 *
 * 首次成功到达某一级时才会写入该格；掉级后保留原结果，重新升回不重掷。
 */
export function enhanceMultiplier(
  enhanceLevel: number,
  enhanceGainPermille: readonly number[],
): number {
  if (!Number.isInteger(enhanceLevel) || enhanceLevel < 0 || enhanceLevel > ENHANCE_MAX) {
    throw new Error(`enhanceMultiplier: 强化等级必须在 0~${ENHANCE_MAX}，收到 ${enhanceLevel}`);
  }
  assertEnhanceGainArray(enhanceGainPermille, enhanceLevel);

  const totalGain = enhanceGainPermille.slice(0, enhanceLevel).reduce((sum, gain) => sum + gain, 0);
  return 1 + Math.min(totalGain, ENHANCE_TOTAL_GAIN_CAP_PERMILLE) / 1000;
}

/**
 * 一件装备实例提供的全部属性 = (基础属性 × 强化倍率) + 词条。
 *
 * 注意强化只放大基础属性，不放大词条 —— 否则「洗出极品词条再强化」
 * 会产生乘法叠加，让运气好的玩家和普通玩家差出几倍。
 */
export function instanceStats(def: EquipmentDef, inst: EquipmentInstance): Stats {
  const base = baseEquipStats(def);
  assertBaseRoll(inst.baseRollPermille);
  const mul =
    (inst.baseRollPermille / 1000) * enhanceMultiplier(inst.enhance, inst.enhanceGainPermille);

  let out: Stats = {
    atk: base.atk * mul,
    def: base.def * mul,
    hp: base.hp * mul,
    acc: base.acc * mul,
    eva: base.eva * mul,
    // 百分比属性不受强化影响
    critRate: base.critRate,
    critDmg: base.critDmg,
    spd: base.spd,
  };

  for (const a of [...(def.fixedAffixes ?? []), ...inst.affixes]) {
    out = applyAffix(out, a);
  }
  return out;
}

/** 把一条词条加到属性上。elemDmg / lifesteal 等非 Stats 字段暂不计入战力，M5 再处理。 */
export function applyAffix(stats: Stats, affix: Affix): Stats {
  switch (affix.key) {
    case 'atk':
    case 'def':
    case 'hp':
    case 'acc':
    case 'eva':
    case 'critRate':
    case 'critDmg':
    case 'spd':
      return addStats(stats, { [affix.key]: affix.value });
    default:
      // dmgReduce / elemDmg / lifesteal / skillMul 走独立结算，不进 Stats
      return stats;
  }
}

/** 全身装备的属性总和 */
export function totalEquipStats(
  equipped: (EquipmentInstance | null)[],
  defOf: (defId: string) => EquipmentDef | undefined,
): Stats {
  let out = zeroStats();
  for (const inst of equipped) {
    if (!inst) continue;
    const def = defOf(inst.defId);
    if (!def) throw new Error(`[配置错误] 装备定义不存在：${inst.defId}`);
    out = addStats(out, instanceStats(def, inst));
  }
  return out;
}

// ─────────────────────── 随机词条生成 ───────────────────────

/** 掷出一件掉落装备的基础胚子；最低为旧版 100%，不会出现负提升。 */
export function rollBasePermille(rng: Rng): PermilleRoll<BaseRollGrade> {
  const tier = rng.weighted(EQUIPMENT_BASE_ROLL_TIERS, (entry) => entry.weight);
  return {
    grade: tier.id,
    permille: rng.int(tier.min, tier.max),
  };
}

/** 强化首次成功到达某一级时掷出的永久单级增幅。 */
export function rollEnhanceGainPermille(rng: Rng): PermilleRoll<EnhanceGainGrade> {
  const tier = rng.weighted(ENHANCE_GAIN_TIERS, (entry) => entry.weight);
  return {
    grade: tier.id,
    permille: rng.int(tier.min, tier.max),
  };
}

export function baseRollGrade(permille: number): BaseRollGrade {
  assertBaseRoll(permille);
  const tier = EQUIPMENT_BASE_ROLL_TIERS.find(
    (entry) => permille >= entry.min && permille <= entry.max,
  );
  if (!tier) throw new Error(`baseRollGrade: 未配置的胚子数值 ${permille}`);
  return tier.id;
}

export function enhanceGainGrade(permille: number): EnhanceGainGrade {
  const tier = ENHANCE_GAIN_TIERS.find((entry) => permille >= entry.min && permille <= entry.max);
  if (!tier || !Number.isInteger(permille)) {
    throw new Error(`enhanceGainGrade: 未配置的强化增幅 ${permille}`);
  }
  return tier.id;
}

/** +5 / +9 / +12 / +15 的独立锻造外观阶段。 */
export function forgeStageAt(enhanceLevel: number): ForgeStage {
  if (!Number.isInteger(enhanceLevel) || enhanceLevel < 0 || enhanceLevel > ENHANCE_MAX) {
    throw new Error(`forgeStageAt: 强化等级必须在 0~${ENHANCE_MAX}，收到 ${enhanceLevel}`);
  }
  const matched = FORGE_STAGE_THRESHOLDS.find((entry) => enhanceLevel >= entry.minLevel);
  if (!matched) throw new Error(`[配置错误] 缺少强化等级 ${enhanceLevel} 的锻造阶段`);
  return matched.stage;
}

/**
 * 按品质掷出随机词条。同一 key 不重复。
 * 数值范围随装备等级缩放，见 docs/12 词条池。
 */
export function rollAffixes(def: EquipmentDef, rng: Rng): Affix[] {
  const fixedKeys = new Set((def.fixedAffixes ?? []).map((affix) => affix.key));
  const count = Math.max(0, QUALITY_AFFIX_COUNT[def.quality] - fixedKeys.size);
  if (count <= 0) return [];

  const pool = AFFIX_POOL.filter((entry) => !fixedKeys.has(entry.key));
  const out: Affix[] = [];

  for (let i = 0; i < count && pool.length > 0; i++) {
    const picked = rng.weighted(pool, (e) => e.weight);
    pool.splice(pool.indexOf(picked), 1);

    const scale = picked.scalesWithLevel ? Math.pow(def.level, 1.3) : 1;
    const value = rng.float(picked.min * scale, picked.max * scale);
    const precision = 10 ** picked.decimals;

    out.push({
      key: picked.key,
      value: Math.round(value * precision) / precision,
    });
  }
  return out;
}

/** 生成一件装备实例 */
export function createInstance(def: EquipmentDef, rng: Rng, uid: string): EquipmentInstance {
  const baseRoll = rollBasePermille(rng);
  return {
    uid,
    defId: def.id,
    enhance: 0,
    baseRollPermille: baseRoll.permille,
    enhanceGainPermille: Array<number>(ENHANCE_MAX).fill(0),
    enhanceLuck: {},
    affixes: rollAffixes(def, rng),
    // 奇迹胚子自动锁定，避免一键分解白绿装时误删惊喜掉落。
    locked: baseRoll.grade === 'miracle',
  };
}

/** 珍品商店、珍品 BOSS 同款与预览使用确定实例，购买时绝不盲抽。 */
export function createFixedInstance(
  def: EquipmentDef,
  uid: string,
  locked: boolean,
): EquipmentInstance {
  return {
    uid,
    defId: def.id,
    enhance: 0,
    baseRollPermille: 1000,
    enhanceGainPermille: Array<number>(ENHANCE_MAX).fill(0),
    enhanceLuck: {},
    affixes: [],
    locked,
  };
}

function assertBaseRoll(permille: number): void {
  if (
    !Number.isInteger(permille) ||
    permille < EQUIPMENT_BASE_ROLL_MIN ||
    permille > EQUIPMENT_BASE_ROLL_MAX
  ) {
    throw new Error(
      `装备胚子倍率必须是 ${EQUIPMENT_BASE_ROLL_MIN}~${EQUIPMENT_BASE_ROLL_MAX} 的整数，收到 ${permille}`,
    );
  }
}

function assertEnhanceGainArray(gains: readonly number[], enhanceLevel: number): void {
  if (gains.length !== ENHANCE_MAX) {
    throw new Error(`强化增幅记录必须固定为 ${ENHANCE_MAX} 格，收到 ${gains.length}`);
  }

  gains.forEach((gain, index) => {
    const configured =
      gain === 0 || ENHANCE_GAIN_TIERS.some((tier) => gain >= tier.min && gain <= tier.max);
    if (!Number.isInteger(gain) || !configured) {
      throw new Error(`强化增幅第 ${index + 1} 格不合法：${gain}`);
    }
    if (index < enhanceLevel && gain === 0) {
      throw new Error(`当前已强化到 +${enhanceLevel}，第 ${index + 1} 格增幅不能为 0`);
    }
  });
}
