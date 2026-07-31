/** 背包与装备领域 store。 */
import { computed } from 'vue';
import { defineStore } from 'pinia';
import type { AffixChangeOperation, EquipSlot, EquipmentInstance } from '@/core/types';
import type { EquipmentAdvancementOption } from '@/data/equipmentAdvancement';
import {
  useGameStore,
  type AffixChangeActionResult,
  type DecomposeResult,
  type EquipmentAdvancementActionResult,
  type EquipmentSetCraftingActionResult,
  type EnhanceBatchActionResult,
  type EnhanceEquipmentResult,
  type EnhanceQuote,
  type ResolveAffixChangeActionResult,
} from './game';

export const useInventoryStore = defineStore('inventory', () => {
  const game = useGameStore();

  const bag = computed(() => game.save?.bag ?? null);
  const equipped = computed(() => game.save?.equipped ?? null);
  /**
   * 永久图鉴账本里「曾经获得过」的定义 id（存档 v17 起）。
   * 图鉴按它展示收集进度，所以分解装备不会让进度倒退（docs/63 §4.2）。
   */
  const discoveredDefIds = computed<readonly string[]>(
    () => game.save?.equipmentCodex.discoveredDefIds ?? [],
  );
  const equipStats = computed(() => game.equipStats);

  function equip(uid: string): boolean {
    return game.equip(uid);
  }

  function unequip(slot: EquipSlot): boolean {
    return game.unequip(slot);
  }

  function equipBest(): number {
    return game.equipBest();
  }

  function decompose(uids: string[]): DecomposeResult {
    return game.decompose(uids);
  }

  function toggleLock(uid: string): void {
    game.toggleLock(uid);
  }

  function setLockBulk(uids: readonly string[], locked: boolean): number {
    return game.setLockBulk(uids, locked);
  }

  function candidateCp(inst: EquipmentInstance): number {
    return game.equipmentCandidateCp(inst);
  }

  function cpDelta(inst: EquipmentInstance): number {
    return game.equipmentCpDelta(inst);
  }

  function currentScore(inst: EquipmentInstance): number {
    return game.equipmentStableCurrentScore(inst);
  }

  function baseScore(inst: EquipmentInstance): number {
    return game.equipmentStableBaseScore(inst);
  }

  function contributionCp(inst: EquipmentInstance): number {
    return game.equipmentContributionCp(inst);
  }

  function equipmentAdvancementOption(uid: string): EquipmentAdvancementOption | undefined {
    return game.equipmentAdvancementOption(uid);
  }

  /**
   * 按稳定 UID 重新读取当前持有实例。
   *
   * 页面从装备详情交接到养成操作台时会先关闭旧 dialog，再到下一帧查这里。
   * 不把详情里的对象快照继续传下去，避免交接期间装备已被另一事务改变或移走。
   */
  function ownedEquipment(uid: string): EquipmentInstance | null {
    const inBag = bag.value?.equipment.find((instance) => instance.uid === uid);
    if (inBag) return inBag;
    return Object.values(equipped.value ?? {}).find((instance) => instance?.uid === uid) ?? null;
  }

  function advanceEquipment(
    uid: string,
    expectedSourceDefId: string,
  ): Promise<EquipmentAdvancementActionResult> {
    return game.advanceEquipment(uid, expectedSourceDefId);
  }

  function craftEquipmentSetPiece(
    recipeId: string,
    targetSlot: EquipSlot,
  ): Promise<EquipmentSetCraftingActionResult> {
    return game.craftEquipmentSetPiece(recipeId, targetSlot);
  }

  function startAffixChange(
    uid: string,
    operation: AffixChangeOperation,
    lockedIndices: readonly number[] = [],
    targetIndex?: number,
  ): Promise<AffixChangeActionResult> {
    return game.startAffixChange(uid, operation, lockedIndices, targetIndex);
  }

  function resolveAffixChange(
    uid: string,
    decision: 'adopt' | 'keep',
  ): Promise<ResolveAffixChangeActionResult> {
    return game.resolveAffixChange(uid, decision);
  }

  function quoteEnhance(uid: string, useProtection: boolean): EnhanceQuote {
    return game.quoteEnhance(uid, useProtection);
  }

  function enhance(uid: string, useProtection: boolean): EnhanceEquipmentResult {
    return game.enhanceEquipment(uid, useProtection);
  }

  function autoEnhance(uid: string, targetLevel?: number): EnhanceBatchActionResult {
    return game.autoEnhanceEquipment(uid, targetLevel);
  }

  function autoEnhanceAll(targetLevel?: number): EnhanceBatchActionResult {
    return game.autoEnhanceAllEquipped(targetLevel);
  }

  return {
    discoveredDefIds,
    bag,
    equipped,
    equipStats,
    equip,
    unequip,
    equipBest,
    decompose,
    toggleLock,
    setLockBulk,
    candidateCp,
    cpDelta,
    currentScore,
    baseScore,
    contributionCp,
    equipmentAdvancementOption,
    ownedEquipment,
    advanceEquipment,
    craftEquipmentSetPiece,
    startAffixChange,
    resolveAffixChange,
    quoteEnhance,
    enhance,
    autoEnhance,
    autoEnhanceAll,
  };
});
