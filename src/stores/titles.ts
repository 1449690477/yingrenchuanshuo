import { computed } from 'vue';
import { defineStore } from 'pinia';
import { evaluateUnlockedTitles, isTitleEquippable, type TitleResult } from '@/core/titles';
import { buildAchievementInput, createAchievementInput } from '@/core/achievementSnapshot';
import { useGameStore } from './game';

/** M4-9 称号聚合：与成就共用统计快照 → core 纯函数解锁判定（装备态字段待版本号安排）。 */
export const useTitleStore = defineStore('titles', () => {
  const game = useGameStore();

  const unlockedTitles = computed<readonly TitleResult[]>(() =>
    evaluateUnlockedTitles(
      game.save ? buildAchievementInput(game.save, game.cp) : createAchievementInput(),
    ),
  );

  const unlockedIds = computed<ReadonlySet<string>>(
    () => new Set(unlockedTitles.value.filter((title) => title.unlocked).map((title) => title.id)),
  );

  function canEquip(titleId: string): boolean {
    return isTitleEquippable(titleId, unlockedIds.value);
  }

  return { unlockedTitles, unlockedIds, canEquip };
});
