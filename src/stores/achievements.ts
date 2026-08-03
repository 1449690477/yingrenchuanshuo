import { computed } from 'vue';
import { defineStore } from 'pinia';
import { evaluateAchievements, type AchievementEvaluation } from '@/core/achievements';
import { buildAchievementInput, createAchievementInput } from '@/core/achievementSnapshot';
import { useGameStore } from './game';

/** M4-7 成就聚合：从存档快照装配派生数据 → core 纯函数评估（计数类待 v27 stats 字段）。 */
export const useAchievementStore = defineStore('achievements', () => {
  const game = useGameStore();

  const evaluation = computed<AchievementEvaluation>(() =>
    evaluateAchievements(
      game.save ? buildAchievementInput(game.save, game.cp) : createAchievementInput(),
    ),
  );

  return { evaluation };
});
