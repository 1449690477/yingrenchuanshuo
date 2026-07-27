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
      `class-${classId}`,
      `tier-${appearance.growthTier.id}`,
      `quality-${appearance.highestVisibleQuality}`,
      `forge-${appearance.forgeStage}`,
      `weapon-forge-${appearance.weaponForgeStage}`,
      appearance.activeBoutiqueTheme ? `theme-${appearance.activeBoutiqueTheme}` : '',
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

    <span class="doll-frame" aria-hidden="true">
      <span class="doll">
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
          :class="[
            `slot-${layer.slot}`,
            `q-${layer.quality}`,
            `plus-${layer.enhance}`,
            `forge-${layer.forgeStage}`,
          ]"
          :style="layerStyle(layer)"
          :src="assetUrl(layer.asset)"
          alt=""
          draggable="false"
          decoding="async"
        />
        <img
          class="face-layer"
          :src="assetUrl(appearance.baseAsset)"
          alt=""
          draggable="false"
          decoding="async"
        />
        <span class="weapon-trail" />
      </span>
    </span>

    <span
      v-if="appearance.boutiqueEffectAsset"
      class="boutique-effect"
      :class="`boutique-${action}`"
      aria-hidden="true"
    >
      <img :src="assetUrl(appearance.boutiqueEffectAsset)" alt="" draggable="false" />
    </span>

    <span class="growth-particles" aria-hidden="true">
      <i v-for="n in 9" :key="n" />
    </span>
    <span class="enhance-particles" aria-hidden="true">
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

.doll-frame,
.growth-aura,
.growth-particles,
.enhance-particles,
.boutique-effect {
  position: absolute;
  inset: 0;
}

.doll-frame {
  z-index: 2;
  top: 50%;
  left: 50%;
  width: auto;
  height: 100%;
  aspect-ratio: 2 / 3;
  transform: translate(-50%, -50%);
}

.doll {
  position: absolute;
  inset: 0;
  transform-origin: 50% 91%;
}

.base-layer,
.equip-layer,
.face-layer {
  position: absolute;
  inset: 0;
  display: block;
  width: 100%;
  height: 100%;
  object-fit: contain;
  pointer-events: none;
  user-select: none;
}

.face-layer {
  z-index: 4;
  clip-path: ellipse(
    var(--face-rx, 18%) var(--face-ry, 8.8%) at var(--face-x, 50%) var(--face-y, 10%)
  );
}

.class-swordsman {
  --face-x: 52%;
  --face-y: 10%;
  --face-rx: 19%;
  --face-ry: 9%;
}

.class-witch {
  --face-x: 50%;
  --face-y: 10%;
  --face-rx: 18%;
  --face-ry: 8.8%;
}

.class-shaman {
  --face-x: 50%;
  --face-y: 10%;
  --face-rx: 17%;
  --face-ry: 8.8%;
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
  z-index: 5;
}

.slot-weapon {
  z-index: 6;
}

.slot-shoes {
  z-index: 4;
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
.q-divine {
  filter: drop-shadow(0 2px 6px rgb(255 181 91 / 44%)) drop-shadow(0 0 4px rgb(255 236 178 / 55%));
}

.q-mythic {
  filter: drop-shadow(0 2px 7px rgb(202 57 93 / 52%)) drop-shadow(0 0 5px rgb(255 213 127 / 62%));
}

.equip-layer.forge-gleam {
  filter: drop-shadow(0 0 4px rgb(126 215 255 / 58%));
}

.equip-layer.forge-radiant {
  filter: drop-shadow(0 0 4px rgb(126 199 255 / 72%)) drop-shadow(0 0 7px rgb(188 151 255 / 48%));
}

.equip-layer.forge-starforged {
  filter: drop-shadow(0 0 5px rgb(255 214 132 / 78%)) drop-shadow(0 0 9px rgb(255 154 204 / 55%));
}

.equip-layer.forge-sakura {
  filter: drop-shadow(0 0 5px rgb(255 244 185 / 92%)) drop-shadow(0 0 11px rgb(255 116 172 / 72%));
}

.boutique-effect {
  z-index: 7;
  display: grid;
  place-items: center;
  overflow: visible;
  pointer-events: none;
}

.boutique-effect img {
  width: 78%;
  height: 78%;
  object-fit: contain;
  opacity: 0.22;
  filter: saturate(1.08);
}

.boutique-attack img,
.boutique-cast img {
  opacity: 0;
  animation: boutique-burst 0.78s ease-out;
}

.boutique-react img {
  opacity: 0;
  animation: boutique-reaction 0.92s ease-out;
}

.theme-berry-cream .growth-aura {
  background: radial-gradient(circle at 50% 52%, rgb(255 158 195 / 18%), transparent 42%);
}

.theme-moon-sugar .growth-aura {
  background: radial-gradient(circle at 50% 49%, rgb(246 221 143 / 21%), transparent 43%);
}

.theme-rose-night .growth-aura {
  background: radial-gradient(circle at 50% 51%, rgb(167 47 85 / 22%), transparent 45%);
}

.growth-aura {
  z-index: 0;
  display: grid;
  place-items: center;
  pointer-events: none;
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

.enhance-particles {
  z-index: 7;
  overflow: visible;
  pointer-events: none;
}

.enhance-particles i {
  --forge-x: 22%;
  --forge-y: 34%;
  position: absolute;
  left: var(--forge-x);
  top: var(--forge-y);
  width: 4px;
  height: 4px;
  opacity: 0;
  background: #9be4ff;
  border: 1px solid rgb(255 255 255 / 88%);
  border-radius: 1px;
  box-shadow: 0 0 6px #8bdcff;
  transform: rotate(45deg);
}

.forge-gleam > .enhance-particles i:nth-child(-n + 3),
.forge-radiant > .enhance-particles i:nth-child(-n + 5),
.forge-starforged > .enhance-particles i:nth-child(-n + 7),
.forge-sakura > .enhance-particles i {
  opacity: 0.82;
  animation: forge-star 2.4s ease-in-out infinite;
}

.forge-radiant > .enhance-particles i {
  background: #c4a7ff;
}

.forge-starforged > .enhance-particles i {
  background: #ffe3a0;
  box-shadow: 0 0 7px #ffbfda;
}

.forge-sakura > .enhance-particles i {
  background: #fff4b8;
  box-shadow:
    0 0 7px #fff0a8,
    0 0 11px #ff8fbd;
}

.enhance-particles i:nth-child(2) {
  --forge-x: 78%;
  --forge-y: 29%;
  animation-delay: -0.4s !important;
}

.enhance-particles i:nth-child(3) {
  --forge-x: 14%;
  --forge-y: 61%;
  animation-delay: -0.8s !important;
}

.enhance-particles i:nth-child(4) {
  --forge-x: 87%;
  --forge-y: 58%;
  animation-delay: -1.2s !important;
}

.enhance-particles i:nth-child(5) {
  --forge-x: 31%;
  --forge-y: 78%;
  animation-delay: -1.6s !important;
}

.enhance-particles i:nth-child(6) {
  --forge-x: 68%;
  --forge-y: 74%;
  animation-delay: -2s !important;
}

.enhance-particles i:nth-child(7) {
  --forge-x: 48%;
  --forge-y: 18%;
  animation-delay: -0.65s !important;
}

.enhance-particles i:nth-child(8) {
  --forge-x: 8%;
  --forge-y: 43%;
  animation-delay: -1.05s !important;
}

.enhance-particles i:nth-child(9) {
  --forge-x: 91%;
  --forge-y: 40%;
  animation-delay: -1.45s !important;
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

.weapon-forge-gleam .weapon-trail,
.weapon-forge-radiant .weapon-trail,
.weapon-forge-starforged .weapon-trail,
.weapon-forge-sakura .weapon-trail {
  opacity: 0.38;
}

.weapon-forge-radiant .weapon-trail {
  opacity: 0.58;
  box-shadow: 0 0 8px #8fd7ff;
}

.weapon-forge-starforged .weapon-trail,
.weapon-forge-sakura .weapon-trail {
  opacity: 0.76;
  box-shadow:
    0 0 9px #8fd7ff,
    0 0 16px #ff9fca;
}

.weapon-forge-sakura .weapon-trail {
  border-color: rgb(255 232 159 / 92%);
  box-shadow:
    0 0 10px #fff0a2,
    0 0 18px #ff8fbd;
}

.action-idle .doll {
  animation: character-idle 2.6s ease-in-out infinite;
}

.action-attack .doll {
  animation: character-attack 0.62s cubic-bezier(0.24, 0.82, 0.32, 1);
}

.action-attack .weapon-trail {
  animation: weapon-sweep 0.58s ease-out;
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
.is-avatar .growth-particles,
.is-avatar .enhance-particles {
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
    transform: translate(0) scale(1) rotate(0);
  }
  22% {
    transform: translate(-3%, 1%) scale(0.98) rotate(-1.4deg);
  }
  52% {
    transform: translate(7%, -1.5%) scale(1.035) rotate(2.2deg);
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
  0%,
  100% {
    opacity: 0;
    transform: translate(-8%, 6%) rotate(-34deg) scale(0.4);
  }
  35%,
  58% {
    opacity: 0.9;
  }
  76% {
    transform: translate(15%, -5%) rotate(-18deg) scale(1.16);
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

@keyframes forge-star {
  0%,
  100% {
    opacity: 0.32;
    transform: translateY(5px) rotate(45deg) scale(0.72);
  }
  48% {
    opacity: 0.96;
    transform: translateY(-7px) rotate(135deg) scale(1.16);
  }
}

@keyframes boutique-burst {
  0% {
    opacity: 0;
    transform: scale(0.35) rotate(-15deg);
  }
  35%,
  62% {
    opacity: 0.92;
  }
  100% {
    opacity: 0;
    transform: scale(1.18) rotate(7deg);
  }
}

@keyframes boutique-reaction {
  0% {
    opacity: 0;
    transform: translateY(9%) scale(0.55);
  }
  35%,
  70% {
    opacity: 0.84;
  }
  100% {
    opacity: 0;
    transform: translateY(-4%) scale(1.08);
  }
}

@media (prefers-reduced-motion: reduce) {
  .doll,
  .growth-aura,
  .growth-particles i,
  .enhance-particles i,
  .weapon-trail,
  .boutique-effect img {
    animation: none !important;
  }
}
</style>
