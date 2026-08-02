import { elementMultiplier } from '@/core/formula';
import type { Element } from '@/core/types';
import { AFFIX_ELEMENT_OPTIONS, ELEMENT_BEATS } from '@/data/constants';

export type ElementMatchupRelation = 'advantage' | 'disadvantage' | 'neutral' | 'untyped';

export const ELEMENT_LABELS = {
  fire: '炎',
  ice: '冰',
  thunder: '雷',
  none: '无属性',
} as const satisfies Readonly<Record<Element, string>>;

export interface ElementMatchupPresentation {
  attacker: Element;
  defender: Element;
  attackerLabel: string;
  defenderLabel: string;
  relation: ElementMatchupRelation;
  multiplier: number;
  percentDelta: number;
  badge: string;
  /** 战斗飘字用短标签：克制/被克时显示倍率，中性/无属性为空（不污染飘字） */
  hitTag: string;
  summary: string;
  detail: string;
  recommendedElement: Exclude<Element, 'none'> | null;
  recommendedLabel: string | null;
}

/**
 * 返回能够克制目标的攻击元素。只从真实克制表反查，不能在 UI 里另写一套三角关系。
 */
export function counterElementFor(defender: Element): Exclude<Element, 'none'> | null {
  if (defender === 'none') return null;
  const counter = AFFIX_ELEMENT_OPTIONS.find((candidate) => ELEMENT_BEATS[candidate] === defender);
  if (!counter) throw new Error(`[元素配置错误] 找不到克制 ${defender} 的攻击元素`);
  return counter;
}

/**
 * 元素教学的唯一展示适配器。倍率直接读取 core 的真实公式；这里只负责把结果翻译成人话。
 */
export function elementMatchupPresentation(
  attacker: Element,
  defender: Element,
): ElementMatchupPresentation {
  const multiplier = elementMultiplier(attacker, defender);
  const percentDelta = Math.round((multiplier - 1) * 100);
  const recommendedElement = counterElementFor(defender);
  const recommendedLabel = recommendedElement ? ELEMENT_LABELS[recommendedElement] : null;
  const base = {
    attacker,
    defender,
    attackerLabel: ELEMENT_LABELS[attacker],
    defenderLabel: ELEMENT_LABELS[defender],
    multiplier,
    percentDelta,
    hitTag: '',
    recommendedElement,
    recommendedLabel,
  };

  if (defender === 'none') {
    return {
      ...base,
      relation: 'untyped',
      badge: '无属性关卡',
      hitTag: '',
      summary: '自由配装',
      detail: '本关不参与元素克制，按战力与词条选择武器即可。',
    };
  }

  if (multiplier > 1) {
    return {
      ...base,
      relation: 'advantage',
      badge: `克制 +${percentDelta}%`,
      hitTag: `克制 ×${multiplier.toFixed(2)}`,
      summary: `${ELEMENT_LABELS[attacker]}克${ELEMENT_LABELS[defender]}`,
      detail: `当前武器命中本关目标时，元素系数为 ×${multiplier.toFixed(2)}。`,
    };
  }

  if (multiplier < 1) {
    return {
      ...base,
      relation: 'disadvantage',
      badge: `被克 ${percentDelta}%`,
      hitTag: `被克 ×${multiplier.toFixed(2)}`,
      summary: `${ELEMENT_LABELS[defender]}克${ELEMENT_LABELS[attacker]}`,
      detail: `当前元素系数为 ×${multiplier.toFixed(2)}；换${recommendedLabel}武器可触发 ×1.25。`,
    };
  }

  if (attacker === 'none') {
    return {
      ...base,
      relation: 'neutral',
      badge: '中性 ×1.00',
      hitTag: '',
      summary: '尚未触发克制',
      detail: `换${recommendedLabel}武器可克制本关，触发 ×1.25。`,
    };
  }

  return {
    ...base,
    relation: 'neutral',
    badge: '同系 ×1.00',
    hitTag: '',
    summary: '同系中性',
    detail: `换${recommendedLabel}武器可克制本关，触发 ×1.25。`,
  };
}
