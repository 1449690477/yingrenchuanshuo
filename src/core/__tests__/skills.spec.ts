import { describe, expect, it } from 'vitest';
import { CATKIN_SKILLS, primaryDamageEffect } from '@/data/skills';
import { canCastSkill, damageHitMultipliers, levelScalarAt } from '../skills';

function requireCatkinSkill(id: string) {
  const skill = CATKIN_SKILLS.find((entry) => entry.id === id);
  if (!skill) throw new Error(`测试缺少技能：${id}`);
  return skill;
}

describe('skill scalars', () => {
  it('按技能等级成长并遵守上限', () => {
    expect(levelScalarAt({ base: 4, perLevel: 0.12, max: 10 }, 1)).toBe(4);
    expect(levelScalarAt({ base: 4, perLevel: 0.12, max: 10 }, 30)).toBeCloseTo(7.48);
    expect(levelScalarAt({ base: 4, perLevel: 0.12, max: 10 }, 100)).toBe(10);
  });

  it('拒绝 0、负数和小数技能等级', () => {
    expect(() => levelScalarAt({ base: 1 }, 0)).toThrow();
    expect(() => levelScalarAt({ base: 1 }, -1)).toThrow();
    expect(() => levelScalarAt({ base: 1 }, 1.5)).toThrow();
  });
});

describe('multi-hit damage', () => {
  it('疯狂乱抓拆成六段后总倍率仍是 2.55', () => {
    const effect = primaryDamageEffect(requireCatkinSkill('skill_catkin_scratch_frenzy'));
    expect(effect).not.toBeNull();
    const hits = damageHitMultipliers(effect!, 1);

    expect(hits).toHaveLength(6);
    expect(hits.reduce((sum, multiplier) => sum + multiplier, 0)).toBeCloseTo(2.55, 10);
  });

  it('百爪樱岚拆成十二段后总倍率仍是 5.2', () => {
    const effect = primaryDamageEffect(requireCatkinSkill('skill_catkin_hundred_claw'));
    const hits = damageHitMultipliers(effect!, 1);

    expect(hits).toHaveLength(12);
    expect(hits.reduce((sum, multiplier) => sum + multiplier, 0)).toBeCloseTo(5.2, 10);
  });

  it('非法多段权重直接报错，不静默回退', () => {
    expect(() =>
      damageHitMultipliers(
        {
          kind: 'damage',
          target: { kind: 'primary-enemy' },
          multiplier: { base: 2 },
          hitWeights: [1, 0, 1],
        },
        1,
      ),
    ).toThrow();
  });
});

describe('catkin cast conditions', () => {
  const baseContext = {
    selfHpRatio: 1,
    targetHpRatio: 1,
    monsterType: 'normal' as const,
    statusStacks: {},
  };

  it('炸毛反击只在生命不高于 65% 时可释放', () => {
    const counter = requireCatkinSkill('skill_catkin_bristle_counter');
    expect(canCastSkill(counter, { ...baseContext, selfHpRatio: 0.66 })).toBe(false);
    expect(canCastSkill(counter, { ...baseContext, selfHpRatio: 0.65 })).toBe(true);
  });

  it('纸箱奇袭至少需要三层猫爪印记', () => {
    const ambush = requireCatkinSkill('skill_catkin_box_ambush');
    expect(
      canCastSkill(ambush, {
        ...baseContext,
        statusStacks: { catkin_claw_mark: 2 },
      }),
    ).toBe(false);
    expect(
      canCastSkill(ambush, {
        ...baseContext,
        statusStacks: { catkin_claw_mark: 3 },
      }),
    ).toBe(true);
  });

  it('被动技能永远不会进入主动释放队列', () => {
    const passive = requireCatkinSkill('skill_catkin_claw_mark');
    expect(canCastSkill(passive, baseContext)).toBe(false);
  });
});
