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
    reduceMotion?: boolean;
  }>(),
  {
    equipped: null,
    variant: 'showcase',
    action: 'idle',
    reduceMotion: false,
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
      appearance.activeDungeonTier ? `dungeon-${appearance.activeDungeonTier}` : '',
      { 'reduce-motion': reduceMotion },
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
            { 'above-face': layer.aboveFace },
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

    <span
      v-if="classId === 'catkin' && variant === 'battle'"
      class="catkin-motion-fx"
      aria-hidden="true"
    >
      <b />
      <i v-for="index in 7" :key="index" :style="{ '--cat-index': index }" />
    </span>

    <span
      v-if="classId === 'kenshi' && variant === 'battle'"
      class="kenshi-motion-fx"
      aria-hidden="true"
    >
      <b />
      <i v-for="index in 6" :key="index" :style="{ '--kenshi-index': index }" />
    </span>

    <span v-if="appearance.activeDungeonTier" class="dungeon-effect" aria-hidden="true">
      <b></b>
      <i v-for="index in 8" :key="index"></i>
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

.character-appearance.is-battle.class-catkin {
  /* 为扑击与空翻预留头顶安全区，避免在 3:2 战场边缘裁掉猫耳。 */
  transform: translate3d(0, 2%, 0) scale(0.88);
  transform-origin: 50% 100%;
}

.doll-frame,
.growth-aura,
.growth-particles,
.enhance-particles,
.boutique-effect,
.dungeon-effect,
.catkin-motion-fx,
.kenshi-motion-fx {
  position: absolute;
  inset: 0;
}

.kenshi-motion-fx {
  --kenshi-fx-primary: #bcecff;
  --kenshi-fx-secondary: #90b8ff;
  --kenshi-fx-petal: #ffb9d6;
  z-index: 8;
  overflow: visible;
  pointer-events: none;
}

.kenshi-motion-fx b,
.kenshi-motion-fx i {
  position: absolute;
  opacity: 0;
  pointer-events: none;
}

.kenshi-motion-fx b {
  top: 40%;
  left: 13%;
  width: 78%;
  height: 2px;
  background: linear-gradient(
    90deg,
    transparent,
    var(--kenshi-fx-primary) 24%,
    #fff 52%,
    var(--kenshi-fx-secondary) 76%,
    transparent
  );
  box-shadow: 0 0 9px rgb(144 184 255 / 82%);
  transform-origin: 50% 50%;
}

.kenshi-motion-fx i {
  --kenshi-index: 1;
  top: calc(22% + var(--kenshi-index) * 8%);
  left: calc(13% + var(--kenshi-index) * 8%);
  width: 8px;
  height: 5px;
  border-radius: 72% 24% 66% 28%;
  background: linear-gradient(135deg, #fff, var(--kenshi-fx-petal));
  box-shadow: 0 0 6px rgb(255 185 214 / 76%);
}

.action-attack .kenshi-motion-fx b,
.action-flurry .kenshi-motion-fx b,
.action-spin .kenshi-motion-fx b {
  animation: kenshi-iai-line 0.56s cubic-bezier(0.16, 0.82, 0.24, 1) both;
}

.action-dash .kenshi-motion-fx b {
  animation: kenshi-dash-line 0.62s cubic-bezier(0.14, 0.84, 0.22, 1) both;
}

.action-cast .kenshi-motion-fx i,
.action-flurry .kenshi-motion-fx i,
.action-spin .kenshi-motion-fx i,
.action-victory .kenshi-motion-fx i {
  animation: kenshi-sakura-petal 0.82s ease-out both;
  animation-delay: calc((var(--kenshi-index) - 1) * 46ms);
}

.action-react .kenshi-motion-fx b,
.action-counter .kenshi-motion-fx b {
  top: 35%;
  left: 27%;
  width: 47%;
  animation: kenshi-parry-flash 0.34s ease-out both;
}

@keyframes kenshi-iai-line {
  0% {
    opacity: 0;
    transform: translateX(-18%) rotate(-18deg) scaleX(0.18);
  }
  28% {
    opacity: 1;
  }
  100% {
    opacity: 0;
    transform: translateX(19%) rotate(-18deg) scaleX(1.3);
  }
}

@keyframes kenshi-dash-line {
  0% {
    opacity: 0;
    transform: translateX(-36%) scaleX(0.12);
  }
  34% {
    opacity: 0.95;
  }
  100% {
    opacity: 0;
    transform: translateX(46%) scaleX(1.45);
  }
}

@keyframes kenshi-sakura-petal {
  0% {
    opacity: 0;
    transform: translate(8px, 16px) rotate(-18deg) scale(0.45);
  }
  36% {
    opacity: 0.94;
  }
  100% {
    opacity: 0;
    transform: translate(-18px, -38px) rotate(146deg) scale(1.08);
  }
}

@keyframes kenshi-parry-flash {
  0% {
    opacity: 0;
    transform: rotate(70deg) scaleX(0.18);
  }
  36% {
    opacity: 1;
  }
  100% {
    opacity: 0;
    transform: rotate(70deg) scaleX(1.18);
  }
}

.catkin-motion-fx {
  --cat-fx-primary: #7fd8ff;
  --cat-fx-secondary: #ff91c6;
  z-index: 8;
  overflow: visible;
  pointer-events: none;
}

.theme-cardboard-cat .catkin-motion-fx {
  --cat-fx-primary: #63d8ff;
  --cat-fx-secondary: #ff8fb5;
}

.catkin-motion-fx b,
.catkin-motion-fx i {
  position: absolute;
  opacity: 0;
  pointer-events: none;
}

.catkin-motion-fx b {
  top: 43%;
  left: 58%;
  width: 34%;
  aspect-ratio: 1;
  border: 3px solid color-mix(in srgb, var(--cat-fx-primary) 74%, white);
  border-radius: 50%;
  box-shadow:
    inset 0 0 14px color-mix(in srgb, var(--cat-fx-secondary) 46%, transparent),
    0 0 18px color-mix(in srgb, var(--cat-fx-primary) 62%, transparent);
}

.catkin-motion-fx i {
  --cat-index: 1;
  top: calc(32% + var(--cat-index) * 4%);
  left: 43%;
  width: 44%;
  height: 4px;
  background: linear-gradient(
    90deg,
    transparent,
    color-mix(in srgb, var(--cat-fx-primary) 78%, white) 28%,
    var(--cat-fx-secondary)
  );
  border-radius: 999px;
  box-shadow: 0 0 8px color-mix(in srgb, var(--cat-fx-primary) 72%, transparent);
  transform-origin: 100% 50%;
}

.action-attack .catkin-motion-fx i:nth-of-type(-n + 3),
.action-flurry .catkin-motion-fx i {
  animation: catkin-slash-mark 0.48s ease-out both;
  animation-delay: calc((var(--cat-index) - 1) * 38ms);
}

.action-dash .catkin-motion-fx i {
  top: calc(28% + var(--cat-index) * 7%);
  left: 2%;
  width: 68%;
  height: 3px;
  animation: catkin-dash-streak 0.54s ease-out both;
  animation-delay: calc((var(--cat-index) - 1) * 24ms);
}

.action-spin .catkin-motion-fx b,
.action-counter .catkin-motion-fx b {
  animation: catkin-paw-ring 0.66s ease-out both;
}

.action-spin .catkin-motion-fx i {
  top: 48%;
  left: 50%;
  width: 38%;
  animation: catkin-orbit-streak 0.66s ease-out both;
  animation-delay: calc((var(--cat-index) - 1) * 28ms);
}

.action-cast .catkin-motion-fx i,
.action-victory .catkin-motion-fx i {
  top: auto;
  bottom: calc(18% + var(--cat-index) * 5%);
  left: calc(18% + var(--cat-index) * 9%);
  width: 7px;
  height: 7px;
  background: var(--cat-fx-secondary);
  border: 1px solid #fff;
  border-radius: 2px;
  animation: catkin-keycap-rise 0.78s ease-out both;
  animation-delay: calc((var(--cat-index) - 1) * 42ms);
}

.action-react .catkin-motion-fx b {
  top: 31%;
  left: 14%;
  width: 24%;
  border-color: #ff9aa8;
  animation: catkin-hit-ripple 0.36s ease-out both;
}

@keyframes catkin-slash-mark {
  0% {
    opacity: 0;
    transform: translate(-26%, 22%) rotate(calc(-24deg + var(--cat-index) * 6deg))
      scaleX(0.3);
  }
  32% {
    opacity: 0.95;
  }
  100% {
    opacity: 0;
    transform: translate(12%, -16%) rotate(calc(-24deg + var(--cat-index) * 6deg))
      scaleX(1.16);
  }
}

@keyframes catkin-dash-streak {
  0% {
    opacity: 0;
    transform: translateX(-18%) scaleX(0.25);
  }
  38% {
    opacity: 0.72;
  }
  100% {
    opacity: 0;
    transform: translateX(72%) scaleX(1.08);
  }
}

@keyframes catkin-paw-ring {
  0% {
    opacity: 0;
    transform: translate(-50%, -50%) scale(0.35) rotate(-18deg);
  }
  42% {
    opacity: 0.88;
  }
  100% {
    opacity: 0;
    transform: translate(-50%, -50%) scale(1.5) rotate(24deg);
  }
}

@keyframes catkin-orbit-streak {
  0% {
    opacity: 0;
    transform: rotate(calc(var(--cat-index) * 51deg)) translateX(8%) scaleX(0.3);
  }
  38% {
    opacity: 0.76;
  }
  100% {
    opacity: 0;
    transform: rotate(calc(var(--cat-index) * 51deg + 96deg)) translateX(48%) scaleX(0.82);
  }
}

@keyframes catkin-keycap-rise {
  0% {
    opacity: 0;
    transform: translateY(12px) rotate(0) scale(0.45);
  }
  35% {
    opacity: 0.92;
  }
  100% {
    opacity: 0;
    transform: translateY(-42px) rotate(150deg) scale(1.12);
  }
}

@keyframes catkin-hit-ripple {
  0% {
    opacity: 0.92;
    transform: translate(-50%, -50%) scale(0.3);
  }
  100% {
    opacity: 0;
    transform: translate(-50%, -50%) scale(1.45);
  }
}

.dungeon-effect {
  --dungeon-color: #71bdf7;
  --dungeon-glow: #d9f4ff;
  z-index: 1;
  pointer-events: none;
}

.dungeon-violet .dungeon-effect {
  --dungeon-color: #ac78f5;
  --dungeon-glow: #ead8ff;
}

.dungeon-auric .dungeon-effect {
  --dungeon-color: #eeb451;
  --dungeon-glow: #fff0b7;
}

.dungeon-crimson .dungeon-effect {
  --dungeon-color: #ff6685;
  --dungeon-glow: #ffd7b0;
}

.dungeon-effect b {
  position: absolute;
  bottom: 4%;
  left: 50%;
  width: 66%;
  height: 13%;
  background: radial-gradient(
    ellipse,
    color-mix(in srgb, var(--dungeon-glow) 54%, transparent),
    transparent 70%
  );
  border: 1px solid color-mix(in srgb, var(--dungeon-color) 70%, white);
  border-radius: 50%;
  box-shadow: 0 0 12px color-mix(in srgb, var(--dungeon-color) 36%, transparent);
  transform: translateX(-50%) rotateX(68deg);
  animation: dungeon-ring 2.8s ease-in-out infinite;
}

.dungeon-effect i {
  position: absolute;
  bottom: 17%;
  left: 50%;
  color: var(--dungeon-glow);
  font-size: clamp(7px, 3.1cqw, 12px);
  font-style: normal;
  text-shadow:
    0 0 5px #fff,
    0 0 8px var(--dungeon-color);
  opacity: 0;
  animation: dungeon-spark 2.7s ease-in-out infinite;
  animation-delay: calc((var(--spark-index, 1) - 1) * -0.31s);
}

.dungeon-effect i::before {
  content: '✦';
}

.dungeon-azure .dungeon-effect i::before {
  content: '◌';
}

.dungeon-violet .dungeon-effect i::before {
  content: '☾';
}

.dungeon-crimson .dungeon-effect i::before {
  content: '✿';
}

.dungeon-effect i:nth-of-type(1) {
  --spark-index: 1;
  left: 20%;
}

.dungeon-effect i:nth-of-type(2) {
  --spark-index: 2;
  left: 31%;
  bottom: 35%;
}

.dungeon-effect i:nth-of-type(3) {
  --spark-index: 3;
  left: 43%;
}

.dungeon-effect i:nth-of-type(4) {
  --spark-index: 4;
  left: 56%;
  bottom: 39%;
}

.dungeon-effect i:nth-of-type(5) {
  --spark-index: 5;
  left: 69%;
}

.dungeon-effect i:nth-of-type(6) {
  --spark-index: 6;
  left: 79%;
  bottom: 31%;
}

.dungeon-effect i:nth-of-type(7) {
  --spark-index: 7;
  left: 36%;
  bottom: 58%;
}

.dungeon-effect i:nth-of-type(8) {
  --spark-index: 8;
  left: 64%;
  bottom: 56%;
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

.class-catkin,
.class-kenshi {
  --face-x: 50%;
  --face-y: 9.7%;
  --face-rx: 18.5%;
  --face-ry: 9.3%;
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

/* 猫耳属于底模身份特征，默认让两名猫耳职业的帽饰压在安全脸层后方。 */
.class-catkin .slot-head,
.class-kenshi .slot-head {
  z-index: 3;
}

/* 整顶戴在头顶的帽饰（精品店帽子）允许提到脸层之上，否则整顶会被头发埋住。 */
.class-catkin .slot-head.above-face,
.class-kenshi .slot-head.above-face {
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

.q-prismatic {
  filter: drop-shadow(0 2px 7px rgb(214 87 189 / 45%)) drop-shadow(0 0 5px rgb(82 188 242 / 56%));
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

.is-battle .boutique-effect img {
  /* 战斗待机不常驻整张命中特效，只在真实动作帧里揭晓。 */
  opacity: 0;
}

.theme-cardboard-cat :is(.boutique-react, .boutique-victory) img {
  /* 这张母版是命中爪痕，不拿来盖住试穿立绘或胜利收势。 */
  opacity: 0;
  animation: none;
}

.boutique-attack img,
.boutique-cast img,
.boutique-dash img,
.boutique-flurry img,
.boutique-spin img,
.boutique-counter img {
  opacity: 0;
  animation: boutique-burst 0.78s ease-out;
}

.boutique-react img,
.boutique-victory img {
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

.class-catkin .weapon-trail {
  left: 7%;
  bottom: 39%;
  width: 84%;
  height: 22%;
  background:
    radial-gradient(ellipse at 24% 64%, rgb(154 220 255 / 52%), transparent 45%),
    radial-gradient(ellipse at 76% 36%, rgb(255 160 205 / 45%), transparent 43%);
  border-top: 2px solid rgb(132 210 255 / 76%);
  border-bottom: 2px solid rgb(255 164 205 / 66%);
  transform: rotate(-17deg);
}

.class-kenshi .weapon-trail {
  left: 5%;
  bottom: 41%;
  width: 88%;
  height: 9%;
  background: linear-gradient(
    90deg,
    transparent,
    rgb(185 235 255 / 68%) 24%,
    rgb(255 255 255 / 88%) 52%,
    rgb(255 176 213 / 64%) 79%,
    transparent
  );
  border: 0;
  border-top: 2px solid rgb(178 224 255 / 82%);
  transform: rotate(-19deg);
}

.class-witch .weapon-trail {
  left: 30%;
  bottom: 43%;
  width: 40%;
  height: 25%;
  background: radial-gradient(
    circle,
    rgb(139 205 255 / 62%),
    rgb(206 156 255 / 34%) 44%,
    transparent 72%
  );
  border: 1px solid rgb(218 191 255 / 62%);
  border-radius: 50%;
  transform: rotate(0);
}

.class-shaman .weapon-trail {
  left: 17%;
  bottom: 36%;
  width: 64%;
  height: 25%;
  background:
    radial-gradient(circle at 28% 58%, rgb(145 231 196 / 56%), transparent 36%),
    radial-gradient(circle at 70% 38%, rgb(143 202 255 / 48%), transparent 42%);
  border: 0;
  border-bottom: 2px solid rgb(178 239 212 / 66%);
  border-radius: 50%;
  transform: rotate(-7deg);
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

.class-catkin.action-idle .doll {
  animation: catkin-idle 1.85s cubic-bezier(0.42, 0, 0.34, 1) infinite;
}

.class-kenshi.action-idle .doll {
  animation: kenshi-idle 2.35s cubic-bezier(0.42, 0, 0.34, 1) infinite;
}

.action-attack .doll {
  animation: character-attack 0.62s cubic-bezier(0.24, 0.82, 0.32, 1);
}

.class-catkin.action-attack .doll {
  animation: catkin-attack 0.54s cubic-bezier(0.18, 0.82, 0.24, 1);
}

.class-kenshi.action-attack .doll {
  animation: kenshi-iai-cut 0.56s cubic-bezier(0.14, 0.82, 0.22, 1);
}

.class-kenshi.action-attack .weapon-trail,
.class-kenshi.action-dash .weapon-trail,
.class-kenshi.action-flurry .weapon-trail,
.class-kenshi.action-spin .weapon-trail {
  animation: kenshi-blade-trail 0.62s ease-out;
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

.action-dash .doll {
  animation: character-dash 0.74s cubic-bezier(0.18, 0.84, 0.24, 1);
}

.action-flurry .doll {
  animation: character-flurry 0.82s cubic-bezier(0.2, 0.78, 0.28, 1);
}

.class-catkin.action-flurry .weapon-trail,
.class-catkin.action-dash .weapon-trail,
.class-catkin.action-spin .weapon-trail,
.class-catkin.action-counter .weapon-trail {
  animation: catkin-claw-trail 0.78s ease-out;
}

.action-spin .doll {
  animation: character-spin 0.9s cubic-bezier(0.24, 0.7, 0.28, 1);
}

.action-counter .doll {
  animation: character-counter 0.9s cubic-bezier(0.2, 0.76, 0.24, 1);
}

.action-victory .doll {
  animation: character-victory 1.05s cubic-bezier(0.22, 0.72, 0.26, 1);
}

/* 五职业各自的挂机动作语言：纸娃娃层仍保持同步，不换回会丢装备的宣传立绘。 */
.class-swordsman.action-idle .doll {
  animation: swordsman-idle 2.2s ease-in-out infinite;
}

.class-swordsman.action-attack .doll {
  animation: swordsman-cut 0.58s cubic-bezier(0.2, 0.76, 0.28, 1);
}

.class-swordsman.action-dash .doll {
  animation: swordsman-lunge 0.68s cubic-bezier(0.18, 0.8, 0.24, 1);
}

.class-swordsman.action-spin .doll {
  animation: swordsman-halfmoon 0.76s cubic-bezier(0.2, 0.72, 0.25, 1);
}

.class-swordsman.action-cast .doll {
  animation: swordsman-flame-stance 0.82s ease-out;
}

.class-swordsman.action-dash .weapon-trail,
.class-swordsman.action-spin .weapon-trail,
.class-swordsman.action-flurry .weapon-trail {
  animation: swordsman-blade-trail 0.7s ease-out;
}

.class-witch.action-idle .doll {
  animation: witch-hover 2.75s ease-in-out infinite;
}

.class-witch.action-attack .doll {
  animation: witch-bolt 0.62s ease-out;
}

.class-witch.action-cast .doll {
  animation: witch-cast 0.86s cubic-bezier(0.22, 0.68, 0.24, 1);
}

.class-witch.action-spin .doll {
  animation: witch-ring 0.82s ease-out;
}

.class-witch.action-attack .weapon-trail,
.class-witch.action-cast .weapon-trail,
.class-witch.action-spin .weapon-trail {
  animation: witch-orbit-trail 0.82s ease-out;
}

.class-shaman.action-idle .doll {
  animation: shaman-idle 2.9s ease-in-out infinite;
}

.class-shaman.action-attack .doll {
  animation: shaman-staff-strike 0.66s cubic-bezier(0.22, 0.74, 0.3, 1);
}

.class-shaman.action-cast .doll {
  animation: shaman-ritual 0.9s ease-out;
}

.class-shaman.action-spin .doll {
  animation: shaman-spirit-sweep 0.82s cubic-bezier(0.2, 0.72, 0.28, 1);
}

.class-shaman.action-counter .doll {
  animation: shaman-ward 0.82s ease-out;
}

.class-shaman.action-attack .weapon-trail,
.class-shaman.action-cast .weapon-trail,
.class-shaman.action-spin .weapon-trail,
.class-shaman.action-counter .weapon-trail {
  animation: shaman-spirit-trail 0.84s ease-out;
}

.class-catkin.action-dash .doll {
  animation: catkin-pounce 0.64s cubic-bezier(0.16, 0.84, 0.22, 1);
}

/*
 * 乱抓必须用 linear：六爪的节奏全写在关键帧里，
 * 换成 steps() 会把它量化成几段跳变，五连爪只剩两下能看出来。
 */
.class-catkin.action-flurry .doll {
  animation: catkin-flurry 0.68s linear;
}

.class-catkin.action-spin .doll {
  animation: catkin-tail-spin 0.82s cubic-bezier(0.18, 0.74, 0.24, 1);
}

.class-catkin.action-cast .doll {
  animation: catkin-furball-cast 0.84s ease-out;
}

/* 喵喵的闪避反击此前用的是四职业通用动作，猫感全无 */
.class-catkin.action-counter .doll {
  animation: catkin-air-twist 0.92s cubic-bezier(0.2, 0.82, 0.26, 1);
}

.class-kenshi.action-dash .doll {
  animation: kenshi-draw-dash 0.62s cubic-bezier(0.14, 0.86, 0.22, 1);
}

.class-kenshi.action-cast .doll,
.class-kenshi.action-spin .doll {
  animation: kenshi-sakura-cast 0.82s cubic-bezier(0.2, 0.74, 0.26, 1);
}

.class-kenshi.action-flurry .doll {
  animation: kenshi-thousand-cuts 0.72s linear;
}

.class-kenshi.action-counter .doll {
  animation: kenshi-parry 0.46s cubic-bezier(0.24, 0.76, 0.3, 1);
}

/* ─────────────────────────────────────────────
   受击与胜利（②）
   受击风格由 data/battleMotions 的 ReactStyle 定义：
   剑姬 brace / 魔女 stagger / 灵巫 drift / 喵喵 hop / 樱酱 parry。

   为什么值得给四个职业各写一套：挨打是挂机时出现频率最高的动作之一，
   如果四个人被打的反应一模一样，前面所有职业差异化的努力都会被冲淡。
   这是除立绘外最廉价、也最能被玩家感知到「职业不一样」的手段。
   ───────────────────────────────────────────── */
.class-swordsman.action-react .doll {
  animation: swordsman-brace 0.26s cubic-bezier(0.3, 0.7, 0.4, 1);
}

.class-witch.action-react .doll {
  animation: witch-stagger 0.38s cubic-bezier(0.26, 0.64, 0.36, 1);
}

.class-shaman.action-react .doll {
  animation: shaman-drift 0.32s cubic-bezier(0.24, 0.7, 0.32, 1);
}

.class-catkin.action-react .doll {
  animation: catkin-hop-back 0.3s cubic-bezier(0.2, 0.9, 0.3, 1);
}

.class-kenshi.action-react .doll {
  animation: kenshi-parry 0.28s cubic-bezier(0.24, 0.76, 0.3, 1);
}

.class-swordsman.action-victory .doll {
  animation: swordsman-sheathe 1.4s cubic-bezier(0.22, 0.72, 0.26, 1);
}

.class-witch.action-victory .doll {
  animation: witch-twirl 1.6s cubic-bezier(0.24, 0.7, 0.28, 1);
}

.class-shaman.action-victory .doll {
  animation: shaman-bless 1.5s ease-in-out;
}

.class-catkin.action-victory .doll {
  animation: catkin-groom 1.3s cubic-bezier(0.24, 0.74, 0.3, 1);
}

.class-kenshi.action-victory .doll {
  animation: kenshi-sheathe 1.5s cubic-bezier(0.22, 0.72, 0.26, 1);
}

/* 魔女与灵巫此前缺的位移动作：法系不该只会站着挥手 */
.class-witch.action-dash .doll {
  animation: witch-blink 0.7s cubic-bezier(0.16, 0.86, 0.22, 1);
}

.class-witch.action-flurry .doll {
  animation: witch-barrage 0.84s cubic-bezier(0.2, 0.78, 0.28, 1);
}

.class-witch.action-counter .doll {
  animation: witch-barrier 0.9s cubic-bezier(0.2, 0.76, 0.24, 1);
}

.class-shaman.action-dash .doll {
  animation: shaman-glide 0.72s cubic-bezier(0.18, 0.82, 0.26, 1);
}

.class-shaman.action-flurry .doll {
  animation: shaman-spirit-volley 0.86s cubic-bezier(0.2, 0.78, 0.28, 1);
}

.class-witch.action-dash .weapon-trail,
.class-witch.action-flurry .weapon-trail,
.class-witch.action-counter .weapon-trail {
  animation: witch-orbit-trail 0.78s ease-out;
}

.class-shaman.action-dash .weapon-trail,
.class-shaman.action-flurry .weapon-trail {
  animation: shaman-spirit-trail 0.8s ease-out;
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

.character-appearance.is-avatar .doll {
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

/* 闪避反击：向后腾空翻半圈，落地立刻回身补一爪。 */
@keyframes catkin-air-twist {
  0% {
    transform: translate(0, 0) scale(1, 1) rotate(0);
  }
  18% {
    transform: translate(-7%, 6%) scale(1.12, 0.85) rotate(-4deg);
  }
  42% {
    transform: translate(-12%, -14%) scale(0.92, 1.1) rotate(-14deg);
  }
  62% {
    transform: translate(2%, -10%) scale(0.96, 1.05) rotate(9deg);
  }
  80% {
    transform: translate(10%, 2%) scale(1.14, 0.84) rotate(4deg);
  }
  100% {
    transform: translate(0, 0) scale(1, 1) rotate(0);
  }
}

/* 待机：猫式呼吸。比人类角色更明显的起伏，随时准备动起来。 */
@keyframes catkin-idle {
  0%,
  100% {
    transform: translateY(0) rotate(-0.7deg) scale(1, 1);
  }
  30% {
    transform: translateY(-2.2%) rotate(1deg) scale(0.992, 1.012);
  }
  58% {
    transform: translateY(-0.9%) rotate(-0.5deg) scale(1.008, 0.995);
  }
  80% {
    transform: translateY(-2.6%) rotate(1.2deg) scale(0.988, 1.016);
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

/* 猫拳：后坐蓄力 → 爆发前刺 → 慢收。快出慢收是猫科动物的出手节奏。 */
@keyframes catkin-attack {
  0% {
    transform: translate(0, 0) scale(1, 1) rotate(0);
  }
  14% {
    transform: translate(-9%, 4%) scale(1.06, 0.9) rotate(-5deg);
  }
  30% {
    transform: translate(14%, -6%) scale(0.92, 1.12) rotate(7deg);
  }
  46% {
    transform: translate(18%, -3%) scale(1.04, 0.96) rotate(4deg);
  }
  100% {
    transform: translate(0, 0) scale(1, 1) rotate(0);
  }
}

@keyframes swordsman-idle {
  0%,
  100% {
    transform: translateY(0) rotate(-0.35deg) scale(1);
  }
  50% {
    transform: translateY(-0.7%) rotate(0.35deg) scale(1.006, 0.998);
  }
}

@keyframes swordsman-cut {
  0%,
  100% {
    transform: translate(0) rotate(0) scale(1);
  }
  22% {
    transform: translate(-5%, 1.5%) rotate(-3.2deg) scale(0.97, 1.015);
  }
  50% {
    transform: translate(10%, -1.5%) rotate(4.8deg) scale(1.055, 0.98);
  }
  68% {
    transform: translate(5%, -0.5%) rotate(-1.4deg) scale(1.018);
  }
}

@keyframes swordsman-lunge {
  0%,
  100% {
    transform: translate(0) rotate(0) scale(1);
  }
  20% {
    transform: translate(-7%, 2.5%) rotate(-4deg) scale(0.95, 1.025);
  }
  47% {
    transform: translate(17%, -1.5%) rotate(5.5deg) scale(1.07, 0.965);
  }
  68% {
    transform: translate(8%, -0.5%) rotate(-1deg) scale(1.025);
  }
}

@keyframes swordsman-halfmoon {
  0%,
  100% {
    transform: translate(0) rotate(0) scale(1);
  }
  20% {
    transform: translate(-4%, 1%) rotate(-7deg) scale(0.97);
  }
  47% {
    transform: translate(8%, -3%) rotate(10deg) scale(1.07);
  }
  72% {
    transform: translate(3%, -1%) rotate(-4deg) scale(1.02);
  }
}

@keyframes swordsman-flame-stance {
  0%,
  100% {
    transform: translateY(0) scale(1);
    filter: brightness(1);
  }
  38% {
    transform: translateY(-2%) scale(1.035);
    filter: brightness(1.16) saturate(1.1);
  }
  68% {
    transform: translateY(-0.8%) scale(1.012);
  }
}

@keyframes swordsman-blade-trail {
  0%,
  100% {
    opacity: 0;
    transform: translate(-14%, 8%) rotate(-42deg) scale(0.3);
  }
  34%,
  60% {
    opacity: 0.96;
  }
  78% {
    opacity: 0;
    transform: translate(22%, -7%) rotate(-10deg) scale(1.36);
  }
}

@keyframes witch-hover {
  0%,
  100% {
    transform: translateY(0) rotate(-0.55deg) scale(1);
  }
  50% {
    transform: translateY(-1.9%) rotate(0.7deg) scale(1.008);
  }
}

@keyframes witch-bolt {
  0%,
  100% {
    transform: translate(0) rotate(0) scale(1);
  }
  28% {
    transform: translate(-2%, -1.5%) rotate(-1.8deg) scale(1.025);
  }
  54% {
    transform: translate(5%, -2.5%) rotate(2.4deg) scale(1.045);
    filter: brightness(1.12);
  }
}

@keyframes witch-cast {
  0%,
  100% {
    transform: translateY(0) scale(1);
    filter: brightness(1);
  }
  34% {
    transform: translateY(-3.4%) scale(1.035);
    filter: brightness(1.18) saturate(1.12);
  }
  65% {
    transform: translateY(-1.7%) scale(1.018);
  }
}

@keyframes witch-ring {
  0%,
  100% {
    transform: translateY(0) rotate(0) scale(1);
  }
  28% {
    transform: translateY(-2%) rotate(-4deg) scale(0.98);
  }
  56% {
    transform: translateY(-3.3%) rotate(6deg) scale(1.065);
  }
  74% {
    transform: translateY(-1%) rotate(-2deg) scale(1.018);
  }
}

@keyframes witch-orbit-trail {
  0%,
  100% {
    opacity: 0;
    transform: rotate(-30deg) scale(0.25);
  }
  34%,
  66% {
    opacity: 0.92;
  }
  80% {
    opacity: 0;
    transform: rotate(120deg) scale(1.38);
  }
}

@keyframes shaman-idle {
  0%,
  100% {
    transform: translateY(0) rotate(-0.7deg) scale(1);
  }
  48% {
    transform: translateY(-1.1%) rotate(0.9deg) scale(1.005);
  }
}

@keyframes shaman-staff-strike {
  0%,
  100% {
    transform: translate(0) rotate(0) scale(1);
  }
  24% {
    transform: translate(-3%, 1%) rotate(-2.5deg) scale(0.98);
  }
  52% {
    transform: translate(7%, -1%) rotate(3.5deg) scale(1.04);
  }
  70% {
    transform: translate(2%, 0) rotate(-1deg) scale(1.01);
  }
}

@keyframes shaman-ritual {
  0%,
  100% {
    transform: translateY(0) scale(1);
    filter: brightness(1);
  }
  30% {
    transform: translateY(-1.5%) scale(0.985, 1.025);
  }
  55% {
    transform: translateY(-2.7%) scale(1.045);
    filter: brightness(1.16) saturate(1.08);
  }
}

@keyframes shaman-spirit-sweep {
  0%,
  100% {
    transform: translate(0) rotate(0) scale(1);
  }
  24% {
    transform: translate(-3%, 1%) rotate(-3deg) scale(0.98);
  }
  52% {
    transform: translate(5%, -2%) rotate(5deg) scale(1.045);
    filter: brightness(1.14) saturate(1.08);
  }
  72% {
    transform: translate(1%, 0) rotate(-1.5deg) scale(1.012);
  }
}

@keyframes shaman-ward {
  0%,
  100% {
    transform: translate(0) scale(1);
  }
  30% {
    transform: translate(-3%, -1%) scale(1.06, 0.98);
    filter: brightness(1.12);
  }
  58% {
    transform: translate(-1%, 0) scale(1.08, 0.965);
  }
}

@keyframes shaman-spirit-trail {
  0%,
  100% {
    opacity: 0;
    transform: translateY(10%) rotate(-12deg) scale(0.35);
  }
  36%,
  68% {
    opacity: 0.9;
  }
  82% {
    opacity: 0;
    transform: translateY(-18%) rotate(8deg) scale(1.24);
  }
}

/*
 * 扑击：深蹲蓄力 → 腾空拉长 → 滞空 → 落地压扁 → 回弹。
 *
 * 这是喵喵最标志性的动作，五个阶段一个都不能省：
 * 少了蓄力就变成平移，少了压扁就没有重量，少了回弹就像纸片。
 * 战斗态垂直位移控制在 -15% 安全区内，靠横向扑击、拉伸和落地压缩保留猫感。
 */
@keyframes catkin-pounce {
  0% {
    transform: translate(0, 0) scale(1, 1) rotate(0);
  }
  16% {
    transform: translate(-6%, 7%) scale(1.14, 0.82) rotate(-3deg);
  }
  38% {
    transform: translate(10%, -15%) scale(0.9, 1.12) rotate(7deg);
  }
  56% {
    transform: translate(20%, -10%) scale(0.96, 1.05) rotate(5deg);
  }
  72% {
    transform: translate(16%, 2%) scale(1.12, 0.86) rotate(-2deg);
  }
  86% {
    transform: translate(8%, -3%) scale(0.96, 1.05) rotate(1deg);
  }
  100% {
    transform: translate(0, 0) scale(1, 1) rotate(0);
  }
}

/*
 * 疯狂乱抓：五连爪，左右交替，幅度递增。
 * 原本只有两个来回，读起来像「挥了挥手」；
 * 猫挠东西是高频、密集、越挠越起劲的。
 */
@keyframes catkin-flurry {
  0% {
    transform: translate(0, 0) rotate(0) scale(1, 1);
  }
  12% {
    transform: translate(9%, -3%) rotate(9deg) scale(0.95, 1.06);
  }
  24% {
    transform: translate(-5%, -1%) rotate(-8deg) scale(1.05, 0.96);
  }
  36% {
    transform: translate(11%, -4%) rotate(11deg) scale(0.94, 1.07);
  }
  48% {
    transform: translate(-6%, -2%) rotate(-10deg) scale(1.06, 0.95);
  }
  60% {
    transform: translate(13%, -5%) rotate(12deg) scale(0.93, 1.08);
  }
  74% {
    transform: translate(-3%, -1%) rotate(-6deg) scale(1.03, 0.97);
  }
  100% {
    transform: translate(0, 0) rotate(0) scale(1, 1);
  }
}

/* 尾扫旋身：下沉蓄力 → 踮起旋身把尾巴甩出去 → 落地。 */
@keyframes catkin-tail-spin {
  0% {
    transform: translateY(0) rotate(0) scale(1, 1);
  }
  20% {
    transform: translateY(4%) rotate(-14deg) scale(1.08, 0.9);
  }
  46% {
    transform: translateY(-10%) rotate(14deg) scale(0.93, 1.09);
  }
  68% {
    transform: translateY(-8%) rotate(-10deg) scale(1.02, 1);
  }
  86% {
    transform: translateY(2%) rotate(4deg) scale(1.06, 0.94);
  }
  100% {
    transform: translateY(0) rotate(0) scale(1, 1);
  }
}

/* 毛球术：后仰蓄力，再把整个身子的力量抛出去。 */
@keyframes catkin-furball-cast {
  0% {
    transform: translate(0, 0) scale(1, 1) rotate(0);
  }
  22% {
    transform: translate(-8%, 5%) scale(1.1, 0.88) rotate(-7deg);
  }
  44% {
    transform: translate(4%, -8%) scale(0.94, 1.08) rotate(5deg);
  }
  64% {
    transform: translate(9%, -6%) scale(1.02, 1) rotate(3deg);
  }
  100% {
    transform: translate(0, 0) scale(1, 1) rotate(0);
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

@keyframes character-dash {
  0%,
  100% {
    transform: translate(0) scale(1) rotate(0);
  }
  20% {
    transform: translate(-8%, 2%) scale(0.95, 1.02) rotate(-3deg);
  }
  46% {
    transform: translate(14%, -2%) scale(1.06, 0.97) rotate(4deg);
  }
  68% {
    transform: translate(5%, -1%) scale(1.02) rotate(-1deg);
  }
}

@keyframes character-flurry {
  0%,
  100% {
    transform: translate(0) scale(1) rotate(0);
  }
  18% {
    transform: translate(-4%, 0) scale(0.98) rotate(-2.8deg);
  }
  34% {
    transform: translate(6%, -1%) scale(1.035) rotate(3.5deg);
  }
  49% {
    transform: translate(-3%, -2%) scale(1.02) rotate(-3.2deg);
  }
  65% {
    transform: translate(7%, -1%) scale(1.04) rotate(3.8deg);
  }
  80% {
    transform: translate(1%, 0) scale(0.99) rotate(-1deg);
  }
}

@keyframes character-spin {
  0%,
  100% {
    transform: translateY(0) scale(1) rotate(0);
  }
  24% {
    transform: translateY(-2%) scale(0.96, 1.03) rotate(-7deg);
  }
  48% {
    transform: translateY(-3.2%) scale(1.06, 0.96) rotate(8deg);
  }
  72% {
    transform: translateY(-1%) scale(1.02) rotate(-4deg);
  }
}

@keyframes character-counter {
  0%,
  100% {
    transform: translate(0) scale(1) rotate(0);
    filter: brightness(1);
  }
  24% {
    transform: translate(-3%, -1%) scale(1.07, 0.98) rotate(-2deg);
    filter: brightness(1.12);
  }
  42% {
    transform: translate(-5%, 1%) scale(1.1, 0.96) rotate(-3deg);
  }
  68% {
    transform: translate(9%, -2%) scale(1.03) rotate(3deg);
    filter: brightness(1.18);
  }
}

@keyframes character-victory {
  0%,
  100% {
    transform: translateY(0) scale(1) rotate(0);
  }
  28% {
    transform: translateY(-5%) scale(1.025) rotate(-2deg);
  }
  48% {
    transform: translateY(-1%) scale(0.99) rotate(1.5deg);
  }
  68% {
    transform: translateY(-3.2%) scale(1.015) rotate(2deg);
  }
}

@keyframes catkin-claw-trail {
  0%,
  100% {
    opacity: 0;
    transform: rotate(-28deg) scale(0.35);
  }
  24%,
  64% {
    opacity: 0.95;
  }
  78% {
    opacity: 0;
    transform: rotate(13deg) scale(1.24);
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

@keyframes dungeon-ring {
  0%,
  100% {
    opacity: 0.52;
    transform: translateX(-50%) rotateX(68deg) scale(0.9);
  }
  50% {
    opacity: 0.92;
    transform: translateX(-50%) rotateX(68deg) scale(1.06);
  }
}

@keyframes dungeon-spark {
  0% {
    opacity: 0;
    transform: translate(-50%, 14px) rotate(-18deg) scale(0.5);
  }
  35% {
    opacity: 0.94;
  }
  100% {
    opacity: 0;
    transform: translate(-50%, -42px) rotate(24deg) scale(1.12);
  }
}

.character-appearance.reduce-motion
  :is(
    .doll,
    .growth-aura,
    .growth-particles i,
    .enhance-particles i,
    .weapon-trail,
    .boutique-effect img,
    .dungeon-effect b,
    .dungeon-effect i,
    .catkin-motion-fx b,
    .catkin-motion-fx i,
    .kenshi-motion-fx b,
    .kenshi-motion-fx i
  ) {
  animation: none !important;
  transition: none !important;
}

.character-appearance.reduce-motion
  :is(.catkin-motion-fx, .kenshi-motion-fx, .boutique-effect) {
  display: none;
}

@media (prefers-reduced-motion: reduce) {
  :is(
    .doll,
    .growth-aura,
    .growth-particles i,
    .enhance-particles i,
    .weapon-trail,
    .boutique-effect img,
    .dungeon-effect b,
    .dungeon-effect i,
    .catkin-motion-fx b,
    .catkin-motion-fx i,
    .kenshi-motion-fx b,
    .kenshi-motion-fx i
  ) {
    animation: none !important;
  }
}

/* ── 受击：五职业各自的挨打反应 ── */

/* 剑姬：重心稳，只有肩膀吃力地沉一下，站位几乎不动 */
@keyframes swordsman-brace {
  0% {
    transform: translate3d(0, 0, 0) rotate(0deg);
  }
  35% {
    transform: translate3d(-4px, 1px, 0) rotate(-2.5deg);
  }
  100% {
    transform: translate3d(0, 0, 0) rotate(0deg);
  }
}

/* 魔女：布甲脆皮，被打得整个人往后踉跄，还带一点失衡的旋转 */
@keyframes witch-stagger {
  0% {
    transform: translate3d(0, 0, 0) rotate(0deg);
  }
  28% {
    transform: translate3d(-11px, -3px, 0) rotate(-7deg);
  }
  62% {
    transform: translate3d(-5px, 1px, 0) rotate(3deg);
  }
  100% {
    transform: translate3d(0, 0, 0) rotate(0deg);
  }
}

/* 灵巫：顺着力道飘开，位移大但姿态始终不乱 —— 这是「卸力」不是「被打飞」 */
@keyframes shaman-drift {
  0% {
    transform: translate3d(0, 0, 0);
  }
  40% {
    transform: translate3d(-9px, -5px, 0);
  }
  100% {
    transform: translate3d(0, 0, 0);
  }
}

/* 喵喵：猫的本能，直接向后弹跳拉开距离，落地再收回 */
/* 受击：猫的本能是弹开而不是硬扛。后跳带弧线，落地有缓冲。 */
@keyframes catkin-hop-back {
  0% {
    transform: translate(0, 0) scale(1, 1) rotate(0);
  }
  26% {
    transform: translate(-13%, -13%) scale(0.9, 1.12) rotate(-6deg);
  }
  54% {
    transform: translate(-9%, 2%) scale(1.12, 0.86) rotate(2deg);
  }
  78% {
    transform: translate(-3%, -2%) scale(0.97, 1.04) rotate(-1deg);
  }
  100% {
    transform: translate(0, 0) scale(1, 1) rotate(0);
  }
}

/* ── 胜利：通关后的收势 ── */

/* 剑姬：横扫收剑再归鞘 */
@keyframes swordsman-sheathe {
  0% {
    transform: rotate(0deg) translate3d(0, 0, 0);
  }
  22% {
    transform: rotate(-13deg) translate3d(5px, -3px, 0);
  }
  55% {
    transform: rotate(6deg) translate3d(-2px, 0, 0);
  }
  100% {
    transform: rotate(0deg) translate3d(0, 0, 0);
  }
}

/* 魔女：轻盈转一圈再落回，裙摆是重点 */
@keyframes witch-twirl {
  0% {
    transform: rotate(0deg) translateY(0) scale(1);
  }
  30% {
    transform: rotate(-10deg) translateY(-12px) scale(1.03);
  }
  65% {
    transform: rotate(9deg) translateY(-6px) scale(1.01);
  }
  100% {
    transform: rotate(0deg) translateY(0) scale(1);
  }
}

/* 灵巫：缓缓升起做一个祈福姿势，节奏最慢最稳 */
@keyframes shaman-bless {
  0% {
    transform: translateY(0) scale(1);
  }
  45% {
    transform: translateY(-13px) scale(1.04);
  }
  100% {
    transform: translateY(0) scale(1);
  }
}

/* 喵喵：打完了先舔一下爪子，尾巴甩两下 */
/* 胜利：打完先坐下来舔爪子理毛，尾巴左右甩两下。 */
@keyframes catkin-groom {
  0% {
    transform: translate(0, 0) rotate(0) scale(1, 1);
  }
  18% {
    transform: translate(2%, 3%) rotate(-9deg) scale(1.05, 0.93);
  }
  40% {
    transform: translate(-2%, -1%) rotate(7deg) scale(0.97, 1.05);
  }
  62% {
    transform: translate(3%, 1%) rotate(-6deg) scale(1.03, 0.97);
  }
  84% {
    transform: translate(-1%, -2%) rotate(4deg) scale(0.99, 1.02);
  }
  100% {
    transform: translate(0, 0) rotate(0) scale(1, 1);
  }
}

/* 樱酱六态：全部只改变纸娃娃姿态，不参与攻速、命中或伤害结算。 */
@keyframes kenshi-idle {
  0%,
  100% {
    transform: translateY(0) rotate(-0.35deg) scale(1);
  }
  46% {
    transform: translateY(-1.15%) rotate(0.45deg) scale(1.004, 0.998);
  }
  54% {
    transform: translateY(-1.3%) rotate(0.2deg) scale(0.998, 1.004);
  }
}

@keyframes kenshi-iai-cut {
  0%,
  100% {
    transform: translate(0, 0) rotate(0) scale(1);
  }
  22% {
    transform: translate(-7%, 2%) rotate(-4.5deg) scale(0.96, 1.02);
  }
  43% {
    transform: translate(13%, -2%) rotate(4.2deg) scale(1.055, 0.975);
  }
  62% {
    transform: translate(6%, -1%) rotate(-1.5deg) scale(1.018);
  }
}

@keyframes kenshi-draw-dash {
  0%,
  100% {
    opacity: 1;
    transform: translate3d(0, 0, 0) rotate(0) scale(1);
  }
  18% {
    transform: translate3d(-10%, 3%, 0) rotate(-5deg) scale(0.94, 1.025);
  }
  39% {
    opacity: 0.42;
    transform: translate3d(24%, -2%, 0) rotate(3deg) scale(1.08, 0.96);
  }
  55% {
    opacity: 1;
    transform: translate3d(17%, -1%, 0) rotate(1deg) scale(1.035, 0.985);
  }
}

@keyframes kenshi-sakura-cast {
  0%,
  100% {
    transform: translateY(0) rotate(0) scale(1);
    filter: brightness(1);
  }
  28% {
    transform: translateY(2%) rotate(-5deg) scale(0.985, 1.015);
  }
  54% {
    transform: translateY(-3%) rotate(6deg) scale(1.045, 0.985);
    filter: brightness(1.16) saturate(1.08);
  }
  76% {
    transform: translateY(-1%) rotate(-2deg) scale(1.012);
  }
}

@keyframes kenshi-thousand-cuts {
  0%,
  100% {
    transform: translate(0, 0) rotate(0) scale(1);
  }
  16% {
    transform: translate(8%, -2%) rotate(6deg) scale(1.03, 0.98);
  }
  31% {
    transform: translate(-4%, -1%) rotate(-5deg) scale(0.98, 1.02);
  }
  48% {
    transform: translate(11%, -3%) rotate(7deg) scale(1.045, 0.975);
  }
  65% {
    transform: translate(-2%, -2%) rotate(-4deg) scale(0.99, 1.015);
  }
  82% {
    transform: translate(7%, -1%) rotate(3deg) scale(1.02, 0.99);
  }
}

@keyframes kenshi-parry {
  0%,
  100% {
    transform: translate3d(0, 0, 0) rotate(0) scale(1);
  }
  32% {
    transform: translate3d(-5%, 1%, 0) rotate(-4deg) scale(1.025, 0.985);
  }
  58% {
    transform: translate3d(-2%, -1%, 0) rotate(2.5deg) scale(0.99, 1.015);
  }
}

@keyframes kenshi-sheathe {
  0%,
  100% {
    transform: translate3d(0, 0, 0) rotate(0) scale(1);
  }
  20% {
    transform: translate3d(5%, -2%, 0) rotate(7deg) scale(1.02);
  }
  48% {
    transform: translate3d(-3%, 0, 0) rotate(-5deg) scale(0.99, 1.015);
  }
  72% {
    transform: translate3d(0, -2%, 0) rotate(1deg) scale(1.018);
    filter: brightness(1.12);
  }
}

@keyframes kenshi-blade-trail {
  0%,
  100% {
    opacity: 0;
    transform: translateX(-18%) rotate(-28deg) scaleX(0.22);
  }
  30%,
  58% {
    opacity: 0.96;
  }
  78% {
    opacity: 0;
    transform: translateX(24%) rotate(-12deg) scaleX(1.35);
  }
}

/* ── 魔女补齐的位移动作：法系不该只会站着挥手 ── */

/* 闪现：淡出、位移、淡入，中间那帧几乎透明才有「瞬移」的读感 */
@keyframes witch-blink {
  0% {
    opacity: 1;
    transform: translate3d(0, 0, 0) scale(1);
  }
  28% {
    opacity: 0.15;
    transform: translate3d(-14px, -6px, 0) scale(0.92);
  }
  52% {
    opacity: 0.2;
    transform: translate3d(16px, -4px, 0) scale(0.94);
  }
  100% {
    opacity: 1;
    transform: translate3d(0, 0, 0) scale(1);
  }
}

/* 连射：小幅高频前后，每一下都是一发弹幕 */
@keyframes witch-barrage {
  0% {
    transform: translate3d(0, 0, 0);
  }
  18% {
    transform: translate3d(6px, -2px, 0);
  }
  36% {
    transform: translate3d(2px, 1px, 0);
  }
  54% {
    transform: translate3d(7px, -3px, 0);
  }
  72% {
    transform: translate3d(3px, 0, 0);
  }
  100% {
    transform: translate3d(0, 0, 0);
  }
}

/* 结界：后撤半步同时张开屏障，缩放比位移更重要 */
@keyframes witch-barrier {
  0% {
    transform: translate3d(0, 0, 0) scale(1);
  }
  30% {
    transform: translate3d(-7px, 0, 0) scale(1.06);
  }
  70% {
    transform: translate3d(-3px, 0, 0) scale(1.03);
  }
  100% {
    transform: translate3d(0, 0, 0) scale(1);
  }
}

/* ── 灵巫补齐的位移动作 ── */

/* 滑行：贴地平移，几乎没有上下起伏 —— 和喵喵的跳形成对比 */
@keyframes shaman-glide {
  0% {
    transform: translate3d(0, 0, 0);
  }
  40% {
    transform: translate3d(13px, -2px, 0);
  }
  70% {
    transform: translate3d(8px, 0, 0);
  }
  100% {
    transform: translate3d(0, 0, 0);
  }
}

/* 灵体连击：挥杖三下，幅度递减 */
@keyframes shaman-spirit-volley {
  0% {
    transform: rotate(0deg) translate3d(0, 0, 0);
  }
  22% {
    transform: rotate(-9deg) translate3d(6px, -3px, 0);
  }
  46% {
    transform: rotate(4deg) translate3d(2px, 0, 0);
  }
  68% {
    transform: rotate(-6deg) translate3d(5px, -2px, 0);
  }
  100% {
    transform: rotate(0deg) translate3d(0, 0, 0);
  }
}
</style>
