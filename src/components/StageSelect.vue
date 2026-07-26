<script setup lang="ts">
import { computed, ref } from 'vue';
import { abbr } from '@/core/format';
import { usePlayerStore } from '@/stores/player';
import { useStageStore } from '@/stores/stage';
import { REGIONS } from '@/data/regions';
import { stagesOfChapter } from '@/data/stages';

const emit = defineEmits<{ close: [] }>();
const player = usePlayerStore();
const stage = useStageStore();

const openRegion = ref(stage.current.chapterId.split('-')[0] === '1' ? 'r1' : 'r2');
const openChapter = ref(stage.current.chapterId);

const regions = computed(() => REGIONS);

function pick(stageId: string) {
  if (stage.select(stageId)) emit('close');
}
</script>

<template>
  <div class="overlay" @click.self="emit('close')">
    <div class="sheet">
      <header class="head">
        <h3>选择关卡</h3>
        <button class="x" @click="emit('close')">✕</button>
      </header>

      <div class="body scroll-y">
        <div v-for="r in regions" :key="r.id" class="region">
          <button
            class="region-head"
            :style="{ background: `linear-gradient(100deg, ${r.theme[0]}, ${r.theme[1]})` }"
            @click="openRegion = openRegion === r.id ? '' : r.id"
          >
            <span class="r-left">
              <span class="r-name">{{ r.index }} · {{ r.name }}</span>
              <span class="r-sub">{{ r.subtitle }}</span>
            </span>
            <span class="r-lv num">Lv {{ r.levelFrom }}–{{ r.levelTo }}</span>
          </button>

          <div v-if="openRegion === r.id" class="chapters">
            <div v-for="c in r.chapters" :key="c.id" class="chapter">
              <button class="chapter-head" @click="openChapter = openChapter === c.id ? '' : c.id">
                <span class="c-name">{{ c.id }} {{ c.name }}</span>
                <span class="c-lv num">Lv {{ c.levelFrom }}–{{ c.levelTo }}</span>
              </button>

              <div v-if="openChapter === c.id" class="stages">
                <button
                  v-for="s in stagesOfChapter(c.id)"
                  :key="s.id"
                  class="stage"
                  :class="{
                    on: s.id === stage.current.id,
                    locked: !stage.isUnlocked(s.id),
                    boss: !!s.bossId,
                  }"
                  :disabled="!stage.isUnlocked(s.id)"
                  @click="pick(s.id)"
                >
                  <span class="s-name">
                    {{ s.name }}
                    <span v-if="s.bossId" class="s-boss">BOSS</span>
                  </span>
                  <span class="s-meta">
                    <span v-if="!stage.isUnlocked(s.id)" class="s-lock">🔒 未解锁</span>
                    <span v-else class="s-cp num" :class="{ low: player.cp < s.recommendCP }">
                      战力 {{ abbr(s.recommendCP) }}
                    </span>
                  </span>
                </button>
              </div>
            </div>
          </div>
        </div>

        <p class="tip">通关一关后才会解锁下一关。挂机会自动累计击杀数来通关。</p>
      </div>
    </div>
  </div>
</template>

<style scoped>
.sheet {
  width: 100%;
  max-height: 80dvh;
  display: flex;
  flex-direction: column;
  background: var(--panel);
  border-radius: var(--r-lg);
  box-shadow: var(--shadow-lg);
  overflow: hidden;
}

.head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 14px 16px;
  border-bottom: 1px solid var(--line);
}

.head h3 {
  font-size: 15px;
  font-weight: 700;
}

.x {
  font-size: 15px;
  color: var(--text-dim);
}

.body {
  padding: 12px;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.region-head {
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 14px;
  border-radius: var(--r);
  text-align: left;
}

.r-left {
  display: flex;
  flex-direction: column;
  gap: 1px;
}

.r-name {
  font-size: 14px;
  font-weight: 700;
}

.r-sub {
  font-size: 10px;
  color: var(--text-mid);
}

.r-lv {
  font-size: 11px;
  font-weight: 600;
  color: var(--text-mid);
}

.chapters {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 8px 0 0 8px;
}

.chapter-head {
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 9px 12px;
  background: var(--panel-2);
  border: 1px solid var(--line);
  border-radius: var(--r-sm);
  text-align: left;
}

.c-name {
  font-size: 12px;
  font-weight: 600;
}

.c-lv {
  font-size: 10px;
  color: var(--text-dim);
}

.stages {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 6px;
  padding: 6px 0 4px 6px;
}

.stage {
  display: flex;
  flex-direction: column;
  gap: 2px;
  padding: 8px 10px;
  background: var(--panel);
  border: 1px solid var(--line);
  border-radius: var(--r-sm);
  text-align: left;
}

.stage.on {
  border-color: var(--pink);
  background: var(--pink-soft);
}

.stage.boss {
  border-color: var(--q-legendary);
}

.stage.locked {
  opacity: 0.45;
}

.s-name {
  font-size: 11px;
  font-weight: 600;
  display: flex;
  align-items: center;
  gap: 4px;
}

.s-boss {
  font-size: 8px;
  font-weight: 800;
  color: var(--q-legendary);
}

.s-meta {
  font-size: 9px;
}

.s-cp {
  color: var(--text-dim);
}

.s-cp.low {
  color: var(--danger);
}

.s-lock {
  color: var(--text-dim);
}

.tip {
  padding: 4px;
  font-size: 10px;
  line-height: 1.6;
  color: var(--text-dim);
  text-align: center;
}
</style>
