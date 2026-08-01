import { describe, expect, it } from 'vitest';
import { CLASS_IDS } from '@/core/types';
import { autoBattleSkillCards } from '../skillCards';
import { battleRhythmSkills } from '../skills';

describe('自动技能演出卡组', () => {
  it.each(CLASS_IDS)('%s 在低等级也稳定提供至少四张可读卡片', (classId) => {
    const cards = autoBattleSkillCards(classId, 1);
    expect(cards.length).toBeGreaterThanOrEqual(4);
    expect(cards[0]).toMatchObject({
      id: `basic-${classId}`,
      mode: 'basic',
      kind: '基础',
    });
    expect(new Set(cards.map((card) => card.id)).size).toBe(cards.length);
    expect(cards.every((card) => card.iconAsset.length > 0)).toBe(true);
  });

  it('樱酱完整显示基础攻击、9 个主动技能，并锁定 5 个被动不冒充自动释放', () => {
    const cards = autoBattleSkillCards('kenshi', 99);
    expect(cards[0]).toMatchObject({ id: 'basic-kenshi', mode: 'basic', kind: '基础' });
    expect(cards.filter((card) => card.skillId?.startsWith('skill_kenshi_'))).toHaveLength(9);
    expect(cards.every((card) => !card.iconAsset.includes('catkin'))).toBe(true);
  });

  it.each(CLASS_IDS)('%s 的自动卡严格映射到同一节奏技能 ID', (classId) => {
    const cards = autoBattleSkillCards(classId, 99);
    const autoIds = cards.filter((card) => card.mode === 'auto').map((card) => card.skillId);
    expect(autoIds).toEqual(battleRhythmSkills(classId, 99).map((skill) => skill.id));
  });

  it('治疗、召唤和带条件技能只显示条件待机，不伪装成伤害轮转', () => {
    const shamanCards = autoBattleSkillCards('shaman', 25);
    expect(shamanCards.find((card) => card.skillId === 'skill_shaman_heal')).toMatchObject({
      mode: 'conditional',
      kind: '回复',
    });
    expect(shamanCards.find((card) => card.skillId === 'skill_shaman_skeleton')).toMatchObject({
      mode: 'conditional',
      kind: '召唤',
    });
    expect(shamanCards.find((card) => card.skillId === 'skill_shaman_poison')?.mode).toBe('auto');

    const catCards = autoBattleSkillCards('catkin', 25);
    expect(catCards.find((card) => card.skillId === 'skill_catkin_bristle_counter')).toMatchObject({
      mode: 'conditional',
      conditionText: '生命低于 65%',
    });
  });

  it('不把被动技能或尚未开放的技能报成自动释放', () => {
    const cards = autoBattleSkillCards('catkin', 15);
    expect(cards.some((card) => card.skillId === 'skill_catkin_keen_whiskers')).toBe(false);
    expect(
      cards.filter((card) => card.unlockLevel > 15).every((card) => card.mode === 'locked'),
    ).toBe(true);
  });
});
