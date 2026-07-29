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

import type {
  ClassId,
  Combatant,
  CombatBonuses,
  EquipmentInstance,
  Stats,
} from './types';
import { Rng } from './rng';
import { addStats, combatPower } from './formula';
import { estimateDps, simulateFight } from './combat';
import { type OnHitElementalDamageTrigger } from './equipmentSets';
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
  totalEquipCombatBonuses,
  totalEquipStats,
  weaponElementOf,
} from './equipment';
import { applyEquipmentSetStats, resolveEquipmentSetBonuses } from './equipmentSets';
import { getEquipment, requireEquipment } from '@/data/equipment';
import { getEquipmentSet } from '@/data/equipmentSets';
import { expectedFullGearCp, expectedGearStats, typicalQualityAt } from '@/data/expectedPower';
import {
  CRIT_RATE_CAP,
  MONSTER_ACC_BASE,
  MONSTER_ACC_PER_LEVEL,
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
  TRIAL_RESET_HOUR_CST,
  TRIAL_TILTS,
  type TrialBracket,
  type TrialTilt,
} from '@/data/trialRules';

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
  const atk = Math.round(monsterAtk(level, 'boss') * tilt.atkMul);

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

  const quality = typicalQualityAt(level);
  const referenceStats = applyClassMods(
    'swordsman',
    addStats(baseStatsFor('swordsman', level), expectedGearStats(level, quality)),
  );
  const reference = makePlayer('基准玩家', level, referenceStats);
  const referenceDps = estimateDps(reference, proto, averageSkillMultiplier(level));
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
}

export interface TrialBuild {
  combatant: Combatant;
  skillMultiplier: number;
  onHitTriggers: readonly OnHitElementalDamageTrigger[];
  combatPower: number;
  /** 搭配哈希：提交服务端查重与成绩种子的输入之一 */
  buildHash: string;
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
  const setResolution = resolveEquipmentSetBonuses(equipped, getEquipment, getEquipmentSet);
  const combined = applyEquipmentSetStats(addStats(base, equipStats), setResolution);
  combined.critRate = Math.min(CRIT_RATE_CAP, combined.critRate);
  const stats = applyClassMods(input.classId, combined);

  const bonuses = addCombatBonuses(
    totalEquipCombatBonuses(equipped, getEquipment, input.classId),
    setResolution.combatBonuses,
  );
  const weapon = input.equipped[0];
  const element = weapon ? weaponElementOf(requireEquipment(weapon.defId)) : 'none';

  return {
    combatant: makePlayer(input.name, input.level, stats, element, bonuses),
    skillMultiplier: averageSkillMultiplier(input.level) + setResolution.skillMultiplierBonus,
    onHitTriggers: setResolution.onHitTriggers,
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
  /** 是否活满全程；狂怒周可能提前倒下，伤害定格在倒下那一刻 */
  survived: boolean;
  durationSec: number;
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
  const result = simulateFight(player, target, new Rng(seed), {
    maxSeconds: TRIAL_DURATION_SEC,
    playerSkillMultiplier: build.skillMultiplier,
    playerOnHitTriggers: build.onHitTriggers,
  });
  return {
    damage: Math.max(0, Math.round(result.damageDealt)),
    survived: player.currentHp > 0,
    durationSec: result.duration,
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

/**
 * 战力合理性上界（docs/51 §6.3 L3）：
 * 超过「同级满配战力 × 倍率」的成绩标记待审并移出榜单展示，不封号。
 */
export function trialPlausibilityCap(level: number, classId: ClassId): number {
  return expectedFullGearCp(level, classId) * 1.6;
}
