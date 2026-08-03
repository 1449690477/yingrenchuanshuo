import { describe, expect, it } from 'vitest';
import { boutiqueEquipmentId } from '@/data/boutique';
import { requireEquipment } from '@/data/equipment';
import { equipmentVisualPresentation } from '../equipmentVisualPresentation';

describe('装备玩家可见外观说明', () => {
  it('可见换装层保留真实专属视觉说明', () => {
    const result = equipmentVisualPresentation(
      requireEquipment(boutiqueEquipmentId('ice-snow', 'body')),
    );

    expect(result.hasIndependentLayer).toBe(true);
    expect(result.label).toBe('专属视觉');
    expect(result.copy).toContain('雪花');
    expect(result.note).toContain('未接入的技能机制不会');
  });

  it('整身工装明确说明已经包含并抑制的外观槽', () => {
    const result = equipmentVisualPresentation(
      requireEquipment(boutiqueEquipmentId('cardboard-cat', 'body', 'catkin')),
    );

    expect(result.hasIndependentLayer).toBe(true);
    expect(result.note).toContain('整身外观已经包含鞋');
    expect(result.note).toContain('不会重复叠加');
  });

  it('精品饰品明确受当前最高品阶主题控制，不承诺逐件外观', () => {
    const result = equipmentVisualPresentation(
      requireEquipment(boutiqueEquipmentId('berry-cream', 'ring')),
    );

    expect(result.hasIndependentLayer).toBe(false);
    expect(result.label).toBe('系列演出');
    expect(result.copy).toContain('只有当莓霜是当前穿戴中品阶最高的精品主题时');
    expect(result.note).toContain('不会单独显示项链、腕饰、戒指或腰封');
  });

  it('非精品 slot-only 装备不再展示尚未落地的逐件承诺', () => {
    const result = equipmentVisualPresentation(
      requireEquipment('eq_arena_swordsman_triumph-oath-ring'),
    );

    expect(result.hasIndependentLayer).toBe(false);
    expect(result.label).toBe('外观说明');
    expect(result.copy).toContain('当前没有独立纸娃娃图层');
    expect(result.copy).not.toContain('集齐 2 / 4 件');
  });
});
