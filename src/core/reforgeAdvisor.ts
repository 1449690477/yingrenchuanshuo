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
  const hasProfession = useful.some((affix) => affix.status === 'profession');
  const professionSlots = Math.min(
    QUALITY_PROFESSION_AFFIX_COUNT[definition.quality],
    affixes.length,
  );
  const inProfessionSlot = (index: number) =>
    professionSlots > 0 && index >= affixes.length - professionSlots;

  // 1. 死词条最优先：待开放词条完全不生效，先换掉。
  if (dead.length > 0) {
    const deadInProfessionSlot = dead.some((affix) => inProfessionSlot(affix.index));
    if (deadInProfessionSlot && !hasProfession && professionSlots > 0) {
      return {
        operation: 'inscribe',
        headline: '铭刻必出本职专属，顺便替换死词条',
        reason: `「待开放」词条不会生效，而这台装备的职业槽还空着；铭刻随机一条时必出本职业专属。`,
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

  // 4. 缺本职专属且装备有职业槽：铭刻必出。
  // 但铭刻的目标是随机一条——只有当装备里存在 T1~T2 的可牺牲词条时才推荐，
  // 避免玩家把已经很好的高阶词条赌掉。
  const sacrificeable = useful.filter((affix) => affix.tier <= 2);
  if (
    !hasProfession &&
    professionSlots > 0 &&
    QUALITY_RANK[definition.quality] >= 3 &&
    sacrificeable.length > 0
  ) {
    return {
      operation: 'inscribe',
      headline: '缺一条本职业专属，铭刻必出',
      reason:
        '这件装备的品质带有职业专属槽，铭刻随机一条时必出本职业专属词条；' +
        `当前有 ${sacrificeable.length} 条低阶词条可承担替换风险。`,
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

export function assessEquipment(
  instance: EquipmentInstance,
  definition: EquipmentDef,
  source: 'equipped' | 'bag',
  classId: ClassId,
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
    affixes,
    recommendation: buildRecommendation(
      definition,
      source,
      affixes,
      worthScore,
      affixScore,
    ),
  };
}

/**
 * 评估全部候选装备，按「是否可洗练 → 建议优先级 → 底子价值」排序。
 * 固定珍品与没有随机词条的装备直接过滤掉。
 */
export function adviseReforge(input: ReforgeAdvisorInput): EquipmentAssessment[] {
  return input.entries
    .filter(
      ({ instance, definition }) => !definition.fixedTemplate && instance.affixes.length > 0,
    )
    .map(({ instance, definition, source }) =>
      assessEquipment(instance, definition, source, input.classId),
    )
    .sort((a, b) => {
      const pa = a.recommendation?.priority ?? -1;
      const pb = b.recommendation?.priority ?? -1;
      if (pa !== pb) return pb - pa;
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
