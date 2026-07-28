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
  EquipmentDef,
  EquipmentInstance,
  FixedAffix,
  ForgeStage,
  Quality,
  Stats,
} from './types';
import type { Rng } from './rng';
import { addStats, zeroStats } from './formula';
import {
  AFFIX_ELEMENT_OPTIONS,
  AFFIX_POOL,
  AFFIX_TIERS,
  AFFIX_VALUE_VARIANCE,
  ENHANCE_GAIN_TIERS,
  ENHANCE_MAX,
  ENHANCE_TOTAL_GAIN_CAP_PERMILLE,
  EQUIPMENT_BASE_ROLL_MAX,
  EQUIPMENT_BASE_ROLL_MIN,
  EQUIPMENT_BASE_ROLL_TIERS,
  FORGE_STAGE_THRESHOLDS,
  isAffixGenerationActive,
  isAffixSettlementActive,
  ITEM_BASE,
  ITEM_POW,
  ITEM_SCALE,
  PROFESSION_AFFIX_POOLS,
  QUALITY_AFFIX_COUNT,
  QUALITY_MUL,
  QUALITY_PCT_SCALE,
  QUALITY_PROFESSION_AFFIX_COUNT,
  SLOT_PCT_WEIGHTS,
  SLOT_WEIGHTS,
} from '@/data/constants';
import type { AffixPoolEntry } from '@/data/constants';

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
    case 'swd_heavy':
      return addStats(stats, { critDmg: affix.value });
    case 'wit_power':
      return addStats(stats, { atk: affix.value });
    case 'sha_vitality':
      return addStats(stats, { hp: affix.value });
    case 'cat_swift':
      return addStats(stats, { spd: affix.value });
    case 'cat_nimble':
      return addStats(stats, { eva: affix.value });
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
  };
}

/** 把一条独立战斗词条计入结算修正。 */
export function applyCombatAffix(bonuses: CombatBonuses, affix: FixedAffix): CombatBonuses {
  if (!isAffixSettlementActive(affix.key)) return bonuses;
  switch (affix.key) {
    case 'dmgReduce':
    case 'sha_ward':
      return addCombatBonuses(bonuses, { damageReduction: affix.value });
    case 'lifesteal':
    case 'sha_drain':
      return addCombatBonuses(bonuses, { lifesteal: affix.value });
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

  const tier = rollAffixTier(rng, guaranteedHigh);
  const affix: Affix = {
    key,
    tier,
    value: rollAffixValue(spec, level, tier, rng),
  };
  if (key === 'elemDmg' || key === 'wit_elem') {
    affix.element = rng.pick(AFFIX_ELEMENT_OPTIONS);
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
    (entry) => isAffixGenerationActive(entry.key) && !fixedKeys.has(entry.key),
  );
  const availableProfessionPool = professionPool.filter(
    (entry) => isAffixGenerationActive(entry.key) && !fixedKeys.has(entry.key),
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
    const picked = rng.weighted(availableProfessionPool, (entry) => entry.weight);
    availableProfessionPool.splice(availableProfessionPool.indexOf(picked), 1);
    out.push(rollAffixForKey(picked.key, def.level, rng));
  }
  return out;
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
    // 奇迹胚子自动锁定，避免一键分解白绿装时误删惊喜掉落。
    locked: baseRoll.grade === 'miracle',
  };
}

/** 职业上下文是生成装备的必要输入；缺失或非法时直接暴露主流程错误。 */
function requireProfessionAffixPool(classId: ClassId): readonly AffixPoolEntry[] {
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

/** 珍品商店、珍品 BOSS 同款与预览使用确定实例，购买时绝不盲抽。 */
export function createFixedInstance(
  def: EquipmentDef,
  uid: string,
  locked: boolean,
): EquipmentInstance {
  if (!hasFullyFixedAffixes(def)) {
    throw new Error(`[配置错误] ${def.id} 未声明 fixedTemplate，不能创建确定实例`);
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
    locked,
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
