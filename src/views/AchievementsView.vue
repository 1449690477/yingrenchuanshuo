<script setup lang="ts">
/**
 * 成就展示面板（M4-7 展示侧）。
 *
 * 只读展示：消费 core 评估结果（props 传入，便于 SSR 测试与后续 MoreView 接线），
 * 全部文本/目标值来自 data/achievements 权威表，不复制数值。
 * 领取交互待 v27 存档字段落地后接入。
 */
import { computed } from 'vue';
import { ACHIEVEMENTS } from '@/data/achievements';
import type { AchievementCategory, AchievementEvaluation } from '@/core/achievements';

const props = defineProps<{ evaluation: AchievementEvaluation }>();

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
  () => new Map(props.evaluation.results.map((result) => [result.id, result])),
);

const total = ACHIEVEMENTS.length;
const unlockedCount = computed(() => props.evaluation.achievedCount);

/** 下一档奖励所需解锁数；满档返回 null。 */
const nextTierAt = computed<number | null>(() => {
  if (unlockedCount.value >= 80) return null;
  return Math.ceil(unlockedCount.value / 20) * 20;
});

const groups = computed(() =>
  CATEGORY_ORDER.map((category) => {
    const items = ACHIEVEMENTS.filter((def) => def.category === category).map((def) => {
      const result = resultById.value.get(def.id);
      return {
        def,
        achieved: result?.achieved ?? false,
        progress: result?.progress ?? 0,
      };
    });
    return {
      category,
      label: CATEGORY_LABELS[category],
      items,
      achievedCount: items.filter((item) => item.achieved).length,
    };
  }),
);
</script>

<template>
  <div class="achievements-view">
    <header class="ach-summary">
      <div>
        <h2>成就</h2>
        <p class="peek-note">长期目标，达成后按档位获得本地 PvE 战斗加成</p>
      </div>
      <div class="summary-nums">
        <strong>{{ unlockedCount }}<small> / {{ total }}</small></strong>
        <span>已解锁</span>
      </div>
      <div class="bonus-row">
        <span>当前加成 +{{ props.evaluation.bonusPercent.toFixed(1) }}%</span>
        <em v-if="nextTierAt !== null">下一档：解锁 {{ nextTierAt }} 条 → +{{ ((nextTierAt / 20) * 0.5).toFixed(1) }}%</em>
        <em v-else>已达上限 +2.0%</em>
      </div>
    </header>

    <section v-for="group in groups" :key="group.category" class="ach-group">
      <h3 class="group-title">
        {{ group.label }}
        <span>{{ group.achievedCount }} / {{ group.items.length }}</span>
      </h3>
      <ul class="ach-list">
        <li
          v-for="{ def, achieved, progress } in group.items"
          :key="def.id"
          class="ach-item"
          :class="{ achieved }"
        >
          <div class="item-head">
            <strong>{{ def.label }}</strong>
            <span class="state">{{ achieved ? '已达成' : '未达成' }}</span>
          </div>
          <p class="desc">{{ def.description }}</p>
          <div class="bar" aria-hidden="true">
            <i :style="{ width: `${Math.min(100, (progress / def.target) * 100)}%` }" />
          </div>
          <span class="progress-num">{{ progress }} / {{ def.target }}</span>
        </li>
      </ul>
    </section>
  </div>
</template>

<style scoped>
.achievements-view {
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 4px 0 16px;
}

.ach-summary {
  display: grid;
  gap: 8px;
  padding: 14px;
  background: linear-gradient(150deg, rgb(255 255 255 / 72%), rgb(244 241 255 / 58%));
  border: 1px solid rgb(190 200 235 / 62%);
  border-radius: 16px;
  backdrop-filter: blur(8px);
}

.ach-summary h2 {
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

.bonus-row {
  display: flex;
  flex-wrap: wrap;
  gap: 6px 10px;
  align-items: baseline;
  font-size: 12px;
  color: var(--text-mid, #5a6480);
}

.bonus-row span {
  font-weight: 700;
  color: #7d6bd6;
}

.ach-group {
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

.ach-list {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
  gap: 8px;
  margin: 0;
  padding: 0;
  list-style: none;
}

.ach-item {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 10px;
  background: rgb(255 255 255 / 62%);
  border: 1px solid rgb(200 208 235 / 55%);
  border-radius: 12px;
}

.ach-item.achieved {
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

.achieved .state {
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

@media (max-width: 360px) {
  .ach-list {
    grid-template-columns: 1fr;
  }
}
</style>
