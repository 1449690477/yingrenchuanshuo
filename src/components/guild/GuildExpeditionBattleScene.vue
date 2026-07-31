<script setup lang="ts">
import { computed, onUnmounted, ref, watch } from 'vue';
import { FastForward, Shield, Sparkles, Swords, Timer } from '@lucide/vue';
import type { ClassId, Element } from '@/core/types';
import { abbr } from '@/core/format';
import type { GuildExpeditionResult, GuildExpeditionState } from '@/net/guild';
import {
  BASIC_ATTACK_EFFECTS,
  resolveCharacterAppearance,
  type CharacterAction,
  type EquippedRecord,
} from '@/data/characterAppearance';
import { basicBattleAction } from '@/data/battleMotions';
import { requireGuildExpeditionVisual } from '@/data/guildVisuals';
import CharacterAppearance from '@/components/CharacterAppearance.vue';

const props = withDefaults(
  defineProps<{
    boss: GuildExpeditionState['boss'];
    result: GuildExpeditionResult | null;
    classId: ClassId;
    level: number;
    equipped: EquippedRecord | null;
    playerName: string;
    playerMaxHp: number;
    playbackKey: number;
    loading?: boolean;
    reduceMotion?: boolean;
  }>(),
  {
    loading: false,
    reduceMotion: false,
  },
);

type BeatSource = 'hero' | 'boss';

interface PresentationBeat {
  source: BeatSource;
  damage: number;
  crit: boolean;
  signature: boolean;
}

interface BattleFloater {
  id: number;
  side: BeatSource;
  damage: number;
  crit: boolean;
}

const HERO_WEIGHTS = [7, 8, 6, 10, 8, 12, 7, 9, 14, 19] as const;
const BOSS_WEIGHTS = [18, 21, 16, 24, 21] as const;
const BEAT_ORDER: BeatSource[] = [
  'hero',
  'boss',
  'hero',
  'hero',
  'boss',
  'hero',
  'boss',
  'hero',
  'hero',
  'boss',
  'hero',
  'hero',
  'boss',
  'hero',
  'hero',
];

const visual = computed(() =>
  requireGuildExpeditionVisual(props.boss.tiltId, props.boss.element as Element),
);
const sceneStyle = computed(() => ({
  backgroundImage: `url('${import.meta.env.BASE_URL}${visual.value.sceneAsset}')`,
  '--boss-accent': visual.value.accent,
  '--boss-glow': visual.value.glow,
}));
const bossUrl = computed(() => `${import.meta.env.BASE_URL}${visual.value.bossAsset}`);
const basicEffectUrl = computed(() => {
  const appearance = resolveCharacterAppearance(props.classId, props.level, props.equipped);
  return `${import.meta.env.BASE_URL}${
    appearance.boutiqueEffectAsset ?? BASIC_ATTACK_EFFECTS[props.classId]
  }`;
});

const playing = ref(false);
const completed = ref(false);
const playedBeats = ref(0);
const damageShown = ref(0);
const damageTakenShown = ref(0);
const heroAction = ref<CharacterAction>('idle');
const bossPose = ref<'idle' | 'attack' | 'hit'>('idle');
const currentSource = ref<BeatSource | null>(null);
const actionKey = ref(0);
const floaters = ref<BattleFloater[]>([]);
let timer = 0;
let floaterSeq = 0;

const beats = computed(() => createPresentationBeats(props.result));
const playbackPct = computed(() =>
  beats.value.length > 0 ? Math.round((playedBeats.value / beats.value.length) * 100) : 0,
);
const playerHp = computed(() =>
  Math.max(0, Math.round(Math.max(1, props.playerMaxHp) - damageTakenShown.value)),
);
const playerHpPct = computed(() =>
  Math.max(0, Math.min(100, (playerHp.value / Math.max(1, props.playerMaxHp)) * 100)),
);
const statusText = computed(() => {
  if (props.loading) return '服务端复算中';
  if (playing.value) return '60 秒战报压缩回放';
  if (!props.result) return '等待发起远征';
  return props.result.survived ? '远征完成 · 成功生还' : '远征结束 · 挑战者倒下';
});
const elementLabel = computed(() => ({ fire: '炎', ice: '冰', thunder: '雷' })[props.boss.element]);

function splitExact(total: number, weights: readonly number[]): number[] {
  const safe = Math.max(0, Math.round(total));
  let used = 0;
  return weights.map((weight, index) => {
    if (index === weights.length - 1) return safe - used;
    const part = Math.round((safe * weight) / 100);
    used += part;
    return part;
  });
}

function createPresentationBeats(result: GuildExpeditionResult | null): PresentationBeat[] {
  if (!result) return [];
  const heroHits = splitExact(result.damage, HERO_WEIGHTS);
  const bossHits = splitExact(result.damageTaken, BOSS_WEIGHTS);
  let heroIndex = 0;
  let bossIndex = 0;
  return BEAT_ORDER.map((source) => {
    if (source === 'hero') {
      const index = heroIndex++;
      return {
        source,
        damage: heroHits[index] ?? 0,
        crit: index === 5 || index === 9,
        signature: index === 9,
      };
    }
    const index = bossIndex++;
    return {
      source,
      damage: bossHits[index] ?? 0,
      crit: index === 3,
      signature: index === 3,
    };
  });
}

function stop(): void {
  window.clearTimeout(timer);
}

function showFloater(beat: PresentationBeat): void {
  if (beat.damage <= 0) return;
  const item: BattleFloater = {
    id: ++floaterSeq,
    side: beat.source === 'hero' ? 'boss' : 'hero',
    damage: beat.damage,
    crit: beat.crit,
  };
  floaters.value.push(item);
  window.setTimeout(
    () => {
      floaters.value = floaters.value.filter((floater) => floater.id !== item.id);
    },
    props.reduceMotion ? 90 : 780,
  );
}

function playBeat(index: number): void {
  const beat = beats.value[index];
  if (!beat) {
    playing.value = false;
    completed.value = true;
    currentSource.value = null;
    heroAction.value = props.result?.survived ? 'idle' : 'react';
    bossPose.value = 'idle';
    return;
  }

  playedBeats.value = index + 1;
  currentSource.value = beat.source;
  actionKey.value++;
  if (beat.source === 'hero') {
    damageShown.value += beat.damage;
    heroAction.value = beat.signature ? 'cast' : basicBattleAction(props.classId, index + 1);
    bossPose.value = 'hit';
  } else {
    damageTakenShown.value += beat.damage;
    heroAction.value = 'react';
    bossPose.value = 'attack';
  }
  showFloater(beat);
  timer = window.setTimeout(
    () => playBeat(index + 1),
    props.reduceMotion ? 70 : beat.crit ? 520 : 390,
  );
}

function startPlayback(): void {
  stop();
  playedBeats.value = 0;
  damageShown.value = 0;
  damageTakenShown.value = 0;
  floaters.value = [];
  completed.value = false;
  heroAction.value = 'idle';
  bossPose.value = 'idle';
  currentSource.value = null;
  if (!props.result) {
    playing.value = false;
    return;
  }
  playing.value = true;
  timer = window.setTimeout(() => playBeat(0), props.reduceMotion ? 30 : 260);
}

function skip(): void {
  stop();
  damageShown.value = props.result?.damage ?? 0;
  damageTakenShown.value = props.result?.damageTaken ?? 0;
  playedBeats.value = beats.value.length;
  floaters.value = [];
  playing.value = false;
  completed.value = true;
  currentSource.value = null;
  heroAction.value = props.result?.survived ? 'idle' : 'react';
  bossPose.value = 'idle';
}

watch(() => props.playbackKey, startPlayback, { immediate: true });
onUnmounted(stop);
</script>

<template>
  <section
    class="guild-battle"
    :class="[
      `element-${boss.element}`,
      { playing, completed, loading, 'reduce-motion': reduceMotion },
    ]"
    :aria-label="`${playerName}挑战${boss.name}的公会团本战斗窗口`"
  >
    <header class="battle-heading">
      <span><Swords :size="14" aria-hidden="true" />团本实战</span>
      <small>{{ statusText }}</small>
      <button v-if="playing" type="button" @click="skip">
        <FastForward :size="13" aria-hidden="true" />跳过
      </button>
    </header>

    <div class="battle-stage" :style="sceneStyle">
      <span class="scene-shade" aria-hidden="true" />
      <span class="arena-line" aria-hidden="true" />
      <i v-for="n in 7" :key="n" class="mote" :class="`mote-${n}`" aria-hidden="true" />

      <div class="boss-hud">
        <span class="boss-chip">BOSS</span>
        <strong>{{ boss.name }}</strong>
        <em>{{ elementLabel }} · {{ boss.tiltName }}</em>
        <div
          class="replay-track"
          role="progressbar"
          aria-label="战报回放进度"
          :aria-valuenow="playbackPct"
          aria-valuemin="0"
          aria-valuemax="100"
        >
          <i :style="{ width: `${playbackPct}%` }" />
        </div>
      </div>

      <div class="hero-unit" :class="{ struck: currentSource === 'boss' }">
        <span class="unit-shadow" aria-hidden="true" />
        <CharacterAppearance
          :class-id="classId"
          :level="level"
          :equipped="equipped"
          variant="battle"
          :action="heroAction"
          :reduce-motion="reduceMotion"
        />
        <div class="hero-hud">
          <strong>{{ playerName }}</strong>
          <small>{{ abbr(playerHp) }} / {{ abbr(Math.max(1, playerMaxHp)) }}</small>
          <div class="hero-hp"><i :style="{ width: `${playerHpPct}%` }" /></div>
        </div>
      </div>

      <div
        :key="`boss-${actionKey}`"
        class="boss-unit"
        :class="[`pose-${bossPose}`, `motion-${visual.motion}`]"
        :style="{ '--boss-scale': visual.bossScale }"
      >
        <span class="unit-shadow" aria-hidden="true" />
        <span class="boss-aura" aria-hidden="true" />
        <img :src="bossUrl" :alt="`${boss.name}首领形象`" draggable="false" />
      </div>

      <img
        v-if="currentSource === 'hero'"
        :key="`effect-${actionKey}`"
        class="hero-effect"
        :src="basicEffectUrl"
        alt=""
        aria-hidden="true"
      />
      <span
        v-if="currentSource === 'boss'"
        :key="`boss-effect-${actionKey}`"
        class="boss-effect"
        aria-hidden="true"
      />

      <span
        v-for="floater in floaters"
        :key="floater.id"
        class="damage-float num"
        :class="[`side-${floater.side}`, { crit: floater.crit }]"
        aria-hidden="true"
      >
        -{{ abbr(floater.damage) }}{{ floater.crit ? '!' : '' }}
      </span>

      <div v-if="loading" class="loading-curtain" role="status">
        <Sparkles :size="18" aria-hidden="true" />
        <strong>正在取得权威战报</strong>
        <small>服务器只结算一次，画面随后按真实总伤害回放</small>
      </div>
      <div v-else-if="!result" class="idle-callout">
        <Shield :size="14" aria-hidden="true" />
        首领已在远征场等候
      </div>
      <div v-else-if="completed" class="finish-callout" :class="{ fallen: !result.survived }">
        <strong>{{ result.survived ? '远征归来' : '虽败仍有贡献' }}</strong>
        <small>本次伤害 {{ abbr(result.damage) }}</small>
      </div>
    </div>

    <footer class="battle-readout">
      <span
        ><Timer :size="13" /><small>战斗时间</small
        ><strong>{{ result?.durationSec ?? 60 }}s</strong></span
      >
      <span
        ><Swords :size="13" /><small>累计伤害</small><strong>{{ abbr(damageShown) }}</strong></span
      >
      <span
        ><Shield :size="13" /><small>承受伤害</small
        ><strong>{{ abbr(damageTakenShown) }}</strong></span
      >
      <span
        ><Sparkles :size="13" /><small>本次贡献</small
        ><strong>{{ result ? `+${result.improvedBy}` : '—' }}</strong></span
      >
    </footer>
  </section>
</template>

<style scoped>
.guild-battle {
  overflow: hidden;
  margin: 12px -4px 0;
  color: #e9f6ff;
  background: rgb(18 34 60 / 68%);
  border: 1px solid rgb(218 241 255 / 26%);
  border-radius: 16px;
  box-shadow: inset 0 1px 0 rgb(255 255 255 / 18%);
}

.battle-heading {
  min-height: 38px;
  display: flex;
  align-items: center;
  gap: 7px;
  padding: 7px 9px;
  background: linear-gradient(90deg, rgb(21 43 76 / 88%), rgb(92 71 116 / 72%));
}

.battle-heading > span,
.battle-heading button {
  display: inline-flex;
  align-items: center;
  gap: 5px;
}

.battle-heading > span {
  font-size: 11px;
  font-weight: 800;
  letter-spacing: 0.05em;
}

.battle-heading small {
  min-width: 0;
  margin-right: auto;
  overflow: hidden;
  color: rgb(233 246 255 / 68%);
  font-size: 9px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.battle-heading button {
  min-height: 30px;
  padding: 0 9px;
  color: #fff;
  font-size: 10px;
  font-weight: 800;
  background: rgb(255 255 255 / 12%);
  border: 1px solid rgb(255 255 255 / 20%);
  border-radius: 999px;
}

.battle-stage {
  position: relative;
  isolation: isolate;
  aspect-ratio: 3 / 2;
  overflow: hidden;
  background-position: center;
  background-size: cover;
}

.scene-shade {
  position: absolute;
  z-index: -1;
  inset: 0;
  background:
    linear-gradient(180deg, rgb(10 26 54 / 18%) 0 38%, rgb(8 23 47 / 8%) 60%, rgb(4 14 31 / 38%)),
    radial-gradient(
      circle at 75% 62%,
      color-mix(in srgb, var(--boss-glow) 32%, transparent),
      transparent 27%
    );
}

.arena-line {
  position: absolute;
  z-index: 0;
  left: 12%;
  right: 12%;
  bottom: 15%;
  height: 20%;
  border: 1px solid rgb(186 232 255 / 24%);
  border-radius: 50%;
  box-shadow: 0 0 22px color-mix(in srgb, var(--boss-accent) 32%, transparent);
}

.boss-hud {
  position: absolute;
  z-index: 5;
  top: 8px;
  right: 8px;
  width: 58%;
  min-width: 0;
  padding: 7px 8px 6px;
  display: grid;
  grid-template-columns: auto 1fr auto;
  align-items: center;
  gap: 3px 5px;
  text-align: left;
  background: rgb(14 29 57 / 78%);
  border: 1px solid rgb(255 255 255 / 20%);
  border-radius: 10px;
  backdrop-filter: blur(5px);
}

.boss-chip {
  padding: 2px 5px;
  color: #fff;
  font-size: 7px;
  font-weight: 900;
  background: var(--boss-accent);
  border-radius: 4px;
}

.boss-hud strong {
  min-width: 0;
  overflow: hidden;
  font-size: 10px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.boss-hud em {
  color: var(--boss-glow);
  font-size: 8px;
  font-style: normal;
  font-weight: 800;
}

.replay-track {
  grid-column: 1 / -1;
  height: 5px;
  overflow: hidden;
  background: rgb(255 255 255 / 16%);
  border-radius: 99px;
}

.replay-track i {
  display: block;
  width: 0;
  height: 100%;
  background: linear-gradient(90deg, #7cd6f1, var(--boss-accent));
  border-radius: inherit;
  transition: width 220ms ease-out;
}

.hero-unit,
.boss-unit {
  position: absolute;
  z-index: 2;
  bottom: 13%;
  transform-origin: 50% 100%;
}

.hero-unit {
  left: 4%;
  width: 42%;
  height: 76%;
}

.hero-unit :deep(.character-appearance) {
  width: 100%;
  height: 100%;
}

.hero-unit.struck {
  animation: hero-struck 360ms ease-out;
}

.boss-unit {
  right: 3%;
  width: 50%;
  height: 68%;
  display: grid;
  place-items: end center;
  transform: scale(var(--boss-scale));
}

.boss-unit img {
  position: relative;
  z-index: 2;
  width: 100%;
  height: 100%;
  object-fit: contain;
  object-position: center bottom;
  filter: drop-shadow(0 8px 8px rgb(8 19 43 / 50%));
}

.boss-unit.pose-hit {
  animation: boss-hit 390ms ease-out;
}

.boss-unit.pose-attack.motion-weighty {
  animation: boss-charge-heavy 520ms ease-out;
}

.boss-unit.pose-attack.motion-elusive {
  animation: boss-charge-fast 390ms ease-out;
}

.boss-unit.pose-attack.motion-fierce {
  animation: boss-charge-fierce 440ms ease-out;
}

.unit-shadow {
  position: absolute;
  z-index: 0;
  left: 17%;
  right: 17%;
  bottom: -2%;
  height: 10%;
  background: rgb(5 17 38 / 38%);
  filter: blur(4px);
  border-radius: 50%;
}

.boss-aura {
  position: absolute;
  z-index: 1;
  inset: 20% 8% 4%;
  background: radial-gradient(
    circle,
    color-mix(in srgb, var(--boss-glow) 46%, transparent),
    transparent 66%
  );
  filter: blur(3px);
  animation: aura-pulse 2.2s ease-in-out infinite;
}

.hero-hud {
  position: absolute;
  z-index: 5;
  left: 2%;
  right: -8%;
  bottom: -3%;
  padding: 5px 7px;
  display: grid;
  grid-template-columns: 1fr auto;
  gap: 3px 5px;
  background: rgb(11 29 53 / 76%);
  border: 1px solid rgb(255 255 255 / 18%);
  border-radius: 8px;
  backdrop-filter: blur(4px);
}

.hero-hud strong,
.hero-hud small {
  overflow: hidden;
  font-size: 8px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.hero-hud small {
  color: rgb(255 255 255 / 72%);
}

.hero-hp {
  grid-column: 1 / -1;
  height: 4px;
  overflow: hidden;
  background: rgb(255 255 255 / 16%);
  border-radius: 99px;
}

.hero-hp i {
  display: block;
  height: 100%;
  background: linear-gradient(90deg, #62d3a8, #c5f19b);
  border-radius: inherit;
  transition: width 220ms ease-out;
}

.hero-effect,
.boss-effect {
  position: absolute;
  z-index: 4;
  pointer-events: none;
}

.hero-effect {
  right: 19%;
  bottom: 24%;
  width: 29%;
  aspect-ratio: 1;
  object-fit: contain;
  animation: hero-impact 460ms ease-out forwards;
}

.boss-effect {
  left: 17%;
  bottom: 30%;
  width: 28%;
  aspect-ratio: 1;
  background:
    radial-gradient(circle, #fff 0 5%, transparent 7%),
    conic-gradient(
      from 15deg,
      transparent,
      var(--boss-accent),
      transparent 22%,
      var(--boss-glow),
      transparent 48%
    );
  border-radius: 50%;
  filter: drop-shadow(0 0 10px var(--boss-accent));
  animation: boss-impact 440ms ease-out forwards;
}

.damage-float {
  position: absolute;
  z-index: 8;
  top: 38%;
  color: #fff;
  font-size: 12px;
  font-weight: 900;
  text-shadow: 0 2px 5px rgb(8 22 48 / 74%);
  animation: damage-rise 760ms ease-out forwards;
}

.damage-float.side-hero {
  left: 24%;
}

.damage-float.side-boss {
  right: 24%;
  color: #ffe6a8;
}

.damage-float.crit {
  font-size: 17px;
  color: #fff1a8;
  filter: drop-shadow(0 0 6px #ffcb63);
}

.mote {
  position: absolute;
  z-index: 1;
  width: 4px;
  height: 7px;
  background: linear-gradient(145deg, #fff, #ffb9da);
  border-radius: 70% 15% 70% 15%;
  opacity: 0;
  animation: mote-drift 5s linear infinite;
}
.mote-1 {
  left: 10%;
  top: 24%;
  animation-delay: -1s;
}
.mote-2 {
  left: 30%;
  top: 16%;
  animation-delay: -3.1s;
}
.mote-3 {
  left: 51%;
  top: 27%;
  animation-delay: -2.2s;
}
.mote-4 {
  left: 72%;
  top: 13%;
  animation-delay: -4.3s;
}
.mote-5 {
  left: 84%;
  top: 33%;
  animation-delay: -0.5s;
}
.mote-6 {
  left: 43%;
  top: 7%;
  animation-delay: -3.8s;
}
.mote-7 {
  left: 93%;
  top: 21%;
  animation-delay: -2.7s;
}

.loading-curtain,
.idle-callout,
.finish-callout {
  position: absolute;
  z-index: 12;
  left: 50%;
  transform: translateX(-50%);
  color: #fff;
  background: rgb(12 31 58 / 76%);
  border: 1px solid rgb(255 255 255 / 24%);
  backdrop-filter: blur(6px);
}

.loading-curtain {
  inset: 0;
  display: grid;
  place-content: center;
  justify-items: center;
  gap: 5px;
  transform: none;
  text-align: center;
  background: rgb(11 27 51 / 68%);
}

.loading-curtain svg {
  animation: loading-spin 1.2s linear infinite;
}

.loading-curtain strong {
  font-size: 12px;
}

.loading-curtain small {
  max-width: 220px;
  color: rgb(255 255 255 / 72%);
  font-size: 9px;
}

.idle-callout {
  bottom: 10px;
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 5px 9px;
  font-size: 9px;
  font-weight: 800;
  border-radius: 999px;
}

.finish-callout {
  top: 50%;
  min-width: 150px;
  padding: 8px 14px;
  display: grid;
  gap: 2px;
  text-align: center;
  border-color: color-mix(in srgb, var(--boss-accent) 58%, white);
  border-radius: 11px;
  box-shadow: 0 0 22px color-mix(in srgb, var(--boss-glow) 30%, transparent);
  animation: result-in 440ms var(--ease-out-back);
}

.finish-callout.fallen {
  border-color: rgb(194 218 236 / 44%);
}

.finish-callout strong {
  color: #fff1bd;
  font-size: 13px;
}

.finish-callout small {
  color: rgb(255 255 255 / 78%);
  font-size: 9px;
}

.battle-readout {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 1px;
  padding: 1px;
  background: rgb(255 255 255 / 8%);
}

.battle-readout span {
  min-width: 0;
  min-height: 44px;
  padding: 5px 3px;
  display: grid;
  grid-template-columns: auto 1fr;
  align-content: center;
  gap: 1px 3px;
  background: rgb(17 38 68 / 78%);
}

.battle-readout svg {
  grid-row: 1 / 3;
  align-self: center;
  color: #91dcf1;
}

.battle-readout small {
  overflow: hidden;
  color: rgb(233 246 255 / 56%);
  font-size: 7px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.battle-readout strong {
  overflow: hidden;
  color: #fff;
  font-size: 9px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

@keyframes hero-impact {
  from {
    opacity: 0;
    transform: translate(-28px, 10px) scale(0.55) rotate(-18deg);
  }
  38% {
    opacity: 1;
    transform: translate(0) scale(1.18);
  }
  to {
    opacity: 0;
    transform: translate(17px, -8px) scale(1.34) rotate(12deg);
  }
}
@keyframes boss-impact {
  from {
    opacity: 0;
    transform: translate(24px, -8px) scale(0.45) rotate(-35deg);
  }
  42% {
    opacity: 1;
    transform: translate(0) scale(1.12) rotate(10deg);
  }
  to {
    opacity: 0;
    transform: translate(-18px, 5px) scale(1.35) rotate(50deg);
  }
}
@keyframes hero-struck {
  34% {
    transform: translateX(-6px) rotate(-1deg);
    filter: brightness(1.6);
  }
}
@keyframes boss-hit {
  30% {
    transform: translateX(7px) scale(var(--boss-scale));
    filter: brightness(1.8);
  }
}
@keyframes boss-charge-heavy {
  45% {
    transform: translateX(-12px) scale(calc(var(--boss-scale) * 1.06));
  }
}
@keyframes boss-charge-fast {
  45% {
    transform: translateX(-19px) scale(calc(var(--boss-scale) * 1.02));
    filter: blur(0.4px);
  }
}
@keyframes boss-charge-fierce {
  42% {
    transform: translate(-16px, -3px) scale(calc(var(--boss-scale) * 1.08)) rotate(-1deg);
  }
}
@keyframes aura-pulse {
  50% {
    opacity: 0.64;
    transform: scale(1.12);
  }
}
@keyframes damage-rise {
  from {
    opacity: 0;
    transform: translateY(10px) scale(0.68);
  }
  24% {
    opacity: 1;
    transform: translateY(0) scale(1.08);
  }
  to {
    opacity: 0;
    transform: translateY(-28px) scale(0.95);
  }
}
@keyframes mote-drift {
  0% {
    opacity: 0;
    transform: translate(0, 12px) rotate(0);
  }
  18% {
    opacity: 0.8;
  }
  100% {
    opacity: 0;
    transform: translate(-24px, 52px) rotate(210deg);
  }
}
@keyframes result-in {
  from {
    opacity: 0;
    transform: translate(-50%, 12px) scale(0.82);
  }
  to {
    opacity: 1;
    transform: translate(-50%, 0) scale(1);
  }
}
@keyframes loading-spin {
  to {
    transform: rotate(360deg);
  }
}

@media (max-width: 340px) {
  .guild-battle {
    margin-inline: -6px;
  }
  .boss-hud {
    width: 62%;
  }
  .battle-readout small {
    font-size: 6.5px;
  }
}

.reduce-motion *,
.reduce-motion *::before,
.reduce-motion *::after {
  animation-duration: 1ms !important;
  animation-iteration-count: 1 !important;
  transition-duration: 1ms !important;
}

@media (prefers-reduced-motion: reduce) {
  .guild-battle *,
  .guild-battle *::before,
  .guild-battle *::after {
    animation-duration: 1ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 1ms !important;
  }
}
</style>
