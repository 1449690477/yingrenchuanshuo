import { describe, expect, it } from 'vitest';
import type { Element } from '@/core/types';
import { counterElementFor, elementMatchupPresentation } from '@/ui/elementMatchupPresentation';

describe('elementMatchupPresentation', () => {
  it.each([
    ['fire', 'ice', 'advantage', 1.25, '克制 +25%'],
    ['ice', 'thunder', 'advantage', 1.25, '克制 +25%'],
    ['thunder', 'fire', 'advantage', 1.25, '克制 +25%'],
    ['ice', 'fire', 'disadvantage', 0.85, '被克 -15%'],
    ['fire', 'fire', 'neutral', 1, '同系 ×1.00'],
    ['none', 'ice', 'neutral', 1, '中性 ×1.00'],
    ['fire', 'none', 'untyped', 1, '无属性关卡'],
  ] as const)('%s 攻击 %s 时展示真实关系', (attacker, defender, relation, multiplier, badge) => {
    const result = elementMatchupPresentation(attacker, defender);
    expect(result.relation).toBe(relation);
    expect(result.multiplier).toBe(multiplier);
    expect(result.badge).toBe(badge);
  });

  it.each([
    ['fire', 'thunder'],
    ['ice', 'fire'],
    ['thunder', 'ice'],
    ['none', null],
  ] as const)('目标 %s 的推荐元素严格从克制表反查', (defender, expected) => {
    expect(counterElementFor(defender as Element)).toBe(expected);
  });

  it('无属性武器面对有属性关卡时给出可行动建议', () => {
    const result = elementMatchupPresentation('none', 'ice');
    expect(result.recommendedElement).toBe('fire');
    expect(result.detail).toContain('换炎武器');
    expect(result.detail).toContain('×1.25');
  });
});
