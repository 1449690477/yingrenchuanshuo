import { computed } from 'vue';
import { defineStore } from 'pinia';
import { evaluateUnlockedTitles, isTitleEquippable, type TitleResult } from '@/core/titles';
import { buildAchievementInput, createAchievementInput } from '@/core/achievementSnapshot';
import { TITLES } from '@/data/titles';
import { useGameStore } from './game';

/** M4-9 称号聚合：与成就共用统计快照 → core 纯函数解锁判定；装备位随 v29 存档持久化。 */
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

  const equippedTitleId = computed<string | null>(() => game.save?.equippedTitleId ?? null);

  const equippedTitle = computed(() =>
    equippedTitleId.value
      ? (TITLES.find((title) => title.id === equippedTitleId.value) ?? null)
      : null,
  );

  function canEquip(titleId: string): boolean {
    return isTitleEquippable(titleId, unlockedIds.value);
  }

  /** 装备称号：只允许已解锁称号（core 校验），纯展示不产生任何属性/乘区/CP 变化。 */
  function equip(titleId: string): boolean {
    if (!game.save || !canEquip(titleId)) return false;
    game.save.equippedTitleId = titleId;
    void game.persist();
    return true;
  }

  function unequip(): boolean {
    if (!game.save) return false;
    game.save.equippedTitleId = null;
    void game.persist();
    return true;
  }

  return { unlockedTitles, unlockedIds, equippedTitleId, equippedTitle, canEquip, equip, unequip };
});
