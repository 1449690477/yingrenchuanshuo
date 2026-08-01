import { describe, expect, it } from 'vitest';
import { simulateFight } from '../combat';
import { Rng } from '../rng';
import {
  createSkillCombatKit,
  createSkillCombatState,
  skillStatusStacks,
  type SkillSummonDefinition,
} from '../skillCombat';
import type { Combatant, Skill } from '../types';
import { KENSHI_SKILLS, SHAMAN_SKILLS } from '@/data/skills';

function fighter(name: string, overrides: Partial<Combatant['stats']> = {}): Combatant {
  const stats = {
    atk: 100,
    def: 80,
    hp: 20_000,
    acc: 500,
    eva: 0,
    critRate: 0,
    critDmg: 50,
    spd: 1,
    ...overrides,
  };
  return { name, level: 60, element: 'none', stats, currentHp: stats.hp };
}

describe('通用技能战斗状态机', () => {
  it('缺省技能栏稳定选择优先级最高的四个已解锁主动，被动全部生效', () => {
    const skills: Skill[] = Array.from({ length: 6 }, (_, index) => ({
      id: `active-${index}`,
      name: `主动${index}`,
      class: 'kenshi',
      type: 'active',
      element: 'none',
      unlockLevel: index + 1,
      cooldownSec: 3,
      priority: index,
      effects: [],
      icon: '',
      desc: '',
    }));
    skills.push({
      id: 'passive',
      name: '被动',
      class: 'kenshi',
      type: 'passive',
      element: 'none',
      unlockLevel: 1,
      effects: [],
      icon: '',
      desc: '',
    });

    const kit = createSkillCombatKit(skills, 60);
    expect(kit.active.map(({ skill }) => skill.id)).toEqual([
      'active-5',
      'active-4',
      'active-3',
      'active-2',
    ]);
    expect(kit.passives.map(({ skill }) => skill.id)).toEqual(['passive']);
  });

  it('剑意由真实伤害技能积攒，2 层后居合一闪才会进入结算并消耗', () => {
    const kit = createSkillCombatKit(KENSHI_SKILLS, 40);
    const player = fighter('樱酱', { spd: 2 });
    const target = fighter('木桩', { hp: 2_000_000, def: 500, spd: 0.01 });
    const result = simulateFight(player, target, new Rng(0x88aa11), {
      maxSeconds: 20,
      playerSkillKit: kit,
      playerTargetType: 'boss',
    });
    const direct = result.events.flatMap((event) =>
      event.source === 'player' && event.event.kind === 'direct-damage' ? [event.event] : [],
    );
    expect(direct.some((event) => event.skillId === 'skill_kenshi_armor_break')).toBe(true);
    expect(direct.some((event) => event.skillId === 'skill_kenshi_iai_flash')).toBe(true);
    expect(result.damageDealt).toBeGreaterThan(0);
  });

  it('多段技能只拆分一次总倍率，并把技能 id / 段序写入同一结算时间线', () => {
    const multi: Skill = {
      id: 'multi',
      name: '三连',
      class: 'kenshi',
      type: 'active',
      element: 'none',
      unlockLevel: 1,
      cooldownSec: 60,
      priority: 1,
      effects: [
        {
          kind: 'damage',
          target: { kind: 'primary-enemy' },
          multiplier: { base: 3 },
          hitWeights: [1, 1, 1],
        },
      ],
      icon: '',
      desc: '',
    };
    const result = simulateFight(
      fighter('甲', { spd: 0.1 }),
      fighter('乙', { hp: 1_000_000, def: 0, spd: 0.01 }),
      new Rng(7),
      { maxSeconds: 1, playerSkillKit: createSkillCombatKit([multi], 1) },
    );
    const hits = result.events.flatMap((event) =>
      event.source === 'player' &&
      event.event.kind === 'direct-damage' &&
      event.event.skillId === 'multi'
        ? [event.event]
        : [],
    );
    expect(hits).toHaveLength(3);
    expect(hits.map((event) => event.hitIndex)).toEqual([1, 2, 3]);
    expect(hits.every((event) => event.hitCount === 3)).toBe(true);
  });

  it('召唤配置缺失时直接暴露配置错误，不用普攻或虚假召唤兜底', () => {
    const kit = createSkillCombatKit(SHAMAN_SKILLS, 20);
    expect(() =>
      simulateFight(fighter('灵巫'), fighter('目标'), new Rng(1), {
        maxSeconds: 1,
        playerSkillKit: kit,
      }),
    ).toThrow('召唤技能缺少数值定义');
  });

  it('可受击召唤物按 seeded 权重进入目标池，死亡后立即回到主人', () => {
    const summonSkill: Skill = {
      id: 'summon-guard',
      name: '召唤守卫',
      class: 'shaman',
      type: 'active',
      element: 'none',
      unlockLevel: 1,
      cooldownSec: 60,
      priority: 10,
      effects: [{ kind: 'summon', summonId: 'guard', durationSec: 60 }],
      icon: '',
      desc: '',
    };
    const guard: SkillSummonDefinition = {
      id: 'guard',
      attackMultiplier: 0.1,
      attackIntervalSec: 10,
      element: 'none',
      damageable: true,
      maxHpRatio: 0.01,
      defenseRatio: 0.1,
      targetWeight: 1_000_000,
      maxConcurrent: 1,
    };
    const result = simulateFight(
      fighter('攻击者', { atk: 2_000, spd: 1 }),
      fighter('召唤者', { hp: 100_000, def: 0, spd: 0.1 }),
      new Rng(0x5a17),
      {
        maxSeconds: 3.5,
        monsterSkillKit: createSkillCombatKit([summonSkill], 1, { summons: [guard] }),
      },
    );
    const playerHits = result.events.filter(
      (event) => event.source === 'player' && event.event.kind === 'direct-damage',
    );
    expect(playerHits.filter((event) => event.targetSummonId === 'guard')).toHaveLength(1);
    expect(playerHits.filter((event) => event.targetSummonId === undefined).length).toBeGreaterThan(1);
  });

  it('全体伤害同时命中角色与仍存活召唤物，不把召唤语义退化成单体', () => {
    const summonSkill: Skill = {
      id: 'summon-wall',
      name: '召唤壁垒',
      class: 'shaman',
      type: 'active',
      element: 'none',
      unlockLevel: 1,
      cooldownSec: 60,
      priority: 10,
      effects: [{ kind: 'summon', summonId: 'wall', durationSec: 60 }],
      icon: '',
      desc: '',
    };
    const aoe: Skill = {
      id: 'aoe',
      name: '全体斩',
      class: 'kenshi',
      type: 'active',
      element: 'none',
      unlockLevel: 1,
      cooldownSec: 1,
      priority: 10,
      effects: [
        { kind: 'damage', target: { kind: 'enemies', count: 'all' }, multiplier: { base: 0.1 } },
        {
          kind: 'periodic-damage',
          target: { kind: 'enemies', count: 'all' },
          totalMultiplier: { base: 0.05 },
          ticks: 1,
          durationSec: 1,
        },
      ],
      icon: '',
      desc: '',
    };
    const wall: SkillSummonDefinition = {
      id: 'wall',
      attackMultiplier: 0.1,
      attackIntervalSec: 10,
      element: 'none',
      damageable: true,
      maxHpRatio: 1,
      defenseRatio: 1,
      targetWeight: 1,
      maxConcurrent: 1,
    };
    const result = simulateFight(
      fighter('剑士', { atk: 100, spd: 1 }),
      fighter('灵巫', { hp: 100_000, def: 0, spd: 0.1 }),
      new Rng(0xa0e),
      {
        maxSeconds: 2.5,
        playerSkillKit: createSkillCombatKit([aoe], 1),
        monsterSkillKit: createSkillCombatKit([summonSkill], 1, { summons: [wall] }),
      },
    );
    const aoeHits = result.events.filter(
      (event) => event.event.kind === 'direct-damage' && event.event.skillId === 'aoe',
    );
    expect(aoeHits.some((event) => event.targetSummonId === undefined)).toBe(true);
    expect(aoeHits.some((event) => event.targetSummonId === 'wall')).toBe(true);
    const periodicHits = result.events.filter((event) => event.event.kind === 'periodic-damage');
    expect(periodicHits.some((event) => event.targetSummonId === undefined)).toBe(true);
    expect(periodicHits.some((event) => event.targetSummonId === 'wall')).toBe(true);
  });

  it('斩杀在本次伤害前读取血线，并由已装备的升级被动完整替换阈值与加成', () => {
    const execute: Skill = {
      id: 'execute',
      name: '燕返',
      class: 'kenshi',
      type: 'active',
      element: 'none',
      unlockLevel: 1,
      cooldownSec: 60,
      priority: 10,
      effects: [
        {
          kind: 'damage',
          target: { kind: 'primary-enemy' },
          multiplier: { base: 1 },
          execute: {
            targetHpRatioAtMost: 0.3,
            bonusDamageRatio: { base: 0.5 },
            upgrade: {
              passiveSkillId: 'no-self',
              targetHpRatioAtMost: 0.4,
              bonusDamageRatio: { base: 0.6 },
            },
          },
        },
      ],
      icon: '',
      desc: '',
    };
    const passive: Skill = {
      id: 'no-self',
      name: '无我',
      class: 'kenshi',
      type: 'passive',
      element: 'none',
      unlockLevel: 1,
      effects: [],
      icon: '',
      desc: '',
    };
    const target = fighter('目标', { hp: 1_000, def: 0, spd: 0.01 });
    target.currentHp = 400;
    const base = simulateFight(fighter('甲', { spd: 0.1 }), { ...target }, new Rng(2), {
      maxSeconds: 1,
      playerSkillKit: createSkillCombatKit([execute], 1),
    });
    const upgraded = simulateFight(fighter('甲', { spd: 0.1 }), { ...target }, new Rng(2), {
      maxSeconds: 1,
      playerSkillKit: createSkillCombatKit([execute, passive], 1),
    });
    expect(upgraded.damageDealt).toBeGreaterThan(base.damageDealt * 1.5);
  });

  it('反伤严格按本次实际承伤计算，并回到事件来源而不是按攻击力伪造', () => {
    const reflect: Skill = {
      id: 'reflect',
      name: '神圣战甲',
      class: 'shaman',
      type: 'passive',
      element: 'none',
      unlockLevel: 1,
      effects: [
        {
          kind: 'trigger',
          event: 'on-damage-taken',
          effects: [
            {
              kind: 'reflect-trigger-damage',
              target: { kind: 'event-source' },
              damageRatio: { base: 0.5 },
            },
          ],
        },
      ],
      icon: '',
      desc: '',
    };
    const result = simulateFight(
      fighter('攻击者', { atk: 200, spd: 0.1 }),
      fighter('防守者', { atk: 1, def: 0, spd: 0.01 }),
      new Rng(91),
      { maxSeconds: 1, monsterSkillKit: createSkillCombatKit([reflect], 1) },
    );
    const direct = result.events.find(
      (event) => event.source === 'player' && event.event.kind === 'direct-damage',
    );
    const reflected = result.events.find(
      (event) =>
        event.source === 'monster' &&
        event.event.kind === 'on-hit-elemental-damage' &&
        event.event.triggerId === 'reflect',
    );
    expect(direct?.event.damage).toBeGreaterThan(0);
    expect(reflected?.event.damage).toBeCloseTo((direct?.event.damage ?? 0) * 0.5, 8);
  });

  it('同一技能栏与种子产生逐点一致的伤害和时间线', () => {
    const kit = createSkillCombatKit(KENSHI_SKILLS, 40);
    const run = () =>
      simulateFight(fighter('樱酱'), fighter('目标', { hp: 100_000 }), new Rng(12345), {
        maxSeconds: 12,
        playerSkillKit: kit,
      });
    expect(run()).toEqual(run());
  });

  it('状态层数读取不存在状态时严格为 0', () => {
    const state = createSkillCombatState({ active: [], passives: [] });
    expect(skillStatusStacks(state, 'missing')).toBe(0);
  });
});
