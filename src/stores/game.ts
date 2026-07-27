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

import type { EquipSlot, EquipmentInstance, IdleYield, LootResult, Stats } from '@/core/types';
import { Rng } from '@/core/rng';
import { addStats, combatPower, zeroStats } from '@/core/formula';
import { estimateIncomingDps } from '@/core/combat';
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
import { createInstance, totalEquipStats } from '@/core/equipment';
import { accumulateIdle, killsPerSecond, recoverStamina, settleOffline } from '@/core/idle';
import type { IdleContext } from '@/core/idle';
import { advanceAttackPulse } from '@/core/battleVisual';

import { CRIT_RATE_CAP, DECOMPOSE_GOLD_PER_LEVEL, SLOT_ORDER } from '@/data/constants';
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
  /** 单次攻击的平均伤害；hits > 1 时由 UI 显示合并次数。 */
  damage: number;
  hits: number;
  kills: number;
  /** 本次进入挂机后累计击杀数，仅用于已通关关卡循环切换视觉目标。 */
  killCursor: number;
}

export interface IncomingBattlePulse {
  id: number;
  /** 怪物单次攻击的平均伤害。 */
  damage: number;
  hits: number;
}

const AUTO_SAVE_INTERVAL_MS = 3_000;
const LOOT_LOG_MAX = 40;

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
  /** 仅用于当前可见战斗的玩家生命，不写入存档、不影响挂机收益。 */
  const playerBattleHp = ref(0);
  const incomingBattlePulse = ref<IncomingBattlePulse | null>(null);

  let rng = new Rng(1);
  let lootLogSeq = 0;
  let battlePulseSeq = 0;
  let battleKillCursor = 0;
  let attackVisualCarrySec = 0;
  let incomingPulseSeq = 0;
  let monsterAttackVisualCarrySec = 0;
  let monsterAttackStartsReady = true;
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

  async function init(): Promise<void> {
    try {
      const data = await loadSave();
      if (data) {
        save.value = data;
        rng = new Rng(data.rngState);
        settleOfflineNow();
        playerBattleHp.value = finalStats.value.hp;
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
    idleCarrySec = 0;
    attackVisualCarrySec = 0;
    monsterAttackVisualCarrySec = 0;
    monsterAttackStartsReady = true;
    battleKillCursor = 0;
    battleProgress.value = 0;
    battlePulse.value = null;
    incomingBattlePulse.value = null;
    playerBattleHp.value = finalStats.value.hp;
    await persist();
  }

  async function resetGame(): Promise<void> {
    await clearSave();
    save.value = null;
    lootLog.value = [];
    offlineResult.value = null;
    idleCarrySec = 0;
    attackVisualCarrySec = 0;
    monsterAttackVisualCarrySec = 0;
    monsterAttackStartsReady = true;
    battleKillCursor = 0;
    battleProgress.value = 0;
    battlePulse.value = null;
    incomingBattlePulse.value = null;
    playerBattleHp.value = 0;
  }

  function settleOfflineNow(): void {
    if (!save.value) return;

    const now = Date.now();
    if (canIdle.value) {
      const ctx = buildIdleContext();
      if (!ctx) return;
      const r = settleOffline(ctx, save.value.lastActiveAt, now);
      if (r.yield.kills > 0) {
        applyYield(r.yield);
        save.value.stats.totalKills += r.yield.kills;
        applyStageKills(r.yield.kills, false);
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

    if (canIdle.value) {
      const ctx = buildIdleContext();
      if (!ctx) return;
      const acc = accumulateIdle(ctx, dt, idleCarrySec, {
        mode: 'roll',
        rng,
        pity: save.value.progress.pity,
      });
      idleCarrySec = acc.carrySec;
      const kpsNow = killsPerSecond(ctx);
      battleProgress.value = Math.min(0.99, idleCarrySec * kpsNow);
      const y = acc.yield;
      battleKillCursor += y.kills;

      const attackStep = advanceAttackPulse(dt, attackVisualCarrySec, ctx.player.stats.spd);
      attackVisualCarrySec = attackStep.carrySec;
      // 如果本帧已经真实击杀，至少补一段攻击反馈，避免极端掉帧时怪物无声消失。
      const visualHits = Math.max(attackStep.hits, y.kills > 0 ? 1 : 0);
      if (visualHits > 0) {
        battlePulse.value = {
          id: ++battlePulseSeq,
          damage: Math.max(1, Math.round((ctx.monster.stats.hp * kpsNow) / ctx.player.stats.spd)),
          hits: visualHits,
          kills: y.kills,
          killCursor: battleKillCursor,
        };
      }
      if (y.kills > 0) {
        // 当前仍是“一只怪一场”的可见战斗；死亡规则确定前，每次击杀后重开满血演出。
        playerBattleHp.value = ctx.player.stats.hp;
        monsterAttackVisualCarrySec = 0;
        monsterAttackStartsReady = true;
        applyYield(y, true);
        save.value.stats.totalKills += y.kills;
        applyStageKills(y.kills, true);
      } else {
        playerBattleHp.value = Math.min(
          ctx.player.stats.hp,
          Math.max(1, playerBattleHp.value || ctx.player.stats.hp),
        );
        const incomingStep = advanceAttackPulse(
          dt,
          monsterAttackVisualCarrySec,
          ctx.monster.stats.spd,
        );
        monsterAttackVisualCarrySec = incomingStep.carrySec;
        const incomingHits = incomingStep.hits + (monsterAttackStartsReady ? 1 : 0);
        monsterAttackStartsReady = false;
        if (incomingHits > 0) {
          const damagePerHit = Math.max(
            1,
            Math.round(estimateIncomingDps(ctx.player, ctx.monster) / ctx.monster.stats.spd),
          );
          incomingBattlePulse.value = {
            id: ++incomingPulseSeq,
            damage: damagePerHit,
            hits: incomingHits,
          };
          // 临时边界：只演示怪物反击，最低停在 1；最终死亡行为由后续策略接管。
          playerBattleHp.value = Math.max(
            1,
            playerBattleHp.value - damagePerHit * incomingHits,
          );
        }
      }
    } else {
      // 战力不足时不能把等待时间攒着，切回低级图后一次性领取。
      idleCarrySec = 0;
      attackVisualCarrySec = 0;
      monsterAttackVisualCarrySec = 0;
      monsterAttackStartsReady = true;
      battleProgress.value = 0;
      playerBattleHp.value = finalStats.value.hp;
      incomingBattlePulse.value = null;
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
        const inst = createInstance(eqDef, rng.derive(s.nextUid), `e${s.nextUid}`);
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

  /** 挂机累计击杀足够时标记通关，并发放一次性首通奖励。 */
  function applyStageKills(kills: number, log: boolean): void {
    if (!save.value) return;
    const stage = currentStage.value;
    if (save.value.progress.clearedStageIds.includes(stage.id)) return;

    const accumulated = (save.value.progress.stageKills[stage.id] ?? 0) + kills;
    save.value.progress.stageKills[stage.id] = accumulated;
    const need = stage.waves.reduce(
      (sum, w) => sum + w.monsters.reduce((n, m) => n + m.count, 0),
      0,
    );
    if (accumulated >= need) {
      save.value.progress.stageKills[stage.id] = need;
      save.value.progress.clearedStageIds.push(stage.id);
      for (const reward of stage.firstClearRewards) addLoot(reward, log);
      if (stage.bossId) {
        save.value.stats.bossKills[stage.bossId] =
          (save.value.stats.bossKills[stage.bossId] ?? 0) + 1;
      }
    }
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
    attackVisualCarrySec = 0;
    monsterAttackVisualCarrySec = 0;
    monsterAttackStartsReady = true;
    battleKillCursor = 0;
    battleProgress.value = 0;
    battlePulse.value = null;
    incomingBattlePulse.value = null;
    playerBattleHp.value = finalStats.value.hp;
    void persist();
    return true;
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
        return def.slot === slot && def.level <= save.value!.player.level;
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
      gold += Math.round(def.level * DECOMPOSE_GOLD_PER_LEVEL * (1 + inst.enhance));
      s.bag.equipment.splice(idx, 1);
      count++;
    }

    if (count > 0) {
      s.player.gold += gold;
      void persist();
    }
    return { count, gold };
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
    attackVisualCarrySec = 0;
    monsterAttackVisualCarrySec = 0;
    monsterAttackStartsReady = true;
    battleKillCursor = 0;
    battleProgress.value = 0;
    battlePulse.value = null;
    incomingBattlePulse.value = null;
    playerBattleHp.value = finalStats.value.hp;
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
    playerBattleHp,
    incomingBattlePulse,
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
    toggleLock,
    equipmentCandidateCp,
    equipmentCpDelta,
    equipmentContributionCp,
    dismissOffline,
  };
});

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
