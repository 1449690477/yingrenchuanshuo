/**
 * 游戏主 store —— 唯一持有存档的地方。
 *
 * 设计原则：
 *   - 所有游戏逻辑调用 core/ 的纯函数，store 只负责「拿存档 → 调 core → 写回存档」
 *   - 挂机推进用 requestAnimationFrame 计算「距上次 tick 过了多久」，
 *     而不是假设 tick 间隔固定 —— 手机切后台会节流，固定间隔会算错
 */

import { defineStore } from 'pinia';
import { computed, ref, toRaw } from 'vue';

import type {
  AffixChangeOperation,
  ClassId,
  EquipSlot,
  EquipmentDef,
  EquipmentInstance,
  IdleYield,
  LootResult,
  ShopOffer,
  Stats,
} from '@/core/types';
import { Rng } from '@/core/rng';
import { addStats, combatPower, zeroStats } from '@/core/formula';
import {
  affectionDayKey,
  affectionInteractionsRemaining as calcAffectionInteractionsRemaining,
  affectionTierAt,
  applyAffectionCombatBonus,
  completeAffectionStory,
  performAffectionGift,
  performAffectionInteraction,
  type AffectionGiftResult,
  type AffectionInteractionResult,
  type AffectionStoryResult,
} from '@/core/affection';
import {
  attemptEnhance,
  enhanceCost,
  enhanceRule,
  luckGainForRate,
  type EnhanceCost,
  type EnhanceResult,
  type EnhanceRule,
} from '@/core/enhance';
import {
  enhanceBatch,
  enhanceGainSalt,
  type EnhanceBatchAttemptEvent,
  type EnhanceBatchBlockedEvent,
  type EnhanceBatchStopReason,
  type EnhanceBatchStrategy,
} from '@/core/enhanceBatch';
import {
  planEquipmentAdvancement,
  type EquipmentAdvancementResult,
} from '@/core/equipmentAdvancement';
import { planClassSwitch } from '@/core/classSwitch';
import {
  applyClassMods,
  averageSkillMultiplier,
  baseStatsFor,
  expToNext,
  makeMonster,
  makePlayer,
  monsterExp,
  monsterGold,
  staminaMaxForLevel,
} from '@/core/progression';
import {
  createFixedInstance,
  createInstance,
  hasFullyFixedAffixes,
  instanceStatsForClass,
  rollEnhanceGainPermille,
  totalEquipCombatBonuses,
  totalEquipStats,
  weaponElementOf,
  zeroCombatBonuses,
  type PermilleRoll,
  type EnhanceGainGrade,
} from '@/core/equipment';
import {
  planAffixChange,
  resolvePendingAffixChange,
  type PlanAffixChangeResult,
} from '@/core/reforge';
import { applyEquipmentSetStats, resolveEquipmentSetBonuses } from '@/core/equipmentSets';
import {
  equipmentDungeonAttemptsRemaining,
  refreshEquipmentDungeonDay,
  resolveEquipmentDungeonChallenge,
  type EquipmentDungeonBlockReason,
  type EquipmentDungeonWaveResult,
} from '@/core/equipmentDungeon';
import { decomposeGold } from '@/core/economy';
import {
  advanceEncounterState,
  createEncounterState,
  encounterChoicesForChapters,
  encounterJournalCharacters,
  encounterPresentation,
  encounterRewardSeed,
  rememberEncounterStoryChoice,
  replayDialogueForEncounter,
  resolveEncounterChoice,
  resolveStoryEncounter,
  type EncounterChoice,
  type EncounterLine,
  type EncounterPresentation,
  type ResourceBundle,
} from '@/core/encounters';
import { rollLoot } from '@/core/loot';
import { assessShopOffer, type ShopBlockReason } from '@/core/shop';
import { advanceStageKillProgress } from '@/core/stageProgress';
import { countStageMonsterKills, mergeLootResults } from '@/core/stageLoot';
import { advanceBattleVisualCursor, battleMonsterIdAt } from '@/core/battleVisual';
import {
  advanceRhythm,
  createBattleRhythmSnapshot,
  createRhythmState,
  syncRhythmSkills,
  type BattleBeat,
  type BattleRhythmSnapshot,
  type RhythmState,
  type RhythmSkillSpec,
} from '@/core/battleRhythm';
import {
  accumulateIdle,
  idleCombatEfficiency,
  killsPerSecond,
  recoverStamina,
  settleOffline,
} from '@/core/idle';
import { trimBag } from '@/core/bag';
import type { IdleContext } from '@/core/idle';

import {
  CRIT_RATE_CAP,
  ENHANCE_MAX,
  ENHANCE_MATERIAL_IDS,
  LUCK_FULL,
  BAG_CAPACITY,
  SLOT_ORDER,
} from '@/data/constants';
import { getEquipment, requireEquipment } from '@/data/equipment';
import { requireMonster } from '@/data/monsters';
import { requireLootTable } from '@/data/lootTables';
import {
  ENCOUNTERS,
  ENCOUNTER_TIMING,
  encounterIdsForProgress,
  requireEncounter,
} from '@/data/encounters';
import { requireItem } from '@/data/items';
import {
  FIRST_STAGE_ID,
  ORDERED_STAGE_IDS,
  STAGES,
  nextStageId,
  totalMonsterCount,
} from '@/data/stages';
import { requireChapter, requireRegionOfChapter } from '@/data/regions';
import { requireShopOffer } from '@/data/shop';
import { battleRhythmSkills } from '@/data/skills';
import { requireAffectionCharacter, requireAffectionStory } from '@/data/affection';
import { AFFECTION_RULES } from '@/data/affectionRules';
import {
  eligibleAffectionEquipmentIds,
  requireAffectionEquipment,
} from '@/data/affectionEquipment';
import { requireAffectionGift } from '@/data/affectionGifts';
import { getEquipmentDungeonStage, type EquipmentDungeonStage } from '@/data/equipmentDungeons';
import {
  REFORGE_UNLOCK_LEVEL,
  requireRegionReforgeMaterials,
} from '@/data/reforgeRules';
import {
  equipmentAdvancementOption as resolveEquipmentAdvancementOption,
  type EquipmentAdvancementOption,
} from '@/data/equipmentAdvancement';
import { getEquipmentSet } from '@/data/equipmentSets';

import { createSave, type SaveData } from '@/save/schema';
import { clearSave, loadSave, saveSave, SaveConflictError, SaveWriteError } from '@/save/storage';

/** 掉落流水的一条记录，UI 用 */
export interface LootLogEntry {
  id: number;
  itemId: string;
  name: string;
  count: number;
  /** 品质，用于配色。材料用 tier，装备用 quality */
  quality: string;
  isEquipment: boolean;
}

export interface BattlePulse {
  id: number;
  /** 这次演出实际击倒的怪物；不能在推进关卡后误绑到下一只怪。 */
  targetId: string;
  damage: number;
  kills: number;
}

export type ShopPurchaseResult =
  | { ok: true; instance: EquipmentInstance; offer: ShopOffer }
  | { ok: false; reason: ShopBlockReason };

export type EnhanceBlockReason =
  | 'not-found'
  | 'pending-affix-result'
  | 'max-level'
  | 'protection-not-allowed'
  | 'insufficient-gold'
  | 'insufficient-stone'
  | 'insufficient-ore'
  | 'insufficient-lucky'
  | 'insufficient-protection';

export type EnhanceQuote =
  | { ok: false; reason: EnhanceBlockReason }
  | {
      ok: true;
      instance: EquipmentInstance;
      rule: EnhanceRule;
      cost: EnhanceCost;
      luck: number;
      luckGain: number;
      guaranteed: boolean;
      protectionCount: number;
    };

export type EnhanceEquipmentResult =
  | { ok: false; reason: EnhanceBlockReason }
  | {
      ok: true;
      result: EnhanceResult;
      cost: EnhanceCost;
      instance: EquipmentInstance | null;
      gainRoll: PermilleRoll<EnhanceGainGrade> | null;
      cpDelta: number;
    };

export type EnhanceBatchActionResult =
  | {
      ok: false;
      reason: 'not-found' | 'no-equipped' | 'invalid-target' | 'pending-affix-result';
    }
  | {
      ok: true;
      strategy: EnhanceBatchStrategy;
      targetLevel: number;
      attempts: EnhanceBatchAttemptEvent[];
      blocked: EnhanceBatchBlockedEvent[];
      stopReason: EnhanceBatchStopReason;
      instances: EquipmentInstance[];
      cpDelta: number;
    };

export type DecomposeResult =
  | { count: number; gold: number; reason?: never; blockedUids?: never }
  | {
      count: 0;
      gold: 0;
      reason: 'pending-affix-result';
      blockedUids: string[];
    };

export type AffixChangeActionResult =
  | {
      ok: false;
      reason:
        | 'no-save'
        | 'not-found'
        | 'level-locked'
        | 'persistence-pending'
        | 'persistence-conflict'
        | 'persistence-failed';
    }
  | PlanAffixChangeResult;

export type ResolveAffixChangeActionResult =
  | {
      ok: false;
      reason:
        | 'no-save'
        | 'not-found'
        | 'no-pending-result'
        | 'persistence-pending'
        | 'persistence-conflict'
        | 'persistence-failed';
    }
  | {
      ok: true;
      adopted: boolean;
      previous: EquipmentInstance['affixes'][number];
      candidate: EquipmentInstance['affixes'][number];
      cpDelta: number;
    };

type EquipmentAdvancementCoreFailure = Extract<EquipmentAdvancementResult, { ok: false }>;
type EquipmentAdvancementCoreSuccess = Extract<EquipmentAdvancementResult, { ok: true }>;

export type EquipmentAdvancementActionResult =
  | EquipmentAdvancementCoreFailure
  | { ok: false; reason: 'no-save' | 'not-found' | 'no-route' }
  | {
      ok: false;
      reason: 'source-changed';
      expectedSourceDefId: string;
      currentSourceDefId: string;
    }
  | (EquipmentAdvancementCoreSuccess & {
      /** 返回存档中同一个响应式实例，详情页无需重开即可刷新。 */
      equipment: EquipmentInstance;
      cpDelta: number;
    });

export type EncounterResolveResult =
  | { ok: true; outcome: string; rewards: ResourceBundle }
  | {
      ok: false;
      reason:
        'not-found' | 'insufficient-resource' | 'story-choice-required' | 'invalid-story-choice';
    };

export type EncounterStoryChoiceActionResult =
  | { ok: true }
  | { ok: false; reason: 'not-found' | 'not-story' | 'invalid-choice' | 'already-chosen' };
export interface PendingEncounterView extends EncounterPresentation {
  choices: [EncounterChoice, EncounterChoice];
}

export type ClassSwitchResult =
  | { ok: false; reason: 'no-save' | 'same-class' }
  | {
      ok: true;
      fromClassId: ClassId;
      toClassId: ClassId;
      movedCount: number;
      newlyLockedCount: number;
      cpDelta: number;
    };

export type EquipmentDungeonRunResult =
  | {
      ok: false;
      reason: 'no-save' | 'unknown-stage' | EquipmentDungeonBlockReason;
    }
  | {
      ok: true;
      win: false;
      stage: EquipmentDungeonStage;
      waves: EquipmentDungeonWaveResult[];
      durationMs: number;
    }
  | {
      ok: true;
      win: true;
      stage: EquipmentDungeonStage;
      waves: EquipmentDungeonWaveResult[];
      durationMs: number;
      firstClear: boolean;
      drops: LootResult[];
      instances: EquipmentInstance[];
    };

export type AffectionInteractionActionResult =
  | { ok: false; reason: 'no-save' | 'interaction-locked' }
  | Extract<AffectionInteractionResult, { ok: false }>
  | (Extract<AffectionInteractionResult, { ok: true }> & {
      instance: EquipmentInstance | null;
    });

export type AffectionGiftActionResult =
  | { ok: false; reason: 'no-save' | 'gift-locked' }
  | Extract<AffectionGiftResult, { ok: false }>
  | (Extract<AffectionGiftResult, { ok: true }> & {
      instance: EquipmentInstance | null;
    });

export type AffectionStoryChoiceActionResult =
  { ok: false; reason: 'no-save' } | AffectionStoryResult;

const AUTO_SAVE_INTERVAL_MS = 3_000;
const LOOT_LOG_MAX = 40;
/** 战斗拍子的环形缓冲长度。演出是瞬时的，留太多只会占内存。 */
const BATTLE_BEAT_BUFFER = 14;
const BATTLE_PULSE_SECONDS = 0.72;
/** 高速挂机只采样部分击杀演出，给下一只怪留出可见的掉血阶段。 */
const BATTLE_PULSE_COOLDOWN_SECONDS = 0.9;

type OwnedEquipmentLocation =
  | { kind: 'bag'; index: number; instance: EquipmentInstance }
  | { kind: 'equipped'; slot: EquipSlot; instance: EquipmentInstance };

interface StageKillSettlement {
  firstClearedStageId: string | null;
  /** 精英/BOSS 专属表与首通奖励；用于离线弹窗完整展示。 */
  bonusLoot: LootResult[];
}

export const useGameStore = defineStore('game', () => {
  // ─────────── 状态 ───────────
  /**
   * 存档。用深层响应式 ref（而不是 shallowRef）。
   *
   * 曾经用 shallowRef 想省性能，结果 tick 里改的都是嵌套字段
   * （save.value.player.gold 之类），shallowRef 只在整个 .value 被替换时
   * 才触发更新 —— 导致顶栏的等级和金币永远不刷新。属于过早优化。
   *
   * 深层代理的开销在这个体量下可以忽略：一次 tick 只改几个字段，
   * Vue 的代理是惰性的，没被模板读到的字段不产生开销。
   */
  const save = ref<SaveData | null>(null);
  const loaded = ref(false);
  const lootLog = ref<LootLogEntry[]>([]);
  /** 离线结算结果，非 null 时 UI 弹窗 */
  const offlineResult = ref<{ seconds: number; cappedSeconds: number; yield: IdleYield } | null>(
    null,
  );
  /** 背包超容自动分解的提示，UI 可据此弹 toast */
  const autoDecomposed = ref<{ count: number; gold: number; at: number } | null>(null);
  /** 战力变化提示，UI 飘字用 */
  const cpDelta = ref<{ value: number; at: number } | null>(null);
  /** 最近一次自动存档错误；成功保存后清空。 */
  const saveError = ref<string | null>(null);
  const loadError = ref<string | null>(null);
  /** 当前一只怪的击杀进度，0=满血，1=即将击杀。 */
  const battleProgress = ref(0);
  const battlePulse = ref<BattlePulse | null>(null);
  /** 持续战斗演出的拍子流，由 core/battleRhythm 产生 */
  const battleBeats = ref<BattleBeat[]>([]);
  /** 卡片栏只读的同源冷却快照；绝不参与真实挂机收益。 */
  const battleRhythmSnapshot = ref<BattleRhythmSnapshot | null>(null);
  /** 已通关普通关不再保存击杀余数，这里只维护其画面循环游标。 */
  const battleVisualCursor = ref(0);
  /** 只在好感业务日切变化时更新，避免每个动画帧触发派生数据重算。 */
  const affectionNow = ref(Date.now());

  let rng = new Rng(1);
  let lootLogSeq = 0;
  let battlePulseSeq = 0;
  let rhythmState: RhythmState = createRhythmState();
  let rhythmEpoch = 0;
  let rhythmLastBasicCastSeq: number | null = null;
  let rhythmLastCastBySkillId: Record<string, number | null> = {};
  const rhythmRng = new Rng(0x5a6b7c8d);
  let battlePulseRemainingSec = 0;
  let battlePulseCooldownSec = 0;
  /** 挂机零头秒数。不足一只怪的时间攒在这里，见 core/idle.accumulateIdle */
  let idleCarrySec = 0;
  let lastTickAt = 0;
  let lastSaveAt = 0;
  let rafId = 0;
  /** 付费洗练必须等 IndexedDB 真正提交；等待期间拒绝第二笔同类事务。 */
  let affixPersistencePending = false;
  /** 事务等待期间若后台切换等流程请求保存，事务结束后必须补写最新状态。 */
  let persistRequestedDuringAffixTransaction = false;
  /**
   * pagehide 不保证把 document.visibilityState 改成 hidden，因此必须单独记录
   * 「页面已明确暂停」。否则洗练写盘结束时只看 visibility 会错误重启实时循环。
   */
  let backgroundPaused = false;
  /** 洗练写盘期间回到前台时只登记请求，等事务回滚/提交完成后统一结算一次。 */
  let resumeRequestedDuringAffixTransaction = false;
  /**
   * 跨标签 CAS 冲突表示本页整份内存已落后于 IndexedDB 主槽。
   * 这不是可重试的网络错误：必须停机并要求刷新，绝不能继续拿旧快照自动覆盖。
   */
  let storageConflict = false;
  /**
   * 清档等待 IDB 提交期间把 save 暂时从所有业务入口隔离。
   * 这样 pagehide、导入或其他点击都不能在清档墓碑之后排入一份旧快照。
   */
  let resetPersistencePending = false;
  /** 清档期间收到的前台恢复请求，只能在清档失败后恢复旧角色。 */
  let resumeRequestedDuringReset = false;
  /** 重开流程若主动停掉了原有循环，新角色落盘后只恢复那一条既有循环。 */
  let resumeRealtimeForNextNewGame = false;
  let affectionDay = affectionDayKey(affectionNow.value, AFFECTION_RULES.resetHourCst);

  // ─────────── 派生数据 ───────────
  const hasSave = computed(() => save.value !== null);
  const player = computed(() => save.value?.player ?? null);

  /** 装备提供的属性总和 */
  const equipStats = computed<Stats>(() => {
    if (!save.value) return zeroStats();
    return totalEquipStats(
      SLOT_ORDER.map((s) => save.value!.equipped[s]),
      getEquipment,
      save.value.player.classId,
    );
  });

  /** 不进入八项 Stats 的装备战斗词条，统一从当前穿戴聚合。 */
  const equipCombatBonuses = computed(() => {
    if (!save.value) return zeroCombatBonuses();
    return totalEquipCombatBonuses(
      SLOT_ORDER.map((slot) => save.value?.equipped[slot] ?? null),
      getEquipment,
      save.value.player.classId,
    );
  });

  /** 基础攻击属性只来自当前武器；词条只能加成，不能反向赋予属性。 */
  const playerCombatElement = computed(() => {
    const weapon = save.value?.equipped.weapon;
    if (!weapon) return 'none';
    return weaponElementOf(requireEquipment(weapon.defId));
  });

  const equipmentSetResolution = computed(() =>
    resolveEquipmentSetBonuses(
      SLOT_ORDER.map((slot) => save.value?.equipped[slot] ?? null),
      getEquipment,
      getEquipmentSet,
    ),
  );

  /**
   * 当前玩家唯一的最终技能倍率入口。
   *
   * 挂机、装备副本与战斗血条必须读取同一个值，避免套装共鸣只进入收益、
   * 却没有进入玩家正在看的承伤投影。
   */
  const playerSkillMultiplier = computed(() => {
    const currentPlayer = player.value;
    if (!currentPlayer) return 1;
    return (
      averageSkillMultiplier(currentPlayer.level) +
      equipmentSetResolution.value.skillMultiplierBonus
    );
  });

  const affectionState = computed(() => save.value?.affection ?? null);
  const affectionProgress = computed(() => {
    if (!save.value) return null;
    return save.value.affection.characters[save.value.player.classId];
  });
  const affectionTier = computed(() =>
    affectionProgress.value
      ? affectionTierAt(affectionProgress.value.points, AFFECTION_RULES)
      : null,
  );
  const affectionRemaining = computed(() => {
    if (!save.value) return 0;
    return calcAffectionInteractionsRemaining(
      save.value.affection,
      save.value.player.classId,
      affectionNow.value,
      AFFECTION_RULES,
    );
  });
  /** UI 语义化别名：明确这是“可获奖励的互动剩余次数”。 */
  const affectionInteractionsRemaining = affectionRemaining;

  /** 最终属性 = 裸属性 + 装备，再乘职业系数（顺序见 ADR-007） */
  const finalStats = computed<Stats>(() => {
    if (!save.value) return zeroStats();
    const p = save.value.player;
    const base = baseStatsFor(p.classId, p.level);
    const combined = applyEquipmentSetStats(
      addStats(base, equipStats.value),
      equipmentSetResolution.value,
    );
    combined.critRate = Math.min(CRIT_RATE_CAP, combined.critRate);
    const classStats = applyClassMods(p.classId, combined);
    return applyAffectionCombatBonus(
      classStats,
      save.value.affection.characters[p.classId].points,
      AFFECTION_RULES,
    );
  });

  const cp = computed(() => combatPower(finalStats.value));

  const currentStage = computed(() => {
    const id = save.value?.progress.currentStageId ?? FIRST_STAGE_ID;
    const stage = STAGES[id];
    if (!stage) throw new Error(`[配置错误] 存档引用了不存在的关卡：${id}`);
    return stage;
  });

  const expNeeded = computed(() => (player.value ? expToNext(player.value.level) : 1));
  const expPercent = computed(() =>
    player.value ? Math.min(100, (player.value.exp / expNeeded.value) * 100) : 0,
  );

  const staminaMax = computed(() => staminaMaxForLevel(player.value?.level ?? 1));
  const pendingEncounters = computed(() => save.value?.encounters.pending ?? []);
  const encounterState = computed(() => save.value?.encounters ?? createEncounterState());
  const encounterJournal = computed(() =>
    encounterJournalCharacters(Object.values(ENCOUNTERS), encounterState.value),
  );
  const unlockedEncounterChapterIds = computed(
    () =>
      new Set(
        ORDERED_STAGE_IDS.filter((stageId) => isStageUnlocked(stageId)).map(
          (stageId) => STAGES[stageId]!.chapterId,
        ),
      ),
  );
  const equipmentDungeonRemaining = computed(() =>
    save.value ? equipmentDungeonAttemptsRemaining(save.value.equipmentDungeon, Date.now()) : 0,
  );

  /** 当前关卡是否已通关 */
  const currentCleared = computed(
    () => save.value?.progress.clearedStageIds.includes(currentStage.value.id) ?? false,
  );
  const currentKillTarget = computed(() => totalMonsterCount(currentStage.value));
  const currentStageKills = computed(() =>
    Math.min(currentKillTarget.value, save.value?.progress.stageKills[currentStage.value.id] ?? 0),
  );
  /** 没有击杀定格时，下一只应出场的视觉目标。 */
  const nextBattleTargetId = computed(() => {
    const cursor =
      currentCleared.value && !currentStage.value.bossId
        ? battleVisualCursor.value
        : currentStageKills.value;
    return battleMonsterIdAt(currentStage.value, cursor);
  });
  /** 击杀动画期间固定显示倒下的旧目标，动画结束后再切到下一只。 */
  const battleTargetId = computed(() => battlePulse.value?.targetId ?? nextBattleTargetId.value);

  /** 推荐战力只做参考；真实产出由承伤效率软调节，不再形成停止挂机的硬墙。 */
  const cpRatio = computed(() =>
    currentStage.value.recommendCP > 0 ? cp.value / currentStage.value.recommendCP : 1,
  );
  const canIdle = computed(() => save.value !== null);

  /** 挂机上下文，供 core 使用 */
  function buildIdleContext(): IdleContext | null {
    if (!save.value) return null;
    const stage = currentStage.value;
    const p = save.value.player;

    // 取该关第一波第一种小怪作为代表性怪物
    const firstMonId = stage.waves[0]?.monsters[0]?.id;
    if (!firstMonId) throw new Error(`[配置错误] 关卡没有可战斗怪物：${stage.id}`);
    const monDef = requireMonster(firstMonId);
    const monster = makeMonster(monDef);

    return {
      classId: p.classId,
      player: makePlayer(
        p.name,
        p.level,
        finalStats.value,
        playerCombatElement.value,
        equipCombatBonuses.value,
      ),
      monster,
      expPerKill: monsterExp(monDef.level, monDef.type, monDef.expMul ?? 1),
      goldPerKill: monsterGold(monDef.level, monDef.type),
      lootTable: requireLootTable(stage.lootTableId),
      maxKillsPerSec: stage.maxKillsPerSec,
      skillMultiplier: playerSkillMultiplier.value,
    };
  }

  const kps = computed(() => {
    const ctx = buildIdleContext();
    return ctx ? killsPerSecond(ctx) : 0;
  });
  const battleEfficiency = computed(() => {
    const ctx = buildIdleContext();
    return ctx ? idleCombatEfficiency(ctx) : 0;
  });

  // ─────────── 生命周期 ───────────

  function resetBattleVisualState(): void {
    battleProgress.value = 0;
    battlePulse.value = null;
    battleVisualCursor.value = 0;
    battlePulseRemainingSec = 0;
    battlePulseCooldownSec = 0;
    battleBeats.value = [];
    rhythmEpoch++;
    rhythmLastBasicCastSeq = null;
    rhythmLastCastBySkillId = {};
    if (!save.value) {
      rhythmState = createRhythmState();
      battleRhythmSnapshot.value = null;
      return;
    }
    const classId = save.value.player.classId;
    const skills = battleRhythmSkills(classId, save.value.player.level);
    const skillSpecs = rhythmSkillSpecs(skills);
    const playerInterval = 1 / Math.max(0.2, finalStats.value.spd);
    rhythmState = createRhythmState(skillSpecs);
    battleRhythmSnapshot.value = createBattleRhythmSnapshot(rhythmState, {
      contextId: classId,
      epoch: rhythmEpoch,
      running: Boolean(rafId && canIdle.value),
      playerCooldownSec: playerInterval,
      skills: skillSpecs,
      lastBasicCastSeq: null,
      lastCastBySkillId: {},
    });
  }

  function rhythmSkillSpecs(
    skills: ReturnType<typeof battleRhythmSkills>,
  ): readonly RhythmSkillSpec[] {
    return skills.map((skill) => ({
      skillId: skill.id,
      cooldownSec: skill.cooldownSec,
      priority: skill.priority,
    }));
  }

  function publishRhythmRunning(running: boolean): void {
    if (!battleRhythmSnapshot.value || battleRhythmSnapshot.value.running === running) return;
    battleRhythmSnapshot.value = {
      ...battleRhythmSnapshot.value,
      running,
    };
  }

  /**
   * 角色升级可能在同一帧解锁新技能。节奏状态、卡片定义与发布快照必须在
   * level 写入后同步完成，不能等下一次 250ms tick，否则 UI 会短暂读到
   * “新等级卡片 + 旧等级快照”这一组不可能成立的状态。
   */
  function syncBattleRhythmProjectionAfterLevelUp(): void {
    if (!save.value) return;
    const previousSnapshot = battleRhythmSnapshot.value;
    if (!previousSnapshot) {
      throw new Error('[挂机演出] 角色已存在时缺少节奏快照');
    }

    const classId = save.value.player.classId;
    if (previousSnapshot.contextId !== classId) {
      throw new Error(
        `[挂机演出] 升级同步时职业上下文不一致：${previousSnapshot.contextId}/${classId}`,
      );
    }

    const skills = battleRhythmSkills(classId, save.value.player.level);
    const skillSpecs = rhythmSkillSpecs(skills);
    rhythmState = syncRhythmSkills(rhythmState, skillSpecs);
    rhythmLastCastBySkillId = Object.fromEntries(
      skillSpecs.map((skill) => [skill.skillId, rhythmLastCastBySkillId[skill.skillId] ?? null]),
    );
    battleRhythmSnapshot.value = createBattleRhythmSnapshot(rhythmState, {
      contextId: classId,
      epoch: rhythmEpoch,
      running: previousSnapshot.running,
      playerCooldownSec: 1 / Math.max(0.2, finalStats.value.spd),
      skills: skillSpecs,
      lastBasicCastSeq: rhythmLastBasicCastSeq,
      lastCastBySkillId: rhythmLastCastBySkillId,
    });
  }

  function refreshAffectionClock(now = Date.now()): void {
    const nextDay = affectionDayKey(now, AFFECTION_RULES.resetHourCst);
    if (nextDay === affectionDay) return;
    affectionDay = nextDay;
    affectionNow.value = now;
  }

  async function init(): Promise<void> {
    if (resetPersistencePending) return;
    try {
      const data = await loadSave();
      if (resetPersistencePending) return;
      if (data) {
        save.value = data;
        rng = new Rng(data.rngState);
        resetBattleVisualState();
        // 老存档可能已经堆了上万件，先裁剪再结算，否则一进游戏点背包就卡死
        enforceBagCapacity(); // 载入时先裁剪
        settleOfflineNow();
      }
    } catch (error) {
      loadError.value = error instanceof Error ? error.message : '未知存档读取错误';
    }
    loaded.value = true;
    if (!loadError.value && realtimeMayRun()) startLoop();
  }

  async function startNewGame(name: string, classId: SaveData['player']['classId']): Promise<void> {
    if (resetPersistencePending) {
      saveError.value = '旧角色正在清除，请等待完成后再创建新角色。';
      return;
    }
    const now = Date.now();
    const seed = createSeed();
    save.value = createSave(name.trim() || '无名少女', classId, seed, now);
    rng = new Rng(seed);
    lootLog.value = [];
    resetBattleVisualState();
    await persist();
    if (resumeRealtimeForNextNewGame && realtimeMayRun()) startLoop();
    resumeRealtimeForNextNewGame = false;
  }

  async function resetGame(): Promise<boolean> {
    if (affixPersistencePending) {
      saveError.value = '洗练结果正在写入存档，请等待完成后再重开角色。';
      return false;
    }
    if (resetPersistencePending) {
      saveError.value = '旧角色正在清除，请勿重复操作。';
      return false;
    }
    // 先停掉产出源，再把清档排到所有已发出的保存之后；否则迟到的自动保存会复活旧角色。
    const resumeRealtime = rafId !== 0;
    const previousSave = save.value;
    resetPersistencePending = true;
    resumeRequestedDuringReset = false;
    stopLoop();
    // 事务期间让所有既有业务入口自然得到 no-save；startNewGame / loadFrom /
    // persist / resume 另有显式门禁，不能把旧角色或导入档排到清档墓碑之后。
    save.value = null;
    try {
      await clearSave();
    } catch (error) {
      save.value = previousSave;
      resetPersistencePending = false;
      const shouldResume =
        (resumeRealtime || resumeRequestedDuringReset) && realtimeMayRun();
      resumeRequestedDuringReset = false;
      if (error instanceof SaveConflictError) {
        enterStorageConflict();
        return false;
      }
      saveError.value = error instanceof Error ? error.message : '清除存档失败';
      if (shouldResume) {
        refreshAffectionClock();
        settleOfflineNow();
        startLoop();
        void persist();
      }
      throw error;
    }
    resetPersistencePending = false;
    lootLog.value = [];
    offlineResult.value = null;
    storageConflict = false;
    saveError.value = null;
    loadError.value = null;
    resumeRealtimeForNextNewGame = resumeRealtime || resumeRequestedDuringReset;
    resumeRequestedDuringReset = false;
    resetBattleVisualState();
    return true;
  }

  /**
   * 共享账号进度下切换职业。
   *
   * 等级、经验、货币、关卡、材料、强化、商店、奇遇与 RNG 全部留在原存档；
   * 只替换职业，并把不兼容的专属穿戴完整收回背包。事务规划成功后才一次性写回。
   */
  async function switchClass(targetClassId: ClassId): Promise<ClassSwitchResult> {
    if (!save.value) return { ok: false, reason: 'no-save' };

    const fromClassId = save.value.player.classId;
    const plan = planClassSwitch({
      currentClassId: fromClassId,
      targetClassId,
      equipped: save.value.equipped,
      bagEquipment: save.value.bag.equipment,
      definitionOf: getEquipment,
    });
    if (!plan.ok) return plan;

    const beforeCp = cp.value;
    // idleCarrySec 是旧职业需要的秒数。换职业后按当前怪物掉血比例重算，
    // 防止玩家通过反复切换快慢职业凭空刷出一只怪。
    const preservedBattleProgress = battleProgress.value;
    const preservedBattleVisualCursor = battleVisualCursor.value;

    save.value.player.classId = targetClassId;
    save.value.equipped = plan.equipped;
    save.value.bag.equipment = plan.bagEquipment;
    resetBattleVisualState();

    const nextKps = kps.value;
    idleCarrySec = nextKps > 0 ? preservedBattleProgress / nextKps : 0;
    battleProgress.value = preservedBattleProgress;
    battleVisualCursor.value = preservedBattleVisualCursor;

    const delta = cp.value - beforeCp;
    noteCpDelta(beforeCp);
    await persist();
    return {
      ok: true,
      fromClassId,
      toClassId: targetClassId,
      movedCount: plan.movedEquipment.length,
      newlyLockedCount: plan.newlyLockedCount,
      cpDelta: delta,
    };
  }

  function settleOfflineNow(): void {
    if (!save.value) return;

    const now = Date.now();
    let firstClearedStageId: string | null = null;
    if (canIdle.value) {
      const ctx = buildIdleContext();
      if (!ctx) return;
      const r = settleOffline(ctx, save.value.lastActiveAt, now);
      advanceEncounters(r.seconds);
      if (r.yield.kills > 0) {
        const lootCursor =
          currentCleared.value && !currentStage.value.bossId
            ? battleVisualCursor.value
            : currentStageKills.value;
        applyYield(r.yield);
        save.value.stats.totalKills += r.yield.kills;
        const stageSettlement = applyStageKills(r.yield.kills, lootCursor, false);
        firstClearedStageId = stageSettlement.firstClearedStageId;
        offlineResult.value = {
          ...r,
          yield: {
            ...r.yield,
            loot: mergeLootResults(r.yield.loot, stageSettlement.bonusLoot),
          },
        };
      }
    }
    save.value.lastActiveAt = now;

    // 体力也要按离线时长恢复
    const st = recoverStamina(
      save.value.player.stamina,
      staminaMax.value,
      save.value.player.staminaRecoverAt,
      now,
    );
    save.value.player.stamina = st.stamina;
    save.value.player.staminaRecoverAt = st.nextRecoverAt;

    advanceAfterFirstClear(firstClearedStageId);
  }

  function advanceEncounters(elapsedSec: number): void {
    if (!save.value) return;
    const regionId = requireRegionOfChapter(currentStage.value.chapterId).id;
    save.value.encounters = advanceEncounterState(
      save.value.encounters,
      elapsedSec,
      regionId,
      encounterIdsForProgress(
        regionId,
        unlockedEncounterChapterIds.value,
        save.value.encounters.characters,
        new Set(save.value.encounters.pending.map((entry) => entry.encounterId)),
      ),
      save.value.seed,
      ENCOUNTER_TIMING,
    );
  }

  function startLoop(): void {
    if (rafId || storageConflict || resetPersistencePending) return;
    lastTickAt = performance.now();

    const loop = () => {
      rafId = requestAnimationFrame(loop);
      const now = performance.now();
      const dt = (now - lastTickAt) / 1000;
      // 小于 0.25 秒不结算，减少不必要的计算
      if (dt < 0.25) return;
      lastTickAt = now;
      tick(dt);
    };
    rafId = requestAnimationFrame(loop);
    publishRhythmRunning(canIdle.value);
  }

  function stopLoop(): void {
    if (rafId) cancelAnimationFrame(rafId);
    rafId = 0;
    publishRhythmRunning(false);
  }

  function documentIsVisible(): boolean {
    return typeof document === 'undefined' || document.visibilityState !== 'hidden';
  }

  function realtimeMayRun(): boolean {
    return !storageConflict && !backgroundPaused && documentIsVisible();
  }

  function enterStorageConflict(): void {
    storageConflict = true;
    const message =
      '另一页面已经更新了这份存档。为防止旧进度覆盖新进度，本页面已停止运行；请刷新后继续。';
    saveError.value = message;
    loadError.value = message;
    stopLoop();
  }

  /** 进入后台时停止实时循环，并把离线计时起点立即写入存档。 */
  function pauseForBackground(): void {
    const enteringBackground = !backgroundPaused;
    backgroundPaused = true;
    stopLoop();
    if (resetPersistencePending || !enteringBackground) return;
    // 写盘期间的前台恢复尚未真正结算时，随后再次进入后台不能覆盖原离线起点；
    // 整段等待时间仍由事务完成后的第一次有效恢复统一结算。
    if (affixPersistencePending && resumeRequestedDuringAffixTransaction) return;
    if (save.value) save.value.lastActiveAt = Date.now();
    void persist();
  }

  /** 回到前台时按离线规则结算，再恢复实时循环。 */
  function resumeFromBackground(): void {
    if (storageConflict) return;
    // 某些浏览器会在 visibility 仍为 hidden 时派发 pageshow；此时不能抢跑。
    if (!documentIsVisible()) {
      backgroundPaused = true;
      return;
    }
    backgroundPaused = false;
    if (resetPersistencePending) {
      resumeRequestedDuringReset = true;
      return;
    }
    if (affixPersistencePending) {
      // 付费事务尚未真正写盘：现在结算会让失败回滚吞掉新收益/RNG，
      // 因此只登记意图，finally 在提交或回滚完成后统一执行。
      resumeRequestedDuringAffixTransaction = true;
      persistRequestedDuringAffixTransaction = true;
      return;
    }
    refreshAffectionClock();
    settleOfflineNow();
    startLoop();
    void persist();
  }

  /**
   * 结束付费洗练写盘。
   *
   * 回到前台的离线结算必须晚于事务提交/回滚，并且至多发生一次；实时循环只恢复
   * 事务开始前确实运行过的那一条。显式 pagehide 状态优先于 visibility，避免
   * pagehide 时 visibility 仍为 visible 而提前重启。
   */
  function finishAffixPersistenceTransaction(resumeRealtime: boolean): void {
    affixPersistencePending = false;
    const shouldSettleDeferredResume = resumeRequestedDuringAffixTransaction && realtimeMayRun();
    resumeRequestedDuringAffixTransaction = false;

    if (shouldSettleDeferredResume) {
      refreshAffectionClock();
      settleOfflineNow();
    }
    if ((resumeRealtime || shouldSettleDeferredResume) && realtimeMayRun()) startLoop();

    if (persistRequestedDuringAffixTransaction) {
      persistRequestedDuringAffixTransaction = false;
      void persist();
    }
  }

  /**
   * 推进战斗演出节奏。
   *
   * 与击杀结算完全解耦：即使几秒才杀掉一只怪，角色也会按攻速持续挥砍、
   * 技能按冷却轮转、怪物持续反击。最初版本只在击杀时才有演出，
   * 表现就是「角色杵着不动，只有血条在掉」。
   *
   * 这里产生的伤害数字仅供飘字展示，不参与任何真实结算。
   */
  function advanceBattleRhythm(dt: number, ctx: IdleContext): void {
    const classId = save.value!.player.classId;
    const skills = battleRhythmSkills(classId, save.value!.player.level);
    const skillSpecs = rhythmSkillSpecs(skills);

    rhythmState = syncRhythmSkills(rhythmState, skillSpecs);
    rhythmLastCastBySkillId = Object.fromEntries(
      skillSpecs.map((skill) => [skill.skillId, rhythmLastCastBySkillId[skill.skillId] ?? null]),
    );

    const playerStats = ctx.player.stats;
    const monsterStats = ctx.monster.stats;
    const playerInterval = 1 / Math.max(0.2, playerStats.spd);
    // 展示伤害取「一次普攻的期望值」量级，让飘字和血条掉速看起来自洽
    const perHit = Math.max(1, playerStats.atk * (ctx.skillMultiplier ?? 1) * 0.6);

    const advance = advanceRhythm(
      rhythmState,
      dt,
      {
        playerInterval,
        monsterInterval: 1 / Math.max(0.2, monsterStats.spd),
        skills: skillSpecs,
        critRate: playerStats.critRate / 100,
        playerHit: perHit,
        monsterHit: Math.max(1, monsterStats.atk * 0.35),
      },
      rhythmRng,
    );

    rhythmState = advance.state;
    for (const beat of advance.beats) {
      if (beat.kind === 'player-attack') {
        rhythmLastBasicCastSeq = beat.seq;
      } else if (beat.kind === 'player-skill') {
        if (!beat.skillId) {
          throw new Error('[挂机演出] 技能拍缺少稳定 skillId');
        }
        rhythmLastCastBySkillId[beat.skillId] = beat.seq;
      }
    }
    battleRhythmSnapshot.value = createBattleRhythmSnapshot(rhythmState, {
      contextId: classId,
      epoch: rhythmEpoch,
      running: true,
      playerCooldownSec: playerInterval,
      skills: skillSpecs,
      lastBasicCastSeq: rhythmLastBasicCastSeq,
      lastCastBySkillId: rhythmLastCastBySkillId,
    });
    if (advance.beats.length === 0) return;

    // 只保留最近若干拍，UI 用 TransitionGroup 播完即弃
    const merged = [...battleBeats.value, ...advance.beats];
    battleBeats.value = merged.slice(-BATTLE_BEAT_BUFFER);
  }

  /** 每帧推进：挂机结算 + 体力恢复 + 自动存档 */
  function tick(dt: number): void {
    if (!save.value) return;
    refreshAffectionClock();

    let firstClearedStageId: string | null = null;
    battlePulseCooldownSec = Math.max(0, battlePulseCooldownSec - dt);
    if (battlePulse.value) {
      battlePulseRemainingSec -= dt;
      if (battlePulseRemainingSec <= 0) {
        battlePulse.value = null;
        battlePulseRemainingSec = 0;
      }
    }

    if (canIdle.value) {
      const ctx = buildIdleContext();
      if (!ctx) return;
      advanceBattleRhythm(dt, ctx);
      advanceEncounters(dt);
      const acc = accumulateIdle(ctx, dt, idleCarrySec, {
        mode: 'roll',
        rng,
        pity: save.value.progress.pity,
      });
      idleCarrySec = acc.carrySec;
      battleProgress.value = Math.min(0.99, idleCarrySec * killsPerSecond(ctx));
      const y = acc.yield;
      if (y.kills > 0) {
        const visualCursor =
          currentCleared.value && !currentStage.value.bossId
            ? battleVisualCursor.value
            : currentStageKills.value;
        const visualAdvance = advanceBattleVisualCursor(currentStage.value, visualCursor, y.kills);
        if (!battlePulse.value && battlePulseCooldownSec <= 0) {
          const defeatedMonster = makeMonster(requireMonster(visualAdvance.defeatedTargetId));
          battlePulse.value = {
            id: ++battlePulseSeq,
            targetId: visualAdvance.defeatedTargetId,
            damage: defeatedMonster.stats.hp,
            kills: y.kills,
          };
          battlePulseRemainingSec = BATTLE_PULSE_SECONDS;
          battlePulseCooldownSec = BATTLE_PULSE_COOLDOWN_SECONDS;
        }
        applyYield(y, true);
        save.value.stats.totalKills += y.kills;
        firstClearedStageId = applyStageKills(y.kills, visualCursor, true).firstClearedStageId;
        battleVisualCursor.value = visualAdvance.nextCursor;
      }
    } else {
      // 无有效存档时不能把等待时间攒着，避免恢复后一次性领取旧上下文收益。
      idleCarrySec = 0;
      battleProgress.value = 0;
      publishRhythmRunning(false);
    }
    save.value.stats.totalPlaySec += dt;
    save.value.lastActiveAt = Date.now();

    const st = recoverStamina(
      save.value.player.stamina,
      staminaMax.value,
      save.value.player.staminaRecoverAt,
      Date.now(),
    );
    save.value.player.stamina = st.stamina;
    save.value.player.staminaRecoverAt = st.nextRecoverAt;

    // 必须放在旧关收益、BOSS 掉落和演出游标全部写完之后。
    // selectStage 会重置新关演出状态，不能再让本帧的旧关游标覆盖它。
    advanceAfterFirstClear(firstClearedStageId);

    if (Date.now() - lastSaveAt > AUTO_SAVE_INTERVAL_MS) void persist();
  }

  // ─────────── 产出结算 ───────────

  function applyYield(y: IdleYield, log = false): void {
    if (!save.value) return;
    const s = save.value;

    s.player.gold += y.gold;
    s.player.exp += y.exp;
    levelUpIfPossible();

    for (const drop of y.loot) {
      addLoot(drop, log);
    }

    // 产出全部入包后统一裁剪一次，避免背包无限膨胀
    enforceBagCapacity();
  }

  /**
   * 装备自身的基础属性战力。
   *
   * 存档在进入 store 前已经完成迁移和严格校验；此处若再吞掉缺定义或坏实例，
   * 只会把主流程错误伪装成“低战力垃圾装备”。配置不一致必须直接暴露。
   */
  function itemCp(inst: EquipmentInstance): number {
    if (!save.value) throw new Error('[背包裁剪错误] 没有可用存档');
    const def = requireEquipment(inst.defId);
    return combatPower(instanceStatsForClass(def, inst, save.value.player.classId));
  }

  /**
   * 背包超容时自动分解最不值钱的装备。
   *
   * 放在产出结算之后统一做一次，而不是每掉一件就检查 ——
   * 一次离线结算可能塞进几千件，逐件裁剪会非常慢。
   */
  function enforceBagCapacity(): number {
    if (!save.value) return 0;
    const s = save.value;
    if (s.bag.equipment.length <= BAG_CAPACITY) return 0;

    const { kept, removed } = trimBag(s.bag.equipment, BAG_CAPACITY, {
      // 用装备自身战力，而不是 equipmentContributionCp。
      // 后者要跟当前穿戴做换装差值，每次都遍历 8 个槽位重算全身属性；
      // 裁剪只需要「谁更垃圾」的相对排序，自身战力足够且便宜得多。
      valueOf: (inst) => itemCp(inst),
      slotOf: (inst) => requireEquipment(inst.defId).slot,
      qualityOf: (inst) => requireEquipment(inst.defId).quality,
      weaponElementOf: (inst) => {
        const definition = requireEquipment(inst.defId);
        return definition.slot === 'weapon' ? definition.element : undefined;
      },
    });
    if (removed.length === 0) return 0;

    let gold = 0;
    for (const inst of removed) {
      gold += decomposeGold(requireEquipment(inst.defId), inst);
    }
    s.bag.equipment = kept;
    s.player.gold += gold;
    autoDecomposed.value = { count: removed.length, gold, at: Date.now() };
    return removed.length;
  }

  function addLoot(drop: LootResult, log: boolean): void {
    if (!save.value) return;
    const s = save.value;

    const eqDef = getEquipment(drop.itemId);
    if (eqDef) {
      // 装备逐件生成实例（每件的随机词条不同）
      for (let i = 0; i < drop.count; i++) {
        const uid = `e${s.nextUid}`;
        const inst = hasFullyFixedAffixes(eqDef)
          ? createFixedInstance(eqDef, uid, true)
          : createInstance(eqDef, rng.derive(s.nextUid), uid, s.player.classId);
        s.nextUid++;
        s.bag.equipment.push(inst);
      }
      if (log) pushLog(drop.itemId, eqDef.name, drop.count, eqDef.quality, true);
      return;
    }

    const item = requireItem(drop.itemId);
    s.bag.items[drop.itemId] = (s.bag.items[drop.itemId] ?? 0) + drop.count;
    if (log) pushLog(drop.itemId, item.name, drop.count, item.tier, false);
  }

  function pushLog(
    itemId: string,
    name: string,
    count: number,
    quality: string,
    isEquipment: boolean,
  ): void {
    lootLog.value.unshift({
      id: ++lootLogSeq,
      itemId,
      name,
      count,
      quality,
      isEquipment,
    });
    if (lootLog.value.length > LOOT_LOG_MAX) lootLog.value.length = LOOT_LOG_MAX;
  }

  function levelUpIfPossible(): void {
    if (!save.value) return;
    const p = save.value.player;
    const previousLevel = p.level;
    let guard = 0;
    while (p.exp >= expToNext(p.level) && guard++ < 500) {
      p.exp -= expToNext(p.level);
      p.level++;
    }
    if (p.level !== previousLevel) syncBattleRhythmProjectionAfterLevelUp();
  }

  /**
   * 推进首通或已通关 BOSS 循环。
   *
   * 每次击杀先由挂机逻辑结算本章 normal 基础表；这里再按真实波次游标，
   * 只为精英和 BOSS 追加各自专属表，避免“配置了精英掉落但永远不执行”。
   *
   * 返回刚首通的关卡 ID，由调用方在旧关全部结算完成后统一切关。
   * 这里不能直接 selectStage，否则在线 tick 后续的旧关演出状态会污染新关。
   */
  function applyStageKills(kills: number, startCursor: number, log: boolean): StageKillSettlement {
    if (!save.value) return { firstClearedStageId: null, bonusLoot: [] };
    const stage = currentStage.value;
    const distribution = countStageMonsterKills(stage, startCursor, kills);
    const need = stage.waves.reduce(
      (sum, w) => sum + w.monsters.reduce((n, m) => n + m.count, 0),
      0,
    );
    const wasCleared = save.value.progress.clearedStageIds.includes(stage.id);
    const result = advanceStageKillProgress(
      save.value.progress.stageKills[stage.id] ?? 0,
      kills,
      need,
      wasCleared,
      !!stage.bossId,
    );
    save.value.progress.stageKills[stage.id] = result.progress;
    const bonusLoot: LootResult[] = [];
    const grantBonus = (drop: LootResult) => {
      addLoot(drop, log);
      bonusLoot.push({ ...drop });
    };

    if (result.clearedNow) {
      save.value.progress.clearedStageIds.push(stage.id);
      for (const reward of stage.firstClearRewards) grantBonus(reward);
    }

    const actualBossKills = stage.bossId ? (distribution.counts[stage.bossId] ?? 0) : 0;
    if (actualBossKills !== result.bossKills) {
      throw new Error(
        `[关卡掉落错误] ${stage.id} 的 BOSS 击杀与进度不一致：${actualBossKills}/${result.bossKills}`,
      );
    }
    if (stage.bossId && actualBossKills > 0) {
      save.value.stats.bossKills[stage.bossId] =
        (save.value.stats.bossKills[stage.bossId] ?? 0) + actualBossKills;
    }

    for (const [monsterId, count] of Object.entries(distribution.counts)) {
      const monster = requireMonster(monsterId);
      if (monster.type === 'normal') continue;
      const specialTable = requireLootTable(monster.lootTableId);
      for (let index = 0; index < count; index++) {
        for (const drop of rollLoot(
          specialTable,
          rng,
          save.value.progress.pity,
          save.value.player.classId,
        )) {
          grantBonus(drop);
        }
      }
    }

    enforceBagCapacity();
    return {
      firstClearedStageId: result.clearedNow ? stage.id : null,
      bonusLoot: mergeLootResults(bonusLoot),
    };
  }

  // ─────────── 关卡 ───────────

  /** 关卡是否解锁：第一关永远解锁，其余需要前一关通关 */
  function isStageUnlocked(stageId: string): boolean {
    if (!save.value) return stageId === FIRST_STAGE_ID;
    if (stageId === FIRST_STAGE_ID) return true;
    const cleared = save.value.progress.clearedStageIds;
    if (cleared.includes(stageId)) return true;
    const prev = prevStageOf(stageId);
    return prev ? cleared.includes(prev) : false;
  }

  function selectStage(stageId: string): boolean {
    if (!save.value || !STAGES[stageId]) return false;
    if (!isStageUnlocked(stageId)) return false;
    save.value.progress.currentStageId = stageId;
    idleCarrySec = 0;
    resetBattleVisualState();
    void persist();
    return true;
  }

  /** 首通结算完整落袋后自动进入下一关；最后一关没有后继，保持原地。 */
  function advanceAfterFirstClear(clearedStageId: string | null): boolean {
    if (!clearedStageId) return false;
    const next = nextStageId(clearedStageId);
    return next ? selectStage(next) : false;
  }

  /** 推进到下一关（若已解锁） */
  function advanceStage(): boolean {
    const nx = nextStageId(currentStage.value.id);
    return nx ? selectStage(nx) : false;
  }

  /** 本章的教学提示，只弹一次 */
  function takeTutorial(): string | null {
    if (!save.value) return null;
    const chapter = requireChapter(currentStage.value.chapterId);
    if (!chapter.tutorial) return null;
    if (save.value.progress.seenTutorials.includes(chapter.id)) return null;
    save.value.progress.seenTutorials.push(chapter.id);
    return chapter.tutorial;
  }

  function pendingEncounterView(uid: string): PendingEncounterView | null {
    if (!save.value) return null;
    const entry = save.value.encounters.pending.find((candidate) => candidate.uid === uid);
    if (!entry) return null;
    const definition = requireEncounter(entry.encounterId);
    return {
      ...encounterPresentation(definition, save.value.encounters, save.value.seed, entry.uid),
      choices: encounterChoicesForChapters(definition, unlockedEncounterChapterIds.value),
    };
  }

  function replayEncounterStory(encounterId: string): EncounterLine[] {
    if (!save.value) return [];
    return replayDialogueForEncounter(requireEncounter(encounterId), save.value.encounters);
  }
  function rememberPendingEncounterChoice(
    uid: string,
    choiceId: string,
  ): EncounterStoryChoiceActionResult {
    if (!save.value) return { ok: false, reason: 'not-found' };
    const entry = save.value.encounters.pending.find((candidate) => candidate.uid === uid);
    if (!entry) return { ok: false, reason: 'not-found' };
    const result = rememberEncounterStoryChoice(
      save.value.encounters,
      uid,
      requireEncounter(entry.encounterId),
      choiceId,
    );
    if (!result.ok) return result;
    save.value.encounters = result.state;
    void persist();
    return { ok: true };
  }

  function resolvePendingEncounter(uid: string, choiceId: string): EncounterResolveResult {
    if (!save.value) return { ok: false, reason: 'not-found' };
    const index = save.value.encounters.pending.findIndex((entry) => entry.uid === uid);
    if (index < 0) return { ok: false, reason: 'not-found' };
    const entry = save.value.encounters.pending[index]!;
    const encounter = requireEncounter(entry.encounterId);
    const choices = encounterChoicesForChapters(encounter, unlockedEncounterChapterIds.value);
    const choice = choices.find((candidate) => candidate.id === choiceId);
    if (!choice) return { ok: false, reason: 'not-found' };
    const rewardRng = new Rng(encounterRewardSeed(save.value.seed, entry.uid, choice.id));
    const wallet = { gold: save.value.player.gold, items: save.value.bag.items };

    if (encounter.storyArc) {
      const result = resolveStoryEncounter(
        save.value.encounters,
        uid,
        encounter,
        choice,
        wallet,
        rewardRng,
      );
      if (!result.ok) return result;
      save.value.player.gold = result.wallet.gold;
      save.value.bag.items = result.wallet.items;
      save.value.encounters = result.state;
      void persist();
      return { ok: true, outcome: choice.outcome, rewards: result.rewards };
    }

    const result = resolveEncounterChoice(choice, wallet, rewardRng);
    if (!result.ok) return result;
    save.value.player.gold = result.wallet.gold;
    save.value.bag.items = result.wallet.items;
    save.value.encounters.pending.splice(index, 1);
    save.value.encounters.resolvedCount += 1;
    void persist();
    return { ok: true, outcome: choice.outcome, rewards: result.rewards };
  }

  // ─────────── 装备副本 ───────────

  function refreshEquipmentDungeon(now = Date.now()): void {
    if (!save.value) return;
    const previousDayKey = save.value.equipmentDungeon.dayKey;
    const next = refreshEquipmentDungeonDay(save.value.equipmentDungeon, now);
    save.value.equipmentDungeon = next;
    if (next.dayKey !== previousDayKey) void persist();
  }

  function runEquipmentDungeon(stageId: string, now = Date.now()): EquipmentDungeonRunResult {
    if (!save.value) return { ok: false, reason: 'no-save' };
    const stage = getEquipmentDungeonStage(stageId);
    if (!stage) return { ok: false, reason: 'unknown-stage' };

    const s = save.value;
    const previousDayKey = s.equipmentDungeon.dayKey;
    const planned = resolveEquipmentDungeonChallenge({
      stage,
      state: s.equipmentDungeon,
      pity: s.progress.pity,
      player: makePlayer(
        s.player.name,
        s.player.level,
        finalStats.value,
        playerCombatElement.value,
        equipCombatBonuses.value,
      ),
      classId: s.player.classId,
      playerSkillMultiplier: playerSkillMultiplier.value,
      rngState: rng.getState(),
      now,
    });

    if (!planned.ok) {
      s.equipmentDungeon = planned.state;
      if (planned.state.dayKey !== previousDayKey) void persist();
      return { ok: false, reason: planned.reason };
    }

    if (!planned.win) {
      // 失败只允许提交跨日刷新；核心已保证次数、保底和 RNG 不变。
      s.equipmentDungeon = planned.state;
      if (planned.state.dayKey !== previousDayKey) void persist();
      return {
        ok: true,
        win: false,
        stage,
        waves: planned.waves,
        durationMs: planned.durationMs,
      };
    }

    // 先把全部装备实例规划在局部变量中；配置缺失时在触碰存档前直接抛错。
    const instanceRng = new Rng(planned.nextRngState);
    const instances: EquipmentInstance[] = [];
    let nextUid = s.nextUid;
    for (const drop of planned.drops) {
      const definition = requireEquipment(drop.itemId);
      if (definition.slot !== stage.slot || definition.quality !== stage.quality) {
        throw new Error(
          `[配置错误] ${stage.id} 掉出了错误装备 ${definition.id}（${definition.slot}/${definition.quality}）`,
        );
      }
      for (let index = 0; index < drop.count; index++) {
        const uid = `e${nextUid}`;
        const instance = hasFullyFixedAffixes(definition)
          ? createFixedInstance(definition, uid, true)
          : createInstance(definition, instanceRng.derive(nextUid), uid, s.player.classId);
        // 首通奖励是图鉴启动资产，必须锁定，不能被满背包安全裁剪静默分解。
        if (planned.firstClear) instance.locked = true;
        instances.push(instance);
        nextUid += 1;
      }
    }

    // 从这里开始只做同步赋值，构成一次原子提交。
    s.equipmentDungeon = planned.state;
    s.progress.pity = planned.pity;
    rng.setState(planned.nextRngState);
    s.nextUid = nextUid;
    s.bag.equipment.push(...instances);
    for (const drop of planned.drops) {
      const definition = requireEquipment(drop.itemId);
      pushLog(drop.itemId, definition.name, drop.count, definition.quality, true);
    }
    enforceBagCapacity();
    void persist();

    return {
      ok: true,
      win: true,
      stage,
      waves: planned.waves,
      durationMs: planned.durationMs,
      firstClear: planned.firstClear,
      drops: planned.drops,
      instances,
    };
  }

  // ─────────── 装备操作 ───────────

  function equip(uid: string): boolean {
    if (!save.value) return false;
    const s = save.value;
    const idx = s.bag.equipment.findIndex((e) => e.uid === uid);
    if (idx < 0) return false;

    const inst = s.bag.equipment[idx]!;
    const def = requireEquipment(inst.defId);
    if (s.player.level < def.level) return false;
    if (def.classId && def.classId !== s.player.classId) return false;

    const before = cp.value;
    const old = s.equipped[def.slot];
    s.bag.equipment.splice(idx, 1);
    s.equipped[def.slot] = inst;
    if (old) s.bag.equipment.push(old);

    noteCpDelta(before);
    void persist();
    return true;
  }

  function unequip(slot: EquipSlot): boolean {
    if (!save.value) return false;
    const s = save.value;
    const inst = s.equipped[slot];
    if (!inst) return false;

    const before = cp.value;
    s.equipped[slot] = null;
    s.bag.equipment.push(inst);
    noteCpDelta(before);
    void persist();
    return true;
  }

  /** 一键穿戴：每个槽位挑战力最高的那件 */
  function equipBest(): number {
    if (!save.value) return 0;
    const before = cp.value;
    let changed = 0;

    for (const slot of SLOT_ORDER) {
      const candidates = save.value.bag.equipment.filter((e) => {
        const def = requireEquipment(e.defId);
        return (
          def.slot === slot &&
          def.level <= save.value!.player.level &&
          (!def.classId || def.classId === save.value!.player.classId)
        );
      });
      if (candidates.length === 0) continue;

      const bestBag = candidates.reduce((a, b) =>
        equipmentCandidateCp(b) > equipmentCandidateCp(a) ? b : a,
      );
      if (equipmentCandidateCp(bestBag) > cp.value) {
        equipInternal(bestBag.uid, slot);
        changed++;
      }
    }

    if (changed > 0) {
      noteCpDelta(before);
      void persist();
    }
    return changed;
  }

  function equipInternal(uid: string, slot: EquipSlot): void {
    if (!save.value) return;
    const s = save.value;
    const idx = s.bag.equipment.findIndex((e) => e.uid === uid);
    if (idx < 0) return;
    const inst = s.bag.equipment[idx]!;
    const old = s.equipped[slot];
    s.bag.equipment.splice(idx, 1);
    s.equipped[slot] = inst;
    if (old) s.bag.equipment.push(old);
  }

  /** 把某件背包装备替换到对应槽位后，角色会有多少总战力。 */
  function equipmentCandidateCp(inst: EquipmentInstance): number {
    if (!save.value) return 0;
    const def = requireEquipment(inst.defId);

    const equipped = SLOT_ORDER.map((slot) =>
      slot === def.slot ? inst : save.value!.equipped[slot],
    );
    return cpForEquipment(equipped);
  }

  function cpForEquipment(equipped: (EquipmentInstance | null)[]): number {
    if (!save.value) return 0;
    const { classId, level } = save.value.player;
    const base = baseStatsFor(classId, level);
    const setResolution = resolveEquipmentSetBonuses(
      equipped,
      getEquipment,
      getEquipmentSet,
    );
    const combined = applyEquipmentSetStats(
      addStats(base, totalEquipStats(equipped, getEquipment, classId)),
      setResolution,
    );
    combined.critRate = Math.min(CRIT_RATE_CAP, combined.critRate);
    const classStats = applyClassMods(classId, combined);
    const affectionStats = applyAffectionCombatBonus(
      classStats,
      save.value.affection.characters[classId].points,
      AFFECTION_RULES,
    );
    return combatPower(affectionStats);
  }

  function interactWithCharacter(
    classId: ClassId,
    interactionId: string,
    now = Date.now(),
  ): AffectionInteractionActionResult {
    if (!save.value) return { ok: false, reason: 'no-save' };
    const character = requireAffectionCharacter(classId);
    const interaction = character.interactions.find((entry) => entry.id === interactionId);
    if (!interaction) {
      throw new Error(`[配置错误] ${classId} 的好感互动不存在：${interactionId}`);
    }

    const s = save.value;
    const progress = s.affection.characters[classId];
    if (
      interaction.requiredStoryId &&
      !progress.completedStoryIds.includes(interaction.requiredStoryId)
    ) {
      return { ok: false, reason: 'interaction-locked' };
    }
    const pointsAfterInteraction = Math.min(
      AFFECTION_RULES.maxPoints,
      progress.points + interaction.points,
    );
    const gearPoolIds = eligibleAffectionEquipmentIds(
      classId,
      pointsAfterInteraction,
      s.player.level,
    );
    const result = performAffectionInteraction(
      s.affection,
      classId,
      interaction,
      gearPoolIds,
      s.seed,
      now,
      AFFECTION_RULES,
    );

    if (!result.ok) {
      s.affection = result.state;
      void persist();
      return result;
    }

    let instance: EquipmentInstance | null = null;
    let rewardDefinition: EquipmentDef | null = null;
    if (result.gearReward) {
      // 先在局部完成全部可能抛错的配置读取与实例构造；成功后才提交互动与资产。
      // 否则坏配置会留下“保底已消费、图鉴已点亮、装备却没进包”的半事务。
      const definition = requireAffectionEquipment(result.gearReward.defId).definition;
      rewardDefinition = definition;
      instance = createInstance(
        definition,
        new Rng(result.gearReward.rewardSeed),
        `e${s.nextUid}`,
        classId,
      );
      instance.locked = true;
    }

    s.affection = result.state;
    if (instance && rewardDefinition) {
      s.nextUid += 1;
      s.bag.equipment.push(instance);
      pushLog(rewardDefinition.id, rewardDefinition.name, 1, rewardDefinition.quality, true);
      enforceBagCapacity();
    }

    void persist();
    return { ...result, instance };
  }

  function giveAffectionGift(
    classId: ClassId,
    giftId: string,
    now = Date.now(),
  ): AffectionGiftActionResult {
    if (!save.value) return { ok: false, reason: 'no-save' };
    const gift = requireAffectionGift(classId, giftId);
    const s = save.value;
    const progress = s.affection.characters[classId];
    if (!progress.completedStoryIds.includes(gift.requiredStoryId)) {
      return { ok: false, reason: 'gift-locked' };
    }

    const pointsAfterGift = Math.min(AFFECTION_RULES.maxPoints, progress.points + gift.points);
    const gearPoolIds = eligibleAffectionEquipmentIds(classId, pointsAfterGift, s.player.level);
    const result = performAffectionGift(
      s.affection,
      s.bag.items,
      classId,
      gift,
      gearPoolIds,
      s.seed,
      now,
      AFFECTION_RULES,
    );

    if (!result.ok) {
      // 即使材料不足，跨日刷新后的次数也应持久化；礼物纯函数保证物品不变。
      s.affection = result.state;
      s.bag.items = result.items;
      void persist();
      return result;
    }

    let instance: EquipmentInstance | null = null;
    let rewardDefinition: EquipmentDef | null = null;
    if (result.gearReward) {
      // 所有可能抛错的配置读取与实例构造都先在局部完成。任何错误都不会扣礼物、
      // 推进保底、点亮图鉴或消耗 UID。
      const definition = requireAffectionEquipment(result.gearReward.defId).definition;
      rewardDefinition = definition;
      instance = createInstance(
        definition,
        new Rng(result.gearReward.rewardSeed),
        `e${s.nextUid}`,
        classId,
      );
      instance.locked = true;
    }

    s.affection = result.state;
    s.bag.items = result.items;
    if (instance && rewardDefinition) {
      s.nextUid += 1;
      s.bag.equipment.push(instance);
      pushLog(rewardDefinition.id, rewardDefinition.name, 1, rewardDefinition.quality, true);
      enforceBagCapacity();
    }

    void persist();
    return { ...result, instance };
  }

  function completeAffectionStoryChoice(
    classId: ClassId,
    storyId: string,
    choiceId: string,
  ): AffectionStoryChoiceActionResult {
    if (!save.value) return { ok: false, reason: 'no-save' };
    const story = requireAffectionStory(classId, storyId);
    const result = completeAffectionStory(
      save.value.affection,
      classId,
      story,
      choiceId,
      AFFECTION_RULES,
    );
    if (result.ok) {
      save.value.affection = result.state;
      void persist();
    }
    return result;
  }

  /** 背包装备相对当前穿戴方案的精确战力变化。 */
  function equipmentCpDelta(inst: EquipmentInstance): number {
    return equipmentCandidateCp(inst) - cp.value;
  }

  /** 单件装备在当前角色与其余七个槽位的上下文里贡献多少战力。 */
  function equipmentContributionCp(inst: EquipmentInstance): number {
    if (!save.value) return 0;
    const def = requireEquipment(inst.defId);
    const withItem = SLOT_ORDER.map((slot) =>
      slot === def.slot ? inst : save.value!.equipped[slot],
    );
    const withoutItem = SLOT_ORDER.map((slot) =>
      slot === def.slot ? null : save.value!.equipped[slot],
    );
    return cpForEquipment(withItem) - cpForEquipment(withoutItem);
  }

  function findOwnedEquipment(uid: string): OwnedEquipmentLocation | null {
    if (!save.value) return null;
    const bagIndex = save.value.bag.equipment.findIndex((instance) => instance.uid === uid);
    if (bagIndex >= 0) {
      return {
        kind: 'bag',
        index: bagIndex,
        instance: save.value.bag.equipment[bagIndex]!,
      };
    }
    for (const slot of SLOT_ORDER) {
      const instance = save.value.equipped[slot];
      if (instance?.uid === uid) return { kind: 'equipped', slot, instance };
    }
    return null;
  }

  /** 查询背包或穿戴装备的下一阶；无同品质相邻区域定义时明确返回 undefined。 */
  function equipmentAdvancementOption(uid: string): EquipmentAdvancementOption | undefined {
    const located = findOwnedEquipment(uid);
    if (!located) return undefined;
    return resolveEquipmentAdvancementOption(requireEquipment(located.instance.defId));
  }

  /**
   * 跨区升阶原子事务。
   *
   * `expectedSourceDefId` 是确认弹层打开时看到的来源定义。连续点击或旧弹层
   * 再次提交时，第一次升阶已改变 defId，第二次会返回 source-changed，绝不
   * 顺势再跨一个区域。纯逻辑完整成功后才同步扣资产并原地改 defId。
   */
  function advanceEquipment(
    uid: string,
    expectedSourceDefId: string,
  ): EquipmentAdvancementActionResult {
    if (!save.value) return { ok: false, reason: 'no-save' };
    const located = findOwnedEquipment(uid);
    if (!located) return { ok: false, reason: 'not-found' };
    if (located.instance.defId !== expectedSourceDefId) {
      return {
        ok: false,
        reason: 'source-changed',
        expectedSourceDefId,
        currentSourceDefId: located.instance.defId,
      };
    }

    const sourceDefinition = requireEquipment(located.instance.defId);
    const option = resolveEquipmentAdvancementOption(sourceDefinition);
    if (!option) return { ok: false, reason: 'no-route' };

    const result = planEquipmentAdvancement({
      instance: located.instance,
      sourceDefinition,
      targetDefinition: option.target,
      playerLevel: save.value.player.level,
      wallet: {
        gold: save.value.player.gold,
        items: save.value.bag.items,
      },
      requirement: option.requirement,
    });
    if (!result.ok) return result;

    // 到这里所有会抛错的配置验证与所有玩家态预检都已经结束。
    // 只做同步且不会失败的赋值，形成金币、材料、装备三者的一次原子提交。
    const beforeCp = cp.value;
    save.value.player.gold = result.wallet.gold;
    save.value.bag.items = { ...result.wallet.items };
    located.instance.defId = result.targetDefId;
    const cpChange = cp.value - beforeCp;
    noteCpDelta(beforeCp);
    void persist();

    return {
      ...result,
      equipment: located.instance,
      cpDelta: cpChange,
    };
  }

  /**
   * 开始洗练：纯逻辑层先在克隆钱包/RNG/装备上生成完整候选，
   * 成功后才一次性扣材料并写入可持久化 pending；原词条此时绝不覆盖。
   */
  async function startAffixChange(
    uid: string,
    operation: AffixChangeOperation,
    lockedIndices: readonly number[] = [],
    targetIndex?: number,
  ): Promise<AffixChangeActionResult> {
    if (!save.value) return { ok: false, reason: 'no-save' };
    if (storageConflict) return { ok: false, reason: 'persistence-conflict' };
    if (affixPersistencePending) return { ok: false, reason: 'persistence-pending' };
    const located = findOwnedEquipment(uid);
    if (!located) return { ok: false, reason: 'not-found' };
    if (save.value.player.level < REFORGE_UNLOCK_LEVEL) {
      return { ok: false, reason: 'level-locked' };
    }

    const definition = requireEquipment(located.instance.defId);
    const regionId = requireRegionOfChapter(currentStage.value.chapterId).id;
    const result = planAffixChange({
      instance: located.instance,
      definition,
      operation,
      classId: save.value.player.classId,
      lockedIndices,
      ...(targetIndex === undefined ? {} : { targetIndex }),
      regionMaterials: requireRegionReforgeMaterials(regionId),
      wallet: {
        gold: save.value.player.gold,
        items: save.value.bag.items,
      },
      rngState: rng.getState(),
    });
    if (!result.ok) return result;

    const previousGold = save.value.player.gold;
    const previousItems = { ...save.value.bag.items };
    const previousRngState = rng.getState();
    const previousSavedRngState = save.value.rngState;
    const previousInstance = cloneEquipmentInstance(located.instance);
    const resumeRealtime = rafId !== 0;

    affixPersistencePending = true;
    stopLoop();
    try {
      // 同步写入后立刻保存；实时 tick 已暂停，不会在等待 IndexedDB 时消费 RNG
      // 或混入挂机产出，失败时可以精确恢复到操作前状态。
      save.value.player.gold = result.wallet.gold;
      save.value.bag.items = result.wallet.items;
      rng.setState(result.nextRngState);
      commitAffixState(located.instance, result.instance);

      try {
        await persistStrict();
      } catch (error) {
        save.value.player.gold = previousGold;
        save.value.bag.items = previousItems;
        rng.setState(previousRngState);
        save.value.rngState = previousSavedRngState;
        commitAffixState(located.instance, previousInstance);
        if (error instanceof SaveConflictError) {
          return { ok: false, reason: 'persistence-conflict' };
        }
        if (error instanceof SaveWriteError) {
          return { ok: false, reason: 'persistence-failed' };
        }
        throw error;
      }
      return result;
    } finally {
      finishAffixPersistenceTransaction(resumeRealtime);
    }
  }

  /** 玩家确认候选后采用或保留；费用已在生成候选时扣除，这里不再收费。 */
  async function resolveAffixChange(
    uid: string,
    decision: 'adopt' | 'keep',
  ): Promise<ResolveAffixChangeActionResult> {
    if (!save.value) return { ok: false, reason: 'no-save' };
    if (storageConflict) return { ok: false, reason: 'persistence-conflict' };
    if (affixPersistencePending) return { ok: false, reason: 'persistence-pending' };
    const located = findOwnedEquipment(uid);
    if (!located) return { ok: false, reason: 'not-found' };
    if (!located.instance.pendingAffixChange) {
      return { ok: false, reason: 'no-pending-result' };
    }

    const beforeCp = cp.value;
    const result = resolvePendingAffixChange(located.instance, decision);
    const previousInstance = cloneEquipmentInstance(located.instance);
    const resumeRealtime = rafId !== 0;

    affixPersistencePending = true;
    stopLoop();
    try {
      commitAffixState(located.instance, result.instance);
      const delta = cp.value - beforeCp;
      try {
        await persistStrict();
      } catch (error) {
        commitAffixState(located.instance, previousInstance);
        if (error instanceof SaveConflictError) {
          return { ok: false, reason: 'persistence-conflict' };
        }
        if (error instanceof SaveWriteError) {
          return { ok: false, reason: 'persistence-failed' };
        }
        throw error;
      }
      if (result.adopted) noteCpDelta(beforeCp);
      return {
        ok: true,
        adopted: result.adopted,
        previous: result.previous,
        candidate: result.candidate,
        cpDelta: delta,
      };
    } finally {
      finishAffixPersistenceTransaction(resumeRealtime);
    }
  }

  /** 强化报价只接收装备 UID 与保护选择，费用和成功率全部从可信配置重算。 */
  function quoteEnhance(uid: string, useProtection: boolean): EnhanceQuote {
    if (!save.value) return { ok: false, reason: 'not-found' };
    const located = findOwnedEquipment(uid);
    if (!located) return { ok: false, reason: 'not-found' };
    if (located.instance.pendingAffixChange) {
      return { ok: false, reason: 'pending-affix-result' };
    }
    if (located.instance.enhance >= ENHANCE_MAX) return { ok: false, reason: 'max-level' };

    const targetLevel = located.instance.enhance + 1;
    const rule = enhanceRule(targetLevel);
    if (useProtection && rule.failure !== 'break') {
      return { ok: false, reason: 'protection-not-allowed' };
    }

    const definition = requireEquipment(located.instance.defId);
    const cost = enhanceCost(targetLevel, definition.level);
    const luck = located.instance.enhanceLuck[String(targetLevel)] ?? 0;
    const guaranteed = rule.rate < 1 && luck === LUCK_FULL;
    const protectionCount = save.value.bag.items[ENHANCE_MATERIAL_IDS.protection] ?? 0;

    if (save.value.player.gold < cost.gold) return { ok: false, reason: 'insufficient-gold' };
    if ((save.value.bag.items[ENHANCE_MATERIAL_IDS.stone] ?? 0) < cost.stone) {
      return { ok: false, reason: 'insufficient-stone' };
    }
    if ((save.value.bag.items[ENHANCE_MATERIAL_IDS.ore] ?? 0) < cost.ore) {
      return { ok: false, reason: 'insufficient-ore' };
    }
    if ((save.value.bag.items[ENHANCE_MATERIAL_IDS.lucky] ?? 0) < cost.lucky) {
      return { ok: false, reason: 'insufficient-lucky' };
    }
    if (useProtection && !guaranteed && protectionCount < 1) {
      return { ok: false, reason: 'insufficient-protection' };
    }

    return {
      ok: true,
      instance: located.instance,
      rule,
      cost,
      luck,
      luckGain: luckGainForRate(rule.rate),
      guaranteed,
      protectionCount,
    };
  }

  /**
   * 单次强化原子事务。
   *
   * 先用克隆 RNG 规划完整结果；全部计算成功后，才一次性提交金币、材料、
   * 装备、幸运桶和主 RNG 状态。任何预检失败都不会消耗资产或随机格。
   */
  function enhanceEquipment(uid: string, useProtection: boolean): EnhanceEquipmentResult {
    if (!save.value) return { ok: false, reason: 'not-found' };
    const quote = quoteEnhance(uid, useProtection);
    if (!quote.ok) return quote;
    const located = findOwnedEquipment(uid);
    if (!located) return { ok: false, reason: 'not-found' };

    const s = save.value;
    const beforeCp = cp.value;
    const txRng = new Rng(1);
    txRng.setState(rng.getState());
    const result = attemptEnhance(
      {
        level: located.instance.enhance,
        luck: quote.luck,
        useProtection,
      },
      txRng,
    );

    const nextItems = { ...s.bag.items };
    debitMaterial(nextItems, ENHANCE_MATERIAL_IDS.stone, quote.cost.stone);
    debitMaterial(nextItems, ENHANCE_MATERIAL_IDS.ore, quote.cost.ore);
    debitMaterial(nextItems, ENHANCE_MATERIAL_IDS.lucky, quote.cost.lucky);
    if (result.protectionConsumed) {
      debitMaterial(nextItems, ENHANCE_MATERIAL_IDS.protection, 1);
    }

    let nextInstance: EquipmentInstance | null = null;
    let gainRoll: PermilleRoll<EnhanceGainGrade> | null = null;
    if (result.nextLevel !== null) {
      nextInstance = cloneEquipmentInstance(located.instance);
      const targetKey = String(result.targetLevel);

      if (result.outcome === 'success') {
        const gainIndex = result.targetLevel - 1;
        if (nextInstance.enhanceGainPermille[gainIndex] === 0) {
          gainRoll = rollEnhanceGainPermille(
            txRng.derive(enhanceGainSalt(uid, result.targetLevel)),
          );
          nextInstance.enhanceGainPermille[gainIndex] = gainRoll.permille;
        }
        delete nextInstance.enhanceLuck[targetKey];
      } else if (result.nextLuck !== null) {
        nextInstance.enhanceLuck[targetKey] = result.nextLuck;
      }
      nextInstance.enhance = result.nextLevel;
    }

    // 从这里开始只做不会抛错的同步赋值，构成一次原子提交。
    rng.setState(txRng.getState());
    s.player.gold -= quote.cost.gold;
    s.bag.items = nextItems;
    if (located.kind === 'bag') {
      if (nextInstance) s.bag.equipment[located.index] = nextInstance;
      else s.bag.equipment.splice(located.index, 1);
    } else {
      s.equipped[located.slot] = nextInstance;
    }

    const cpChange = cp.value - beforeCp;
    noteCpDelta(beforeCp);
    void persist();
    return {
      ok: true,
      result,
      cost: quote.cost,
      instance: nextInstance,
      gainRoll,
      cpDelta: cpChange,
    };
  }

  /**
   * 一键强化单件装备。
   *
   * 批量计划先在纯逻辑层使用克隆资产完整算完；只有发生过至少一次尝试时，
   * 才把装备、钱包和 RNG 一次性写回并持久化。冲击 +13～15 时会自动使用
   * 保护符，缺少保护符就停下，绝不会由“一键”操作碎掉装备。
   */
  function autoEnhanceEquipment(
    uid: string,
    targetLevel = ENHANCE_MAX,
    maxAttempts?: number,
  ): EnhanceBatchActionResult {
    if (!save.value) return { ok: false, reason: 'not-found' };
    if (!Number.isInteger(targetLevel) || targetLevel < 1 || targetLevel > ENHANCE_MAX) {
      return { ok: false, reason: 'invalid-target' };
    }
    const located = findOwnedEquipment(uid);
    if (!located) return { ok: false, reason: 'not-found' };
    if (located.instance.pendingAffixChange) {
      return { ok: false, reason: 'pending-affix-result' };
    }

    const definition = requireEquipment(located.instance.defId);
    const batch = enhanceBatch({
      rngState: rng.getState(),
      wallet: {
        gold: save.value.player.gold,
        items: save.value.bag.items,
      },
      candidates: [{ instance: located.instance, equipmentLevel: definition.level, order: 0 }],
      targetLevel,
      strategy: 'single',
      ...(maxAttempts === undefined ? {} : { maxAttempts }),
    });

    const beforeCp = cp.value;
    if (batch.attempts.length > 0) {
      const nextInstance = batch.instances[0]!;
      rng.setState(batch.nextRngState);
      save.value.player.gold = batch.wallet.gold;
      save.value.bag.items = batch.wallet.items;
      if (located.kind === 'bag') save.value.bag.equipment[located.index] = nextInstance;
      else save.value.equipped[located.slot] = nextInstance;
      noteCpDelta(beforeCp);
      void persist();
    }

    return {
      ok: true,
      strategy: 'single',
      targetLevel,
      attempts: batch.attempts,
      blocked: batch.blocked,
      stopReason: batch.stopReason,
      instances: batch.instances,
      cpDelta: cp.value - beforeCp,
    };
  }

  /**
   * 一键均衡强化当前穿戴的全部装备。
   *
   * 顺序固定为 SLOT_ORDER，并按 +5 → +9 → +12 → +15 里程碑轮转；
   * 因此不会让第一件装备先吃光所有材料。
   */
  function autoEnhanceAllEquipped(
    targetLevel = ENHANCE_MAX,
    maxAttempts?: number,
  ): EnhanceBatchActionResult {
    if (!save.value) return { ok: false, reason: 'not-found' };
    if (!Number.isInteger(targetLevel) || targetLevel < 1 || targetLevel > ENHANCE_MAX) {
      return { ok: false, reason: 'invalid-target' };
    }

    const slots = SLOT_ORDER.filter((slot) => save.value!.equipped[slot] !== null);
    if (slots.length === 0) return { ok: false, reason: 'no-equipped' };
    if (slots.some((slot) => save.value!.equipped[slot]!.pendingAffixChange)) {
      return { ok: false, reason: 'pending-affix-result' };
    }
    const candidates = slots.map((slot, order) => {
      const instance = save.value!.equipped[slot]!;
      return {
        instance,
        equipmentLevel: requireEquipment(instance.defId).level,
        order,
      };
    });

    const batch = enhanceBatch({
      rngState: rng.getState(),
      wallet: {
        gold: save.value.player.gold,
        items: save.value.bag.items,
      },
      candidates,
      targetLevel,
      strategy: 'balanced',
      ...(maxAttempts === undefined ? {} : { maxAttempts }),
    });

    const beforeCp = cp.value;
    if (batch.attempts.length > 0) {
      rng.setState(batch.nextRngState);
      save.value.player.gold = batch.wallet.gold;
      save.value.bag.items = batch.wallet.items;
      slots.forEach((slot, index) => {
        save.value!.equipped[slot] = batch.instances[index]!;
      });
      noteCpDelta(beforeCp);
      void persist();
    }

    return {
      ok: true,
      strategy: 'balanced',
      targetLevel,
      attempts: batch.attempts,
      blocked: batch.blocked,
      stopReason: batch.stopReason,
      instances: batch.instances,
      cpDelta: cp.value - beforeCp,
    };
  }

  /**
   * 分解装备换金币。locked 的跳过。
   *
   * ⚠ 必须是 O(n)。早先的实现是「对每个 uid 做 findIndex + splice」，
   * 批量分解 1.5 万件时是 O(n²)，直接把页面卡死。
   * 现在改成一次 Set 查表 + 一次 filter 重建数组。
   */
  function decompose(uids: string[]): DecomposeResult {
    if (!save.value) return { count: 0, gold: 0 };
    const s = save.value;
    const targets = new Set(uids);
    const blockedUids = s.bag.equipment
      .filter((inst) => targets.has(inst.uid) && Boolean(inst.pendingAffixChange))
      .map((inst) => inst.uid);
    if (blockedUids.length > 0) {
      return {
        count: 0,
        gold: 0,
        reason: 'pending-affix-result',
        blockedUids,
      };
    }
    let gold = 0;
    let count = 0;

    const kept: EquipmentInstance[] = [];
    for (const inst of s.bag.equipment) {
      if (!targets.has(inst.uid) || inst.locked) {
        kept.push(inst);
        continue;
      }
      gold += decomposeGold(requireEquipment(inst.defId), inst);
      count++;
    }

    if (count > 0) {
      s.bag.equipment = kept;
      s.player.gold += gold;
      void persist();
    }
    return { count, gold };
  }

  function shopContext() {
    if (!save.value) return null;
    return {
      gold: save.value.player.gold,
      playerLevel: save.value.player.level,
      classId: save.value.player.classId,
      clearedStageIds: save.value.progress.clearedStageIds,
      purchasedOfferIds: save.value.shop.purchasedOfferIds,
    };
  }

  function assessShopOfferById(offerId: string) {
    const offer = requireShopOffer(offerId);
    const def = requireEquipment(offer.defId);
    const context = shopContext();
    if (!context) return { ok: false, reason: 'stage-locked' as const };
    return assessShopOffer(offer, def, context);
  }

  /** 珍品购买原子操作：校验、扣款、生成装备、限购登记在同一同步事务中完成。 */
  function purchaseShopOffer(offerId: string): ShopPurchaseResult {
    if (!save.value) return { ok: false, reason: 'stage-locked' };
    const offer = requireShopOffer(offerId);
    const def = requireEquipment(offer.defId);
    const assessment = assessShopOffer(offer, def, shopContext()!);
    if (!assessment.ok) return assessment;

    const s = save.value;
    // 珍品词条全部写在 EquipmentDef.fixedAffixes；商店、预览和 BOSS 同款不盲抽。
    const instance = createFixedInstance(def, `e${s.nextUid}`, true);

    s.player.gold -= offer.price;
    s.nextUid += 1;
    s.bag.equipment.push(instance);
    s.shop.purchasedOfferIds.push(offer.id);
    void persist();
    return { ok: true, instance, offer };
  }

  function toggleLock(uid: string): void {
    if (!save.value) return;
    const inst = save.value.bag.equipment.find((e) => e.uid === uid);
    if (!inst) return;
    inst.locked = !inst.locked;
    void persist();
  }

  /**
   * 批量设置锁定状态，返回实际改动的件数。
   *
   * ⚠ 和 decompose 一样必须是 O(n)：对每个 uid 单独 find 在 1.5 万件背包上
   * 是 O(n²)，会把页面卡死。这里一次 Set 查表 + 一次遍历。
   */
  function setLockBulk(uids: readonly string[], locked: boolean): number {
    if (!save.value) return 0;
    const targets = new Set(uids);
    let changed = 0;
    for (const inst of save.value.bag.equipment) {
      if (!targets.has(inst.uid) || inst.locked === locked) continue;
      inst.locked = locked;
      changed++;
    }
    if (changed > 0) void persist();
    return changed;
  }

  /** 开关只影响玩家主动触发的好感互动短震，不振动后台挂机或自动战斗。 */
  function setHaptics(enabled: boolean): boolean {
    if (!save.value) return false;
    save.value.settings.haptics = enabled;
    void persist();
    return true;
  }

  function noteCpDelta(before: number): void {
    const d = cp.value - before;
    if (d !== 0) cpDelta.value = { value: d, at: Date.now() };
  }

  // ─────────── 持久化 ───────────

  async function persistStrict(): Promise<void> {
    if (!save.value || storageConflict || resetPersistencePending) return;
    lastSaveAt = Date.now();
    save.value.rngState = rng.getState();
    try {
      // Zod 仍会完整校验并产出独立快照；先剥掉 Vue 深层 Proxy，可避免大背包
      // 在校验遍历时反复触发代理读取（5,000 件装备约从 67ms 降到 17ms）。
      await saveSave(toRaw(save.value));
      saveError.value = null;
    } catch (e) {
      if (e instanceof SaveConflictError) {
        enterStorageConflict();
      } else {
        saveError.value = e instanceof Error ? e.message : '未知存档错误';
      }
      console.error('[存档] 保存失败：', e);
      lastSaveAt = 0;
      throw e;
    }
  }

  async function persist(): Promise<void> {
    if (storageConflict || resetPersistencePending) return;
    if (affixPersistencePending) {
      persistRequestedDuringAffixTransaction = true;
      return;
    }
    try {
      await persistStrict();
    } catch {
      // 普通自动保存通过 saveError 告知玩家并在下一轮重试；只有显式付费事务
      // 调 persistStrict，才能把写盘失败反馈给调用方并回滚。
    }
  }

  function loadFrom(data: SaveData): void {
    if (resetPersistencePending) {
      saveError.value = '旧角色正在清除，暂时不能导入存档。';
      return;
    }
    save.value = data;
    refreshAffectionClock();
    rng = new Rng(data.rngState);
    lootLog.value = [];
    idleCarrySec = 0;
    resetBattleVisualState();
    settleOfflineNow();
    void persist();
  }

  function dismissOffline(): void {
    offlineResult.value = null;
  }

  return {
    // 状态
    save,
    loaded,
    hasSave,
    lootLog,
    offlineResult,
    cpDelta,
    autoDecomposed,
    saveError,
    loadError,
    battleProgress,
    battlePulse,
    battleBeats,
    battleRhythmSnapshot,
    battleTargetId,
    // 派生
    player,
    finalStats,
    equipStats,
    equipCombatBonuses,
    playerCombatElement,
    playerSkillMultiplier,
    equipmentSetResolution,
    affectionState,
    affectionProgress,
    affectionTier,
    affectionRemaining,
    affectionInteractionsRemaining,
    cp,
    cpRatio,
    battleEfficiency,
    canIdle,
    currentStage,
    currentCleared,
    currentKillTarget,
    currentStageKills,
    expNeeded,
    expPercent,
    staminaMax,
    kps,
    pendingEncounters,
    encounterState,
    encounterJournal,
    equipmentDungeonRemaining,
    // 动作
    init,
    startNewGame,
    switchClass,
    resetGame,
    startLoop,
    stopLoop,
    pauseForBackground,
    resumeFromBackground,
    refreshAffectionClock,
    persist,
    loadFrom,
    selectStage,
    advanceStage,
    isStageUnlocked,
    takeTutorial,
    pendingEncounterView,
    replayEncounterStory,
    rememberPendingEncounterChoice,
    resolvePendingEncounter,
    refreshEquipmentDungeon,
    runEquipmentDungeon,
    interactWithCharacter,
    giveAffectionGift,
    completeAffectionStoryChoice,
    equip,
    unequip,
    equipBest,
    decompose,
    assessShopOfferById,
    purchaseShopOffer,
    toggleLock,
    setLockBulk,
    setHaptics,
    equipmentCandidateCp,
    equipmentCpDelta,
    equipmentContributionCp,
    equipmentAdvancementOption,
    advanceEquipment,
    startAffixChange,
    resolveAffixChange,
    quoteEnhance,
    enhanceEquipment,
    autoEnhanceEquipment,
    autoEnhanceAllEquipped,
    dismissOffline,
  };
});

function cloneEquipmentInstance(instance: EquipmentInstance): EquipmentInstance {
  return {
    ...instance,
    enhanceGainPermille: [...instance.enhanceGainPermille],
    enhanceLuck: { ...instance.enhanceLuck },
    affixes: instance.affixes.map((affix) => ({ ...affix })),
    ...(instance.pendingAffixChange
      ? {
          pendingAffixChange: {
            ...instance.pendingAffixChange,
            candidate: { ...instance.pendingAffixChange.candidate },
          },
        }
      : {}),
  };
}

/** 保留 Vue 正在展示的实例引用，只提交洗练会改变的三个字段。 */
function commitAffixState(target: EquipmentInstance, source: EquipmentInstance): void {
  target.affixes = source.affixes.map((affix) => ({ ...affix }));
  target.reforgeResonance = source.reforgeResonance;
  if (source.pendingAffixChange) {
    target.pendingAffixChange = {
      ...source.pendingAffixChange,
      candidate: { ...source.pendingAffixChange.candidate },
    };
  } else {
    delete target.pendingAffixChange;
  }
}

function debitMaterial(items: Record<string, number>, itemId: string, count: number): void {
  if (count === 0) return;
  const next = items[itemId]! - count;
  if (next === 0) delete items[itemId];
  else items[itemId] = next;
}

/** 新角色主种子来自系统加密随机源；之后所有游戏随机都由 seeded RNG 派生。 */
function createSeed(): number {
  const value = new Uint32Array(1);
  crypto.getRandomValues(value);
  return value[0] || 0x9e3779b9;
}

/** 前一关的 id。放在这里而不是 stages.ts，因为只有解锁判定需要。 */
function prevStageOf(stageId: string): string | undefined {
  const i = ORDERED_STAGE_IDS.indexOf(stageId);
  return i > 0 ? ORDERED_STAGE_IDS[i - 1] : undefined;
}
