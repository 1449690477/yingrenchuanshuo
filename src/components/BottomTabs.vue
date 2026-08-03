<script setup lang="ts">
import { computed, type Component } from 'vue';
import { Backpack, Castle, Menu, Sparkles, Swords, Trophy } from '@lucide/vue';
import { useUiStore, type TabKey } from '@/stores/ui';
import { useGameStore } from '@/stores/game';
import { redDotState, type RedDotKey } from '@/core/redDots';
import RedDot from './RedDot.vue';

const ui = useUiStore();
const game = useGameStore();

const tabs: { key: TabKey; redDotKey: RedDotKey; label: string; icon: Component }[] = [
  { key: 'idle', redDotKey: 'idle', label: '挂机', icon: Swords },
  { key: 'bag', redDotKey: 'bag', label: '背包', icon: Backpack },
  { key: 'growth', redDotKey: 'growth', label: '养成', icon: Sparkles },
  { key: 'dungeon', redDotKey: 'dungeon', label: '副本', icon: Castle },
  { key: 'rank', redDotKey: 'rank', label: '排行', icon: Trophy },
  { key: 'more', redDotKey: 'more', label: '更多', icon: Menu },
];

/** M3-11 红点：从存档/商店可读状态推导 6 个 tab 的提示开关。 */
const redDots = computed(() => {
  const saveData = game.save;
  if (!saveData) {
    return { idle: false, bag: false, growth: false, dungeon: false, rank: false, more: false };
  }
  return redDotState({
    pendingEncounters: saveData.encounters.pending.length,
    pendingAffixCount: saveData.bag.equipment.filter((inst) => inst.pendingAffixChange).length,
    dungeonAttemptsRemaining: game.equipmentDungeonRemaining,
    pendingMilestones: saveData.milestones.filter((entry) => !entry.submitted).length,
    affectionRemaining: game.affectionRemaining,
  });
});

const activeIndex = computed(() => tabs.findIndex((t) => t.key === ui.activeTab));
</script>

<template>
  <nav class="tabbar" :style="{ '--tab-count': tabs.length }">
    <!-- 跟随激活项滑动的粉晕胶囊 -->
    <span class="active-pill" :style="{ '--pill-x': activeIndex }" aria-hidden="true" />
    <button
      v-for="tab in tabs"
      :key="tab.key"
      class="tab"
      :class="{ active: ui.activeTab === tab.key }"
      @click="ui.setTab(tab.key)"
    >
      <span class="icon">
        <component :is="tab.icon" :size="19" :stroke-width="2.2" aria-hidden="true" />
        <RedDot v-if="redDots[tab.redDotKey]" />
      </span>
      <span class="label">{{ tab.label }}</span>
      <!-- 红点占位，M3-11 接入红点系统 -->
    </button>
  </nav>
</template>

<style scoped>
.tabbar {
  position: relative;
  display: flex;
  height: calc(var(--tabbar-h) + var(--sab));
  padding-bottom: var(--sab);
  background: rgb(255 255 255 / 94%);
  border-top: 1px solid var(--line);
  box-shadow: 0 -3px 12px rgb(122 165 200 / 8%);
  flex-shrink: 0;
}

/* 激活胶囊：在等分 tab 之间弹簧滑动 */
.active-pill {
  position: absolute;
  top: 6px;
  bottom: calc(6px + var(--sab));
  left: 0;
  z-index: 0;
  width: calc(100% / var(--tab-count, 5));
  border-radius: 14px;
  background:
    radial-gradient(120% 130% at 50% 0%, rgb(255 190 216 / 46%), transparent 62%),
    linear-gradient(180deg, rgb(255 234 242 / 82%), rgb(255 234 242 / 34%));
  box-shadow: inset 0 0 0 1px rgb(255 158 196 / 22%);
  transform: translateX(calc(var(--pill-x) * 100%));
  transition: transform var(--t-slow) var(--ease-spring);
  pointer-events: none;
}

.tab {
  position: relative;
  z-index: 1;
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 2px;
  color: var(--text-dim);
  transition: color var(--t-mid) var(--ease-soft);
}

.tab:active .icon {
  position: relative;
  transform: scale(0.86);
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
  position: relative;
  display: grid;
  place-items: center;
  width: 22px;
  height: 22px;
  transition: transform var(--t-mid) var(--ease-spring);
}

.tab.active .icon {
  position: relative;
  transform: translateY(-2px) scale(1.14);
  animation: icon-pop var(--t-slow) var(--ease-out-back);
}

.label {
  font-size: 10px;
  transition:
    font-weight var(--t-mid),
    letter-spacing var(--t-mid);
}

.tab.active .label {
  font-weight: 700;
  letter-spacing: 0.5px;
}

@keyframes icon-pop {
  0% {
    transform: translateY(1px) scale(0.82);
  }
  60% {
    transform: translateY(-3px) scale(1.2);
  }
  100% {
    transform: translateY(-2px) scale(1.14);
  }
}

@media (prefers-reduced-motion: reduce) {
  .active-pill,
  .tab,
  .icon,
  .label {
    transition-duration: 0.01s;
  }

  .tab.active .icon {
  position: relative;
    animation: none;
  }
}
</style>
