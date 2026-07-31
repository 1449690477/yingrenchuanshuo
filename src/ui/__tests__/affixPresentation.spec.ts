import { describe, expect, it } from 'vitest';
import {
  affixDisplayName,
  affixProfession,
  affixProfessionLabel,
  affixRuntimeNotice,
  affixTierLabel,
  formatAffixValue,
} from '../affixPresentation';

describe('词条 UI 展示', () => {
  it('五档品阶有稳定且可辨识的名称', () => {
    expect([1, 2, 3, 4, 5].map((tier) => affixTierLabel(tier as 1 | 2 | 3 | 4 | 5))).toEqual([
      'T1 粗糙',
      'T2 普通',
      'T3 优良',
      'T4 卓越',
      'T5 极品',
    ]);
  });

  it('元素词条明确显示所属元素，不把无属性伪装成元素加成', () => {
    expect(affixDisplayName({ key: 'elemDmg', tier: 4, value: 8.5, element: 'fire' })).toBe(
      '属性伤害·炎',
    );
    expect(affixDisplayName({ key: 'atk', tier: 2, value: 7.2 })).toBe('攻击力');
  });

  it('职业词条显示真实归属，通用词条不添加职业标签', () => {
    expect(affixProfession('wit_elem')).toBe('witch');
    expect(affixProfessionLabel('wit_elem')).toBe('魔女专属');
    expect(affixProfessionLabel('critRate')).toBeNull();
  });

  it('旧档延后词条使用玩家能理解的开放提示，活跃词条不显示警告', () => {
    expect(affixRuntimeNotice('skillMul')).toBe('技能编成开放后生效');
    expect(affixRuntimeNotice('atk')).toBeNull();
  });

  it('小数比例攻速转成人类可读百分比，百分点词条不被重复放大', () => {
    expect(formatAffixValue({ key: 'spd', tier: 3, value: 0.03 })).toBe('+3%');
    expect(formatAffixValue({ key: 'cat_swift', tier: 3, value: 0.039 })).toBe('+3.9%');
    expect(formatAffixValue({ key: 'dmgReduce', tier: 3, value: 2.5 })).toBe('+2.5%');
    expect(formatAffixValue({ key: 'elemDmg', tier: 4, value: 8.5, element: 'fire' })).toBe(
      '+8.5%',
    );
    expect(formatAffixValue({ key: 'lifesteal', tier: 3, value: 1.6 })).toBe('+1.6%');
  });

  it('低等级数值词条的小数不会被格式化成虚假的零收益', () => {
    expect(formatAffixValue({ key: 'atk', tier: 1, value: 0.3 })).toBe('+0.3');
  });
});
