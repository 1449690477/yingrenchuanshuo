<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue';
import { ShieldCheck, Sparkles, Swords, X } from '@lucide/vue';
import { createFocusTrap, type FocusTrap } from 'focus-trap';
import type { ClassId } from '@/core/types';
import type { CharacterAction, EquippedRecord } from '@/data/characterAppearance';
import {
  basicBattleAction,
  requireImpactFeedback,
  stageWaveHits,
  type ImpactTier,
} from '@/data/battleMotions';
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
const dismissButton = ref<HTMLButtonElement | null>(null);
const dialogRef = ref<HTMLElement | null>(null);
const resultPanel = ref<HTMLElement | null>(null);
const timers: ReturnType<typeof setTimeout>[] = [];
let dialogFocusTrap: FocusTrap | null = null;

/**
 * 一波拆成几下打出来。
 *
 * 4 下是试出来的平衡点：再少回到「一击结算」的表格感，
 * 再多每下就短到看不清数字，而且整场战报会拖过 4 秒，
 * 玩家一天要打 3 次，太长会烦。
 */
const HITS_PER_WAVE = 4;
/** 每下之间的间隔 */
const HIT_INTERVAL_MS = 250;

interface FloatingHit {
  id: number;
  damage: number;
  tier: ImpactTier;
  /** 横向偏移，避免连续数字完全重叠 */
  offset: number;
  /** 纵向偏移，配合横向把连续数字在二维上摊开 */
  lift: number;
}

/** 着弹闪光：每下打击在怪物身上炸一个光斑，和飘字同生共死 */
interface ImpactBurst {
  id: number;
  tier: ImpactTier;
  x: number;
  y: number;
}

const floatingHits = ref<FloatingHit[]>([]);
const impactBursts = ref<ImpactBurst[]>([]);
/** 当前这一下用的姿势，按职业动作序列轮换 */
const strikeIndex = ref(0);
const hitstop = ref(false);
const shakeTier = ref<ImpactTier | null>(null);
/** 收尾那下打出击杀时立刻进入倒地演出，而不是罚站到结算面板 */
const monsterDying = ref(false);
/** 本波已打出的下数，底部连击计数用 */
const comboCount = ref(0);
/** 换波横幅：intro 阶段显示「第 X 波」，开打即收起 */
const waveBanner = ref(0);
const monsterEl = ref<HTMLElement | null>(null);
let hitSeq = 0;
let hitstopTimer = 0;
let shakeTimer = 0;

/**
 * 触发一次打击反馈。
 * 强度表与主线挂机战斗共用同一张 IMPACT_FEEDBACK，
 * 手感统一 —— 玩家不该觉得副本里的暴击和外面的暴击是两回事。
 */
function triggerImpact(tier: ImpactTier): void {
  if (props.reduceMotion) return;
  const feedback = requireImpactFeedback(tier);

  if (feedback.hitstopMs > 0) {
    hitstop.value = true;
    clearTimeout(hitstopTimer);
    hitstopTimer = window.setTimeout(() => {
      hitstop.value = false;
    }, feedback.hitstopMs);
  }
  if (feedback.shakePx > 0) {
    shakeTier.value = tier;
    clearTimeout(shakeTimer);
    shakeTimer = window.setTimeout(() => {
      shakeTier.value = null;
    }, feedback.shakeMs);
  }
}

function pushFloatingHit(damage: number, tier: ImpactTier): void {
  const id = ++hitSeq;
  // 二维散开：横向 ±34px、纵向再抬 0~18px，连续四下不再叠成一团
  floatingHits.value.push({
    id,
    damage,
    tier,
    offset: ((id * 29) % 68) - 34,
    lift: (id * 13) % 18,
  });
  timers.push(
    setTimeout(() => {
      floatingHits.value = floatingHits.value.filter((h) => h.id !== id);
    }, 900),
  );
  if (props.reduceMotion) return;
  const burst = { id, tier, x: ((id * 17) % 40) - 20, y: -((id * 11) % 24) };
  impactBursts.value.push(burst);
  timers.push(
    setTimeout(() => {
      impactBursts.value = impactBursts.value.filter((b) => b.id !== id);
    }, 460),
  );
}

/**
 * 逐下受击僵直。每下都摘掉 class 强制 reflow 再挂回，
 * 确保 250ms 一拍连打时动画每次都重新播放，而不是整波只闪一下。
 */
function reflinch(): void {
  if (props.reduceMotion) return;
  const el = monsterEl.value;
  if (!el) return;
  el.classList.remove('flinch');
  void el.offsetWidth;
  el.classList.add('flinch');
}

const currentWave = computed(
  () => props.result.waves[Math.min(waveIndex.value, props.result.waves.length - 1)]!,
);
const assetUrl = (asset: string) => `${import.meta.env.BASE_URL}${asset}`;
/**
 * 每一下换一个姿势，走该职业自己的动作序列。
 * 原本整波只有一个 attack —— 四个职业打起来长得一模一样，
 * 副本里最该展示职业特色的地方反而最没有特色。
 */
const heroAction = computed<CharacterAction>(() => {
  if (phase.value === 'result') return props.result.win ? 'victory' : 'react';
  if (phase.value !== 'clash') return 'idle';
  return basicBattleAction(props.classId, strikeIndex.value || 1);
});
const totalDamage = computed(() =>
  Math.round(props.result.waves.reduce((sum, wave) => sum + wave.result.damageDealt, 0)),
);
/** 玩家血量低于三成就转红告警，副本翻车往往是从没注意血线开始的 */
const playerLowHp = computed(() => playerHpPercent.value <= 30);

function clearTimers(): void {
  while (timers.length > 0) clearTimeout(timers.pop());
}

function schedule(delay: number, callback: () => void): void {
  timers.push(setTimeout(callback, delay));
}

function revealResult(): void {
  phase.value = 'result';
  void nextTick(() => resultPanel.value?.focus());
}

function clampPercent(value: number): number {
  return Math.max(0, Math.min(100, value));
}

function prepareWave(index: number): void {
  waveIndex.value = index;
  monsterDying.value = false;
  comboCount.value = 0;
  const wave = props.result.waves[index]!;
  displayedPlayerHp.value = wave.playerHpBefore;
  displayedMonsterHp.value = wave.enemyMaxHp;
  playerHpPercent.value = clampPercent((wave.playerHpBefore / props.playerMaxHp) * 100);
  monsterHpPercent.value = 100;
}

/**
 * 一波打斗的逐下演出。
 *
 * 战斗结果早已算完（见 core/equipmentDungeon），这里只负责**把同一个结果分几下播出来**：
 * 血条一格一格掉、数字一个一个飞、收尾那下给最强反馈。
 * stageWaveHits 保证各段之和严格等于原本的 damageDealt，总伤害一分不差。
 */
function playWaveStrikes(index: number): void {
  phase.value = 'clash';
  waveBanner.value = 0;
  const wave = props.result.waves[index]!;
  const hits = stageWaveHits(wave.result.damageDealt, HITS_PER_WAVE);

  const hpBefore = wave.playerHpBefore;
  const hpAfter = wave.playerHpAfter;
  const enemyMax = wave.enemyMaxHp;

  let dealt = 0;
  hits.forEach((hit, i) => {
    schedule(i * HIT_INTERVAL_MS, () => {
      dealt += hit.damage;
      strikeIndex.value++;
      comboCount.value = i + 1;
      reflinch();

      // 怪物血条按已打出的伤害逐段掉；最后一下若这波获胜就归零
      const isLast = i === hits.length - 1;
      const remaining = isLast && wave.result.win ? 0 : Math.max(0, enemyMax - dealt);
      displayedMonsterHp.value = remaining;
      monsterHpPercent.value = clampPercent((remaining / enemyMax) * 100);

      // 玩家血条平摊到每一下，收尾时精确落到结算值，避免累加误差
      const playerHp = isLast ? hpAfter : hpBefore + ((hpAfter - hpBefore) * (i + 1)) / hits.length;
      displayedPlayerHp.value = playerHp;
      playerHpPercent.value = clampPercent((playerHp / props.playerMaxHp) * 100);

      // 收尾那下按「技能暴击」给满反馈，中途各下按普攻处理
      const tier: ImpactTier = hit.finisher ? 'ultimate' : 'light';
      pushFloatingHit(hit.damage, tier);
      triggerImpact(tier);

      // 击杀即倒地：怪物不该血条空了还罚站到结算面板
      if (isLast && wave.result.win && !props.reduceMotion) {
        monsterDying.value = true;
      }
    });
  });
}

function play(): void {
  clearTimers();
  floatingHits.value = [];
  impactBursts.value = [];
  strikeIndex.value = 0;
  monsterDying.value = false;
  comboCount.value = 0;
  waveBanner.value = 0;

  // 关掉动效时直接给最终状态：这些玩家要的是结果，不是过程
  if (props.reduceMotion) {
    const last = props.result.waves.length - 1;
    prepareWave(last);
    const wave = props.result.waves[last]!;
    displayedPlayerHp.value = wave.playerHpAfter;
    displayedMonsterHp.value = wave.result.win
      ? 0
      : Math.max(0, wave.enemyMaxHp - wave.result.damageDealt);
    playerHpPercent.value = clampPercent((wave.playerHpAfter / props.playerMaxHp) * 100);
    monsterHpPercent.value = wave.result.win
      ? 0
      : clampPercent((displayedMonsterHp.value / wave.enemyMaxHp) * 100);
    phase.value = 'result';
    void nextTick(() => resultPanel.value?.focus());
    return;
  }

  // 逐波逐下播：入场 → 几下打斗 → 下一波入场 → … → 战报
  const INTRO_MS = 400;
  const WAVE_GAP_MS = 420;
  let cursor = 0;

  props.result.waves.forEach((_, index) => {
    const at = cursor;
    schedule(at, () => {
      prepareWave(index);
      phase.value = 'intro';
      waveBanner.value = index + 1;
    });
    schedule(at + INTRO_MS, () => playWaveStrikes(index));
    // 段数固定，整波时长可以提前算出来，不必等回调回报
    cursor = at + INTRO_MS + HITS_PER_WAVE * HIT_INTERVAL_MS + WAVE_GAP_MS;
  });

  schedule(cursor, revealResult);
}

function requestClose(): void {
  if (dialogFocusTrap?.active) {
    dialogFocusTrap.deactivate();
    return;
  }
  emit('close');
}

watch([() => props.result, () => props.reduceMotion], play, { immediate: true });
onMounted(async () => {
  await nextTick();
  const dialog = dialogRef.value;
  if (!dialog) return;
  dialogFocusTrap = createFocusTrap(dialog, {
    initialFocus: () => dismissButton.value ?? dialog,
    fallbackFocus: () => dialog,
    clickOutsideDeactivates: true,
    returnFocusOnDeactivate: false,
    isolateSubtrees: 'aria-hidden',
    onDeactivate: () => emit('close'),
  });
  dialogFocusTrap.activate();
});
onUnmounted(() => {
  clearTimers();
  clearTimeout(hitstopTimer);
  clearTimeout(shakeTimer);
  if (dialogFocusTrap?.active) {
    dialogFocusTrap.deactivate({
      returnFocus: false,
      onDeactivate: () => undefined,
    });
  }
  dialogFocusTrap = null;
});
</script>

<template>
  <div class="battle-backdrop">
    <section
      ref="dialogRef"
      class="battle-dialog"
      role="dialog"
      aria-modal="true"
      :aria-label="`${result.stage.name}挑战结果`"
      tabindex="-1"
    >
      <button
        ref="dismissButton"
        class="dismiss"
        type="button"
        aria-label="关闭副本战报"
        @click="requestClose"
      >
        <X :size="17" aria-hidden="true" />
      </button>

      <div
        class="battle-stage"
        :class="[
          `phase-${phase}`,
          `wave-${currentWave.role}`,
          shakeTier ? `shake-${shakeTier}` : null,
          {
            won: result.win,
            lost: !result.win,
            'is-hitstop': hitstop,
            'reduced-motion': reduceMotion,
          },
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
          <span class="wave-count"> 第 {{ waveIndex + 1 }} / {{ result.waves.length }} 波 </span>
        </header>

        <div class="vitals hero-vitals" :class="{ lowhp: playerLowHp }">
          <span>{{
            classId === 'swordsman'
              ? '剑姬'
              : classId === 'witch'
                ? '魔女'
                : classId === 'shaman'
                  ? '灵巫'
                  : '喵喵'
          }}</span>
          <i
            :key="`p-${waveIndex}`"
            role="meter"
            aria-label="玩家生命"
            aria-valuemin="0"
            :aria-valuemax="playerMaxHp"
            :aria-valuenow="Math.round(displayedPlayerHp)"
            :aria-valuetext="`${Math.round(displayedPlayerHp)} / ${Math.round(playerMaxHp)}`"
            ><b class="ghost" :style="{ width: `${playerHpPercent}%` }"></b
            ><b :style="{ width: `${playerHpPercent}%` }"></b
          ></i>
          <small>{{ Math.round(displayedPlayerHp) }} / {{ Math.round(playerMaxHp) }}</small>
        </div>

        <div class="vitals monster-vitals">
          <span>{{ currentWave.monsterName }}</span>
          <i
            :key="`m-${waveIndex}`"
            role="meter"
            aria-label="敌人生命"
            aria-valuemin="0"
            :aria-valuemax="currentWave.enemyMaxHp"
            :aria-valuenow="Math.round(displayedMonsterHp)"
            :aria-valuetext="`${Math.round(displayedMonsterHp)} / ${Math.round(currentWave.enemyMaxHp)}`"
            ><b class="ghost" :style="{ width: `${monsterHpPercent}%` }"></b
            ><b :style="{ width: `${monsterHpPercent}%` }"></b
          ></i>
          <small
            >{{ Math.round(displayedMonsterHp) }} / {{ Math.round(currentWave.enemyMaxHp) }}</small
          >
        </div>

        <!-- 换波横幅：intro 阶段亮一下「第 X 波」，开打即收 -->
        <span v-if="waveBanner" :key="`banner-${waveIndex}`" class="wave-banner num">
          第 {{ waveBanner }} 波
        </span>

        <div class="combatants">
          <div class="hero-unit">
            <CharacterAppearance
              :class-id="classId"
              :level="level"
              :equipped="equipped"
              variant="battle"
              :action="heroAction"
              :reduce-motion="reduceMotion"
            />
            <span class="hero-ring" aria-hidden="true"></span>
          </div>

          <span class="clash-core" aria-hidden="true">
            <i></i><i></i><i></i>
            <Swords :size="24" />
          </span>

          <div
            ref="monsterEl"
            class="monster-unit"
            :class="{ defeated: currentWave.result.win, dying: monsterDying }"
          >
            <span class="monster-aura" aria-hidden="true"></span>
            <img :src="assetUrl(currentWave.asset)" alt="" draggable="false" />
            <!-- 逐下着弹闪光：每下打击在怪物身上炸一个光斑 -->
            <span class="burst-layer" aria-hidden="true">
              <span
                v-for="burst in impactBursts"
                :key="burst.id"
                class="impact-flash"
                :class="`tier-${burst.tier}`"
                :style="{ '--burst-x': `${burst.x}px`, '--burst-y': `${burst.y}px` }"
              ></span>
            </span>
            <!-- 逐下飘字：每一下一个数字，收尾那下最大 -->
            <TransitionGroup name="hit-float" tag="span" class="hit-layer" aria-hidden="true">
              <span
                v-for="hit in floatingHits"
                :key="hit.id"
                class="hit-number num"
                :class="`tier-${hit.tier}`"
                :style="{ '--hit-offset': `${hit.offset}px`, '--hit-lift': `${hit.lift}px` }"
              >
                -{{ hit.damage.toLocaleString() }}
              </span>
            </TransitionGroup>
          </div>
        </div>

        <footer class="stage-footer">
          <span><Swords :size="12" />总伤害 {{ totalDamage.toLocaleString() }}</span>
          <span><ShieldCheck :size="12" />耗时 {{ (result.durationMs / 1000).toFixed(1) }} 秒</span>
          <span v-if="phase === 'clash' && comboCount > 0" :key="comboCount" class="combo num"
            >连击 ×{{ comboCount }}</span
          >
          <span v-if="phase !== 'result'" class="fighting">
            <Sparkles :size="12" />自动战斗演算中
          </span>
        </footer>
      </div>

      <div
        v-if="phase === 'result'"
        ref="resultPanel"
        class="result-panel"
        :class="{ victory: result.win }"
        tabindex="-1"
      >
        <template v-if="result.win">
          <EquipmentDungeonReward
            :instances="result.instances"
            :class-id="classId"
            :first-clear="result.firstClear"
            :reduce-motion="reduceMotion"
          />
          <button
            class="result-action victory-action"
            type="button"
            @click="requestClose"
          >
            收下装备
          </button>
        </template>
        <template v-else>
          <div class="defeat-copy">
            <strong>这次差一点</strong>
            <span>失败不会扣每日次数，也不会推进保底和随机序列。强化装备后可原样再试。</span>
          </div>
          <button class="result-action" type="button" @click="requestClose">
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

  /*
   * 可滚动 flex + 子元素 margin:auto —— 放得下居中，放不下从顶部开始且能滚完。
   * 溢出，顶部永远滚不到（副本「领取装备」按钮就是这么消失的）。
   * 详见 style.css 里 .overlay 的完整说明。
   */
  display: flex;
  overflow-y: auto;
  overscroll-behavior: contain;
  -webkit-overflow-scrolling: touch;
  padding:
    max(12px, env(safe-area-inset-top))
    max(12px, env(safe-area-inset-right))
    max(12px, env(safe-area-inset-bottom))
    max(12px, env(safe-area-inset-left));
  background: rgb(31 27 54 / 64%);
  backdrop-filter: blur(7px);
}

.battle-dialog {
  margin: auto;
  flex-shrink: 0;
  position: relative;
  width: min(100%, 390px);
  max-height: 100%;
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
    radial-gradient(
      circle at 22% 62%,
      color-mix(in srgb, var(--accent) 34%, transparent),
      transparent 25%
    ),
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
  position: relative;
  grid-column: 1 / -1;
  height: 6px;
  overflow: hidden;
  background: rgb(17 17 34 / 55%);
  border-radius: 999px;
}

/* 主条快速落位，残影条慢半拍拖尾 —— 掉血量一眼可读 */
.vitals b {
  position: absolute;
  top: 0;
  bottom: 0;
  left: 0;
  display: block;
  width: 100%;
  height: 100%;
  background: linear-gradient(90deg, #66e8c0, #a5ffdd);
  border-radius: inherit;
  transition: width 240ms ease-out;
}

.vitals b.ghost {
  background: rgb(255 255 255 / 58%);
  transition: width 880ms ease-out 260ms;
}

.monster-vitals b {
  right: 0;
  left: auto;
  background: linear-gradient(90deg, #ff6e8b, #ffb18c);
}

.monster-vitals b.ghost {
  background: rgb(255 226 140 / 62%);
}

/* 玩家血线告警：低于三成血条转红并呼吸闪烁 */
.hero-vitals.lowhp > span {
  color: #ffb3c2;
}

.hero-vitals.lowhp b:not(.ghost) {
  background: linear-gradient(90deg, #ff5d7a, #ff9a8b);
  animation: lowhp-pulse 900ms ease-in-out infinite;
}

@keyframes lowhp-pulse {
  50% {
    filter: brightness(1.45);
  }
}

/* 换波横幅：intro 阶段弹出来，开打即由脚本收起 */
.wave-banner {
  position: absolute;
  z-index: 7;
  top: 33%;
  left: 50%;
  padding: 7px 22px;
  font-size: 22px;
  font-weight: 900;
  letter-spacing: 0.14em;
  color: #fff;
  white-space: nowrap;
  background: linear-gradient(100deg, rgb(38 32 68 / 72%), rgb(38 32 68 / 46%));
  border: 1px solid rgb(255 255 255 / 42%);
  border-radius: 999px;
  text-shadow: 0 2px 8px rgb(28 25 57 / 65%);
  backdrop-filter: blur(6px);
  transform: translateX(-50%);
  animation: banner-pop 480ms var(--ease-out-back, ease-out) both;
  pointer-events: none;
}

@keyframes banner-pop {
  0% {
    opacity: 0;
    transform: translateX(-50%) scale(0.72);
  }
  100% {
    opacity: 1;
    transform: translateX(-50%) scale(1);
  }
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
  background: radial-gradient(
    ellipse,
    color-mix(in srgb, var(--accent) 55%, white),
    transparent 70%
  );
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

/* 逐下受击僵直：脚本每下摘掉再挂回 flinch，保证动画每下都重播 */
.monster-unit.flinch img {
  animation: monster-flinch 190ms ease-out;
}

@keyframes monster-flinch {
  0% {
    filter: brightness(2) saturate(1.4) drop-shadow(0 9px 8px rgb(28 28 61 / 32%));
    transform: translateX(10px) rotate(2.5deg) scale(0.985);
  }
  100% {
    filter: brightness(1) drop-shadow(0 9px 8px rgb(28 28 61 / 32%));
    transform: translateX(0) rotate(0) scale(1);
  }
}

/* 击杀即倒地：收尾那下打出击杀立刻播放，不等到结算面板 */
.monster-unit.dying img {
  animation: monster-fall 560ms ease-in both;
}

.monster-unit.dying .monster-aura {
  animation: aura-fade 560ms ease-in both;
}

@keyframes monster-fall {
  0% {
    opacity: 1;
    filter: brightness(1.9) drop-shadow(0 9px 8px rgb(28 28 61 / 32%));
    transform: translateY(0) rotate(0);
  }
  35% {
    opacity: 1;
    filter: brightness(1.4) saturate(0.7) drop-shadow(0 9px 8px rgb(28 28 61 / 32%));
  }
  100% {
    opacity: 0.18;
    filter: grayscale(0.7) drop-shadow(0 4px 4px rgb(28 28 61 / 26%));
    transform: translateY(26px) rotate(9deg) scale(0.94);
  }
}

@keyframes aura-fade {
  to {
    opacity: 0;
  }
}

/* ── 着弹闪光 ── */
.burst-layer {
  position: absolute;
  inset: 0;
  z-index: 5;
  pointer-events: none;
}

.impact-flash {
  position: absolute;
  top: calc(30% + var(--burst-y, 0px));
  left: calc(42% + var(--burst-x, 0px));
  width: 66px;
  height: 66px;
  background: radial-gradient(circle, #fff 4%, var(--accent) 32%, transparent 68%);
  border-radius: 50%;
  mix-blend-mode: screen;
  transform: translate(-50%, -50%);
  animation: impact-pop 430ms ease-out both;
}

/* 收尾重击的光斑更大更金，和 ultimate 飘字一个信号体系 */
.impact-flash.tier-ultimate {
  width: 116px;
  height: 116px;
  background: radial-gradient(circle, #fff 6%, #ffd36b 30%, rgb(255 90 120 / 42%) 52%, transparent 72%);
}

@keyframes impact-pop {
  0% {
    opacity: 0;
    transform: translate(-50%, -50%) scale(0.28);
  }
  22% {
    opacity: 1;
    transform: translate(-50%, -50%) scale(1.08);
  }
  100% {
    opacity: 0;
    transform: translate(-50%, -50%) scale(1.55);
  }
}

/* ── 逐下飘字 ── */
.hit-layer {
  position: absolute;
  inset: 0;
  z-index: 6;
  pointer-events: none;
}

.hit-number {
  position: absolute;
  top: calc(22% - var(--hit-lift, 0px));
  left: 20%;
  font-weight: 900;
  font-size: 18px;
  color: #ffe9a8;
  white-space: nowrap;
  /* 深色四向描边替代白色泛光：亮背景上数字边缘利落，不再糊成一团 */
  text-shadow:
    1px 0 0 #7d2440,
    -1px 0 0 #7d2440,
    0 1px 0 #7d2440,
    0 -1px 0 #7d2440,
    0 2px 3px rgb(30 16 40 / 72%);
  transform: translateX(var(--hit-offset, 0));
  animation: damage-rise 780ms ease-out both;
}

/*
 * 收尾那下明显更大。挂机战斗那边验证过：
 * 玩家是扫视不是盯着看，字号差异才是一眼能读出「这下最重」的信号。
 */
.hit-number.tier-ultimate {
  font-size: 28px;
  color: #fff;
  text-shadow:
    1px 0 0 #a1123c,
    -1px 0 0 #a1123c,
    0 1px 0 #a1123c,
    0 -1px 0 #a1123c,
    0 2px 0 #d21f4c,
    0 0 14px #ffd36b,
    0 0 26px rgb(255 90 120 / 80%);
}

/* ── 打击反馈：与主线战斗共用 IMPACT_FEEDBACK 的强度表 ── */

/* 顿帧：只冻角色与怪物，飘字继续飞，否则像页面卡住而不是打击有分量 */
.battle-stage.is-hitstop .hero-unit,
.battle-stage.is-hitstop .hero-unit *,
.battle-stage.is-hitstop .monster-unit img,
.battle-stage.is-hitstop .monster-aura {
  animation-play-state: paused;
}

/*
 * 震屏：只抖交战双方，不抖 .battle-stage 本身。
 * 舞台的地图是 background 且带圆角与 overflow: hidden，
 * 抖它会让圆角边缘露出底下的缝。抖角色反而更准 ——
 * 观感上「被打的是人」而不是「镜头在晃」。
 */
.battle-stage[class*='shake-'] .combatants {
  animation: dungeon-shake var(--shake-ms, 220ms) var(--ease-ios, ease-out) both;
}

.battle-stage.shake-heavy {
  --shake-px: 3px;
  --shake-ms: 160ms;
}

.battle-stage.shake-critical {
  --shake-px: 5px;
  --shake-ms: 220ms;
}

.battle-stage.shake-ultimate {
  --shake-px: 8px;
  --shake-ms: 300ms;
}

/* 衰减式：第一下最重后迅速收敛，等幅抖动看起来像故障不像撞击 */
@keyframes dungeon-shake {
  0% {
    transform: translate3d(0, 0, 0);
  }
  15% {
    transform: translate3d(calc(var(--shake-px, 4px) * -1), calc(var(--shake-px, 4px) * 0.5), 0);
  }
  34% {
    transform: translate3d(calc(var(--shake-px, 4px) * 0.7), calc(var(--shake-px, 4px) * -0.4), 0);
  }
  56% {
    transform: translate3d(calc(var(--shake-px, 4px) * -0.42), 0, 0);
  }
  78% {
    transform: translate3d(calc(var(--shake-px, 4px) * 0.2), 0, 0);
  }
  100% {
    transform: translate3d(0, 0, 0);
  }
}

/* 飘字进出场：离场只淡出，位移交给 damage-rise，避免两个动画打架 */
.hit-float-leave-active {
  transition: opacity 0.2s ease;
}

.hit-float-leave-to {
  opacity: 0;
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

/* 连击计数：每打一下跳动一次（key 变化重播动画），给逐下演出一个计数锚点 */
.combo {
  padding: 2px 8px;
  font-size: 9px;
  font-weight: 900;
  color: #ffd36b;
  background: rgb(255 154 60 / 18%);
  border: 1px solid rgb(255 211 107 / 46%);
  border-radius: 999px;
  animation: combo-tick 220ms ease-out both;
}

@keyframes combo-tick {
  0% {
    transform: scale(1.35);
  }
  100% {
    transform: scale(1);
  }
}

.result-panel {
  display: grid;
  gap: 10px;
  padding: 12px;
}

.result-panel:focus {
  outline: none;
}

.result-panel:focus-visible {
  outline: 2px solid color-mix(in srgb, var(--q-rare) 58%, white);
  outline-offset: -2px;
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
    transform: translate(var(--hit-offset, 0), 8px) scale(0.7);
  }
  25% {
    opacity: 1;
  }
  to {
    opacity: 0;
    transform: translate(var(--hit-offset, 0), -34px) scale(1.08);
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

  .combatants {
    bottom: 58px;
  }

  .stage-footer {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    row-gap: 4px;
  }

  .stage-footer span:nth-child(even) {
    justify-self: end;
  }

  .fighting {
    margin-left: 0;
  }
}

/*
 * 无障碍兜底。
 *
 * 顿帧与震屏正是前庭敏感人群最难受的两类效果，这里彻底关掉而非减弱。
 * 飘字的字号分档保留 —— 那是静态信息不是动效，
 * 关掉反而让这些玩家失去判断哪一下最重的唯一线索。
 */
.battle-stage.reduced-motion
  :is(
    .hero-unit,
    .monster-unit,
    .clash-core,
    .hit-number,
    .impact-flash,
    .wave-banner,
    .combo,
    .monster-unit.flinch img,
    .monster-unit.dying img,
    .monster-unit.dying .monster-aura,
    .hero-vitals.lowhp b:not(.ghost)
  ) {
  animation: none !important;
  transition: none !important;
}

.battle-stage.reduced-motion .impact-flash {
  display: none;
}

.battle-stage.reduced-motion :is(.vitals b, .vitals b.ghost) {
  transition: none;
}

.battle-stage.reduced-motion.is-hitstop
  :is(.hero-unit, .hero-unit *, .monster-unit img, .monster-aura) {
  animation-play-state: running;
}

.battle-stage.reduced-motion[class*='shake-'] .combatants {
  animation: none !important;
}

@media (prefers-reduced-motion: reduce) {
  .hero-unit,
  .monster-unit,
  .clash-core,
  .hit-number,
  .impact-flash,
  .wave-banner,
  .combo,
  .monster-unit.flinch img,
  .monster-unit.dying img,
  .monster-unit.dying .monster-aura,
  .hero-vitals.lowhp b:not(.ghost) {
    animation: none !important;
    transition: none !important;
  }

  .impact-flash {
    display: none;
  }

  .vitals b,
  .vitals b.ghost {
    transition: none;
  }

  .battle-stage.is-hitstop .hero-unit,
  .battle-stage.is-hitstop .hero-unit *,
  .battle-stage.is-hitstop .monster-unit img,
  .battle-stage.is-hitstop .monster-aura {
    animation-play-state: running;
  }

  .battle-stage[class*='shake-'] .combatants {
    animation: none !important;
  }
}
</style>
