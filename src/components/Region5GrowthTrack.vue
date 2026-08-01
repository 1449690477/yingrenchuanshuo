<script setup lang="ts">
import { Check, Flame, Gem, Hammer, Sparkles } from '@lucide/vue';
import type { Region5GrowthSnapshot } from '@/data/region5Growth';

defineProps<{
  snapshot: Region5GrowthSnapshot;
}>();

defineEmits<{
  openForge: [];
}>();
</script>

<template>
  <section class="r5-growth" aria-label="熔岩神殿区域成长目标">
    <header class="growth-head">
      <span class="growth-sigil" aria-hidden="true"><Flame :size="17" /></span>
      <span>
        <small>区域 5 · 看得见的成长</small>
        <strong>熔心成长轨</strong>
      </span>
      <em :class="{ complete: snapshot.set.complete }">
        {{ snapshot.set.complete ? '全部完成' : `${snapshot.set.collectedPieces}/6 件` }}
      </em>
    </header>

    <div class="growth-nodes">
      <span class="growth-node" :class="{ done: snapshot.rhythm.unlocked }">
        <i aria-hidden="true">
          <Check v-if="snapshot.rhythm.unlocked" :size="12" />
          <Sparkles v-else :size="12" />
        </i>
        <b>Lv.{{ snapshot.rhythm.level }} 节奏跃迁</b>
        <small>{{ snapshot.rhythm.before.toFixed(1) }}× → {{ snapshot.rhythm.after.toFixed(1) }}×</small>
      </span>
      <span class="growth-node" :class="{ done: snapshot.legendary.unlocked }">
        <i aria-hidden="true">
          <Check v-if="snapshot.legendary.unlocked" :size="12" />
          <Gem v-else :size="12" />
        </i>
        <b>Lv.{{ snapshot.legendary.level }} 普通传说</b>
        <small>{{ snapshot.legendary.unlocked ? '普通传说已可掉落' : '继续深入熔心圣所' }}</small>
      </span>
    </div>

    <div class="forge-progress">
      <span class="forge-copy">
        <b>绯焰六件套</b>
        <small>{{ snapshot.nextHint }}</small>
      </span>
      <span class="forge-count num">
        {{ snapshot.set.effectiveProgress }}<i>/</i>{{ snapshot.set.target }}
      </span>
      <span class="forge-track" aria-hidden="true">
        <i :style="{ transform: `scaleX(${snapshot.set.ratio})` }" />
      </span>
      <span class="piece-dots" aria-label="绯焰套永久收集部位">
        <i
          v-for="index in snapshot.set.totalPieces"
          :key="index"
          :class="{ active: index <= snapshot.set.collectedPieces }"
        />
      </span>
      <button type="button" @click="$emit('openForge')">
        <Hammer :size="13" aria-hidden="true" />
        去背包重铸
      </button>
    </div>
  </section>
</template>

<style scoped>
.r5-growth {
  position: relative;
  display: grid;
  gap: 10px;
  overflow: hidden;
  padding: 12px;
  margin-top: 10px;
  background:
    radial-gradient(circle at 5% 0%, rgb(255 184 191 / 25%), transparent 40%),
    radial-gradient(circle at 100% 110%, rgb(151 218 255 / 22%), transparent 44%),
    linear-gradient(145deg, rgb(255 255 255 / 91%), rgb(255 247 244 / 88%));
  border: 1px solid rgb(238 177 171 / 48%);
  border-radius: var(--r-lg);
  box-shadow:
    inset 0 1px 0 rgb(255 255 255 / 92%),
    0 8px 22px rgb(130 79 72 / 8%);
}

.r5-growth::after {
  content: '';
  position: absolute;
  inset: -80% 55% auto -25%;
  height: 180%;
  background: linear-gradient(110deg, transparent 28%, rgb(255 255 255 / 48%), transparent 72%);
  transform: rotate(8deg);
  animation: glass-glint 5.8s ease-in-out infinite;
  pointer-events: none;
}

.growth-head {
  position: relative;
  z-index: 1;
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) auto;
  align-items: center;
  gap: 9px;
}

.growth-sigil {
  display: grid;
  place-items: center;
  width: 34px;
  height: 34px;
  color: #df6e6f;
  background: linear-gradient(145deg, rgb(255 255 255 / 82%), rgb(255 224 215 / 82%));
  border: 1px solid rgb(255 179 169 / 62%);
  border-radius: 12px;
  box-shadow: 0 4px 12px rgb(223 103 103 / 13%);
}

.growth-head small,
.forge-copy small {
  display: block;
  color: var(--text-dim);
  font-size: 10px;
}

.growth-head strong {
  display: block;
  margin-top: 1px;
  color: #70444b;
  font-size: 14px;
}

.growth-head em {
  padding: 4px 7px;
  color: #b35e68;
  font-size: 10px;
  font-style: normal;
  background: rgb(255 229 228 / 74%);
  border: 1px solid rgb(238 163 165 / 38%);
  border-radius: 999px;
}

.growth-head em.complete {
  color: #398e7c;
  background: rgb(218 249 240 / 80%);
  border-color: rgb(102 203 178 / 36%);
}

.growth-nodes {
  position: relative;
  z-index: 1;
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 7px;
}

.growth-node {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr);
  gap: 1px 6px;
  align-items: center;
  min-width: 0;
  padding: 8px;
  background: rgb(255 255 255 / 55%);
  border: 1px solid rgb(225 191 191 / 38%);
  border-radius: 12px;
}

.growth-node > i {
  grid-row: 1 / span 2;
  display: grid;
  place-items: center;
  width: 22px;
  height: 22px;
  color: #bf8290;
  background: rgb(250 232 238 / 78%);
  border-radius: 8px;
}

.growth-node.done > i {
  color: #fff;
  background: linear-gradient(145deg, #f78f99, #79c7bd);
  animation: node-breathe 2.8s ease-in-out infinite;
}

.growth-node b {
  overflow: hidden;
  color: #704b53;
  font-size: 10px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.growth-node small {
  overflow: hidden;
  color: var(--text-dim);
  font-size: 9px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.forge-progress {
  position: relative;
  z-index: 1;
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: 7px 10px;
  align-items: center;
  padding: 9px;
  background: linear-gradient(115deg, rgb(255 241 236 / 72%), rgb(239 249 255 / 72%));
  border: 1px solid rgb(232 180 178 / 36%);
  border-radius: 13px;
}

.forge-copy b {
  display: block;
  color: #7a4650;
  font-size: 11px;
}

.forge-count {
  color: #c45f69;
  font-size: 11px;
  font-weight: 750;
}

.forge-count i {
  margin: 0 2px;
  color: #bb97a0;
  font-style: normal;
}

.forge-track {
  grid-column: 1 / -1;
  overflow: hidden;
  height: 4px;
  background: rgb(222 195 199 / 38%);
  border-radius: 999px;
}

.forge-track i {
  display: block;
  width: 100%;
  height: 100%;
  background: linear-gradient(90deg, #f28a92, #f6b788 56%, #81cde0);
  border-radius: inherit;
  transform-origin: left center;
  transition: transform 500ms var(--ease-soft);
}

.piece-dots {
  display: flex;
  gap: 5px;
}

.piece-dots i {
  width: 8px;
  height: 8px;
  background: rgb(218 190 196 / 48%);
  border: 1px solid rgb(197 151 162 / 30%);
  border-radius: 3px;
  transform: rotate(45deg);
}

.piece-dots i.active {
  background: linear-gradient(145deg, #ff9b93, #ffc77e);
  border-color: rgb(244 135 125 / 66%);
  box-shadow: 0 0 8px rgb(244 132 120 / 32%);
}

.forge-progress button {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  justify-self: end;
  padding: 6px 9px;
  color: #a64e5b;
  font-size: 10px;
  font-weight: 700;
  background: rgb(255 255 255 / 72%);
  border: 1px solid rgb(226 150 157 / 42%);
  border-radius: 10px;
  box-shadow: 0 3px 9px rgb(170 83 93 / 8%);
  transition:
    transform var(--t-fast) var(--ease-spring),
    background-color var(--t-fast);
}

.forge-progress button:active {
  background: rgb(255 230 230 / 88%);
  transform: scale(0.94) translateY(1px);
}

@keyframes glass-glint {
  0%,
  72%,
  100% {
    transform: translateX(-35%) rotate(8deg);
    opacity: 0;
  }
  82% {
    opacity: 0.7;
  }
  94% {
    transform: translateX(210%) rotate(8deg);
    opacity: 0;
  }
}

@keyframes node-breathe {
  0%,
  100% {
    box-shadow: 0 0 0 rgb(247 143 153 / 0%);
  }
  50% {
    box-shadow: 0 0 10px rgb(247 143 153 / 32%);
  }
}

@media (max-width: 350px) {
  .r5-growth {
    padding: 10px;
  }

  .growth-nodes {
    grid-template-columns: 1fr;
  }
}

@media (prefers-reduced-motion: reduce) {
  .r5-growth::after,
  .growth-node.done > i {
    animation: none;
  }

  .forge-track i,
  .forge-progress button {
    transition: none;
  }
}
</style>
