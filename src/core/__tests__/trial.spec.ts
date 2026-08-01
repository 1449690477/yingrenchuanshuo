/**
 * 周常试炼核心逻辑的单元测试。
 *
 * 这里锁住的最重要的性质是「确定性」：客户端本地挑战的成绩必须与
 * 服务端复算的成绩逐点一致（docs/51 §6.3 是整套反作弊的地基）。
 */

import { describe, expect, it } from 'vitest';
import { CLASS_IDS, type ClassId, type EquipmentDef } from '../types';
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
import { addStats, combatPowerValue } from '../formula';
import { applyClassMods, averageSkillMultiplier, baseStatsFor, makePlayer } from '../progression';
import { expectedGearStats, typicalQualityAt } from '@/data/expectedPower';
import { createInstance } from '../equipment';
import { EQUIPMENT } from '@/data/equipment';
import { Rng } from '../rng';
import { buildDefaultPlayerSkillKit } from '../playerSkillKit';
import { SLOT_ORDER } from '@/data/constants';

const SEASON = TRIAL_SEASON_ID;
// 从分段表取而不是写死 id：分段会随内容曲线重划（docs/64 §一）
const LOW_BRACKET = TRIAL_BRACKETS[0]!.id;
const MID_BRACKET = TRIAL_BRACKETS[Math.floor(TRIAL_BRACKETS.length / 2)]!.id;
const EMPTY_EQUIPPED = Object.freeze(Array.from({ length: 8 }, () => null));

/** 从装备定义表里挑一件真实武器，避免测试写死 id 而脱离内容表。 */
function firstWeaponDef(): EquipmentDef {
  const def = Object.values(EQUIPMENT).find((d) => d.slot === 'weapon');
  if (!def) throw new Error('装备表里没有武器');
  return def;
}

function levelAppropriateEquipment(classId: ClassId, level: number) {
  const rng = new Rng(7);
  return SLOT_ORDER.map((slot, index) => {
    const definition = Object.values(EQUIPMENT)
      .filter(
        (candidate) =>
          candidate.slot === slot &&
          candidate.level <= level &&
          (!candidate.classId || candidate.classId === classId),
      )
      .sort(
        (left, right) => right.level - left.level || left.id.localeCompare(right.id),
      )[0];
    if (!definition) throw new Error(`没有 ${classId} Lv${level} 可用的 ${slot} 装备`);
    return createInstance(definition, rng, `trial-${slot}-${index}`, classId);
  });
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
  // 断言**性质**而不是具体 id：分段会随内容曲线重划（2026-07-30 已重划一次，
  // docs/64 §一）。把 id 和区间写死等于把测试变成「设计快照」，
  // 每次调分段都要改一堆断言，还会掩盖真正的回归。
  it('分段首尾相接、无空隙、无重叠，且覆盖 1~120', () => {
    const sorted = [...TRIAL_BRACKETS].sort((a, b) => a.minLevel - b.minLevel);
    expect(sorted[0]!.minLevel).toBe(1);
    expect(sorted[sorted.length - 1]!.maxLevel).toBe(120);
    for (let i = 1; i < sorted.length; i++) {
      // 相邻两段必须正好接上：上一段 maxLevel + 1 == 下一段 minLevel
      expect(sorted[i]!.minLevel).toBe(sorted[i - 1]!.maxLevel + 1);
    }
  });

  it('每一段的边界等级都能查回该段自己', () => {
    for (const bracket of TRIAL_BRACKETS) {
      expect(trialBracketFor(bracket.minLevel).id).toBe(bracket.id);
      expect(trialBracketFor(bracket.maxLevel).id).toBe(bracket.id);
    }
  });

  it('Boss 等级落在本段区间内', () => {
    for (const bracket of TRIAL_BRACKETS) {
      expect(bracket.bossLevel).toBeGreaterThanOrEqual(bracket.minLevel);
      expect(bracket.bossLevel).toBeLessThanOrEqual(bracket.maxLevel);
    }
  });

  it('id 与显示名都不重复', () => {
    expect(new Set(TRIAL_BRACKETS.map((b) => b.id)).size).toBe(TRIAL_BRACKETS.length);
    expect(new Set(TRIAL_BRACKETS.map((b) => b.name)).size).toBe(TRIAL_BRACKETS.length);
  });

  it('超出 1~120 抛错', () => {
    expect(() => trialBracketFor(0)).toThrow();
    expect(() => trialBracketFor(121)).toThrow();
  });
});

describe('weeklyTrialBoss / 每周 Boss 生成', () => {
  it('同一周同一分段：全服完全相同', () => {
    const a = weeklyTrialBoss(SEASON, 30, MID_BRACKET);
    const b = weeklyTrialBoss(SEASON, 30, MID_BRACKET);
    expect(a.combatant).toEqual(b.combatant);
    expect(a.tilt.id).toBe(b.tilt.id);
    expect(a.name).toBe(b.name);
  });

  it('换周或换分段：种子不同，Boss 随之变化', () => {
    const thisWeek = weeklyTrialBoss(SEASON, 30, MID_BRACKET);
    const nextWeek = weeklyTrialBoss(SEASON, 31, MID_BRACKET);
    expect(trialBossSeed(SEASON, 30, MID_BRACKET)).not.toBe(trialBossSeed(SEASON, 31, MID_BRACKET));
    expect(thisWeek.combatant.stats.hp).not.toBe(
      weeklyTrialBoss(SEASON, 30, LOW_BRACKET).combatant.stats.hp,
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
      const dps = estimateDps(
        reference,
        boss,
        averageSkillMultiplier(bracket.bossLevel),
        [],
        buildDefaultPlayerSkillKit('swordsman', bracket.bossLevel),
        'boss',
      );
      // 精确锁住已上线的输出/HP 锚：生存攻击校准不得顺带改变分数天花板。
      expect(boss.stats.hp).toBe(
        Math.max(1, Math.ceil(dps * TRIAL_DURATION_SEC * TRIAL_BOSS_HP_HEADROOM)),
      );
    }
  });

  it('Boss 名与元素一致，等级取分段中位', () => {
    const boss = weeklyTrialBoss(SEASON, 30, MID_BRACKET);
    expect(boss.name).toBe(boss.tilt.names[boss.combatant.element as 'fire' | 'ice' | 'thunder']);
    expect(boss.combatant.level).toBe(trialBracketById(MID_BRACKET).bossLevel);
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
    expect(build.skillKit.active.length).toBeGreaterThan(0);
    expect(
      [...build.skillKit.active, ...build.skillKit.passives].every(
        (entry) => entry.skill.class === 'swordsman' && entry.skill.unlockLevel <= 20,
      ),
    ).toBe(true);
  });

  it('樱酱试炼构建会装载真实四主动与全部已解锁被动', () => {
    const build = buildTrialCombatant({
      name: '樱酱',
      classId: 'kenshi',
      level: 120,
      equipped: EMPTY_EQUIPPED,
    });
    expect(build.skillKit.active).toHaveLength(4);
    expect(build.skillKit.passives.length).toBeGreaterThan(0);
    expect(
      [...build.skillKit.active, ...build.skillKit.passives].every(
        (entry) => entry.skill.class === 'kenshi',
      ),
    ).toBe(true);
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
    // 用未取整值比较：Lv20 单件武器的边际战力 ~0.6，展示取整后都是 21（docs/73 批 3 取整语义）。
    const empty = buildTrialCombatant({
      name: '测试',
      classId: 'swordsman',
      level: 20,
      equipped: EMPTY_EQUIPPED,
    });
    expect(combatPowerValue(build.combatant.stats)).toBeGreaterThan(
      combatPowerValue(empty.combatant.stats),
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
    const boss = weeklyTrialBoss(SEASON, 30, MID_BRACKET).combatant;
    const seed = trialScoreSeed(SEASON, 30, MID_BRACKET, build.buildHash);

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
    const boss = weeklyTrialBoss(SEASON, 30, MID_BRACKET).combatant;
    const result = runTrial(build, boss, trialScoreSeed(SEASON, 30, MID_BRACKET, build.buildHash));
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
    const boss = weeklyTrialBoss(SEASON, 30, LOW_BRACKET).combatant;
    const result = runTrial(weak, boss, trialScoreSeed(SEASON, 30, LOW_BRACKET, weak.buildHash));
    expect(result.damage).toBeGreaterThanOrEqual(0);
    expect(result.durationSec).toBeLessThanOrEqual(TRIAL_DURATION_SEC + 0.001);
  });

  it('更强的搭配打出更高的成绩（胜任感：我在变强）', () => {
    const equipped = levelAppropriateEquipment('witch', 45);
    const weak = buildTrialCombatant({
      name: 'a',
      classId: 'witch',
      level: 45,
      equipped: [null, ...equipped.slice(1)],
    });
    const strong = buildTrialCombatant({
      name: 'b',
      classId: 'witch',
      level: 45,
      equipped,
    });
    // 打**自己等级对应的分段**：拿 Lv45 的角色去打低段 Boss 本身就不符合玩法，
    // 而且功率差被压小时，「成绩种子依赖搭配哈希」带来的方差会盖过强弱差异。
    const bracket = trialBracketFor(45).id;
    const boss = weeklyTrialBoss(SEASON, 30, bracket).combatant;
    // 用同一战斗随机序列隔离“装备变强”这一变量；线上成绩仍按各自 buildHash 取种子。
    const comparisonSeed = trialScoreSeed(SEASON, 30, bracket, weak.buildHash);
    const weakScore = runTrial(weak, boss, comparisonSeed);
    const strongScore = runTrial(strong, boss, comparisonSeed);
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
    expect(trialEquipmentSnapshotIssue(forged, 'swordsman', definition.level)).toBe('affix-value');
    expect(trialEquipmentSnapshotIssue(instance, 'swordsman', definition.level - 1)).toBe(
      'equipment-level',
    );
  });

  it('v9 正式生成并迁移的老装备可参与试炼与竞技场', () => {
    const definition = EQUIPMENT.eq_r1_weapon_rare;
    if (!definition) throw new Error('缺少区域 1 稀有武器');
    const instance = createInstance(definition, new Rng(9), 'trial-v9-legacy', 'swordsman');
    const migratedLegacy = {
      ...instance,
      affixes: [{ key: 'atk' as const, value: 8.7, tier: 5 as const }],
    };

    expect(trialEquipmentSnapshotIssue(migratedLegacy, 'swordsman', definition.level)).toBeNull();
    expect(
      trialEquipmentSnapshotIssue(
        { ...migratedLegacy, affixes: [{ key: 'atk', value: 8_700, tier: 5 }] },
        'swordsman',
        definition.level,
      ),
    ).toBe('affix-value');
  });

  it('v10→v11 重标后落在当前离散区间外的职业词条仍可联机', () => {
    const definition = Object.values(EQUIPMENT).find(
      (candidate) => candidate.level === 50 && candidate.quality === 'epic',
    );
    if (!definition) throw new Error('缺少 Lv50 史诗装备定义');
    const legacyCatkin = createInstance(definition, new Rng(10), 'trial-v10-catkin', 'catkin');

    // v10 的 cat_nimble T5=233.4；v11 把 T5 从 1.54 重标到 1.64 后为 248.6。
    // 该值是正式迁移产物，但由于两次四舍五入不在当前直接生成的离散区间内。
    legacyCatkin.affixes = [{ key: 'cat_nimble', value: 248.6, tier: 5 }];
    expect(trialEquipmentSnapshotIssue(legacyCatkin, 'catkin', 69)).toBeNull();

    expect(
      trialEquipmentSnapshotIssue(
        { ...legacyCatkin, affixes: [{ key: 'cat_nimble', value: 24_860, tier: 5 }] },
        'catkin',
        69,
      ),
    ).toBe('affix-value');
  });

  it('区域升阶原样保留的低区词条可参与档案同步与竞技场', () => {
    const source = EQUIPMENT.eq_r1_weapon_rare;
    const target = EQUIPMENT.eq_r6_weapon_rare;
    if (!source || !target) throw new Error('缺少 r1→r6 稀有武器升阶链');
    const sourceInstance = createInstance(source, new Rng(20260731), 'advanced-legal', 'swordsman');
    const advanced = { ...sourceInstance, defId: target.id };

    expect(trialEquipmentSnapshotIssue(advanced, 'swordsman', target.level)).toBeNull();
    expect(
      trialEquipmentSnapshotIssue(
        {
          ...advanced,
          affixes: advanced.affixes.map((affix, index) =>
            index === 0 ? { ...affix, value: affix.value * 1000 + 1 } : affix,
          ),
        },
        'swordsman',
        target.level,
      ),
    ).toBe('affix-value');
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
