<script setup lang="ts">
import { computed } from 'vue';
import { useUiStore } from '@/stores/ui';
import TopBar from '@/components/TopBar.vue';
import BottomTabs from '@/components/BottomTabs.vue';
import IdleView from '@/views/IdleView.vue';
import BagView from '@/views/BagView.vue';
import GrowthView from '@/views/GrowthView.vue';
import DungeonView from '@/views/DungeonView.vue';
import MoreView from '@/views/MoreView.vue';

const ui = useUiStore();

const views = {
  idle: IdleView,
  bag: BagView,
  growth: GrowthView,
  dungeon: DungeonView,
  more: MoreView,
} as const;

const currentView = computed(() => views[ui.activeTab]);
</script>

<template>
  <div class="shell">
    <TopBar />
    <main class="main scroll-y">
      <component :is="currentView" />
    </main>
    <BottomTabs />
  </div>
</template>

<style scoped>
.shell {
  display: flex;
  flex-direction: column;
  height: 100dvh;
}

.main {
  flex: 1;
  min-height: 0;
  padding: 12px;
}
</style>
