/**
 * 装备属性计算。
 * 公式见 docs/12-装备体系.md，两类属性的区别见 ADR-006。
 */

import type {
  Affix,
  AffixKey,
  AffixTier,
  ClassId,
  CombatBonuses,
  Element,
  EquipmentDef,
  EquipmentInstance,
  EquipSlot,
  FixedAffix,
  ForgeStage,
  Quality,
  Stats,
} from './types';
import type { Rng } from './rng';
import { addStats, zeroStats } from './formula';
import { shouldAutoLock } from './bag';
import { EQUIPMENT } from '@/data/equipment';
import { typicalQualityAt } from '@/data/qualitySchedule';
import {
  AFFIX_POOL,
  AFFIX_TIERS,
  AFFIX_VALUE_VARIANCE,
  availableAffixElementsAtLevel,
  ENHANCE_GAIN_TIERS,
  ENHANCE_MAX,
  ENHANCE_TOTAL_GAIN_CAP_PERMILLE,
  EQUIPMENT_BASE_ROLL_MAX,
  EQUIPMENT_BASE_ROLL_MIN,
  EQUIPMENT_BASE_ROLL_TIERS,
  FORGE_STAGE_THRESHOLDS,
  isAffixGenerationActive,
  isAffixGenerationLevelUnlocked,
  isAffixSettlementActive,
  ITEM_BASE,
  ITEM_POW,
  ITEM_SCALE,
  LEGACY_V10_AFFIX_TIER_MULTIPLIERS,
  PROFESSION_AFFIX_POOLS,
  QUALITY_AFFIX_COUNT,
  QUALITY_MUL,
  QUALITY_PCT_SCALE,
  QUALITY_PROFESSION_AFFIX_COUNT,
  SLOT_PCT_WEIGHTS,
  SLOT_WEIGHTS,
} from '@/data/constants';
import type {
  AffixPoolEntry,
  ProfessionAffixPoolEntry,
  ProfessionAffixRole,
} from '@/data/constants';
import {
  baselineHistoryFor,
  isV10RebasedAffixKey,
  V10_PROFESSION_AFFIX_REBASE,
} from '@/data/legacyAffixHistory';

export type BaseRollGrade = (typeof EQUIPMENT_BASE_ROLL_TIERS)[number]['id'];
export type EnhanceGainGrade = (typeof ENHANCE_GAIN_TIERS)[number]['id'];

export interface PermilleRoll<TGrade extends string> {
  grade: TGrade;
  permille: number;
}

export interface AffixValueRange {
  min: number;
  max: number;
  decimals: number;
}

/**
 * 读取武器的权威攻击属性。
 *
 * EquipmentDef 在类型层保证武器必须显式填写 element；这里再拒绝非武器，
 * 防止调用方把首饰、关卡属性或词条误接成玩家的基础攻击属性。
 */
export function weaponElementOf(definition: EquipmentDef): Element {
  if (definition.slot !== 'weapon') {
    throw new Error(`[配置错误] 只有武器能提供基础攻击属性：${definition.id}`);
  }
  return definition.element;
}

/** 装备基准值：随等级 L^1.35 与品质增长 */
export function itemBaseValue(level: number, quality: Quality): number {
  if (!Number.isInteger(level) || level < 1) {
    throw new Error(`itemBaseValue: 等级必须是正整数，收到 ${level}`);
  }
  return ITEM_BASE * Math.pow(level, ITEM_POW) * QUALITY_MUL[quality] * ITEM_SCALE;
}

/** 只认区域主线装备 `eq_r{n}_{部位}_{品质}`，不碰珍品/好感/竞技/副本旧装。 */
export const REGIONAL_BLANK_ID = /^eq_r\d+_[a-z]+_[a-z]+$/;

/**
 * ★ 选装计算（docs/73 A3 / 批 2-1，修正②）。
 *
 * 从真实装备定义表选出「锚点等级的主线典型基准值」下最强的一件 ——
 * 主线推荐战力（expectedPower）与副本胚子（blankDefinitionId）共用
 * 同一选择函数族：**推荐战力与实际难度来自同一条链，量化误差自动吸收**
 * （docs/71 §六.3 小尺先例；docs/66 §3.2 的教训是公式自证）。
 *
 * 约束（与旧 blankDefinitionId 完全一致，逐条有真实反例）：
 *   - 等级不得超过锚点：高等级低品质换算会绕过「掉落等级由地点决定」
 *     （violet d4 曾选中 r6 rare(Lv58)，docs/66 §3.5）；
 *   - 带定义级 setId 的不能选：不可烙印 = 违反 docs/58 红线；
 *   - 基准值不得超过锚点典型基准值（取不超模的最强定义）。
 */
export function selectStrongestDefinition(slot: EquipSlot, anchorLevel: number): string {
  const ceiling = itemBaseValue(anchorLevel, typicalQualityAt(anchorLevel));
  let best: { id: string; value: number } | undefined;

  for (const definition of Object.values(EQUIPMENT)) {
    if (definition.slot !== slot) continue;
    if (!REGIONAL_BLANK_ID.test(definition.id)) continue;
    if (definition.setId) continue;
    if (definition.level > anchorLevel) continue;
    const value = itemBaseValue(definition.level, definition.quality);
    if (value > ceiling + 1e-9) continue;
    if (!best || value > best.value) best = { id: definition.id, value };
  }

  if (!best) {
    throw new Error(
      `[配置错误] 部位 ${slot} 在锚点 Lv${anchorLevel} 找不到任何不超模的主线胚子定义 ` +
        `—— 最低品质的区域装备也高于该等级的主线典型（docs/66 §3.5）`,
    );
  }
  return best.id;
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
  return instanceStatsWhere(def, inst, () => true);
}

/**
 * 一件装备对指定职业真实生效的基础属性。
 *
 * 通用装备可以在切换职业后继续穿着，但上面的职业专属词条只能由所属职业结算；
 * 词条本身仍原样保留，方便玩家切回原职业或通过重铸替换。
 */
export function instanceStatsForClass(
  def: EquipmentDef,
  inst: EquipmentInstance,
  classId: ClassId,
): Stats {
  return instanceStatsWhere(def, inst, (affix) => affixAppliesToClass(affix.key, classId));
}

function instanceStatsWhere(
  def: EquipmentDef,
  inst: EquipmentInstance,
  includeAffix: (affix: FixedAffix) => boolean,
): Stats {
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
    if (!includeAffix(a)) continue;
    out = applyAffix(out, a);
  }
  return out;
}

/** 把一条基础属性词条加到 Stats 上；独立战斗词条由 applyCombatAffix 处理。 */
export function applyAffix(stats: Stats, affix: FixedAffix): Stats {
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
    case 'swd_guard':
      return addStats(stats, { def: affix.value });
    case 'swd_force':
      return addStats(stats, { atk: affix.value });
    case 'swd_heavy':
      return addStats(stats, { critDmg: affix.value });
    case 'wit_power':
      return addStats(stats, { atk: affix.value });
    case 'wit_veil':
      return addStats(stats, { eva: affix.value });
    case 'wit_vitality':
      return addStats(stats, { hp: affix.value });
    case 'sha_vitality':
      return addStats(stats, { hp: affix.value });
    case 'sha_spirit':
      return addStats(stats, { atk: affix.value });
    case 'sha_ember':
      return addStats(stats, { critDmg: affix.value });
    case 'cat_swift':
      return addStats(stats, { spd: affix.value });
    case 'cat_nimble':
      return addStats(stats, { eva: affix.value });
    case 'cat_tough':
      return addStats(stats, { hp: affix.value });
    case 'cat_sharp':
      return addStats(stats, { atk: affix.value });
    case 'kenshi_blade':
      return addStats(stats, { critDmg: affix.value });
    case 'kenshi_honor':
      return addStats(stats, { hp: affix.value });
    default:
      // 独立战斗词条不能混入八项基础属性。
      return stats;
  }
}

/** 空战斗修正，用于安全累加。 */
export function zeroCombatBonuses(): CombatBonuses {
  return {
    damageReduction: 0,
    lifesteal: 0,
    elementDamage: { fire: 0, ice: 0, thunder: 0 },
    skillDamage: 0,
    armorPenetration: 0,
  };
}

/** 战斗修正相加（返回新对象，不修改入参）。 */
export function addCombatBonuses(
  a: CombatBonuses,
  b: Partial<Omit<CombatBonuses, 'elementDamage'>> & {
    elementDamage?: Partial<CombatBonuses['elementDamage']>;
  },
): CombatBonuses {
  return {
    damageReduction: a.damageReduction + (b.damageReduction ?? 0),
    lifesteal: a.lifesteal + (b.lifesteal ?? 0),
    elementDamage: {
      fire: a.elementDamage.fire + (b.elementDamage?.fire ?? 0),
      ice: a.elementDamage.ice + (b.elementDamage?.ice ?? 0),
      thunder: a.elementDamage.thunder + (b.elementDamage?.thunder ?? 0),
    },
    skillDamage: (a.skillDamage ?? 0) + (b.skillDamage ?? 0),
    armorPenetration: (a.armorPenetration ?? 0) + (b.armorPenetration ?? 0),
  };
}

/** 把一条独立战斗词条计入结算修正。 */
export function applyCombatAffix(bonuses: CombatBonuses, affix: FixedAffix): CombatBonuses {
  if (!isAffixSettlementActive(affix.key)) return bonuses;
  switch (affix.key) {
    case 'dmgReduce':
    case 'sha_ward':
    case 'kenshi_bushido':
      return addCombatBonuses(bonuses, { damageReduction: affix.value });
    case 'lifesteal':
    case 'sha_drain':
      return addCombatBonuses(bonuses, { lifesteal: affix.value });
    case 'skillMul':
      return addCombatBonuses(bonuses, { skillDamage: affix.value });
    case 'kenshi_iai':
      return addCombatBonuses(bonuses, { armorPenetration: affix.value });
    case 'elemDmg':
    case 'wit_elem': {
      if (!affix.element || affix.element === 'none') {
        throw new Error('elemDmg 词条必须绑定 fire / ice / thunder 之一');
      }
      return addCombatBonuses(bonuses, {
        elementDamage: { [affix.element]: affix.value },
      });
    }
    default:
      return bonuses;
  }
}

/** 一件装备实例提供的独立战斗修正。 */
export function instanceCombatBonuses(def: EquipmentDef, inst: EquipmentInstance): CombatBonuses {
  return instanceCombatBonusesForClass(def, inst, null);
}

/** 一件装备对指定职业真实生效的独立战斗修正。 */
export function instanceCombatBonusesForClass(
  def: EquipmentDef,
  inst: EquipmentInstance,
  classId: ClassId | null,
): CombatBonuses {
  let out = zeroCombatBonuses();
  for (const affix of [...(def.fixedAffixes ?? []), ...inst.affixes]) {
    if (classId !== null && !affixAppliesToClass(affix.key, classId)) continue;
    out = applyCombatAffix(out, affix);
  }
  return out;
}

/** 词条是否属于当前职业；通用词条对所有职业生效。 */
export function affixAppliesToClass(key: AffixKey, classId: ClassId): boolean {
  const owner = professionForAffix(key);
  return owner === null || owner === classId;
}

/** 返回职业词条的唯一归属；通用词条返回 null。 */
export function professionForAffix(key: AffixKey): ClassId | null {
  for (const classId of Object.keys(PROFESSION_AFFIX_POOLS) as ClassId[]) {
    if (PROFESSION_AFFIX_POOLS[classId].some((entry) => entry.key === key)) return classId;
  }
  return null;
}

/** 全身装备的属性总和 */
export function totalEquipStats(
  equipped: (EquipmentInstance | null)[],
  defOf: (defId: string) => EquipmentDef | undefined,
  classId: ClassId,
): Stats {
  let out = zeroStats();
  for (const inst of equipped) {
    if (!inst) continue;
    const def = defOf(inst.defId);
    if (!def) throw new Error(`[配置错误] 装备定义不存在：${inst.defId}`);
    out = addStats(out, instanceStatsForClass(def, inst, classId));
  }
  return out;
}

/** 全身装备的独立战斗修正总和。 */
export function totalEquipCombatBonuses(
  equipped: (EquipmentInstance | null)[],
  defOf: (defId: string) => EquipmentDef | undefined,
  classId: ClassId,
): CombatBonuses {
  let out = zeroCombatBonuses();
  for (const inst of equipped) {
    if (!inst) continue;
    const def = defOf(inst.defId);
    if (!def) throw new Error(`[配置错误] 装备定义不存在：${inst.defId}`);
    out = addCombatBonuses(out, instanceCombatBonusesForClass(def, inst, classId));
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

/** 按 AFFIX_TIERS 配置权重掷品阶；保底时仅在 T4/T5 中按原权重抽取。 */
export function rollAffixTier(rng: Rng, guaranteedHigh = false): AffixTier {
  const candidates = guaranteedHigh
    ? AFFIX_TIERS.filter((config) => config.tier >= 4)
    : AFFIX_TIERS;
  return rng.weighted(candidates, (config) => config.weight).tier;
}

/** 按“基准值 × 品阶系数 × ±3%”掷出指定词条的数值。 */
export function rollAffixValue(
  spec: AffixPoolEntry,
  level: number,
  tier: AffixTier,
  rng: Rng,
): number {
  const { baseline, multiplier, precision } = affixValueContext(spec, level, tier);
  const variance = rng.float(1 - AFFIX_VALUE_VARIANCE, 1 + AFFIX_VALUE_VARIANCE);
  return Math.round(baseline * multiplier * variance * precision) / precision;
}

/**
 * 指定词条在“等级 × 品阶 × ±3% × 配置小数位”规则下可能生成的离散范围。
 *
 * 原始随机上界虽然不包含端点，但端点附近经过四舍五入后仍可能得到相同数值，
 * 因此持久化校验使用四舍五入后的闭区间。
 */
export function affixValueRange(key: AffixKey, level: number, tier: AffixTier): AffixValueRange {
  const spec = requireAffixSpec(key);
  const { baseline, multiplier, precision } = affixValueContext(spec, level, tier);
  return {
    min: Math.round(baseline * multiplier * (1 - AFFIX_VALUE_VARIANCE) * precision) / precision,
    max: Math.round(baseline * multiplier * (1 + AFFIX_VALUE_VARIANCE) * precision) / precision,
    decimals: spec.decimals,
  };
}

/** 判断一个持久化候选是否可能由当前真实随机公式生成。 */
export function isRolledAffixValue(
  key: AffixKey,
  level: number,
  tier: AffixTier,
  value: number,
): boolean {
  if (!Number.isFinite(value)) return false;
  const range = affixValueRange(key, level, tier);
  const precision = 10 ** range.decimals;
  const scaled = value * precision;
  const hasConfiguredPrecision = Math.abs(scaled - Math.round(scaled)) <= 1e-8;
  return (
    hasConfiguredPrecision &&
    value >= range.min - Number.EPSILON &&
    value <= range.max + Number.EPSILON
  );
}

/**
 * 判断一条已落袋词条是否能由正式版本的生成与迁移链证明。
 *
 * 当前新掉落使用“基准中点 × 品阶 × ±3%”；但 v9 使用 min~max 连续区间，
 * v9→v10 按冻结系数反推品阶并保值，v10→v11 又把 T5 从 1.54 重标到 1.64。
 * 因此服务端不能只认当前新掉落区间，否则会把真实老存档判成作弊。
 *
 * 这里接受的集合严格是：
 *   1. 当前公式可以生成的值；或
 *   2. v9 旧公式可以生成、且按正式迁移/同调步骤能得到的值。
 *
 * 不接受任意“历史有限数”，也不使用经验战力兜底；超出两套可证明集合的值
 * 仍会被排行榜与竞技场硬拒绝。
 */
export function isVerifiablePersistedAffixValue(
  key: AffixKey,
  level: number,
  tier: AffixTier,
  value: number,
): boolean {
  if (isRolledAffixValue(key, level, tier, value)) return true;
  if (!Number.isFinite(value)) return false;

  const spec = affixSpecForHistory(key);
  if (!spec) return false;

  const precision = 10 ** spec.decimals;
  const scaled = value * precision;
  if (Math.abs(scaled - Math.round(scaled)) > 1e-8) return false;

  // v10 首次加入职业词条，v11 又调整了四条职业基准与 T5 系数。
  // 迁移按最终 value 比例重标并再次四舍五入，因此极少数合法旧值会落在
  // 当前 ±3% 离散区间之外。必须复现完整发布时序，不能拿当前公式反推历史。
  if (isMigratedV10AffixValue(key, level, tier, value, spec)) return true;

  // v11 之后改过基准的职业词条：认旧基准可生成的区间（保值模式，不做迁移重标）。
  // 该条必须在 v10 迁移路径之后检查：旧基准值与 v10 迁移产物可能重叠，
  // 先走迁移路径保持 v10 时序优先。
  if (isLegacyBaselineAffixValue(key, level, tier, value, spec)) return true;

  // v9 只有通用 AFFIX_POOL；职业词条不能借更早历史兼容扩大值域。
  const generalSpec = AFFIX_POOL.find((entry) => entry.key === key);
  if (!generalSpec) return false;
  for (let origin = 1; origin <= tier; origin++) {
    const originTier = origin as AffixTier;
    const legacyRange = legacyV9RangeForInferredTier(generalSpec, level, originTier);
    if (!legacyRange) continue;

    const currentPath = migrateLegacyV9Range(legacyRange, generalSpec, originTier, tier, 'current');
    if (value >= currentPath.min - Number.EPSILON && value <= currentPath.max + Number.EPSILON) {
      return true;
    }

    // 玩家可能在 v10 时已经同调，再进入 v11；T5 的两次四舍五入与
    // “先迁移、后同调”可能差最后一个精度单位，必须把两条正式时序都验入。
    const v10Path = migrateLegacyV9Range(legacyRange, generalSpec, originTier, tier, 'v10');
    if (value >= v10Path.min - Number.EPSILON && value <= v10Path.max + Number.EPSILON) {
      return true;
    }
  }
  return false;
}

type HistoricalAffixSpec = AffixPoolEntry | ProfessionAffixPoolEntry;

function affixSpecForHistory(key: AffixKey): HistoricalAffixSpec | null {
  const general = AFFIX_POOL.find((entry) => entry.key === key);
  if (general) return general;
  for (const pool of Object.values(PROFESSION_AFFIX_POOLS)) {
    const profession = pool.find((entry) => entry.key === key);
    if (profession) return profession;
  }
  return null;
}

/** v10 掉落/洗练可以产生的闭区间（使用 v10 的旧基准与旧品阶系数）。 */
function legacyV10RolledRange(
  key: AffixKey,
  level: number,
  tier: AffixTier,
  spec: HistoricalAffixSpec,
): LegacyAffixValueRange | null {
  if (!Number.isInteger(level) || level < 1) return null;
  const rebase = isV10RebasedAffixKey(key) ? V10_PROFESSION_AFFIX_REBASE[key] : undefined;
  const baseline =
    (rebase?.oldBaseline ?? (spec.min + spec.max) / 2) *
    (spec.scalesWithLevel ? Math.pow(level, 1.3) : 1);
  if (!Number.isFinite(baseline) || baseline <= 0) return null;
  const precision = 10 ** spec.decimals;
  const multiplier = LEGACY_V10_AFFIX_TIER_MULTIPLIERS[tier];
  return {
    min: Math.round(baseline * multiplier * (1 - AFFIX_VALUE_VARIANCE) * precision) / precision,
    max: Math.round(baseline * multiplier * (1 + AFFIX_VALUE_VARIANCE) * precision) / precision,
  };
}

/**
 * v11 之后改过基准的职业词条：判断值是否在某一段历史基准的可生成区间内。
 *
 * 保值模式：旧装备保留旧基准值，不做存档迁移；
 * 服务端校验时认「旧基准 × 当前品阶系数 × ±3%」区间（sha_spirit/kenshi_blade/cat_swift
 * 等，登记在 legacyAffixHistory.AFFIX_BASELINE_HISTORY）。
 * 品阶系数用当前值：这些词条的旧值都是在 v11 之后的当前品阶系数下生成的。
 */
function legacyBaselineRolledRange(
  level: number,
  tier: AffixTier,
  spec: HistoricalAffixSpec,
  oldBaseline: number,
): LegacyAffixValueRange | null {
  if (!Number.isInteger(level) || level < 1) return null;
  const baseline =
    oldBaseline * (spec.scalesWithLevel ? Math.pow(level, 1.3) : 1);
  if (!Number.isFinite(baseline) || baseline <= 0) return null;
  const precision = 10 ** spec.decimals;
  const multiplier = requireAffixTierMultiplier(tier);
  return {
    min: Math.round(baseline * multiplier * (1 - AFFIX_VALUE_VARIANCE) * precision) / precision,
    max: Math.round(baseline * multiplier * (1 + AFFIX_VALUE_VARIANCE) * precision) / precision,
  };
}

function isLegacyBaselineAffixValue(
  key: AffixKey,
  level: number,
  tier: AffixTier,
  expected: number,
  spec: HistoricalAffixSpec,
): boolean {
  const history = baselineHistoryFor(key);
  if (history.length === 0) return false;
  for (const change of history) {
    const rolled = legacyBaselineRolledRange(level, tier, spec, change.oldBaseline);
    if (!rolled) continue;
    if (expected >= rolled.min - Number.EPSILON && expected <= rolled.max + Number.EPSILON) {
      return true;
    }
  }
  return false;
}

/**
 * 判断最终值是否能由“v10 生成/同调 → v11 重标 → v11 同调”得到。
 *
 * `migrationTier` 枚举迁移发生时词条所处的品阶，因而同时覆盖：全在 v10
 * 同调、全在 v11 同调，以及一部分在升级前/一部分在升级后的真实玩家时序。
 */
function isMigratedV10AffixValue(
  key: AffixKey,
  level: number,
  targetTier: AffixTier,
  expected: number,
  spec: HistoricalAffixSpec,
): boolean {
  const tiers = [1, 2, 3, 4, 5] as const satisfies readonly AffixTier[];
  for (const originTier of tiers) {
    if (originTier > targetTier) break;
    const rolled = legacyV10RolledRange(key, level, originTier, spec);
    if (!rolled) continue;
    const precision = 10 ** spec.decimals;
    const minUnit = Math.round(rolled.min * precision);
    const maxUnit = Math.round(rolled.max * precision);
    for (const migrationTier of tiers) {
      if (migrationTier < originTier) continue;
      if (migrationTier > targetTier) break;
      // v10 先按配置精度落袋，再经每一步同调/迁移分别四舍五入。倍率大于 1
      // 时最终离散集合可能有空洞，不能只拿首尾拼成连续范围放宽反作弊。
      for (let unit = minUnit; unit <= maxUnit; unit++) {
        const migrated = migrateV10ValueAcrossV11(
          unit / precision,
          key,
          spec,
          originTier,
          migrationTier,
          targetTier,
        );
        if (Math.abs(expected - migrated) <= Number.EPSILON) return true;
      }
    }
  }
  return false;
}

function migrateV10ValueAcrossV11(
  initial: number,
  key: AffixKey,
  spec: HistoricalAffixSpec,
  originTier: AffixTier,
  migrationTier: AffixTier,
  targetTier: AffixTier,
): number {
  const precision = 10 ** spec.decimals;
  const round = (candidate: number) => Math.round(candidate * precision) / precision;
  const tiers = [1, 2, 3, 4, 5] as const satisfies readonly AffixTier[];
  let value = initial;

  for (let index = tiers.indexOf(originTier); index < tiers.indexOf(migrationTier); index++) {
    const current = tiers[index]!;
    const next = tiers[index + 1]!;
    value = round(
      value *
        (LEGACY_V10_AFFIX_TIER_MULTIPLIERS[next] / LEGACY_V10_AFFIX_TIER_MULTIPLIERS[current]),
    );
  }

  const rebase = isV10RebasedAffixKey(key) ? V10_PROFESSION_AFFIX_REBASE[key] : undefined;
  // migrations.ts 的 rebaseV10Affix 会把基准倍率与 T5 倍率相乘后只做一次
  // 四舍五入；拆成两次会在极少数边界值上相差一个精度单位。
  const baselineMultiplier = rebase ? rebase.newBaseline / rebase.oldBaseline : 1;
  const tierMultiplier =
    migrationTier === 5 ? requireAffixTierMultiplier(5) / LEGACY_V10_AFFIX_TIER_MULTIPLIERS[5] : 1;
  value = round(value * baselineMultiplier * tierMultiplier);

  for (let index = tiers.indexOf(migrationTier); index < tiers.indexOf(targetTier); index++) {
    const current = tiers[index]!;
    const next = tiers[index + 1]!;
    value = round(value * (requireAffixTierMultiplier(next) / requireAffixTierMultiplier(current)));
  }
  return value;
}

interface LegacyAffixValueRange {
  min: number;
  max: number;
}

/**
 * v9 连续区间中，会被 v9→v10 的“最近系数”规则反推为指定品阶的离散值段。
 * 边界复用迁移时的严格小于比较：两档正中点归较低品阶。
 */
function legacyV9RangeForInferredTier(
  spec: AffixPoolEntry,
  level: number,
  tier: AffixTier,
): LegacyAffixValueRange | null {
  if (!Number.isInteger(level) || level < 1) return null;
  const levelScale = spec.scalesWithLevel ? Math.pow(level, 1.3) : 1;
  const baseline = ((spec.min + spec.max) / 2) * levelScale;
  if (!Number.isFinite(baseline) || baseline <= 0) return null;

  const precision = 10 ** spec.decimals;
  const oldMinUnit = Math.round(spec.min * levelScale * precision);
  const oldMaxUnit = Math.round(spec.max * levelScale * precision);
  const tiers = [1, 2, 3, 4, 5] as const satisfies readonly AffixTier[];
  const tierIndex = tiers.indexOf(tier);
  if (tierIndex < 0) return null;

  const currentMultiplier = LEGACY_V10_AFFIX_TIER_MULTIPLIERS[tier];
  const previousTier = tiers[tierIndex - 1];
  const nextTier = tiers[tierIndex + 1];

  let minUnit = oldMinUnit;
  if (previousTier !== undefined) {
    const boundary =
      baseline * ((LEGACY_V10_AFFIX_TIER_MULTIPLIERS[previousTier] + currentMultiplier) / 2);
    minUnit = Math.max(oldMinUnit, Math.floor(boundary * precision) - 1);
  }
  while (minUnit <= oldMaxUnit && inferLegacyV10AffixTier(minUnit / precision, baseline) !== tier) {
    minUnit++;
  }
  while (
    minUnit > oldMinUnit &&
    inferLegacyV10AffixTier((minUnit - 1) / precision, baseline) === tier
  ) {
    minUnit--;
  }

  let maxUnit = oldMaxUnit;
  if (nextTier !== undefined) {
    const boundary =
      baseline * ((currentMultiplier + LEGACY_V10_AFFIX_TIER_MULTIPLIERS[nextTier]) / 2);
    maxUnit = Math.min(oldMaxUnit, Math.floor(boundary * precision) + 1);
  }
  while (maxUnit >= oldMinUnit && inferLegacyV10AffixTier(maxUnit / precision, baseline) !== tier) {
    maxUnit--;
  }
  while (
    maxUnit < oldMaxUnit &&
    inferLegacyV10AffixTier((maxUnit + 1) / precision, baseline) === tier
  ) {
    maxUnit++;
  }

  if (minUnit > maxUnit) return null;
  return { min: minUnit / precision, max: maxUnit / precision };
}

function inferLegacyV10AffixTier(value: number, baseline: number): AffixTier {
  const ratio = value / baseline;
  const tiers = [1, 2, 3, 4, 5] as const satisfies readonly AffixTier[];
  let nearest: AffixTier = tiers[0];
  let nearestDistance = Math.abs(ratio - LEGACY_V10_AFFIX_TIER_MULTIPLIERS[nearest]);
  for (const tier of tiers.slice(1)) {
    const distance = Math.abs(ratio - LEGACY_V10_AFFIX_TIER_MULTIPLIERS[tier]);
    if (distance < nearestDistance) {
      nearest = tier;
      nearestDistance = distance;
    }
  }
  return nearest;
}

function migrateLegacyV9Range(
  range: LegacyAffixValueRange,
  spec: AffixPoolEntry,
  originTier: AffixTier,
  targetTier: AffixTier,
  timing: 'current' | 'v10',
): LegacyAffixValueRange {
  return {
    min: migrateLegacyV9Value(range.min, spec, originTier, targetTier, timing),
    max: migrateLegacyV9Value(range.max, spec, originTier, targetTier, timing),
  };
}

function migrateLegacyV9Value(
  initial: number,
  spec: AffixPoolEntry,
  originTier: AffixTier,
  targetTier: AffixTier,
  timing: 'current' | 'v10',
): number {
  const precision = 10 ** spec.decimals;
  const round = (candidate: number) => Math.round(candidate * precision) / precision;
  const tiers = [1, 2, 3, 4, 5] as const satisfies readonly AffixTier[];
  let value = initial;

  if (timing === 'v10') {
    for (let index = tiers.indexOf(originTier); index < tiers.indexOf(targetTier); index++) {
      const currentTier = tiers[index]!;
      const nextTier = tiers[index + 1]!;
      value = round(
        value *
          (LEGACY_V10_AFFIX_TIER_MULTIPLIERS[nextTier] /
            LEGACY_V10_AFFIX_TIER_MULTIPLIERS[currentTier]),
      );
    }
    if (targetTier === 5) {
      const currentT5 = requireAffixTierMultiplier(5);
      value = round(value * (currentT5 / LEGACY_V10_AFFIX_TIER_MULTIPLIERS[5]));
    }
    return value;
  }

  // 先迁移到 v11：只有原本已经是 T5 的值会立刻做 1.54→1.64 重标。
  if (originTier === 5) {
    value = round(value * (requireAffixTierMultiplier(5) / LEGACY_V10_AFFIX_TIER_MULTIPLIERS[5]));
  }
  for (let index = tiers.indexOf(originTier); index < tiers.indexOf(targetTier); index++) {
    const currentTier = tiers[index]!;
    const nextTier = tiers[index + 1]!;
    value = round(
      value * (requireAffixTierMultiplier(nextTier) / requireAffixTierMultiplier(currentTier)),
    );
  }
  return value;
}

function requireAffixTierMultiplier(tier: AffixTier): number {
  const config = AFFIX_TIERS.find((entry) => entry.tier === tier);
  if (!config) throw new Error(`[配置错误] 未配置词条品阶 T${tier}`);
  return config.multiplier;
}

/** 按指定类型生成一条随机词条；洗练可直接复用，避免复制品阶与数值公式。 */
export function rollAffixForKey(
  key: AffixKey,
  level: number,
  rng: Rng,
  guaranteedHigh = false,
): Affix {
  const spec = requireAffixSpec(key);
  if (!isAffixGenerationActive(key)) {
    throw new Error(`[词条未开放] ${key} 不能生成新实例`);
  }
  const availableElements =
    key === 'elemDmg' || key === 'wit_elem' ? availableAffixElementsAtLevel(level) : null;
  if (availableElements?.length === 0) {
    throw new Error(`[配置错误] Lv${level} 尚无真实武器元素来源，不能生成 ${key}`);
  }

  const tier = rollAffixTier(rng, guaranteedHigh);
  const affix: Affix = {
    key,
    tier,
    value: rollAffixValue(spec, level, tier, rng),
  };
  if (availableElements) {
    affix.element = rng.pick(availableElements);
  }
  return affix;
}

function requireAffixSpec(key: AffixKey): AffixPoolEntry {
  const spec =
    AFFIX_POOL.find((entry) => entry.key === key) ??
    Object.values(PROFESSION_AFFIX_POOLS)
      .flat()
      .find((entry) => entry.key === key);
  if (!spec) throw new Error(`[配置错误] 随机词条池不存在：${key}`);
  return spec;
}

function affixValueContext(
  spec: AffixPoolEntry,
  level: number,
  tier: AffixTier,
): { baseline: number; multiplier: number; precision: number } {
  if (!Number.isInteger(level) || level < 1) {
    throw new Error(`rollAffixValue: 装备等级必须是正整数，收到 ${level}`);
  }
  const tierConfig = AFFIX_TIERS.find((config) => config.tier === tier);
  if (!tierConfig) throw new Error(`rollAffixValue: 未配置的词条品阶 T${tier}`);

  const levelScale = spec.scalesWithLevel ? Math.pow(level, 1.3) : 1;
  return {
    baseline: ((spec.min + spec.max) / 2) * levelScale,
    multiplier: tierConfig.multiplier,
    precision: 10 ** spec.decimals,
  };
}

/**
 * 按品质掷出随机词条。同一 key 不重复。
 * 完整固定模板不生成随机词条；部分固定词条占用对应槽位后，仍优先补足职业槽。
 * 输出顺序固定为“通用词条在前、职业词条在末”，供装备详情稳定展示。
 */
export function rollAffixes(def: EquipmentDef, rng: Rng, classId: ClassId): Affix[] {
  const { fixedKeys, fixedCount, capacity } = validateFixedAffixLayout(def);
  const professionPool = requireProfessionAffixPool(classId);

  // 固定模板装备的品质容量已被 fixedAffixes 写满，这里剩下的正好是额外槽位；
  // 普通装备则是「容量 − 已固定」。两种情况同一个式子即可。
  const count = capacity - fixedCount;
  if (count <= 0) return [];

  const requiredProfessionCount = QUALITY_PROFESSION_AFFIX_COUNT[def.quality];
  const professionCount = Math.min(count, requiredProfessionCount);
  const generalCount = count - professionCount;

  const generalPool = AFFIX_POOL.filter(
    (entry) =>
      isAffixGenerationActive(entry.key) &&
      isAffixGenerationLevelUnlocked(entry.key, def.level) &&
      !fixedKeys.has(entry.key),
  );
  const availableProfessionPool = professionPool.filter(
    (entry) =>
      isAffixGenerationActive(entry.key) &&
      isAffixGenerationLevelUnlocked(entry.key, def.level) &&
      !fixedKeys.has(entry.key),
  );
  if (generalPool.length < generalCount || availableProfessionPool.length < professionCount) {
    throw new Error(
      `[配置错误] ${def.id} 的可用词条不足：需要 ${generalCount} 条通用、${professionCount} 条 ${classId} 专属`,
    );
  }

  const out: Affix[] = [];

  for (let i = 0; i < generalCount; i++) {
    const picked = rng.weighted(generalPool, (entry) => entry.weight);
    generalPool.splice(generalPool.indexOf(picked), 1);
    out.push(rollAffixForKey(picked.key, def.level, rng));
  }
  for (let i = 0; i < professionCount; i++) {
    const picked = pickProfessionAffixSpec(availableProfessionPool, rng);
    availableProfessionPool.splice(availableProfessionPool.indexOf(picked), 1);
    out.push(rollAffixForKey(picked.key, def.level, rng));
  }
  return out;
}

/**
 * 职业槽按“定位等概率、定位内按权重”抽取。
 *
 * 若某一定位已经被同件装备的前一个职业槽取尽，则只在仍有候选的定位中抽。
 * 这保证词条池扩容不会因为某职业恰好多写了几条生存词条，就暗中把该职业的
 * 整体掉落倾向改成纯生存。
 */
export function pickProfessionAffixSpec(
  candidates: readonly ProfessionAffixPoolEntry[],
  rng: Rng,
): ProfessionAffixPoolEntry {
  if (candidates.length === 0) {
    throw new Error('pickProfessionAffixSpec: 职业词条候选为空');
  }
  const roleOrder: readonly ProfessionAffixRole[] = ['offense', 'sustain'];
  const availableRoles = roleOrder.filter((role) =>
    candidates.some((entry) => entry.balanceRole === role),
  );
  const role = rng.pick(availableRoles);
  const roleCandidates = candidates.filter((entry) => entry.balanceRole === role);
  return rng.weighted(roleCandidates, (entry) => entry.weight);
}

/** 生成一件装备实例 */
export function createInstance(
  def: EquipmentDef,
  rng: Rng,
  uid: string,
  classId: ClassId,
): EquipmentInstance {
  const baseRoll = rollBasePermille(rng);
  return {
    uid,
    defId: def.id,
    enhance: 0,
    baseRollPermille: baseRoll.permille,
    enhanceGainPermille: Array<number>(ENHANCE_MAX).fill(0),
    enhanceLuck: {},
    affixes: rollAffixes(def, rng, classId),
    reforgeResonance: 0,
    // 自动上锁看品质而不只看胚子，理由见 core/bag.ts 的 shouldAutoLock
    locked: shouldAutoLock(def.quality, baseRoll.grade === 'miracle'),
  };
}

/** 职业上下文是生成装备的必要输入；缺失或非法时直接暴露主流程错误。 */
function requireProfessionAffixPool(classId: ClassId): readonly ProfessionAffixPoolEntry[] {
  const pool = PROFESSION_AFFIX_POOLS[classId];
  if (!pool) {
    throw new Error(`[配置错误] 生成随机词条必须提供有效职业，收到 ${String(classId)}`);
  }
  return pool;
}

/**
 * 是否为“全部词条都已写死”的确定模板。
 *
 * 精品商店与其 BOSS 同款属于完整固定模板；装备副本只固定一条职业定位词条，
 * 剩余名额仍要正常掷胚子和随机词条，不能仅凭有主题外观就误判成固定珍品。
 */
export function hasFullyFixedAffixes(def: EquipmentDef): boolean {
  validateFixedAffixLayout(def);
  return def.fixedTemplate === true;
}

/**
 * 珍品商店、珍品 BOSS 同款与预览使用确定实例：品质容量内的词条全部写死，
 * 购买时绝不盲抽。
 *
 * **额外槽位（extraAffixSlots）例外**：那几条是有意留给玩家洗练的养成空间，
 * 必须在这里掷出来 —— 否则 extraAffixSlots 只存在于容量校验里，
 * 实例永远是空词条，「6 固定 + 2 可洗」会变成「6 固定 + 0 可洗」（曾经就是）。
 * 声明了额外槽却不给 rng 属于调用方漏传，直接抛错而不是静默产出 0 条。
 */
export function createFixedInstance(
  def: EquipmentDef,
  uid: string,
  locked: boolean,
  rng?: Rng,
  classId?: ClassId,
): EquipmentInstance {
  if (!hasFullyFixedAffixes(def)) {
    throw new Error(`[配置错误] ${def.id} 未声明 fixedTemplate，不能创建确定实例`);
  }
  const extraSlots = def.extraAffixSlots ?? 0;
  if (extraSlots > 0 && (!rng || !classId)) {
    throw new Error(
      `[配置错误] ${def.id} 声明了 ${extraSlots} 个额外词条槽，创建实例必须提供 rng 与 classId`,
    );
  }
  return {
    uid,
    defId: def.id,
    enhance: 0,
    baseRollPermille: 1000,
    enhanceGainPermille: Array<number>(ENHANCE_MAX).fill(0),
    enhanceLuck: {},
    // rollAffixes 对固定模板返回的正好是「容量 − 已固定」= 额外槽数
    affixes: extraSlots > 0 ? rollAffixes(def, rng!, classId!) : [],
    reforgeResonance: 0,
    locked,
  };
}

/**
 * 纯展示用的固定模板实例（商店预览、合成预览）。
 *
 * 与 createFixedInstance 的区别，以及为什么必须单独开一个函数：
 *
 * 1. **不掷额外槽词条**。额外槽是购买那一刻才掷的，预览若先掷一份出来，
 *    玩家看到 +50 却买到 +30 —— 那是欺骗（docs/40 红线）。
 *    预览只呈现固定词条与基础属性，UI 另行说明「购买后随机产生 N 条可洗词条」。
 *
 * 2. **不受「声明了额外槽必须传 rng」的守卫约束**。那条守卫是为了防止
 *    真实实例静默产出 0 条额外词条（曾经的 bug），而预览实例根本不进背包、
 *    不参与战斗、不会被洗练，本来就不该被它拦。
 *
 * 2026-07-30 的线上事故正是混用两者的后果：商店预览走 createFixedInstance
 * 且不传 rng，加了守卫后每个珍品都抛错，整个商店打不开。
 * 分成两个函数后，调用点必须在「真实创建」和「只是看看」之间明确表态。
 */
export function createFixedPreviewInstance(def: EquipmentDef, uid: string): EquipmentInstance {
  if (!hasFullyFixedAffixes(def)) {
    throw new Error(`[配置错误] ${def.id} 未声明 fixedTemplate，不能创建预览实例`);
  }
  return {
    uid,
    defId: def.id,
    enhance: 0,
    baseRollPermille: 1000,
    enhanceGainPermille: Array<number>(ENHANCE_MAX).fill(0),
    enhanceLuck: {},
    affixes: [],
    reforgeResonance: 0,
    locked: true,
  };
}

function validateFixedAffixLayout(def: EquipmentDef): {
  fixedKeys: Set<AffixKey>;
  fixedCount: number;
  capacity: number;
} {
  const fixedAffixes = def.fixedAffixes ?? [];
  const fixedCount = fixedAffixes.length;
  const extraSlots = def.extraAffixSlots ?? 0;
  if (!Number.isSafeInteger(extraSlots) || extraSlots < 0) {
    throw new Error(`[配置错误] ${def.id} 额外词条槽必须是非负整数：${extraSlots}`);
  }
  const baseCapacity = QUALITY_AFFIX_COUNT[def.quality];
  const capacity = baseCapacity + extraSlots;
  if (fixedCount > baseCapacity) {
    throw new Error(
      `[配置错误] ${def.id} 固定词条 ${fixedCount} 条，超过 ${def.quality} 品质容量 ${baseCapacity}`,
    );
  }

  const fixedKeys = new Set(fixedAffixes.map((affix) => affix.key));
  if (fixedKeys.size !== fixedCount) {
    throw new Error(`[配置错误] ${def.id} 固定词条 key 不能重复`);
  }
  // fixedTemplate 要求写满的是**品质容量**，额外槽位不算在内 ——
  // 额外槽位的定位就是「固定模板之外再开几个可洗的」。
  if (def.fixedTemplate && fixedCount !== baseCapacity) {
    throw new Error(
      `[配置错误] ${def.id} 已声明 fixedTemplate，但固定词条 ${fixedCount} 条，必须写满容量 ${baseCapacity}`,
    );
  }
  return { fixedKeys, fixedCount, capacity };
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
