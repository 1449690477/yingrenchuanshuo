<script setup lang="ts">
/**
 * ArenaBattleScene —— 竞技场战报回放（docs/54 §5.4 红线：
 * 战报必须播成战斗动画，不能只给「你赢了」弹窗）。
 *
 * 输入只有一份：服务端复算返回的逐回合日志（ArenaBattleReplay）。
 * 播放是纯表现层：不重算任何伤害，只把服务端已结算的事件流
 * 按固定节奏演出来 —— 与试炼回放同一信任模型。
 *
 * 演出要素：双方血条、伤害飘字（暴击加大金色）、命中/闪避、
 * 暴击粒子爆发、终结时的全屏爆闪与胜负横幅（含荣誉净变化）。
 * reduceMotion：压缩为快进时间线（事件 90ms/条、无粒子无震屏）。
 */
import { computed, onUnmounted, ref, watch } from 'vue';
import { Shield, Swords, X } from '@lucide/vue';
import type { ArenaBattleReplay } from '@/net/arena';
import type { DuelLogEvent, DuelRole } from '@/core/duel';
import { AFFECTION_CHARACTERS } from '@/data/affection';
import type { ClassId } from '@/core/types';
import ClassArtwork from '@/components/ClassArtwork.vue';

const props = defineProps<{
  battle: ArenaBattleReplay;
  attackerName: string;
  defenderName: string;
  attackerClass: ClassId;
  defenderClass: ClassId;
  won: boolean;
  honorDelta: number;
  playbackKey: number;
  reduceMotion: boolean;
}>();

const emit = defineEmits<{ complete: [] }>();

interface Floater {
  id: number;
  side: DuelRole; // 飘字所在的一侧（受击方）
  text: string;
  crit: boolean;
  miss: boolean;
  elemental: boolean;
}

const playedCount = ref(0);
const finished = ref(false);
let timer = 0;
let floaterSeq = 0;
const floaters = ref<Floater[]>([]);
const burstKey = ref(0);

const events = computed(() => props.battle.log);
const currentEvent = computed(() => events.value[playedCount.value - 1] ?? null);
const sceneStyle = {
  backgroundImage: `linear-gradient(180deg, rgb(11 28 55 / 14%), rgb(7 19 42 / 34%)), url('${import.meta.env.BASE_URL}assets/arena/arena-banner.webp')`,
};

// ─────────── 血条刻度 ───────────
// 日志只给伤害值；用「总承伤 ÷ (1 − 剩余百分比)」反推血条满刻度，
// 未受伤一侧放大 15% 避免满刻度除零。纯显示刻度，不影响任何数值。
const maxTaken = computed(() => {
  const scale = (taken: number, remainPct: number) => {
    if (taken <= 0) return 1;
    if (remainPct >= 1) return taken * 1.15;
    return taken / Math.max(0.001, 1 - remainPct);
  };
  return {
    attacker: scale(props.battle.defenderDamage, props.battle.attackerHpRemainPct),
    defender: scale(props.battle.attackerDamage, props.battle.defenderHpRemainPct),
  };
});

const takenSoFar = computed(() => {
  let attacker = 0;
  let defender = 0;
  for (const ev of events.value.slice(0, playedCount.value)) {
    if (!ev.hit || ev.damage <= 0) continue;
    if (ev.target === 'attacker') attacker += ev.damage;
    else defender += ev.damage;
  }
  return { attacker, defender };
});

const hpPct = computed(() => ({
  attacker: Math.max(0, 1 - takenSoFar.value.attacker / maxTaken.value.attacker),
  defender: Math.max(0, 1 - takenSoFar.value.defender / maxTaken.value.defender),
}));

const sideName = (role: DuelRole) =>
  role === 'attacker' ? props.attackerName : props.defenderName;
const sideClassName = (role: DuelRole) => {
  const id: ClassId = role === 'attacker' ? props.attackerClass : props.defenderClass;
  return AFFECTION_CHARACTERS[id]?.name ?? id;
};
const sideClassId = (role: DuelRole) =>
  role === 'attacker' ? props.attackerClass : props.defenderClass;
const sideActing = (role: DuelRole) => currentEvent.value?.source === role;
const sideStruck = (role: DuelRole) => currentEvent.value?.target === role;

function pushFloater(ev: DuelLogEvent): void {
  const miss = !ev.hit;
  const text = miss ? '闪避' : ev.crit ? `${ev.damage}!` : `${ev.damage}`;
  floaters.value.push({
    id: ++floaterSeq,
    side: ev.target,
    text,
    crit: ev.crit,
    miss,
    elemental: ev.kind === 'on-hit-elemental-damage',
  });
  if (ev.crit && ev.hit) burstKey.value++;
  const id = floaterSeq;
  setTimeout(() => {
    floaters.value = floaters.value.filter((f) => f.id !== id);
  }, 900);
}

function stop(): void {
  clearTimeout(timer);
}

function play(from: number): void {
  if (from >= events.value.length) {
    finished.value = true;
    return;
  }
  const ev = events.value[from]!;
  playedCount.value = from + 1;
  pushFloater(ev);
  const pace = props.reduceMotion ? 90 : ev.crit ? 560 : 420;
  timer = window.setTimeout(() => play(from + 1), pace);
}

function skip(): void {
  stop();
  playedCount.value = events.value.length;
  floaters.value = [];
  finished.value = true;
}

function close(): void {
  stop();
  emit('complete');
}

watch(
  () => props.playbackKey,
  () => {
    stop();
    playedCount.value = 0;
    floaters.value = [];
    finished.value = false;
    play(0);
  },
  { immediate: true },
);

onUnmounted(stop);
</script>

<template>
  <div class="arena-scene" role="dialog" aria-label="竞技场战报回放">
    <div class="battle-frame">
      <div class="scene-bg" :style="sceneStyle" aria-hidden="true" />
      <i v-for="n in 10" :key="`m${n}`" class="mote" :class="`mote-${n}`" aria-hidden="true" />

      <header class="scene-head">
        <span class="scene-title"><Swords :size="13" aria-hidden="true" />实景对决回放</span>
        <button v-if="!finished" class="skip-btn" type="button" @click="skip">跳过</button>
        <button v-else class="skip-btn close" type="button" aria-label="关闭回放" @click="close">
          <X :size="14" aria-hidden="true" />
        </button>
      </header>

      <!-- 对阵双方：竞技场已有完整战场素材，双方直接使用职业正式立绘。 -->
      <div class="duelists">
        <template v-for="role in ['attacker', 'defender'] as const" :key="role">
          <div
            class="duelist"
            :class="{ 'is-acting': sideActing(role), 'is-struck': sideStruck(role) }"
            :data-side="role"
          >
            <span class="fighter-art">
              <ClassArtwork
                :class-id="sideClassId(role)"
                variant="battle"
                :action="sideActing(role) ? 'cast' : 'idle'"
              />
            </span>
            <span class="duelist-name">{{ sideName(role) }}</span>
            <span class="duelist-class">{{ sideClassName(role) }}</span>
            <div class="hp-track" role="img" :aria-label="`${sideName(role)}剩余生命`">
              <div
                class="hp-fill"
                :class="{ low: hpPct[role] < 0.3 }"
                :style="{ width: `${hpPct[role] * 100}%` }"
              />
            </div>
            <span class="hp-num">{{ Math.round(hpPct[role] * 100) }}%</span>

            <div class="floater-layer" aria-hidden="true">
              <span
                v-for="f in floaters.filter((x) => x.side === role)"
                :key="f.id"
                class="floater"
                :class="{ crit: f.crit, miss: f.miss, elemental: f.elemental }"
                >{{ f.text }}</span
              >
            </div>
          </div>
        </template>

        <span class="vs-chip" aria-hidden="true">VS</span>
      </div>

      <div v-if="!reduceMotion" :key="burstKey" class="burst" aria-hidden="true">
        <i v-for="n in 12" :key="n" :style="{ '--a': `${(n - 1) * 30}deg` }" />
      </div>
    </div>

    <!-- 终结横幅 -->
    <Transition name="banner">
      <div v-if="finished" class="result-banner" :class="{ won }" role="status">
        <span class="result-glow" aria-hidden="true" />
        <Shield v-if="!won" :size="18" aria-hidden="true" />
        <Swords v-else :size="18" aria-hidden="true" />
        <strong>{{ won ? '挑战成功' : '防线告破' }}</strong>
        <span class="result-delta" :class="{ neg: honorDelta < 0 }">
          荣誉 {{ honorDelta >= 0 ? '+' : '' }}{{ honorDelta }}
        </span>
      </div>
    </Transition>
  </div>
</template>

<style scoped>
.arena-scene {
  position: fixed;
  inset: 0;
  z-index: 60;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 12px;
  padding: 24px 20px calc(24px + var(--sab));
  background: rgb(15 23 42 / 82%);
  backdrop-filter: blur(10px);
  overflow: hidden;
}

.battle-frame {
  position: relative;
  isolation: isolate;
  width: 100%;
  max-width: 440px;
  aspect-ratio: 3 / 2;
  overflow: hidden;
  border: 1px solid rgb(255 255 255 / 38%);
  border-radius: 20px;
  box-shadow:
    0 24px 60px rgb(5 12 29 / 44%),
    inset 0 1px 0 rgb(255 255 255 / 44%);
}

.scene-bg {
  position: absolute;
  inset: 0;
  z-index: -1;
  background-position: center;
  background-size: cover;
  pointer-events: none;
}

.scene-bg::after {
  position: absolute;
  inset: 0;
  content: '';
  background:
    linear-gradient(180deg, rgb(8 20 45 / 12%) 0 52%, rgb(6 17 38 / 48%)),
    radial-gradient(circle at 50% 78%, transparent, rgb(8 20 45 / 18%));
}

/* 光尘粒子场（与榜单英雄卡同一语言） */
.mote {
  position: absolute;
  bottom: -8px;
  width: 5px;
  height: 5px;
  border-radius: 50%;
  background: radial-gradient(circle, #ffe9b0, rgb(255 200 96 / 0%));
  opacity: 0;
  animation: mote-rise 7s linear infinite;
  pointer-events: none;
}
.mote-1 {
  left: 8%;
  animation-delay: 0s;
}
.mote-2 {
  left: 18%;
  animation-delay: 1.4s;
  animation-duration: 8s;
}
.mote-3 {
  left: 28%;
  animation-delay: 3s;
}
.mote-4 {
  left: 38%;
  animation-delay: 0.8s;
  animation-duration: 9s;
}
.mote-5 {
  left: 48%;
  animation-delay: 2.2s;
}
.mote-6 {
  left: 58%;
  animation-delay: 4.2s;
  animation-duration: 8.4s;
}
.mote-7 {
  left: 68%;
  animation-delay: 1s;
}
.mote-8 {
  left: 78%;
  animation-delay: 3.6s;
  animation-duration: 9.4s;
}
.mote-9 {
  left: 88%;
  animation-delay: 0.4s;
}
.mote-10 {
  left: 94%;
  animation-delay: 2.8s;
  animation-duration: 7.6s;
}

@keyframes mote-rise {
  0% {
    transform: translateY(0) scale(0.6);
    opacity: 0;
  }
  12% {
    opacity: 0.9;
  }
  85% {
    opacity: 0.5;
  }
  100% {
    transform: translateY(-88vh) scale(1.1);
    opacity: 0;
  }
}

.scene-head {
  position: absolute;
  z-index: 5;
  top: 9px;
  right: 10px;
  left: 10px;
  display: flex;
  align-items: center;
  justify-content: space-between;
}
.scene-title {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 13px;
  font-weight: 700;
  color: #ffe9b0;
  letter-spacing: 0.06em;
}
.skip-btn {
  border: 1px solid rgb(255 233 176 / 40%);
  background: rgb(255 233 176 / 10%);
  color: #ffe9b0;
  font-size: 12px;
  font-weight: 600;
  padding: 6px 14px;
  border-radius: 999px;
  cursor: pointer;
  transition:
    transform 0.16s var(--ease-spring),
    background 0.16s;
}
.skip-btn:active {
  transform: scale(0.93);
}
.skip-btn.close {
  padding: 6px 10px;
}

.duelists {
  position: absolute;
  z-index: 2;
  inset: 42px 9px 8px;
  display: grid;
  grid-template-columns: 1fr 1fr;
  grid-template-rows: minmax(0, 1fr);
  gap: 14px;
}

.duelist {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: end;
  gap: 2px;
  min-width: 0;
  min-height: 0;
  height: 100%;
  overflow: hidden;
  padding: 4px 7px 7px;
  border-radius: 14px;
  background: linear-gradient(180deg, transparent 34%, rgb(12 29 55 / 66%) 76%);
  border: 1px solid rgb(255 255 255 / 18%);
  transition: filter 120ms ease;
}
.duelist[data-side='attacker'] {
  border-color: rgb(255 200 96 / 45%);
  box-shadow: 0 0 24px rgb(232 172 31 / 18%);
}

.fighter-art {
  min-height: 0;
  width: 100%;
  height: calc(100% - 52px);
  flex: none;
  display: block;
  overflow: hidden;
  filter: drop-shadow(0 8px 8px rgb(8 20 43 / 42%));
  transform-origin: 50% 100%;
}

.fighter-art :deep(.class-art) {
  width: 100%;
  height: 100%;
}

.duelist[data-side='defender'] .fighter-art {
  transform: scaleX(-1);
}

.duelist.is-acting .fighter-art {
  animation: fighter-lunge 390ms ease-out;
}

.duelist[data-side='defender'].is-acting .fighter-art {
  animation-name: fighter-lunge-mirrored;
}

.duelist.is-struck {
  animation: fighter-hit 360ms ease-out;
}

.duelist-name {
  max-width: 100%;
  font-size: 11px;
  font-weight: 800;
  color: #fff;
  max-width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.duelist-class {
  font-size: 8px;
  color: rgb(255 255 255 / 68%);
}

.hp-track {
  width: 100%;
  height: 6px;
  border-radius: 999px;
  background: rgb(255 255 255 / 14%);
  overflow: hidden;
  margin-top: 2px;
}
.hp-fill {
  height: 100%;
  border-radius: 999px;
  background: linear-gradient(90deg, #7be3a8, #b7f26d);
  transition: width 0.3s var(--ease-soft);
}
.hp-fill.low {
  background: linear-gradient(90deg, #ff9a62, #ff6b7a);
}
.hp-num {
  font-size: 8px;
  font-weight: 700;
  color: rgb(255 255 255 / 80%);
}

.vs-chip {
  position: absolute;
  left: 50%;
  top: 50%;
  transform: translate(-50%, -50%);
  z-index: 3;
  font-size: 13px;
  font-weight: 900;
  color: #ffd98a;
  background: rgb(20 26 44 / 88%);
  border: 1px solid rgb(255 217 138 / 55%);
  border-radius: 999px;
  padding: 6px 10px;
  letter-spacing: 0.08em;
}

.floater-layer {
  position: absolute;
  inset: 0;
  pointer-events: none;
  overflow: visible;
}
.floater {
  position: absolute;
  left: 50%;
  top: 38%;
  transform: translateX(-50%);
  font-size: 15px;
  font-weight: 800;
  color: #fff;
  text-shadow: 0 1px 6px rgb(0 0 0 / 45%);
  animation: float-up 0.9s var(--ease-soft) forwards;
}

@keyframes fighter-lunge {
  46% {
    transform: translateX(12px) scale(1.05);
  }
}
@keyframes fighter-lunge-mirrored {
  46% {
    transform: translateX(-12px) scaleX(-1) scale(1.05);
  }
}
@keyframes fighter-hit {
  36% {
    filter: brightness(1.7) saturate(0.65);
    transform: translateX(-4px);
  }
}
.floater.crit {
  font-size: 22px;
  color: #ffd98a;
  text-shadow: 0 0 12px rgb(255 200 96 / 65%);
}
.floater.miss {
  font-size: 12px;
  color: #bcd6ea;
  font-weight: 600;
}
.floater.elemental {
  color: #9fd8ff;
}

@keyframes float-up {
  0% {
    opacity: 0;
    transform: translate(-50%, 10px) scale(0.7);
  }
  18% {
    opacity: 1;
    transform: translate(-50%, 0) scale(1.06);
  }
  100% {
    opacity: 0;
    transform: translate(-50%, -34px) scale(1);
  }
}

/* 暴击粒子爆发：12 向金光 */
.burst {
  position: absolute;
  left: 50%;
  top: 46%;
  z-index: 2;
  pointer-events: none;
}
.burst i {
  position: absolute;
  width: 4px;
  height: 26px;
  border-radius: 4px;
  background: linear-gradient(180deg, #fff3c4, rgb(255 200 96 / 0%));
  transform: rotate(var(--a)) translateY(0);
  animation: burst-fly 0.55s var(--ease-soft) forwards;
}
@keyframes burst-fly {
  0% {
    opacity: 0;
    transform: rotate(var(--a)) translateY(0) scaleY(0.3);
  }
  25% {
    opacity: 1;
  }
  100% {
    opacity: 0;
    transform: rotate(var(--a)) translateY(-64px) scaleY(1.1);
  }
}

.result-banner {
  position: relative;
  z-index: 3;
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 14px 26px;
  border-radius: var(--r-lg);
  background: linear-gradient(135deg, rgb(255 217 138 / 22%), rgb(255 158 196 / 18%));
  border: 1px solid rgb(255 217 138 / 55%);
  color: #ffe9b0;
  overflow: hidden;
}

@media (max-width: 360px) {
  .battle-frame {
    border-radius: 16px;
  }
  .duelists {
    gap: 8px;
  }
  .duelist {
    padding-inline: 5px;
  }
}
.result-banner:not(.won) {
  background: rgb(255 255 255 / 10%);
  border-color: rgb(255 255 255 / 28%);
  color: #dcebf8;
}
.result-banner strong {
  font-size: 17px;
  letter-spacing: 0.04em;
}
.result-delta {
  font-size: 13px;
  font-weight: 800;
  color: #ffd98a;
}
.result-delta.neg {
  color: #ff9aa2;
}
.result-glow {
  position: absolute;
  inset: -40%;
  background: conic-gradient(from 0deg, transparent, rgb(255 217 138 / 25%), transparent 30%);
  animation: glow-spin 2.6s linear infinite;
  pointer-events: none;
}
@keyframes glow-spin {
  to {
    transform: rotate(360deg);
  }
}

.banner-enter-active {
  animation: banner-in 0.5s var(--ease-out-back);
}
@keyframes banner-in {
  from {
    opacity: 0;
    transform: translateY(18px) scale(0.86);
  }
  to {
    opacity: 1;
    transform: none;
  }
}

@media (prefers-reduced-motion: reduce) {
  .mote,
  .burst,
  .result-glow {
    display: none;
  }
  .floater {
    animation-duration: 0.3s;
  }
  .hp-fill {
    transition: none;
  }
}
</style>
