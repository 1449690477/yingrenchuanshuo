<script setup lang="ts">
/**
 * 称号展示面板（M4-9 展示侧）。
 *
 * 按数值线裁定（2026-08-03）：称号 = 纯展示身份系统，零属性、零乘区、零 CP。
 * 只读展示解锁态与进度；装备态字段（equippedTitleId）待版本号安排后接入。
 */
import { computed } from 'vue';
import { ChevronLeft } from '@lucide/vue';
import { TITLES } from '@/data/titles';
import type { TitleResult } from '@/core/titles';
import type { AchievementCategory, AchievementStat } from '@/core/achievements';

const props = withDefaults(
  defineProps<{
    unlockedTitles: readonly TitleResult[];
    equippedTitleId?: string | null;
  }>(),
  { equippedTitleId: null },
);
const emit = defineEmits<{
  (e: 'close'): void;
  (e: 'equip', titleId: string): void;
  (e: 'unequip'): void;
}>();

const STAT_CATEGORY: Record<AchievementStat, AchievementCategory> = {
  totalKills: 'battle',
  bossKillKinds: 'battle',
  bossKills: 'battle',
  level: 'growth',
  cp: 'growth',
  gold: 'growth',
  equipmentCodexCount: 'collect',
  monsterCodexCount: 'collect',
  epicCount: 'collect',
  legendaryCount: 'collect',
  totalCodexCount: 'collect',
  clearedChapterCount: 'explore',
  clearedStageCount: 'explore',
  enhanceCount: 'cultivate',
  reforgeCount: 'cultivate',
  sweepCount: 'cultivate',
  affectionCount: 'cultivate',
  arenaCount: 'cultivate',
  dungeonCount: 'cultivate',
};

const CATEGORY_LABELS: Record<AchievementCategory, string> = {
  battle: '击杀',
  growth: '成长',
  collect: '收集',
  explore: '探索',
  cultivate: '养成',
};

const CATEGORY_ORDER: readonly AchievementCategory[] = [
  'battle',
  'growth',
  'collect',
  'explore',
  'cultivate',
];

const resultById = computed(
  () => new Map(props.unlockedTitles.map((result) => [result.id, result])),
);

const total = TITLES.length;
const unlockedCount = computed(
  () => props.unlockedTitles.filter((title) => title.unlocked).length,
);

const groups = computed(() =>
  CATEGORY_ORDER.map((category) => {
    const items = TITLES.filter(
      (def) => STAT_CATEGORY[def.stat] === category,
    ).map((def) => {
      const result = resultById.value.get(def.id);
      return {
        def,
        unlocked: result?.unlocked ?? false,
        progress: result?.progress ?? 0,
      };
    });
    return {
      category,
      label: CATEGORY_LABELS[category],
      items,
      unlockedCount: items.filter((item) => item.unlocked).length,
    };
  }).filter((group) => group.items.length > 0),
);
</script>

<template>
  <div class="titles-view">
    <header class="title-top">
      <button type="button" class="title-back" aria-label="返回" @click="emit('close')">
        <ChevronLeft :size="18" />
      </button>
      <span class="title-top-copy">
        <small>身份标识 · 纯展示</small>
        <strong>称号</strong>
      </span>
      <span class="title-top-count" aria-label="称号总进度">
        {{ unlockedCount }}/{{ total }}
      </span>
    </header>

    <header class="title-summary">
      <div>
        <h2>称号</h2>
        <p class="peek-note">达成成就获得的身份标识 · 纯展示，不提供属性</p>
      </div>
      <div class="summary-nums">
        <strong>{{ unlockedCount }}<small> / {{ total }}</small></strong>
        <span>已解锁</span>
      </div>
    </header>

    <section v-for="group in groups" :key="group.category" class="title-group">
      <h3 class="group-title">
        {{ group.label }}
        <span>{{ group.unlockedCount }} / {{ group.items.length }}</span>
      </h3>
      <ul class="title-list">
        <li
          v-for="{ def, unlocked, progress } in group.items"
          :key="def.id"
          class="title-item"
          :class="{ unlocked, equipped: equippedTitleId === def.id }"
        >
          <div class="item-head">
            <strong>{{ def.name }}</strong>
            <span class="state">{{ unlocked ? '已解锁' : '未解锁' }}</span>
          </div>
          <p class="desc">{{ def.description }}</p>
          <div class="bar" aria-hidden="true">
            <i :style="{ width: `${Math.min(100, (progress / def.target) * 100)}%` }" />
          </div>
          <span class="progress-num">{{ progress }} / {{ def.target }}</span>
          <div class="item-actions">
            <button
              v-if="unlocked && equippedTitleId !== def.id"
              type="button"
              class="equip-btn"
              @click="emit('equip', def.id)"
            >
              装备
            </button>
            <span v-if="equippedTitleId === def.id" class="equipped-badge">已装备</span>
            <button
              v-if="equippedTitleId === def.id"
              type="button"
              class="equip-btn ghost"
              @click="emit('unequip')"
            >
              卸下
            </button>
          </div>
        </li>
      </ul>
    </section>
  </div>
</template>

<style scoped>
.titles-view {
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 0 0 16px;
}

.title-top {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 14px 14px 0;
}

.title-back {
  display: grid;
  place-items: center;
  width: 38px;
  height: 38px;
  color: var(--text-mid, #5a6480);
  background: rgb(255 255 255 / 64%);
  border: 1px solid rgb(200 208 235 / 55%);
  border-radius: 12px;
}

.title-top-copy {
  display: flex;
  flex-direction: column;
  gap: 1px;
}

.title-top-copy small {
  font-size: 10px;
  color: var(--text-dim, #7b8499);
}

.title-top-copy strong {
  font-size: 17px;
  color: var(--text-main, #2e3550);
}

.title-top-count {
  margin-left: auto;
  padding: 4px 10px;
  font-size: 13px;
  font-weight: 700;
  color: #d65f8f;
  background: #ffe8f1;
  border-radius: 999px;
}

.title-summary {
  display: grid;
  gap: 8px;
  padding: 14px;
  background: linear-gradient(150deg, rgb(255 255 255 / 72%), rgb(244 241 255 / 58%));
  border: 1px solid rgb(190 200 235 / 62%);
  border-radius: 16px;
  backdrop-filter: blur(8px);
}

.title-summary h2 {
  margin: 0;
  font-size: 18px;
  color: var(--text-main, #2e3550);
}

.peek-note {
  margin: 2px 0 0;
  font-size: 11px;
  line-height: 1.6;
  color: var(--text-dim, #7b8499);
}

.summary-nums {
  display: flex;
  align-items: baseline;
  gap: 6px;
}

.summary-nums strong {
  font-size: 22px;
  color: #ff7da7;
}

.summary-nums small {
  font-size: 14px;
  color: var(--text-dim, #7b8499);
}

.summary-nums span {
  font-size: 12px;
  color: var(--text-mid, #5a6480);
}

.title-group {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.group-title {
  display: flex;
  align-items: baseline;
  gap: 8px;
  margin: 4px 2px 0;
  font-size: 14px;
  color: var(--text-main, #2e3550);
}

.group-title span {
  font-size: 11px;
  color: var(--text-dim, #7b8499);
}

.title-list {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
  gap: 8px;
  margin: 0;
  padding: 0;
  list-style: none;
}

.title-item {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 10px;
  background: rgb(255 255 255 / 62%);
  border: 1px solid rgb(200 208 235 / 55%);
  border-radius: 12px;
}

.title-item.unlocked {
  border-color: rgb(255 171 196 / 65%);
  background: linear-gradient(150deg, rgb(255 240 246 / 72%), rgb(245 241 255 / 62%));
}

.item-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 6px;
}

.item-head strong {
  font-size: 13px;
  color: var(--text-main, #2e3550);
}

.state {
  flex: none;
  padding: 2px 6px;
  font-size: 10px;
  color: #8a93a8;
  background: #eef1f7;
  border-radius: 999px;
}

.unlocked .state {
  color: #d65f8f;
  background: #ffe8f1;
}

.desc {
  margin: 0;
  font-size: 11px;
  line-height: 1.5;
  color: var(--text-dim, #7b8499);
}

.bar {
  height: 4px;
  overflow: hidden;
  background: #e6e9f2;
  border-radius: 999px;
}

.bar i {
  display: block;
  height: 100%;
  background: linear-gradient(90deg, #ff9cbd, #a994ea);
  border-radius: 999px;
}

.progress-num {
  font-size: 10px;
  color: var(--text-dim, #7b8499);
}

.title-item.equipped {
  outline: 1.5px solid rgb(255 156 189 / 72%);
  outline-offset: 1px;
}

.item-actions {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-top: 2px;
}

.equip-btn {
  min-height: 34px;
  padding: 6px 12px;
  font-size: 12px;
  font-weight: 700;
  color: #fff;
  background: linear-gradient(135deg, #ff8fb3, #a994ea);
  border: 0;
  border-radius: 999px;
}

.equip-btn.ghost {
  color: #d65f8f;
  background: #ffe8f1;
}

.equipped-badge {
  padding: 4px 10px;
  font-size: 11px;
  font-weight: 700;
  color: #b75f86;
  background: #fff0f6;
  border: 1px solid #ffd3e4;
  border-radius: 999px;
}

@media (max-width: 360px) {
  .title-list {
    grid-template-columns: 1fr;
  }
}
</style>
