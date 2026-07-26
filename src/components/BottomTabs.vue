<script setup lang="ts">
import type { Component } from 'vue';
import { Backpack, Castle, Menu, Sparkles, Swords } from '@lucide/vue';
import { useUiStore, type TabKey } from '@/stores/ui';

const ui = useUiStore();

const tabs: { key: TabKey; label: string; icon: Component }[] = [
  { key: 'idle', label: '挂机', icon: Swords },
  { key: 'bag', label: '背包', icon: Backpack },
  { key: 'growth', label: '养成', icon: Sparkles },
  { key: 'dungeon', label: '副本', icon: Castle },
  { key: 'more', label: '更多', icon: Menu },
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
      <span class="icon">
        <component :is="tab.icon" :size="19" :stroke-width="2.2" aria-hidden="true" />
      </span>
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
  background: rgb(255 255 255 / 94%);
  border-top: 1px solid var(--line);
  box-shadow: 0 -3px 12px rgb(122 165 200 / 8%);
  flex-shrink: 0;
}

.tab {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 2px;
  color: var(--text-dim);
  transition: color 0.15s;
  position: relative;
}

.tab.active {
  color: var(--pink-deep);
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
  background: linear-gradient(90deg, var(--pink), var(--blue));
}

.icon {
  display: grid;
  place-items: center;
  width: 22px;
  height: 22px;
  transition: transform 0.16s ease;
}

.tab.active .icon {
  transform: translateY(-1px) scale(1.08);
}

.label {
  font-size: 10px;
}
</style>
