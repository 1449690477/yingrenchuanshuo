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

function assetUrl(asset: string): string {
  return `${import.meta.env.BASE_URL}${asset}`;
}

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
          <button class="region-head" @click="openRegion = openRegion === r.id ? '' : r.id">
            <img class="region-cover" :src="assetUrl(r.mapAsset)" :alt="`${r.name}区域地图`" />
            <span class="region-shade" />
            <span class="r-left">
              <span class="r-name">{{ r.index }} · {{ r.name }}</span>
              <span class="r-sub">{{ r.subtitle }}</span>
            </span>
            <span class="r-lv num">Lv {{ r.levelFrom }}–{{ r.levelTo }}</span>
          </button>

          <div v-if="openRegion === r.id" class="chapters">
            <div v-for="c in r.chapters" :key="c.id" class="chapter">
              <button
                class="chapter-head"
                :class="{ open: openChapter === c.id }"
                @click="openChapter = openChapter === c.id ? '' : c.id"
              >
                <img class="chapter-cover" :src="assetUrl(c.mapAsset)" :alt="`${c.name}章节场景`" />
                <span class="chapter-shade" />
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
  position: relative;
  width: 100%;
  min-height: 84px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  overflow: hidden;
  padding: 14px;
  border-radius: var(--r);
  text-align: left;
  color: #fff;
  box-shadow: 0 4px 14px rgb(65 92 120 / 14%);
}

.region-cover,
.region-shade {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
}

.region-cover {
  object-fit: cover;
  object-position: center 45%;
}

.region-shade {
  background: linear-gradient(90deg, rgb(32 48 67 / 74%), rgb(40 62 82 / 20%));
}

.r-left {
  position: relative;
  z-index: 1;
  display: flex;
  flex-direction: column;
  gap: 1px;
}

.r-name {
  font-size: 14px;
  font-weight: 700;
  text-shadow: 0 1px 4px rgb(25 40 55 / 55%);
}

.r-sub {
  font-size: 10px;
  color: rgb(255 255 255 / 82%);
}

.r-lv {
  position: relative;
  z-index: 1;
  font-size: 11px;
  font-weight: 700;
  color: #fff;
  text-shadow: 0 1px 4px rgb(25 40 55 / 55%);
}

.chapters {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 8px 0 0 8px;
}

.chapter-head {
  position: relative;
  width: 100%;
  min-height: 68px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  overflow: hidden;
  padding: 10px 12px;
  border: 1px solid var(--line);
  border-radius: var(--r-sm);
  text-align: left;
  color: #fff;
}

.chapter-head.open {
  border-color: var(--pink);
  box-shadow: 0 0 0 2px rgb(255 139 180 / 14%);
}

.chapter-cover,
.chapter-shade {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
}

.chapter-cover {
  object-fit: cover;
  object-position: center 48%;
}

.chapter-shade {
  background: linear-gradient(90deg, rgb(37 52 70 / 72%), rgb(37 52 70 / 24%));
}

.c-name {
  position: relative;
  z-index: 1;
  font-size: 12px;
  font-weight: 700;
  text-shadow: 0 1px 4px rgb(20 34 48 / 62%);
}

.c-lv {
  position: relative;
  z-index: 1;
  font-size: 10px;
  color: rgb(255 255 255 / 86%);
  text-shadow: 0 1px 4px rgb(20 34 48 / 62%);
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
