<script setup lang="ts">
import { BookHeart, Images, MessageCircleHeart, Sparkles } from '@lucide/vue';

export type AffectionCompanionSection = 'chat' | 'letters' | 'gallery';

const props = defineProps<{
  characterName: string;
  tierLabel: string;
  accent: string;
  glow: string;
  unlockedLetterCount: number;
  totalLetterCount: number;
  unlockedMemoryCount: number;
  totalMemoryCount: number;
}>();

const emit = defineEmits<{
  open: [section: AffectionCompanionSection];
}>();

const panelStyle = {
  '--companion-accent': props.accent,
  '--companion-glow': props.glow,
};
</script>

<template>
  <section class="companion-card card" :style="panelStyle" aria-labelledby="companion-heading">
    <header class="companion-head">
      <span class="companion-seal" aria-hidden="true">
        <Sparkles :size="18" />
      </span>
      <span class="companion-title">
        <small>HEART ROOM · {{ tierLabel }}</small>
        <strong id="companion-heading">与{{ characterName }}的心之间</strong>
        <em>只聊一会儿也很好，不消耗次数，也没有奖励压力。</em>
      </span>
    </header>

    <div class="companion-actions">
      <button type="button" class="companion-action chat" @click="emit('open', 'chat')">
        <span class="action-icon"><MessageCircleHeart :size="21" aria-hidden="true" /></span>
        <span class="action-copy">
          <strong>和她聊聊</strong>
          <small>当前心意阶段 · 4 段日常</small>
        </span>
        <span class="action-open">进入</span>
      </button>

      <button type="button" class="companion-action" @click="emit('open', 'letters')">
        <span class="action-icon"><BookHeart :size="21" aria-hidden="true" /></span>
        <span class="action-copy">
          <strong>心之间信</strong>
          <small>她记得你当时怎样回应</small>
        </span>
        <span class="action-count">{{ unlockedLetterCount }}/{{ totalLetterCount }}</span>
      </button>

      <button type="button" class="companion-action" @click="emit('open', 'gallery')">
        <span class="action-icon"><Images :size="21" aria-hidden="true" /></span>
        <span class="action-copy">
          <strong>回忆画廊</strong>
          <small>重看已完成篇章的场景与珍藏</small>
        </span>
        <span class="action-count">{{ unlockedMemoryCount }}/{{ totalMemoryCount }}</span>
      </button>
    </div>
  </section>
</template>

<style scoped>
.companion-card {
  --companion-accent: #ff7fa9;
  --companion-glow: #ffe2ed;
  position: relative;
  padding: 13px;
  overflow: hidden;
  border: 1px solid color-mix(in srgb, var(--companion-accent) 22%, white);
  background:
    radial-gradient(circle at 92% 8%, var(--companion-glow), transparent 36%),
    linear-gradient(145deg, rgb(255 255 255 / 96%), rgb(255 249 252 / 92%));
}

.companion-card::after {
  content: '';
  position: absolute;
  right: -20px;
  bottom: -28px;
  width: 94px;
  height: 94px;
  border: 1px solid color-mix(in srgb, var(--companion-accent) 16%, transparent);
  border-radius: 50%;
  pointer-events: none;
}

.companion-head {
  position: relative;
  z-index: 1;
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 11px;
}

.companion-seal {
  flex: 0 0 auto;
  width: 40px;
  height: 40px;
  display: grid;
  place-items: center;
  color: white;
  background: linear-gradient(145deg, var(--companion-accent), #ad8bf0);
  border: 2px solid white;
  border-radius: 14px;
  box-shadow: 0 5px 14px color-mix(in srgb, var(--companion-accent) 30%, transparent);
}

.companion-title {
  min-width: 0;
  display: flex;
  flex-direction: column;
}

.companion-title small {
  font-size: 8px;
  font-weight: 900;
  letter-spacing: 0.1em;
  color: var(--companion-accent);
}

.companion-title strong {
  margin-top: 1px;
  font-size: 14px;
  color: var(--text);
}

.companion-title em {
  margin-top: 2px;
  font-size: 9px;
  font-style: normal;
  color: var(--text-dim);
}

.companion-actions {
  position: relative;
  z-index: 1;
  display: grid;
  gap: 7px;
}

.companion-action {
  min-height: 56px;
  display: grid;
  grid-template-columns: 38px minmax(0, 1fr) auto;
  align-items: center;
  gap: 8px;
  padding: 8px 10px;
  color: var(--text-mid);
  text-align: left;
  background: rgb(255 255 255 / 85%);
  border: 1px solid var(--line);
  border-radius: 15px;
  box-shadow: 0 3px 10px rgb(68 49 77 / 5%);
  transition:
    transform 0.16s ease,
    border-color 0.16s ease,
    box-shadow 0.16s ease;
}

.companion-action.chat {
  border-color: color-mix(in srgb, var(--companion-accent) 34%, white);
  background: linear-gradient(100deg, color-mix(in srgb, var(--companion-glow) 46%, white), white);
}

.companion-action:active {
  transform: scale(0.985);
}

.companion-action:focus-visible {
  outline: 3px solid color-mix(in srgb, var(--companion-accent) 36%, transparent);
  outline-offset: 2px;
}

.action-icon {
  width: 36px;
  height: 36px;
  display: grid;
  place-items: center;
  color: var(--companion-accent);
  background: color-mix(in srgb, var(--companion-glow) 58%, white);
  border-radius: 12px;
}

.action-copy {
  min-width: 0;
  display: flex;
  flex-direction: column;
}

.action-copy strong {
  font-size: 12px;
}

.action-copy small {
  margin-top: 2px;
  overflow: hidden;
  font-size: 9px;
  color: var(--text-dim);
  text-overflow: ellipsis;
  white-space: nowrap;
}

.action-count,
.action-open {
  min-width: 35px;
  padding: 4px 7px;
  font-size: 8px;
  font-weight: 900;
  color: #796377;
  text-align: center;
  background: #f8f3f8;
  border-radius: 999px;
}

.action-open {
  color: white;
  background: var(--companion-accent);
}

@media (prefers-reduced-motion: reduce) {
  .companion-action {
    transition: none;
  }
}
</style>
