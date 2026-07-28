<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue';
import { ShieldCheck, Sparkles, Swords, X } from '@lucide/vue';
import type { ClassId } from '@/core/types';
import type { EquippedRecord } from '@/data/characterAppearance';
import type { EquipmentDungeonRunResult } from '@/stores/game';
import CharacterAppearance from './CharacterAppearance.vue';
import EquipmentDungeonReward from './EquipmentDungeonReward.vue';

type PlayedResult = Extract<EquipmentDungeonRunResult, { ok: true }>;
type Phase = 'intro' | 'clash' | 'result';

const props = defineProps<{
  result: PlayedResult;
  classId: ClassId;
  level: number;
  equipped: EquippedRecord;
  playerMaxHp: number;
  reduceMotion: boolean;
}>();

const emit = defineEmits<{ close: [] }>();

const phase = ref<Phase>('intro');
const waveIndex = ref(0);
const playerHpPercent = ref(100);
const monsterHpPercent = ref(100);
const displayedPlayerHp = ref(props.playerMaxHp);
const displayedMonsterHp = ref(0);
const closeButton = ref<HTMLButtonElement | null>(null);
const dismissButton = ref<HTMLButtonElement | null>(null);
const timers: ReturnType<typeof setTimeout>[] = [];

const currentWave = computed(
  () => props.result.waves[Math.min(waveIndex.value, props.result.waves.length - 1)]!,
);
const assetUrl = (asset: string) => `${import.meta.env.BASE_URL}${asset}`;
const heroAction = computed(() =>
  phase.value === 'clash'
    ? 'attack'
    : phase.value === 'result'
      ? props.result.win
        ? 'victory'
        : 'react'
      : 'idle',
);
const totalDamage = computed(() =>
  Math.round(props.result.waves.reduce((sum, wave) => sum + wave.result.damageDealt, 0)),
);

function clearTimers(): void {
  while (timers.length > 0) clearTimeout(timers.pop());
}

function schedule(delay: number, callback: () => void): void {
  timers.push(setTimeout(callback, delay));
}

function revealResult(): void {
  phase.value = 'result';
  void nextTick(() => closeButton.value?.focus());
}

function clampPercent(value: number): number {
  return Math.max(0, Math.min(100, value));
}

function prepareWave(index: number): void {
  waveIndex.value = index;
  const wave = props.result.waves[index]!;
  displayedPlayerHp.value = wave.playerHpBefore;
  displayedMonsterHp.value = wave.enemyMaxHp;
  playerHpPercent.value = clampPercent(
    (wave.playerHpBefore / props.playerMaxHp) * 100,
  );
  monsterHpPercent.value = 100;
}

function showWaveOutcome(): void {
  phase.value = 'clash';
  void nextTick(() => {
    const wave = currentWave.value;
    displayedPlayerHp.value = wave.playerHpAfter;
    displayedMonsterHp.value = wave.result.win
      ? 0
      : Math.max(0, wave.enemyMaxHp - wave.result.damageDealt);
    playerHpPercent.value = clampPercent(
      (wave.playerHpAfter / props.playerMaxHp) * 100,
    );
    monsterHpPercent.value = wave.result.win
      ? 0
      : clampPercent(100 - (wave.result.damageDealt / wave.enemyMaxHp) * 100);
  });
}

function play(): void {
  clearTimers();
  phase.value = props.reduceMotion ? 'result' : 'intro';
  if (props.reduceMotion) {
    prepareWave(props.result.waves.length - 1);
    showWaveOutcome();
    phase.value = 'result';
    void nextTick(() => closeButton.value?.focus());
    return;
  }

  prepareWave(0);
  schedule(430, showWaveOutcome);

  if (props.result.waves.length > 1) {
    schedule(1_180, () => {
      prepareWave(1);
      phase.value = 'intro';
    });
    schedule(1_560, showWaveOutcome);
    schedule(2_520, revealResult);
  } else {
    schedule(1_420, revealResult);
  }
}

function handleKeydown(event: KeyboardEvent): void {
  if (event.key !== 'Escape') return;
  event.preventDefault();
  emit('close');
}

watch(() => props.result, play, { immediate: true });
onMounted(() => {
  window.addEventListener('keydown', handleKeydown);
  void nextTick(() => dismissButton.value?.focus());
});
onUnmounted(() => {
  clearTimers();
  window.removeEventListener('keydown', handleKeydown);
});
</script>

<template>
  <div class="battle-backdrop" @click.self="emit('close')">
    <section
      class="battle-dialog"
      role="dialog"
      aria-modal="true"
      :aria-label="`${result.stage.name}挑战结果`"
    >
      <button
        ref="dismissButton"
        class="dismiss"
        type="button"
        aria-label="关闭副本战报"
        @click="emit('close')"
      >
        <X :size="17" aria-hidden="true" />
      </button>

      <div
        class="battle-stage"
        :class="[
          `phase-${phase}`,
          `wave-${currentWave.role}`,
          { won: result.win, lost: !result.win },
        ]"
        :style="{
          '--accent': result.stage.accent,
          '--stage-map': `url('${assetUrl(result.stage.mapAsset)}')`,
          '--map-position': result.stage.objectPosition,
        }"
      >
        <header class="stage-header">
          <span class="stage-title">
            <small>定向装备副本 · {{ result.stage.subtitle }}</small>
            <strong>{{ result.stage.name }}</strong>
          </span>
          <span class="wave-count">
            第 {{ waveIndex + 1 }} / {{ result.waves.length }} 波
          </span>
        </header>

        <div class="vitals hero-vitals">
          <span>{{ classId === 'swordsman' ? '剑姬' : classId === 'witch' ? '魔女' : classId === 'shaman' ? '灵巫' : '喵喵' }}</span>
          <i><b :style="{ width: `${playerHpPercent}%` }"></b></i>
          <small>{{ Math.round(displayedPlayerHp) }} / {{ Math.round(playerMaxHp) }}</small>
        </div>

        <div class="vitals monster-vitals">
          <span>{{ currentWave.monsterName }}</span>
          <i><b :style="{ width: `${monsterHpPercent}%` }"></b></i>
          <small>{{ Math.round(displayedMonsterHp) }} / {{ Math.round(currentWave.enemyMaxHp) }}</small>
        </div>

        <div class="combatants">
          <div class="hero-unit">
            <CharacterAppearance
              :class-id="classId"
              :level="level"
              :equipped="equipped"
              variant="battle"
              :action="heroAction"
            />
            <span class="hero-ring" aria-hidden="true"></span>
          </div>

          <span class="clash-core" aria-hidden="true">
            <i></i><i></i><i></i>
            <Swords :size="24" />
          </span>

          <div class="monster-unit" :class="{ defeated: currentWave.result.win }">
            <span class="monster-aura" aria-hidden="true"></span>
            <img :src="assetUrl(currentWave.asset)" alt="" draggable="false" />
            <span class="impact-number" aria-hidden="true">
              -{{ Math.round(currentWave.result.damageDealt) }}
            </span>
          </div>
        </div>

        <footer class="stage-footer">
          <span><Swords :size="12" />总伤害 {{ totalDamage.toLocaleString() }}</span>
          <span><ShieldCheck :size="12" />耗时 {{ (result.durationMs / 1000).toFixed(1) }} 秒</span>
          <span v-if="phase !== 'result'" class="fighting">
            <Sparkles :size="12" />自动战斗演算中
          </span>
        </footer>
      </div>

      <div v-if="phase === 'result'" class="result-panel" :class="{ victory: result.win }">
        <template v-if="result.win">
          <EquipmentDungeonReward
            :instances="result.instances"
            :first-clear="result.firstClear"
          />
          <button ref="closeButton" class="result-action victory-action" type="button" @click="emit('close')">
            收下装备
          </button>
        </template>
        <template v-else>
          <div class="defeat-copy">
            <strong>这次差一点</strong>
            <span>失败不会扣每日次数，也不会推进保底和随机序列。强化装备后可原样再试。</span>
          </div>
          <button ref="closeButton" class="result-action" type="button" @click="emit('close')">
            调整装备
          </button>
        </template>
      </div>
    </section>
  </div>
</template>

<style scoped>
.battle-backdrop {
  position: fixed;
  z-index: 80;
  inset: 0;
  display: grid;
  place-items: center;
  padding:
    max(12px, env(safe-area-inset-top))
    12px
    max(12px, env(safe-area-inset-bottom));
  background: rgb(31 27 54 / 64%);
  backdrop-filter: blur(7px);
}

.battle-dialog {
  position: relative;
  width: min(100%, 390px);
  max-height: calc(100dvh - 24px);
  overflow-y: auto;
  background: #f8f7ff;
  border: 1px solid rgb(255 255 255 / 88%);
  border-radius: 24px;
  box-shadow: 0 24px 70px rgb(23 20 50 / 35%);
}

.dismiss {
  position: absolute;
  z-index: 8;
  top: 9px;
  right: 9px;
  display: grid;
  width: 38px;
  height: 38px;
  place-items: center;
  color: #fff;
  background: rgb(38 36 61 / 48%);
  border: 1px solid rgb(255 255 255 / 42%);
  border-radius: 50%;
  backdrop-filter: blur(5px);
}

.battle-stage {
  --accent: #ff7fa4;
  position: relative;
  min-height: 470px;
  overflow: hidden;
  color: #fff;
  background:
    linear-gradient(180deg, rgb(29 34 61 / 22%), rgb(35 29 58 / 12%) 42%, rgb(23 24 49 / 72%)),
    var(--stage-map) var(--map-position) / cover no-repeat;
  border-radius: 23px 23px 18px 18px;
  isolation: isolate;
}

.battle-stage::before {
  position: absolute;
  z-index: -1;
  inset: 0;
  content: '';
  background:
    radial-gradient(circle at 22% 62%, color-mix(in srgb, var(--accent) 34%, transparent), transparent 25%),
    radial-gradient(circle at 78% 58%, rgb(142 180 255 / 30%), transparent 27%);
  mix-blend-mode: screen;
  pointer-events: none;
}

.stage-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
  padding: 15px 50px 12px 15px;
  text-shadow: 0 2px 8px rgb(28 25 57 / 55%);
}

.stage-title {
  display: grid;
  gap: 1px;
  min-width: 0;
}

.stage-title small {
  overflow: hidden;
  font-size: 9px;
  opacity: 0.84;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.stage-title strong {
  overflow: hidden;
  font-size: 15px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.wave-count {
  flex-shrink: 0;
  padding: 4px 8px;
  font-size: 9px;
  font-weight: 800;
  background: rgb(35 31 61 / 42%);
  border: 1px solid rgb(255 255 255 / 38%);
  border-radius: 999px;
  backdrop-filter: blur(5px);
}

.vitals {
  position: absolute;
  z-index: 4;
  top: 70px;
  display: grid;
  grid-template-columns: 1fr auto;
  gap: 2px 6px;
  width: 43%;
  padding: 7px 8px;
  font-size: 9px;
  background: rgb(34 31 59 / 54%);
  border: 1px solid rgb(255 255 255 / 32%);
  border-radius: 11px;
  backdrop-filter: blur(6px);
}

.hero-vitals {
  left: 10px;
}

.monster-vitals {
  right: 10px;
  text-align: right;
}

.vitals > span {
  overflow: hidden;
  font-weight: 800;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.vitals > small {
  font-size: 8px;
  opacity: 0.76;
}

.vitals i {
  grid-column: 1 / -1;
  height: 5px;
  overflow: hidden;
  background: rgb(17 17 34 / 55%);
  border-radius: 999px;
}

.vitals b {
  display: block;
  width: 100%;
  height: 100%;
  background: linear-gradient(90deg, #66e8c0, #a5ffdd);
  border-radius: inherit;
  transition: width 700ms ease-out;
}

.monster-vitals b {
  margin-left: auto;
  background: linear-gradient(90deg, #ff6e8b, #ffb18c);
}

.combatants {
  position: absolute;
  inset: 110px 0 45px;
}

.hero-unit,
.monster-unit {
  position: absolute;
  bottom: 18px;
  width: 46%;
  height: 275px;
}

.hero-unit {
  left: -3px;
  transform-origin: 50% 100%;
}

.hero-unit :deep(.character-appearance) {
  width: 100%;
  height: 100%;
}

.monster-unit {
  right: 0;
  display: grid;
  place-items: end center;
  transform-origin: 50% 100%;
}

.monster-unit img {
  position: relative;
  z-index: 2;
  width: 100%;
  height: 100%;
  object-fit: contain;
  object-position: 50% 100%;
  filter: drop-shadow(0 9px 8px rgb(28 28 61 / 32%));
}

.hero-ring,
.monster-aura {
  position: absolute;
  bottom: 7px;
  left: 50%;
  width: 112px;
  height: 25px;
  background: radial-gradient(ellipse, color-mix(in srgb, var(--accent) 55%, white), transparent 70%);
  border: 1px solid color-mix(in srgb, var(--accent) 60%, white);
  border-radius: 50%;
  transform: translateX(-50%);
  opacity: 0.72;
}

.monster-aura {
  z-index: 1;
  width: 132px;
  color: #9dbdff;
}

.clash-core {
  position: absolute;
  z-index: 5;
  top: 45%;
  left: 51%;
  display: grid;
  width: 54px;
  height: 54px;
  place-items: center;
  color: #fff;
  background: radial-gradient(circle, #fff, var(--accent) 25%, transparent 68%);
  border-radius: 50%;
  opacity: 0;
  transform: translate(-50%, -50%) scale(0.35);
}

.clash-core i {
  position: absolute;
  width: 90px;
  height: 2px;
  background: linear-gradient(90deg, transparent, #fff, transparent);
}

.clash-core i:nth-child(2) {
  transform: rotate(60deg);
}

.clash-core i:nth-child(3) {
  transform: rotate(-60deg);
}

.phase-clash .clash-core {
  animation: clash-pop 760ms ease-out both;
}

.phase-clash .hero-unit {
  animation: hero-lunge 760ms ease-out;
}

.phase-clash .monster-unit {
  animation: monster-hit 760ms ease-out;
}

.phase-intro .monster-unit {
  animation: monster-enter 380ms ease-out both;
}

.phase-result.won .monster-unit.defeated {
  opacity: 0.28;
  filter: grayscale(0.5);
  transform: translateY(18px) rotate(4deg);
}

.impact-number {
  position: absolute;
  z-index: 6;
  top: 25%;
  left: 18%;
  font-size: 18px;
  font-weight: 900;
  color: #fff3a6;
  text-shadow:
    0 2px 0 #d94f6a,
    0 0 8px #fff;
  opacity: 0;
}

.phase-clash .impact-number {
  animation: damage-rise 720ms ease-out 180ms both;
}

.stage-footer {
  position: absolute;
  z-index: 5;
  right: 10px;
  bottom: 10px;
  left: 10px;
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 7px 8px;
  font-size: 8px;
  background: rgb(29 27 53 / 50%);
  border: 1px solid rgb(255 255 255 / 30%);
  border-radius: 10px;
  backdrop-filter: blur(5px);
}

.stage-footer span {
  display: inline-flex;
  align-items: center;
  gap: 2px;
}

.fighting {
  margin-left: auto;
  color: #fff1a8;
}

.result-panel {
  display: grid;
  gap: 10px;
  padding: 12px;
}

.defeat-copy {
  display: grid;
  gap: 4px;
  padding: 14px;
  color: var(--text-mid);
  background: #fff;
  border-radius: 15px;
}

.defeat-copy strong {
  font-size: 15px;
  color: #8c5570;
}

.defeat-copy span {
  font-size: 10px;
  line-height: 1.6;
}

.result-action {
  min-height: 44px;
  font-size: 12px;
  font-weight: 800;
  color: #78576b;
  background: #fff;
  border: 1px solid #efd7e3;
  border-radius: 14px;
}

.victory-action {
  color: #fff;
  background: linear-gradient(100deg, #ff769e, #9e7deb);
  border: 0;
  box-shadow: 0 8px 18px rgb(191 96 151 / 24%);
}

@keyframes monster-enter {
  from {
    opacity: 0;
    transform: translateX(28px) scale(0.88);
  }
}

@keyframes hero-lunge {
  45% {
    transform: translateX(32px) scale(1.04);
  }
}

@keyframes monster-hit {
  44% {
    filter: brightness(1.75) saturate(1.35);
    transform: translateX(9px) rotate(2deg);
  }
}

@keyframes clash-pop {
  0% {
    opacity: 0;
    transform: translate(-50%, -50%) scale(0.25) rotate(-25deg);
  }
  32% {
    opacity: 1;
    transform: translate(-50%, -50%) scale(1.25) rotate(6deg);
  }
  100% {
    opacity: 0;
    transform: translate(-50%, -50%) scale(1.8) rotate(20deg);
  }
}

@keyframes damage-rise {
  from {
    opacity: 0;
    transform: translateY(8px) scale(0.7);
  }
  25% {
    opacity: 1;
  }
  to {
    opacity: 0;
    transform: translateY(-34px) scale(1.08);
  }
}

@media (width <= 340px) {
  .battle-stage {
    min-height: 430px;
  }

  .hero-unit,
  .monster-unit {
    height: 245px;
  }

  .vitals {
    width: 45%;
  }
}

@media (prefers-reduced-motion: reduce) {
  .hero-unit,
  .monster-unit,
  .clash-core,
  .impact-number {
    animation: none !important;
    transition: none !important;
  }
}
</style>
