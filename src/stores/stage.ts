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
  /** 击杀演出期间让旧目标完整归零，演出结束后再显示下一只的剩余进度。 */
  const battleProgress = computed(() => (game.battlePulse ? 1 : game.battleProgress));
  const battlePulse = computed(() => game.battlePulse);
  const battleTargetId = computed(() => game.battleTargetId);
  const offlineResult = computed(() => game.offlineResult);
  const pendingEncounters = computed(() => game.pendingEncounters);

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
    battleTargetId,
    offlineResult,
    pendingEncounters,
    select: game.selectStage,
    advance: game.advanceStage,
    isUnlocked: game.isStageUnlocked,
    takeTutorial: game.takeTutorial,
    resolveEncounter: game.resolvePendingEncounter,
    dismissOffline: game.dismissOffline,
  };
});
