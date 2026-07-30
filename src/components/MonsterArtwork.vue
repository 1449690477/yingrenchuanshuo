<script setup lang="ts">
import { computed } from 'vue';
import type { MonsterDef } from '@/core/types';
import { requireMonsterMotionTiming, type MonsterAction } from '@/data/battleMotions';
import { requireMonsterVisual } from '@/data/monsterVisuals';

const props = withDefaults(
  defineProps<{
    monster: MonsterDef;
    variant?: 'battle' | 'thumb';
    action?: MonsterAction;
    awakening?: boolean;
  }>(),
  {
    variant: 'battle',
    action: 'idle',
    awakening: false,
  },
);

const visual = computed(() => requireMonsterVisual(props.monster.id));
const timing = computed(() => requireMonsterMotionTiming(visual.value.motion));
const spriteUrl = computed(() => `${import.meta.env.BASE_URL}${visual.value.asset}`);
const motionStyle = computed<Record<string, string>>(() => ({
  '--monster-attack-ms': `${timing.value.attackMs}ms`,
  '--monster-impact-ms': `${timing.value.impactMs}ms`,
  '--monster-hit-ms': `${timing.value.hitMs}ms`,
  '--monster-defeat-ms': `${timing.value.defeatMs}ms`,
}));
</script>

<template>
  <span
    class="monster-art"
    :class="[
      `is-${variant}`,
      `type-${monster.type}`,
      `motion-${visual.motion}`,
      `action-${action}`,
      { 'is-statue-awakening': awakening && visual.statueAwaken },
    ]"
    :style="motionStyle"
    role="img"
    :aria-label="`${monster.name}怪物形象`"
  >
    <img :src="spriteUrl" alt="" draggable="false" decoding="async" />
  </span>
</template>

<style scoped>
.monster-art {
  position: relative;
  display: grid;
  place-items: center;
  flex-shrink: 0;
  transform-origin: 50% 92%;
}

img {
  display: block;
  width: 100%;
  height: 100%;
  object-fit: contain;
  filter: drop-shadow(0 3px 3px rgb(58 53 81 / 17%));
  pointer-events: none;
  transform-origin: 50% 92%;
  will-change: transform, opacity, filter;
}

.is-battle {
  width: 82px;
  height: 82px;
}

.is-battle.type-boss {
  width: 88px;
  height: 88px;
}

.is-thumb {
  width: 22px;
  height: 22px;
}

/* 六套静止呼吸：小怪的体型与运动习惯不再只有同一种上下漂浮。 */
.is-battle.action-idle.motion-flutter img {
  animation: monster-idle-flutter 2.1s ease-in-out infinite;
}

.is-battle.action-idle.motion-hopper img {
  animation: monster-idle-hopper 1.55s cubic-bezier(0.42, 0, 0.36, 1) infinite;
}

.is-battle.action-idle.motion-bounce img {
  animation: monster-idle-bounce 1.7s ease-in-out infinite;
}

.is-battle.action-idle.motion-sway img {
  animation: monster-idle-sway 2.45s ease-in-out infinite;
}

.is-battle.action-idle.motion-guard img {
  animation: monster-idle-guard 2.2s ease-in-out infinite;
}

.is-battle.action-idle.motion-royal img {
  animation: monster-idle-royal 2.8s ease-in-out infinite;
}

/* 每个模组都有明确的蓄力、出手、回收三段。 */
.is-battle.action-attack.motion-flutter img {
  animation: monster-attack-flutter var(--monster-attack-ms) ease-out both;
}

.is-battle.action-attack.motion-hopper img {
  animation: monster-attack-hopper var(--monster-attack-ms) cubic-bezier(0.22, 0.78, 0.3, 1) both;
}

.is-battle.action-attack.motion-bounce img {
  animation: monster-attack-bounce var(--monster-attack-ms) cubic-bezier(0.24, 0.74, 0.32, 1) both;
}

.is-battle.action-attack.motion-sway img {
  animation: monster-attack-sway var(--monster-attack-ms) ease-out both;
}

.is-battle.action-attack.motion-guard img {
  animation: monster-attack-guard var(--monster-attack-ms) cubic-bezier(0.2, 0.72, 0.24, 1) both;
}

.is-battle.action-attack.motion-royal img {
  animation: monster-attack-royal var(--monster-attack-ms) cubic-bezier(0.18, 0.7, 0.22, 1) both;
}

.is-battle.action-hit img {
  animation: monster-hit var(--monster-hit-ms) ease-out both;
}

.is-battle.action-hit.motion-bounce img,
.is-battle.action-hit.motion-hopper img {
  animation-name: monster-hit-soft;
}

.is-battle.action-hit.motion-guard img,
.is-battle.action-hit.motion-royal img {
  animation-name: monster-hit-heavy;
}

.is-battle.action-defeat img {
  animation: monster-defeat var(--monster-defeat-ms) ease-in both;
}

.is-battle.action-defeat.motion-flutter img {
  animation-name: monster-defeat-flutter;
}

.is-battle.action-defeat.motion-bounce img,
.is-battle.action-defeat.motion-hopper img {
  animation-name: monster-defeat-soft;
}

.is-battle.action-defeat.motion-royal img {
  animation-name: monster-defeat-royal;
}

.is-thumb img {
  animation: none !important;
}

/*
 * 幽影祀塔的石像怪先以真正的“石材静止态”入场，再由符文裂光唤醒。
 * 这只是可辨认的出场演出，不提供额外伤害或隐藏数值优势。
 */
.is-battle.is-statue-awakening::before,
.is-battle.is-statue-awakening::after {
  content: '';
  position: absolute;
  z-index: 2;
  pointer-events: none;
}

.is-battle.is-statue-awakening::before {
  inset: 8% 12% 12%;
  border-radius: 48% 52% 44% 56%;
  background:
    linear-gradient(112deg, transparent 43%, rgb(185 164 255 / 88%) 45% 47%, transparent 49%),
    linear-gradient(68deg, transparent 52%, rgb(116 227 255 / 82%) 54% 56%, transparent 58%);
  filter: drop-shadow(0 0 5px rgb(163 125 255 / 70%));
  opacity: 0;
  animation: statue-rune-crack 480ms cubic-bezier(0.22, 0.78, 0.3, 1) both;
}

.is-battle.is-statue-awakening::after {
  inset: 4%;
  border-radius: 50%;
  border: 1px solid rgb(192 170 255 / 0%);
  box-shadow: 0 0 0 0 rgb(147 207 255 / 0%);
  animation: statue-awaken-ring 480ms ease-out both;
}

.is-battle.is-statue-awakening img {
  animation: statue-awaken 480ms cubic-bezier(0.2, 0.7, 0.24, 1) both !important;
}

@keyframes statue-awaken {
  0%,
  23% {
    transform: translateY(3%) scale(0.97);
    filter: grayscale(1) saturate(0.25) brightness(0.7) contrast(1.12)
      drop-shadow(0 3px 3px rgb(58 53 81 / 12%));
  }
  48% {
    transform: translateY(-1%) scale(1.035);
    filter: grayscale(0.7) saturate(0.6) brightness(1.35) contrast(1.06)
      drop-shadow(0 0 8px rgb(175 139 255 / 62%));
  }
  72% {
    transform: translateY(-2%) scale(1.06);
    filter: grayscale(0.08) saturate(1.16) brightness(1.18)
      drop-shadow(0 0 10px rgb(115 220 255 / 46%));
  }
  100% {
    transform: translateY(0) scale(1);
    filter: grayscale(0) saturate(1) brightness(1)
      drop-shadow(0 3px 3px rgb(58 53 81 / 17%));
  }
}

@keyframes statue-rune-crack {
  0%,
  29% {
    opacity: 0;
  }
  45%,
  66% {
    opacity: 1;
  }
  100% {
    opacity: 0;
  }
}

@keyframes statue-awaken-ring {
  0%,
  42% {
    opacity: 0;
    transform: scale(0.72);
  }
  54% {
    opacity: 0.9;
    transform: scale(0.82);
    border-color: rgb(192 170 255 / 78%);
    box-shadow: 0 0 0 2px rgb(147 207 255 / 24%);
  }
  100% {
    opacity: 0;
    transform: scale(1.16);
    border-color: rgb(192 170 255 / 0%);
    box-shadow: 0 0 0 10px rgb(147 207 255 / 0%);
  }
}

@keyframes monster-idle-flutter {
  0%,
  100% {
    transform: translate(0, 1%) rotate(-0.7deg);
  }
  50% {
    transform: translate(-1.8%, -5%) rotate(1.1deg);
  }
}

@keyframes monster-idle-hopper {
  0%,
  100% {
    transform: translateY(0) scale(1, 1);
  }
  44% {
    transform: translateY(-4%) scale(0.98, 1.025);
  }
  62% {
    transform: translateY(0) scale(1.025, 0.975);
  }
}

@keyframes monster-idle-bounce {
  0%,
  100% {
    transform: translateY(0) scale(1, 1);
  }
  46% {
    transform: translateY(-2.5%) scale(0.97, 1.035);
  }
  68% {
    transform: translateY(0.5%) scale(1.035, 0.965);
  }
}

@keyframes monster-idle-sway {
  0%,
  100% {
    transform: rotate(-1.2deg) translateY(0);
  }
  50% {
    transform: rotate(1.5deg) translateY(-1.5%);
  }
}

@keyframes monster-idle-guard {
  0%,
  100% {
    transform: translateY(0) scale(1);
  }
  50% {
    transform: translateY(-1%) scale(1.012, 0.995);
  }
}

@keyframes monster-idle-royal {
  0%,
  100% {
    transform: translateY(0) scale(1);
    filter: brightness(1) drop-shadow(0 3px 3px rgb(58 53 81 / 20%));
  }
  50% {
    transform: translateY(-1.8%) scale(1.012);
    filter: brightness(1.06) drop-shadow(0 5px 7px rgb(255 170 115 / 28%));
  }
}

@keyframes monster-attack-flutter {
  0%,
  100% {
    transform: translate(0) rotate(0) scale(1);
  }
  24% {
    transform: translate(5%, -8%) rotate(5deg) scale(0.94);
  }
  54% {
    transform: translate(-28%, 2%) rotate(-7deg) scale(1.07);
  }
  72% {
    transform: translate(-19%, -1%) rotate(3deg) scale(1.025);
  }
}

@keyframes monster-attack-hopper {
  0%,
  100% {
    transform: translate(0) scale(1);
  }
  22% {
    transform: translate(4%, 4%) scale(1.06, 0.91);
  }
  52% {
    transform: translate(-27%, -10%) scale(0.96, 1.08) rotate(-4deg);
  }
  72% {
    transform: translate(-18%, -3%) scale(1.03, 0.98);
  }
}

@keyframes monster-attack-bounce {
  0%,
  100% {
    transform: translate(0) scale(1);
  }
  24% {
    transform: translate(4%, 1%) scale(1.13, 0.84);
  }
  52% {
    transform: translate(-25%, -2%) scale(0.93, 1.1);
  }
  70% {
    transform: translate(-15%, 0) scale(1.05, 0.96);
  }
}

@keyframes monster-attack-sway {
  0%,
  100% {
    transform: translate(0) rotate(0) scale(1);
    filter: brightness(1);
  }
  30% {
    transform: translate(4%, -1%) rotate(5deg) scale(1.02);
    filter: brightness(1.12);
  }
  58% {
    transform: translate(-23%, -2%) rotate(-6deg) scale(1.06);
    filter: brightness(1.2);
  }
}

@keyframes monster-attack-guard {
  0%,
  100% {
    transform: translate(0) scale(1);
  }
  28% {
    transform: translate(5%, 2%) scale(1.04, 0.97) rotate(2deg);
  }
  58% {
    transform: translate(-26%, -1%) scale(1.075, 0.98) rotate(-3deg);
  }
  76% {
    transform: translate(-17%, 0) scale(1.03);
  }
}

@keyframes monster-attack-royal {
  0%,
  100% {
    transform: translate(0) scale(1);
    filter: brightness(1);
  }
  30% {
    transform: translate(3%, -2%) scale(1.075);
    filter: brightness(1.2) saturate(1.12);
  }
  58% {
    transform: translate(-24%, 1%) scale(1.1, 0.97);
    filter: brightness(1.3) saturate(1.18);
  }
  78% {
    transform: translate(-13%, -1%) scale(1.045);
  }
}

@keyframes monster-hit {
  0%,
  100% {
    transform: translateX(0) rotate(0) scale(1);
    filter: brightness(1);
  }
  34% {
    transform: translateX(9%) rotate(4deg) scale(0.94);
    filter: brightness(1.65) saturate(0.72);
  }
  66% {
    transform: translateX(-2%) rotate(-1deg) scale(1.02);
  }
}

@keyframes monster-hit-soft {
  0%,
  100% {
    transform: translateX(0) scale(1);
    filter: brightness(1);
  }
  34% {
    transform: translate(8%, 2%) scale(1.08, 0.84);
    filter: brightness(1.7) saturate(0.7);
  }
  66% {
    transform: translateX(-2%) scale(0.98, 1.035);
  }
}

@keyframes monster-hit-heavy {
  0%,
  100% {
    transform: translateX(0) scale(1);
    filter: brightness(1);
  }
  36% {
    transform: translateX(5%) rotate(1.5deg) scale(0.975);
    filter: brightness(1.55) saturate(0.78);
  }
  68% {
    transform: translateX(-1%) scale(1.01);
  }
}

@keyframes monster-defeat {
  0% {
    opacity: 1;
    transform: translate(0) rotate(0) scale(1);
    filter: brightness(1);
  }
  38% {
    opacity: 1;
    transform: translate(8%, -2%) rotate(5deg) scale(0.94);
    filter: brightness(1.7) saturate(0.66);
  }
  100% {
    opacity: 0;
    transform: translate(18%, 12%) rotate(13deg) scale(0.52);
    filter: brightness(1.9) saturate(0.35);
  }
}

@keyframes monster-defeat-flutter {
  0% {
    opacity: 1;
    transform: translate(0) rotate(0) scale(1);
  }
  42% {
    opacity: 0.9;
    transform: translate(7%, -8%) rotate(9deg) scale(0.94);
  }
  100% {
    opacity: 0;
    transform: translate(22%, 17%) rotate(27deg) scale(0.38);
    filter: brightness(1.8);
  }
}

@keyframes monster-defeat-soft {
  0% {
    opacity: 1;
    transform: translateY(0) scale(1);
  }
  40% {
    opacity: 1;
    transform: translate(6%, 2%) scale(1.14, 0.76);
    filter: brightness(1.65);
  }
  100% {
    opacity: 0;
    transform: translate(14%, 12%) scale(1.28, 0.18);
    filter: brightness(1.9) saturate(0.45);
  }
}

@keyframes monster-defeat-royal {
  0% {
    opacity: 1;
    transform: translate(0) scale(1);
    filter: brightness(1);
  }
  44% {
    opacity: 1;
    transform: translate(4%, -1%) scale(1.04);
    filter: brightness(1.7) saturate(0.8);
  }
  100% {
    opacity: 0;
    transform: translate(12%, 5%) scale(0.72);
    filter: brightness(2.1) saturate(0.32) blur(1.2px);
  }
}

@media (prefers-reduced-motion: reduce) {
  .is-battle img {
    animation: none !important;
  }

  .is-battle.is-statue-awakening::before,
  .is-battle.is-statue-awakening::after {
    display: none;
  }
}
</style>
