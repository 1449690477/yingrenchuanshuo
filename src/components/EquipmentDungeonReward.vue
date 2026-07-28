<script setup lang="ts">
import { computed } from 'vue';
import { Gift, Sparkles } from '@lucide/vue';
import type { EquipmentInstance, Quality } from '@/core/types';
import { AFFIX_LABELS, QUALITY_LABELS } from '@/data/constants';
import { requireEquipment } from '@/data/equipment';
import EquipmentIcon from './EquipmentIcon.vue';

const props = defineProps<{
  instances: readonly EquipmentInstance[];
  firstClear: boolean;
}>();

const rewards = computed(() =>
  props.instances.map((instance) => ({
    instance,
    definition: requireEquipment(instance.defId),
  })),
);

/**
 * 高品质掉落才配拿到额外的揭晓演出。
 *
 * 副本每天能打 3 次，蓝装是常态、神话是惊喜。
 * 如果每一件都金光四射，真正稀有的那件反而没了分量 ——
 * 稀缺感是靠对比撑起来的，不是靠特效堆出来的。
 */
const PRIZE_QUALITIES = new Set<Quality>(['legendary', 'mythic', 'divine']);
function isPrize(quality: Quality): boolean {
  return PRIZE_QUALITIES.has(quality);
}
</script>

<template>
  <section class="reward-panel" aria-live="polite">
    <span class="reward-burst" aria-hidden="true">
      <i v-for="index in 8" :key="index" :style="{ '--spark-index': index }">✦</i>
    </span>
    <header>
      <span class="gift-mark"><Gift :size="18" aria-hidden="true" /></span>
      <span>
        <strong>{{ firstClear ? '首通收藏入库！' : '本次定向掉落' }}</strong>
        <small>{{
          firstClear
            ? '首通额外赠送一次同表掉落；两件胚子与词条均已真实掷出。'
            : '胚子与剩余词条已真实掷出，可在背包继续比较。'
        }}</small>
      </span>
    </header>

    <div class="reward-list">
      <article
        v-for="({ instance, definition }, index) in rewards"
        :key="instance.uid"
        class="reward-item"
        :class="[`quality-${definition.quality}`, { 'is-prize': isPrize(definition.quality) }]"
        :style="{ '--card-index': index }"
      >
        <EquipmentIcon
          :def="definition"
          :enhance="instance.enhance"
          :locked="instance.locked"
          size="lg"
          decorative
        />
        <div class="reward-copy">
          <span class="quality-line">
            <Sparkles :size="12" aria-hidden="true" />
            {{ QUALITY_LABELS[definition.quality] }}
            <b v-if="instance.baseRollPermille >= 1121">奇迹胚子</b>
            <b v-else-if="instance.baseRollPermille >= 1061">精工胚子</b>
          </span>
          <strong>{{ definition.name }}</strong>
          <small>基础胚子 {{ (instance.baseRollPermille / 10).toFixed(1) }}%</small>
          <div class="affix-pills">
            <span v-for="affix in definition.fixedAffixes ?? []" :key="`fixed-${affix.key}`">
              定向 · {{ AFFIX_LABELS[affix.key] }}
            </span>
            <span v-for="affix in instance.affixes" :key="`random-${affix.key}`">
              随机 · {{ AFFIX_LABELS[affix.key] }}
            </span>
          </div>
        </div>
      </article>
    </div>
  </section>
</template>

<style scoped>
.reward-panel {
  position: relative;
  display: grid;
  gap: 10px;
  padding: 12px;
  overflow: hidden;
  background:
    radial-gradient(circle at 50% -15%, rgb(255 230 155 / 58%), transparent 48%),
    linear-gradient(155deg, rgb(255 255 255 / 98%), rgb(255 244 249 / 96%));
  border: 1px solid rgb(255 255 255 / 85%);
  border-radius: 18px;
  box-shadow:
    inset 0 0 0 1px rgb(255 190 215 / 22%),
    0 12px 26px rgb(89 73 118 / 16%);
}

header {
  position: relative;
  z-index: 1;
  display: flex;
  align-items: center;
  gap: 9px;
}

header > span:last-child {
  display: grid;
  gap: 2px;
}

header strong {
  font-size: 13px;
  color: var(--text);
}

header small,
.reward-copy small {
  font-size: 9px;
  color: var(--text-dim);
}

.gift-mark {
  display: grid;
  width: 34px;
  height: 34px;
  place-items: center;
  color: #fff;
  background: linear-gradient(145deg, #ff8bad, #a886ef);
  border-radius: 12px;
  box-shadow: 0 5px 12px rgb(219 105 157 / 28%);
}

.reward-list {
  position: relative;
  z-index: 1;
  display: grid;
  gap: 8px;
}

.reward-item {
  --reward-color: var(--q-rare);
  display: flex;
  align-items: center;
  gap: 11px;
  min-width: 0;
  padding: 9px;
  background: rgb(255 255 255 / 76%);
  border: 1px solid color-mix(in srgb, var(--reward-color) 28%, white);
  border-radius: 15px;
}

.quality-epic {
  --reward-color: var(--q-epic);
}

.quality-legendary {
  --reward-color: var(--q-legendary);
}

.quality-mythic {
  --reward-color: var(--q-mythic);
}

.reward-copy {
  display: grid;
  flex: 1;
  gap: 3px;
  min-width: 0;
}

.reward-copy > strong {
  overflow: hidden;
  font-size: 12px;
  color: var(--reward-color);
  text-overflow: ellipsis;
  white-space: nowrap;
}

.quality-line {
  display: flex;
  align-items: center;
  gap: 3px;
  font-size: 9px;
  font-weight: 800;
  color: var(--reward-color);
}

.quality-line b {
  padding: 1px 5px;
  margin-left: 3px;
  font-size: 8px;
  color: #b16513;
  background: #fff1c8;
  border-radius: 999px;
}

.affix-pills {
  display: flex;
  flex-wrap: wrap;
  gap: 3px;
}

.affix-pills span {
  padding: 2px 5px;
  font-size: 8px;
  color: var(--text-mid);
  background: color-mix(in srgb, var(--reward-color) 9%, white);
  border-radius: 999px;
}

.reward-burst {
  position: absolute;
  inset: 0;
  pointer-events: none;
}

.reward-burst i {
  --angle: calc(var(--spark-index) * 45deg);
  position: absolute;
  top: 48%;
  left: 50%;
  color: #ffd76c;
  font-size: 10px;
  opacity: 0;
  animation: reward-spark 1.4s ease-out both;
  animation-delay: calc(var(--spark-index) * 45ms);
}

@keyframes reward-spark {
  0% {
    opacity: 0;
    transform: translate(-50%, -50%) rotate(var(--angle)) translateX(8px) scale(0.4);
  }
  28% {
    opacity: 1;
  }
  100% {
    opacity: 0;
    transform: translate(-50%, -50%) rotate(var(--angle)) translateX(115px) scale(1.15);
  }
}

@media (prefers-reduced-motion: reduce) {
  .reward-burst {
    display: none;
  }
}

/* ── 逐张揭晓 ── */

/*
 * 卡片依次浮上来，而不是一次性平铺。
 * 首通会掉两件，同时出现的话玩家的目光没有落点；
 * 错开 140ms 就能形成「一件、又一件」的节奏。
 */
.reward-item {
  animation: reward-card-in 0.44s var(--ease-out-back, cubic-bezier(0.2, 1.25, 0.4, 1)) both;
  animation-delay: calc(var(--card-index, 0) * 140ms);
}

@keyframes reward-card-in {
  0% {
    opacity: 0;
    transform: translateY(14px) scale(0.96);
  }
  100% {
    opacity: 1;
    transform: translateY(0) scale(1);
  }
}

/*
 * 传说及以上再加一层光晕呼吸，普通掉落保持安静。
 *
 * 用 box-shadow 而不是垫一层伪元素：卡片因为有入场动画（transform）
 * 已经形成层叠上下文，此时 z-index:-1 的伪元素会盖在卡片白底之上，
 * 把整张卡染成金粉色 —— 想要的是描边发光，不是整块变色。
 */
.reward-item.is-prize {
  animation:
    reward-card-in 0.44s var(--ease-out-back, cubic-bezier(0.2, 1.25, 0.4, 1)) both,
    prize-halo 1.8s ease-in-out calc(var(--card-index, 0) * 140ms + 0.3s) 2;
}

@keyframes prize-halo {
  0%,
  100% {
    box-shadow: 0 0 0 rgb(255 214 132 / 0%);
  }
  50% {
    box-shadow:
      0 0 0 2px rgb(255 214 132 / 65%),
      0 0 18px rgb(255 154 204 / 55%);
  }
}

@media (prefers-reduced-motion: reduce) {
  .reward-item,
  .reward-item.is-prize {
    animation: none;
    opacity: 1;
  }

  /* 动效关掉了，但「这件是好东西」的信息要留住 */
  .reward-item.is-prize {
    box-shadow: 0 0 0 2px rgb(255 214 132 / 55%);
  }
}
</style>
