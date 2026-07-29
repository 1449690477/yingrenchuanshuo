<script setup lang="ts">
import { useId } from 'vue';
import { ChevronDown, LockKeyhole, Sparkles } from '@lucide/vue';
import type { ActiveEquipmentSet } from '@/core/equipmentSets';
import { prefersCompactLayout, useFold } from '@/ui/useFold';

const props = withDefaults(
  defineProps<{
    sets: readonly ActiveEquipmentSet[];
    compact?: boolean;
  }>(),
  {
    compact: false,
  },
);

const titleId = useId();

/*
 * 养成页里的套装块允许整块折叠（标题栏「N 套进行中」就是速览）。
 * compact 模式（装备详情内嵌）没有标题栏，始终展开。
 */
const { open: foldOpen, toggle: toggleFold } = useFold('growth.sets', !prefersCompactLayout());
</script>

<template>
  <section class="set-status" :class="{ compact }" :aria-labelledby="titleId">
    <header class="set-status-head">
      <span class="set-status-sigil" aria-hidden="true">
        <Sparkles :size="17" :stroke-width="1.9" />
      </span>
      <span>
        <small>装备组合 · 实时生效</small>
        <strong :id="titleId">套装共鸣</strong>
      </span>
      <em v-if="sets.length > 0">{{ sets.length }} 套进行中</em>
      <button
        v-if="!props.compact"
        class="set-fold-button"
        type="button"
        :aria-expanded="foldOpen"
        :aria-label="foldOpen ? '收起套装共鸣' : '展开套装共鸣'"
        @click="toggleFold"
      >
        <ChevronDown
          :size="14"
          class="set-fold-chev"
          :class="{ closed: !foldOpen }"
          aria-hidden="true"
        />
      </button>
    </header>

    <div class="set-fold" :class="{ closed: !props.compact && !foldOpen }">
      <div class="set-fold-inner">
        <p v-if="sets.length === 0" class="set-empty">
          穿戴至少 2 件同套装备后，共鸣效果会在这里点亮。
        </p>

        <article
          v-for="set in sets"
          :key="set.definition.id"
          class="set-card"
          :class="{ complete: set.equippedPieces >= set.definition.pieceSlots.length }"
        >
          <header>
            <span>
              <small>当前穿戴</small>
              <strong>{{ set.definition.name }}</strong>
            </span>
            <b class="num">
              {{ set.equippedPieces }}
              <i>/</i>
              {{ set.definition.pieceSlots.length }}
            </b>
          </header>

          <span class="piece-track" aria-hidden="true">
            <i
              v-for="index in set.definition.pieceSlots.length"
              :key="index"
              :class="{ active: index <= set.equippedPieces }"
            />
          </span>

          <div class="bonus-grid">
            <span
              v-for="bonus in set.definition.bonuses"
              :key="bonus.pieces"
              class="bonus-node"
              :class="{
                active: set.equippedPieces >= bonus.pieces,
                next: set.nextBonus?.pieces === bonus.pieces,
              }"
              :data-state="
                set.equippedPieces >= bonus.pieces
                  ? 'active'
                  : set.nextBonus?.pieces === bonus.pieces
                    ? 'next'
                    : 'locked'
              "
            >
              <b>{{ bonus.pieces }}件 · {{ bonus.label }}</b>
              <small>{{ bonus.description }}</small>
              <Sparkles v-if="set.equippedPieces >= bonus.pieces" :size="13" aria-hidden="true" />
              <LockKeyhole v-else :size="12" aria-hidden="true" />
            </span>
          </div>

          <p v-if="set.nextBonus" class="next-hint">
            再穿 {{ set.nextBonus.pieces - set.equippedPieces }} 件，点亮
            <b>{{ set.nextBonus.label }}</b>
          </p>
          <p v-else class="next-hint complete-hint">
            <Sparkles :size="12" aria-hidden="true" />
            全部共鸣已经点亮
          </p>
        </article>
      </div>
    </div>
  </section>
</template>

<style scoped>
.set-status {
  position: relative;
  display: grid;
  gap: 9px;
  overflow: hidden;
  padding: 12px;
  background:
    radial-gradient(circle at 96% -12%, rgb(128 219 255 / 19%), transparent 38%),
    radial-gradient(circle at 3% 118%, rgb(255 143 180 / 16%), transparent 43%),
    linear-gradient(145deg, rgb(255 255 255 / 93%), rgb(251 243 249 / 91%));
  border: 1px solid rgb(228 193 209 / 50%);
  border-radius: var(--r-lg);
  box-shadow:
    inset 0 1px 0 rgb(255 255 255 / 88%),
    0 7px 19px rgb(113 82 106 / 8%);
}

.set-status-head {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) auto auto;
  align-items: center;
  gap: 8px;
}

/* 折叠开关：小圆钮贴在「N 套进行中」右侧 */
.set-fold-button {
  display: grid;
  width: 26px;
  height: 26px;
  place-items: center;
  color: #9a6278;
  background: rgb(255 237 244 / 76%);
  border-radius: 50%;
  transition: background-color var(--t-fast) var(--ease-soft);
}

.set-fold-button:active {
  background: rgb(255 214 228 / 90%);
}

.set-fold-chev {
  transition: transform var(--t-mid) var(--ease-soft);
}

.set-fold-chev.closed {
  transform: rotate(-90deg);
}

/* 0fr ↔ 1fr 折叠动画，与 CollapsibleCard 同套方案 */
.set-fold {
  display: grid;
  grid-template-rows: 1fr;
  opacity: 1;
  transition:
    grid-template-rows var(--t-mid) var(--ease-soft),
    opacity var(--t-fast) ease;
}

.set-fold.closed {
  grid-template-rows: 0fr;
  opacity: 0;
}

.set-fold-inner {
  display: grid;
  gap: 9px;
  overflow: hidden;
  min-height: 0;
}

@media (prefers-reduced-motion: reduce) {
  .set-fold,
  .set-fold-chev {
    transition: none;
  }
}

.set-status-sigil {
  width: 35px;
  height: 35px;
  display: grid;
  place-items: center;
  color: #fff;
  background: linear-gradient(145deg, #8ddcf4, #d694d6 55%, #ee8ca8);
  border: 2px solid rgb(255 255 255 / 73%);
  border-radius: 13px;
  box-shadow: 0 5px 12px rgb(166 112 165 / 19%);
}

.set-status-head > span:nth-child(2) {
  min-width: 0;
}

.set-status-head small,
.set-card header small {
  display: block;
  font-size: 8px;
  letter-spacing: 0.05em;
  color: var(--text-dim);
}

.set-status-head strong {
  display: block;
  margin-top: 1px;
  font-family: var(--font-display);
  font-size: 13px;
  color: #67505d;
}

.set-status-head em {
  padding: 4px 7px;
  font-size: 8px;
  font-style: normal;
  font-weight: 800;
  color: #9a6278;
  background: rgb(255 237 244 / 76%);
  border-radius: 999px;
}

.set-empty {
  margin: 0;
  padding: 10px;
  font-size: 9px;
  line-height: 1.45;
  color: var(--text-dim);
  background: rgb(250 248 250 / 68%);
  border: 1px dashed rgb(207 192 202 / 62%);
  border-radius: 13px;
  text-align: center;
}

.set-card {
  display: grid;
  gap: 7px;
  padding: 10px;
  background:
    radial-gradient(circle at 93% 0%, rgb(255 160 144 / 15%), transparent 39%),
    rgb(255 255 255 / 64%);
  border: 1px solid rgb(231 184 197 / 43%);
  border-radius: 17px;
  box-shadow: inset 0 1px 0 rgb(255 255 255 / 82%);
}

.set-card.complete {
  border-color: rgb(238 145 160 / 62%);
  box-shadow:
    inset 0 1px 0 rgb(255 255 255 / 90%),
    0 0 18px rgb(245 128 150 / 9%);
}

.set-card > header {
  display: flex;
  align-items: end;
  justify-content: space-between;
  gap: 8px;
}

.set-card header strong {
  display: block;
  margin-top: 1px;
  font-size: 12px;
  color: #774b5a;
}

.set-card header > b {
  font-size: 16px;
  color: #e36884;
}

.set-card header > b i {
  margin: 0 1px;
  font-size: 10px;
  font-style: normal;
  color: #baa6ad;
}

.piece-track {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(14px, 1fr));
  gap: 4px;
}

.piece-track i {
  height: 4px;
  background: rgb(184 169 176 / 16%);
  border-radius: 999px;
}

.piece-track i.active {
  background: linear-gradient(90deg, #f187a2, #f2ae7c);
  box-shadow: 0 0 6px rgb(238 115 144 / 24%);
}

.bonus-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 5px;
}

.bonus-node {
  position: relative;
  min-width: 0;
  display: grid;
  gap: 2px;
  padding: 7px 24px 7px 7px;
  color: #9a8b91;
  background: rgb(242 239 241 / 65%);
  border: 1px dashed rgb(199 187 193 / 58%);
  border-radius: 11px;
}

.bonus-node > b,
.bonus-node > small {
  overflow: hidden;
  text-overflow: ellipsis;
}

.bonus-node > b {
  font-size: 8px;
  white-space: nowrap;
}

.bonus-node > small {
  font-size: 7px;
  line-height: 1.35;
}

.bonus-node > svg {
  position: absolute;
  top: 7px;
  right: 7px;
  opacity: 0.45;
}

.bonus-node.next {
  border-style: solid;
  border-color: rgb(220 168 186 / 55%);
  background: rgb(255 246 250 / 68%);
}

.bonus-node.active {
  color: #7e4d5c;
  background: linear-gradient(135deg, rgb(255 231 237 / 80%), rgb(255 244 232 / 76%));
  border-style: solid;
  border-color: rgb(235 149 169 / 55%);
  box-shadow: inset 0 0 12px rgb(244 128 151 / 7%);
}

.bonus-node.active > svg {
  color: #ee708d;
  opacity: 1;
}

.next-hint {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 3px;
  margin: 0;
  padding: 5px 7px;
  font-size: 8px;
  color: #97717f;
  background: rgb(255 247 250 / 62%);
  border-radius: 999px;
}

.complete-hint {
  color: #338f7f;
  background: rgb(232 252 247 / 68%);
}

.compact {
  padding: 9px;
  border-radius: 15px;
}

.compact .set-status-head {
  display: none;
}

.compact .set-card {
  padding: 8px;
  border-radius: 13px;
}

.compact .bonus-node {
  padding: 6px 21px 6px 6px;
}

@media (max-width: 350px) {
  .bonus-grid {
    grid-template-columns: 1fr;
  }
}

@media (prefers-reduced-motion: reduce) {
  .piece-track i.active {
    box-shadow: none;
  }
}
</style>
