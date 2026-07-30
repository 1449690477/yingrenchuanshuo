<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue';
import { useUiStore } from '@/stores/ui';
import { useGameStore } from '@/stores/game';

import TopBar from '@/components/TopBar.vue';
import BottomTabs from '@/components/BottomTabs.vue';
import OfflineModal from '@/components/OfflineModal.vue';
import DefeatReport from '@/components/DefeatReport.vue';
import SakuraField from '@/components/SakuraField.vue';
import PwaUpdatePrompt from '@/components/PwaUpdatePrompt.vue';

import CreateView from '@/views/CreateView.vue';
import IdleView from '@/views/IdleView.vue';
import BagView from '@/views/BagView.vue';
import GrowthView from '@/views/GrowthView.vue';
import DungeonView from '@/views/DungeonView.vue';
import RankView from '@/views/RankView.vue';
import MoreView from '@/views/MoreView.vue';

const ui = useUiStore();
const game = useGameStore();
const mainEl = ref<HTMLElement | null>(null);

const views = {
  idle: IdleView,
  bag: BagView,
  growth: GrowthView,
  dungeon: DungeonView,
  rank: RankView,
  more: MoreView,
} as const;

const currentView = computed(() => views[ui.activeTab]);

/** 切换分页时把滚动条送回顶部，新视图不该继承旧视图的滚动位置。 */
watch(
  () => ui.activeTab,
  async () => {
    await nextTick();
    mainEl.value?.scrollTo({ top: 0 });
  },
);

/** 前后台切换必须走离线结算，不能让暂停的 rAF 丢时间或重复结算。 */
function onVisibility() {
  if (document.visibilityState === 'hidden') game.pauseForBackground();
  else game.resumeFromBackground();
}

function onPageHide() {
  game.pauseForBackground();
}

function onPageShow() {
  if (game.loaded && document.visibilityState !== 'hidden') game.resumeFromBackground();
}

onMounted(() => {
  void game.init();
  document.addEventListener('visibilitychange', onVisibility);
  window.addEventListener('pagehide', onPageHide);
  window.addEventListener('pageshow', onPageShow);
});

onUnmounted(() => {
  game.stopLoop();
  document.removeEventListener('visibilitychange', onVisibility);
  window.removeEventListener('pagehide', onPageHide);
  window.removeEventListener('pageshow', onPageShow);
});
</script>

<template>
  <div class="shell">
    <!-- 全局氛围粒子：樱花瓣与柔光斑，始终垫在最底下 -->
    <SakuraField />

    <!-- 存档读取中 -->
    <div v-if="!game.loaded" class="boot">
      <div class="boot-logo">樱刃传说</div>
      <div class="boot-spinner" aria-hidden="true"><i /><i /><i /><i /></div>
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
      <main ref="mainEl" class="main scroll-y">
        <Transition name="view-switch" mode="out-in">
          <component :is="currentView" :key="ui.activeTab" />
        </Transition>
      </main>
      <BottomTabs />
      <OfflineModal />
      <!-- 战败战报：全局单值弹层，与离线结算同级（docs/57 K3） -->
      <DefeatReport />
    </template>
    <PwaUpdatePrompt />
  </div>
</template>

<style scoped>
.shell {
  isolation: isolate;
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

/* 小屏手机把外框边距也让出来，内容区多一指的宽度 */
@media (max-width: 350px), (max-height: 700px) {
  .main {
    padding: 8px;
  }
}

.boot {
  height: 100dvh;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 14px;
}

.boot-logo {
  font-size: 26px;
  font-weight: 800;
  letter-spacing: 2px;
  background: linear-gradient(120deg, var(--pink-deep), var(--blue-deep));
  -webkit-background-clip: text;
  background-clip: text;
  color: transparent;
  animation: boot-breathe 2.4s ease-in-out infinite;
}

/* 四瓣樱花旋转 loading */
.boot-spinner {
  position: relative;
  width: 34px;
  height: 34px;
  animation: boot-spin 1.8s cubic-bezier(0.62, 0.12, 0.38, 0.88) infinite;
}

.boot-spinner i {
  position: absolute;
  width: 12px;
  height: 12px;
  background: linear-gradient(140deg, #ffc9dd, var(--pink));
  border-radius: 82% 18% 70% 30%;
  box-shadow: 0 0 6px rgb(255 158 196 / 55%);
}

.boot-spinner i:nth-child(1) {
  left: 50%;
  top: 0;
  transform: translateX(-50%);
}

.boot-spinner i:nth-child(2) {
  right: 0;
  top: 50%;
  transform: translateY(-50%) rotate(90deg);
}

.boot-spinner i:nth-child(3) {
  left: 50%;
  bottom: 0;
  transform: translateX(-50%) rotate(180deg);
}

.boot-spinner i:nth-child(4) {
  left: 0;
  top: 50%;
  transform: translateY(-50%) rotate(270deg);
}

.boot-tip {
  font-size: 11px;
  color: var(--text-dim);
}

.load-failed {
  padding: 24px;
  text-align: center;
}

.load-failed .boot-logo {
  animation: none;
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

@keyframes boot-breathe {
  0%,
  100% {
    opacity: 0.75;
    transform: scale(1);
  }
  50% {
    opacity: 1;
    transform: scale(1.04);
  }
}

@keyframes boot-spin {
  0% {
    transform: rotate(0deg);
  }
  100% {
    transform: rotate(360deg);
  }
}

@media (prefers-reduced-motion: reduce) {
  .boot-logo,
  .boot-spinner {
    animation: none;
  }
}
</style>
