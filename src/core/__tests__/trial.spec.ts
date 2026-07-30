/**
 * 周常试炼核心逻辑的单元测试。
 *
 * 这里锁住的最重要的性质是「确定性」：客户端本地挑战的成绩必须与
 * 服务端复算的成绩逐点一致（docs/51 §6.3 是整套反作弊的地基）。
 */

import { describe, expect, it } from 'vitest';
import { CLASS_IDS, type EquipmentDef } from '../types';
import {
  buildTrialCombatant,
  canonicalBuildHash,
  decideTrialScoreWrite,
  fnv1a32,
  runTrial,
  trialBossSeed,
  trialBracketById,
  trialBracketFor,
  trialEquipmentSnapshotIssue,
  trialScoreSeed,
  trialWeekIndex,
  trialWeekRemainingMs,
  trialWeekStartMs,
  upperPercentText,
  weeklyTrialBoss,
} from '../trial';
import {
  TRIAL_BRACKETS,
  TRIAL_BOSS_HP_HEADROOM,
  TRIAL_DURATION_SEC,
  TRIAL_SEASON_ID,
} from '@/data/trialRules';
import { estimateDps } from '../combat';
import { addStats } from '../formula';
import { applyClassMods, averageSkillMultiplier, baseStatsFor, makePlayer } from '../progression';
import { expectedGearStats, typicalQualityAt } from '@/data/expectedPower';
import { createInstance } from '../equipment';
import { EQUIPMENT } from '@/data/equipment';
import { Rng } from '../rng';

const SEASON = TRIAL_SEASON_ID;
const EMPTY_EQUIPPED = Object.freeze(Array.from({ length: 8 }, () => null));

/** 从装备定义表里挑一件真实武器，避免测试写死 id 而脱离内容表。 */
function firstWeaponDef(): EquipmentDef {
  const def = Object.values(EQUIPMENT).find((d) => d.slot === 'weapon');
  if (!def) throw new Error('装备表里没有武器');
  return def;
}

describe('trialWeekIndex / 周切边界', () => {
  it('周一 04:00（北京时间）前仍算上一周', () => {
    // 2026-07-27 是周一；03:59:59 +08 = 周日 19:59:59 UTC
    const before = Date.UTC(2026, 6, 26, 19, 59, 59);
    // 周一 04:00:00 +08 = 周日 20:00:00 UTC
    const at = Date.UTC(2026, 6, 26, 20, 0, 0);
    expect(trialWeekIndex(at)).toBe(trialWeekIndex(before) + 1);
  });

  it('周开始时刻与剩余时间自洽', () => {
    const now = Date.UTC(2026, 6, 29, 12, 0, 0);
    const week = trialWeekIndex(now);
    const start = trialWeekStartMs(week);
    const nextStart = trialWeekStartMs(week + 1);
    expect(start).toBeLessThanOrEqual(now);
    expect(nextStart).toBeGreaterThan(now);
    expect(trialWeekRemainingMs(now)).toBe(nextStart - now);
    // 一周恒为 7 天
    expect(nextStart - start).toBe(7 * 24 * 3_600_000);
  });

  it('拒绝非法时间戳', () => {
    expect(() => trialWeekIndex(Number.NaN)).toThrow();
    expect(() => trialWeekIndex(-1)).toThrow();
  });
});

describe('trialBracketFor / 等级分段', () => {
  it('覆盖四个分段的边界', () => {
    expect(trialBracketFor(1).id).toBe('chuying');
    expect(trialBracketFor(30).id).toBe('chuying');
    expect(trialBracketFor(31).id).toBe('feiyue');
    expect(trialBracketFor(60).id).toBe('feiyue');
    expect(trialBracketFor(61).id).toBe('hupo');
    expect(trialBracketFor(90).id).toBe('hupo');
    expect(trialBracketFor(91).id).toBe('feiying');
    expect(trialBracketFor(120).id).toBe('feiying');
  });

  it('超出 1~120 抛错', () => {
    expect(() => trialBracketFor(0)).toThrow();
    expect(() => trialBracketFor(121)).toThrow();
  });
});

describe('weeklyTrialBoss / 每周 Boss 生成', () => {
  it('同一周同一分段：全服完全相同', () => {
    const a = weeklyTrialBoss(SEASON, 30, 'feiyue');
    const b = weeklyTrialBoss(SEASON, 30, 'feiyue');
    expect(a.combatant).toEqual(b.combatant);
    expect(a.tilt.id).toBe(b.tilt.id);
    expect(a.name).toBe(b.name);
  });

  it('换周或换分段：种子不同，Boss 随之变化', () => {
    const thisWeek = weeklyTrialBoss(SEASON, 30, 'feiyue');
    const nextWeek = weeklyTrialBoss(SEASON, 31, 'feiyue');
    expect(trialBossSeed(SEASON, 30, 'feiyue')).not.toBe(trialBossSeed(SEASON, 31, 'feiyue'));
    expect(thisWeek.combatant.stats.hp).not.toBe(
      weeklyTrialBoss(SEASON, 30, 'chuying').combatant.stats.hp,
    );
    void nextWeek;
  });

  it('血量永远打不完：高于基准玩家 60 秒期望输出的余量倍', () => {
    for (const bracket of TRIAL_BRACKETS) {
      const boss = weeklyTrialBoss(SEASON, 30, bracket.id).combatant;
      const quality = typicalQualityAt(bracket.bossLevel);
      const referenceStats = applyClassMods(
        'swordsman',
        addStats(
          baseStatsFor('swordsman', bracket.bossLevel),
          expectedGearStats(bracket.bossLevel, quality),
        ),
      );
      const reference = makePlayer('基准', bracket.bossLevel, referenceStats);
      const dps = estimateDps(reference, boss, averageSkillMultiplier(bracket.bossLevel));
      // 允许取整误差：血量 ≥ 基准输出 × 时长 × (余量-1)
      expect(boss.stats.hp).toBeGreaterThanOrEqual(
        dps * TRIAL_DURATION_SEC * (TRIAL_BOSS_HP_HEADROOM - 1),
      );
    }
  });

  it('Boss 名与元素一致，等级取分段中位', () => {
    const boss = weeklyTrialBoss(SEASON, 30, 'hupo');
    expect(boss.name).toBe(boss.tilt.names[boss.combatant.element as 'fire' | 'ice' | 'thunder']);
    expect(boss.combatant.level).toBe(trialBracketById('hupo').bossLevel);
  });
});

describe('buildTrialCombatant / 搭配构建', () => {
  it('空装备也能构建：只有裸属性，技能倍率取等级平均', () => {
    const build = buildTrialCombatant({
      name: '测试',
      classId: 'swordsman',
      level: 20,
      equipped: EMPTY_EQUIPPED,
    });
    expect(build.combatPower).toBeGreaterThan(0);
    expect(build.skillMultiplier).toBeCloseTo(averageSkillMultiplier(20), 6);
    expect(build.combatant.element).toBe('none');
    expect(build.onHitTriggers).toEqual([]);
  });

  it('槽位数不对直接抛错', () => {
    expect(() =>
      buildTrialCombatant({ name: 'x', classId: 'witch', level: 5, equipped: [] }),
    ).toThrow();
  });

  it('四职业同等级裸属性战力各不相同（职业系数生效）', () => {
    const powers = CLASS_IDS.map(
      (classId) =>
        buildTrialCombatant({ name: 'n', classId, level: 40, equipped: EMPTY_EQUIPPED })
          .combatPower,
    );
    expect(new Set(powers).size).toBeGreaterThan(1);
  });

  it('武器元素进入战斗单位', () => {
    const rng = new Rng(42);
    const weapon = createInstance(firstWeaponDef(), rng, 'test-uid-1', 'swordsman');
    const build = buildTrialCombatant({
      name: '测试',
      classId: 'swordsman',
      level: 20,
      equipped: [weapon, null, null, null, null, null, null, null],
    });
    expect(build.combatant.element).toBe(firstWeaponDef().element);
    expect(build.combatPower).toBeGreaterThan(
      buildTrialCombatant({
        name: '测试',
        classId: 'swordsman',
        level: 20,
        equipped: EMPTY_EQUIPPED,
      }).combatPower,
    );
  });
});

describe('canonicalBuildHash / 搭配哈希', () => {
  it('uid、锁定、幸运值不影响哈希（战斗等价即同分）', () => {
    const rng = new Rng(12345);
    const a = createInstance(firstWeaponDef(), rng, 'uid-a', 'swordsman');
    const b = { ...a, uid: 'uid-b', locked: !a.locked, enhanceLuck: { 5: 3 } };
    const equipped = [a, null, null, null, null, null, null, null];
    const equippedB = [b, null, null, null, null, null, null, null];
    expect(canonicalBuildHash(equipped)).toBe(canonicalBuildHash(equippedB));
  });

  it('换一件装备哈希就变化', () => {
    const rng = new Rng(999);
    const a = createInstance(firstWeaponDef(), rng, 'uid-a', 'swordsman');
    const hashA = canonicalBuildHash([a, null, null, null, null, null, null, null]);
    const hashEmpty = canonicalBuildHash([...EMPTY_EQUIPPED]);
    expect(hashA).not.toBe(hashEmpty);
  });
});

describe('runTrial / 试炼模拟', () => {
  it('确定性：同一 build 同一周，成绩逐点一致（客户端 = 服务端）', () => {
    const rng = new Rng(20260729);
    const weapon = createInstance(firstWeaponDef(), rng, 'uid-det', 'swordsman');
    const build = buildTrialCombatant({
      name: '夜见',
      classId: 'swordsman',
      level: 45,
      equipped: [weapon, null, null, null, null, null, null, null],
    });
    const boss = weeklyTrialBoss(SEASON, 30, 'feiyue').combatant;
    const seed = trialScoreSeed(SEASON, 30, 'feiyue', build.buildHash);

    const runA = runTrial(build, boss, seed);
    const runB = runTrial(build, boss, seed);
    expect(runA.damage).toBe(runB.damage);
    expect(runA.damageTaken).toBe(runB.damageTaken);
    expect(runA.survived).toBe(runB.survived);
    expect(runA.timeline).toEqual(runB.timeline);
    expect(runA.playerHpRemaining).toBe(runB.playerHpRemaining);
    expect(runA.bossHpRemaining).toBe(runB.bossHpRemaining);
    // 不修改入参
    expect(boss.currentHp).toBe(boss.stats.hp);
    expect(build.combatant.currentHp).toBe(build.combatant.stats.hp);
  });

  it('回放逐击与最终战果使用同一份模拟数据', () => {
    const build = buildTrialCombatant({
      name: '回放校验',
      classId: 'witch',
      level: 45,
      equipped: EMPTY_EQUIPPED,
    });
    const boss = weeklyTrialBoss(SEASON, 30, 'feiyue').combatant;
    const result = runTrial(build, boss, trialScoreSeed(SEASON, 30, 'feiyue', build.buildHash));
    const playerDamage = result.timeline
      .filter((event) => event.source === 'player')
      .reduce((sum, event) => sum + event.event.damage, 0);
    const monsterDamage = result.timeline
      .filter((event) => event.source === 'monster')
      .reduce((sum, event) => sum + event.event.damage, 0);

    expect(Math.round(playerDamage)).toBe(result.damage);
    expect(Math.round(monsterDamage)).toBe(result.damageTaken);
    expect(Math.round(result.bossHpMax - result.bossHpRemaining)).toBe(result.damage);
    expect(result.playerHpRemaining).toBeGreaterThanOrEqual(0);
    expect(result.playerHpRemaining).toBeLessThanOrEqual(result.playerHpMax);
    expect(result.bossHpRemaining).toBeGreaterThan(0);
  });

  it('不设失败状态：任何人都能打出一个非负成绩', () => {
    const weak = buildTrialCombatant({
      name: '新人',
      classId: 'catkin',
      level: 1,
      equipped: EMPTY_EQUIPPED,
    });
    const boss = weeklyTrialBoss(SEASON, 30, 'chuying').combatant;
    const result = runTrial(weak, boss, trialScoreSeed(SEASON, 30, 'chuying', weak.buildHash));
    expect(result.damage).toBeGreaterThanOrEqual(0);
    expect(result.durationSec).toBeLessThanOrEqual(TRIAL_DURATION_SEC + 0.001);
  });

  it('更强的搭配打出更高的成绩（胜任感：我在变强）', () => {
    const rng = new Rng(7);
    const weak = buildTrialCombatant({
      name: 'a',
      classId: 'witch',
      level: 45,
      equipped: EMPTY_EQUIPPED,
    });
    const strongWeapon = createInstance(firstWeaponDef(), rng, 'uid-strong', 'witch');
    const strong = buildTrialCombatant({
      name: 'b',
      classId: 'witch',
      level: 45,
      equipped: [strongWeapon, null, null, null, null, null, null, null],
    });
    const boss = weeklyTrialBoss(SEASON, 30, 'feiyue').combatant;
    const weakScore = runTrial(weak, boss, trialScoreSeed(SEASON, 30, 'feiyue', weak.buildHash));
    const strongScore = runTrial(
      strong,
      boss,
      trialScoreSeed(SEASON, 30, 'feiyue', strong.buildHash),
    );
    expect(strongScore.damage).toBeGreaterThan(weakScore.damage);
  });
});

describe('榜单展示辅助', () => {
  it('百分位段位：向上取整，最差也是 100%', () => {
    expect(upperPercentText(1, 100)).toBe('上位 1%');
    expect(upperPercentText(12, 100)).toBe('上位 12%');
    expect(upperPercentText(3271, 5000)).toBe('上位 66%');
    expect(upperPercentText(5000, 5000)).toBe('上位 100%');
    expect(upperPercentText(0, 0)).toBe('—');
  });

  it('真实生成的装备通过硬校验，伪造词条数值与越级装备被拒绝', () => {
    const definition = firstWeaponDef();
    const instance = createInstance(definition, new Rng(20260730), 'trial-legal', 'swordsman');
    expect(trialEquipmentSnapshotIssue(instance, 'swordsman', definition.level)).toBeNull();

    const forged = {
      ...instance,
      affixes: instance.affixes.map((affix, index) =>
        index === 0 ? { ...affix, value: affix.value * 1000 + 1 } : affix,
      ),
    };
    expect(trialEquipmentSnapshotIssue(forged, 'swordsman', definition.level)).toBe(
      'affix-value',
    );
    expect(trialEquipmentSnapshotIssue(instance, 'swordsman', definition.level - 1)).toBe(
      'equipment-level',
    );
  });
});

describe('decideTrialScoreWrite / 最好成绩写入决策', () => {
  it('首次提交与更高成绩正常写入', () => {
    expect(decideTrialScoreWrite(null, 100, true)).toEqual({
      action: 'insert',
      bestDamage: 100,
      bestVerified: true,
      improved: true,
    });
    expect(decideTrialScoreWrite({ damage: 100, verified: true }, 120, true)).toEqual({
      action: 'replace',
      bestDamage: 120,
      bestVerified: true,
      improved: true,
    });
  });

  it('同一真实成绩可修复旧版误审，较低成绩不能洗白较高旧分', () => {
    expect(decideTrialScoreWrite({ damage: 100, verified: false }, 100, true)).toEqual({
      action: 'reverify',
      bestDamage: 100,
      bestVerified: true,
      improved: false,
    });
    expect(decideTrialScoreWrite({ damage: 100, verified: false }, 99, true)).toEqual({
      action: 'keep',
      bestDamage: 100,
      bestVerified: false,
      improved: false,
    });
  });
});

describe('fnv1a32', () => {
  it('稳定且对输入敏感', () => {
    expect(fnv1a32('s1:boss:30:feiyue')).toBe(fnv1a32('s1:boss:30:feiyue'));
    expect(fnv1a32('a')).not.toBe(fnv1a32('b'));
    expect(fnv1a32('中文键名·霜噬之影')).toBe(fnv1a32('中文键名·霜噬之影'));
  });
});
