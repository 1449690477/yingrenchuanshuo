<script setup lang="ts">
import { computed } from 'vue';
import type { PropType } from 'vue';
import { ChevronLeft, ScrollText } from '@lucide/vue';
import type { MonsterCodexLedger } from '@/core/monsterCodex';
import { buildMonsterCodex } from '@/components/monsterCodex/monsterCodexData';

const props = defineProps({
  ledger: {
    type: Object as PropType<MonsterCodexLedger>,
    required: true,
  },
});

const emit = defineEmits<{ (e: 'close'): void }>();

const codex = computed(() => buildMonsterCodex(props.ledger));
</script>

<template>
  <section class="codex-view" role="region" aria-label="怪物图鉴">
    <header class="codex-top">
      <button type="button" class="codex-back" aria-label="返回" @click="emit('close')">
        <ChevronLeft :size="18" />
      </button>
      <span class="codex-title">
        <small>已发现 / 未发现 / 在哪刷</small>
        <strong>怪物图鉴</strong>
      </span>
      <span class="codex-sum" aria-label="图鉴总进度">
        <ScrollText :size="11" />
        {{ codex.summary.discovered }}/{{ codex.summary.total }}
      </span>
    </header>

    <main class="codex-scroll scroll-y">
      <p class="codex-hint">
        共 {{ codex.summary.total }} 只 · 已发现 {{ codex.summary.discovered }} 只；
        图鉴是「曾经发现过」的永久记录，回刷旧关不会让它倒退。
      </p>

      <section
        v-for="region in codex.regions"
        :key="region.regionId"
        class="codex-region"
        :aria-label="region.regionName"
      >
        <h2 class="region-head">
          {{ region.regionName }}
          <em>{{ region.levelText }}</em>
          <small>{{ region.discoveredCount }}/{{ region.total }}</small>
        </h2>

        <div
          v-for="chapter in region.chapters"
          :key="chapter.chapterId"
          class="codex-chapter"
        >
          <h3 class="chapter-head">
            {{ chapter.chapterName }}
            <em>{{ chapter.discoveredCount }}/{{ chapter.total }}</em>
          </h3>
          <ul class="monster-grid">
            <li
              v-for="(monster, i) in chapter.entries"
              :key="monster.id"
              class="monster-card"
              :class="{ 'is-undiscovered': !monster.discovered }"
              :style="{ '--card-delay': `${Math.min(i, 5) * 45}ms` }"
            >
              <div class="monster-art">
                <img :src="monster.asset" :alt="monster.discovered ? monster.name : ''" loading="lazy" />
                <span v-if="!monster.discovered" class="monster-veil" aria-hidden="true">未发现</span>
              </div>
              <p class="monster-name">
                {{ monster.discovered ? monster.name : '？？？' }}
              </p>
              <p class="monster-meta">
                <b>{{ monster.type === 'normal' ? '普通' : monster.type === 'elite' ? '精英' : 'BOSS' }}</b>
                <span>Lv{{ monster.level }}</span>
              </p>
            </li>
          </ul>
        </div>
      </section>
    </main>
  </section>
</template>

<style scoped>
.codex-view {
  position: absolute;
  z-index: 30;
  inset: 0;
  display: flex;
  flex-direction: column;
  min-height: 0;
  color: var(--text);
  background:
    radial-gradient(120% 80% at 50% 0%, rgba(138, 180, 248, 0.18), transparent 55%),
    linear-gradient(180deg, #eef4fb 0%, #e2ecf7 100%);
}

.codex-top {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: max(14px, env(safe-area-inset-top)) 14px 10px;
}

.codex-back {
  display: grid;
  place-items: center;
  width: 44px;
  height: 44px;
  border: 0;
  border-radius: 14px;
  color: var(--text);
  background: rgba(255, 255, 255, 0.72);
  box-shadow: 0 4px 14px rgba(94, 129, 182, 0.18);
}

.codex-title {
  display: flex;
  flex-direction: column;
  gap: 1px;
  min-width: 0;
}

.codex-title small {
  font-size: 11px;
  color: var(--text-muted, #7b8aa0);
}

.codex-title strong {
  font-size: 17px;
}

.codex-sum {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  margin-left: auto;
  padding: 6px 10px;
  border-radius: 999px;
  font-size: 12px;
  color: #44639a;
  background: rgba(255, 255, 255, 0.72);
}

.codex-scroll {
  flex: 1;
  min-height: 0;
  padding: 4px 14px calc(24px + env(safe-area-inset-bottom));
  overflow-y: auto;
}

.codex-hint {
  margin: 0 0 12px;
  padding: 10px 12px;
  border-radius: 12px;
  font-size: 12px;
  line-height: 1.5;
  color: #4d5d75;
  background: rgba(255, 255, 255, 0.62);
}

.codex-region {
  margin-bottom: 16px;
}

.region-head {
  display: flex;
  align-items: baseline;
  gap: 8px;
  margin: 0 0 8px;
  font-size: 15px;
}

.region-head em {
  font-style: normal;
  font-size: 11px;
  color: var(--text-muted, #7b8aa0);
}

.region-head small {
  margin-left: auto;
  font-size: 12px;
  color: #44639a;
}

.codex-chapter {
  margin-bottom: 10px;
}

.chapter-head {
  display: flex;
  align-items: baseline;
  gap: 8px;
  margin: 0 2px 6px;
  font-size: 13px;
  color: #4d5d75;
}

.chapter-head em {
  font-style: normal;
  font-size: 11px;
  color: var(--text-muted, #7b8aa0);
}

.monster-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(86px, 1fr));
  gap: 8px;
  margin: 0;
  padding: 0;
  list-style: none;
}

.monster-card {
  animation: card-in 0.4s var(--ease-soft, ease-out) both;
  animation-delay: var(--card-delay, 0ms);
}

@keyframes card-in {
  from {
    opacity: 0;
    transform: translateY(6px);
  }
  to {
    opacity: 1;
    transform: none;
  }
}

.monster-art {
  position: relative;
  overflow: hidden;
  aspect-ratio: 1;
  border-radius: 12px;
  background: rgba(255, 255, 255, 0.7);
  box-shadow: 0 3px 10px rgba(94, 129, 182, 0.14);
}

.monster-art img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.monster-card.is-undiscovered .monster-art img {
  filter: grayscale(1) brightness(0.72);
  opacity: 0.55;
}

.monster-veil {
  position: absolute;
  inset: 0;
  display: grid;
  place-items: center;
  font-size: 11px;
  letter-spacing: 2px;
  color: #fff;
  background: rgba(70, 86, 110, 0.42);
}

.monster-name {
  margin: 5px 2px 0;
  overflow: hidden;
  font-size: 12px;
  font-weight: 600;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.monster-meta {
  display: flex;
  justify-content: space-between;
  gap: 4px;
  margin: 2px 2px 0;
  font-size: 10px;
  color: var(--text-muted, #7b8aa0);
}

.monster-meta b {
  color: #44639a;
  font-weight: 600;
}

@media (prefers-reduced-motion: reduce) {
  .monster-card {
    animation: none;
  }
}
</style>
