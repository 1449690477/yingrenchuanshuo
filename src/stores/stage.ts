/** 关卡与挂机领域 store。 */
import { computed } from 'vue';
import { defineStore } from 'pinia';
import { useGameStore } from './game';

export const useStageStore = defineStore('stage', () => {
  const game = useGameStore();

  const current = computed(() => game.currentStage);
  const cleared = computed(() => game.currentCleared);
  const kills = computed(() => game.currentStageKills);
  const killTarget = computed(() => game.currentKillTarget);
  const cpRatio = computed(() => game.cpRatio);
  const canIdle = computed(() => game.canIdle);
  const kps = computed(() => game.kps);
  const lootLog = computed(() => game.lootLog);
  const battleProgress = computed(() => game.battleProgress);
  const battlePulse = computed(() => game.battlePulse);
  const playerBattleHp = computed(() => game.playerBattleHp);
  const incomingBattlePulse = computed(() => game.incomingBattlePulse);
  const offlineResult = computed(() => game.offlineResult);

  return {
    current,
    cleared,
    kills,
    killTarget,
    cpRatio,
    canIdle,
    kps,
    lootLog,
    battleProgress,
    battlePulse,
    playerBattleHp,
    incomingBattlePulse,
    offlineResult,
    select: game.selectStage,
    advance: game.advanceStage,
    isUnlocked: game.isStageUnlocked,
    takeTutorial: game.takeTutorial,
    dismissOffline: game.dismissOffline,
  };
});
