/** 设置与存档管理领域 store。 */
import { computed } from 'vue';
import { defineStore } from 'pinia';
import type { SaveData } from '@/save/schema';
import type { Quality } from '@/core/types';
import { useGameStore } from './game';

export const useSettingsStore = defineStore('settings', () => {
  const game = useGameStore();

  const settings = computed(() => game.save?.settings ?? null);
  const saveData = computed(() => game.save);
  const saveError = computed(() => game.saveError);
  const integrityStatus = computed(() => game.saveIntegrityStatus);

  function importSave(data: SaveData): void {
    game.loadFrom(data, 'imported');
  }

  function setHaptics(enabled: boolean): boolean {
    return game.setHaptics(enabled);
  }

  function setReduceMotion(enabled: boolean): boolean {
    return game.setReduceMotion(enabled);
  }

  /** 音效总开关（M4-11）：语音与音效同生共死，默认开。 */
  function setSfx(enabled: boolean): boolean {
    return game.setSfx(enabled);
  }

  /** 背景音乐开关（M4-11）：默认关。 */
  function setBgm(enabled: boolean): boolean {
    return game.setBgm(enabled);
  }

  function setAutoDecomposeBelow(threshold: Quality | 'none'): boolean {
    return game.setAutoDecomposeBelow(threshold);
  }

  function setVisualQuality(quality: 'standard' | 'lite'): boolean {
    return game.setVisualQuality(quality);
  }

  return {
    settings,
    saveData,
    saveError,
    integrityStatus,
    persist: game.persist,
    importSave,
    setHaptics,
    setReduceMotion,
    setSfx,
    setBgm,
    setAutoDecomposeBelow,
    setVisualQuality,
    reset: game.resetGame,
  };
});
