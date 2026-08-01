/** 异步公会远征纯函数：客户端与 Edge Function 共用，零网络、零副作用。 */

import type { Combatant, Stats } from './types';
import { Rng } from './rng';
import { addStats } from './formula';
import { estimateDps } from './combat';
import {
  applyClassMods,
  baseStatsFor,
  makePlayer,
  monsterAtk,
  monsterDef,
} from './progression';
import { fnv1a32, trialBracketById, trialWeekIndex, type WeeklyTrialBoss } from './trial';
import { expectedGearStats, typicalQualityAt } from '@/data/expectedPower';
import {
  MONSTER_ACC_BASE,
  MONSTER_ACC_PER_LEVEL,
  MONSTER_BASE_CRIT_DMG,
  MONSTER_CRIT_RATE,
  MONSTER_EVA_PER_LEVEL,
  MONSTER_SPEED,
} from '@/data/constants';
import {
  TRIAL_BOSS_ELEMENTS,
  TRIAL_BOSS_HP_HEADROOM,
  TRIAL_DURATION_SEC,
  TRIAL_TILTS,
} from '@/data/trialRules';
import {
  GUILD_CONTRIBUTION_MAX,
  GUILD_DISPLAY_STAGES,
  GUILD_RESET_HOUR_CST,
  GUILD_TARGET_DAMAGE_FRACTION,
  GUILD_WEEKLY_TARGET_PER_MEMBER,
  type GuildDisplayStage,
} from '@/data/guildRules';
import { buildDefaultPlayerSkillKit } from './playerSkillKit';

const HOUR_MS = 3_600_000;

export function guildDayKey(now: number): string {
  if (!Number.isFinite(now) || now < 0) {
    throw new Error(`[公会] now 必须是非负有限时间戳，收到 ${now}`);
  }
  return new Date(now + (8 - GUILD_RESET_HOUR_CST) * HOUR_MS).toISOString().slice(0, 10);
}

export function guildWeekKey(seasonId: string, now: number): string {
  if (!seasonId.trim()) throw new Error('[公会] seasonId 不能为空');
  return `${seasonId}:w${trialWeekIndex(now)}`;
}

export function guildBossThemeSeed(seasonId: string, weekIndex: number): number {
  return fnv1a32(`${seasonId}:guild-boss:${weekIndex}`);
}

export function guildRunSeed(
  seasonId: string,
  weekIndex: number,
  userId: string,
  dayKey: string,
  submissionIndex: number,
  buildHash: string,
): number {
  if (!Number.isInteger(submissionIndex) || submissionIndex < 1) {
    throw new Error(`[公会] submissionIndex 必须是正整数，收到 ${submissionIndex}`);
  }
  return fnv1a32(
    `${seasonId}:guild-run:${weekIndex}:${userId}:${dayKey}:${submissionIndex}:${buildHash}`,
  );
}

/** 主题由全公会共享，属性和血量按成员等级分段缩放。 */
export function guildExpeditionBoss(
  seasonId: string,
  weekIndex: number,
  bracketId: string,
): WeeklyTrialBoss {
  const bracket = trialBracketById(bracketId);
  const rng = new Rng(guildBossThemeSeed(seasonId, weekIndex));
  const tilt = rng.pick(TRIAL_TILTS);
  const element = rng.pick(TRIAL_BOSS_ELEMENTS);
  const level = bracket.bossLevel;
  const def = Math.round(monsterDef(level, 'boss') * tilt.defMul);
  const eva = Math.round(level * MONSTER_EVA_PER_LEVEL * tilt.evaMul);
  const atk = Math.round(monsterAtk(level, 'boss') * tilt.atkMul);
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
      ? {
          combatBonuses: {
            damageReduction: tilt.damageReductionPoints,
            lifesteal: 0,
            elementDamage: { fire: 0, ice: 0, thunder: 0 },
          },
        }
      : {}),
  };
  const quality = typicalQualityAt(level);
  const referenceStats = applyClassMods(
    'swordsman',
    addStats(baseStatsFor('swordsman', level), expectedGearStats(level, quality)),
  );
  const reference = makePlayer('公会基准成员', level, referenceStats);
  // 真实技能轮转会把伤害截断到目标剩余生命；hp=1 原型会把每次命中都压成 1 点，
  // 导致远征 Boss 反推血量严重偏低。标定时使用同属性的不死目标，再写回正式血量。
  const calibrationHp = Number.MAX_SAFE_INTEGER;
  const calibrationTarget: Combatant = {
    ...proto,
    stats: { ...protoStats, hp: calibrationHp },
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

export function guildContributionPoints(damage: number, bossMaxHp: number): number {
  if (!Number.isFinite(damage) || damage < 0) {
    throw new Error(`[公会] damage 必须是非负有限数，收到 ${damage}`);
  }
  if (!Number.isFinite(bossMaxHp) || bossMaxHp <= 0) {
    throw new Error(`[公会] bossMaxHp 必须是正有限数，收到 ${bossMaxHp}`);
  }
  const normalized = (damage / bossMaxHp / GUILD_TARGET_DAMAGE_FRACTION) * GUILD_CONTRIBUTION_MAX;
  return Math.min(GUILD_CONTRIBUTION_MAX, Math.max(0, Math.round(normalized)));
}

export function guildWeeklyTarget(memberCount: number): number {
  if (!Number.isInteger(memberCount) || memberCount < 0) {
    throw new Error(`[公会] memberCount 必须是非负整数，收到 ${memberCount}`);
  }
  return Math.max(1, memberCount) * GUILD_WEEKLY_TARGET_PER_MEMBER;
}

export function guildDisplayStage(reputation: number): GuildDisplayStage {
  if (!Number.isSafeInteger(reputation) || reputation < 0) {
    throw new Error(`[公会] reputation 必须是非负安全整数，收到 ${reputation}`);
  }
  let stage = GUILD_DISPLAY_STAGES[0];
  for (const candidate of GUILD_DISPLAY_STAGES) {
    if (reputation >= candidate.minReputation) stage = candidate;
  }
  return stage;
}
