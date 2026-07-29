/**
 * 玩家领域 store。
 *
 * game store 负责统一时钟与持久化，这里只向 UI 暴露玩家相关状态和动作，
 * 避免页面直接依赖一整个巨型 store。后续技能、宠物接入时也从这里扩展。
 */
import { computed } from 'vue';
import { defineStore } from 'pinia';
import type { ClassId } from '@/core/types';
import {
  useGameStore,
  type AffectionGiftActionResult,
  type AffectionInteractionActionResult,
  type AffectionStoryChoiceActionResult,
  type ClassSwitchResult,
} from './game';

export const usePlayerStore = defineStore('player', () => {
  const game = useGameStore();

  const player = computed(() => game.player);
  const finalStats = computed(() => game.finalStats);
  const cp = computed(() => game.cp);
  const cpDelta = computed(() => game.cpDelta);
  const expNeeded = computed(() => game.expNeeded);
  const expPercent = computed(() => game.expPercent);
  const staminaMax = computed(() => game.staminaMax);
  const equipCombatBonuses = computed(() => game.equipCombatBonuses);
  const playerCombatElement = computed(() => game.playerCombatElement);
  const playerSkillMultiplier = computed(() => game.playerSkillMultiplier);
  const playerOnHitTriggers = computed(() => game.equipmentSetResolution.onHitTriggers);
  const affectionState = computed(() => game.affectionState);
  const affectionProgress = computed(() => game.affectionProgress);
  const affectionTier = computed(() => game.affectionTier);
  const affectionRemaining = computed(() => game.affectionRemaining);
  const affectionInteractionsRemaining = computed(() => game.affectionInteractionsRemaining);

  function create(name: string, classId: ClassId): Promise<void> {
    return game.startNewGame(name, classId);
  }

  function switchClass(classId: ClassId): Promise<ClassSwitchResult> {
    return game.switchClass(classId);
  }

  function interactWithCharacter(
    classId: ClassId,
    interactionId: string,
    now?: number,
  ): AffectionInteractionActionResult {
    return game.interactWithCharacter(classId, interactionId, now);
  }

  function giveAffectionGift(
    classId: ClassId,
    giftId: string,
    now?: number,
  ): AffectionGiftActionResult {
    return game.giveAffectionGift(classId, giftId, now);
  }

  function completeAffectionStoryChoice(
    classId: ClassId,
    storyId: string,
    choiceId: string,
  ): AffectionStoryChoiceActionResult {
    return game.completeAffectionStoryChoice(classId, storyId, choiceId);
  }

  return {
    player,
    finalStats,
    cp,
    cpDelta,
    expNeeded,
    expPercent,
    staminaMax,
    equipCombatBonuses,
    playerCombatElement,
    playerSkillMultiplier,
    playerOnHitTriggers,
    affectionState,
    affectionProgress,
    affectionTier,
    affectionRemaining,
    affectionInteractionsRemaining,
    create,
    switchClass,
    interactWithCharacter,
    giveAffectionGift,
    completeAffectionStoryChoice,
  };
});
