/** 设置与存档管理领域 store。 */
import { computed } from 'vue';
import { defineStore } from 'pinia';
import type { SaveData } from '@/save/schema';
import { useGameStore } from './game';

export const useSettingsStore = defineStore('settings', () => {
  const game = useGameStore();

  const settings = computed(() => game.save?.settings ?? null);
  const saveData = computed(() => game.save);
  const saveError = computed(() => game.saveError);

  function importSave(data: SaveData): void {
    game.loadFrom(data);
  }

  function setHaptics(enabled: boolean): boolean {
    return game.setHaptics(enabled);
  }

  return {
    settings,
    saveData,
    saveError,
    persist: game.persist,
    importSave,
    setHaptics,
    reset: game.resetGame,
  };
});
