import { describe, expect, it } from 'vitest';
import { SHAMAN_SKILLS } from '../skills';
import {
  ARENA_SUMMON_ATTACK_MULTIPLIERS,
  SUMMON_DEFINITIONS,
  summonDefinition,
} from '../summons';

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

  it('神兽的攻速和生存严格高于骷髅；攻击倍率按 08-05 平衡口径低于骷髅', () => {
    const skeleton = summonDefinition('summon_shaman_skeleton')!;
    const beast = summonDefinition('summon_shaman_divine_beast')!;

    // 2026-08-05 老板拍板路线①：神兽 0.56→0.30，单次伤害让位于骷髅；
    // 神兽保持攻速（1.8s vs 2s）与生存（血量/防御比例）优势（竞技场补偿表
    // 重标后竞技场内神兽仍高于骷髅，见 A 案断言）。
    expect(beast.attackMultiplier).toBeLessThan(skeleton.attackMultiplier);
    expect(beast.attackIntervalSec).toBeLessThan(skeleton.attackIntervalSec);
    expect(beast.maxHpRatio).toBeGreaterThan(skeleton.maxHpRatio);
    expect(beast.defenseRatio).toBeGreaterThan(skeleton.defenseRatio);
  });

  it('A 案：竞技场补偿表只登记已知召唤，灵巫两只补偿严格高于 PvE 原值', () => {
    for (const summonId of Object.keys(ARENA_SUMMON_ATTACK_MULTIPLIERS)) {
      expect(summonDefinition(summonId), summonId).toBeDefined();
    }
    expect(ARENA_SUMMON_ATTACK_MULTIPLIERS).toMatchObject({
      summon_shaman_skeleton: 0.46,
      summon_shaman_divine_beast: 0.62,
    });
    const skeleton = summonDefinition('summon_shaman_skeleton')!;
    const beast = summonDefinition('summon_shaman_divine_beast')!;
    expect(ARENA_SUMMON_ATTACK_MULTIPLIERS[skeleton.id]).toBeGreaterThan(
      skeleton.attackMultiplier,
    );
    expect(ARENA_SUMMON_ATTACK_MULTIPLIERS[beast.id]).toBeGreaterThan(beast.attackMultiplier);
  });

  it('召唤物只偶尔挡刀，且攻击与承伤数值锁定长战平衡基线', () => {
    // 2026-08-04 灵巫平衡专项（docs/85）：骷髅 0.45→0.40、神兽 0.62→0.56。
    // 2026-08-05 老板拍板路线①：神兽 0.56→0.30（竞技场由 A 案分叉承接）。
    expect(summonDefinition('summon_shaman_skeleton')).toMatchObject({
      attackMultiplier: 0.4,
      attackIntervalSec: 2,
      targetWeight: 0.05,
      maxHpRatio: 0.35,
      defenseRatio: 0.55,
    });
    expect(summonDefinition('summon_shaman_divine_beast')).toMatchObject({
      attackMultiplier: 0.3,
      attackIntervalSec: 1.8,
      targetWeight: 0.05,
      maxHpRatio: 0.55,
      defenseRatio: 0.75,
    });
  });
});
