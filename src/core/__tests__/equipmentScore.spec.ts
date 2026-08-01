import { describe, expect, it } from 'vitest';
import { ENHANCE_MAX } from '@/data/constants';
import type { EquipmentDef, EquipmentInstance } from '../types';
import {
  EQUIPMENT_SCORE_VERSION,
  equipmentBaseScore,
  equipmentCurrentScore,
  equipmentScores,
} from '../equipmentScore';

function definition(
  slot: EquipmentDef['slot'],
  overrides: Partial<EquipmentDef> = {},
): EquipmentDef {
  const common = {
    id: `score-${slot}`,
    name: '评分测试装备',
    quality: 'rare' as const,
    level: 40,
    icon: '',
    appearanceId: `score-${slot}`,
    ...overrides,
  };
  return slot === 'weapon'
    ? { ...common, slot, element: 'none' }
    : { ...common, slot, element: undefined };
}

function instance(overrides: Partial<EquipmentInstance> = {}): EquipmentInstance {
  return {
    uid: 'score-instance',
    defId: 'score-weapon',
    enhance: 0,
    baseRollPermille: 1100,
    enhanceGainPermille: Array<number>(ENHANCE_MAX).fill(0),
    enhanceLuck: {},
    affixes: [],
    reforgeResonance: 0,
    locked: false,
    ...overrides,
  };
}

describe('稳定装备双评分', () => {
  it('普通武器和攻速鞋都得到正评分，不会因局部攻速为零而整体归零', () => {
    expect(equipmentCurrentScore(definition('weapon'), instance(), 'swordsman')).toBeGreaterThan(0);
    expect(
      equipmentCurrentScore(
        definition('shoes'),
        instance({ defId: 'score-shoes' }),
        'swordsman',
      ),
    ).toBeGreaterThan(0);
  });

  it('强化只提高当前评分，不改变用于判断底子的 +0 评分', () => {
    const def = definition('weapon');
    const plain = instance();
    const enhanced = instance({
      enhance: 9,
      enhanceGainPermille: [
        ...Array<number>(9).fill(82),
        ...Array<number>(ENHANCE_MAX - 9).fill(0),
      ],
    });

    expect(equipmentCurrentScore(def, enhanced, 'swordsman')).toBeGreaterThan(
      equipmentCurrentScore(def, plain, 'swordsman'),
    );
    expect(equipmentBaseScore(def, enhanced, 'swordsman')).toBe(
      equipmentBaseScore(def, plain, 'swordsman'),
    );
  });

  it('职业词条只进入适用职业评分，评分接口不接受玩家当前等级或穿戴上下文', () => {
    const def = definition('body');
    const withAffix = instance({
      defId: 'score-body',
      affixes: [{ key: 'swd_guard', tier: 3, value: 75 }],
    });
    const withoutAffix = instance({ defId: 'score-body' });

    // 词条按归属过滤：swd_guard 只进剑姬评分；对魔女带不带词条必须完全一致。
    // 不做「剑姬总分 > 魔女总分」的断言：乘法投影下同件防装对低基础职业（魔女）
    // 的相对边际提升更高，那是真实战力语义，不是词条漏过滤（docs/73 批 3）。
    expect(equipmentBaseScore(def, withAffix, 'swordsman')).toBeGreaterThan(
      equipmentBaseScore(def, withoutAffix, 'swordsman'),
    );
    expect(equipmentBaseScore(def, withAffix, 'witch')).toBe(
      equipmentBaseScore(def, withoutAffix, 'witch'),
    );
    expect(equipmentScores(def, withAffix, 'swordsman')).toEqual({
      current: equipmentCurrentScore(def, withAffix, 'swordsman'),
      base: equipmentBaseScore(def, withAffix, 'swordsman'),
    });
    expect(EQUIPMENT_SCORE_VERSION).toBe(2);
  });

  it('基础评分不会读取掉级后保留或尚未再次生效的强化成长', () => {
    const def = definition('weapon');
    const reachedBefore = instance({
      enhance: 0,
      enhanceGainPermille: Array<number>(ENHANCE_MAX).fill(125),
    });
    expect(equipmentBaseScore(def, reachedBefore, 'swordsman')).toBe(
      equipmentBaseScore(def, instance(), 'swordsman'),
    );
  });
});
