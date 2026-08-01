import { describe, expect, it } from 'vitest';
import { CATKIN_SKILLS, primaryDamageEffect } from '@/data/skills';
import {
  canCastSkill,
  commitAutoSkillCast,
  createSkillCooldownState,
  damageHitMultipliers,
  levelScalarAt,
  selectAutoSkill,
  skillCooldownRemainingMs,
  type ActiveSkillLoadoutEntry,
} from '../skills';

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
        targetStatusStacks: { catkin_claw_mark: 2 },
      }),
    ).toBe(false);
    expect(
      canCastSkill(ambush, {
        ...baseContext,
        targetStatusStacks: { catkin_claw_mark: 3 },
      }),
    ).toBe(true);
  });

  it('被动技能永远不会进入主动释放队列', () => {
    const passive = requireCatkinSkill('skill_catkin_claw_mark');
    expect(canCastSkill(passive, baseContext)).toBe(false);
  });
});

describe('真实自动技能调度', () => {
  const baseContext = {
    selfHpRatio: 1,
    targetHpRatio: 1,
    monsterType: 'normal' as const,
    statusStacks: {},
  };
  const low = requireCatkinSkill('skill_catkin_paw_combo');
  const conditional = requireCatkinSkill('skill_catkin_bristle_counter');
  const high = requireCatkinSkill('skill_catkin_scratch_frenzy');
  if (low.type !== 'active' || conditional.type !== 'active' || high.type !== 'active') {
    throw new Error('测试技能必须是主动技能');
  }
  const loadout: readonly ActiveSkillLoadoutEntry[] = [
    { skill: low, level: 1 },
    { skill: conditional, level: 1 },
    { skill: high, level: 1 },
  ];

  it('开场选择满足条件的最高优先级技能，条件不满足不会空耗冷却', () => {
    const cooldowns = createSkillCooldownState(loadout);
    const selection = selectAutoSkill(loadout, cooldowns, 0, baseContext);

    expect(selection?.entry.skill.id).toBe(high.id);
    expect(skillCooldownRemainingMs(cooldowns, conditional.id, 0)).toBe(0);
  });

  it('提交施法后使用稳定 ID 记录绝对就绪时点，并继续轮询下一技能', () => {
    const initial = createSkillCooldownState(loadout);
    const first = selectAutoSkill(loadout, initial, 1_250, baseContext)!;
    const afterFirst = commitAutoSkillCast(loadout, initial, first, 1_250);

    expect(initial[high.id]).toBe(0);
    expect(skillCooldownRemainingMs(afterFirst, high.id, 1_250)).toBe(
      high.cooldownSec * 1_000,
    );
    expect(selectAutoSkill(loadout, afterFirst, 1_250, baseContext)?.entry.skill.id).toBe(low.id);
    expect(selectAutoSkill(loadout, afterFirst, 1_250 + high.cooldownSec * 1_000, baseContext)
      ?.entry.skill.id).toBe(high.id);
  });

  it('同优先级严格按技能栏顺序决定，不依赖对象键顺序', () => {
    const tiedLoadout: readonly ActiveSkillLoadoutEntry[] = [
      { skill: { ...low, id: 'slot-a', priority: 50 }, level: 1 },
      { skill: { ...high, id: 'slot-b', priority: 50 }, level: 1 },
    ];
    const cooldowns = createSkillCooldownState(tiedLoadout);

    expect(selectAutoSkill(tiedLoadout, cooldowns, 0, baseContext)?.entry.skill.id).toBe(
      'slot-a',
    );
  });

  it('拒绝重复、超过四栏和与技能栏不一致的冷却状态', () => {
    expect(() =>
      createSkillCooldownState([
        { skill: low, level: 1 },
        { skill: low, level: 1 },
      ]),
    ).toThrow('重复技能');
    expect(() =>
      createSkillCooldownState(
        Array.from({ length: 5 }, (_, index) => ({
          skill: { ...low, id: `skill-${index}` },
          level: 1,
        })),
      ),
    ).toThrow('最多 4 个');
    expect(() => selectAutoSkill(loadout, {}, 0, baseContext)).toThrow('冷却表与当前技能栏');
  });
});
