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
