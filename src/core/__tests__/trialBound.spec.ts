import { describe, expect, it } from 'vitest';
import {
  TRIAL_DAMAGE_HEADROOM,
  isPlausibleTrialDamage,
  maxPlausibleTrialDamage,
  trialBracketDamageCeiling,
  trialDamageCeiling,
} from '../trialBound';
import {
  buildTrialCombatant,
  runTrial,
  trialBracketFor,
  trialEquipmentSnapshotIssue,
  trialFightOptions,
  trialScoreSeed,
  trialSurvivalReferenceCombatant,
  trialWeekIndex,
  type TrialBuild,
  weeklyTrialBoss,
} from '../trial';
import { TRIAL_SEASON_ID, TRIAL_BRACKETS } from '../../data/trialRules';
import { judgeCheatEvidence } from '../cheatEvidence';
import { CLASS_IDS, type ClassId, type EquipmentInstance } from '../types';
import { affixValueRange, createInstance, itemBaseValue } from '../equipment';
import { EQUIPMENT } from '@/data/equipment';
import { ENHANCE_GAIN_MAX, ENHANCE_MAX, EQUIPMENT_BASE_ROLL_MAX, SLOT_ORDER } from '@/data/constants';
import { Rng } from '../rng';
import { guildExpeditionBoss } from '../guildExpedition';
import { combatPower } from '../formula';
import { buildDefaultPlayerSkillKit } from '../playerSkillKit';

/** 用一个固定周次，避免读数随真实时间漂移。 */
const WEEK = trialWeekIndex(Date.parse('2026-07-30T12:00:00Z'));

describe('试炼伤害上界 · 不许误伤真实玩家', () => {
  it('把 Boss 打死（满伤）是合法的 —— 这是肝帝的正常形态，不是异常', () => {
    const bossHp = weeklyTrialBoss(TRIAL_SEASON_ID, WEEK, trialBracketFor(81).id).combatant.stats
      .hp;
    expect(isPlausibleTrialDamage(bossHp, 81, 'swordsman', WEEK)).toBe(true);
  });

  it('★ 审核上界就是权威分段 Boss 满血，不再用无词条构筑探针卡真实满分', () => {
    for (const bracket of TRIAL_BRACKETS) {
      const bossHp = weeklyTrialBoss(TRIAL_SEASON_ID, WEEK, bracket.id).combatant.stats.hp;
      for (const classId of CLASS_IDS) {
        expect(
          trialBracketDamageCeiling(bracket.minLevel, classId, WEEK),
          `${classId} @ ${bracket.id}`,
        ).toBe(bossHp);
      }
    }
  });

  it('上界随等级单调不减 —— 高等级不该比低等级更容易被判违规', () => {
    let prev = 0;
    for (const lv of [13, 30, 45, 60, 81]) {
      const ceiling = trialDamageCeiling(lv, 'catkin', WEEK);
      expect(ceiling).toBeGreaterThanOrEqual(prev);
      prev = ceiling;
    }
  });

  // 遍历 CLASS_IDS 而不是写死四个职业名：新职业上线时这条会自动覆盖它。
  // 写死名字的话，第五职业算不出上界也不会有任何东西变红。
  it('每个职业在同一等级都有非零上界 —— 任一职业算不出上界都会变成系统性误伤', () => {
    for (const c of CLASS_IDS) {
      expect(maxPlausibleTrialDamage(65, c, WEEK), `${c} 的上界为零`).toBeGreaterThan(0);
    }
  });

  /**
   * ⚠ 这条测试原名是「余量与战力上界同值（两条链口径必须一致）」。
   *
   * 那句话在 43ac74d 已被推翻并从 trialBound.ts 的注释里删掉了：本模块全文
   * 不使用 combatPower，两个常量恰好都曾是 1.5 但**理由互不相干**，改
   * COMBAT_POWER_HEADROOM 不该同步到这里。**但当时只改了源码注释，没改这条
   * 测试的标题**，于是那句作废的断言继续以「测试名」的身份流通 —— 2026-08-02
   * 凌晨它真的把人（我）误导了一次：先读到标题、再去比两个常量，得出「不变量
   * 被违反」的错误结论。改名留档，别再让它骗下一个人。
   *
   * 它实际验的只有一件事：上界 = 探针 × 本链自己的余量系数。
   */
  it('诊断上界 = min(构筑探针 × 本链余量, Boss 结构上界)', () => {
    const raw = maxPlausibleTrialDamage(65, 'catkin', WEEK);
    const bossHp = weeklyTrialBoss(
      TRIAL_SEASON_ID,
      WEEK,
      trialBracketFor(65).id,
    ).combatant.stats.hp;
    expect(trialDamageCeiling(65, 'catkin', WEEK)).toBeCloseTo(
      Math.min(raw * TRIAL_DAMAGE_HEADROOM, bossHp),
      5,
    );
  });
});

describe('试炼伤害上界 · 线上真实事故回归（绿玩，2026-07-30）', () => {
  /**
   * 真实数据：档案 Lv13 / 战力 1593，却提交出 1,489,904 伤害。
   * 那个数是 b_crown 分段 Boss 的满血，而 Lv13 属于 b_moon —— 他报的伤害
   * 比自己分段整个 Boss 的血还多 15 倍。这条断言钉住这次绕过不会复现。
   */
  it('Lv13 报出跨分段的 149 万伤害 → 判定为物理不可能', () => {
    expect(isPlausibleTrialDamage(1_489_904, 13, 'catkin', WEEK)).toBe(false);
  });

  it('当前公式的王冠段满血成绩属于真实 Lv81 玩家 → 判定为合法（不能一刀切）', () => {
    const crown = trialBracketFor(81);
    const currentBossHp = weeklyTrialBoss(TRIAL_SEASON_ID, WEEK, crown.id).combatant.stats.hp;
    expect(isPlausibleTrialDamage(currentBossHp, 81, 'swordsman', WEEK)).toBe(true);
  });

  /**
   * 分段 Boss 是按该分段**上沿**标定的，所以分段下沿的玩家打不满它 ——
   * Lv13 的物理极限约 3.9 万，而 b_moon 的 Boss 有 9.7 万血。
   * 这条断言钉住的是「上界必须落在自己分段的量级内」：
   * 无论打不打得死，都不可能摸到另一个分段 149 万的量级。
   */
  it('Lv13 的上界落在自己分段量级内，与跨分段的 149 万差两个数量级', () => {
    const moonBossHp = weeklyTrialBoss(TRIAL_SEASON_ID, WEEK, trialBracketFor(13).id).combatant
      .stats.hp;
    const ceiling = trialDamageCeiling(13, 'catkin', WEEK);
    expect(ceiling).toBeLessThanOrEqual(moonBossHp);
    expect(ceiling).toBeLessThan(1_489_904 / 10);
  });
});

describe('试炼伤害上界 · 非法输入不判为作弊', () => {
  it('非有限数、负数、越界等级一律判不可信而不是构成证据', () => {
    expect(isPlausibleTrialDamage(Number.NaN, 60, 'catkin', WEEK)).toBe(false);
    expect(isPlausibleTrialDamage(-1, 60, 'catkin', WEEK)).toBe(false);
    expect(isPlausibleTrialDamage(100, 0, 'catkin', WEEK)).toBe(false);
    expect(isPlausibleTrialDamage(100, 121, 'catkin', WEEK)).toBe(false);
  });
});

describe('试炼判据 · 会话内升级滞后不得误伤（老板红线）', () => {
  // 背景：档案同步每个会话只跑一次（stores/leaderboard.ts connect() 的提前返回），
  // 提交成绩时不重新同步，于是权威等级恒**偏低**。若拿它本身当标尺，
  // 升级最快的新玩家会被判成超标最狠的作弊者。
  it('★ 段内任何等级滞后都不误伤：段顶满配的真实伤害不超过段底玩家的判定上界', () => {
    for (const bracket of TRIAL_BRACKETS) {
      const topReal = maxPlausibleTrialDamage(bracket.maxLevel, 'catkin', WEEK);
      expect(
        isPlausibleTrialDamage(topReal, bracket.minLevel, 'catkin', WEEK),
        `${bracket.id}：档案停在段底 Lv${bracket.minLevel}、实际已到段顶 Lv${bracket.maxLevel} 时被误判`,
      ).toBe(true);
    }
  });

  it('★ 新手段最狠：Lv1 档案 + Lv10 实力，改前超 1000 倍会被直接公示', () => {
    const bud = TRIAL_BRACKETS[0]!;
    const topReal = maxPlausibleTrialDamage(bud.maxLevel, 'catkin', WEEK);
    // 旧做法（按权威等级本身）会判成作弊，且倍率高到够格公开点名
    const oldBound = trialDamageCeiling(bud.minLevel, 'catkin', WEEK);
    const oldVerdict = judgeCheatEvidence({
      source: 'submit-trial',
      claimField: 'trial_damage',
      claimedValue: topReal,
      boundValue: oldBound,
      boundKind: 'upper',
      priorEvidenceCount: 0,
    });
    expect(oldVerdict.shouldPublish).toBe(true); // ← 这就是当时的红线事故
    // 新做法（按段顶）判为正常
    expect(isPlausibleTrialDamage(topReal, bud.minLevel, 'catkin', WEEK)).toBe(true);
  });

  it('段顶标尺不会把跨分段伪造放过 —— 绿玩那条实例仍然抓得住', () => {
    // 权威 Lv13（分段 b_moon，段顶 Lv23），却报出王冠段满血伤害
    const forged = 1_489_904;
    expect(isPlausibleTrialDamage(forged, 13, 'catkin', WEEK)).toBe(false);
    const bound = trialBracketDamageCeiling(13, 'catkin', WEEK);
    expect(forged / bound).toBeGreaterThan(10); // 仍达「极端倍率单次即可公示」
  });

  it('Boss 血量上界对同段内所有等级是同一个数 —— 整段共用一把尺才谈得上免疫', () => {
    const bracket = trialBracketFor(60);
    const atBottom = trialBracketDamageCeiling(bracket.minLevel, 'catkin', WEEK);
    const atTop = trialBracketDamageCeiling(bracket.maxLevel, 'catkin', WEEK);
    const inMiddle = trialBracketDamageCeiling(
      Math.floor((bracket.minLevel + bracket.maxLevel) / 2),
      'catkin',
      WEEK,
    );
    expect(atBottom).toBe(atTop);
    expect(inMiddle).toBe(atTop);
  });
});

// ───────────────────────────────────────────────────────────────────────────
// 结构上界：合法伤害的物理天花板就是 Boss 初始血量
// ───────────────────────────────────────────────────────────────────────────

/** 该槽位在该等级能穿到的最强定义，按真实基准值排序（与 trialBound 同口径）。 */
function strongestDefFor(slot: (typeof SLOT_ORDER)[number], level: number, classId: ClassId) {
  let best: (typeof EQUIPMENT)[string] | null = null;
  for (const def of Object.values(EQUIPMENT)) {
    if (def.slot !== slot) continue;
    if (def.level > level) continue;
    if (def.classId && def.classId !== classId) continue;
    const better =
      !best || itemBaseValue(def.level, def.quality) > itemBaseValue(best.level, best.quality);
    if (better) best = def;
  }
  return best;
}

/**
 * 把一件合法实例抬到**合法极值**：词条一律 T5 且取 `affixValueRange` 的上沿，
 * 胚子与强化取各自的 MAX。
 *
 * ⚠ 方向别抄错：这里用的是 `EQUIPMENT_BASE_ROLL_MAX`，而 `combatPowerBound`
 * 那侧用的是 MIN。抄错方向会把上界算低，**第一个被判成外挂的就是欧皇**。
 */
function toLegalExtreme(inst: EquipmentInstance, defLevel: number): EquipmentInstance {
  return {
    ...inst,
    baseRollPermille: EQUIPMENT_BASE_ROLL_MAX,
    enhance: ENHANCE_MAX,
    // 固定 ENHANCE_MAX 格（+1～+15 每级一格）；写成 MAX+1 会被 equipment.ts 的
    // assertEnhanceGainArray 当场拦下 —— 让游戏自己校验构造，比自己推规则可靠。
    enhanceGainPermille: Array.from({ length: ENHANCE_MAX }, () => ENHANCE_GAIN_MAX),
    affixes: inst.affixes.map((affix) => ({
      ...affix,
      tier: 5 as (typeof inst.affixes)[number]['tier'],
      value: affixValueRange(affix.key, defLevel, 5).max,
    })),
  };
}

/**
 * 造一套构筑。**结构合法性完全交给游戏自己的 `rollAffixes`**（`createInstance`
 * 内部就是它），不手拼槽位。
 *
 * 手拼是这条线上最贵的一次错误来源：2026-07-31 我用一个允许「同一件装备出两条
 * 同 key」的空间做过一次「穷举」，据此报出越界并建议挡车，协调者真的挡了 ——
 * 而那种组合游戏里根本抽不出来（`equipment.ts` 每抽中一次就把 key splice 出池）。
 * **空间错了的时候，越「全面」的搜索错得越有说服力。**
 */
function legalBuild(classId: ClassId, level: number, seed: number, extreme: boolean) {
  const rng = new Rng(seed);
  const equipped = SLOT_ORDER.map((slot, index) => {
    const def = strongestDefFor(slot, level, classId);
    if (!def) return null;
    const inst = createInstance(def, rng, `bound-${index}`, classId);
    return extreme ? toLegalExtreme(inst, def.level) : inst;
  });
  const build = buildTrialCombatant({ name: '上界不变量', classId, level, equipped });
  return { build, equipped };
}

/**
 * 生存标尺只用真实定义选装的 `expectedGearStatsFromDefinitions`；Boss 血量另用
 * 已上线的解析式输出锚。两者回答不同问题，不得再共用 helper，也不随
 * 测试失败临时放宽。
 */
function referenceBuild(classId: ClassId, level: number): TrialBuild {
  const combatant = trialSurvivalReferenceCombatant(classId, level);
  return {
    combatant,
    skillMultiplier: 1,
    skillKit: buildDefaultPlayerSkillKit(classId, level),
    onHitTriggers: [],
    onLethalTriggers: [],
    onCritTriggers: [],
    combatPower: combatPower(combatant.stats),
    buildHash: `reference-${classId}-${level}`,
  };
}

function weekForBossVariant(
  bracketId: string,
  tiltId: 'shell' | 'mirage' | 'fury',
  element: 'fire' | 'ice' | 'thunder',
): number {
  for (let candidate = 0; candidate < 1024; candidate += 1) {
    const boss = weeklyTrialBoss(TRIAL_SEASON_ID, candidate, bracketId);
    if (boss.tilt.id === tiltId && boss.combatant.element === element) return candidate;
  }
  throw new Error(`${bracketId} 在 1024 周内没有生成 ${tiltId}/${element}`);
}

function weekForGuildBossVariant(
  bracketId: string,
  tiltId: 'shell' | 'mirage' | 'fury',
  element: 'fire' | 'ice' | 'thunder',
): number {
  for (let candidate = 0; candidate < 1024; candidate += 1) {
    const boss = guildExpeditionBoss(TRIAL_SEASON_ID, candidate, bracketId);
    if (boss.tilt.id === tiltId && boss.combatant.element === element) return candidate;
  }
  throw new Error(`${bracketId} 远征在 1024 周内没有生成 ${tiltId}/${element}`);
}

describe('试炼成绩的结构上界 · damage 不可能超过 Boss 初始血量', () => {
  it('★ 配置契约：玩家只锁定 Boss，且 Boss 不得接入技能包或额外血池', () => {
    const { build } = legalBuild('kenshi', 65, 20260802, true);
    const options = trialFightOptions(build);

    expect(options.playerTargetType).toBe('boss');
    expect(Object.hasOwn(options, 'monsterSkillKit')).toBe(false);
    expect(Object.hasOwn(options, 'monsterSkillMultiplier')).toBe(false);
  });

  /**
   * 为什么用一条行为不变量，而不是逐条枚举「无回复 / 无致死复活 / 无额外血池」：
   * 枚举挡不住**还没被想到的**那个向量。2026-08-02 凌晨就现场发生过一次 ——
   * 有人断言「召唤不存在」并用它支撑「拿掉安全余量」，一分钟后就发现召唤作为
   * SkillEffect 是声明了的（只是尚未实现），而且正有人在实现它。
   *
   * 这条断言对所有向量同时成立，包括将来新增的：只要计入成绩的伤害仍然全部
   * 经由 Boss 的血量扣减路径（`combat.ts` 的 `Math.min(剩余血量, 伤害)` 截断），
   * 它就恒真；谁要是另开一个伤害累加器、或给 Boss 加护盾/二阶段/回复，它立刻红。
   */
  it('★ 行为不变量：全职业 × 全段位 × 合法构筑（含合法极值），damage 恒 <= Boss 初始血量', () => {
    const seeds = [1, 20260802];
    const extremes = [false, true];
    let cells = 0;
    let boundaryHits = 0;

    for (const classId of CLASS_IDS) {
      for (const bracket of TRIAL_BRACKETS) {
        for (const seed of seeds) {
          for (const extreme of extremes) {
            cells += 1;
            const level = bracket.maxLevel;
            const { build, equipped } = legalBuild(classId, level, seed, extreme);

            // 「合法」不由这个测试自己定义：过服务端提交时用的同一个校验器。
            for (const inst of equipped) {
              if (!inst) continue;
              expect(
                trialEquipmentSnapshotIssue(inst, classId, level),
                `构造出了非法装备 ${inst.defId}（${classId} Lv${level}，极值=${extreme}）—— ` +
                  `这条红了说明是测试的构造错了，不是产品代码有问题`,
              ).toBeNull();
            }

            const boss = weeklyTrialBoss(TRIAL_SEASON_ID, WEEK, bracket.id).combatant;
            const result = runTrial(
              build,
              boss,
              trialScoreSeed(TRIAL_SEASON_ID, WEEK, bracket.id, build.buildHash),
            );
            // 非空转的第一道保险：光身子打 Boss 也满足「不超过血量」，
            // 那种通过什么都没证明。这里钉死每一格都真的穿满了装备。
            expect(
              equipped.filter(Boolean).length,
              `${classId} @ ${bracket.id} Lv${level} 只穿上了 ${equipped.filter(Boolean).length}/8 件 —— ` +
                `构筑没造出来，这一格的通过是空转`,
            ).toBe(SLOT_ORDER.length);

            if (result.damage === boss.stats.hp) boundaryHits += 1;
            expect(
              result.damage,
              `${classId} @ ${bracket.id} Lv${level}（极值=${extreme}）打出 ${result.damage}，` +
                `超过了 Boss 初始血量 ${boss.stats.hp} —— 结构上界不再成立，` +
                `此时若判据仍按 Boss 血量卡人，被误伤的是把 Boss 打死的真实玩家`,
            ).toBeLessThanOrEqual(boss.stats.hp);
          }
        }
      }
    }

    // 非空转的第二、第三道保险，都是「绿色本身要能自证」：
    // ① 格子数必须等于笛卡尔积 —— 少跑一层循环不会再表现为「安静地通过」；
    // ② 至少有一格真的把 Boss 打死（取到等号）—— 说明这批构筑够强，
    //    确实探到了判据的边界，而不是全程在远离边界的弱构筑里绕。
    expect(cells).toBe(CLASS_IDS.length * TRIAL_BRACKETS.length * seeds.length * extremes.length);
    expect(
      boundaryHits,
      '没有任何一格把 Boss 打死 —— 这批构筑全都够不到上界，' +
        '这条不变量就没有真正检验过边界（判据写成 < 也照样绿）',
    ).toBeGreaterThan(0);
  });

  it('★ 伤害上界：3 倾向 × 3 元素 × 5 段 × 5 职业的合法极值都能打到满血', () => {
    const tiltIds = ['shell', 'mirage', 'fury'] as const;
    const elements = ['fire', 'ice', 'thunder'] as const;
    let cells = 0;

    for (const bracket of TRIAL_BRACKETS) {
      for (const tiltId of tiltIds) {
        for (const element of elements) {
          const week = weekForBossVariant(bracket.id, tiltId, element);
          for (const classId of CLASS_IDS) {
            cells += 1;
            const level = bracket.maxLevel;
            const { build, equipped } = legalBuild(classId, level, 20260802, true);
            expect(equipped.filter(Boolean).length, `${classId} @ ${bracket.id}`).toBe(
              SLOT_ORDER.length,
            );

            const boss = weeklyTrialBoss(TRIAL_SEASON_ID, week, bracket.id).combatant;
            const result = runTrial(
              build,
              boss,
              trialScoreSeed(TRIAL_SEASON_ID, week, bracket.id, build.buildHash),
            );
            expect(
              result.damage,
              `${classId} @ ${bracket.id}/${tiltId}/${element} 只打出 ${result.damage}/${boss.stats.hp}`,
            ).toBe(boss.stats.hp);
          }
        }
      }
    }

    expect(cells).toBe(
      TRIAL_BRACKETS.length * tiltIds.length * elements.length * CLASS_IDS.length,
    );
  }, 15_000);

  it('★ 生存标尺：225 格基准玩家都活满 60 秒，且最险一格必须明显掉血', () => {
    const tiltIds = ['shell', 'mirage', 'fury'] as const;
    const elements = ['fire', 'ice', 'thunder'] as const;
    const deaths: string[] = [];
    let lowestHpRatio = 1;
    let cells = 0;

    for (const bracket of TRIAL_BRACKETS) {
      for (const tiltId of tiltIds) {
        for (const element of elements) {
          const week = weekForBossVariant(bracket.id, tiltId, element);
          for (const classId of CLASS_IDS) {
            cells += 1;
            const level = bracket.bossLevel;
            const build = referenceBuild(classId, level);

            const boss = weeklyTrialBoss(TRIAL_SEASON_ID, week, bracket.id).combatant;
            const result = runTrial(
              build,
              boss,
              trialScoreSeed(TRIAL_SEASON_ID, week, bracket.id, build.buildHash),
            );
            if (!result.survived) {
              deaths.push(
                `${classId} @ ${bracket.id}/${tiltId}/${element} 在 ${result.durationSec.toFixed(1)} 秒阵亡`,
              );
            }
            lowestHpRatio = Math.min(
              lowestHpRatio,
              result.playerHpRemaining / result.playerHpMax,
            );
          }
        }
      }
    }

    expect(cells).toBe(
      TRIAL_BRACKETS.length * tiltIds.length * elements.length * CLASS_IDS.length,
    );
    expect(deaths).toEqual([]);
    expect(lowestHpRatio).toBeLessThan(0.6);
  });

  it('★ 公会远征同源标尺：225 格基准玩家都活满 60 秒，最险格仍有压力', () => {
    const tiltIds = ['shell', 'mirage', 'fury'] as const;
    const elements = ['fire', 'ice', 'thunder'] as const;
    const deaths: string[] = [];
    let lowestHpRatio = 1;
    let cells = 0;

    for (const bracket of TRIAL_BRACKETS) {
      for (const tiltId of tiltIds) {
        for (const element of elements) {
          const week = weekForGuildBossVariant(bracket.id, tiltId, element);
          for (const classId of CLASS_IDS) {
            cells += 1;
            const level = bracket.bossLevel;
            const build = referenceBuild(classId, level);
            const boss = guildExpeditionBoss(TRIAL_SEASON_ID, week, bracket.id).combatant;
            const result = runTrial(
              build,
              boss,
              trialScoreSeed(TRIAL_SEASON_ID, week, bracket.id, build.buildHash),
            );
            if (!result.survived) {
              deaths.push(
                `${classId} @ ${bracket.id}/${tiltId}/${element} 在 ${result.durationSec.toFixed(1)} 秒阵亡`,
              );
            }
            lowestHpRatio = Math.min(
              lowestHpRatio,
              result.playerHpRemaining / result.playerHpMax,
            );
          }
        }
      }
    }

    expect(cells).toBe(
      TRIAL_BRACKETS.length * tiltIds.length * elements.length * CLASS_IDS.length,
    );
    expect(deaths).toEqual([]);
    expect(lowestHpRatio).toBeLessThan(0.6);
  });

  /**
   * 上界必须**可取等**。判据写成严格小于（或取整取错方向）时，
   * 第一个被误判成作弊的恰好是把 Boss 打死的顶尖玩家 —— 误伤面最难看的那种。
   */
  it('★ 边界可取等：把 Boss 打死时 damage 恰好等于其初始血量（判据必须是 <=，不是 <）', () => {
    const bracket = TRIAL_BRACKETS[0]!;
    const { build } = legalBuild('swordsman', TRIAL_BRACKETS[TRIAL_BRACKETS.length - 1]!.maxLevel, 20260802, true);
    const boss = weeklyTrialBoss(TRIAL_SEASON_ID, WEEK, bracket.id).combatant;
    const result = runTrial(
      build,
      boss,
      trialScoreSeed(TRIAL_SEASON_ID, WEEK, bracket.id, build.buildHash),
    );
    expect(result.bossHpRemaining).toBe(0);
    expect(result.damage).toBe(boss.stats.hp);
  });

  /**
   * 定点断言，只为让上面那条红掉时有一句人话可看，本身不承担安全证明。
   *
   * ⚠ 不要在这里加一条「词条越多伤害应该越高」：那会在**量具饱和**的格子里假红 ——
   * 构筑早就把 Boss 打死了，再强也超不过血量，比值恒为 1.000。
   */
  it('Boss 侧没有任何吸血通路（lifesteal = 0）—— 上面那条红了先看这里', () => {
    for (const bracket of TRIAL_BRACKETS) {
      const boss = weeklyTrialBoss(TRIAL_SEASON_ID, WEEK, bracket.id).combatant;
      expect(boss.combatBonuses?.lifesteal ?? 0, `${bracket.id} 的 Boss 带了吸血`).toBe(0);
    }
  });
});
