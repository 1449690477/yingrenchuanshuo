<script setup lang="ts">
import { computed, ref } from 'vue';
import {
  BookHeart,
  ChevronRight,
  Gift,
  Heart,
  LockKeyhole,
  Sparkles,
} from '@lucide/vue';
import type {
  AffectionCharacterProgress,
  AffectionTierDefinition,
} from '@/core/affection';
import type {
  AffectionCharacterDefinition,
  AffectionInteractionDefinition,
  AffectionStoryDefinition,
} from '@/data/affection';

interface AffectionStoryView {
  story: AffectionStoryDefinition;
  unlocked: boolean;
  completed: boolean;
}

interface AffectionFeedback {
  tone: 'success' | 'notice' | 'reward';
  text: string;
}

const props = withDefaults(
  defineProps<{
    character: AffectionCharacterDefinition;
    progress: AffectionCharacterProgress;
    tier: AffectionTierDefinition;
    nextTier?: AffectionTierDefinition | null;
    interactionsRemaining: number;
    stories: readonly AffectionStoryView[];
    busyInteractionId?: string | null;
    disabled?: boolean;
    feedback?: AffectionFeedback | null;
  }>(),
  {
    nextTier: null,
    busyInteractionId: null,
    disabled: false,
    feedback: null,
  },
);

const emit = defineEmits<{
  interact: [interactionId: string];
  openStory: [storyId: string];
  openEquipment: [];
}>();

const expandedInteractions = ref(false);

const panelStyle = computed(() => ({
  '--affection-accent': props.character.accent,
  '--affection-glow': props.character.glow,
}));
const sceneUrl = computed(
  () => `${import.meta.env.BASE_URL}${props.character.hubBackgroundAsset}`,
);
const visibleInteractions = computed(() =>
  expandedInteractions.value
    ? props.character.interactions
    : props.character.interactions.slice(0, 4),
);
const progressRatio = computed(() => {
  const next = props.nextTier;
  if (!next) return 1;
  const span = Math.max(1, next.minPoints - props.tier.minPoints);
  return Math.min(1, Math.max(0, (props.progress.points - props.tier.minPoints) / span));
});
const completedStoryCount = computed(
  () => props.stories.filter((entry) => entry.completed).length,
);

function interactionLocked(interaction: AffectionInteractionDefinition): boolean {
  return Boolean(
    interaction.requiredStoryId &&
      !props.progress.completedStoryIds.includes(interaction.requiredStoryId),
  );
}

function requestInteraction(interaction: AffectionInteractionDefinition): void {
  if (
    props.disabled ||
    props.busyInteractionId ||
    props.interactionsRemaining <= 0 ||
    interactionLocked(interaction)
  ) {
    return;
  }
  emit('interact', interaction.id);
}
</script>

<template>
  <section
    class="affection-panel"
    :style="panelStyle"
    :aria-label="`${character.name}的好感养成`"
  >
    <header class="affection-hero">
      <img class="hero-scene" :src="sceneUrl" alt="" aria-hidden="true" />
      <span class="hero-veil" aria-hidden="true" />
      <span class="hero-sparkles" aria-hidden="true">
        <i v-for="index in 7" :key="index" />
      </span>

      <div class="hero-copy">
        <span class="room-label">
          <Heart :size="13" fill="currentColor" aria-hidden="true" />
          {{ character.roomTitle }}
        </span>
        <strong>{{ character.name }}</strong>
        <p>{{ character.personality }}</p>
      </div>

      <div class="bond-card">
        <span class="bond-tier">{{ tier.label }}</span>
        <span class="bond-points num">{{ progress.points }}</span>
        <span class="bond-unit">心意</span>
      </div>
    </header>

    <div class="bond-progress" aria-label="好感度成长进度">
      <div class="progress-head">
        <span>
          <Heart :size="14" fill="currentColor" aria-hidden="true" />
          当前默契
        </span>
        <strong v-if="nextTier">{{ nextTier.label }} · {{ nextTier.minPoints }} 心意</strong>
        <strong v-else>已达最高阶段</strong>
      </div>
      <div
        class="progress-track"
        role="progressbar"
        :aria-valuenow="progress.points"
        :aria-valuemin="tier.minPoints"
        :aria-valuemax="nextTier?.minPoints ?? progress.points"
      >
        <span :style="{ width: `${progressRatio * 100}%` }" />
      </div>
      <div class="bonus-line">
        <span>战斗羁绊</span>
        <strong>常规属性 +{{ Math.round(tier.combatBonusRatio * 1000) / 10 }}%</strong>
        <small>与她更亲近，会真实增强当前职业</small>
      </div>
    </div>

    <p
      v-if="feedback"
      class="feedback"
      :class="`tone-${feedback.tone}`"
      role="status"
      aria-live="polite"
    >
      <Sparkles v-if="feedback.tone === 'reward'" :size="15" aria-hidden="true" />
      {{ feedback.text }}
    </p>

    <section class="interaction-section" aria-labelledby="affection-interaction-title">
      <div class="section-heading">
        <span>
          <small>DAILY MOMENTS</small>
          <strong id="affection-interaction-title">今天想陪她做什么？</strong>
        </span>
        <span class="daily-count" :class="{ empty: interactionsRemaining <= 0 }">
          今日还可获得 {{ interactionsRemaining }} 次心意
        </span>
      </div>

      <div class="interaction-grid">
        <button
          v-for="interaction in visibleInteractions"
          :key="interaction.id"
          type="button"
          class="interaction-card"
          :class="[
            `mood-${interaction.mood}`,
            {
              locked: interactionLocked(interaction),
              busy: busyInteractionId === interaction.id,
            },
          ]"
          :disabled="
            disabled ||
            Boolean(busyInteractionId) ||
            interactionsRemaining <= 0 ||
            interactionLocked(interaction)
          "
          @click="requestInteraction(interaction)"
        >
          <span class="interaction-icon" aria-hidden="true">
            <LockKeyhole v-if="interactionLocked(interaction)" :size="18" />
            <Heart v-else :size="18" fill="currentColor" />
          </span>
          <span class="interaction-copy">
            <strong>{{ interaction.label }}</strong>
            <small>
              {{
                interactionLocked(interaction)
                  ? '继续剧情后解锁'
                  : interaction.shortDescription
              }}
            </small>
          </span>
          <span class="interaction-gain">
            {{ busyInteractionId === interaction.id ? '回应中…' : `+${interaction.points}` }}
          </span>
        </button>
      </div>

      <button
        v-if="character.interactions.length > 4"
        type="button"
        class="expand-button"
        :aria-expanded="expandedInteractions"
        @click="expandedInteractions = !expandedInteractions"
      >
        {{ expandedInteractions ? '收起更多互动' : '展开全部互动' }}
        <ChevronRight :size="16" :class="{ rotated: expandedInteractions }" aria-hidden="true" />
      </button>

      <p v-if="interactionsRemaining <= 0" class="daily-note">
        今天的有效互动已经完成。你仍可重看剧情与收藏，明早 04:00 她会准备好新的相处时光。
      </p>
    </section>

    <section class="story-section" aria-labelledby="affection-story-title">
      <div class="section-heading">
        <span>
          <small>HEART STORIES</small>
          <strong id="affection-story-title">只属于你们的故事</strong>
        </span>
        <span class="story-count">{{ completedStoryCount }} / {{ stories.length }}</span>
      </div>

      <div class="story-list">
        <button
          v-for="entry in stories"
          :key="entry.story.id"
          type="button"
          class="story-card"
          :class="{
            completed: entry.completed,
            locked: !entry.unlocked,
            fresh: entry.unlocked && !entry.completed,
          }"
          :disabled="disabled || !entry.unlocked"
          @click="emit('openStory', entry.story.id)"
        >
          <span class="story-number">{{ String(entry.story.episode).padStart(2, '0') }}</span>
          <span class="story-copy">
            <small>{{ entry.story.episodeLabel }}</small>
            <strong>{{ entry.story.title }}</strong>
            <em v-if="entry.completed">已珍藏 · 可再次回忆</em>
            <em v-else-if="entry.unlocked">新篇章已解锁</em>
            <em v-else>需要 {{ entry.story.unlockPoints }} 心意与前置篇章</em>
          </span>
          <i v-if="entry.unlocked && !entry.completed" class="new-tag" aria-hidden="true">NEW</i>
          <BookHeart v-if="entry.completed" :size="19" aria-hidden="true" />
          <LockKeyhole v-else-if="!entry.unlocked" :size="18" aria-hidden="true" />
          <ChevronRight v-else :size="19" aria-hidden="true" />
        </button>
      </div>
    </section>

    <button type="button" class="collection-button" @click="emit('openEquipment')">
      <span class="collection-icon" aria-hidden="true">
        <Gift :size="22" />
        <i />
      </span>
      <span>
        <small>HEART-RAINBOW COLLECTION</small>
        <strong>查看她的专属心虹珍藏</strong>
        <em>互动时有机会掉落，未收集款式会优先出现</em>
      </span>
      <ChevronRight :size="20" aria-hidden="true" />
    </button>

    <details class="boundaries">
      <summary>她希望被怎样对待</summary>
      <ul>
        <li v-for="boundary in character.boundaries" :key="boundary">{{ boundary }}</li>
      </ul>
    </details>
  </section>
</template>

<style scoped>
.affection-panel {
  --affection-accent: #ff7fa6;
  --affection-glow: #ffd6e4;
  display: flex;
  flex-direction: column;
  gap: 12px;
  color: var(--text);
}

.affection-hero {
  position: relative;
  min-height: 176px;
  overflow: hidden;
  isolation: isolate;
  border: 1px solid rgb(255 255 255 / 82%);
  border-radius: 23px;
  box-shadow: 0 12px 28px color-mix(in srgb, var(--affection-accent) 18%, transparent);
}

.hero-scene,
.hero-veil {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
}

.hero-scene {
  z-index: -3;
  object-fit: cover;
}

.hero-veil {
  z-index: -2;
  background:
    linear-gradient(90deg, rgb(33 41 62 / 72%), rgb(49 43 64 / 26%) 68%, transparent),
    linear-gradient(0deg, rgb(25 32 52 / 46%), transparent 55%);
}

.hero-sparkles {
  position: absolute;
  inset: 0;
  z-index: -1;
  pointer-events: none;
}

.hero-sparkles i {
  position: absolute;
  width: 5px;
  height: 5px;
  background: #fff;
  border-radius: 50%;
  box-shadow: 0 0 11px 3px var(--affection-glow);
  animation: affection-twinkle 2.8s ease-in-out infinite alternate;
}

.hero-sparkles i:nth-child(1) {
  top: 20%;
  left: 46%;
}

.hero-sparkles i:nth-child(2) {
  top: 35%;
  left: 72%;
  animation-delay: -0.8s;
}

.hero-sparkles i:nth-child(3) {
  top: 15%;
  left: 88%;
  animation-delay: -1.5s;
}

.hero-sparkles i:nth-child(4) {
  top: 72%;
  left: 62%;
  animation-delay: -2.1s;
}

.hero-sparkles i:nth-child(5) {
  top: 61%;
  left: 91%;
  animation-delay: -0.5s;
}

.hero-sparkles i:nth-child(6) {
  top: 83%;
  left: 78%;
  animation-delay: -1.8s;
}

.hero-sparkles i:nth-child(7) {
  top: 44%;
  left: 53%;
  animation-delay: -2.4s;
}

.hero-copy {
  width: min(67%, 228px);
  padding: 21px 0 18px 17px;
  color: #fff;
  text-shadow: 0 2px 8px rgb(31 34 52 / 48%);
}

.room-label {
  display: inline-flex;
  min-height: 27px;
  align-items: center;
  gap: 5px;
  padding: 4px 9px;
  font-size: 9px;
  font-weight: 800;
  color: #fff;
  background: color-mix(in srgb, var(--affection-accent) 72%, transparent);
  border: 1px solid rgb(255 255 255 / 42%);
  border-radius: 999px;
}

.hero-copy > strong {
  display: block;
  margin-top: 8px;
  font-size: 24px;
  letter-spacing: 0.08em;
}

.hero-copy p {
  display: -webkit-box;
  margin-top: 5px;
  overflow: hidden;
  font-size: 10px;
  line-height: 1.65;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 3;
}

.bond-card {
  position: absolute;
  right: 11px;
  bottom: 11px;
  min-width: 82px;
  padding: 9px 10px;
  color: #70445f;
  text-align: right;
  background: rgb(255 255 255 / 88%);
  border: 1px solid rgb(255 255 255 / 92%);
  border-radius: 16px;
  box-shadow: 0 7px 18px rgb(38 42 65 / 20%);
  backdrop-filter: blur(10px);
}

.bond-tier,
.bond-unit {
  display: block;
  font-size: 8px;
  font-weight: 800;
}

.bond-points {
  display: inline-block;
  margin: 2px 3px 0 0;
  font-size: 21px;
  font-weight: 900;
  color: var(--affection-accent);
}

.bond-unit {
  display: inline;
  color: var(--text-dim);
}

.bond-progress,
.interaction-section,
.story-section {
  padding: 12px;
  background: rgb(255 255 255 / 82%);
  border: 1px solid rgb(255 255 255 / 92%);
  border-radius: 18px;
  box-shadow: var(--shadow-sm);
}

.progress-head,
.section-heading,
.bonus-line {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.progress-head span {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  font-size: 11px;
  font-weight: 800;
  color: var(--affection-accent);
}

.progress-head strong {
  font-size: 8px;
  color: var(--text-dim);
}

.progress-track {
  height: 8px;
  margin-top: 9px;
  overflow: hidden;
  background: color-mix(in srgb, var(--affection-glow) 48%, #eef2f6);
  border-radius: 999px;
}

.progress-track span {
  position: relative;
  display: block;
  height: 100%;
  overflow: hidden;
  background: linear-gradient(90deg, var(--affection-accent), #ffc86f, #79c8ee);
  border-radius: inherit;
  box-shadow: 0 0 10px var(--affection-glow);
  transition: width 0.42s var(--ease-soft);
}

/* 进度条上的一缕扫光：让「默契在增长」是活的，不是一格死色 */
.progress-track span::after {
  position: absolute;
  inset: 0;
  content: '';
  background: linear-gradient(100deg, transparent 30%, rgb(255 255 255 / 55%) 50%, transparent 70%);
  background-size: 220% 100%;
  animation: track-shine 2.6s linear infinite;
}

@keyframes track-shine {
  from {
    background-position: 180% 0;
  }
  to {
    background-position: -60% 0;
  }
}

/* 房间标签上的心跳：她就在这个房间里等你 */
.room-label svg {
  animation: heartbeat 1.7s ease-in-out infinite;
  transform-origin: center;
}

@keyframes heartbeat {
  0%,
  32%,
  100% {
    transform: scale(1);
  }
  8% {
    transform: scale(1.28);
  }
  16% {
    transform: scale(1.06);
  }
  24% {
    transform: scale(1.2);
  }
}

.bonus-line {
  margin-top: 8px;
  font-size: 9px;
}

.bonus-line span {
  color: var(--text-dim);
}

.bonus-line strong {
  color: var(--pink-deep);
}

.bonus-line small {
  display: none;
}

.feedback {
  display: flex;
  align-items: flex-start;
  gap: 6px;
  padding: 10px 12px;
  font-size: 10px;
  line-height: 1.6;
  border-radius: 14px;
}

.tone-success {
  color: #337a64;
  background: #eaf9f3;
  border: 1px solid #ccecdf;
}

.tone-notice {
  color: #8a6b31;
  background: #fff7e4;
  border: 1px solid #f1dfb4;
}

.tone-reward {
  color: #765183;
  background: linear-gradient(120deg, #fff0f8, #fff8da, #eaf8ff);
  border: 1px solid #e7cde5;
}

.section-heading {
  margin-bottom: 10px;
}

.section-heading > span:first-child {
  display: flex;
  min-width: 0;
  flex-direction: column;
}

.section-heading small,
.collection-button small {
  font-size: 7px;
  font-weight: 900;
  letter-spacing: 0.12em;
  color: var(--affection-accent);
}

.section-heading strong {
  margin-top: 2px;
  font-size: 13px;
}

.daily-count,
.story-count {
  flex: 0 0 auto;
  padding: 4px 7px;
  font-size: 8px;
  font-weight: 800;
  color: #766078;
  background: color-mix(in srgb, var(--affection-glow) 48%, white);
  border-radius: 999px;
}

.daily-count.empty {
  color: var(--text-dim);
  background: var(--panel-3);
}

.interaction-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 7px;
}

.interaction-card {
  position: relative;
  min-width: 0;
  min-height: 74px;
  display: grid;
  grid-template-columns: 30px minmax(0, 1fr);
  align-items: center;
  gap: 7px;
  padding: 9px 9px 18px;
  color: #6c5265;
  text-align: left;
  background: linear-gradient(145deg, #fff, #fff7fa);
  border: 1px solid color-mix(in srgb, var(--affection-accent) 18%, var(--line));
  border-radius: 14px;
  box-shadow: 0 4px 10px rgb(82 83 111 / 7%);
  transition:
    transform var(--t-fast) var(--ease-spring),
    border-color var(--t-fast) var(--ease-soft),
    box-shadow var(--t-fast) var(--ease-soft);
}

.interaction-card:not(:disabled):hover {
  border-color: color-mix(in srgb, var(--affection-accent) 36%, var(--line));
  box-shadow: 0 7px 15px rgb(82 83 111 / 12%);
  transform: translateY(-1px);
}

.interaction-card:not(:disabled):active {
  transform: scale(0.965);
  box-shadow: 0 2px 5px rgb(82 83 111 / 8%);
}

.interaction-card:disabled {
  cursor: default;
  opacity: 0.55;
}

.interaction-card.busy {
  opacity: 0.82;
}

.interaction-icon {
  display: grid;
  width: 30px;
  height: 30px;
  place-items: center;
  color: var(--affection-accent);
  background: color-mix(in srgb, var(--affection-glow) 56%, white);
  border-radius: 11px;
}

/* 五种心情五种颜色：扫一眼就知道这次互动是什么氛围 */
.interaction-card.mood-calm .interaction-icon {
  color: #4d94d4;
  background: #e7f3fd;
}
.interaction-card.mood-bright .interaction-icon {
  color: #d99a2b;
  background: #fdf3df;
}
.interaction-card.mood-shy .interaction-icon {
  color: #f06a9c;
  background: #fdeaf2;
}
.interaction-card.mood-moved .interaction-icon {
  color: #9370cf;
  background: #f1ebfb;
}
.interaction-card.mood-playful .interaction-icon {
  color: #2eae97;
  background: #e4f8f3;
}

.interaction-copy {
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.interaction-copy strong {
  overflow: hidden;
  font-size: 10px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.interaction-copy small {
  display: -webkit-box;
  overflow: hidden;
  font-size: 7px;
  line-height: 1.45;
  color: var(--text-dim);
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
}

.interaction-gain {
  position: absolute;
  right: 7px;
  bottom: 5px;
  font-size: 7px;
  font-weight: 900;
  color: var(--affection-accent);
}

.expand-button {
  width: 100%;
  min-height: 44px;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 4px;
  margin-top: 7px;
  font-size: 9px;
  font-weight: 800;
  color: var(--text-mid);
  background: transparent;
}

.expand-button svg {
  transition: transform var(--t-fast) var(--ease-spring);
}

.expand-button svg.rotated {
  transform: rotate(90deg);
}

.daily-note {
  padding: 8px 10px;
  margin-top: 5px;
  font-size: 8px;
  line-height: 1.55;
  color: var(--text-dim);
  background: var(--panel-3);
  border-radius: 10px;
}

.story-list {
  display: flex;
  flex-direction: column;
  gap: 7px;
}

.story-card {
  position: relative;
  min-height: 64px;
  display: grid;
  grid-template-columns: 34px minmax(0, 1fr) 22px;
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

.story-card:not(:disabled):hover {
  border-color: color-mix(in srgb, var(--affection-accent) 42%, var(--line));
}

.story-card:not(:disabled):active {
  transform: scale(0.98);
}

.story-card.completed {
  border-color: color-mix(in srgb, var(--affection-accent) 35%, var(--line));
}

.story-card.locked {
  opacity: 0.58;
}

/* 新解锁未读的篇章：呼吸描边 + NEW 角标，不能埋没在列表里 */
.story-card.fresh {
  border-color: color-mix(in srgb, var(--affection-accent) 52%, var(--line));
  box-shadow: 0 0 0 0 color-mix(in srgb, var(--affection-accent) 34%, transparent);
  animation: fresh-breathe 2.2s ease-in-out infinite;
}

@keyframes fresh-breathe {
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

.story-number {
  display: grid;
  width: 34px;
  height: 34px;
  place-items: center;
  font-size: 10px;
  font-weight: 900;
  color: var(--affection-accent);
  background: color-mix(in srgb, var(--affection-glow) 50%, white);
  border-radius: 12px;
}

.story-copy {
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.story-copy small {
  font-size: 7px;
  color: var(--text-dim);
}

.story-copy strong {
  overflow: hidden;
  font-size: 10px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.story-copy em {
  font-size: 7px;
  font-style: normal;
  color: var(--affection-accent);
}

.story-card.locked .story-copy em {
  color: var(--text-dim);
}

.collection-button {
  position: relative;
  min-height: 76px;
  display: grid;
  grid-template-columns: 42px minmax(0, 1fr) 22px;
  align-items: center;
  gap: 10px;
  padding: 10px 12px;
  overflow: hidden;
  color: #675169;
  text-align: left;
  background:
    linear-gradient(120deg, rgb(255 255 255 / 92%), rgb(255 240 250 / 88%)),
    linear-gradient(90deg, #ff83ae, #ffc765, #78d1d0, #8f85e7);
  border: 1px solid transparent;
  border-radius: 18px;
  box-shadow:
    0 0 0 1px rgb(255 255 255 / 90%),
    0 7px 17px rgb(120 86 132 / 13%);
  transition: transform var(--t-fast) var(--ease-spring);
}

.collection-button::before {
  position: absolute;
  inset: 0;
  z-index: -1;
  content: '';
  background: linear-gradient(100deg, #ff83ae, #ffd066, #69d6c8, #8d84e8, #ff83ae);
  background-size: 240% 100%;
  animation: rainbow-drift 5s linear infinite;
}

.collection-button:active {
  transform: scale(0.98);
}

.collection-icon {
  position: relative;
  display: grid;
  width: 42px;
  height: 42px;
  place-items: center;
  color: #fff;
  background: linear-gradient(145deg, #f98db1, #a67ddd);
  border-radius: 14px;
  box-shadow: 0 4px 12px rgb(140 91 153 / 28%);
}

.collection-icon i {
  position: absolute;
  inset: -4px;
  border: 1px solid rgb(255 255 255 / 66%);
  border-radius: 17px;
}

.collection-button > span:nth-child(2) {
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.collection-button strong {
  font-size: 11px;
}

.collection-button em {
  display: -webkit-box;
  overflow: hidden;
  font-size: 7px;
  font-style: normal;
  line-height: 1.45;
  color: var(--text-dim);
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
}

.boundaries {
  padding: 0 11px;
  background: rgb(246 249 252 / 82%);
  border: 1px solid var(--line);
  border-radius: 14px;
}

.boundaries summary {
  min-height: 44px;
  display: flex;
  align-items: center;
  font-size: 9px;
  font-weight: 800;
  color: var(--text-mid);
  cursor: pointer;
}

.boundaries ul {
  padding: 0 0 10px 18px;
}

.boundaries li {
  margin-top: 4px;
  font-size: 8px;
  line-height: 1.55;
  color: var(--text-dim);
}

@keyframes affection-twinkle {
  from {
    opacity: 0.3;
    transform: scale(0.72);
  }
  to {
    opacity: 0.95;
    transform: scale(1.12);
  }
}

@keyframes rainbow-drift {
  to {
    background-position: 240% 0;
  }
}

@media (max-width: 350px) {
  .affection-hero {
    min-height: 166px;
  }

  .hero-copy {
    width: 72%;
    padding-left: 13px;
  }

  .interaction-grid {
    grid-template-columns: 1fr;
  }

  .interaction-card {
    min-height: 64px;
  }

  .daily-count {
    max-width: 96px;
    text-align: center;
  }
}

@media (prefers-reduced-motion: reduce) {
  .hero-sparkles i,
  .collection-button::before,
  .progress-track span::after,
  .room-label svg,
  .story-card.fresh {
    animation: none;
  }

  .progress-track span,
  .interaction-card,
  .expand-button svg,
  .story-card,
  .collection-button {
    transition: none;
  }
}
</style>
