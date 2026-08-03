<script setup lang="ts">
import { computed } from 'vue';
import { Check, Gift, Sparkles } from '@lucide/vue';
import type { DailyTaskState } from '@/core/dailyTasks';
import { dailyActivity } from '@/core/dailyTasks';
import { ACTIVITY_TIERS, DAILY_TASKS } from '@/data/dailyTasks';

const props = defineProps<{
  state: DailyTaskState;
  /** 当前时刻（毫秒），用于日切对齐。 */
  now: number;
  /** 领奖回调：由父级接线（存档写入）。 */
  onClaim?: (threshold: number) => void;
}>();

const activity = computed(() => dailyActivity(props.state, props.now));

const claimedSet = computed(() => new Set(props.state.claimedTiers));

const taskRows = computed(() =>
  DAILY_TASKS.map((def) => {
    const progress = props.state.progress[def.id] ?? 0;
    return {
      ...def,
      progress,
      done: progress >= def.target,
      percent: Math.min(100, Math.round((progress / def.target) * 100)),
    };
  }),
);

const tierRows = computed(() =>
  ACTIVITY_TIERS.map((tier) => ({
    ...tier,
    claimed: claimedSet.value.has(tier.threshold),
    claimable: activity.value >= tier.threshold && !claimedSet.value.has(tier.threshold),
  })),
);
</script>

<template>
  <div class="daily-tasks" data-testid="daily-tasks">
    <header class="daily-head">
      <span class="daily-title">
        <Sparkles :size="14" aria-hidden="true" />
        日常任务
      </span>
      <span class="daily-activity num">
        活跃度 {{ activity }}/80
      </span>
    </header>

    <ul class="task-list">
      <li v-for="task in taskRows" :key="task.id" class="task-row" :class="{ done: task.done }">
        <span class="task-check" aria-hidden="true">
          <Check v-if="task.done" :size="12" :stroke-width="3" />
        </span>
        <span class="task-label">{{ task.label }}</span>
        <span class="task-progress num">
          {{ task.done ? '完成' : `${task.progress}/${task.target} ${task.unit}` }}
        </span>
      </li>
    </ul>

    <div class="tier-list">
      <button
        v-for="tier in tierRows"
        :key="tier.threshold"
        type="button"
        class="tier-btn"
        :class="{ claimable: tier.claimable, claimed: tier.claimed }"
        :disabled="!tier.claimable"
        @click="onClaim?.(tier.threshold)"
      >
        <Gift :size="13" aria-hidden="true" />
        {{ tier.claimed ? '已领取' : tier.claimable ? '领取宝箱' : `${tier.threshold} 活跃度解锁` }}
      </button>
    </div>
  </div>
</template>

<style scoped>
.daily-tasks {
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 12px;
  border-radius: 12px;
  background: var(--surface-2, #faf5fa);
}

.daily-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-size: 13px;
  font-weight: 600;
}

.daily-title {
  display: inline-flex;
  align-items: center;
  gap: 5px;
}

.daily-activity {
  color: var(--text-dim, #8a7f8a);
  font-size: 12px;
}

.task-list {
  display: flex;
  flex-direction: column;
  gap: 5px;
  list-style: none;
  margin: 0;
  padding: 0;
}

.task-row {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 12px;
}

.task-row.done .task-label {
  color: var(--text-dim, #8a7f8a);
  text-decoration: line-through;
}

.task-check {
  display: inline-flex;
  width: 16px;
  height: 16px;
  border-radius: 50%;
  border: 1px solid var(--line, #e4d8e4);
  align-items: center;
  justify-content: center;
  color: #fff;
}

.task-row.done .task-check {
  background: var(--accent, #d9689a);
  border-color: var(--accent, #d9689a);
}

.task-label {
  flex: 1;
}

.task-progress {
  font-size: 11px;
  color: var(--text-dim, #8a7f8a);
}

.tier-list {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 6px;
}

.tier-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 4px;
  padding: 7px 8px;
  border: 1px solid var(--line, #e4d8e4);
  border-radius: 8px;
  background: #fff;
  font-size: 11px;
  font-weight: 600;
  color: var(--text-dim, #8a7f8a);
  cursor: default;
}

.tier-btn.claimable {
  border-color: var(--accent, #d9689a);
  color: #fff;
  background: var(--accent, #d9689a);
  cursor: pointer;
}

.tier-btn.claimed {
  opacity: 0.6;
}
</style>
