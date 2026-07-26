/**
 * 装备属性计算。
 * 公式见 docs/12-装备体系.md，两类属性的区别见 ADR-006。
 */

import type { Affix, EquipmentDef, EquipmentInstance, Quality, Stats } from './types';
import type { Rng } from './rng';
import { addStats, zeroStats } from './formula';
import {
  AFFIX_POOL,
  ENHANCE_MAX,
  ENHANCE_PER_LEVEL,
  ITEM_BASE,
  ITEM_POW,
  ITEM_SCALE,
  QUALITY_AFFIX_COUNT,
  QUALITY_MUL,
  QUALITY_PCT_SCALE,
  SLOT_PCT_WEIGHTS,
  SLOT_WEIGHTS,
} from '@/data/constants';

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

/** 强化倍率。+15 时为 2.2 倍 */
export function enhanceMultiplier(enhanceLevel: number): number {
  if (!Number.isInteger(enhanceLevel) || enhanceLevel < 0 || enhanceLevel > ENHANCE_MAX) {
    throw new Error(`enhanceMultiplier: 强化等级必须在 0~${ENHANCE_MAX}，收到 ${enhanceLevel}`);
  }
  return 1 + ENHANCE_PER_LEVEL * enhanceLevel;
}

/**
 * 一件装备实例提供的全部属性 = (基础属性 × 强化倍率) + 词条。
 *
 * 注意强化只放大基础属性，不放大词条 —— 否则「洗出极品词条再强化」
 * 会产生乘法叠加，让运气好的玩家和普通玩家差出几倍。
 */
export function instanceStats(def: EquipmentDef, inst: EquipmentInstance): Stats {
  const base = baseEquipStats(def);
  const mul = enhanceMultiplier(inst.enhance);

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

/**
 * 按品质掷出随机词条。同一 key 不重复。
 * 数值范围随装备等级缩放，见 docs/12 词条池。
 */
export function rollAffixes(def: EquipmentDef, rng: Rng): Affix[] {
  const count = QUALITY_AFFIX_COUNT[def.quality];
  if (count <= 0) return [];

  const pool = [...AFFIX_POOL];
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
  return { uid, defId: def.id, enhance: 0, affixes: rollAffixes(def, rng), locked: false };
}
