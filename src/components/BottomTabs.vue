<script setup lang="ts">
import { useUiStore, type TabKey } from '@/stores/ui';

const ui = useUiStore();

const tabs: { key: TabKey; label: string; icon: string }[] = [
  { key: 'idle', label: '挂机', icon: '⚔' },
  { key: 'bag', label: '背包', icon: '🎒' },
  { key: 'growth', label: '养成', icon: '✨' },
  { key: 'dungeon', label: '副本', icon: '🏰' },
  { key: 'more', label: '更多', icon: '☰' },
];
</script>

<template>
  <nav class="tabbar">
    <button
      v-for="tab in tabs"
      :key="tab.key"
      class="tab"
      :class="{ active: ui.activeTab === tab.key }"
      @click="ui.setTab(tab.key)"
    >
      <span class="icon">{{ tab.icon }}</span>
      <span class="label">{{ tab.label }}</span>
      <!-- 红点占位，M3-11 接入红点系统 -->
    </button>
  </nav>
</template>

<style scoped>
.tabbar {
  display: flex;
  height: calc(var(--tabbar-h) + var(--sab));
  padding-bottom: var(--sab);
  background: var(--bg-panel);
  border-top: 1px solid rgb(167 139 250 / 15%);
  flex-shrink: 0;
}

.tab {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 2px;
  color: var(--text-faint);
  transition: color 0.15s;
  position: relative;
}

.tab.active {
  color: var(--accent);
}

.tab.active::before {
  content: '';
  position: absolute;
  top: 0;
  left: 50%;
  transform: translateX(-50%);
  width: 24px;
  height: 2px;
  border-radius: 0 0 2px 2px;
  background: var(--accent);
}

.icon {
  font-size: 18px;
  line-height: 1;
}

.label {
  font-size: 10px;
}
</style>
