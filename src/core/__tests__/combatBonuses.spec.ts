import { describe, expect, it } from 'vitest';
import { dominantAffixElement } from '../combatBonuses';

describe('词条攻击属性', () => {
  it('无属性加成时保持无属性', () => {
    expect(
      dominantAffixElement({
        damageReduction: 0,
        lifesteal: 0,
        elementDamage: { fire: 0, ice: 0, thunder: 0 },
      }),
    ).toBe('none');
  });

  it('选择加成最高的一系，平手时结果稳定', () => {
    expect(
      dominantAffixElement({
        damageReduction: 0,
        lifesteal: 0,
        elementDamage: { fire: 4, ice: 7, thunder: 7 },
      }),
    ).toBe('ice');
  });
});
