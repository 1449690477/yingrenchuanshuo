import { computed } from 'vue';
import { defineStore } from 'pinia';
import { businessDayKey } from '@/core/dayKey';
import { nextClaimableTier } from '@/core/dailyTasks';
import {
  countPendingAffix,
  evaluateRedDots,
  isEnhanceable,
  type RedDotState,
} from '@/core/redDots';
import { assessSkillUpgrade } from '@/core/skillUpgrade';
import { DAILY_STAMINA_CLAIM_MAX, SLOT_ORDER } from '@/data/constants';
import { requireEquipment } from '@/data/equipment';
import { SKILL_UPGRADE_RULES } from '@/data/skillUpgradeRules';
import { skillsFor } from '@/data/skills';
import { useGameStore } from './game';
import { useProgressBoardStore } from './progressBoard';

/** M3-11 · 信息型红点聚合：从各 store 取存档快照 → core 纯函数判定 → 六 tab 布尔。 */
export const useRedDotStore = defineStore('redDots', () => {
  const game = useGameStore();
  const progressBoard = useProgressBoardStore();

  const dots = computed<RedDotState>(() => {
    const save = game.save;
    if (!save) {
      return { idle: false, bag: false, growth: false, dungeon: false, rank: false, more: false };
    }

    const wallet = { gold: save.player.gold, items: save.bag.items };
    const today = businessDayKey(Date.now());
    const claimedToday = save.player.staminaClaimDay === today;
    const staminaClaimRemaining = claimedToday
      ? DAILY_STAMINA_CLAIM_MAX - save.player.staminaClaimCount
      : DAILY_STAMINA_CLAIM_MAX;

    const enhanceableEquipped = SLOT_ORDER.reduce((count, slot) => {
      const instance = save.equipped[slot];
      if (!instance) return count;
      const definition = requireEquipment(instance.defId);
      return isEnhanceable(instance, definition.level, wallet) ? count + 1 : count;
    }, 0);

    const skillUpgradeable = skillsFor(save.player.classId).filter(
      (skill) =>
        assessSkillUpgrade(
          skill,
          save.player.level,
          save.player.skillLevels,
          wallet,
          SKILL_UPGRADE_RULES,
        ).reason === null,
    ).length;

    return evaluateRedDots({
      staminaClaimRemaining,
      pendingEncounterCount: save.encounters.pending.length,
      pendingAffixCount: countPendingAffix(save.equipped, save.bag.equipment),
      enhanceableEquipped,
      skillUpgradeable,
      dungeonAttemptsRemaining: game.equipmentDungeonRemaining,
      affectionInteractionsRemaining: game.affectionInteractionsRemaining,
      hasUnsyncedProgress: progressBoard.hasUnsyncedProgress,
      pendingMilestoneCount: save.milestones.filter((entry) => !entry.submitted).length,
      guildClaimableCount: 0,
      dailyTierClaimable: save.dailyTasks
        ? nextClaimableTier(save.dailyTasks, Date.now()) !== null
        : false,
    });
  });

  return { dots };
});
