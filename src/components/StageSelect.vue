<script setup lang="ts">
import { computed, ref } from 'vue';
import { LockKeyhole, X } from '@lucide/vue';
import { abbr } from '@/core/format';
import { usePlayerStore } from '@/stores/player';
import { useStageStore } from '@/stores/stage';
import { REGIONS, regionIdForChapterId } from '@/data/regions';
import { stagesOfChapter } from '@/data/stages';
import { requireItem, type ItemDef } from '@/data/items';
import SystemArtwork from '@/components/SystemArtwork.vue';

const emit = defineEmits<{ close: [] }>();
const player = usePlayerStore();
const stage = useStageStore();

const openRegion = ref(regionIdForChapterId(stage.current.chapterId));
const openChapter = ref(stage.current.chapterId);

const regions = computed(() => REGIONS);

function assetUrl(asset: string): string {
  return `${import.meta.env.BASE_URL}${asset}`;
}

function chapterMaterials(materialIds: readonly string[]): ItemDef[] {
  return materialIds.map(requireItem);
}

function materialSourceLabel(tier: ItemDef['tier']): string {
  if (tier === 'common') return '普通怪';
  if (tier === 'fine') return '精英';
  if (tier === 'rare') return 'BOSS · 有保底';
  return '章节目标';
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
        <button class="x" aria-label="关闭关卡选择" @click="emit('close')">
          <X :size="17" :stroke-width="2.2" aria-hidden="true" />
        </button>
      </header>

      <div class="body scroll-y">
        <div v-for="r in regions" :key="r.id" class="region">
          <button
            class="region-head"
            :class="{ open: openRegion === r.id }"
            :aria-expanded="openRegion === r.id"
            :aria-controls="`stage-region-${r.id}`"
            @click="openRegion = openRegion === r.id ? '' : r.id"
          >
            <img class="region-cover" :src="assetUrl(r.mapAsset)" alt="" aria-hidden="true" />
            <span class="region-shade" />
            <span class="r-left">
              <span class="r-name">{{ r.index }} · {{ r.name }}</span>
              <span class="r-sub">{{ r.subtitle }}</span>
            </span>
            <span class="r-right">
              <span class="r-lv num">Lv {{ r.levelFrom }}–{{ r.levelTo }}</span>
              <span class="r-chev" aria-hidden="true">▾</span>
            </span>
          </button>

          <Transition name="fold">
            <div v-if="openRegion === r.id" :id="`stage-region-${r.id}`" class="chapters">
              <div v-for="c in r.chapters" :key="c.id" class="chapter">
                <button
                  class="chapter-head"
                  :class="{ open: openChapter === c.id }"
                  :aria-expanded="openChapter === c.id"
                  :aria-controls="`stage-chapter-${c.id}`"
                  @click="openChapter = openChapter === c.id ? '' : c.id"
                >
                  <img
                    class="chapter-cover"
                    :src="assetUrl(c.mapAsset)"
                    alt=""
                    aria-hidden="true"
                  />
                  <span class="chapter-shade" />
                  <span class="c-name">{{ c.id }} {{ c.name }}</span>
                  <span class="c-lv num">Lv {{ c.levelFrom }}–{{ c.levelTo }}</span>
                </button>

                <Transition name="fold">
                  <div v-if="openChapter === c.id" :id="`stage-chapter-${c.id}`" class="stages">
                    <section class="chapter-loot" aria-label="本章区域材料">
                      <span class="loot-title">本章掉落</span>
                      <div class="loot-chips">
                        <span
                          v-for="material in chapterMaterials(c.materials)"
                          :key="material.id"
                          class="loot-chip"
                          :class="`tier-${material.tier}`"
                        >
                          <img :src="assetUrl(material.icon)" alt="" aria-hidden="true" />
                          <span class="loot-copy">
                            <b>{{ material.name }}</b>
                            <small>{{ materialSourceLabel(material.tier) }}</small>
                          </span>
                        </span>
                      </div>
                    </section>
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
                      :aria-current="s.id === stage.current.id ? 'true' : undefined"
                      @click="pick(s.id)"
                    >
                      <span class="s-name">
                        {{ s.name }}
                        <span v-if="s.bossId" class="s-boss">BOSS</span>
                      </span>
                      <span class="s-meta">
                        <span v-if="!stage.isUnlocked(s.id)" class="s-lock">
                          <LockKeyhole :size="10" :stroke-width="2.2" aria-hidden="true" />
                          未解锁
                        </span>
                        <span v-else class="s-cp num" :class="{ low: player.cp < s.recommendCP }">
                          战力 {{ abbr(s.recommendCP) }}
                        </span>
                      </span>
                    </button>
                  </div>
                </Transition>
              </div>
            </div>
          </Transition>
        </div>

        <div class="sweep-teaser">
          <SystemArtwork kind="sweep" class="sweep-art" />
          <span class="sweep-copy">
            <strong>疾风扫荡 · M3-7</strong>
            <span>击败章节 BOSS 后开放，用体力快速领取挂机收益。</span>
          </span>
          <span class="sweep-badge">筹备中</span>
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
  display: grid;
  place-items: center;
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
  transition: transform var(--t-slow) var(--ease-soft);
}

.region-head.open .region-cover {
  transform: scale(1.045);
}

.r-right {
  position: relative;
  z-index: 1;
  display: flex;
  align-items: center;
  gap: 7px;
}

.r-chev {
  display: inline-block;
  font-size: 11px;
  color: rgb(255 255 255 / 85%);
  transition: transform var(--t-mid) var(--ease-spring);
}

.region-head.open .r-chev {
  transform: rotate(180deg);
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
  transition: transform var(--t-slow) var(--ease-soft);
}

.chapter-head.open .chapter-cover {
  transform: scale(1.05);
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

.chapter-loot {
  grid-column: 1 / -1;
  padding: 8px;
  border: 1px solid rgb(153 201 229 / 42%);
  border-radius: var(--r-sm);
  background:
    linear-gradient(135deg, rgb(255 242 248 / 92%), rgb(234 247 255 / 88%)),
    var(--panel);
  box-shadow: inset 0 1px 0 rgb(255 255 255 / 88%);
}

.loot-title {
  display: block;
  margin-bottom: 6px;
  font-size: 9px;
  font-weight: 800;
  color: var(--text-dim);
  letter-spacing: 0.08em;
}

.loot-chips {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 5px;
}

.loot-chip {
  min-width: 0;
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 5px 6px;
  overflow: hidden;
  border: 1px solid rgb(139 181 210 / 26%);
  border-radius: 11px;
  background: rgb(255 255 255 / 72%);
  box-shadow: 0 3px 9px rgb(76 113 145 / 7%);
}

.loot-chip img {
  width: 27px;
  height: 27px;
  flex: 0 0 auto;
  object-fit: contain;
  filter: drop-shadow(0 2px 3px rgb(56 86 112 / 18%));
}

.loot-copy {
  min-width: 0;
  display: flex;
  flex-direction: column;
  line-height: 1.18;
}

.loot-copy b {
  overflow: hidden;
  font-size: 10px;
  color: var(--text);
  text-overflow: ellipsis;
  white-space: nowrap;
}

.loot-copy small {
  margin-top: 2px;
  font-size: 8px;
  color: var(--text-dim);
}

.loot-chip.tier-fine {
  border-color: rgb(80 166 216 / 36%);
  background: rgb(236 248 255 / 82%);
}

.loot-chip.tier-rare {
  border-color: rgb(157 113 222 / 38%);
  background: linear-gradient(135deg, rgb(248 240 255 / 92%), rgb(240 248 255 / 84%));
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
  transition:
    transform var(--t-fast) var(--ease-spring),
    border-color var(--t-mid) var(--ease-soft),
    background-color var(--t-mid) var(--ease-soft);
}

.stage:active:not(:disabled) {
  transform: scale(0.95);
}

.stage.on {
  position: relative;
  border-color: var(--pink);
  background: var(--pink-soft);
}

/* 当前关卡以轻微呼吸描边标记，不改变按钮内容布局。 */
.stage.on::after {
  position: absolute;
  inset: -1px;
  content: '';
  border: 1.5px solid rgb(245 121 159 / 70%);
  border-radius: inherit;
  pointer-events: none;
  animation: stage-on-pulse 2s ease-in-out infinite;
}

.stage.boss {
  border-color: var(--q-legendary);
}

.stage.on.boss::after {
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
  display: inline-flex;
  align-items: center;
  gap: 2px;
  color: var(--text-dim);
}

.tip {
  padding: 4px;
  font-size: 10px;
  line-height: 1.6;
  color: var(--text-dim);
  text-align: center;
}

.sweep-teaser {
  position: relative;
  min-height: 84px;
  display: flex;
  align-items: center;
  gap: 8px;
  overflow: hidden;
  padding: 8px 10px 8px 84px;
  background: linear-gradient(105deg, #effaff, #fff4f9);
  border: 1px solid var(--line);
  border-radius: var(--r);
}

.sweep-art {
  position: absolute;
  left: -8px;
  bottom: -20px;
  width: 100px;
  height: 100px;
  animation: sweep-breeze 3s ease-in-out infinite;
}

.sweep-copy {
  display: flex;
  flex: 1;
  flex-direction: column;
  gap: 3px;
  min-width: 0;
}

.sweep-copy strong {
  font-size: 11px;
}

.sweep-copy > span {
  font-size: 9px;
  line-height: 1.45;
  color: var(--text-dim);
}

.sweep-badge {
  flex-shrink: 0;
  padding: 3px 7px;
  font-size: 8px;
  font-weight: 700;
  color: var(--blue-deep);
  background: rgb(255 255 255 / 78%);
  border-radius: 999px;
}

/* 区域/章节展开折叠：内容轻轻落下 */
.fold-enter-from,
.fold-leave-to {
  opacity: 0;
  transform: translateY(-6px);
}

.fold-enter-active,
.fold-leave-active {
  transition:
    opacity var(--t-mid) var(--ease-soft),
    transform var(--t-mid) var(--ease-soft);
}

@keyframes stage-on-pulse {
  0%,
  100% {
    opacity: 0.25;
    transform: scale(1);
  }
  50% {
    opacity: 0.85;
    transform: scale(1.025);
  }
}

@keyframes sweep-breeze {
  0%,
  100% {
    transform: translateX(0) rotate(-1deg);
  }
  50% {
    transform: translateX(4px) rotate(1deg);
  }
}

@media (prefers-reduced-motion: reduce) {
  .sweep-art,
  .stage.on::after {
    animation: none;
  }

  .stage.on::after {
    opacity: 0.55;
    transform: none;
  }

  .region-cover,
  .chapter-cover,
  .r-chev {
    transition: none;
  }

  .fold-enter-from,
  .fold-leave-to {
    transform: none;
  }

  .fold-enter-active,
  .fold-leave-active {
    transition: none;
  }
}
</style>
