/**
 * 游戏主 store —— 唯一持有存档的地方。
 *
 * 设计原则：
 *   - 所有游戏逻辑调用 core/ 的纯函数，store 只负责「拿存档 → 调 core → 写回存档」
 *   - 挂机推进用 requestAnimationFrame 计算「距上次 tick 过了多久」，
 *     而不是假设 tick 间隔固定 —— 手机切后台会节流，固定间隔会算错
 */

import { defineStore } from 'pinia';
import { computed, ref } from 'vue';

import type {
  EquipSlot,
  EquipmentInstance,
  IdleYield,
  LootResult,
  ShopOffer,
  Stats,
} from '@/core/types';
import { Rng } from '@/core/rng';
import { addStats, combatPower, zeroStats } from '@/core/formula';
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
  rollEnhanceGainPermille,
  totalEquipStats,
  type PermilleRoll,
  type EnhanceGainGrade,
} from '@/core/equipment';
import { decomposeGold } from '@/core/economy';
import { rollLoot } from '@/core/loot';
import { assessShopOffer, type ShopBlockReason } from '@/core/shop';
import { advanceStageKillProgress } from '@/core/stageProgress';
import { advanceBattleVisualCursor, battleMonsterIdAt } from '@/core/battleVisual';
import { accumulateIdle, killsPerSecond, recoverStamina, settleOffline } from '@/core/idle';
import type { IdleContext } from '@/core/idle';

import {
  CRIT_RATE_CAP,
  ENHANCE_MAX,
  ENHANCE_MATERIAL_IDS,
  LUCK_FULL,
  SLOT_ORDER,
} from '@/data/constants';
import { getEquipment, requireEquipment } from '@/data/equipment';
import { requireMonster } from '@/data/monsters';
import { requireLootTable } from '@/data/lootTables';
import { requireItem } from '@/data/items';
import {
  FIRST_STAGE_ID,
  ORDERED_STAGE_IDS,
  STAGES,
  nextStageId,
  totalMonsterCount,
} from '@/data/stages';
import { requireChapter } from '@/data/regions';
import { requireShopOffer } from '@/data/shop';

import { createSave, type SaveData } from '@/save/schema';
import { clearSave, loadSave, saveSave } from '@/save/storage';

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

const AUTO_SAVE_INTERVAL_MS = 3_000;
const LOOT_LOG_MAX = 40;
const BATTLE_PULSE_SECONDS = 0.72;
/** 高速挂机只采样部分击杀演出，给下一只怪留出可见的掉血阶段。 */
const BATTLE_PULSE_COOLDOWN_SECONDS = 0.9;
/** 强化属性子随机流的模块盐；不会额外推进主 RNG。 */
const ENHANCE_GAIN_DERIVE_SALT = 0x73616b75;

type OwnedEquipmentLocation =
  | { kind: 'bag'; index: number; instance: EquipmentInstance }
  | { kind: 'equipped'; slot: EquipSlot; instance: EquipmentInstance };

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
  /** 战力变化提示，UI 飘字用 */
  const cpDelta = ref<{ value: number; at: number } | null>(null);
  /** 最近一次自动存档错误；成功保存后清空。 */
  const saveError = ref<string | null>(null);
  const loadError = ref<string | null>(null);
  /** 当前一只怪的击杀进度，0=满血，1=即将击杀。 */
  const battleProgress = ref(0);
  const battlePulse = ref<BattlePulse | null>(null);
  /** 已通关普通关不再保存击杀余数，这里只维护其画面循环游标。 */
  const battleVisualCursor = ref(0);

  let rng = new Rng(1);
  let lootLogSeq = 0;
  let battlePulseSeq = 0;
  let battlePulseRemainingSec = 0;
  let battlePulseCooldownSec = 0;
  /** 挂机零头秒数。不足一只怪的时间攒在这里，见 core/idle.accumulateIdle */
  let idleCarrySec = 0;
  let lastTickAt = 0;
  let lastSaveAt = 0;
  let rafId = 0;

  // ─────────── 派生数据 ───────────
  const hasSave = computed(() => save.value !== null);
  const player = computed(() => save.value?.player ?? null);

  /** 装备提供的属性总和 */
  const equipStats = computed<Stats>(() => {
    if (!save.value) return zeroStats();
    return totalEquipStats(
      SLOT_ORDER.map((s) => save.value!.equipped[s]),
      getEquipment,
    );
  });

  /** 最终属性 = 裸属性 + 装备，再乘职业系数（顺序见 ADR-007） */
  const finalStats = computed<Stats>(() => {
    if (!save.value) return zeroStats();
    const p = save.value.player;
    const base = baseStatsFor(p.classId, p.level);
    const combined = addStats(base, equipStats.value);
    combined.critRate = Math.min(CRIT_RATE_CAP, combined.critRate);
    return applyClassMods(p.classId, combined);
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

  /** 战力是否够打当前关卡。低于 60% 禁止挂机，避免白耗时间 */
  const cpRatio = computed(() =>
    currentStage.value.recommendCP > 0 ? cp.value / currentStage.value.recommendCP : 1,
  );
  const canIdle = computed(() => cpRatio.value >= 0.6);

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
      player: makePlayer(p.name, p.level, finalStats.value),
      monster,
      expPerKill: monsterExp(monDef.level, monDef.type, monDef.expMul ?? 1),
      goldPerKill: monsterGold(monDef.level, monDef.type),
      lootTable: requireLootTable(stage.lootTableId),
      maxKillsPerSec: stage.maxKillsPerSec,
      skillMultiplier: averageSkillMultiplier(p.level),
    };
  }

  const kps = computed(() => {
    const ctx = buildIdleContext();
    return ctx ? killsPerSecond(ctx) : 0;
  });

  // ─────────── 生命周期 ───────────

  function resetBattleVisualState(): void {
    battleProgress.value = 0;
    battlePulse.value = null;
    battleVisualCursor.value = 0;
    battlePulseRemainingSec = 0;
    battlePulseCooldownSec = 0;
  }

  async function init(): Promise<void> {
    try {
      const data = await loadSave();
      if (data) {
        save.value = data;
        rng = new Rng(data.rngState);
        resetBattleVisualState();
        settleOfflineNow();
      }
    } catch (error) {
      loadError.value = error instanceof Error ? error.message : '未知存档读取错误';
    }
    loaded.value = true;
    if (!loadError.value) startLoop();
  }

  async function startNewGame(name: string, classId: SaveData['player']['classId']): Promise<void> {
    const now = Date.now();
    const seed = createSeed();
    save.value = createSave(name.trim() || '无名少女', classId, seed, now);
    rng = new Rng(seed);
    lootLog.value = [];
    resetBattleVisualState();
    await persist();
  }

  async function resetGame(): Promise<void> {
    await clearSave();
    save.value = null;
    lootLog.value = [];
    offlineResult.value = null;
    resetBattleVisualState();
  }

  function settleOfflineNow(): void {
    if (!save.value) return;

    const now = Date.now();
    let firstClearedStageId: string | null = null;
    if (canIdle.value) {
      const ctx = buildIdleContext();
      if (!ctx) return;
      const r = settleOffline(ctx, save.value.lastActiveAt, now);
      if (r.yield.kills > 0) {
        applyYield(r.yield);
        save.value.stats.totalKills += r.yield.kills;
        firstClearedStageId = applyStageKills(r.yield.kills, false);
        offlineResult.value = r;
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

  function startLoop(): void {
    if (rafId) return;
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
  }

  function stopLoop(): void {
    if (rafId) cancelAnimationFrame(rafId);
    rafId = 0;
  }

  /** 进入后台时停止实时循环，并把离线计时起点立即写入存档。 */
  function pauseForBackground(): void {
    if (save.value) save.value.lastActiveAt = Date.now();
    stopLoop();
    void persist();
  }

  /** 回到前台时按离线规则结算，再恢复实时循环。 */
  function resumeFromBackground(): void {
    settleOfflineNow();
    startLoop();
    void persist();
  }

  /** 每帧推进：挂机结算 + 体力恢复 + 自动存档 */
  function tick(dt: number): void {
    if (!save.value) return;

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
        firstClearedStageId = applyStageKills(y.kills, true);
        battleVisualCursor.value = visualAdvance.nextCursor;
      }
    } else {
      // 战力不足时不能把等待时间攒着，切回低级图后一次性领取。
      idleCarrySec = 0;
      battleProgress.value = 0;
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
  }

  function addLoot(drop: LootResult, log: boolean): void {
    if (!save.value) return;
    const s = save.value;

    const eqDef = getEquipment(drop.itemId);
    if (eqDef) {
      // 装备逐件生成实例（每件的随机词条不同）
      for (let i = 0; i < drop.count; i++) {
        const uid = `e${s.nextUid}`;
        const inst = eqDef.boutiqueTheme
          ? createFixedInstance(eqDef, uid, true)
          : createInstance(eqDef, rng.derive(s.nextUid), uid);
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
    let guard = 0;
    while (p.exp >= expToNext(p.level) && guard++ < 500) {
      p.exp -= expToNext(p.level);
      p.level++;
    }
  }

  /**
   * 推进首通或已通关 BOSS 循环。
   *
   * 普通击杀始终使用关卡的 normal 掉落表；只有完整跑完含 BOSS 的波次，
   * 才单独掷一次 BOSS 表，避免最终关卡的每只小怪都冒充 BOSS。
   *
   * 返回刚首通的关卡 ID，由调用方在旧关全部结算完成后统一切关。
   * 这里不能直接 selectStage，否则在线 tick 后续的旧关演出状态会污染新关。
   */
  function applyStageKills(kills: number, log: boolean): string | null {
    if (!save.value) return null;
    const stage = currentStage.value;
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

    if (result.clearedNow) {
      save.value.progress.clearedStageIds.push(stage.id);
      for (const reward of stage.firstClearRewards) addLoot(reward, log);
    }

    if (stage.bossId && result.bossKills > 0) {
      save.value.stats.bossKills[stage.bossId] =
        (save.value.stats.bossKills[stage.bossId] ?? 0) + result.bossKills;
      const bossTable = requireLootTable(requireMonster(stage.bossId).lootTableId);
      for (let i = 0; i < result.bossKills; i++) {
        for (const drop of rollLoot(bossTable, rng, save.value.progress.pity)) {
          addLoot(drop, log);
        }
      }
    }

    return result.clearedNow ? stage.id : null;
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
    const base = baseStatsFor(save.value.player.classId, save.value.player.level);
    const combined = addStats(base, totalEquipStats(equipped, getEquipment));
    combined.critRate = Math.min(CRIT_RATE_CAP, combined.critRate);
    return combatPower(applyClassMods(save.value.player.classId, combined));
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

  /** 强化报价只接收装备 UID 与保护选择，费用和成功率全部从可信配置重算。 */
  function quoteEnhance(uid: string, useProtection: boolean): EnhanceQuote {
    if (!save.value) return { ok: false, reason: 'not-found' };
    const located = findOwnedEquipment(uid);
    if (!located) return { ok: false, reason: 'not-found' };
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

  /** 分解装备换金币。locked 的跳过。 */
  function decompose(uids: string[]): { count: number; gold: number } {
    if (!save.value) return { count: 0, gold: 0 };
    const s = save.value;
    let gold = 0;
    let count = 0;

    for (const uid of uids) {
      const idx = s.bag.equipment.findIndex((e) => e.uid === uid);
      if (idx < 0) continue;
      const inst = s.bag.equipment[idx]!;
      if (inst.locked) continue;
      const def = requireEquipment(inst.defId);
      gold += decomposeGold(def, inst);
      s.bag.equipment.splice(idx, 1);
      count++;
    }

    if (count > 0) {
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

  function noteCpDelta(before: number): void {
    const d = cp.value - before;
    if (d !== 0) cpDelta.value = { value: d, at: Date.now() };
  }

  // ─────────── 持久化 ───────────

  async function persist(): Promise<void> {
    if (!save.value) return;
    lastSaveAt = Date.now();
    save.value.rngState = rng.getState();
    try {
      await saveSave(save.value);
      saveError.value = null;
    } catch (e) {
      saveError.value = e instanceof Error ? e.message : '未知存档错误';
      console.error('[存档] 保存失败：', e);
    }
  }

  function loadFrom(data: SaveData): void {
    save.value = data;
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
    saveError,
    loadError,
    battleProgress,
    battlePulse,
    battleTargetId,
    // 派生
    player,
    finalStats,
    equipStats,
    cp,
    cpRatio,
    canIdle,
    currentStage,
    currentCleared,
    currentKillTarget,
    currentStageKills,
    expNeeded,
    expPercent,
    staminaMax,
    kps,
    // 动作
    init,
    startNewGame,
    resetGame,
    startLoop,
    stopLoop,
    pauseForBackground,
    resumeFromBackground,
    persist,
    loadFrom,
    selectStage,
    advanceStage,
    isStageUnlocked,
    takeTutorial,
    equip,
    unequip,
    equipBest,
    decompose,
    assessShopOfferById,
    purchaseShopOffer,
    toggleLock,
    equipmentCandidateCp,
    equipmentCpDelta,
    equipmentContributionCp,
    quoteEnhance,
    enhanceEquipment,
    dismissOffline,
  };
});

function cloneEquipmentInstance(instance: EquipmentInstance): EquipmentInstance {
  return {
    ...instance,
    enhanceGainPermille: [...instance.enhanceGainPermille],
    enhanceLuck: { ...instance.enhanceLuck },
    affixes: instance.affixes.map((affix) => ({ ...affix })),
  };
}

function debitMaterial(items: Record<string, number>, itemId: string, count: number): void {
  if (count === 0) return;
  const next = items[itemId]! - count;
  if (next === 0) delete items[itemId];
  else items[itemId] = next;
}

function enhanceGainSalt(uid: string, targetLevel: number): number {
  let hash = ENHANCE_GAIN_DERIVE_SALT;
  for (let index = 0; index < uid.length; index++) {
    hash = Math.imul(hash ^ uid.charCodeAt(index), 0x01000193);
  }
  return (hash ^ targetLevel) >>> 0;
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
