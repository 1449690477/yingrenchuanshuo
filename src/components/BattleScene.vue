<script setup lang="ts">
import { computed } from 'vue';
import type { ClassId, MonsterDef } from '@/core/types';
import { abbr } from '@/core/format';
import {
  BASIC_ATTACK_EFFECTS,
  type EquippedRecord,
} from '@/data/characterAppearance';
import type { VisualSkill } from '@/data/skills';
import CharacterAppearance from '@/components/CharacterAppearance.vue';
import MonsterArtwork from '@/components/MonsterArtwork.vue';

const props = defineProps<{
  classId: ClassId;
  level: number;
  equipped: EquippedRecord | null;
  playerName: string;
  monster: MonsterDef;
  backgroundUrl: string;
  active: boolean;
  casting: boolean;
  impactDelayMs: number;
  hpPercent: number;
  currentHp: number;
  maxHp: number;
  attack: number;
  playerHpPercent: number;
  playerCurrentHp: number;
  playerMaxHp: number;
  monsterAttacking: boolean;
  statusText: string;
  progressText: string;
  pulse: { id: number; damage: number; hits: number; kills: number } | null;
  incomingPulse: { id: number; damage: number; hits: number } | null;
  skillStates: { skill: VisualSkill; remaining: number }[];
  skill: VisualSkill | null;
  effectUrl: string | null;
  drop: { id: number; name: string; quality: string; assetUrl: string } | null;
}>();

const assetUrl = (path: string) => `${import.meta.env.BASE_URL}${path}`;
const basicEffectUrl = computed(
  () => `${import.meta.env.BASE_URL}${BASIC_ATTACK_EFFECTS[props.classId]}`,
);
</script>

<template>
  <div
    class="battle-scene"
    :class="[`target-${monster.type}`, { active, casting }]"
    :style="{ '--impact-delay': `${impactDelayMs}ms` }"
    :aria-label="`${playerName}正在与${monster.name}战斗`"
  >
    <img class="scene-background" :src="backgroundUrl" alt="" aria-hidden="true" />
    <span class="scene-haze" aria-hidden="true" />
    <span class="scene-glow" aria-hidden="true" />

    <div class="ambient-particles" aria-hidden="true">
      <i v-for="n in 9" :key="n" />
    </div>

    <div class="battle-status">
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

    <div class="player-hud">
      <div class="player-line">
        <strong>{{ playerName }}</strong>
        <span class="num">攻击 {{ abbr(attack) }}</span>
      </div>
      <div
        class="hpbar player-hpbar"
        role="meter"
        aria-label="角色生命"
        aria-valuemin="0"
        :aria-valuemax="playerMaxHp"
        :aria-valuenow="playerCurrentHp"
      >
        <span class="hpbar-fill" :style="{ width: `${playerHpPercent}%` }" />
        <span class="hp-shine" />
        <strong class="hp-value num">
          HP {{ abbr(playerCurrentHp) }} / {{ abbr(playerMaxHp) }}
        </strong>
      </div>
    </div>

    <div class="hero-unit" :class="{ hit: monsterAttacking }">
      <span class="actor-shadow" aria-hidden="true" />
      <div class="hero-actor">
        <CharacterAppearance
          :class-id="classId"
          :level="level"
          :equipped="equipped"
          variant="battle"
          :action="monsterAttacking ? 'react' : casting ? (skill ? 'cast' : 'attack') : 'idle'"
        />
      </div>
    </div>

    <div class="enemy-unit" :class="{ hit: casting, attacking: monsterAttacking }">
      <span class="actor-shadow" aria-hidden="true" />
      <div class="enemy-actor">
        <MonsterArtwork
          :monster="monster"
          :action="monsterAttacking ? 'attack' : casting ? 'hit' : 'idle'"
        />
      </div>
    </div>

    <Transition name="damage">
      <span v-if="pulse && casting" :key="pulse.id" class="damage num">
        -{{ abbr(pulse.damage) }}
        <small v-if="pulse.hits > 1">×{{ pulse.hits }}</small>
      </span>
    </Transition>

    <div
      v-if="pulse && casting && !skill"
      :key="`basic-${pulse.id}`"
      class="basic-attack-fx"
      :class="`basic-${classId}`"
      aria-hidden="true"
    >
      <img :src="basicEffectUrl" alt="" draggable="false" />
      <i v-for="n in 5" :key="n" />
    </div>

    <Transition name="damage">
      <span
        v-if="incomingPulse && monsterAttacking"
        :key="incomingPulse.id"
        class="damage incoming num"
      >
        -{{ abbr(incomingPulse.damage) }}
        <small v-if="incomingPulse.hits > 1">×{{ incomingPulse.hits }}</small>
      </span>
    </Transition>

    <div v-if="skillStates.length > 0" class="skill-dock" aria-label="技能冷却">
      <span
        v-for="state in skillStates"
        :key="state.skill.id"
        class="battle-skill"
        :class="{ cooling: state.remaining > 0 }"
        :title="`${state.skill.name} · 冷却 ${state.skill.cooldown} 秒`"
      >
        <img :src="assetUrl(state.skill.icon)" alt="" draggable="false" />
        <strong v-if="state.remaining > 0" class="skill-cd num">
          {{ Math.min(state.skill.cooldown, Math.ceil(state.remaining)) }}
        </strong>
      </span>
    </div>

    <div
      v-if="skill && effectUrl && pulse && casting"
      :key="pulse.id"
      class="spell-fx"
      :class="`kind-${skill.visualKind}`"
      aria-hidden="true"
    >
      <img :src="effectUrl" alt="" draggable="false" />
      <i v-for="n in 8" :key="n" class="fx-particle" />
      <span class="spell-name">{{ skill.name }}</span>
    </div>

    <div
      v-if="drop"
      :key="`drop-${drop.id}`"
      class="loot-burst"
      :class="`drop-${drop.quality}`"
      aria-hidden="true"
    >
      <span class="loot-orb">
        <img :src="drop.assetUrl" alt="" draggable="false" />
      </span>
      <strong>{{ drop.name }}</strong>
      <i v-for="n in 6" :key="n" />
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
.player-hud {
  text-shadow: 0 1px 3px rgb(24 31 44 / 82%);
  backdrop-filter: blur(4px);
}

.player-hud {
  position: absolute;
  z-index: 12;
  top: 9px;
  left: 9px;
  width: 31%;
  padding: 5px 7px 6px;
  background: rgb(30 40 58 / 64%);
  border: 1px solid rgb(255 255 255 / 30%);
  border-radius: 9px;
  box-shadow: 0 3px 8px rgb(25 33 47 / 15%);
}

.player-line {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 4px;
  margin-bottom: 3px;
  font-size: 10px;
}

.player-line strong {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.player-line .num {
  flex-shrink: 0;
  color: rgb(255 255 255 / 82%);
}

.player-hpbar {
  height: 15px;
}

.player-hpbar .hpbar-fill {
  background: linear-gradient(90deg, #5fc5d9, #8ce5b6);
}

.battle-status {
  position: absolute;
  z-index: 12;
  top: 9px;
  left: 50%;
  width: 24%;
  box-sizing: border-box;
  transform: translateX(-50%);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 2px;
  padding: 4px 5px;
  font-size: 9px;
  line-height: 1.1;
  background: rgb(28 42 61 / 58%);
  border: 1px solid rgb(255 255 255 / 28%);
  border-radius: 10px;
  box-shadow: 0 3px 8px rgb(25 33 47 / 15%);
}

.battle-status strong {
  padding-left: 0;
  font-size: 8px;
  text-align: center;
  color: #fff5c7;
}

.enemy-hud {
  position: absolute;
  z-index: 12;
  top: 9px;
  right: 9px;
  width: 35%;
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
.enemy-unit {
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
  animation-delay: var(--impact-delay);
}

.enemy-unit.attacking .enemy-actor {
  animation: enemy-attack 0.52s ease-out;
}

.hero-actor :deep(.class-art),
.enemy-actor :deep(.monster-art) {
  width: 100%;
  height: 100%;
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
  animation: damage-pop 0.78s ease-out both;
  animation-delay: var(--impact-delay);
}

.damage small {
  font-size: 11px;
}

.damage.incoming {
  top: 39%;
  right: auto;
  left: 22%;
  color: #ffd1df;
  text-shadow:
    0 2px 0 #9f3f58,
    0 0 8px rgb(255 105 137 / 72%);
}

.skill-dock {
  position: absolute;
  z-index: 13;
  left: 42%;
  bottom: 5px;
  display: flex;
  gap: 4px;
}

.battle-skill {
  position: relative;
  display: grid;
  place-items: center;
  width: 30px;
  height: 30px;
  overflow: hidden;
  background: rgb(255 255 255 / 88%);
  border: 1px solid rgb(255 255 255 / 82%);
  border-radius: 9px;
  box-shadow: 0 2px 7px rgb(28 34 50 / 28%);
}

.battle-skill img {
  width: 116%;
  height: 116%;
  object-fit: contain;
}

.battle-skill.cooling img {
  filter: grayscale(0.65) brightness(0.55);
}

.skill-cd {
  position: absolute;
  inset: 0;
  display: grid;
  place-items: center;
  font-size: 12px;
  color: #fff;
  text-shadow: 0 1px 3px #182130;
  background: rgb(22 30 43 / 30%);
}

.basic-attack-fx {
  position: absolute;
  z-index: 9;
  right: 17%;
  bottom: 24%;
  width: 35%;
  aspect-ratio: 1;
  pointer-events: none;
}

.basic-attack-fx > img {
  width: 100%;
  height: 100%;
  object-fit: contain;
  filter: drop-shadow(0 2px 7px rgb(91 92 148 / 35%));
  animation: basic-impact 0.62s ease-out both;
}

.basic-swordsman {
  right: 18%;
  bottom: 19%;
  width: 43%;
  transform: rotate(-8deg);
}

.basic-witch {
  right: 18%;
  bottom: 28%;
  width: 32%;
}

.basic-shaman {
  right: 20%;
  bottom: 25%;
  width: 31%;
}

.basic-attack-fx i {
  --dx: 29px;
  --dy: -22px;
  position: absolute;
  left: 54%;
  top: 52%;
  width: 5px;
  height: 5px;
  opacity: 0;
  background: #ff9fc4;
  border: 1px solid #fff;
  border-radius: 50%;
  box-shadow: 0 0 5px rgb(255 255 255 / 70%);
  animation: basic-particle 0.55s 110ms ease-out both;
}

.basic-attack-fx i:nth-of-type(2) {
  --dx: -27px;
  --dy: -18px;
  background: #9ddcff;
}

.basic-attack-fx i:nth-of-type(3) {
  --dx: 35px;
  --dy: 12px;
  background: #ffe296;
}

.basic-attack-fx i:nth-of-type(4) {
  --dx: -23px;
  --dy: 25px;
}

.basic-attack-fx i:nth-of-type(5) {
  --dx: 4px;
  --dy: -35px;
  background: #c4b4ff;
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

.loot-burst {
  --loot-color: #9bc6ad;
  position: absolute;
  z-index: 15;
  left: 46%;
  bottom: 5%;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1px;
  color: #fff;
  pointer-events: none;
  animation: loot-rise 1.15s ease-out both;
}

.drop-fine {
  --loot-color: var(--q-fine);
}

.drop-rare {
  --loot-color: var(--q-rare);
}

.drop-epic {
  --loot-color: var(--q-epic);
}

.drop-legendary {
  --loot-color: var(--q-legendary);
}

.drop-mythic {
  --loot-color: var(--q-mythic);
}

.drop-divine {
  --loot-color: var(--q-divine);
}

.loot-orb {
  position: relative;
  width: 34px;
  height: 34px;
  display: grid;
  place-items: center;
  overflow: hidden;
  background:
    radial-gradient(circle at 35% 28%, #fff, transparent 34%),
    color-mix(in srgb, var(--loot-color) 23%, rgb(255 255 255 / 88%));
  border: 1.5px solid color-mix(in srgb, var(--loot-color) 78%, white);
  border-radius: 50%;
  box-shadow:
    0 0 0 3px color-mix(in srgb, var(--loot-color) 17%, transparent),
    0 0 12px color-mix(in srgb, var(--loot-color) 68%, transparent);
}

.loot-orb img {
  width: 88%;
  height: 88%;
  object-fit: contain;
  filter: drop-shadow(0 1px 2px rgb(50 58 75 / 18%));
}

.loot-burst strong {
  max-width: 94px;
  overflow: hidden;
  padding: 2px 6px;
  font-size: 7px;
  color: color-mix(in srgb, var(--loot-color) 70%, #39465b);
  text-overflow: ellipsis;
  text-shadow: none;
  white-space: nowrap;
  background: rgb(255 255 255 / 86%);
  border: 1px solid rgb(255 255 255 / 72%);
  border-radius: 999px;
  box-shadow: 0 2px 5px rgb(35 43 58 / 14%);
}

.loot-burst i {
  --spark-x: 25px;
  --spark-y: -19px;
  position: absolute;
  left: 50%;
  top: 17px;
  width: 4px;
  height: 4px;
  background: var(--loot-color);
  border: 1px solid #fff;
  transform: rotate(45deg);
  animation: loot-spark 0.74s ease-out both;
}

.loot-burst i:nth-of-type(2) {
  --spark-x: -26px;
  --spark-y: -14px;
}

.loot-burst i:nth-of-type(3) {
  --spark-x: 31px;
  --spark-y: 9px;
}

.loot-burst i:nth-of-type(4) {
  --spark-x: -28px;
  --spark-y: 13px;
}

.loot-burst i:nth-of-type(5) {
  --spark-x: 5px;
  --spark-y: -30px;
}

.loot-burst i:nth-of-type(6) {
  --spark-x: -5px;
  --spark-y: 28px;
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

@keyframes basic-impact {
  0% {
    opacity: 0;
    transform: translate(-18px, 10px) scale(0.28) rotate(-14deg);
  }
  18% {
    opacity: 0.7;
  }
  38%,
  70% {
    opacity: 1;
  }
  84% {
    opacity: 0.45;
  }
  100% {
    opacity: 0;
    transform: translate(7px, -3px) scale(1.05) rotate(4deg);
  }
}

@keyframes damage-pop {
  0% {
    opacity: 0;
    transform: translateY(12px) scale(0.7);
  }
  22%,
  50% {
    opacity: 1;
    transform: translateY(0) scale(1);
  }
  100% {
    opacity: 0;
    transform: translateY(-24px) scale(1.08);
  }
}

@keyframes basic-particle {
  0% {
    opacity: 0;
    transform: translate(0) scale(0.2);
  }
  36% {
    opacity: 1;
  }
  100% {
    opacity: 0;
    transform: translate(var(--dx), var(--dy)) scale(1);
  }
}

@keyframes loot-rise {
  0% {
    opacity: 0;
    transform: translateY(16px) scale(0.45);
  }
  28%,
  62% {
    opacity: 1;
    transform: translateY(0) scale(1);
  }
  100% {
    opacity: 0;
    transform: translateY(-28px) scale(0.92);
  }
}

@keyframes loot-spark {
  0% {
    opacity: 0;
    transform: translate(0) rotate(45deg) scale(0.2);
  }
  38% {
    opacity: 1;
  }
  100% {
    opacity: 0;
    transform: translate(var(--spark-x), var(--spark-y)) rotate(135deg) scale(1);
  }
}

@keyframes enemy-attack {
  0%,
  100% {
    transform: translateX(0) scale(1);
  }
  36% {
    transform: translateX(-10px) scale(1.04);
  }
  62% {
    transform: translateX(-6px) scale(1.02);
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
  .ambient-particles i,
  .basic-attack-fx,
  .basic-attack-fx i,
  .loot-burst,
  .loot-burst i {
    animation: none !important;
  }

  .spell-fx,
  .basic-attack-fx,
  .loot-burst,
  .damage {
    display: none;
  }
}
</style>
