/**
 * 玩家领域 store。
 *
 * game store 负责统一时钟与持久化，这里只向 UI 暴露玩家相关状态和动作，
 * 避免页面直接依赖一整个巨型 store。后续技能、宠物接入时也从这里扩展。
 */
import { computed } from 'vue';
import { defineStore } from 'pinia';
import type { ClassId } from '@/core/types';
import { useGameStore, type ClassSwitchResult } from './game';

export const usePlayerStore = defineStore('player', () => {
  const game = useGameStore();

  const player = computed(() => game.player);
  const finalStats = computed(() => game.finalStats);
  const cp = computed(() => game.cp);
  const cpDelta = computed(() => game.cpDelta);
  const expNeeded = computed(() => game.expNeeded);
  const expPercent = computed(() => game.expPercent);
  const staminaMax = computed(() => game.staminaMax);

  function create(name: string, classId: ClassId): Promise<void> {
    return game.startNewGame(name, classId);
  }

  function switchClass(classId: ClassId): Promise<ClassSwitchResult> {
    return game.switchClass(classId);
  }

  return {
    player,
    finalStats,
    cp,
    cpDelta,
    expNeeded,
    expPercent,
    staminaMax,
    create,
    switchClass,
  };
});
