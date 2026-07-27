import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  CATKIN_SKILLS,
  CATKIN_VISUAL_SKILLS,
  battleRhythmSkills,
  primaryDamageEffect,
} from '../skills';

describe('catkin skill content', () => {
  it('完整录入 14 个技能：10 主动、4 被动，解锁顺序严格递增', () => {
    expect(CATKIN_SKILLS).toHaveLength(14);
    expect(CATKIN_SKILLS.filter((skill) => skill.type === 'active')).toHaveLength(10);
    expect(CATKIN_SKILLS.filter((skill) => skill.type === 'passive')).toHaveLength(4);
    expect(CATKIN_SKILLS.map((skill) => skill.unlockLevel)).toEqual([
      1, 4, 9, 14, 19, 24, 30, 35, 42, 50, 58, 66, 76, 88,
    ]);
    expect(new Set(CATKIN_SKILLS.map((skill) => skill.id)).size).toBe(14);
  });

  it('14 个图标与 10 个主动技能特效全部存在', () => {
    expect(CATKIN_VISUAL_SKILLS).toHaveLength(14);
    for (const skill of CATKIN_VISUAL_SKILLS) {
      expect(existsSync(resolve('public', skill.icon)), skill.icon).toBe(true);
      expect(existsSync(resolve('public', skill.effectAsset)), skill.effectAsset).toBe(true);
    }
    expect(
      CATKIN_VISUAL_SKILLS.filter((skill) => skill.effectAsset.startsWith('assets/effects/')),
    ).toHaveLength(10);
  });

  it('猫爪印记按一次技能结算触发，而不是按每一段 on-hit 触发', () => {
    const mark = CATKIN_SKILLS.find((skill) => skill.id === 'skill_catkin_claw_mark')!;
    const trigger = mark.effects.find((effect) => effect.kind === 'trigger');
    expect(trigger).toMatchObject({
      kind: 'trigger',
      event: 'after-skill-resolved',
    });
  });

  it('纸箱奇袭消耗三层，百爪樱岚读取快照后消耗全部印记', () => {
    const ambush = CATKIN_SKILLS.find((skill) => skill.id === 'skill_catkin_box_ambush')!;
    expect(ambush.effects.find((effect) => effect.kind === 'consume-status')).toMatchObject({
      statusId: 'catkin_claw_mark',
      stacks: 3,
    });

    const ultimate = CATKIN_SKILLS.find((skill) => skill.id === 'skill_catkin_hundred_claw')!;
    expect(primaryDamageEffect(ultimate)?.statusScaling).toEqual({
      statusId: 'catkin_claw_mark',
      damageRatioPerStack: 0.15,
      consume: 'all',
    });
  });

  it('炸毛反击命中事件来源，猫爪印记只放大施加者自己的伤害', () => {
    const counter = CATKIN_SKILLS.find(
      (skill) => skill.id === 'skill_catkin_bristle_counter',
    )!;
    const dodgeTrigger = counter.effects.find((effect) => effect.kind === 'trigger');
    expect(dodgeTrigger?.effects.find((effect) => effect.kind === 'damage')).toMatchObject({
      target: { kind: 'event-source' },
    });

    const mark = CATKIN_SKILLS.find((skill) => skill.id === 'skill_catkin_claw_mark')!;
    expect(JSON.stringify(mark.effects)).toContain('damageTakenFromSource');
  });

  it('挂机视觉节奏不把治疗、召唤或条件技伪装成无条件伤害', () => {
    expect(battleRhythmSkills('shaman', 1)).toEqual([]);
    expect(battleRhythmSkills('shaman', 20).map((skill) => skill.id)).toEqual([
      'skill_shaman_poison',
    ]);

    const catkinRhythmIds = battleRhythmSkills('catkin', 42).map((skill) => skill.id);
    expect(catkinRhythmIds).toContain('skill_catkin_scratch_frenzy');
    expect(catkinRhythmIds).not.toContain('skill_catkin_bristle_counter');
    expect(catkinRhythmIds).not.toContain('skill_catkin_box_ambush');
  });
});
