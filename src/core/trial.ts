/**
 * 周常试炼 —— 联机排行榜的核心竞技玩法（docs/51 §3）。
 *
 * 全服每周面对同一个 Boss、同一个随机种子，记录 60 秒总伤害。
 * 本模块全部是纯函数，客户端与 Supabase Edge Function 共用同一份实现：
 * 客户端本地挑战的成绩与服务端复算的成绩逐点一致，伪造伤害在结构上不可能。
 *
 * 设计要点：
 *   - 成绩种子由「赛季 + 周次 + 分段 + 搭配哈希」决定 —— 同一套搭配
 *     永远打出同一个数字，刷次数没有意义，提升只能来自搭配改善
 *   - 试炼不计算好感战斗加成：好感来自玩家与角色的长期相处，
 *     服务端无法验证，纳入会让复算失真（见 buildTrialCombatant 注释）
 *   - 所有随机都来自 src/core/rng.ts（AGENTS.md 铁律 4）
 */

import {
  CLASS_IDS,
  type ClassId,
  type Combatant,
  type CombatBonuses,
  type EquipmentInstance,
  type Stats,
} from './types';
import { Rng } from './rng';
import { addStats, combatPower } from './formula';
import {
  estimateDps,
  estimateIncomingDps,
  simulateFight,
  type CombatTimelineEvent,
  type FightOptions,
} from './combat';
import type { SkillCombatKit } from './skillCombat';
import { buildDefaultPlayerSkillKit, buildPlayerSkillKit } from './playerSkillKit';
import type { DroppedSkillSlot } from './skillSlots';
import type {
  OnCritPeriodicDamageTrigger,
  OnHitElementalDamageTrigger,
  OnLethalRecoveryTrigger,
} from './equipmentSets';
import {
  applyClassMods,
  averageSkillMultiplier,
  baseStatsFor,
  makePlayer,
  monsterAtk,
  monsterDef,
} from './progression';
import {
  addCombatBonuses,
  isVerifiablePersistedAffixValue,
  totalEquipCombatBonuses,
  totalEquipStats,
  weaponElementOf,
} from './equipment';
import { applyEquipmentSetStats, resolveEquipmentSetBonuses } from './equipmentSets';
import { getEquipment, requireEquipment } from '@/data/equipment';
import { getEquipmentSet, getFieldEquipmentSet } from '@/data/equipmentSets';
import {
  expectedGearStats,
  expectedGearStatsFromDefinitions,
  typicalQualityAt,
} from '@/data/expectedPower';
import {
  ELEMENT_BEATS,
  CRIT_RATE_CAP,
  MONSTER_ACC_BASE,
  MONSTER_ACC_PER_LEVEL,
  MONSTER_ATK_BASE,
  MONSTER_BASE_CRIT_DMG,
  MONSTER_CRIT_RATE,
  MONSTER_EVA_PER_LEVEL,
  MONSTER_SPEED,
  SLOT_ORDER,
} from '@/data/constants';
import {
  TRIAL_BOSS_ELEMENTS,
  TRIAL_BOSS_HP_HEADROOM,
  TRIAL_BRACKETS,
  TRIAL_DURATION_SEC,
  TRIAL_MONSTER_ATK_BASE,
  TRIAL_REFERENCE_DAMAGE_FRACTION,
  TRIAL_RESET_HOUR_CST,
  TRIAL_TILTS,
  type TrialBracket,
  type TrialTilt,
} from '@/data/trialRules';
import { expectedReactionDpsShare } from './elementGauge';
import { equipmentAffixGenerationLevels } from '@/data/equipmentAdvancement';

// ─────────────────────────── 哈希 ───────────────────────────

/**
 * FNV-1a 32 位哈希。
 *
 * 跨平台确定（JS 字符串在任何宿主都是 UTF-16 码元序列），
 * 客户端与服务端（Deno）算出的结果逐位一致。
 */
export function fnv1a32(text: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

// ─────────────────────────── 周次 ───────────────────────────

/** 周纪元（ shifted 时间轴）：2026-01-05 是周一，作为第 0 周起点。 */
const TRIAL_WEEK_EPOCH_MS = Date.UTC(2026, 0, 5);
const WEEK_MS = 7 * 24 * 3_600_000;

/**
 * 当前是第几周。周一 04:00（北京时间）切换。
 *
 * 与装备副本日切同款技巧：北京是 UTC+8，把时间先加 (8-4) 小时再按
 * UTC 周界切分，等价于「北京时间减去 4 小时后的自然周」，
 * 且不依赖宿主机时区。
 */
export function trialWeekIndex(now: number): number {
  if (!Number.isFinite(now) || now < 0) {
    throw new Error(`[试炼] now 必须是非负有限时间戳，收到 ${now}`);
  }
  const shifted = now + (8 - TRIAL_RESET_HOUR_CST) * 3_600_000;
  return Math.max(0, Math.floor((shifted - TRIAL_WEEK_EPOCH_MS) / WEEK_MS));
}

/** 第 weekIndex 周的真实开始时刻（毫秒时间戳）。 */
export function trialWeekStartMs(weekIndex: number): number {
  return TRIAL_WEEK_EPOCH_MS + weekIndex * WEEK_MS - (8 - TRIAL_RESET_HOUR_CST) * 3_600_000;
}

/** 距本周结束还剩多少毫秒（用于中性倒计时，不催促）。 */
export function trialWeekRemainingMs(now: number): number {
  return Math.max(0, trialWeekStartMs(trialWeekIndex(now) + 1) - now);
}

// ─────────────────────────── 分段 ───────────────────────────

export function trialBracketFor(level: number): TrialBracket {
  const bracket = TRIAL_BRACKETS.find((b) => level >= b.minLevel && level <= b.maxLevel);
  if (!bracket) {
    throw new Error(`[试炼] 等级 ${level} 不在任何分段内（1~120）`);
  }
  return bracket;
}

export function trialBracketById(bracketId: string): TrialBracket {
  const bracket = TRIAL_BRACKETS.find((b) => b.id === bracketId);
  if (!bracket) throw new Error(`[试炼] 未知分段：${bracketId}`);
  return bracket;
}

// ─────────────────────────── 种子 ───────────────────────────

/** 本周该分段的 Boss 种子：同分段全服完全相同。 */
export function trialBossSeed(seasonId: string, weekIndex: number, bracketId: string): number {
  return fnv1a32(`${seasonId}:boss:${weekIndex}:${bracketId}`);
}

/**
 * 成绩种子：同一套搭配在同一周打出同一个数字。
 * 这是「刷次数无效」的结构保证，也是服务端复算能与客户端一致的依据。
 */
export function trialScoreSeed(
  seasonId: string,
  weekIndex: number,
  bracketId: string,
  buildHash: string,
): number {
  return fnv1a32(`${seasonId}:score:${weekIndex}:${bracketId}:${buildHash}`);
}

// ─────────────────────────── 每周 Boss ───────────────────────────

export interface WeeklyTrialBoss {
  combatant: Combatant;
  tilt: TrialTilt;
  /** 本周 Boss 的完整名字，如「坚壳·霜噬之影」 */
  name: string;
  bracket: TrialBracket;
  weekIndex: number;
}

/**
 * 生存标定专用的真实定义选装玩家。
 *
 * 不能把它拿去标定 Boss 血量：定义选装不含典型强化/词条投入，直接
 * 替换输出锚会让五段 Boss 血量下移约 6%～21%。两个锚回答不同问题，
 * 必须物理分开。
 */
export function trialSurvivalReferenceCombatant(classId: ClassId, level: number): Combatant {
  const stats = applyClassMods(
    classId,
    addStats(baseStatsFor(classId, level), expectedGearStatsFromDefinitions(level)),
  );
  return makePlayer('试炼生存标定玩家', level, stats);
}

/** Boss HP 输出标定专用：严格保留 v1 已上线的典型品质曲线。 */
function trialOutputReferenceCombatant(classId: ClassId, level: number): Combatant {
  const quality = typicalQualityAt(level);
  const stats = applyClassMods(
    classId,
    addStats(baseStatsFor(classId, level), expectedGearStats(level, quality)),
  );
  return makePlayer('试炼输出标定玩家', level, stats);
}

function fixedDurationIncomingRatio(level: number, atk: number): number {
  const attacker: Combatant = {
    name: '固定时长承伤标定靶',
    level,
    element: 'none',
    stats: {
      atk,
      def: 0,
      hp: 1,
      acc: Math.round(MONSTER_ACC_BASE + level * MONSTER_ACC_PER_LEVEL),
      eva: 0,
      critRate: MONSTER_CRIT_RATE.boss,
      critDmg: MONSTER_BASE_CRIT_DMG,
      spd: MONSTER_SPEED.boss,
    },
    currentHp: 1,
  };
  return Math.max(
    ...CLASS_IDS.map((classId) => {
      const reference = trialSurvivalReferenceCombatant(classId, level);
      return (estimateIncomingDps(reference, attacker) * TRIAL_DURATION_SEC) / reference.stats.hp;
    }),
  );
}

/**
 * 固定 60 秒 Boss 的实战攻击。
 *
 * 先从主线攻击曲线退回 4.9 的长战基准，再用最危险的倾向与五职业
 * 基准玩家校准上限。二分只搜索整数攻击，输入相同必然得到相同结果；
 * 较低的 shell/mirage 仍保留与 fury 的明显压力差，不是把三种倾向各自
 * 夹到同一承伤。
 */
export function fixedDurationBossAttack(level: number, tiltAtkMul: number): number {
  const cacheKey = `${level}:${tiltAtkMul}`;
  const cached = fixedDurationAttackCache.get(cacheKey);
  if (cached !== undefined) return cached;
  const rawBase = monsterAtk(level, 'boss') * (TRIAL_MONSTER_ATK_BASE / MONSTER_ATK_BASE);
  const maxTiltMul = Math.max(...TRIAL_TILTS.map((tilt) => tilt.atkMul));
  let low = 0;
  let high = Math.max(0, Math.ceil(rawBase));
  while (low < high) {
    const mid = Math.ceil((low + high) / 2);
    const worstTiltAtk = Math.round(mid * maxTiltMul);
    if (fixedDurationIncomingRatio(level, worstTiltAtk) <= TRIAL_REFERENCE_DAMAGE_FRACTION) {
      low = mid;
    } else {
      high = mid - 1;
    }
  }
  const result = Math.round(Math.min(rawBase, low) * tiltAtkMul);
  fixedDurationAttackCache.set(cacheKey, result);
  return result;
}

// 全部输入都是静态数值配置，透明记忆化不改变函数语义。不做这层时，
// 榜单门禁扫 450 格会反复执行相同的二分与全装表选装，浪费数十秒。
const fixedDurationAttackCache = new Map<string, number>();

/**
 * 生成某周某分段的试炼 Boss。
 *
 * 属性以分段中位等级的怪物公式为基准，再叠加本周词条倾向的倍率；
 * 血量设为「中位等级满配玩家 60 秒期望输出 × 余量」，保证打不完 ——
 * 榜单指标永远是伤害而不是剩余时间（docs/51 §3.5）。
 */
export function weeklyTrialBoss(
  seasonId: string,
  weekIndex: number,
  bracketId: string,
): WeeklyTrialBoss {
  const bracket = trialBracketById(bracketId);
  const rng = new Rng(trialBossSeed(seasonId, weekIndex, bracketId));
  const tilt = rng.pick(TRIAL_TILTS);
  const element = rng.pick(TRIAL_BOSS_ELEMENTS);
  const level = bracket.bossLevel;

  const def = Math.round(monsterDef(level, 'boss') * tilt.defMul);
  const eva = Math.round(level * MONSTER_EVA_PER_LEVEL * tilt.evaMul);
  // 试炼固定打 60 秒，不能继承主线为缩短 TTK 而加上的攻击补偿；否则主线血量
  // 降低后战斗更短、总承伤近似不变，试炼却仍打满 60 秒，补偿会被重复计算。
  // 保留 monsterAtk 的等级/Boss 成长曲线，只把攻击基准归一到试炼自己的标尺。
  const atk = fixedDurationBossAttack(level, tilt.atkMul);

  // 先搭一个缺省血量的原型，用基准玩家期望 DPS 反推真正血量
  const protoStats: Stats = {
    atk,
    def,
    hp: 1,
    acc: Math.round(MONSTER_ACC_BASE + level * MONSTER_ACC_PER_LEVEL),
    eva,
    critRate: MONSTER_CRIT_RATE.boss,
    critDmg: MONSTER_BASE_CRIT_DMG,
    spd: MONSTER_SPEED.boss,
  };
  const proto: Combatant = {
    name: tilt.names[element],
    level,
    element,
    stats: protoStats,
    currentHp: 1,
    ...(tilt.damageReductionPoints > 0
      ? { combatBonuses: bossCombatBonuses(tilt.damageReductionPoints) }
      : {}),
  };

  const reference = trialOutputReferenceCombatant('swordsman', level);
  // 技能轮转会按目标剩余生命截断过量伤害。若直接拿 hp=1 的原型标定，
  // 每次命中最多只记 1 点伤害，最终会把周常 Boss 的血量反推到几百点。
  // 标定阶段使用不会在 60 秒内死亡的同属性目标，最终再把算出的血量写回真实 Boss。
  const calibrationHp = Number.MAX_SAFE_INTEGER;
  const calibrationTarget: Combatant = {
    ...proto,
    // 血量尺量的是玩家完整 60 秒 DPS，不是“被 Boss 打死前打了多少”。
    // 只把目标 hp 改成无穷大仍会让它反击并提前终止估算，导致调低承伤
    // 时 Boss 血量跟着变化。标定靶必须同时关闭攻击，把输出尺与生存尺物理隔离。
    stats: { ...protoStats, atk: 0, critRate: 0, hp: calibrationHp },
    currentHp: calibrationHp,
  };
  const referenceDps = estimateDps(
    reference,
    calibrationTarget,
    1,
    [],
    buildDefaultPlayerSkillKit('swordsman', level),
    'boss',
  );
  const hp = Math.max(1, Math.ceil(referenceDps * TRIAL_DURATION_SEC * TRIAL_BOSS_HP_HEADROOM));

  return {
    combatant: { ...proto, stats: { ...protoStats, hp }, currentHp: hp },
    tilt,
    name: tilt.names[element],
    bracket,
    weekIndex,
  };
}

function bossCombatBonuses(damageReductionPoints: number): CombatBonuses {
  return {
    damageReduction: damageReductionPoints,
    lifesteal: 0,
    elementDamage: { fire: 0, ice: 0, thunder: 0 },
  };
}

// ─────────────────────────── 搭配构建 ───────────────────────────

export interface TrialBuildInput {
  name: string;
  classId: ClassId;
  level: number;
  /** 8 槽位穿戴实例，顺序必须与 SLOT_ORDER 一致；未穿戴为 null */
  equipped: readonly (EquipmentInstance | null)[];
  /**
   * 竞技场对决构建置 true：圣痕套效果只在竞技场内生效（docs/53 §六），
   * 此时用全量套装查询；缺省 false 走 PvE 空效果查询（试炼/挂机一致）。
   */
  arena?: boolean;
  /**
   * 玩家选定的主动技能栏（M3-5）。
   *
   * `undefined` = 尚未做过选择 ⇒ 回落职业默认顺序，与技能栏 UI 上线前**逐字一致**；
   * `[]` = 玩家明确清空了栏位。合法性判定统一走 `skillSlots.resolveActiveSkillSlots`，
   * 客户端与服务端因此不可能选出不同的技能。
   *
   * ⚠ **它不影响 `combatPower`**：战力只由 stats 算出（见下方构建顺序），
   * 技能包不回流进 stats。所以技能栏上线不改变 CP 口径、不需要升版本戳。
   */
  selectedActiveSkillIds?: readonly string[] | null;
  /** 玩家已持久化的技能等级；缺失项按 1 级，服务端与客户端必须同源。 */
  skillLevels?: Readonly<Record<string, number>>;
}

export interface TrialBuild {
  combatant: Combatant;
  skillMultiplier: number;
  /** M3-4 真实技能栏；服务端与客户端必须由同一职业 / 等级重建。 */
  skillKit: SkillCombatKit;
  /**
   * 玩家上报的技能栏里被丢弃的项与原因（M3-5）。
   *
   * **服务端应当在非空时留痕**：丢弃有两个来源、结果一模一样 ——
   * 玩家伪造，和技能表改名/删除导致存档里的旧 id 失效。
   * 不记录就永远分不清「有人在试探」和「我们自己改数据把玩家的存档改坏了」。
   */
  droppedSkillSlots: readonly DroppedSkillSlot[];
  onHitTriggers: readonly OnHitElementalDamageTrigger[];
  onLethalTriggers: readonly OnLethalRecoveryTrigger[];
  onCritTriggers: readonly OnCritPeriodicDamageTrigger[];
  combatPower: number;
  /** 搭配哈希：提交服务端查重与成绩种子的输入之一 */
  buildHash: string;
}

export type TrialEquipmentSnapshotIssue =
  'unknown-equipment' | 'equipment-level' | 'equipment-class' | 'affix-value';

/**
 * 服务端对单件试炼装备做可证明的合法性检查。
 *
 * 客户端存档不是服务端权威数据，因此服务端无法判断一件“结构完全合法”的
 * 装备是否真的掉落过；它能可靠判断的只有定义、穿戴等级、职业归属与词条
 * 是否可能由当前公式产生。这里不使用“同级平均战力 × 经验倍率”之类启发式
 * 上限，因为强化、洗练和套装本来就允许真实玩家大幅超过平均值。
 */
export function trialEquipmentSnapshotIssue(
  instance: EquipmentInstance,
  classId: ClassId,
  playerLevel: number,
): TrialEquipmentSnapshotIssue | null {
  const definition = getEquipment(instance.defId);
  if (!definition) return 'unknown-equipment';
  if (definition.level > playerLevel) return 'equipment-level';
  if (definition.classId && definition.classId !== classId) return 'equipment-class';

  const possibleGenerationLevels = equipmentAffixGenerationLevels(definition);
  for (const affix of instance.affixes) {
    if (
      !possibleGenerationLevels.some((level) =>
        isVerifiablePersistedAffixValue(affix.key, level, affix.tier, affix.value),
      )
    ) {
      return 'affix-value';
    }
  }
  return null;
}

export type TrialScoreWriteAction = 'insert' | 'replace' | 'reverify' | 'keep';

export interface ExistingTrialScore {
  damage: number;
  verified: boolean;
}

export interface TrialScoreWriteDecision {
  action: TrialScoreWriteAction;
  bestDamage: number;
  bestVerified: boolean;
  improved: boolean;
}

/**
 * 决定本次服务端复算结果如何写回“每周最好成绩”。
 *
 * 特别处理 `reverify`：旧版错误的经验战力上限可能把真实成绩存成
 * verified=false。玩家用同一搭配重提、服务端得到完全相同的伤害后，应当
 * 原地恢复审核状态；较低的新成绩绝不能借此洗白较高的旧成绩。
 */
export function decideTrialScoreWrite(
  existing: ExistingTrialScore | null,
  candidateDamage: number,
  candidateVerified: boolean,
): TrialScoreWriteDecision {
  if (!Number.isSafeInteger(candidateDamage) || candidateDamage < 0) {
    throw new Error(`[试炼] 候选伤害必须是非负安全整数，收到 ${candidateDamage}`);
  }
  if (!existing) {
    return {
      action: 'insert',
      bestDamage: candidateDamage,
      bestVerified: candidateVerified,
      improved: true,
    };
  }
  if (!Number.isSafeInteger(existing.damage) || existing.damage < 0) {
    throw new Error(`[试炼] 已有伤害必须是非负安全整数，收到 ${existing.damage}`);
  }
  if (candidateDamage > existing.damage) {
    return {
      action: 'replace',
      bestDamage: candidateDamage,
      bestVerified: candidateVerified,
      improved: true,
    };
  }
  if (candidateDamage === existing.damage && candidateVerified && !existing.verified) {
    return {
      action: 'reverify',
      bestDamage: existing.damage,
      bestVerified: true,
      improved: false,
    };
  }
  return {
    action: 'keep',
    bestDamage: existing.damage,
    bestVerified: existing.verified,
    improved: false,
  };
}

/**
 * 由「职业 + 等级 + 一身装备」构建试炼战斗单位。
 *
 * 与挂机战力的构建管线严格同序（裸属性 → 装备 → 套装 → 暴击上限 →
 * 职业系数），唯一区别是**不叠加好感战斗加成**：好感进度存在客户端，
 * 服务端无法验证；为了让同一份代码在服务端复算出逐点一致的结果，
 * 试炼规定好感加成不生效。这也是试炼比的是「搭得好」的一部分。
 */
export function buildTrialCombatant(input: TrialBuildInput): TrialBuild {
  if (input.equipped.length !== SLOT_ORDER.length) {
    throw new Error(`[试炼] equipped 必须有 ${SLOT_ORDER.length} 个槽位`);
  }
  // 装备聚合函数要求可变数组签名；这里只读入参，先拷贝一份再交给它们
  const equipped = [...input.equipped];
  const base = baseStatsFor(input.classId, input.level);
  const equipStats = totalEquipStats(equipped, getEquipment, input.classId);
  const setResolution = resolveEquipmentSetBonuses(
    equipped,
    getEquipment,
    // 圣痕套只在竞技场内生效（docs/53 §六）：对决构建用全量查询，试炼走空效果查询
    input.arena ? getEquipmentSet : getFieldEquipmentSet,
  );
  const combined = applyEquipmentSetStats(addStats(base, equipStats), setResolution);
  combined.critRate = Math.min(CRIT_RATE_CAP, combined.critRate);
  const stats = applyClassMods(input.classId, combined);

  const bonuses = addCombatBonuses(
    totalEquipCombatBonuses(equipped, getEquipment, input.classId),
    setResolution.combatBonuses,
  );
  const weapon = input.equipped[0];
  const element = weapon ? weaponElementOf(requireEquipment(weapon.defId)) : 'none';
  const { kit: skillKit, dropped: droppedSkillSlots } = buildPlayerSkillKit(
    input.classId,
    input.level,
    {
      skillDamageBonusRatio: setResolution.skillMultiplierBonus,
      selectedActiveSkillIds: input.selectedActiveSkillIds,
      skillLevels: input.skillLevels,
    },
  );

  return {
    combatant: makePlayer(input.name, input.level, stats, element, bonuses),
    skillMultiplier: averageSkillMultiplier(input.level) + setResolution.skillMultiplierBonus,
    skillKit,
    droppedSkillSlots,
    onHitTriggers: setResolution.onHitTriggers,
    onLethalTriggers: setResolution.onLethalTriggers,
    onCritTriggers: setResolution.onCritTriggers,
    combatPower: combatPower(stats),
    buildHash: canonicalBuildHash(input.equipped),
  };
}

/**
 * 搭配的规范化哈希。
 *
 * 只统计影响战斗的字段：uid、锁定状态、幸运值、待采用洗练候选都不影响
 * 属性，不参与哈希 —— 同一身「战斗等价」的装备应得到同一个成绩种子。
 */
export function canonicalBuildHash(equipped: readonly (EquipmentInstance | null)[]): string {
  const body = equipped
    .map((inst, index) => (inst ? `${SLOT_ORDER[index]}=${canonicalInstance(inst)}` : ''))
    .join(';');
  return fnv1a32(body).toString(16).padStart(8, '0');
}

function canonicalInstance(inst: EquipmentInstance): string {
  const affixes = inst.affixes
    .map((a) => `${a.key}:${a.value}:${a.element ?? ''}:${a.tier}`)
    .join('|');
  return [
    inst.defId,
    inst.enhance,
    inst.baseRollPermille,
    inst.enhanceGainPermille.join(','),
    affixes,
    inst.reforgeResonance,
  ].join('#');
}

// ─────────────────────────── 试炼模拟 ───────────────────────────

export interface TrialRunResult {
  /** 60 秒内造成的总伤害（即试炼成绩） */
  damage: number;
  /** 60 秒内承受的总伤害；只供战斗回放与结果说明使用。 */
  damageTaken: number;
  /** 是否活满全程；狂怒周可能提前倒下，伤害定格在倒下那一刻 */
  survived: boolean;
  durationSec: number;
  /** 同一次确定性模拟产生的真实逐击事件，表现层只能消费、不得反写成绩。 */
  timeline: readonly CombatTimelineEvent[];
  playerHpRemaining: number;
  playerHpMax: number;
  bossHpRemaining: number;
  bossHpMax: number;
}

/**
 * 试炼结构上界成立的配置契约。
 *
 * 当前成绩只累计玩家对 Boss 的伤害，因此必须始终锁定 Boss 目标，并且不能给
 * Boss 注入技能包（怪物召唤会引入额外血池）。若以后要给试炼 Boss 加技能，
 * 需要先重审反作弊上界，不能在这里悄悄接入。
 *
 * docs/83 批 3b：当玩家武器与 Boss 都带元素时，按稳态期望把元素共鸣 DPS
 * 折入玩家直接伤害乘区（playerDamageMultiplier = 1 + share）。该乘区仍经
 * Boss 血量扣减路径计入成绩，不新增计分通道，因此上界不变量保持成立；
 * 乘区只随「武器元素 × 周 Boss 元素」组合变化，同一周全服同一 Boss，
 * 客户端与服务端用同一份实现，复算逐点一致。
 */
export function trialFightOptions(build: TrialBuild, boss: Combatant): FightOptions {
  const playerElement = build.combatant.element;
  const monsterElement = boss.element;
  let playerDamageMultiplier = 1;
  if (playerElement !== 'none' && monsterElement !== 'none') {
    const isCounter = ELEMENT_BEATS[playerElement] === monsterElement;
    const share = expectedReactionDpsShare(build.combatant.stats.spd, isCounter);
    playerDamageMultiplier = 1 + share;
  }
  return {
    maxSeconds: TRIAL_DURATION_SEC,
    playerSkillKit: build.skillKit,
    playerTargetType: 'boss',
    playerOnHitTriggers: build.onHitTriggers,
    playerOnLethalTriggers: build.onLethalTriggers,
    playerOnCritTriggers: build.onCritTriggers,
    playerDamageMultiplier,
  };
}

/**
 * 跑一次试炼。纯函数：同一 build、同一 Boss、同一种子必然得到同一结果。
 * 不会修改入参（内部先拷贝，simulateFight 会改写 currentHp）。
 */
export function runTrial(build: TrialBuild, boss: Combatant, seed: number): TrialRunResult {
  const player: Combatant = {
    ...build.combatant,
    stats: { ...build.combatant.stats },
    currentHp: build.combatant.stats.hp,
  };
  const target: Combatant = { ...boss, stats: { ...boss.stats }, currentHp: boss.stats.hp };
  const result = simulateFight(player, target, new Rng(seed), trialFightOptions(build, boss));
  return {
    damage: Math.max(0, Math.round(result.damageDealt)),
    damageTaken: Math.max(0, Math.round(result.damageTaken)),
    survived: player.currentHp > 0,
    durationSec: result.duration,
    timeline: result.events,
    playerHpRemaining: player.currentHp,
    playerHpMax: result.playerMaxHp,
    bossHpRemaining: target.currentHp,
    bossHpMax: result.monsterMaxHp,
  };
}

// ─────────────────────────── 榜单展示辅助 ───────────────────────────

/**
 * 百分位段位，如「上位 12%」。
 *
 * docs/51 §5.2：对榜单中后段只展示百分位，不展示「第 3271 名」这种
 * 噪音名次；前 100 名内才显示精确名次。
 */
export function upperPercentText(rank: number, total: number): string {
  if (total <= 0 || rank <= 0) return '—';
  const pct = Math.max(1, Math.ceil((Math.min(rank, total) / total) * 100));
  return `上位 ${pct}%`;
}
