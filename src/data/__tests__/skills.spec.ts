import { describe, expect, it } from 'vitest';
import {
  DEFAULT_ACTIVE_SKILL_ORDER,
  ALL_SKILLS,
  CATKIN_SKILLS,
  CATKIN_VISUAL_SKILLS,
  KENSHI_SKILLS,
  SHAMAN_SKILLS,
  SWORDSMAN_SKILLS,
  WITCH_SKILLS,
  primaryDamageEffect,
} from '../skills';

function requireSkill<T extends { id: string }>(skills: readonly T[], id: string): T {
  const skill = skills.find((entry) => entry.id === id);
  if (!skill) throw new Error(`测试缺少技能：${id}`);
  return skill;
}

describe('five-class skill roster', () => {
  it('默认四槽顺序逐职业覆盖全部主动技，且不会跨职业或重复', () => {
    const rosters = {
      swordsman: SWORDSMAN_SKILLS,
      witch: WITCH_SKILLS,
      shaman: SHAMAN_SKILLS,
      catkin: CATKIN_SKILLS,
      kenshi: KENSHI_SKILLS,
    } as const;

    for (const [classId, skills] of Object.entries(rosters)) {
      const active = skills.filter((skill) => skill.type === 'active');
      const order = DEFAULT_ACTIVE_SKILL_ORDER[classId as keyof typeof rosters];
      expect(new Set(order).size, `${classId} 默认顺序不能重复`).toBe(order.length);
      expect(new Set(order), `${classId} 默认顺序必须覆盖全部主动技`).toEqual(
        new Set(active.map((skill) => skill.id)),
      );
      for (const id of order) {
        expect(requireSkill(active, id).class).toBe(classId);
      }
    }
  });

  it('高等级默认四槽保留各职业低冷却循环、招牌机制与终结技', () => {
    expect(DEFAULT_ACTIVE_SKILL_ORDER.shaman.slice(0, 4)).toEqual([
      'skill_shaman_heal',
      'skill_shaman_divine_beast',
      'skill_shaman_all_spirits',
      'skill_shaman_group_poison',
    ]);
    expect(DEFAULT_ACTIVE_SKILL_ORDER.catkin.slice(0, 4)).toEqual([
      'skill_catkin_hundred_claw',
      'skill_catkin_bristle_counter',
      'skill_catkin_box_ambush',
      'skill_catkin_moonshadow_step',
    ]);
    expect(DEFAULT_ACTIVE_SKILL_ORDER.kenshi.slice(0, 4)).toEqual([
      'skill_kenshi_thousand_sakura',
      'skill_kenshi_iai_flash',
      'skill_kenshi_armor_break',
      'skill_kenshi_iai_draw',
    ]);
  });

  it('五职业各 14 技能、全局 70 个 id 唯一', () => {
    const expectations = [
      [SWORDSMAN_SKILLS, 9, 5],
      [WITCH_SKILLS, 12, 2],
      [SHAMAN_SKILLS, 8, 6],
      [CATKIN_SKILLS, 10, 4],
      [KENSHI_SKILLS, 9, 5],
    ] as const;

    for (const [skills, activeCount, passiveCount] of expectations) {
      expect(skills).toHaveLength(14);
      expect(skills.filter((skill) => skill.type === 'active')).toHaveLength(activeCount);
      expect(skills.filter((skill) => skill.type === 'passive')).toHaveLength(passiveCount);
      expect([...skills].sort((a, b) => a.unlockLevel - b.unlockLevel)).toEqual(skills);
    }

    expect(ALL_SKILLS).toHaveLength(70);
    expect(new Set(ALL_SKILLS.map((skill) => skill.id)).size).toBe(70);
  });

  it('新增状态条件与状态倍率都显式声明资源归属', () => {
    const statusConditions = ALL_SKILLS.flatMap((skill) => {
      if (skill.type !== 'active') return [];
      if (
        skill.castWhen?.kind !== 'status-stacks-at-least' &&
        skill.castWhen?.kind !== 'has-status'
      ) {
        return [];
      }
      return [skill.castWhen];
    });
    expect(statusConditions).not.toHaveLength(0);
    for (const condition of statusConditions) {
      expect(condition.target).toMatch(/^(self|primary-enemy)$/);
    }

    const statusScaledDamage = ALL_SKILLS.flatMap((skill) =>
      skill.effects.flatMap((effect) =>
        effect.kind === 'damage' && effect.statusScaling ? [effect] : [],
      ),
    );
    expect(statusScaledDamage).toHaveLength(2);
    for (const effect of statusScaledDamage) {
      expect(effect.statusScaling?.statusTarget).toMatch(/^(self|damage-target)$/);
    }
  });

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

  it('剑姬的防守、斩杀与终极技保留职业定位', () => {
    const shield = requireSkill(SWORDSMAN_SKILLS, 'skill_swordsman_iron_body');
    expect(JSON.stringify(shield)).toContain('"stat":"def"');

    const bloodRage = requireSkill(SWORDSMAN_SKILLS, 'skill_swordsman_blood_rage');
    expect(bloodRage.effects.find((effect) => effect.kind === 'conditional')).toMatchObject({
      when: { kind: 'self-hp-at-most', ratio: 0.3 },
    });

    expect(primaryDamageEffect(requireSkill(SWORDSMAN_SKILLS, 'skill_swordsman_heaven_end')))
      .toMatchObject({ multiplier: { base: 4.5 }, target: { kind: 'enemies', count: 'all' } });
  });

  it('魔女的盾、持续范围伤害与终极技使用真实效果契约', () => {
    const shield = requireSkill(WITCH_SKILLS, 'skill_witch_magic_shield');
    expect(shield.effects.find((effect) => effect.kind === 'modifier')).toMatchObject({
      modifier: { unit: 'ratio', stat: 'damageTaken', ratio: { base: -0.4 } },
      durationSec: 8,
    });

    const fireWall = requireSkill(WITCH_SKILLS, 'skill_witch_fire_wall');
    expect(fireWall.effects.find((effect) => effect.kind === 'periodic-damage')).toMatchObject({
      totalMultiplier: { base: 4.8, perLevel: 0.06 },
      ticks: 6,
      durationSec: 6,
      maxStacks: 1,
    });

    expect(primaryDamageEffect(requireSkill(WITCH_SKILLS, 'skill_witch_apocalypse')))
      .toMatchObject({ multiplier: { base: 5.5 }, element: 'thunder' });
  });

  it('灵巫三个代表技能与 docs/13 的数值一致', () => {
    const heal = requireSkill(SHAMAN_SKILLS, 'skill_shaman_heal');
    expect(heal).toMatchObject({ cooldownSec: 55 });
    expect(heal.effects.find((effect) => effect.kind === 'heal')).toMatchObject({
      maxHpRatio: { base: 0.1 },
    });

    const poison = requireSkill(SHAMAN_SKILLS, 'skill_shaman_poison');
    expect(poison.effects.find((effect) => effect.kind === 'periodic-damage')).toMatchObject({
      totalMultiplier: { base: 2.35, perLevel: 0.6 },
      ticks: 10,
      durationSec: 10,
      maxStacks: 3,
    });

    expect(primaryDamageEffect(requireSkill(SHAMAN_SKILLS, 'skill_shaman_soul_fire')))
      .toMatchObject({ multiplier: { base: 2.5 } });

    const groupHeal = requireSkill(SHAMAN_SKILLS, 'skill_shaman_group_heal');
    expect(groupHeal).toMatchObject({ cooldownSec: 60 });
    expect(groupHeal.effects.find((effect) => effect.kind === 'heal')).toMatchObject({
      maxHpRatio: { base: 0.15 },
    });

    const skeleton = requireSkill(SHAMAN_SKILLS, 'skill_shaman_skeleton');
    expect(skeleton.effects.find((effect) => effect.kind === 'summon')).toMatchObject({
      durationSec: 60,
    });

    expect(requireSkill(SHAMAN_SKILLS, 'skill_shaman_blood_bite').effects[0]).toMatchObject({
      kind: 'conditional',
      when: { kind: 'self-hp-at-most', ratio: 0.3 },
      effects: [
        {
          kind: 'modifier',
          modifier: { unit: 'percentage-points', stat: 'lifesteal', points: { base: 1 } },
        },
      ],
    });
  });

  it('灵巫补齐神兽、六维真气、实际受伤反弹与终极驱散', () => {
    const beast = requireSkill(SHAMAN_SKILLS, 'skill_shaman_divine_beast');
    expect(beast.effects.find((effect) => effect.kind === 'summon')).toMatchObject({
      summonId: 'summon_shaman_divine_beast',
      durationSec: 90,
    });

    const qi = requireSkill(SHAMAN_SKILLS, 'skill_shaman_infinite_qi');
    expect(
      qi.effects.flatMap((effect) =>
        effect.kind === 'modifier' && effect.modifier.unit === 'ratio'
          ? [effect.modifier.stat]
          : [],
      ),
    ).toEqual(['atk', 'def', 'hp', 'acc', 'eva', 'spd']);

    const armor = requireSkill(SHAMAN_SKILLS, 'skill_shaman_divine_armor');
    const trigger = armor.effects.find((effect) => effect.kind === 'trigger');
    expect(trigger).toMatchObject({ event: 'on-damage-taken', chance: 0.2 });
    expect(trigger?.effects[0]).toMatchObject({
      kind: 'reflect-trigger-damage',
      target: { kind: 'event-source' },
      damageRatio: { base: 0.5 },
    });

    const ultimate = requireSkill(SHAMAN_SKILLS, 'skill_shaman_all_spirits');
    expect(ultimate.effects.find((effect) => effect.kind === 'dispel')).toMatchObject({
      target: { kind: 'enemies', count: 'all' },
      polarity: 'buff',
      count: 'all',
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
