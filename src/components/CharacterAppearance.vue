<script setup lang="ts">
import { computed } from 'vue';
import type { ClassId } from '@/core/types';
import {
  resolveCharacterAppearance,
  type CharacterAction,
  type CharacterVariant,
  type EquippedRecord,
  type ResolvedAppearanceLayer,
} from '@/data/characterAppearance';

const props = withDefaults(
  defineProps<{
    classId: ClassId;
    level: number;
    equipped?: EquippedRecord | null;
    variant?: CharacterVariant;
    action?: CharacterAction;
  }>(),
  {
    equipped: null,
    variant: 'showcase',
    action: 'idle',
  },
);

const appearance = computed(() =>
  resolveCharacterAppearance(props.classId, props.level, props.equipped),
);

const assetUrl = (asset: string) => `${import.meta.env.BASE_URL}${asset}`;

function layerStyle(layer: ResolvedAppearanceLayer): Record<string, string> {
  return {
    '--layer-scale': String(layer.transform.scale),
    '--layer-x': `${layer.transform.x}%`,
    '--layer-y': `${layer.transform.y}%`,
    '--layer-rotate': `${layer.transform.rotate ?? 0}deg`,
  };
}
</script>

<template>
  <span
    class="character-appearance"
    :class="[
      `is-${variant}`,
      `action-${action}`,
      `tier-${appearance.growthTier.id}`,
      `quality-${appearance.highestVisibleQuality}`,
      `enhance-${appearance.enhanceStage}`,
    ]"
    role="img"
    :aria-label="appearance.ariaLabel"
    :data-appearance-signature="appearance.signature"
  >
    <span class="growth-aura" aria-hidden="true">
      <i class="aura-ring ring-one" />
      <i class="aura-ring ring-two" />
      <i class="aura-emblem">✦</i>
    </span>

    <span class="doll" aria-hidden="true">
      <img
        class="base-layer"
        :src="assetUrl(appearance.baseAsset)"
        alt=""
        draggable="false"
        decoding="async"
      />
      <img
        v-for="layer in appearance.layers"
        :key="`${layer.slot}:${layer.id}`"
        class="equip-layer"
        :class="[`slot-${layer.slot}`, `q-${layer.quality}`, `plus-${layer.enhance}`]"
        :style="layerStyle(layer)"
        :src="assetUrl(layer.asset)"
        alt=""
        draggable="false"
        decoding="async"
      />
      <span class="weapon-trail" />
    </span>

    <span class="growth-particles" aria-hidden="true">
      <i v-for="n in 9" :key="n" />
    </span>
  </span>
</template>

<style scoped>
.character-appearance {
  isolation: isolate;
  position: relative;
  display: block;
  width: 100%;
  height: 100%;
  overflow: visible;
  transform: translateZ(0);
}

.doll,
.growth-aura,
.growth-particles {
  position: absolute;
  inset: 0;
}

.doll {
  z-index: 2;
  transform-origin: 50% 91%;
}

.base-layer,
.equip-layer {
  position: absolute;
  inset: 0;
  display: block;
  width: 100%;
  height: 100%;
  object-fit: contain;
  pointer-events: none;
  user-select: none;
}

.base-layer {
  z-index: 1;
  filter: drop-shadow(0 7px 5px rgb(38 47 69 / 18%));
}

.equip-layer {
  --layer-scale: 1;
  --layer-x: 0%;
  --layer-y: 0%;
  --layer-rotate: 0deg;
  z-index: 3;
  transform: translate(var(--layer-x), var(--layer-y)) scale(var(--layer-scale))
    rotate(var(--layer-rotate));
  transform-origin: 50% 50%;
  filter: drop-shadow(0 3px 3px rgb(50 48 71 / 16%));
}

.slot-body {
  z-index: 3;
}

.slot-head {
  z-index: 4;
}

.slot-weapon {
  z-index: 5;
}

.q-fine {
  filter: drop-shadow(0 2px 4px rgb(91 194 137 / 24%));
}

.q-rare {
  filter: drop-shadow(0 2px 5px rgb(90 170 232 / 34%));
}

.q-epic {
  filter: drop-shadow(0 2px 6px rgb(159 105 220 / 42%));
}

.q-legendary,
.q-mythic,
.q-divine {
  filter:
    drop-shadow(0 2px 6px rgb(255 181 91 / 44%))
    drop-shadow(0 0 4px rgb(255 236 178 / 55%));
}

.growth-aura {
  z-index: 0;
  display: grid;
  place-items: center;
  pointer-events: none;
}

/* 成长符文只服务于养成展示，战斗中会与攻击特效重叠并显得突然。 */
.is-battle .growth-aura {
  display: none;
}

.aura-ring {
  position: absolute;
  left: 50%;
  bottom: 9%;
  width: 48%;
  aspect-ratio: 1;
  opacity: 0;
  border: 1px solid rgb(255 169 206 / 50%);
  border-radius: 50%;
  box-shadow:
    inset 0 0 16px rgb(255 167 205 / 18%),
    0 0 15px rgb(119 201 244 / 16%);
  transform: translateX(-50%) rotateX(68deg);
}

.ring-two {
  bottom: 37%;
  width: 69%;
  border-style: dashed;
  transform: translateX(-50%) rotate(18deg);
}

.aura-emblem {
  position: absolute;
  top: 23%;
  left: 50%;
  opacity: 0;
  font-size: clamp(22px, 14%, 54px);
  color: #fff7bd;
  text-shadow:
    0 0 9px #ffd4e6,
    0 0 18px #8ecff5;
  transform: translateX(-50%);
}

.tier-bloom .ring-one,
.tier-moon .ring-one,
.tier-star .ring-one,
.tier-legend .ring-one {
  opacity: 0.82;
}

.tier-moon .ring-two,
.tier-star .ring-two,
.tier-legend .ring-two {
  opacity: 0.46;
}

.tier-star .aura-emblem,
.tier-legend .aura-emblem {
  opacity: 0.9;
}

.tier-legend .growth-aura {
  background: radial-gradient(circle at 50% 42%, rgb(255 244 191 / 26%), transparent 37%);
}

.growth-particles {
  z-index: 6;
  overflow: visible;
  pointer-events: none;
}

.growth-particles i {
  --particle-x: 18%;
  --particle-y: 31%;
  position: absolute;
  left: var(--particle-x);
  top: var(--particle-y);
  width: 5px;
  height: 7px;
  opacity: 0;
  background: #ffaac9;
  border: 1px solid rgb(255 255 255 / 75%);
  border-radius: 80% 20% 70% 30%;
  box-shadow: 0 0 5px rgb(255 196 219 / 72%);
}

.tier-bloom .growth-particles i:nth-child(-n + 3),
.tier-moon .growth-particles i:nth-child(-n + 5),
.tier-star .growth-particles i:nth-child(-n + 7),
.tier-legend .growth-particles i {
  opacity: 0.74;
  animation: character-petal 3.2s ease-in-out infinite;
}

.growth-particles i:nth-child(2) {
  --particle-x: 77%;
  --particle-y: 25%;
  animation-delay: -0.7s !important;
}

.growth-particles i:nth-child(3) {
  --particle-x: 13%;
  --particle-y: 58%;
  animation-delay: -1.45s !important;
}

.growth-particles i:nth-child(4) {
  --particle-x: 84%;
  --particle-y: 55%;
  width: 4px;
  height: 4px;
  background: #9bd9ff;
  animation-delay: -2.1s !important;
}

.growth-particles i:nth-child(5) {
  --particle-x: 27%;
  --particle-y: 73%;
  background: #ffe6a8;
  animation-delay: -2.65s !important;
}

.growth-particles i:nth-child(6) {
  --particle-x: 69%;
  --particle-y: 71%;
  animation-delay: -1.1s !important;
}

.growth-particles i:nth-child(7) {
  --particle-x: 88%;
  --particle-y: 39%;
  background: #c7b8ff;
  animation-delay: -2.45s !important;
}

.growth-particles i:nth-child(8) {
  --particle-x: 38%;
  --particle-y: 18%;
  width: 4px;
  height: 4px;
  background: #fff;
  animation-delay: -1.8s !important;
}

.growth-particles i:nth-child(9) {
  --particle-x: 59%;
  --particle-y: 12%;
  background: #fff2aa;
  animation-delay: -0.3s !important;
}

.weapon-trail {
  position: absolute;
  z-index: 6;
  left: 2%;
  bottom: 34%;
  width: 43%;
  height: 15%;
  opacity: 0;
  background: radial-gradient(ellipse, rgb(154 220 255 / 56%), transparent 68%);
  border-top: 2px solid rgb(255 180 214 / 72%);
  border-radius: 50%;
  filter: blur(1px);
  transform: rotate(-28deg);
  pointer-events: none;
}

.enhance-1 .weapon-trail,
.enhance-2 .weapon-trail,
.enhance-3 .weapon-trail,
.enhance-4 .weapon-trail {
  opacity: 0.38;
}

.enhance-2 .weapon-trail {
  opacity: 0.58;
  box-shadow: 0 0 8px #8fd7ff;
}

.enhance-3 .weapon-trail,
.enhance-4 .weapon-trail {
  opacity: 0.76;
  box-shadow:
    0 0 9px #8fd7ff,
    0 0 16px #ff9fca;
}

.action-idle .doll {
  animation: character-idle 2.6s ease-in-out infinite;
}

.is-battle {
  animation: character-idle 2.6s ease-in-out infinite;
}

.is-battle.action-idle .doll {
  animation: none;
}

.action-attack .doll {
  animation: character-attack 0.62s cubic-bezier(0.24, 0.82, 0.32, 1);
}

.action-attack .weapon-trail {
  animation: weapon-sweep 0.62s ease-out;
}

.action-cast .doll {
  animation: character-cast 0.82s ease-out;
}

.action-cast .growth-aura {
  animation: aura-cast 0.82s ease-out;
}

.action-react .doll {
  animation: character-react 0.72s ease-out;
}

.is-avatar .growth-aura,
.is-avatar .growth-particles {
  display: none;
}

.is-avatar {
  overflow: hidden;
  border-radius: 50%;
}

.is-avatar .doll {
  animation: none;
  transform: scale(3.7);
  transform-origin: 50% 14%;
}

@keyframes character-idle {
  0%,
  100% {
    transform: translateY(0) rotate(0);
  }
  50% {
    transform: translateY(-0.8%) rotate(-0.35deg);
  }
}

@keyframes character-attack {
  0%,
  100% {
    transform: scale(1) rotate(0);
  }
  18% {
    transform: scale(0.995) rotate(-0.2deg);
  }
  50% {
    transform: scale(1.018) rotate(0.45deg);
  }
  72% {
    transform: scale(1.006) rotate(0.15deg);
  }
}

@keyframes character-cast {
  0%,
  100% {
    transform: translateY(0) scale(1);
    filter: brightness(1);
  }
  38% {
    transform: translateY(-2.2%) scale(1.025);
    filter: brightness(1.08);
  }
  62% {
    transform: translateY(-1%) scale(1.01);
  }
}

@keyframes character-react {
  0%,
  100% {
    transform: translateY(0) scale(1);
  }
  32% {
    transform: translateY(-3.2%) scale(1.025) rotate(-1deg);
  }
  62% {
    transform: translateY(-0.6%) scale(0.99) rotate(0.7deg);
  }
}

@keyframes weapon-sweep {
  0% {
    opacity: 0;
    transform: translate(-8%, 6%) rotate(-34deg) scale(0.4);
  }
  18% {
    opacity: 0.72;
  }
  42%,
  68% {
    opacity: 0.9;
  }
  82% {
    opacity: 0.42;
    transform: translate(15%, -5%) rotate(-18deg) scale(1.16);
  }
  100% {
    opacity: 0;
    transform: translate(18%, -7%) rotate(-16deg) scale(1.2);
  }
}

@keyframes aura-cast {
  0%,
  100% {
    opacity: 0.4;
    transform: scale(0.9);
  }
  44% {
    opacity: 1;
    transform: scale(1.06);
  }
}

@keyframes character-petal {
  0%,
  100% {
    transform: translate(0, 7px) rotate(0) scale(0.7);
  }
  50% {
    transform: translate(7px, -9px) rotate(150deg) scale(1.05);
  }
}

@media (prefers-reduced-motion: reduce) {
  .doll,
  .growth-aura,
  .growth-particles i,
  .weapon-trail {
    animation: none !important;
  }
}
</style>
