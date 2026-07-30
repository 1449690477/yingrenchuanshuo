/**
 * 装备副本纯逻辑。
 *
 * 输入当前存档切片、战斗单位、关卡和 RNG 状态，返回完整规划结果；
 * 不读时间、不写 store、不发奖励。store 只在胜利后原子提交返回值。
 */

import type { ClassId, Combatant, LootResult } from './types';
import type { PityCounters } from './loot';
import { Rng } from './rng';
import { rollLoot } from './loot';
import { simulateFight, type SimulatedFightResult } from './combat';
import type {
  OnHitElementalDamageTrigger,
  OnLethalRecoveryTrigger,
} from './equipmentSets';
import { makeMonster } from './progression';
import { mergeLootResults } from './stageLoot';
import { businessDayKey } from './dayKey';
import type { EquipmentDungeonStage } from '@/data/equipmentDungeons';
import { EQUIPMENT_DUNGEON_RULES } from '@/data/equipmentDungeonRules';

export interface EquipmentDungeonClearRecord {
  clears: number;
  firstClearedAt: number;
  bestDurationMs: number;
}

export interface EquipmentDungeonState {
  /** 北京时间 04:00 日切后的业务日期 YYYY-MM-DD。 */
  dayKey: string;
  /** 今天已成功领取奖励的次数。 */
  clearsToday: number;
  totalClears: number;
  records: Record<string, EquipmentDungeonClearRecord>;
}

export interface EquipmentDungeonWaveResult {
  role: 'minion' | 'boss';
  monsterId: string;
  monsterName: string;
  asset: string;
  playerHpBefore: number;
  playerHpAfter: number;
  enemyMaxHp: number;
  result: SimulatedFightResult;
}

export type EquipmentDungeonBlockReason = 'level-locked' | 'previous-tier-locked' | 'daily-limit';

export type EquipmentDungeonChallengeResult =
  | {
      ok: false;
      reason: EquipmentDungeonBlockReason;
      state: EquipmentDungeonState;
    }
  | {
      ok: true;
      win: false;
      state: EquipmentDungeonState;
      pity: PityCounters;
      nextRngState: number;
      waves: EquipmentDungeonWaveResult[];
      durationMs: number;
    }
  | {
      ok: true;
      win: true;
      state: EquipmentDungeonState;
      pity: PityCounters;
      nextRngState: number;
      waves: EquipmentDungeonWaveResult[];
      durationMs: number;
      firstClear: boolean;
      drops: LootResult[];
    };

export interface EquipmentDungeonChallengeInput {
  stage: EquipmentDungeonStage;
  state: EquipmentDungeonState;
  pity: PityCounters;
  player: Combatant;
  classId: ClassId;
  playerSkillMultiplier: number;
  playerOnHitTriggers?: readonly OnHitElementalDamageTrigger[];
  playerOnLethalTriggers?: readonly OnLethalRecoveryTrigger[];
  rngState: number;
  now: number;
}

/**
 * 北京时间 04:00 日切。
 *
 * 口径已收敛到 src/core/dayKey.ts 的 businessDayKey（全游戏共用）；
 * 本函数保留原名与原行为，仅作委托。
 */
export function equipmentDungeonDayKey(now: number): string {
  return businessDayKey(now, EQUIPMENT_DUNGEON_RULES.resetHourCst);
}

export function createEquipmentDungeonState(now: number): EquipmentDungeonState {
  return {
    dayKey: equipmentDungeonDayKey(now),
    clearsToday: 0,
    totalClears: 0,
    records: {},
  };
}

export function refreshEquipmentDungeonDay(
  state: EquipmentDungeonState,
  now: number,
): EquipmentDungeonState {
  const dayKey = equipmentDungeonDayKey(now);
  if (state.dayKey === dayKey) {
    return {
      ...state,
      records: cloneRecords(state.records),
    };
  }
  return {
    ...state,
    dayKey,
    clearsToday: 0,
    records: cloneRecords(state.records),
  };
}

export function equipmentDungeonAttemptsRemaining(
  state: EquipmentDungeonState,
  now: number,
): number {
  const current = refreshEquipmentDungeonDay(state, now);
  return Math.max(0, EQUIPMENT_DUNGEON_RULES.dailyClears - current.clearsToday);
}

export function isEquipmentDungeonStageUnlocked(
  stage: EquipmentDungeonStage,
  state: EquipmentDungeonState,
  playerLevel: number,
): boolean {
  if (playerLevel < stage.unlockLevel) return false;
  return !stage.previousStageId || state.records[stage.previousStageId] !== undefined;
}

export function resolveEquipmentDungeonChallenge(
  input: EquipmentDungeonChallengeInput,
): EquipmentDungeonChallengeResult {
  const state = refreshEquipmentDungeonDay(input.state, input.now);

  if (input.player.level < input.stage.unlockLevel) {
    return { ok: false, reason: 'level-locked', state };
  }
  if (input.stage.previousStageId && !state.records[input.stage.previousStageId]) {
    return { ok: false, reason: 'previous-tier-locked', state };
  }
  /*
   * 首通不占每日次数。
   *
   * 首通是「解锁内容」，日常刷取是「重复获取」，两者不该抢同一份预算。
   * 玩家刚推到新档位却因为今天次数用完而进不去，等于用日常限制
   * 挡住了内容进度 —— 那是惩罚性设计（见 docs/40 红线、docs/47 第四节）。
   */
  const isFirstAttemptOfStage = !state.records[input.stage.id];
  if (!isFirstAttemptOfStage && state.clearsToday >= EQUIPMENT_DUNGEON_RULES.dailyClears) {
    return { ok: false, reason: 'daily-limit', state };
  }

  const challengeRng = new Rng(input.rngState);
  const player: Combatant = {
    ...input.player,
    stats: { ...input.player.stats },
    currentHp: input.player.stats.hp,
  };
  const waves: EquipmentDungeonWaveResult[] = [];

  for (const [index, encounter] of input.stage.encounters.entries()) {
    const monster = makeMonster(encounter.monster);
    const playerHpBefore = player.currentHp;
    const result = simulateFight(player, monster, challengeRng, {
      playerSkillMultiplier: input.playerSkillMultiplier,
      playerOnHitTriggers: input.playerOnHitTriggers,
      playerOnLethalTriggers: input.playerOnLethalTriggers,
      maxSeconds: EQUIPMENT_DUNGEON_RULES.maxFightSeconds,
    });
    waves.push({
      role: encounter.role,
      monsterId: encounter.monster.id,
      monsterName: encounter.monster.name,
      asset: encounter.asset,
      playerHpBefore,
      playerHpAfter: Math.max(0, player.currentHp),
      enemyMaxHp: monster.stats.hp,
      result,
    });

    if (!result.win) {
      // 失败不扣次数，也不推进 RNG / 保底，阻止无成本反复重掷。
      return {
        ok: true,
        win: false,
        state,
        pity: { ...input.pity },
        nextRngState: input.rngState,
        waves,
        durationMs: durationMsOf(waves),
      };
    }

    if (index < input.stage.encounters.length - 1) {
      player.currentHp = Math.min(
        player.stats.hp,
        player.currentHp + player.stats.hp * EQUIPMENT_DUNGEON_RULES.betweenWaveHealRatio,
      );
    }
  }

  const previous = state.records[input.stage.id];
  const firstClear = previous === undefined;
  const pity = { ...input.pity };
  const normalDrops = rollLoot(input.stage.lootTable, challengeRng, pity, input.classId);
  const firstClearDrops = firstClear
    ? Array.from({ length: EQUIPMENT_DUNGEON_RULES.firstClearBonusRolls }, () =>
        rollLoot(input.stage.lootTable, challengeRng, pity, input.classId),
      )
    : [];
  const drops = mergeLootResults(normalDrops, ...firstClearDrops);
  if (drops.length === 0) {
    throw new Error(`[配置错误] 装备副本 ${input.stage.id} 胜利后没有产生装备`);
  }

  const durationMs = durationMsOf(waves);
  const records = cloneRecords(state.records);
  records[input.stage.id] = previous
    ? {
        ...previous,
        clears: previous.clears + 1,
        bestDurationMs: Math.min(previous.bestDurationMs, durationMs),
      }
    : {
        clears: 1,
        firstClearedAt: input.now,
        bestDurationMs: durationMs,
      };

  return {
    ok: true,
    win: true,
    state: {
      ...state,
      // 首通不计次数，理由见上方 isFirstAttemptOfStage 的说明
      clearsToday: state.clearsToday + (firstClear ? 0 : 1),
      totalClears: state.totalClears + 1,
      records,
    },
    pity,
    nextRngState: challengeRng.getState(),
    waves,
    durationMs,
    firstClear,
    drops,
  };
}

function durationMsOf(waves: readonly EquipmentDungeonWaveResult[]): number {
  return Math.round(waves.reduce((sum, wave) => sum + wave.result.duration, 0) * 1000);
}

function cloneRecords(
  records: Readonly<Record<string, EquipmentDungeonClearRecord>>,
): Record<string, EquipmentDungeonClearRecord> {
  return Object.fromEntries(
    Object.entries(records).map(([stageId, record]) => [stageId, { ...record }]),
  );
}
