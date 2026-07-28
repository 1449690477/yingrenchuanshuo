import { describe, expect, it } from 'vitest';
import type { EquipmentDef } from '@/core/types';
import { baseEquipStats, itemBaseValue, rollAffixes } from '@/core/equipment';
import { Rng } from '@/core/rng';
import {
  QUALITY_AFFIX_COUNT,
  QUALITY_LABELS,
  QUALITY_MUL,
  QUALITY_ORDER,
  QUALITY_PCT_SCALE,
  QUALITY_RANK,
} from '../constants';

const prismaticRing: EquipmentDef = {
  id: 'eq_test_prismatic_ring',
  name: '测试心虹戒指',
  slot: 'ring',
  quality: 'prismatic',
  level: 80,
  icon: 'assets/equipment/test.png',
  appearanceId: 'test-prismatic-ring',
};

describe('心虹珍藏品质', () => {
  it('在神话与圣器之间保持统一排序和显示语义', () => {
    expect(QUALITY_ORDER).toEqual([
      'common',
      'fine',
      'rare',
      'epic',
      'legendary',
      'mythic',
      'prismatic',
      'divine',
    ]);
    expect(QUALITY_RANK.mythic).toBeLessThan(QUALITY_RANK.prismatic);
    expect(QUALITY_RANK.prismatic).toBeLessThan(QUALITY_RANK.divine);
    expect(QUALITY_LABELS.prismatic).toBe('心虹珍藏');
  });

  it('使用 11.8 基础倍率、4.0 百分比倍率和固定六词条容量', () => {
    expect(QUALITY_MUL.prismatic).toBe(11.8);
    expect(QUALITY_PCT_SCALE.prismatic).toBe(4);
    expect(QUALITY_AFFIX_COUNT.prismatic).toBe(6);
    expect(itemBaseValue(80, 'prismatic') / itemBaseValue(80, 'common')).toBeCloseTo(11.8, 8);

    const stats = baseEquipStats(prismaticRing);
    expect(stats.critRate).toBe(8);
    expect(stats.critDmg).toBe(24);
    expect(rollAffixes(prismaticRing, new Rng(20260728))).toHaveLength(6);
  });
});
