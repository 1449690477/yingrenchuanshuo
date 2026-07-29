<script setup lang="ts">
import { computed, onUnmounted, ref, watch } from 'vue';
import { FastForward, Shield, Sparkles, Swords, Timer } from '@lucide/vue';
import type { ClassId } from '@/core/types';
import type { CombatTimelineEvent } from '@/core/combat';
import { abbr } from '@/core/format';
import type { TrialRunResult, WeeklyTrialBoss } from '@/core/trial';
import {
  BASIC_ATTACK_EFFECTS,
  resolveCharacterAppearance,
  type CharacterAction,
  type EquippedRecord,
} from '@/data/characterAppearance';
import { basicBattleAction } from '@/data/battleMotions';
import { battleRhythmSkills } from '@/data/skills';
import { ELEMENT_LABELS, TRIAL_DURATION_SEC } from '@/data/trialRules';
import { requireTrialVisual, TRIAL_PHASES, type TrialBossElement } from '@/data/trialVisuals';
import CharacterAppearance from '@/components/CharacterAppearance.vue';

const props = withDefaults(
  defineProps<{
    boss: WeeklyTrialBoss;
    classId: ClassId;
    level: number;
    equipped: EquippedRecord | null;
    playerName: string;
    run: TrialRunResult | null;
    playbackKey: number;
    reduceMotion?: boolean;
  }>(),
  {
    reduceMotion: false,
  },
);

const emit = defineEmits<{
  complete: [playbackKey: number];
}>();

interface LiveFloat {
  id: number;
  source: CombatTimelineEvent['source'];
  damage: number;
  crit: boolean;
  miss: boolean;
  element: string;
  offset: number;
}

const visual = computed(() => requireTrialVisual(props.boss.tilt.id, props.boss.combatant.element));
const sceneUrl = computed(() => `${import.meta.env.BASE_URL}${visual.value.sceneAsset}`);
const bossUrl = computed(() => `${import.meta.env.BASE_URL}${visual.value.bossAsset}`);
const basicEffectUrl = computed(() => {
  const appearance = resolveCharacterAppearance(props.classId, props.level, props.equipped);
  return `${import.meta.env.BASE_URL}${
    appearance.boutiqueEffectAsset ?? BASIC_ATTACK_EFFECTS[props.classId]
  }`;
});
const skills = computed(() => battleRhythmSkills(props.classId, props.level));

const running = ref(false);
const hasPlayed = ref(false);
const elapsedSec = ref(0);
const score = ref(0);
const bossHp = ref(props.boss.combatant.stats.hp);
const playerHp = ref(1);
const heroAction = ref<CharacterAction>('idle');
const heroSeq = ref(0);
const bossPose = ref<'idle' | 'attack' | 'hit'>('idle');
const bossPoseSeq = ref(0);
const currentEffectUrl = ref('');
const currentEffectSeq = ref(0);
const signatureSeq = ref(0);
const liveFloats = ref<LiveFloat[]>([]);
const impactSide = ref<'hero' | 'boss' | null>(null);
const canSkip = ref(false);

let frameId = 0;
let finishTimer = 0;
let playbackStartedAt = 0;
let playbackDurationMs = 0;
let eventCursor = 0;
let directPlayerHits = 0;
let directMonsterHits = 0;
let floatSeq = 0;
let completedKey = -1;
let poseResetAt = 0;
let effectResetAt = 0;
let signatureResetAt = 0;
let impactResetAt = 0;
let presentationHealing = 0;

const playerMaxHp = computed(() => props.run?.playerHpMax ?? Math.max(1, playerHp.value));
const bossMaxHp = computed(() => props.run?.bossHpMax ?? props.boss.combatant.stats.hp);
const playerHpRatio = computed(() =>
  Math.min(1, Math.max(0, playerHp.value / Math.max(1, playerMaxHp.value))),
);
const bossHpRatio = computed(() =>
  Math.min(1, Math.max(0, bossHp.value / Math.max(1, bossMaxHp.value))),
);
const progressRatio = computed(() =>
  Math.min(1, Math.max(0, elapsedSec.value / TRIAL_DURATION_SEC)),
);
const remainingSec = computed(() => Math.max(0, Math.ceil(TRIAL_DURATION_SEC - elapsedSec.value)));
const phaseIndex = computed(() =>
  Math.min(TRIAL_PHASES.length - 1, Math.floor(elapsedSec.value / 15)),
);
const phase = computed(() => TRIAL_PHASES[phaseIndex.value]);
const element = computed(() => props.boss.combatant.element as TrialBossElement);
const elementLabel = computed(() => ELEMENT_LABELS[element.value]);
const statusText = computed(() => {
  if (running.value) return `${phase.value.label} · 演算中`;
  if (!hasPlayed.value) return '等待挑战';
  return props.run?.survived ? '60 秒演算完成' : '挑战者提前倒下';
});
const heroActorKey = computed(() => `${props.playbackKey}:${heroSeq.value}:${heroAction.value}`);
const bossActorKey = computed(() => `${props.playbackKey}:${bossPoseSeq.value}:${bossPose.value}`);
const sceneStyle = computed(() => ({
  '--trial-accent': visual.value.accent,
  '--trial-glow': visual.value.glow,
  '--boss-scale': String(visual.value.bossScale),
  '--trial-progress': String(progressRatio.value),
}));

watch(
  () => props.boss.name,
  () => resetPreview(),
);

watch(
  () => props.playbackKey,
  () => {
    if (props.playbackKey <= 0 || !props.run) return;
    startPlayback(props.run);
  },
);

onUnmounted(() => {
  cancelAnimationFrame(frameId);
  clearTimeout(finishTimer);
});

function resetPreview(): void {
  cancelAnimationFrame(frameId);
  clearTimeout(finishTimer);
  running.value = false;
  hasPlayed.value = false;
  elapsedSec.value = 0;
  score.value = 0;
  bossHp.value = props.boss.combatant.stats.hp;
  playerHp.value = props.run?.playerHpMax ?? 1;
  heroAction.value = 'idle';
  bossPose.value = 'idle';
  liveFloats.value = [];
  currentEffectUrl.value = '';
  impactSide.value = null;
  canSkip.value = false;
}

function startPlayback(run: TrialRunResult): void {
  cancelAnimationFrame(frameId);
  clearTimeout(finishTimer);
  completedKey = -1;
  running.value = true;
  hasPlayed.value = true;
  elapsedSec.value = 0;
  score.value = 0;
  bossHp.value = run.bossHpMax;
  playerHp.value = run.playerHpMax;
  heroAction.value = 'idle';
  bossPose.value = 'idle';
  liveFloats.value = [];
  currentEffectUrl.value = '';
  impactSide.value = null;
  canSkip.value = false;
  eventCursor = 0;
  directPlayerHits = 0;
  directMonsterHits = 0;
  presentationHealing = Math.max(
    0,
    run.playerHpRemaining - Math.max(0, run.playerHpMax - run.damageTaken),
  );
  playbackDurationMs = props.reduceMotion
    ? Math.min(1_800, Math.max(600, run.durationSec * 1_000))
    : Math.max(6_000, run.durationSec * 1_000);
  playbackStartedAt = performance.now();
  frameId = requestAnimationFrame(playbackFrame);
}

function playbackFrame(now: number): void {
  const run = props.run;
  if (!run || !running.value) return;
  const progress = Math.min(1, Math.max(0, (now - playbackStartedAt) / playbackDurationMs));
  if (!props.reduceMotion && now - playbackStartedAt >= 3_000) canSkip.value = true;
  elapsedSec.value = run.durationSec * progress;
  const targetCursor = Math.min(run.timeline.length, Math.floor(run.timeline.length * progress));
  while (eventCursor < targetCursor) {
    processEvent(run.timeline[eventCursor], eventCursor >= targetCursor - 5);
    eventCursor++;
  }

  if (now >= poseResetAt) {
    heroAction.value = 'idle';
    bossPose.value = 'idle';
  }
  if (now >= effectResetAt) currentEffectUrl.value = '';
  if (now >= signatureResetAt) signatureSeq.value = 0;
  if (now >= impactResetAt) impactSide.value = null;

  if (progress < 1) {
    frameId = requestAnimationFrame(playbackFrame);
    return;
  }
  finishPlayback(false);
}

function processEvent(event: CombatTimelineEvent, showFloat: boolean): void {
  const damage = Math.max(0, event.event.damage);
  const direct = event.event.kind === 'direct-damage';
  const crit = event.event.kind === 'direct-damage' && event.event.crit;
  const miss = event.event.kind === 'direct-damage' && !event.event.hit;

  if (event.source === 'player') {
    bossHp.value = Math.max(0, bossHp.value - damage);
    score.value += damage;
    if (presentationHealing > 0 && props.run && props.run.damage > 0) {
      playerHp.value = Math.min(
        props.run.playerHpMax,
        playerHp.value + presentationHealing * (damage / props.run.damage),
      );
    }
    if (direct) {
      directPlayerHits++;
      const skill =
        directPlayerHits % 5 === 0 && skills.value.length > 0
          ? skills.value[(Math.floor(directPlayerHits / 5) - 1) % skills.value.length]
          : null;
      heroAction.value = skill
        ? skill.characterAction
        : basicBattleAction(props.classId, directPlayerHits);
      heroSeq.value++;
      bossPose.value = 'hit';
      bossPoseSeq.value++;
      currentEffectUrl.value = skill
        ? `${import.meta.env.BASE_URL}${skill.effectAsset}`
        : basicEffectUrl.value;
      currentEffectSeq.value++;
      impactSide.value = 'boss';
      const now = performance.now();
      poseResetAt = now + 520;
      effectResetAt = now + 680;
      impactResetAt = now + (crit ? 280 : 180);
    }
  } else {
    playerHp.value = Math.max(0, playerHp.value - damage);
    if (direct) {
      directMonsterHits++;
      bossPose.value = 'attack';
      bossPoseSeq.value++;
      heroAction.value = 'react';
      heroSeq.value++;
      impactSide.value = 'hero';
      if (directMonsterHits % 3 === 0) {
        signatureSeq.value++;
        signatureResetAt = performance.now() + 900;
      }
      const now = performance.now();
      poseResetAt = now + 620;
      impactResetAt = now + 220;
    }
  }

  if (!showFloat || props.reduceMotion) return;
  liveFloats.value.push({
    id: ++floatSeq,
    source: event.source,
    damage,
    crit,
    miss,
    element: event.event.element,
    offset: ((event.sequence * 37) % 42) - 21,
  });
  if (liveFloats.value.length > 7) liveFloats.value.shift();
}

function finishPlayback(skip: boolean): void {
  const run = props.run;
  if (!run || completedKey === props.playbackKey) return;
  cancelAnimationFrame(frameId);
  while (eventCursor < run.timeline.length) {
    processEvent(run.timeline[eventCursor], false);
    eventCursor++;
  }
  elapsedSec.value = run.durationSec;
  score.value = run.damage;
  bossHp.value = run.bossHpRemaining;
  playerHp.value = run.playerHpRemaining;
  heroAction.value = run.survived ? 'victory' : 'react';
  bossPose.value = 'idle';
  currentEffectUrl.value = '';
  liveFloats.value = [];
  impactSide.value = null;
  canSkip.value = false;
  running.value = false;
  completedKey = props.playbackKey;
  finishTimer = window.setTimeout(
    () => emit('complete', props.playbackKey),
    skip || props.reduceMotion ? 80 : 520,
  );
}
</script>

<template>
  <section
    class="trial-window"
    :class="[
      `element-${element}`,
      `motion-${visual.motion}`,
      { running, 'reduce-motion': reduceMotion },
    ]"
    :style="sceneStyle"
    :aria-label="`${playerName}挑战${boss.name}的周常试炼战斗窗口`"
  >
    <header class="window-chrome">
      <span class="live-dot" :class="{ active: running }" aria-hidden="true" />
      <span class="window-title"> <Swords :size="13" aria-hidden="true" />镜界实战 </span>
      <span class="window-state" aria-live="polite">{{ statusText }}</span>
      <button
        v-if="running && canSkip && !reduceMotion"
        class="skip-button"
        type="button"
        aria-label="跳过本次试炼演出"
        @click="finishPlayback(true)"
      >
        <FastForward :size="12" aria-hidden="true" />跳过
      </button>
    </header>

    <div class="phase-track" aria-hidden="true">
      <i :style="{ transform: `scaleX(${progressRatio})` }" />
      <span
        v-for="(item, index) in TRIAL_PHASES"
        :key="item.at"
        :class="{ reached: index <= phaseIndex && (running || hasPlayed) }"
      />
    </div>

    <div
      class="battle-stage"
      :class="{
        'impact-boss': impactSide === 'boss',
        'impact-hero': impactSide === 'hero',
      }"
    >
      <img class="scene-background" :src="sceneUrl" alt="" aria-hidden="true" />
      <span class="element-wash" aria-hidden="true" />
      <span class="mirror-ray ray-one" aria-hidden="true" />
      <span class="mirror-ray ray-two" aria-hidden="true" />
      <span class="scene-vignette" aria-hidden="true" />

      <div class="trial-clock">
        <Timer :size="12" aria-hidden="true" />
        <strong class="num">{{ remainingSec }}</strong>
        <small>秒</small>
      </div>

      <div class="phase-chip">
        <Sparkles :size="11" aria-hidden="true" />
        <span>第 {{ phaseIndex + 1 }} 阶段</span>
        <strong>{{ phase.label }}</strong>
      </div>

      <div class="boss-hud">
        <div class="boss-line">
          <span>BOSS</span>
          <strong>{{ boss.name }}</strong>
          <b>{{ elementLabel }}</b>
        </div>
        <div class="hp-copy">
          <span>试炼生命</span>
          <strong class="num">{{ abbr(Math.round(bossHp)) }} / {{ abbr(bossMaxHp) }}</strong>
        </div>
        <div
          class="hpbar boss-hpbar"
          role="meter"
          aria-label="试炼 Boss 生命"
          aria-valuemin="0"
          :aria-valuemax="bossMaxHp"
          :aria-valuenow="Math.max(0, Math.round(bossHp))"
        >
          <i class="hp-ghost" :style="{ transform: `scaleX(${bossHpRatio})` }" />
          <i class="hp-fill" :style="{ transform: `scaleX(${bossHpRatio})` }" />
          <i class="hp-shine" />
        </div>
      </div>

      <div class="hero-unit">
        <span class="unit-shadow" aria-hidden="true" />
        <CharacterAppearance
          :key="heroActorKey"
          :class-id="classId"
          :level="level"
          :equipped="equipped"
          variant="battle"
          :action="heroAction"
          :reduce-motion="reduceMotion"
        />
      </div>

      <div
        :key="bossActorKey"
        class="boss-unit"
        :class="[`pose-${bossPose}`, `motion-${visual.motion}`]"
      >
        <span class="unit-shadow" aria-hidden="true" />
        <img :src="bossUrl" :alt="boss.name" draggable="false" />
      </div>

      <Transition name="strike">
        <img
          v-if="currentEffectUrl"
          :key="currentEffectSeq"
          class="hero-strike"
          :src="currentEffectUrl"
          alt=""
          aria-hidden="true"
          draggable="false"
        />
      </Transition>

      <Transition name="callout">
        <span v-if="signatureSeq" :key="signatureSeq" class="signature-move">
          {{ visual.signatureMove }}
        </span>
      </Transition>

      <TransitionGroup name="float" tag="div" class="float-layer" aria-hidden="true">
        <span
          v-for="item in liveFloats"
          :key="item.id"
          class="damage-float num"
          :class="[
            item.source === 'player' ? 'to-boss' : 'to-hero',
            `damage-${item.element}`,
            { crit: item.crit, miss: item.miss },
          ]"
          :style="{ '--float-offset': `${item.offset}px` }"
        >
          <template v-if="item.miss">MISS</template>
          <template v-else
            >{{ item.crit ? '暴击 ' : '' }}-{{ abbr(Math.round(item.damage)) }}</template
          >
        </span>
      </TransitionGroup>

      <div class="hero-hud">
        <div class="hp-copy hero-copy">
          <strong>{{ playerName }}</strong>
          <span v-if="run" class="num">
            {{ abbr(Math.round(playerHp)) }} / {{ abbr(playerMaxHp) }}
          </span>
          <span v-else>待演算</span>
        </div>
        <div
          class="hpbar hero-hpbar"
          :class="{ low: playerHpRatio <= 0.25 }"
          role="meter"
          aria-label="挑战者生命"
          aria-valuemin="0"
          :aria-valuemax="playerMaxHp"
          :aria-valuenow="Math.max(0, Math.round(playerHp))"
          :aria-valuetext="run ? `${Math.round(playerHp)} / ${playerMaxHp}` : '等待挑战'"
        >
          <i class="hp-ghost" :style="{ transform: `scaleX(${playerHpRatio})` }" />
          <i class="hp-fill" :style="{ transform: `scaleX(${playerHpRatio})` }" />
          <i class="hp-shine" />
        </div>
      </div>
    </div>

    <footer class="battle-readout">
      <span>
        <Timer :size="12" aria-hidden="true" />
        <small>战斗时间</small>
        <strong class="num">{{ elapsedSec.toFixed(1) }}s</strong>
      </span>
      <span>
        <Swords :size="12" aria-hidden="true" />
        <small>累计伤害</small>
        <strong class="num">{{ abbr(Math.round(score)) }}</strong>
      </span>
      <span>
        <Shield :size="12" aria-hidden="true" />
        <small>挑战者生命</small>
        <strong class="num">{{ run ? `${Math.round(playerHpRatio * 100)}%` : '—' }}</strong>
      </span>
      <span>
        <Sparkles :size="12" aria-hidden="true" />
        <small>本周倾向</small>
        <strong>{{ boss.tilt.name }}</strong>
      </span>
    </footer>
  </section>
</template>

<style scoped>
.trial-window {
  --trial-accent: #69c9f4;
  --trial-glow: #c9f4ff;
  position: relative;
  overflow: hidden;
  background: rgb(255 255 255 / 82%);
  border: 1px solid rgb(255 255 255 / 94%);
  border-radius: 20px;
  box-shadow:
    0 14px 34px rgb(61 91 130 / 18%),
    inset 0 1px 0 rgb(255 255 255 / 82%);
  backdrop-filter: blur(10px) saturate(1.15);
  -webkit-backdrop-filter: blur(10px) saturate(1.15);
}

.trial-window.running {
  box-shadow:
    0 16px 38px rgb(61 91 130 / 20%),
    0 0 22px color-mix(in srgb, var(--trial-accent) 28%, transparent),
    inset 0 1px 0 rgb(255 255 255 / 88%);
}

.window-chrome {
  min-height: 39px;
  display: flex;
  align-items: center;
  gap: 7px;
  padding: 7px 11px 6px;
  color: var(--text);
}

.live-dot {
  width: 8px;
  height: 8px;
  flex: 0 0 auto;
  background: #b9c3ce;
  border-radius: 50%;
}

.live-dot.active {
  background: #57c28a;
  box-shadow: 0 0 0 0 rgb(87 194 138 / 48%);
  animation: live-pulse 1.7s ease-out infinite;
}

.window-title {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  font-size: 11px;
  font-weight: 850;
  letter-spacing: 0.06em;
}

.window-state {
  overflow: hidden;
  margin-left: auto;
  padding: 3px 8px;
  font-size: 9px;
  font-weight: 750;
  color: var(--text-mid);
  text-overflow: ellipsis;
  white-space: nowrap;
  background: #f1f6fb;
  border-radius: 999px;
}

.skip-button {
  min-height: 26px;
  display: inline-flex;
  align-items: center;
  gap: 3px;
  padding: 0 7px;
  flex: 0 0 auto;
  font-size: 9px;
  font-weight: 750;
  color: var(--blue-deep);
  background: var(--blue-soft);
  border: 1px solid rgb(89 178 232 / 18%);
  border-radius: 9px;
}

.phase-track {
  position: relative;
  height: 4px;
  margin: 0 11px 6px;
  overflow: visible;
  background: rgb(64 89 118 / 10%);
  border-radius: 999px;
}

.phase-track i {
  position: absolute;
  inset: 0;
  background: linear-gradient(90deg, var(--blue), var(--pink), var(--trial-accent));
  border-radius: inherit;
  box-shadow: 0 0 8px color-mix(in srgb, var(--trial-accent) 58%, transparent);
  transform-origin: left center;
  transition: transform 0.15s linear;
}

.phase-track span {
  position: absolute;
  top: 50%;
  width: 7px;
  height: 7px;
  background: #e1e8ef;
  border: 1px solid #fff;
  border-radius: 50%;
  box-shadow: 0 1px 3px rgb(44 66 91 / 20%);
  transform: translate(-50%, -50%);
}

.phase-track span:nth-of-type(1) {
  left: 0;
}
.phase-track span:nth-of-type(2) {
  left: 25%;
}
.phase-track span:nth-of-type(3) {
  left: 50%;
}
.phase-track span:nth-of-type(4) {
  left: 75%;
}

.phase-track span.reached {
  background: var(--trial-accent);
  box-shadow: 0 0 7px color-mix(in srgb, var(--trial-accent) 70%, transparent);
}

.battle-stage {
  isolation: isolate;
  position: relative;
  min-height: 226px;
  aspect-ratio: 3 / 2;
  overflow: hidden;
  margin: 0 7px;
  color: #fff;
  background: #bfd5e7;
  border: 1px solid rgb(255 255 255 / 92%);
  border-radius: 16px;
  box-shadow:
    inset 0 0 0 1px rgb(38 58 83 / 13%),
    0 8px 20px rgb(62 77 102 / 18%);
}

.scene-background,
.element-wash,
.scene-vignette {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
}

.scene-background {
  z-index: -5;
  object-fit: cover;
  object-position: center;
  transform: scale(1.015);
}

.running .scene-background {
  animation: scene-drift 20s ease-in-out infinite alternate;
}

.element-wash {
  z-index: -4;
  background:
    radial-gradient(
      circle at 77% 47%,
      color-mix(in srgb, var(--trial-accent) 24%, transparent),
      transparent 31%
    ),
    linear-gradient(180deg, rgb(27 47 75 / 24%), transparent 31%),
    linear-gradient(0deg, rgb(24 41 61 / 24%), transparent 36%);
  mix-blend-mode: multiply, normal, normal;
}

.scene-vignette {
  z-index: 20;
  pointer-events: none;
  border-radius: inherit;
  box-shadow:
    inset 0 -28px 38px rgb(20 34 52 / 26%),
    inset 0 0 28px rgb(27 46 67 / 14%);
}

.mirror-ray {
  position: absolute;
  z-index: -2;
  top: -35%;
  width: 16%;
  height: 150%;
  pointer-events: none;
  background: linear-gradient(90deg, transparent, rgb(255 255 255 / 16%), transparent);
  filter: blur(2px);
  transform: rotate(18deg);
}

.ray-one {
  left: 34%;
  animation: ray-sweep 6.8s ease-in-out infinite;
}

.ray-two {
  right: 12%;
  animation: ray-sweep 8.4s ease-in-out -3s infinite reverse;
}

.trial-clock,
.phase-chip,
.boss-hud,
.hero-hud {
  z-index: 25;
  position: absolute;
  text-shadow: 0 1px 4px rgb(18 30 45 / 88%);
  background: rgb(23 39 60 / 54%);
  border: 1px solid rgb(255 255 255 / 21%);
  box-shadow:
    inset 0 1px 0 rgb(255 255 255 / 12%),
    0 4px 12px rgb(22 34 49 / 18%);
  backdrop-filter: blur(8px) saturate(1.35);
  -webkit-backdrop-filter: blur(8px) saturate(1.35);
}

.trial-clock {
  top: 8px;
  left: 8px;
  min-width: 50px;
  display: grid;
  grid-template-columns: auto auto auto;
  align-items: baseline;
  justify-content: center;
  gap: 2px;
  padding: 5px 7px;
  border-radius: 11px;
}

.trial-clock svg {
  align-self: center;
  color: var(--trial-glow);
}

.trial-clock strong {
  font-size: 15px;
  line-height: 1;
}

.trial-clock small {
  font-size: 8px;
}

.phase-chip {
  top: 44px;
  left: 8px;
  display: grid;
  grid-template-columns: auto 1fr;
  gap: 0 4px;
  max-width: 106px;
  padding: 5px 7px;
  border-radius: 10px;
}

.phase-chip svg {
  grid-row: 1 / 3;
  align-self: center;
  color: var(--trial-glow);
}

.phase-chip span {
  font-size: 7px;
  color: rgb(255 255 255 / 72%);
}

.phase-chip strong {
  overflow: hidden;
  font-size: 9px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.boss-hud {
  top: 8px;
  right: 8px;
  width: min(64%, 226px);
  padding: 6px 8px 7px;
  border-radius: 12px;
}

.boss-line {
  display: flex;
  align-items: center;
  gap: 5px;
}

.boss-line > span {
  padding: 1px 5px;
  flex: 0 0 auto;
  font-size: 7px;
  font-weight: 900;
  letter-spacing: 0.08em;
  color: #fff;
  background: linear-gradient(135deg, #ff7b9f, #e94f76);
  border-radius: 5px;
}

.boss-line strong {
  overflow: hidden;
  min-width: 0;
  flex: 1;
  font-size: 10px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.boss-line b {
  width: 18px;
  height: 18px;
  display: grid;
  place-items: center;
  flex: 0 0 auto;
  font-size: 9px;
  color: #18314e;
  text-shadow: none;
  background: var(--trial-glow);
  border-radius: 50%;
}

.hp-copy {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 5px;
  margin-top: 4px;
  font-size: 7px;
  color: rgb(255 255 255 / 74%);
}

.hp-copy strong {
  overflow: hidden;
  font-size: 8px;
  color: #fff;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.hpbar {
  position: relative;
  height: 6px;
  overflow: hidden;
  margin-top: 3px;
  background: rgb(5 17 29 / 42%);
  border: 1px solid rgb(255 255 255 / 17%);
  border-radius: 999px;
}

.hpbar i {
  position: absolute;
  inset: 0;
  display: block;
  border-radius: inherit;
  transform-origin: left center;
}

.boss-hpbar .hp-ghost {
  background: rgb(255 196 214 / 40%);
  transition: transform 0.38s ease-out;
}

.boss-hpbar .hp-fill {
  background: linear-gradient(90deg, #ff7b9f, #ffb179);
  box-shadow: 0 0 7px rgb(255 123 159 / 58%);
  transition: transform 0.12s linear;
}

.hp-shine {
  background: linear-gradient(180deg, rgb(255 255 255 / 48%), transparent 52%);
  pointer-events: none;
}

.hero-unit,
.boss-unit {
  position: absolute;
  z-index: 8;
  bottom: -1%;
  transform-origin: 50% 100%;
}

.hero-unit {
  left: 6%;
  width: 45%;
  height: 76%;
}

.boss-unit {
  right: -1%;
  width: 55%;
  height: 75%;
  transform: scale(var(--boss-scale));
}

.hero-unit :deep(.character-appearance),
.boss-unit img {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
}

.boss-unit img {
  z-index: 2;
  object-fit: contain;
  object-position: center bottom;
  filter: drop-shadow(0 6px 5px rgb(20 34 50 / 34%))
    drop-shadow(0 0 7px color-mix(in srgb, var(--trial-accent) 24%, transparent));
  user-select: none;
}

.unit-shadow {
  position: absolute;
  z-index: 0;
  bottom: 5%;
  left: 16%;
  width: 70%;
  height: 12%;
  background: radial-gradient(ellipse, rgb(13 28 43 / 42%), transparent 70%);
  filter: blur(2px);
  transform: scaleX(1.25);
}

.boss-unit.pose-idle img {
  animation: boss-breathe 2.8s ease-in-out infinite;
}

.boss-unit.pose-hit img {
  animation: boss-hit 0.34s ease-out both;
}

.boss-unit.pose-attack.motion-weighty img {
  animation: boss-slam 0.62s cubic-bezier(0.18, 0.78, 0.28, 1) both;
}

.boss-unit.pose-attack.motion-elusive img {
  animation: boss-dash 0.56s cubic-bezier(0.18, 0.78, 0.28, 1) both;
}

.boss-unit.pose-attack.motion-fierce img {
  animation: boss-lunge 0.58s cubic-bezier(0.18, 0.78, 0.28, 1) both;
}

.hero-strike {
  position: absolute;
  z-index: 18;
  top: 24%;
  right: 9%;
  width: 46%;
  height: 56%;
  object-fit: contain;
  pointer-events: none;
  filter: drop-shadow(0 0 8px rgb(255 255 255 / 78%))
    drop-shadow(0 0 13px color-mix(in srgb, var(--trial-accent) 72%, transparent));
}

.signature-move {
  position: absolute;
  z-index: 30;
  top: 38%;
  right: 14%;
  padding: 5px 10px;
  font-size: 10px;
  font-weight: 900;
  letter-spacing: 0.08em;
  color: #fff;
  text-shadow: 0 1px 5px rgb(18 27 40 / 88%);
  background: linear-gradient(90deg, transparent, rgb(27 36 66 / 78%) 18% 82%, transparent);
}

.float-layer {
  position: absolute;
  z-index: 31;
  inset: 0;
  pointer-events: none;
}

.damage-float {
  position: absolute;
  font-size: 11px;
  font-weight: 900;
  color: #fff;
  text-shadow:
    0 1px 0 rgb(68 46 22 / 88%),
    0 0 6px rgb(255 220 127 / 72%);
  animation: damage-rise 0.92s ease-out both;
}

.damage-float.to-boss {
  top: 47%;
  right: calc(20% + var(--float-offset));
}

.damage-float.to-hero {
  top: 58%;
  left: calc(22% + var(--float-offset));
  color: #ffd4dc;
}

.damage-float.crit {
  font-size: 14px;
  color: #ffe576;
  text-shadow:
    0 1px 0 rgb(98 54 12 / 90%),
    0 0 8px rgb(255 222 90 / 88%);
}

.damage-float.miss {
  font-size: 10px;
  letter-spacing: 0.08em;
  color: #d8f1ff;
  text-shadow: 0 1px 4px rgb(16 42 70 / 88%);
}

.damage-fire {
  color: #ffd0a5;
}
.damage-ice {
  color: #d7f6ff;
}
.damage-thunder {
  color: #ead9ff;
}

.hero-hud {
  bottom: 7px;
  left: 7px;
  width: 43%;
  padding: 5px 7px 6px;
  border-radius: 10px;
}

.hero-copy {
  margin-top: 0;
}

.hero-copy strong {
  max-width: 52%;
}

.hero-copy span {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.hero-hpbar .hp-ghost {
  background: rgb(133 224 195 / 34%);
  transition: transform 0.36s ease-out;
}

.hero-hpbar .hp-fill {
  background: linear-gradient(90deg, #57c28a, #8ce4c3);
  box-shadow: 0 0 6px rgb(87 194 138 / 50%);
  transition: transform 0.12s linear;
}

.hero-hpbar.low .hp-fill {
  background: linear-gradient(90deg, #ff6f83, #ffad9a);
  animation: low-hp 0.95s ease-in-out infinite;
}

.impact-boss {
  animation: impact-boss 0.22s ease-out;
}

.impact-hero {
  animation: impact-hero 0.22s ease-out;
}

.impact-boss::after,
.impact-hero::after {
  position: absolute;
  z-index: 24;
  inset: 0;
  content: '';
  pointer-events: none;
  border-radius: inherit;
}

.impact-boss::after {
  background: radial-gradient(circle at 76% 55%, rgb(255 255 255 / 28%), transparent 24%);
}

.impact-hero::after {
  background: radial-gradient(circle at 26% 60%, rgb(255 112 137 / 24%), transparent 24%);
}

.battle-readout {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  padding: 7px 7px 9px;
}

.battle-readout > span {
  min-width: 0;
  display: grid;
  grid-template-columns: auto 1fr;
  align-items: center;
  gap: 0 4px;
  padding: 0 6px;
  color: var(--text-mid);
}

.battle-readout > span + span {
  border-left: 1px solid var(--hairline);
}

.battle-readout svg {
  grid-row: 1 / 3;
  color: var(--trial-accent);
}

.battle-readout small {
  overflow: hidden;
  font-size: 7px;
  color: var(--text-dim);
  text-overflow: ellipsis;
  white-space: nowrap;
}

.battle-readout strong {
  overflow: hidden;
  font-size: 9px;
  color: var(--text);
  text-overflow: ellipsis;
  white-space: nowrap;
}

.strike-enter-active,
.strike-leave-active {
  transition:
    opacity 0.18s ease,
    transform 0.24s ease;
}

.strike-enter-from {
  opacity: 0;
  transform: translate3d(-20%, 8%, 0) scale(0.65) rotate(-14deg);
}

.strike-leave-to {
  opacity: 0;
  transform: translate3d(10%, -5%, 0) scale(1.16);
}

.callout-enter-active,
.callout-leave-active {
  transition:
    opacity 0.22s ease,
    transform 0.32s ease;
}

.callout-enter-from,
.callout-leave-to {
  opacity: 0;
  transform: translateX(16px);
}

.float-leave-active {
  transition: opacity 0.16s ease;
}

.float-leave-to {
  opacity: 0;
}

@keyframes live-pulse {
  70% {
    box-shadow: 0 0 0 7px rgb(87 194 138 / 0%);
  }
  100% {
    box-shadow: 0 0 0 0 rgb(87 194 138 / 0%);
  }
}

@keyframes scene-drift {
  from {
    transform: scale(1.015) translate3d(-0.4%, 0, 0);
  }
  to {
    transform: scale(1.035) translate3d(0.6%, -0.3%, 0);
  }
}

@keyframes ray-sweep {
  0%,
  100% {
    opacity: 0.2;
    transform: translateX(-20%) rotate(18deg);
  }
  50% {
    opacity: 0.75;
    transform: translateX(48%) rotate(18deg);
  }
}

@keyframes boss-breathe {
  0%,
  100% {
    transform: translateY(0) scale(1);
  }
  50% {
    transform: translateY(-2px) scale(1.01);
  }
}

@keyframes boss-hit {
  0% {
    transform: translateX(0) rotate(0);
    filter: brightness(1.75) saturate(0.55);
  }
  36% {
    transform: translateX(9px) rotate(1deg);
    filter: brightness(1.42);
  }
  100% {
    transform: translateX(0) rotate(0);
    filter: brightness(1);
  }
}

@keyframes boss-slam {
  0% {
    transform: translate(0, 0) scale(1);
  }
  36% {
    transform: translate(-7px, -5px) scale(1.04);
  }
  66% {
    transform: translate(-22px, 4px) scale(1.07);
  }
  100% {
    transform: translate(0, 0) scale(1);
  }
}

@keyframes boss-dash {
  0% {
    opacity: 1;
    transform: translateX(0) skewX(0);
  }
  38% {
    opacity: 0.48;
    transform: translateX(18px) skewX(-5deg);
  }
  62% {
    opacity: 1;
    transform: translateX(-32px) skewX(4deg);
  }
  100% {
    transform: translateX(0) skewX(0);
  }
}

@keyframes boss-lunge {
  0% {
    transform: translateX(0) scale(1);
  }
  38% {
    transform: translate(7px, -3px) scale(0.98);
  }
  64% {
    transform: translateX(-28px) scale(1.08);
  }
  100% {
    transform: translateX(0) scale(1);
  }
}

@keyframes damage-rise {
  0% {
    opacity: 0;
    transform: translateY(6px) scale(0.72);
  }
  18% {
    opacity: 1;
    transform: translateY(0) scale(1.08);
  }
  100% {
    opacity: 0;
    transform: translateY(-36px) scale(0.94);
  }
}

@keyframes impact-boss {
  0%,
  100% {
    transform: translateX(0);
  }
  40% {
    transform: translateX(-2px);
  }
  70% {
    transform: translateX(1px);
  }
}

@keyframes impact-hero {
  0%,
  100% {
    transform: translateX(0);
  }
  40% {
    transform: translateX(2px);
  }
  70% {
    transform: translateX(-1px);
  }
}

@keyframes low-hp {
  50% {
    filter: brightness(1.25);
  }
}

@media (max-height: 740px) {
  .battle-stage {
    min-height: 188px;
    aspect-ratio: 16 / 9.6;
  }

  .hero-unit,
  .boss-unit {
    height: 72%;
  }

  .battle-readout {
    padding-bottom: 7px;
  }
}

@media (max-width: 350px) {
  .window-chrome {
    padding-inline: 9px;
  }

  .window-state {
    max-width: 88px;
  }

  .battle-stage {
    min-height: 174px;
    margin-inline: 5px;
  }

  .boss-hud {
    width: 63%;
  }

  .phase-chip {
    max-width: 91px;
  }

  .battle-readout > span {
    padding-inline: 4px;
  }
}

.reduce-motion * {
  scroll-behavior: auto !important;
  animation-duration: 0.001ms !important;
  animation-iteration-count: 1 !important;
  transition-duration: 0.001ms !important;
}

@media (prefers-reduced-motion: reduce) {
  .trial-window *,
  .trial-window *::before,
  .trial-window *::after {
    scroll-behavior: auto !important;
    animation-duration: 0.001ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.001ms !important;
  }
}
</style>
