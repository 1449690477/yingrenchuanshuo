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
import type { SkillCombatKit } from './skillCombat';
import type {
  OnCritPeriodicDamageTrigger,
  OnHitElementalDamageTrigger,
  OnLethalRecoveryTrigger,
} from './equipmentSets';
import { makeMonster } from './progression';
import {
  advanceDepth,
  blankDefinitionId,
  clearedDepthOf,
  depthAnchorLevel,
  depthBlankChance,
  depthScaledMonster,
  isDepthOpen,
  type EquipmentDungeonDepthProgress,
} from './equipmentDungeonDepth';
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
  /**
   * 通关记录，key 为 `${stageId}_d${depth}`（docs/66 §五）。
   *
   * 深度进 key 而不是另起一张表：秘境榜读的就是这里，
   * 两处实现分叉过一次（docs/61 §2.2），不再制造第二个真相源。
   */
  records: Record<string, EquipmentDungeonClearRecord>;
  /**
   * 各档已通过的最高深度（docs/66）。**只升不降** —— docs/40 红线。
   *
   * 它取代 `unlockLevel` 作为玩法门槛：等级可以挂机堆，深度必须真的打赢过。
   */
  depth: EquipmentDungeonDepthProgress;
}

/** 通关记录的 key：深度进 key，同档不同深度各有自己的最佳用时。 */
export function equipmentDungeonRecordKey(stageId: string, depth: number): string {
  return `${stageId}_d${depth}`;
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

export type EquipmentDungeonBlockReason =
  | 'depth-not-opened'
  | 'previous-depth-locked'
  | 'daily-limit'
  /**
   * @deprecated 深度改造后**不再产生**这两个原因，仅为迁移期保留在联合类型里。
   *
   * `DungeonView.vue` 还在按它们分支写文案，而那个文件在 kimi-boards 名下 ——
   * 从联合类型里删掉会让他的文件编译失败。深度面板上线后由他删分支，我再删这两项。
   */
  | 'level-locked'
  | 'previous-tier-locked';

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
  /** 挑战的深度层（1..DEPTH_PER_TIER）。取代旧的等级门槛。 */
  depth: number;
  /** 内容顶等级，胚子锚点的第三个约束。由调用方从 ALL_CHAPTERS 推导。 */
  contentTopLevel: number;
  state: EquipmentDungeonState;
  pity: PityCounters;
  player: Combatant;
  classId: ClassId;
  /** 旧调用兼容：没有真实技能栏时才允许传平均技能倍率。 */
  playerSkillMultiplier?: number;
  playerSkillKit?: SkillCombatKit;
  playerOnHitTriggers?: readonly OnHitElementalDamageTrigger[];
  playerOnLethalTriggers?: readonly OnLethalRecoveryTrigger[];
  playerOnCritTriggers?: readonly OnCritPeriodicDamageTrigger[];
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
    depth: {},
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
      depth: { ...state.depth },
    };
  }
  // 日切只重置次数。**深度只升不降**（docs/40 红线：进度条不许倒退）。
  return {
    ...state,
    dayKey,
    clearsToday: 0,
    records: cloneRecords(state.records),
    depth: { ...state.depth },
  };
}

export function equipmentDungeonAttemptsRemaining(
  state: EquipmentDungeonState,
  now: number,
): number {
  const current = refreshEquipmentDungeonDay(state, now);
  return Math.max(0, EQUIPMENT_DUNGEON_RULES.dailyClears - current.clearsToday);
}

/**
 * 某一层是否可以挑战 —— **不看等级，只看深度链**（docs/66 §2.1）。
 *
 * 删掉 `unlockLevel` 的理由：战斗本身已经是门禁，而且是个好门禁
 * （失败不扣次数、不推进 RNG、不动保底）。等级门槛是叠在一个已经生效的
 * 门禁上的第二道门，而它挡住的恰好是「我练强了，我想试试更深的」——
 * 这是整个系统里唯一的正反馈。
 */
/**
 * @deprecated 迁移期兼容垫片，**不要在新代码里用**。
 *
 * `DungeonView.vue` 目前仍是「选档位」的旧界面（深度面板在
 * `dungeonDepthActivation` 开关后面，由 kimi-boards 负责），
 * 而那个文件在他名下 —— 我不能改别人占用的文件，所以留这个垫片保住编译。
 *
 * 语义：深度 UI 未激活期间，界面表现与改造前一致（仍按等级门槛显示）。
 * 深度面板上线后由 kimi-boards 改调 `isEquipmentDungeonDepthUnlocked`，
 * 届时删除本函数。
 */
export function isEquipmentDungeonStageUnlocked(
  stage: EquipmentDungeonStage,
  state: EquipmentDungeonState,
  playerLevel: number,
): boolean {
  return playerLevel >= stage.unlockLevel && isEquipmentDungeonDepthUnlocked(stage, state, 1);
}

export function isEquipmentDungeonDepthUnlocked(
  stage: EquipmentDungeonStage,
  state: EquipmentDungeonState,
  depth: number,
): boolean {
  if (!isDepthOpen(stage.tierId, depth)) return false;
  return depth <= clearedDepthOf(state.depth, stage.tierId) + 1;
}

export function resolveEquipmentDungeonChallenge(
  input: EquipmentDungeonChallengeInput,
): EquipmentDungeonChallengeResult {
  const hasSkillKit = input.playerSkillKit !== undefined;
  const hasLegacyMultiplier = input.playerSkillMultiplier !== undefined;
  if (hasSkillKit === hasLegacyMultiplier) {
    throw new Error('[装备副本] 真实技能栏与旧平均技能倍率必须且只能提供一种');
  }
  const state = refreshEquipmentDungeonDay(input.state, input.now);

  if (!isDepthOpen(input.stage.tierId, input.depth)) {
    return { ok: false, reason: 'depth-not-opened', state };
  }
  // 深度链取代等级门槛：只能挑战「已通过的最高深度 + 1」及以下。
  if (input.depth > clearedDepthOf(state.depth, input.stage.tierId) + 1) {
    return { ok: false, reason: 'previous-depth-locked', state };
  }
  /*
   * 首通不占每日次数。
   *
   * 每日次数对所有胜利一视同仁，首通不豁免（2026-07-30 回滚 docs/47 §4.1）。
   *
   * 首通免次数是旧节奏下的补救：当时玩家 3 天升 50 级，副本装备到手即
   * 过时，免次数只是让过时奖励别再欠着。docs/56 节奏重排后档位与进度
   * 完全同步，8 部位 × 首通免费 × 双掉落 = 解锁日白拿 16 件当期最强
   * 装备，瞬间毕业 —— 主线掉落、装备挑选、洗练动机全被击穿。
   * 改为计次后 8 部位 ÷ 每日 3 次 ≈ 3 天凑齐一套，恰好是「几天养成
   * 目标」的节奏。首通双掉落保留；失败仍不扣次数（试错不受罚）。
   */
  if (state.clearsToday >= EQUIPMENT_DUNGEON_RULES.dailyClears) {
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
    const monster = makeMonster(
      depthScaledMonster(encounter.monster, input.stage.tierId, input.depth),
    );
    const playerHpBefore = player.currentHp;
    const result = simulateFight(player, monster, challengeRng, {
      ...(input.playerSkillKit
        ? { playerSkillKit: input.playerSkillKit }
        : { playerSkillMultiplier: input.playerSkillMultiplier! }),
      playerTargetType: encounter.monster.type,
      playerOnHitTriggers: input.playerOnHitTriggers,
      playerOnLethalTriggers: input.playerOnLethalTriggers,
      playerOnCritTriggers: input.playerOnCritTriggers,
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

  const recordKey = equipmentDungeonRecordKey(input.stage.id, input.depth);
  const previous = state.records[recordKey];
  const firstClear = previous === undefined;
  const pity = { ...input.pity };
  const normalDrops = rollLoot(input.stage.lootTable, challengeRng, pity, input.classId);
  const firstClearDrops = firstClear
    ? Array.from({ length: EQUIPMENT_DUNGEON_RULES.firstClearBonusRolls }, () =>
        rollLoot(input.stage.lootTable, challengeRng, pity, input.classId),
      )
    : [];

  /*
   * 深度的第二条奖励轴：胚子（docs/66 §4.2）。
   *
   * **首次突破该深度必掉 1 件** —— peak-end 法则，让「往更深走」这个决策
   * 立刻有可见回报；该深度稳定后转为 DEPTH_BLANK_CHANCE 的低概率掉落。
   *
   * 胚子**不加烙印晶产量**：docs/58 §七 的「2/4/6 件到手日」门禁建在
   * 每次 2~3 晶上，深度加晶产会把套装从养成线压回解锁日毕业。
   */
  const isFirstBreak = input.depth > clearedDepthOf(state.depth, input.stage.tierId);
  const blankRoll = challengeRng.next();
  const blankDrops: LootResult[] =
    isFirstBreak || blankRoll < depthBlankChance(input.depth)
      ? [
          {
            itemId: blankDefinitionId(
              input.stage.slot,
              depthAnchorLevel(
                input.stage.tierId,
                input.depth,
                input.player.level,
                input.contentTopLevel,
              ),
            ),
            count: 1,
          },
        ]
      : [];

  const drops = mergeLootResults(normalDrops, ...firstClearDrops, ...(blankDrops.length ? [blankDrops] : []));
  if (drops.length === 0) {
    throw new Error(`[配置错误] 装备副本 ${input.stage.id} 胜利后没有产生任何掉落`);
  }

  const durationMs = durationMsOf(waves);
  const records = cloneRecords(state.records);
  records[recordKey] = previous
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
      // 所有胜利计次，首通不豁免（见上方 daily-limit 说明）；失败不计
      clearsToday: state.clearsToday + 1,
      totalClears: state.totalClears + 1,
      records,
      // 只升不降：advanceDepth 内部取 max，重复通关或打更浅的层都不会回退
      depth: advanceDepth(state.depth, input.stage.tierId, input.depth),
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
