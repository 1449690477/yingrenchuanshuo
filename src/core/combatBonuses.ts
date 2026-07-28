import type { CombatBonuses, Element } from './types';

const ATTACK_ELEMENTS = ['fire', 'ice', 'thunder'] as const;

/**
 * 词条为无属性角色提供攻击属性。
 *
 * 随机池同一 key 不重复，正常情况下只会有一个属性伤害词条；若铭刻等路径
 * 让多个系别并存，则选总加成最高的一系，平手按炎→冰→雷稳定决胜。
 */
export function dominantAffixElement(bonuses: CombatBonuses): Element {
  let best: (typeof ATTACK_ELEMENTS)[number] | null = null;
  let bestValue = 0;
  for (const element of ATTACK_ELEMENTS) {
    const value = bonuses.elementDamage[element];
    if (value > bestValue) {
      best = element;
      bestValue = value;
    }
  }
  return best ?? 'none';
}

