import { describe, expect, it } from 'vitest';
import { SHAMAN_SKILLS } from '../skills';
import { SUMMON_DEFINITIONS, summonDefinition } from '../summons';

describe('summon data contract', () => {
  it('召唤技能都引用真实配置，且持续时间逐项一致', () => {
    const summonEffects = SHAMAN_SKILLS.flatMap((skill) =>
      skill.effects.filter((effect) => effect.kind === 'summon'),
    );

    expect(summonEffects).toHaveLength(2);
    for (const effect of summonEffects) {
      const definition = summonDefinition(effect.summonId);
      expect(definition, effect.summonId).toBeDefined();
      expect(definition?.durationSec).toBe(effect.durationSec);
      expect(definition?.ownerClass).toBe('shaman');
    }
  });

  it('每个召唤物都显式给出攻击、选敌、承伤与同场上限', () => {
    const definitions = SUMMON_DEFINITIONS;
    expect(definitions.map((entry) => entry.id)).toEqual([
      'summon_shaman_skeleton',
      'summon_shaman_divine_beast',
    ]);

    for (const definition of definitions) {
      expect(definition.attackMultiplier).toBeGreaterThan(0);
      expect(definition.attackIntervalSec).toBeGreaterThan(0);
      expect(['primary-enemy', 'lowest-hp-enemy']).toContain(definition.targeting);
      expect(definition.damageable).toBe(true);
      expect(definition.targetWeight).toBe(0.05);
      expect(definition.maxHpRatio).toBeGreaterThan(0);
      expect(definition.defenseRatio).toBeGreaterThan(0);
      expect(definition.inheritedStats).toEqual(['atk', 'hp', 'def']);
      expect(definition.maxConcurrent).toBe(1);
    }
  });

  it('神兽的单次伤害、攻速和生存均严格高于骷髅', () => {
    const skeleton = summonDefinition('summon_shaman_skeleton')!;
    const beast = summonDefinition('summon_shaman_divine_beast')!;

    expect(beast.attackMultiplier).toBeGreaterThan(skeleton.attackMultiplier);
    expect(beast.attackIntervalSec).toBeLessThan(skeleton.attackIntervalSec);
    expect(beast.maxHpRatio).toBeGreaterThan(skeleton.maxHpRatio);
    expect(beast.defenseRatio).toBeGreaterThan(skeleton.defenseRatio);
  });

  it('召唤物只偶尔挡刀，且攻击与承伤数值锁定长战平衡基线', () => {
    expect(summonDefinition('summon_shaman_skeleton')).toMatchObject({
      attackMultiplier: 0.45,
      attackIntervalSec: 2,
      targetWeight: 0.05,
      maxHpRatio: 0.35,
      defenseRatio: 0.55,
    });
    expect(summonDefinition('summon_shaman_divine_beast')).toMatchObject({
      attackMultiplier: 0.75,
      attackIntervalSec: 1.8,
      targetWeight: 0.05,
      maxHpRatio: 0.55,
      defenseRatio: 0.75,
    });
  });
});
