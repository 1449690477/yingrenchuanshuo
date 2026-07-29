import { describe, expect, it } from 'vitest';
import { requireChapter } from '../regions';
import { STAGES } from '../stages';

describe('属性克制教学的确定性装备来源', () => {
  it('进入首个冰属性教学关前，固定发放指定炎属性武器定义', () => {
    const reward = STAGES['stage_2-4_6']?.firstClearRewards.find(
      (candidate) => candidate.itemId === 'eq_r2_weapon_fine',
    );
    expect(reward).toEqual({ itemId: 'eq_r2_weapon_fine', count: 1 });
    expect(requireChapter('2-5').tutorial).toContain('上一章首通送的炎属性武器');
  });

  it('区域 3 教学只承诺武器来源，不再泛称不存在的元素装备', () => {
    expect(requireChapter('3-1').tutorial).toContain('炎属性武器');
    expect(requireChapter('3-1').tutorial).not.toContain('炎属性装备');
  });
});
