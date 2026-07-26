<script setup lang="ts">
import { computed, onMounted, onUnmounted } from 'vue';
import { useUiStore } from '@/stores/ui';
import { useGameStore } from '@/stores/game';

import TopBar from '@/components/TopBar.vue';
import BottomTabs from '@/components/BottomTabs.vue';
import OfflineModal from '@/components/OfflineModal.vue';

import CreateView from '@/views/CreateView.vue';
import IdleView from '@/views/IdleView.vue';
import BagView from '@/views/BagView.vue';
import GrowthView from '@/views/GrowthView.vue';
import DungeonView from '@/views/DungeonView.vue';
import MoreView from '@/views/MoreView.vue';

const ui = useUiStore();
const game = useGameStore();

const views = {
  idle: IdleView,
  bag: BagView,
  growth: GrowthView,
  dungeon: DungeonView,
  more: MoreView,
} as const;

const currentView = computed(() => views[ui.activeTab]);

/** 前后台切换必须走离线结算，不能让暂停的 rAF 丢时间或重复结算。 */
function onVisibility() {
  if (document.visibilityState === 'hidden') game.pauseForBackground();
  else game.resumeFromBackground();
}

function onPageHide() {
  game.pauseForBackground();
}

onMounted(() => {
  void game.init();
  document.addEventListener('visibilitychange', onVisibility);
  window.addEventListener('pagehide', onPageHide);
});

onUnmounted(() => {
  game.stopLoop();
  document.removeEventListener('visibilitychange', onVisibility);
  window.removeEventListener('pagehide', onPageHide);
});
</script>

<template>
  <div class="shell">
    <!-- 存档读取中 -->
    <div v-if="!game.loaded" class="boot">
      <div class="boot-logo">樱刃传说</div>
      <div class="boot-tip">读取存档中…</div>
    </div>

    <div v-else-if="game.loadError" class="boot load-failed">
      <div class="boot-logo">存档读取失败</div>
      <p class="boot-error">{{ game.loadError }}</p>
      <p class="boot-tip">
        为避免覆盖你的进度，游戏没有自动创建新角色。请刷新重试或联系开发者处理存档。
      </p>
    </div>

    <!-- 还没有角色 -->
    <CreateView v-else-if="!game.hasSave" />

    <!-- 主界面 -->
    <template v-else>
      <TopBar />
      <main class="main scroll-y">
        <component :is="currentView" />
      </main>
      <BottomTabs />
      <OfflineModal />
    </template>
  </div>
</template>

<style scoped>
.shell {
  display: flex;
  flex-direction: column;
  height: 100dvh;
  position: relative;
}

.main {
  flex: 1;
  min-height: 0;
  padding: 12px;
}

.boot {
  height: 100dvh;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8px;
}

.boot-logo {
  font-size: 26px;
  font-weight: 800;
  letter-spacing: 2px;
  background: linear-gradient(120deg, var(--pink-deep), var(--blue-deep));
  -webkit-background-clip: text;
  background-clip: text;
  color: transparent;
}

.boot-tip {
  font-size: 11px;
  color: var(--text-dim);
}

.load-failed {
  padding: 24px;
  text-align: center;
}

.boot-error {
  max-width: 340px;
  padding: 10px 12px;
  font-size: 11px;
  color: var(--danger);
  background: #ffeef0;
  border-radius: var(--r-sm);
  user-select: text;
}
</style>
