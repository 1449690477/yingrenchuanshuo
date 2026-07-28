<script setup lang="ts">
import { computed } from 'vue';
import { BookHeart, ChevronRight, LockKeyhole } from '@lucide/vue';
import type { AffectionCharacterProgress } from '@/core/affection';
import type { AffectionStoryDefinition } from '@/data/affection';
import {
  AFFECTION_DATE_SLOT_META,
  findAffectionDate,
  type AffectionDateSlot,
} from '@/data/affectionDates';

/**
 * A-4 约会日程板：第十~十二幕（上午/午后/夜晚）的三态入口。
 * 复用心跳故事的解锁/完成视图，不重复造状态轮子：
 * - locked：显示具体原因（差心意，或缺上一幕）；
 * - fresh：已解锁未赴约，呼吸描边提醒；
 * - completed：已珍藏，可再次回忆。
 * 约会不消耗每日互动，选中即由父组件走既有 openStory 管线进剧情。
 */

interface AffectionStoryView {
  story: AffectionStoryDefinition;
  unlocked: boolean;
  completed: boolean;
}

const props = withDefaults(
  defineProps<{
    stories: readonly AffectionStoryView[];
    progress: AffectionCharacterProgress;
    disabled?: boolean;
  }>(),
  { disabled: false },
);

const emit = defineEmits<{
  openDate: [storyId: string];
}>();

const SLOT_ORDER: readonly AffectionDateSlot[] = ['morning', 'afternoon', 'night'];

interface DateCardView {
  story: AffectionStoryDefinition;
  slot: AffectionDateSlot;
  slotLabel: string;
  slotTagline: string;
  slotIcon: string;
  unlocked: boolean;
  completed: boolean;
  stateText: string;
}

function lockReason(entry: AffectionStoryView): string {
  const { story } = entry;
  if (props.progress.points < story.unlockPoints) {
    return `需要 ${story.unlockPoints} 心意`;
  }
  const missingId = story.requiredStoryIds.find(
    (id) => !props.progress.completedStoryIds.includes(id),
  );
  if (missingId) {
    const missing = props.stories.find((candidate) => candidate.story.id === missingId);
    if (missing) return `先完成上一幕《${missing.story.title}》`;
  }
  return `需要 ${story.unlockPoints} 心意与前置篇章`;
}

function stateText(entry: AffectionStoryView): string {
  if (entry.completed) return '已珍藏 · 可再次回忆';
  if (entry.unlocked) return '可赴约 · 新篇章已备好';
  return lockReason(entry);
}

const dateCards = computed<readonly DateCardView[]>(() =>
  props.stories
    .map((entry): DateCardView | null => {
      const date = findAffectionDate(entry.story.id);
      if (!date) return null;
      const meta = AFFECTION_DATE_SLOT_META[date.slot];
      return {
        story: entry.story,
        slot: date.slot,
        slotLabel: meta.label,
        slotTagline: meta.tagline,
        slotIcon: meta.icon,
        unlocked: entry.unlocked,
        completed: entry.completed,
        stateText: stateText(entry),
      };
    })
    .filter((card): card is DateCardView => card !== null)
    .sort((a, b) => SLOT_ORDER.indexOf(a.slot) - SLOT_ORDER.indexOf(b.slot)),
);

const completedCount = computed(() => dateCards.value.filter((card) => card.completed).length);

function cardAriaLabel(card: DateCardView): string {
  return `${card.slotLabel}约会《${card.story.title}》，${card.stateText}`;
}

function requestDate(card: DateCardView): void {
  if (props.disabled || !card.unlocked) return;
  emit('openDate', card.story.id);
}
</script>

<template>
  <section v-if="dateCards.length" class="date-planner" aria-labelledby="affection-date-title">
    <div class="planner-heading">
      <span>
        <small>DATE PLANS</small>
        <strong id="affection-date-title">约会日程</strong>
      </span>
      <span class="date-count">{{ completedCount }} / {{ dateCards.length }}</span>
    </div>

    <p class="planner-note">第十幕起的特别相处：不消耗每日互动，挑个时段就出发。</p>

    <div class="date-list">
      <button
        v-for="card in dateCards"
        :key="card.story.id"
        type="button"
        class="date-card"
        :class="{
          completed: card.completed,
          locked: !card.unlocked,
          fresh: card.unlocked && !card.completed,
        }"
        :disabled="disabled || !card.unlocked"
        :aria-label="cardAriaLabel(card)"
        @click="requestDate(card)"
      >
        <span class="slot-chip" aria-hidden="true">
          <i>{{ card.slotIcon }}</i>
          <b>{{ card.slotLabel }}</b>
        </span>
        <span class="date-copy">
          <small>{{ card.story.episodeLabel }} · {{ card.slotTagline }}</small>
          <strong>{{ card.story.title }}</strong>
          <em>{{ card.stateText }}</em>
        </span>
        <i v-if="card.unlocked && !card.completed" class="new-tag" aria-hidden="true">NEW</i>
        <BookHeart v-if="card.completed" :size="19" aria-hidden="true" />
        <LockKeyhole v-else-if="!card.unlocked" :size="18" aria-hidden="true" />
        <ChevronRight v-else :size="19" aria-hidden="true" />
      </button>
    </div>
  </section>
</template>

<style scoped>
.date-planner {
  padding: 12px;
  background: rgb(255 255 255 / 82%);
  border: 1px solid rgb(255 255 255 / 92%);
  border-radius: 18px;
  box-shadow: var(--shadow-sm);
}

.planner-heading {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.planner-heading > span:first-child {
  display: flex;
  min-width: 0;
  flex-direction: column;
}

.planner-heading small {
  font-size: 7px;
  font-weight: 900;
  letter-spacing: 0.12em;
  color: var(--affection-accent);
}

.planner-heading strong {
  margin-top: 2px;
  font-size: 13px;
}

.date-count {
  flex: 0 0 auto;
  padding: 4px 7px;
  font-size: 8px;
  font-weight: 800;
  color: #766078;
  background: color-mix(in srgb, var(--affection-glow) 48%, white);
  border-radius: 999px;
}

.planner-note {
  margin: 6px 0 10px;
  font-size: 9px;
  line-height: 1.6;
  color: var(--text-dim);
}

.date-list {
  display: flex;
  flex-direction: column;
  gap: 7px;
}

.date-card {
  position: relative;
  min-height: 64px;
  display: grid;
  grid-template-columns: 44px minmax(0, 1fr) 22px;
  align-items: center;
  gap: 8px;
  padding: 8px 10px;
  color: var(--text-mid);
  text-align: left;
  background: #fff;
  border: 1px solid var(--line);
  border-radius: 14px;
  transition:
    transform var(--t-fast) var(--ease-spring),
    border-color var(--t-fast) var(--ease-soft);
}

.date-card:not(:disabled):hover {
  border-color: color-mix(in srgb, var(--affection-accent) 42%, var(--line));
}

.date-card:not(:disabled):active {
  transform: scale(0.98);
}

.date-card.completed {
  border-color: color-mix(in srgb, var(--affection-accent) 35%, var(--line));
}

.date-card.locked {
  opacity: 0.58;
}

/* 可赴约的日程：呼吸描边，别让她在日程板上等丢了 */
.date-card.fresh {
  border-color: color-mix(in srgb, var(--affection-accent) 52%, var(--line));
  box-shadow: 0 0 0 0 color-mix(in srgb, var(--affection-accent) 34%, transparent);
  animation: date-fresh-breathe 2.2s ease-in-out infinite;
}

@keyframes date-fresh-breathe {
  50% {
    box-shadow: 0 0 0 4px color-mix(in srgb, var(--affection-accent) 14%, transparent);
  }
}

.new-tag {
  position: absolute;
  top: -6px;
  right: 10px;
  padding: 1px 7px;
  font-size: 7px;
  font-style: normal;
  font-weight: 900;
  letter-spacing: 0.08em;
  color: #fff;
  background: linear-gradient(120deg, var(--affection-accent), #aa83dd);
  border: 1px solid #fff;
  border-radius: 999px;
  box-shadow: 0 3px 8px color-mix(in srgb, var(--affection-accent) 36%, transparent);
}

.slot-chip {
  display: grid;
  width: 44px;
  height: 40px;
  place-items: center;
  align-content: center;
  gap: 1px;
  background: color-mix(in srgb, var(--affection-glow) 50%, white);
  border-radius: 12px;
}

.slot-chip i {
  font-size: 13px;
  font-style: normal;
  line-height: 1;
}

.slot-chip b {
  font-size: 7px;
  font-weight: 900;
  color: var(--affection-accent);
}

.date-copy {
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.date-copy small {
  overflow: hidden;
  font-size: 7px;
  color: var(--text-dim);
  text-overflow: ellipsis;
  white-space: nowrap;
}

.date-copy strong {
  overflow: hidden;
  font-size: 10px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.date-copy em {
  font-size: 7px;
  font-style: normal;
  color: var(--affection-accent);
}

.date-card.locked .date-copy em {
  color: var(--text-dim);
}

@media (prefers-reduced-motion: reduce) {
  .date-card {
    transition: none;
  }

  .date-card.fresh {
    animation: none;
  }
}
</style>
