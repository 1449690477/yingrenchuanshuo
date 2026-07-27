<script setup lang="ts">
import type { ClassId, MonsterDef } from '@/core/types';
import { abbr } from '@/core/format';
import type { VisualSkill } from '@/data/skills';
import ClassArtwork from '@/components/ClassArtwork.vue';
import MonsterArtwork from '@/components/MonsterArtwork.vue';

defineProps<{
  classId: ClassId;
  playerName: string;
  monster: MonsterDef;
  supportMonsters: MonsterDef[];
  backgroundUrl: string;
  active: boolean;
  casting: boolean;
  hpPercent: number;
  currentHp: number;
  maxHp: number;
  attack: number;
  statusText: string;
  progressText: string;
  pulse: { id: number; damage: number; hits: number; kills: number } | null;
  skill: VisualSkill | null;
  effectUrl: string | null;
}>();
</script>

<template>
  <div
    class="battle-scene"
    :class="[`target-${monster.type}`, { active, casting }]"
    :aria-label="`${playerName}正在与${monster.name}战斗`"
  >
    <img class="scene-background" :src="backgroundUrl" alt="" aria-hidden="true" />
    <span class="scene-haze" aria-hidden="true" />
    <span class="scene-glow" aria-hidden="true" />

    <div class="ambient-particles" aria-hidden="true">
      <i v-for="n in 9" :key="n" />
    </div>

    <div class="battle-status">
      <span class="status-dot" />
      <span>{{ statusText }}</span>
      <strong class="num">{{ progressText }}</strong>
    </div>

    <div class="enemy-hud">
      <div class="enemy-line">
        <span v-if="monster.type !== 'normal'" class="enemy-rank">
          {{ monster.type === 'boss' ? 'BOSS' : '精英' }}
        </span>
        <strong>{{ monster.name }}</strong>
        <span class="num">Lv.{{ monster.level }}</span>
      </div>
      <div
        class="hpbar"
        role="meter"
        aria-label="目标生命"
        aria-valuemin="0"
        :aria-valuemax="maxHp"
        :aria-valuenow="currentHp"
      >
        <span class="hpbar-fill" :style="{ width: `${hpPercent}%` }" />
        <span class="hp-shine" />
        <strong class="hp-value num">生命 {{ abbr(currentHp) }} / {{ abbr(maxHp) }}</strong>
      </div>
    </div>

    <div class="hero-unit">
      <span class="actor-shadow" aria-hidden="true" />
      <div :key="pulse?.id ?? 0" class="hero-actor">
        <ClassArtwork :class-id="classId" variant="battle" :action="casting ? 'attack' : 'idle'" />
      </div>
      <span class="actor-name hero-name">
        <strong>{{ playerName }}</strong>
        <small class="num">攻击 {{ abbr(attack) }}</small>
      </span>
    </div>

    <div
      v-for="(support, index) in supportMonsters.slice(0, 2)"
      :key="support.id"
      class="support-unit"
      :class="`support-${index + 1}`"
      aria-hidden="true"
    >
      <span class="actor-shadow" />
      <MonsterArtwork :monster="support" />
    </div>

    <div :key="`${monster.id}-${pulse?.id ?? 0}`" class="enemy-unit" :class="{ hit: casting }">
      <span class="actor-shadow" aria-hidden="true" />
      <div class="enemy-actor">
        <MonsterArtwork :monster="monster" :action="casting ? 'hit' : 'idle'" />
      </div>
      <span class="actor-name enemy-name">{{ monster.name }}</span>
    </div>

    <Transition name="damage">
      <span v-if="pulse" :key="pulse.id" class="damage num">
        -{{ abbr(pulse.damage) }}
        <small v-if="pulse.hits > 1">×{{ pulse.hits }}</small>
      </span>
    </Transition>

    <div
      v-if="skill && effectUrl && pulse"
      :key="pulse.id"
      class="spell-fx"
      :class="`kind-${skill.visualKind}`"
      aria-hidden="true"
    >
      <img :src="effectUrl" alt="" draggable="false" />
      <i v-for="n in 8" :key="n" class="fx-particle" />
      <span class="spell-name">{{ skill.name }}</span>
    </div>

    <span class="foreground-vignette" aria-hidden="true" />
  </div>
</template>

<style scoped>
.battle-scene {
  isolation: isolate;
  position: relative;
  width: 100%;
  aspect-ratio: 3 / 2;
  min-height: 218px;
  overflow: hidden;
  color: #fff;
  background: #cbd9e5;
  border: 1px solid rgb(255 255 255 / 90%);
  border-radius: 16px;
  box-shadow:
    inset 0 0 0 1px rgb(53 69 91 / 12%),
    0 8px 20px rgb(76 70 98 / 15%);
}

.scene-background,
.scene-haze,
.scene-glow,
.foreground-vignette {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
}

.scene-background {
  z-index: -4;
  object-fit: cover;
  object-position: center;
  transform: scale(1.012);
}

.scene-haze {
  z-index: -3;
  background:
    linear-gradient(180deg, rgb(25 41 65 / 30%) 0%, transparent 26%),
    linear-gradient(0deg, rgb(35 43 55 / 20%) 0%, transparent 31%);
}

.scene-glow {
  z-index: -2;
  background:
    radial-gradient(circle at 22% 64%, rgb(255 222 238 / 16%), transparent 25%),
    radial-gradient(circle at 76% 61%, rgb(201 229 255 / 12%), transparent 27%);
  mix-blend-mode: screen;
}

.foreground-vignette {
  z-index: 10;
  pointer-events: none;
  box-shadow: inset 0 -24px 34px rgb(22 34 47 / 20%);
  border-radius: inherit;
}

.battle-status,
.enemy-hud,
.actor-name {
  text-shadow: 0 1px 3px rgb(24 31 44 / 82%);
  backdrop-filter: blur(4px);
}

.battle-status {
  position: absolute;
  z-index: 12;
  top: 9px;
  left: 9px;
  display: grid;
  grid-template-columns: auto auto;
  align-items: center;
  gap: 2px 5px;
  max-width: 42%;
  padding: 4px 8px;
  font-size: 10px;
  line-height: 1.1;
  background: rgb(28 42 61 / 58%);
  border: 1px solid rgb(255 255 255 / 28%);
  border-radius: 10px;
  box-shadow: 0 3px 8px rgb(25 33 47 / 15%);
}

.battle-status strong {
  grid-column: 1 / -1;
  padding-left: 11px;
  font-size: 9px;
  color: #fff5c7;
}

.status-dot {
  width: 6px;
  height: 6px;
  background: #7cf2bc;
  border: 1px solid rgb(255 255 255 / 72%);
  border-radius: 50%;
  box-shadow: 0 0 7px #62eaaa;
}

.battle-scene:not(.active) .status-dot {
  background: #d8dbe1;
  box-shadow: none;
}

.enemy-hud {
  position: absolute;
  z-index: 12;
  top: 9px;
  right: 9px;
  width: min(49%, 172px);
  padding: 5px 7px 6px;
  background: rgb(30 40 58 / 64%);
  border: 1px solid rgb(255 255 255 / 30%);
  border-radius: 10px;
  box-shadow: 0 3px 8px rgb(25 33 47 / 15%);
}

.enemy-line {
  display: flex;
  align-items: center;
  gap: 4px;
  min-width: 0;
  margin-bottom: 4px;
  font-size: 10px;
}

.enemy-line strong {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.enemy-line > .num {
  flex-shrink: 0;
  font-size: 8px;
  color: rgb(255 255 255 / 78%);
}

.enemy-rank {
  flex-shrink: 0;
  padding: 1px 4px;
  font-size: 7px;
  font-weight: 900;
  color: #fff4bc;
  background: rgb(234 98 126 / 76%);
  border-radius: 5px;
}

.target-boss .enemy-rank {
  color: #fff0cc;
  background: rgb(193 84 46 / 82%);
}

.hpbar {
  position: relative;
  display: block;
  height: 15px;
  overflow: hidden;
  background: rgb(15 21 32 / 52%);
  border: 1px solid rgb(255 255 255 / 24%);
  border-radius: 999px;
}

.hp-value {
  position: absolute;
  z-index: 2;
  inset: 0;
  display: grid;
  place-items: center;
  font-size: 8px;
  line-height: 1;
  color: #fff;
  text-shadow: 0 1px 2px rgb(25 29 42 / 92%);
}

.hpbar-fill {
  display: block;
  height: 100%;
  background: linear-gradient(90deg, #ff769b, #ffb0c6);
  border-radius: inherit;
  transition: width 0.24s linear;
}

.target-elite .hpbar-fill {
  background: linear-gradient(90deg, #71a8e8, #a8d8ff);
}

.target-boss .hpbar-fill {
  background: linear-gradient(90deg, #ff945b, #ffd47a);
}

.hp-shine {
  position: absolute;
  inset: 0;
  background: linear-gradient(180deg, rgb(255 255 255 / 40%), transparent 52%);
}

.hero-unit,
.enemy-unit,
.support-unit {
  position: absolute;
}

.actor-shadow {
  position: absolute;
  left: 50%;
  bottom: 2px;
  width: 72%;
  height: 13px;
  background: radial-gradient(ellipse, rgb(22 28 37 / 42%), transparent 70%);
  border-radius: 50%;
  transform: translateX(-50%);
  filter: blur(1px);
}

.hero-unit {
  z-index: 5;
  left: 1.5%;
  bottom: 4.5%;
  width: 39%;
  height: 82%;
}

.hero-actor {
  position: absolute;
  inset: 0 0 6px;
  filter: drop-shadow(0 5px 4px rgb(29 35 51 / 28%));
  transform-origin: 50% 92%;
}

.active:not(.casting) .hero-actor {
  animation: hero-idle 2.25s ease-in-out infinite;
}

.casting .hero-actor {
  animation: hero-cast 0.72s ease-out both;
}

.enemy-unit {
  z-index: 6;
  right: 2.5%;
  bottom: 7%;
  width: 35%;
  height: 58%;
}

.target-elite .enemy-unit {
  width: 39%;
  height: 64%;
}

.target-boss .enemy-unit {
  right: 0;
  width: 45%;
  height: 72%;
}

.enemy-actor {
  position: absolute;
  inset: 0 0 6px;
  filter: drop-shadow(0 5px 4px rgb(27 31 44 / 30%));
  transform-origin: 50% 91%;
}

.active .enemy-actor {
  animation: enemy-idle 2s ease-in-out infinite reverse;
}

.enemy-unit.hit .enemy-actor {
  animation: enemy-hit 0.42s ease-out;
}

.hero-actor :deep(.class-art),
.enemy-actor :deep(.monster-art),
.support-unit :deep(.monster-art) {
  width: 100%;
  height: 100%;
}

.support-unit {
  z-index: 3;
  width: 19%;
  height: 29%;
  opacity: 0.68;
  filter: saturate(0.86);
}

.support-unit .actor-shadow {
  height: 8px;
}

.support-unit :deep(.monster-art) {
  position: absolute;
  inset: 0 0 4px;
  filter: drop-shadow(0 3px 3px rgb(27 31 44 / 24%));
}

.support-1 {
  right: 26%;
  bottom: 28%;
  animation: support-bob 2.5s ease-in-out infinite;
}

.support-2 {
  right: 43%;
  bottom: 35%;
  width: 16%;
  height: 24%;
  opacity: 0.52;
  animation: support-bob 2.8s 0.35s ease-in-out infinite;
}

.actor-name {
  position: absolute;
  bottom: -3px;
  max-width: 104px;
  overflow: hidden;
  padding: 2px 7px;
  font-size: 9px;
  font-weight: 800;
  text-overflow: ellipsis;
  white-space: nowrap;
  background: rgb(32 46 62 / 56%);
  border: 1px solid rgb(255 255 255 / 28%);
  border-radius: 999px;
}

.actor-name strong,
.actor-name small {
  display: block;
}

.actor-name small {
  margin-top: 1px;
  font-size: 8px;
  color: #fff2b8;
}

.hero-name {
  left: 8px;
}

.enemy-name {
  right: 8px;
}

.damage {
  position: absolute;
  z-index: 14;
  top: 35%;
  right: 18%;
  font-size: 20px;
  font-weight: 900;
  color: #fff4bc;
  text-shadow:
    0 2px 0 #bd4d59,
    0 0 8px rgb(255 105 137 / 75%);
  pointer-events: none;
}

.damage small {
  font-size: 11px;
}

.damage-enter-from {
  opacity: 0;
  transform: translateY(12px) scale(0.7);
}

.damage-enter-active {
  transition: all 0.16s ease-out;
}

.damage-leave-to {
  opacity: 0;
  transform: translateY(-24px) scale(1.08);
}

.damage-leave-active {
  transition: all 0.62s ease-in;
}

.spell-fx {
  position: absolute;
  z-index: 8;
  right: 0;
  bottom: 9%;
  width: 49%;
  height: 59%;
  pointer-events: none;
}

.spell-fx > img {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  object-fit: contain;
  filter: drop-shadow(0 3px 8px rgb(82 64 135 / 34%));
}

.kind-projectile {
  left: 26%;
  right: auto;
  width: 70%;
}

.kind-heal,
.kind-ring {
  right: auto;
  left: 0;
  bottom: 6%;
  width: 45%;
  height: 65%;
}

.kind-summon {
  right: auto;
  left: 18%;
  bottom: 2%;
  width: 45%;
  height: 56%;
}

.kind-projectile > img {
  animation: projectile-cast 0.78s ease-out both;
}

.kind-ring > img {
  animation: ring-cast 0.86s ease-out both;
}

.kind-lightning > img {
  animation: lightning-cast 0.72s ease-out both;
}

.kind-slash > img {
  animation: slash-cast 0.64s ease-out both;
}

.kind-arc > img {
  animation: arc-cast 0.78s ease-out both;
}

.kind-flame > img {
  animation: flame-cast 0.8s ease-out both;
}

.kind-heal > img {
  animation: heal-cast 0.9s ease-out both;
}

.kind-poison > img {
  animation: poison-cast 0.86s ease-out both;
}

.kind-summon > img {
  animation: summon-cast 0.94s ease-out both;
}

.spell-name {
  position: absolute;
  right: 10px;
  bottom: 5px;
  padding: 2px 7px;
  font-size: 8px;
  font-weight: 900;
  color: #ca587d;
  text-shadow: none;
  background: rgb(255 255 255 / 86%);
  border: 1px solid rgb(255 255 255 / 78%);
  border-radius: 999px;
  box-shadow: 0 2px 6px rgb(36 42 60 / 14%);
  animation: spell-label 0.85s ease-out both;
}

.kind-heal .spell-name,
.kind-ring .spell-name,
.kind-summon .spell-name {
  right: auto;
  left: 10px;
}

.fx-particle {
  --dx: 0px;
  --dy: -34px;
  position: absolute;
  left: 53%;
  top: 54%;
  width: 7px;
  height: 7px;
  background: #ff9ac1;
  border: 1px solid #fff;
  border-radius: 2px;
  transform: rotate(45deg);
  box-shadow: 0 0 6px rgb(255 255 255 / 72%);
  animation: fx-particle 0.76s ease-out both;
}

.fx-particle:nth-of-type(2) {
  --dx: 48px;
  --dy: -28px;
}

.fx-particle:nth-of-type(3) {
  --dx: 55px;
  --dy: 14px;
  width: 5px;
  height: 5px;
  background: #8ec9ff;
}

.fx-particle:nth-of-type(4) {
  --dx: 38px;
  --dy: 38px;
  background: #ffe49b;
}

.fx-particle:nth-of-type(5) {
  --dx: -44px;
  --dy: 31px;
}

.fx-particle:nth-of-type(6) {
  --dx: -52px;
  --dy: -17px;
  width: 5px;
  height: 5px;
  background: #c3b1ff;
}

.fx-particle:nth-of-type(7) {
  --dx: -24px;
  --dy: -46px;
  background: #8ec9ff;
}

.fx-particle:nth-of-type(8) {
  --dx: 14px;
  --dy: 46px;
  width: 5px;
  height: 5px;
  background: #ffe49b;
}

.ambient-particles {
  position: absolute;
  z-index: 2;
  inset: 0;
  overflow: hidden;
  pointer-events: none;
}

.ambient-particles i {
  --start-x: 12%;
  --drift: 25px;
  position: absolute;
  left: var(--start-x);
  top: -10%;
  width: 5px;
  height: 8px;
  opacity: 0;
  background: rgb(255 190 217 / 88%);
  border-radius: 80% 20% 70% 30%;
  animation: petal-fall 6s linear infinite;
}

.ambient-particles i:nth-child(2) {
  --start-x: 28%;
  --drift: -18px;
  animation-delay: -4.2s;
}

.ambient-particles i:nth-child(3) {
  --start-x: 43%;
  --drift: 30px;
  animation-delay: -1.5s;
}

.ambient-particles i:nth-child(4) {
  --start-x: 58%;
  --drift: -27px;
  width: 4px;
  height: 6px;
  animation-delay: -5.3s;
}

.ambient-particles i:nth-child(5) {
  --start-x: 72%;
  --drift: 17px;
  animation-delay: -2.4s;
}

.ambient-particles i:nth-child(6) {
  --start-x: 87%;
  --drift: -24px;
  animation-delay: -0.7s;
}

.ambient-particles i:nth-child(7) {
  --start-x: 20%;
  --drift: 39px;
  width: 3px;
  height: 5px;
  animation-delay: -3.3s;
}

.ambient-particles i:nth-child(8) {
  --start-x: 65%;
  --drift: -36px;
  width: 3px;
  height: 5px;
  animation-delay: -5.8s;
}

.ambient-particles i:nth-child(9) {
  --start-x: 94%;
  --drift: -22px;
  animation-delay: -2.9s;
}

@keyframes hero-idle {
  0%,
  100% {
    transform: translateY(0) rotate(0);
  }
  50% {
    transform: translateY(-4px) rotate(-0.6deg);
  }
}

@keyframes hero-cast {
  0%,
  100% {
    transform: translate(0) scale(1);
  }
  30% {
    transform: translate(10px, -3px) scale(1.04) rotate(1.5deg);
  }
  58% {
    transform: translate(7px, 0) scale(1.02);
  }
}

@keyframes enemy-idle {
  0%,
  100% {
    transform: translateY(0) scale(1);
  }
  50% {
    transform: translateY(-3px) scale(1.015);
  }
}

@keyframes enemy-hit {
  0%,
  100% {
    transform: translateX(0) scale(1);
    filter: brightness(1);
  }
  28% {
    transform: translateX(8px) scale(0.94);
    filter: brightness(1.8) saturate(0.6);
  }
  55% {
    transform: translateX(-3px) scale(1.02);
  }
}

@keyframes support-bob {
  0%,
  100% {
    transform: translateY(0);
  }
  50% {
    transform: translateY(-3px);
  }
}

@keyframes projectile-cast {
  0% {
    opacity: 0;
    transform: translateX(-42%) scale(0.22) rotate(-16deg);
  }
  38% {
    opacity: 1;
  }
  100% {
    opacity: 0;
    transform: translateX(21%) scale(0.92) rotate(3deg);
  }
}

@keyframes ring-cast {
  0% {
    opacity: 0;
    transform: scale(0.18) rotate(-55deg);
  }
  44% {
    opacity: 1;
  }
  100% {
    opacity: 0;
    transform: scale(1.16) rotate(18deg);
  }
}

@keyframes lightning-cast {
  0% {
    opacity: 0;
    transform: translateY(-30px) scaleY(1.24) scaleX(0.75);
  }
  25%,
  50% {
    opacity: 1;
    filter: brightness(1.35) drop-shadow(0 0 9px rgb(137 151 255 / 68%));
  }
  100% {
    opacity: 0;
    transform: translateY(2px) scale(1.06);
  }
}

@keyframes slash-cast {
  0% {
    opacity: 0;
    transform: translate(-28px, 18px) scale(0.46) rotate(-15deg);
  }
  32% {
    opacity: 1;
  }
  100% {
    opacity: 0;
    transform: translate(5px, -3px) scale(1.08) rotate(2deg);
  }
}

@keyframes arc-cast {
  0% {
    opacity: 0;
    transform: translateX(-24px) scale(0.36) rotate(-20deg);
  }
  42% {
    opacity: 1;
  }
  100% {
    opacity: 0;
    transform: translateX(6px) scale(1.14) rotate(8deg);
  }
}

@keyframes flame-cast {
  0% {
    opacity: 0;
    transform: translateY(24px) scale(0.38);
  }
  34%,
  60% {
    opacity: 1;
    filter: brightness(1.18) drop-shadow(0 0 9px rgb(255 132 136 / 62%));
  }
  100% {
    opacity: 0;
    transform: translateY(-5px) scale(1.08);
  }
}

@keyframes heal-cast {
  0% {
    opacity: 0;
    transform: translateY(18px) scale(0.3);
  }
  42%,
  70% {
    opacity: 1;
    filter: brightness(1.15) drop-shadow(0 0 9px rgb(126 194 255 / 58%));
  }
  100% {
    opacity: 0;
    transform: translateY(-8px) scale(1.08);
  }
}

@keyframes poison-cast {
  0% {
    opacity: 0;
    transform: scale(0.25) rotate(-24deg);
  }
  38%,
  65% {
    opacity: 0.94;
  }
  100% {
    opacity: 0;
    transform: scale(1.12) rotate(8deg);
  }
}

@keyframes summon-cast {
  0% {
    opacity: 0;
    transform: translateY(32px) scaleY(0.35) scaleX(0.72);
  }
  46%,
  72% {
    opacity: 1;
    filter: drop-shadow(0 0 9px rgb(139 125 231 / 58%));
  }
  100% {
    opacity: 0;
    transform: translateY(-4px) scale(1.05);
  }
}

@keyframes fx-particle {
  0% {
    opacity: 0;
    transform: translate(0) rotate(45deg) scale(0.2);
  }
  35% {
    opacity: 1;
  }
  100% {
    opacity: 0;
    transform: translate(var(--dx), var(--dy)) rotate(135deg) scale(1);
  }
}

@keyframes spell-label {
  0%,
  100% {
    opacity: 0;
    transform: translateY(4px);
  }
  26%,
  68% {
    opacity: 1;
    transform: translateY(0);
  }
}

@keyframes petal-fall {
  0% {
    opacity: 0;
    transform: translate(0, -8px) rotate(0);
  }
  12%,
  72% {
    opacity: 0.8;
  }
  100% {
    opacity: 0;
    transform: translate(var(--drift), 246px) rotate(310deg);
  }
}

@media (prefers-reduced-motion: reduce) {
  .hero-actor,
  .enemy-actor,
  .support-unit,
  .ambient-particles i {
    animation: none !important;
  }

  .spell-fx,
  .damage {
    display: none;
  }
}
</style>
