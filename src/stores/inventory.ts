/** 背包与装备领域 store。 */
import { computed } from 'vue';
import { defineStore } from 'pinia';
import type { EquipSlot, EquipmentInstance } from '@/core/types';
import { useGameStore } from './game';

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

  function decompose(uids: string[]): { count: number; gold: number } {
    return game.decompose(uids);
  }

  function toggleLock(uid: string): void {
    game.toggleLock(uid);
  }

  function candidateCp(inst: EquipmentInstance): number {
    return game.equipmentCandidateCp(inst);
  }

  function cpDelta(inst: EquipmentInstance): number {
    return game.equipmentCpDelta(inst);
  }

  function contributionCp(inst: EquipmentInstance): number {
    return game.equipmentContributionCp(inst);
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
    candidateCp,
    cpDelta,
    contributionCp,
  };
});
