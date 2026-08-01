import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
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
      target: 'self',
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
      statusTarget: 'self',
      statusId: 'kenshi_sword_intent',
      damageRatioPerStack: 0.12,
      consume: 'all',
    });
  });

  it('燕返在伤害前读取斩杀线，无我把 30%/50% 升为 40%/60%', () => {
    const swallow = KENSHI_SKILLS.find((skill) => skill.id === 'skill_kenshi_swallow_return')!;
    expect(primaryDamageEffect(swallow)?.execute).toEqual({
      targetHpRatioAtMost: 0.3,
      bonusDamageRatio: { base: 0.5 },
      upgrade: {
        passiveSkillId: 'skill_kenshi_no_self',
        targetHpRatioAtMost: 0.4,
        bonusDamageRatio: { base: 0.6 },
      },
    });

    const noSelf = KENSHI_SKILLS.find((skill) => skill.id === 'skill_kenshi_no_self')!;
    expect(noSelf.effects).toEqual([]);
  });

  it('剑圣之心同时提供 15 暴伤与 10% 全局破甲', () => {
    const saint = KENSHI_SKILLS.find((skill) => skill.id === 'skill_kenshi_sword_saint')!;
    expect(saint.effects).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          kind: 'modifier',
          modifier: { unit: 'percentage-points', stat: 'critDmg', points: { base: 15 } },
        }),
        expect.objectContaining({
          kind: 'modifier',
          modifier: { unit: 'ratio', stat: 'armorPenetration', ratio: { base: 0.1 } },
        }),
      ]),
    );
  });

  it('完整批次登记 14 图标与 9 个主动技能特效', () => {
    expect(KENSHI_VISUAL_SKILLS).toHaveLength(14);
    for (const skill of KENSHI_VISUAL_SKILLS) {
      expect(existsSync(resolve('public', skill.icon)), skill.icon).toBe(true);
      expect(existsSync(resolve('public', skill.effectAsset)), skill.effectAsset).toBe(true);
    }
    expect(
      KENSHI_VISUAL_SKILLS.filter((skill) => skill.effectAsset.startsWith('assets/effects/')),
    ).toHaveLength(9);

    expect(battleRhythmSkills('kenshi', 88)).not.toHaveLength(0);
  });
});
