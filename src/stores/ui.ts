import { defineStore } from 'pinia';
import { ref } from 'vue';

export type TabKey = 'idle' | 'bag' | 'growth' | 'dungeon' | 'rank' | 'more';

export const useUiStore = defineStore('ui', () => {
  const activeTab = ref<TabKey>('idle');

  function setTab(tab: TabKey) {
    activeTab.value = tab;
  }

  return { activeTab, setTab };
});
