<script setup lang="ts">
import { computed } from 'vue';
import { Gift, LockKeyhole, Sparkles } from '@lucide/vue';
import type { AffectionGiftDefinition } from '@/data/affectionGifts';

export interface AffectionGiftView {
  gift: AffectionGiftDefinition;
  costName: string;
  ownedCount: number;
  unlocked: boolean;
}

const props = withDefaults(
  defineProps<{
    characterName: string;
    gifts: readonly AffectionGiftView[];
    interactionsRemaining: number;
    accent: string;
    glow: string;
    busyGiftId?: string | null;
    disabled?: boolean;
    feedback?: {
      tone: 'success' | 'notice' | 'reward';
      text: string;
    } | null;
  }>(),
  {
    busyGiftId: null,
    disabled: false,
    feedback: null,
  },
);

const emit = defineEmits<{
  give: [giftId: string];
}>();

const assetBaseUrl = import.meta.env.BASE_URL;
const shelfStyle = computed(() => ({
  '--gift-accent': props.accent,
  '--gift-glow': props.glow,
}));

const preferenceLabels = {
  favorite: '偏爱',
  liked: '喜欢',
  regular: '合心',
} as const;

function giftDisabled(entry: AffectionGiftView): boolean {
  return (
    props.disabled ||
    Boolean(props.busyGiftId) ||
    props.interactionsRemaining <= 0 ||
    !entry.unlocked ||
    entry.ownedCount < entry.gift.cost.count
  );
}

function giftStatus(entry: AffectionGiftView): string {
  if (!entry.unlocked) return `完成第六幕解锁 · 持有 ${entry.ownedCount}`;
  if (entry.ownedCount < entry.gift.cost.count) {
    return `${entry.costName}不足 · 持有 ${entry.ownedCount} / 需 ${entry.gift.cost.count}`;
  }
  if (props.interactionsRemaining <= 0) {
    return `今日有效互动已完成 · 持有 ${entry.ownedCount}`;
  }
  return `消耗 ${entry.costName} ×${entry.gift.cost.count} · 持有 ${entry.ownedCount}`;
}
</script>

<template>
  <section
    class="gift-shelf"
    :style="shelfStyle"
    :aria-label="`为${characterName}准备礼物`"
  >
    <header class="gift-heading">
      <span class="gift-seal" aria-hidden="true"><Gift :size="18" /></span>
      <span>
        <small>HEART GIFT</small>
        <strong>把旅途材料准备成礼物</strong>
      </span>
      <em>今日共用 {{ interactionsRemaining }} 次互动</em>
    </header>

    <p class="gift-rule">
      <Sparkles :size="13" aria-hidden="true" />
      没有错误礼物：偏爱、喜欢与合心都增加心意，也都会推进心虹保底。
    </p>

    <p
      v-if="feedback"
      class="gift-feedback"
      :class="`tone-${feedback.tone}`"
      role="status"
      aria-live="polite"
    >
      {{ feedback.text }}
    </p>

    <div class="gift-list">
      <button
        v-for="entry in gifts"
        :key="entry.gift.id"
        type="button"
        class="gift-card"
        :class="[
          `preference-${entry.gift.preference}`,
          {
            locked: !entry.unlocked,
            busy: busyGiftId === entry.gift.id,
          },
        ]"
        :disabled="giftDisabled(entry)"
        @click="emit('give', entry.gift.id)"
      >
        <span class="gift-icon">
          <img
            v-if="entry.unlocked"
            :src="`${assetBaseUrl}${entry.gift.iconAsset}`"
            alt=""
            aria-hidden="true"
          />
          <LockKeyhole v-else :size="22" aria-hidden="true" />
        </span>
        <span class="gift-copy">
          <span class="gift-name-line">
            <strong>{{ entry.gift.name }}</strong>
            <em>{{ preferenceLabels[entry.gift.preference] }} · +{{ entry.gift.points }}</em>
          </span>
          <small>{{ entry.gift.shortDescription }}</small>
          <span>{{ giftStatus(entry) }}</span>
        </span>
        <span class="gift-action">
          {{ busyGiftId === entry.gift.id ? '回应中…' : '送给她' }}
        </span>
      </button>
    </div>
  </section>
</template>

<style scoped>
.gift-shelf {
  --gift-accent: #ff7fa6;
  --gift-glow: #ffd6e4;
  overflow: hidden;
  background:
    radial-gradient(circle at 100% 0%, color-mix(in srgb, var(--gift-glow) 45%, transparent), transparent 35%),
    linear-gradient(150deg, #fff, #fff9fc 58%, #f2f8ff);
  border: 1px solid color-mix(in srgb, var(--gift-accent) 20%, var(--line));
  border-radius: var(--r-md);
  box-shadow: 0 8px 20px rgb(55 57 83 / 9%);
}

.gift-heading {
  min-height: 58px;
  display: grid;
  grid-template-columns: 38px minmax(0, 1fr) auto;
  align-items: center;
  gap: 8px;
  padding: 9px 10px;
  border-bottom: 1px solid color-mix(in srgb, var(--gift-accent) 14%, var(--line));
}

.gift-seal {
  width: 38px;
  height: 38px;
  display: grid;
  place-items: center;
  color: #fff;
  background: linear-gradient(145deg, var(--gift-accent), #9d84dd);
  border-radius: 13px;
  box-shadow: 0 4px 11px color-mix(in srgb, var(--gift-accent) 28%, transparent);
}

.gift-heading > span:nth-child(2) {
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.gift-heading small {
  font-size: 8px;
  font-weight: 900;
  color: var(--gift-accent);
  letter-spacing: 0.08em;
}

.gift-heading strong {
  font-size: 13px;
}

.gift-heading > em {
  max-width: 92px;
  font-size: 8px;
  font-style: normal;
  color: var(--text-dim);
  text-align: right;
}

.gift-rule {
  display: flex;
  align-items: center;
  gap: 5px;
  margin: 0;
  padding: 7px 10px;
  font-size: 9px;
  line-height: 1.5;
  color: var(--text-mid);
  background: color-mix(in srgb, var(--gift-glow) 35%, white);
}

.gift-rule svg {
  flex: 0 0 auto;
  color: var(--gift-accent);
}

.gift-feedback {
  margin: 8px 9px 0;
  padding: 8px 10px;
  font-size: 9px;
  line-height: 1.55;
  color: #337a64;
  background: #eaf9f3;
  border: 1px solid #c9eadc;
  border-radius: 11px;
}

.gift-feedback.tone-notice {
  color: #8a5d2d;
  background: #fff7e6;
  border-color: #f1d5a9;
}

.gift-feedback.tone-reward {
  color: #73528f;
  background: linear-gradient(120deg, #fff1f8, #f2efff 55%, #ecf8ff);
  border-color: color-mix(in srgb, var(--gift-accent) 36%, #d8c8eb);
  box-shadow: 0 4px 12px color-mix(in srgb, var(--gift-accent) 15%, transparent);
}

.gift-list {
  display: flex;
  flex-direction: column;
  gap: 7px;
  padding: 9px;
}

.gift-card {
  min-height: 78px;
  display: grid;
  grid-template-columns: 54px minmax(0, 1fr) auto;
  align-items: center;
  gap: 8px;
  padding: 7px 8px;
  color: var(--text);
  text-align: left;
  background: rgb(255 255 255 / 88%);
  border: 1px solid var(--line);
  border-radius: 14px;
  box-shadow: 0 3px 10px rgb(62 57 80 / 7%);
  transition:
    transform var(--t-fast) var(--ease-spring),
    border-color var(--t-fast) var(--ease-soft);
}

.gift-card.preference-favorite {
  border-color: color-mix(in srgb, var(--gift-accent) 46%, var(--line));
}

.gift-card:not(:disabled):active {
  transform: scale(0.982);
  border-color: var(--gift-accent);
}

.gift-card:disabled {
  cursor: default;
  opacity: 0.62;
}

.gift-card.busy {
  opacity: 0.8;
}

.gift-icon {
  width: 54px;
  height: 54px;
  display: grid;
  place-items: center;
  overflow: hidden;
  color: var(--gift-accent);
  background:
    radial-gradient(circle, #fff 0 35%, transparent 70%),
    color-mix(in srgb, var(--gift-glow) 48%, #fff);
  border: 1px solid color-mix(in srgb, var(--gift-accent) 22%, white);
  border-radius: 13px;
}

.gift-icon img {
  width: 100%;
  height: 100%;
  object-fit: contain;
}

.gift-copy {
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 3px;
}

.gift-name-line {
  display: flex;
  align-items: center;
  gap: 5px;
}

.gift-name-line strong {
  overflow: hidden;
  font-size: 11px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.gift-name-line em {
  flex: 0 0 auto;
  padding: 2px 5px;
  font-size: 8px;
  font-style: normal;
  font-weight: 900;
  color: var(--gift-accent);
  background: color-mix(in srgb, var(--gift-glow) 52%, white);
  border-radius: 999px;
}

.gift-copy > small {
  display: -webkit-box;
  overflow: hidden;
  font-size: 8px;
  line-height: 1.45;
  color: var(--text-dim);
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
}

.gift-copy > span:last-child {
  font-size: 8px;
  color: var(--text-mid);
}

.gift-action {
  min-width: 48px;
  padding: 5px 6px;
  font-size: 8px;
  font-weight: 900;
  color: #fff;
  text-align: center;
  background: linear-gradient(125deg, var(--gift-accent), #9a83d9);
  border-radius: 999px;
}

.gift-card:disabled .gift-action {
  color: var(--text-dim);
  background: var(--panel-3);
}

@media (max-width: 350px) {
  .gift-heading {
    grid-template-columns: 36px minmax(0, 1fr);
  }

  .gift-heading > em {
    display: none;
  }

  .gift-card {
    grid-template-columns: 48px minmax(0, 1fr);
  }

  .gift-icon {
    width: 48px;
    height: 48px;
  }

  .gift-action {
    grid-column: 2;
    justify-self: start;
  }
}

@media (prefers-reduced-motion: reduce) {
  .gift-card {
    transition: none;
  }
}
</style>
