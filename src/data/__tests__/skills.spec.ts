import { describe, expect, it } from 'vitest';
import {
  CATKIN_VISUAL_SKILLS,
  SHAMAN_SKILLS,
  SWORDSMAN_SKILLS,
  primaryDamageEffect,
} from '../skills';

function requireSkill<T extends { id: string }>(skills: readonly T[], id: string): T {
  const skill = skills.find((entry) => entry.id === id);
  if (!skill) throw new Error(`测试缺少技能：${id}`);
  return skill;
}

describe('legacy skill migration', () => {
  it('烈火剑法保留 30% 概率、5 秒灼烧契约', () => {
    const flame = requireSkill(SWORDSMAN_SKILLS, 'skill_swordsman_flame');
    const burnTrigger = flame.effects.find((effect) => effect.kind === 'trigger');
    expect(burnTrigger).toMatchObject({
      event: 'on-hit',
      chance: 0.3,
      maxTriggers: 1,
    });
    expect(burnTrigger?.effects.find((effect) => effect.kind === 'apply-status')).toMatchObject({
      statusId: 'burn',
      durationSec: 5,
    });
  });

  it('灵巫三个代表技能与 docs/13 的数值一致', () => {
    const heal = requireSkill(SHAMAN_SKILLS, 'skill_shaman_heal');
    expect(heal.effects.find((effect) => effect.kind === 'heal')).toMatchObject({
      maxHpRatio: { base: 0.15 },
    });

    const poison = requireSkill(SHAMAN_SKILLS, 'skill_shaman_poison');
    expect(poison.effects.find((effect) => effect.kind === 'periodic-damage')).toMatchObject({
      totalMultiplier: { base: 6, perLevel: 0.6 },
      ticks: 10,
      durationSec: 10,
      maxStacks: 3,
    });

    const skeleton = requireSkill(SHAMAN_SKILLS, 'skill_shaman_skeleton');
    expect(skeleton.effects.find((effect) => effect.kind === 'summon')).toMatchObject({
      durationSec: 60,
    });
  });
});

describe('catkin visual timing', () => {
  it('所有直接多段伤害的演出拍数与伤害段数一致', () => {
    for (const skill of CATKIN_VISUAL_SKILLS) {
      const damageEffect = primaryDamageEffect(skill);
      if (!damageEffect) continue;
      expect(
        skill.hitOffsetsMs,
        `${skill.id} 的视觉拍数必须与伤害段数一致`,
      ).toHaveLength(damageEffect.hitWeights?.length ?? 1);
    }
  });
});
