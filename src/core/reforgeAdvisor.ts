import type {
  Affix,
  AffixChangeOperation,
  AffixKey,
  AffixTier,
  ClassId,
  EquipmentDef,
  EquipmentInstance,
  EquipSlot,
} from './types';
import { professionForAffix } from './equipment';
import {
  AFFIX_TIERS,
  isAffixSettlementActive,
  QUALITY_PROFESSION_AFFIX_COUNT,
  QUALITY_RANK,
} from '@/data/constants';
import { PROTECT_TIER_THRESHOLD } from '@/data/reforgeRules';

/**
 * 推荐洗练引擎（纯函数，不消耗 RNG、不读存档）。
 *
 * 输入背包/穿戴中的装备实例与定义，输出每件装备的词条组评分和一条
 * 最优先的洗练建议。UI 层只负责展示与跳转，操作仍由玩家亲手触发。
 */

export type AffixStatus = 'dead' | 'foreign' | 'profession' | 'normal';

export interface AffixAssessment {
  index: number;
  key: AffixKey;
  tier: AffixTier;
  /** 单条评分 0~100：品阶系数归一后按生效状态折算。 */
  score: number;
  status: AffixStatus;
  statusLabel: string;
}

export interface ReforgeRecommendation {
  operation: AffixChangeOperation;
  /** 同调需要明确的目标词条下标。 */
  targetIndex?: number;
  /** 一句话建议，例如「先换掉待开放的死词条」。 */
  headline: string;
  /** 为什么这么建议。 */
  reason: string;
  /** 预期效果的通俗描述。 */
  expected: string;
  /** 跨装备排序分，越高越值得先洗。 */
  priority: number;
  /**
   * 随机操作前建议定契（保护）的词条下标。
   *
   * 重铸 / 淬炼才会「从未定契的词条里随机挑一条改掉」——
   * 一件三词条的装备只要有一条是好的，不定契就有三分之一的概率把它洗没，
   * 而界面此前完全没有提示。这里把该保护的挑出来，UI 负责告知风险。
   * 铭刻固定命中预留职业槽且不接受定契，因此不会携带 protectIndices。
   */
  protectIndices?: readonly number[];
}

export interface EquipmentAssessment {
  uid: string;
  defId: string;
  source: 'equipped' | 'bag';
  slot: EquipSlot;
  /** 装备底子价值：品质、等级、强化与穿戴状态合成。 */
  worthScore: number;
  /** 当前词条组评分 0~100。 */
  affixScore: number;
  /** 相关度 0~1：这件装备玩家到底还会不会穿。0 表示已被淘汰。 */
  relevance: number;
  affixes: AffixAssessment[];
  recommendation: ReforgeRecommendation | null;
}

export interface ReforgeAdvisorInput {
  classId: ClassId;
  entries: readonly {
    instance: EquipmentInstance;
    definition: EquipmentDef;
    source: 'equipped' | 'bag';
  }[];
}

const TIER_MULTIPLIER = new Map<AffixTier, number>(
  AFFIX_TIERS.map((entry) => [entry.tier, entry.multiplier]),
);

const TIER_MAX = Math.max(...AFFIX_TIERS.map((entry) => entry.multiplier));

/** 随机洗练出新词条的期望品阶系数（按品阶权重加权）。 */
export const EXPECTED_ROLL_MULTIPLIER =
  AFFIX_TIERS.reduce((sum, entry) => sum + entry.weight * entry.multiplier, 0) /
  AFFIX_TIERS.reduce((sum, entry) => sum + entry.weight, 0);

export function assessAffix(affix: Affix, index: number, classId: ClassId): AffixAssessment {
  const base = ((TIER_MULTIPLIER.get(affix.tier) ?? 0) / TIER_MAX) * 100;
  let status: AffixStatus = 'normal';
  let factor = 1;
  let statusLabel = '';
  if (!isAffixSettlementActive(affix.key)) {
    status = 'dead';
    factor = 0.1;
    statusLabel = '待开放';
  } else {
    const owner = professionForAffix(affix.key);
    if (owner && owner !== classId) {
      status = 'foreign';
      factor = 0.15;
      statusLabel = '他职专属';
    } else if (owner === classId) {
      status = 'profession';
      statusLabel = '本职专属';
    }
  }
  return {
    index,
    key: affix.key,
    tier: affix.tier,
    score: Math.round(base * factor * 10) / 10,
    status,
    statusLabel,
  };
}

/**
 * 参考等级 = 玩家当前真正在用的装备等级。
 *
 * 优先取穿戴中的最高等级；一件都没穿时退回全部候选的最高等级。
 * 背包里远低于这个等级的装备，词条洗得再漂亮也不会上身，
 * 不该占推荐位、更不该让玩家往里砸材料。
 */
export function referenceLevelOf(entries: ReforgeAdvisorInput['entries']): number {
  const equipped = entries.filter((entry) => entry.source === 'equipped');
  const pool = equipped.length > 0 ? equipped : entries;
  return pool.reduce((max, entry) => Math.max(max, entry.definition.level), 1);
}

/**
 * 相关度：这件装备值不值得为它花材料。
 *
 * 之前的排序只看「哪条规则更紧急」（死词条 108 分 > 同调 78 分），
 * 而等级只以 level/10 计入 worthScore 再乘 0.2 —— Lv20 和 Lv80 只差
 * 一分多，于是背包里的低级史诗永远压过身上穿的高级装备。
 * 相关度把「会不会穿」这件事重新提到和「多紧急」同一个量级上。
 */
export function relevanceOf(
  definition: EquipmentDef,
  source: 'equipped' | 'bag',
  referenceLevel: number,
  equippedInSlot: EquipmentDef | null,
): number {
  if (source === 'equipped') return 1;

  // 同部位穿着的那件不比它差 —— 这件永远不会上身
  if (equippedInSlot) {
    const rankHere = QUALITY_RANK[definition.quality];
    const rankWorn = QUALITY_RANK[equippedInSlot.quality];
    const outclassed =
      rankWorn > rankHere || (rankWorn === rankHere && equippedInSlot.level >= definition.level);
    if (outclassed) return 0;
  }

  // 比在用装备低一大截的，等同废铁
  const ratio = definition.level / Math.max(1, referenceLevel);
  if (ratio < 0.7) return 0;
  return Math.min(1, 0.45 + ratio * 0.35);
}

export function worthScoreOf(
  instance: EquipmentInstance,
  definition: EquipmentDef,
  source: 'equipped' | 'bag',
): number {
  const score =
    QUALITY_RANK[definition.quality] * 12 +
    definition.level / 10 +
    instance.enhance * 2 +
    (source === 'equipped' ? 20 : 0);
  return Math.round(score * 10) / 10;
}

function isUseful(affix: AffixAssessment): boolean {
  return affix.status === 'normal' || affix.status === 'profession';
}

function buildRecommendation(
  definition: EquipmentDef,
  source: 'equipped' | 'bag',
  affixes: readonly AffixAssessment[],
  worthScore: number,
  affixScore: number,
): ReforgeRecommendation | null {
  const dead = affixes.filter((affix) => affix.status === 'dead');
  const foreign = affixes.filter((affix) => affix.status === 'foreign');
  const useful = affixes.filter(isUseful);
  const professionSlots = Math.min(
    QUALITY_PROFESSION_AFFIX_COUNT[definition.quality],
    affixes.length,
  );
  const inProfessionSlot = (index: number) =>
    professionSlots > 0 && index >= affixes.length - professionSlots;
  const professionSlotAffixes = affixes.filter((affix) => inProfessionSlot(affix.index));
  const hasProfession = professionSlotAffixes.some(
    (affix) => affix.status === 'profession',
  );

  // 1. 死词条最优先：待开放词条完全不生效，先换掉。
  if (dead.length > 0) {
    const deadInProfessionSlot = dead.some((affix) => inProfessionSlot(affix.index));
    if (deadInProfessionSlot && !hasProfession && professionSlots > 0) {
      return {
        operation: 'inscribe',
        headline: '铭刻必出本职专属，顺便替换死词条',
        reason: '「待开放」词条不会生效，而它正占着预留职业槽；铭刻会直接改写该槽。',
        expected: '死词条必被替换成一条生效的本职专属词条',
        priority: 118 + dead.length * 12 + worthScore * 0.2,
      };
    }
    return {
      operation: 'reforge',
      headline: `先换掉 ${dead.length} 条「待开放」死词条`,
      reason: '这些词条在当前版本不会生效，重铸随机一条时有概率直接替换它们。',
      expected: '死词条被替换为立即生效的词条',
      priority: 108 + dead.length * 12 + worthScore * 0.2,
    };
  }

  // 2. 他职专属对当前职业零收益。
  if (foreign.length > 0) {
    const foreignInProfessionSlot = foreign.some((affix) =>
      inProfessionSlot(affix.index),
    );
    if (foreignInProfessionSlot && !hasProfession) {
      return {
        operation: 'inscribe',
        headline: '职业槽不匹配，铭刻为当前职业专属',
        reason: '预留职业槽现在属于其他职业；铭刻只改写这个槽，不会碰通用词条。',
        expected: '他职专属必被替换成当前职业可用的专属词条',
        priority: 106 + foreign.length * 10 + worthScore * 0.2,
      };
    }
    return {
      operation: 'reforge',
      headline: `洗掉 ${foreign.length} 条他职业专属词条`,
      reason: '职业专属词条只对本职业生效，重铸有概率把它们换成你能用的词条。',
      expected: '零收益词条换成当前职业可用词条',
      priority: 96 + foreign.length * 10 + worthScore * 0.2,
    };
  }

  // 3. 高品阶有用词条：同调是确定性提升，T4→T5 收益最大。
  const promotable = useful
    .filter((affix) => affix.tier >= 3 && affix.tier < 5)
    .sort((a, b) => b.tier - a.tier);
  const worthSpending = source === 'equipped' || QUALITY_RANK[definition.quality] >= 3;
  if (promotable.length > 0 && worthSpending) {
    const target = promotable[0]!;
    const nextTier = (target.tier + 1) as AffixTier;
    return {
      operation: 'resonate',
      targetIndex: target.index,
      headline: `T${target.tier} 词条可同调直升 T${nextTier}`,
      reason: '同调是指定词条的确定性升阶，不会洗坏其他词条；装备底子值得投入。',
      expected: `该词条数值提升约 ${Math.round(
        ((TIER_MULTIPLIER.get(nextTier)! / TIER_MULTIPLIER.get(target.tier)!) - 1) * 100,
      )}%`,
      priority: 78 + target.tier * 6 + worthScore * 0.3,
    };
  }

  // 4. 缺本职专属且预留槽仍是低阶通用词条：铭刻只改该槽，不碰其他通用槽。
  const professionSlotsAreReplaceable =
    professionSlotAffixes.length > 0 &&
    professionSlotAffixes.every((affix) => affix.tier <= 2);
  if (
    !hasProfession &&
    professionSlots > 0 &&
    QUALITY_RANK[definition.quality] >= 3 &&
    professionSlotsAreReplaceable
  ) {
    return {
      operation: 'inscribe',
      headline: '缺一条本职业专属，铭刻必出',
      reason: '这件装备的预留职业槽仍是低阶通用词条；铭刻只改写该槽，必出本职业专属。',
      expected: '必得一条生效的本职专属词条',
      priority: 68 + worthScore * 0.3,
    };
  }

  // 5. 类型有用但品阶偏低：淬炼只洗品阶、保留类型。
  const lowTier = useful.filter((affix) => affix.tier <= 2);
  if (lowTier.length > 0 && useful.length === affixes.length) {
    return {
      operation: 'temper',
      headline: `词条类型不错，淬炼把 ${lowTier.length} 条低阶洗高`,
      reason: '淬炼保留词条类型、只重新随机品阶，不会把好类型洗没。',
      expected: '低阶词条有机会升到卓越甚至极品',
      priority: 52 + lowTier.length * 7 + worthScore * 0.2,
    };
  }

  // 6. 整体偏弱：重铸换一批。
  const expected = (EXPECTED_ROLL_MULTIPLIER / TIER_MAX) * 100;
  if (affixScore < expected * 0.82 && affixes.length > 0) {
    return {
      operation: 'reforge',
      headline: '词条组整体偏弱，重铸换一批',
      reason: '当前词条评分低于随机新词条的期望水平，重铸期望为正。',
      expected: '整体词条质量向期望水平回归',
      priority: 42 + (expected - affixScore) * 0.6 + worthScore * 0.1,
    };
  }

  return null;
}

/**
 * 值得定契保护的词条：已经生效、且品阶达到卓越（T4）以上。
 *
 * 门槛定在 T4 而不是 T3：T3 还在随机洗练的期望附近，锁它等于花材料
 * 保护一条本来就容易再摇出来的词条；T4/T5 才是真正洗坏了会心疼的。
 */
function protectIndicesOf(affixes: readonly AffixAssessment[]): number[] {
  return affixes
    .filter((affix) => isUseful(affix) && affix.tier >= PROTECT_TIER_THRESHOLD)
    .map((affix) => affix.index);
}

export function assessEquipment(
  instance: EquipmentInstance,
  definition: EquipmentDef,
  source: 'equipped' | 'bag',
  classId: ClassId,
  relevance = 1,
): EquipmentAssessment {
  const affixes = instance.affixes.map((affix, index) => assessAffix(affix, index, classId));
  const affixScore =
    affixes.length === 0
      ? 0
      : Math.round((affixes.reduce((sum, affix) => sum + affix.score, 0) / affixes.length) * 10) /
        10;
  const worthScore = worthScoreOf(instance, definition, source);
  return {
    uid: instance.uid,
    defId: instance.defId,
    source,
    slot: definition.slot,
    worthScore,
    affixScore,
    relevance,
    affixes,
    // 已被淘汰的装备仍可手动选中洗练，但绝不主动建议玩家往里投材料
    recommendation:
      relevance <= 0
        ? null
        : withProtection(
            buildRecommendation(definition, source, affixes, worthScore, affixScore),
            affixes,
          ),
  };
}

/**
 * 只有会在多个通用槽之间随机选目标的操作才需要定契建议。
 * 铭刻固定改写预留职业槽，同调由玩家指定；两者都不接受临时锁定。
 */
const LOCKABLE_RANDOM_OPERATIONS: readonly AffixChangeOperation[] = ['reforge', 'temper'];

function withProtection(
  recommendation: ReforgeRecommendation | null,
  affixes: readonly AffixAssessment[],
): ReforgeRecommendation | null {
  if (!recommendation || !LOCKABLE_RANDOM_OPERATIONS.includes(recommendation.operation)) {
    return recommendation;
  }
  const protectIndices = protectIndicesOf(affixes);
  if (protectIndices.length === 0) return recommendation;
  return { ...recommendation, protectIndices };
}

/**
 * 排序分：紧急程度先乘相关度，再给穿戴中的装备一个固定加成。
 *
 * 这样「身上那件需要同调」(78×1+40=118) 会排在
 * 「背包里一件同级备选有死词条」(108×0.6≈65) 前面 ——
 * 先把正在生效的装备修好，才轮到备选。
 */
export function sortScoreOf(assessment: EquipmentAssessment): number {
  const priority = assessment.recommendation?.priority ?? -1;
  return priority * assessment.relevance + (assessment.source === 'equipped' ? 40 : 0);
}

/**
 * 评估全部候选装备，按「是否可洗练 → 建议优先级 → 底子价值」排序。
 * 固定珍品与没有随机词条的装备直接过滤掉。
 */
export function adviseReforge(input: ReforgeAdvisorInput): EquipmentAssessment[] {
  const candidates = input.entries.filter(
    ({ instance, definition }) => !definition.fixedTemplate && instance.affixes.length > 0,
  );
  const referenceLevel = referenceLevelOf(candidates);

  // 每个部位当前穿着的那件，用来判断背包里的同部位装备是否已被淘汰
  const wornBySlot = new Map<EquipSlot, EquipmentDef>();
  for (const { definition, source } of candidates) {
    if (source === 'equipped') wornBySlot.set(definition.slot, definition);
  }

  return candidates
    .map(({ instance, definition, source }) =>
      assessEquipment(
        instance,
        definition,
        source,
        input.classId,
        relevanceOf(definition, source, referenceLevel, wornBySlot.get(definition.slot) ?? null),
      ),
    )
    .sort((a, b) => {
      const sa = sortScoreOf(a);
      const sb = sortScoreOf(b);
      if (sa !== sb) return sb - sa;
      return b.worthScore - a.worthScore;
    });
}

/** 全列表里优先级最高的那条建议（用于首推横幅）。 */
export function topRecommendation(
  assessments: readonly EquipmentAssessment[],
): { assessment: EquipmentAssessment; recommendation: ReforgeRecommendation } | null {
  for (const assessment of assessments) {
    if (assessment.recommendation) {
      return { assessment, recommendation: assessment.recommendation };
    }
  }
  return null;
}
