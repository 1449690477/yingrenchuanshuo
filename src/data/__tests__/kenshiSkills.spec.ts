import { describe, expect, it } from 'vitest';
import {
  KENSHI_SKILLS,
  KENSHI_VISUAL_SKILLS,
  battleRhythmSkills,
  primaryDamageEffect,
} from '../skills';

describe('kenshi skill content', () => {
  it('完整录入 14 个技能：9 主动、5 被动，解锁顺序严格递增', () => {
    expect(KENSHI_SKILLS).toHaveLength(14);
    expect(KENSHI_SKILLS.filter((skill) => skill.type === 'active')).toHaveLength(9);
    expect(KENSHI_SKILLS.filter((skill) => skill.type === 'passive')).toHaveLength(5);
    expect(KENSHI_SKILLS.map((skill) => skill.unlockLevel)).toEqual([
      1, 4, 9, 14, 19, 24, 30, 35, 42, 50, 58, 66, 76, 88,
    ]);
    expect(new Set(KENSHI_SKILLS.map((skill) => skill.id)).size).toBe(14);
  });

  it('剑意是自身资源：施法结算叠层，与喵喵敌方印记方向相反', () => {
    const intent = KENSHI_SKILLS.find((skill) => skill.id === 'skill_kenshi_sword_intent')!;
    const trigger = intent.effects.find((effect) => effect.kind === 'trigger');
    expect(trigger).toMatchObject({ kind: 'trigger', event: 'after-skill-resolved' });
    expect(JSON.stringify(trigger)).toContain('"target":{"kind":"self"}');
    expect(JSON.stringify(trigger)).toContain('kenshi_sword_intent');
    expect(JSON.stringify(trigger)).toContain('"maxStacks":5');
  });

  it('居合一闪消耗两层剑意并带破甲，千樱居合快照全部剑意增伤', () => {
    const flash = KENSHI_SKILLS.find((skill) => skill.id === 'skill_kenshi_iai_flash')!;
    expect(flash.type).toBe('active');
    if (flash.type !== 'active') throw new Error('居合·一闪必须是主动技能');
    expect(flash.castWhen).toMatchObject({
      kind: 'status-stacks-at-least',
      statusId: 'kenshi_sword_intent',
      stacks: 2,
    });
    expect(primaryDamageEffect(flash)?.defenseIgnoreRatio).toBe(0.3);
    expect(flash.effects.find((effect) => effect.kind === 'consume-status')).toMatchObject({
      statusId: 'kenshi_sword_intent',
      stacks: 2,
    });

    const ultimate = KENSHI_SKILLS.find(
      (skill) => skill.id === 'skill_kenshi_thousand_sakura',
    )!;
    expect(primaryDamageEffect(ultimate)?.statusScaling).toEqual({
      statusId: 'kenshi_sword_intent',
      damageRatioPerStack: 0.12,
      consume: 'all',
    });
  });

  it('燕返与无我都是低血斩杀，斩杀线分别为 30% 与 40%', () => {
    const swallow = KENSHI_SKILLS.find((skill) => skill.id === 'skill_kenshi_swallow_return')!;
    expect(swallow.effects.find((effect) => effect.kind === 'conditional')).toMatchObject({
      when: { kind: 'target-hp-at-most', ratio: 0.3 },
    });

    const noSelf = KENSHI_SKILLS.find((skill) => skill.id === 'skill_kenshi_no_self')!;
    expect(noSelf.effects.find((effect) => effect.kind === 'conditional')).toMatchObject({
      when: { kind: 'target-hp-at-most', ratio: 0.4 },
    });
  });

  it('剑圣之心 P1 只登记暴击伤害，破甲加成等待 M3-4', () => {
    const saint = KENSHI_SKILLS.find((skill) => skill.id === 'skill_kenshi_sword_saint')!;
    expect(JSON.stringify(saint)).not.toContain('defenseIgnoreRatio');
    expect(JSON.stringify(saint)).toContain('critDmg');
  });

  it('P1 不伪造未制作的视觉技能和挂机演出', () => {
    expect(KENSHI_VISUAL_SKILLS).toEqual([]);
    expect(battleRhythmSkills('kenshi', 88)).toEqual([]);
  });
});
