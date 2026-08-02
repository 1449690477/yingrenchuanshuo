<script setup lang="ts">
import { computed, onUnmounted, ref, watch } from 'vue';
import type { ClassId, Element, MonsterDef } from '@/core/types';
import type { BattleVitals } from '@/core/battleVisual';
import {
  advanceBattleBeatGate,
  createBattleBeatGateState,
  type BattleBeat,
  type BattleBeatGateMode,
} from '@/core/battleRhythm';
import { abbr } from '@/core/format';
import {
  BASIC_ATTACK_EFFECTS,
  resolveCharacterAppearance,
  type CharacterAction,
  type EquippedRecord,
} from '@/data/characterAppearance';
import {
  basicBattleAction,
  CLASS_BATTLE_MOTIONS,
  impactTierFor,
  latestSourceBeat,
  monsterActionFor,
  requireImpactFeedback,
  requireMonsterMotionTiming,
  shouldPlayMonsterSpawn,
  type ImpactTier,
  type MonsterAction,
} from '@/data/battleMotions';
import { requireMonsterVisual } from '@/data/monsterVisuals';
import { battleRhythmSkills, type ActiveVisualSkill } from '@/data/skills';
import { useGameStore } from '@/stores/game';
import AutoSkillDeck from '@/components/AutoSkillDeck.vue';
import CharacterAppearance from '@/components/CharacterAppearance.vue';
import MonsterArtwork from '@/components/MonsterArtwork.vue';
import ElementGaugeBadge from '@/components/ElementGaugeBadge.vue';
import { elementMatchupPresentation } from '@/ui/elementMatchupPresentation';

const props = defineProps<{
  classId: ClassId;
  level: number;
  equipped: EquippedRecord | null;
  /** 玩家当前武器元素（批 1 感知层：克制飘字与印记徽章用；缺省按无属性） */
  playerElement?: Element;
  playerName: string;
  monster: MonsterDef;
  supportMonsters: MonsterDef[];
  backgroundUrl: string;
  active: boolean;
  vitals: BattleVitals;
  statusText: string;
  progressText: string;
  /** 当前关卡波次进度（0-1）；通关后不传。 */
  waveRatio?: number;
  pulse: { id: number; targetId: string; damage: number; kills: number } | null;
  drop: { id: number; name: string; quality: string; assetUrl: string } | null;
  /** 持续战斗演出的拍子流，见 core/battleRhythm */
  beats: BattleBeat[];
  /** 游戏内减弱动效设置；与系统 prefers-reduced-motion 共同生效。 */
  reduceMotion?: boolean;
}>();

const game = useGameStore();
const reduceMotionEnabled = computed(() =>
  Boolean(props.reduceMotion || game.save?.settings.reduceMotion),
);
const basicEffectUrl = computed(
  () => `${import.meta.env.BASE_URL}${BASIC_ATTACK_EFFECTS[props.classId]}`,
);
const equippedBasicEffectUrl = computed(() => {
  const effectAsset = resolveCharacterAppearance(
    props.classId,
    props.level,
    props.equipped,
  ).boutiqueEffectAsset;
  return effectAsset ? `${import.meta.env.BASE_URL}${effectAsset}` : basicEffectUrl.value;
});
const monsterMotionTiming = computed(() =>
  requireMonsterMotionTiming(requireMonsterVisual(props.monster.id).motion),
);
const monsterImpactDelay = computed(() => monsterMotionTiming.value.impactMs);

// ────────────────────────────────────────────────────────────
// 持续战斗演出
//
// 早先所有动画都挂在 pulse（击杀）上，而击杀可能好几秒才一次，
// 中间画面完全静止 —— 只有血条在掉。现在改由 core/battleRhythm
// 产生的拍子驱动：角色按攻速持续挥砍、技能按冷却轮转、怪物持续反击。
// ────────────────────────────────────────────────────────────

/** 一拍演出在屏幕上存活多久（毫秒） */
const BEAT_LIFE_MS = 980;
/** 同屏最多几个飘字，防止高攻速时糊成一片 */
const MAX_LIVE_BEATS = 6;

interface LiveBeat {
  /** UI 唯一序号；多段技能由原始拍子序号扩展而来。 */
  seq: number;
  /** core/battleRhythm 产生的原始拍子序号；一整套多段动作只重播一次。 */
  sourceSeq: number;
  kind: BattleBeat['kind'];
  crit: boolean;
  damage: number;
  skillId: string | null;
  /** 飘字的横向偏移，避免多个数字完全重叠 */
  offset: number;
  /** 打击强度档位，决定飘字字号与配色 */
  tier: ImpactTier;
  /** 元素克制短标签（批 1 感知层；怪物攻击不显示） */
  tag: string;
}

const liveBeats = ref<LiveBeat[]>([]);
const highestPlayerSourceSeq = ref(0);
const monsterAttackSeq = ref<number | null>(null);
const monsterHitSeq = ref<number | null>(null);
const spawning = ref(false);
const timers = new Map<number, number>();
const queuedTimers = new Set<number>();
let beatGateState = createBattleBeatGateState();
let monsterAttackTimer = 0;
let monsterHitTimer = 0;
let spawnTimer = 0;

// ── 打击反馈（见 data/battleMotions 的 IMPACT_FEEDBACK）──
//
// 顿帧与震屏都只加 class、只写 CSS 变量，真正生效与否由 CSS 决定。
// 这样 prefers-reduced-motion 在样式里一处关掉就全关，
// 不需要在 JS 里再判一次，也不会出现「JS 以为在震、CSS 其实没震」的错位。
/** 顿帧中：命中瞬间把双方动画冻住，这是「打到了」最主要的来源 */
const hitstop = ref(false);
/** 当前震屏档位；null 表示不震 */
const shakeTier = ref<ImpactTier | null>(null);
/** 每次震屏换一个 key，让同一档位的连续命中也能重新触发动画 */
const shakeSeq = ref(0);
let hitstopTimer = 0;
let shakeTimer = 0;

/**
 * 角色受击姿势。
 *
 * 触发点选在「伤害真正落地」而不是「怪物开始出手」——
 * 怪物的挥击动作有 500~780ms，玩家要是一开始就摆出挨打的姿势，
 * 看起来像是被吓到而不是被打到。真正的命中时刻由 impactMs 对齐。
 */
const heroReacting = ref(false);
const heroReactSeq = ref(0);
let heroReactTimer = 0;

function triggerHeroReact(): void {
  heroReacting.value = true;
  heroReactSeq.value++;
  clearTimeout(heroReactTimer);
  heroReactTimer = window.setTimeout(() => {
    heroReacting.value = false;
  }, CLASS_BATTLE_MOTIONS[props.classId].reactMs);
}

function triggerImpact(kind: BattleBeat['kind'], crit: boolean): void {
  if (reduceMotionEnabled.value) return;
  const feedback = requireImpactFeedback(impactTierFor({ kind, crit }));

  if (feedback.hitstopMs > 0) {
    hitstop.value = true;
    clearTimeout(hitstopTimer);
    hitstopTimer = window.setTimeout(() => {
      hitstop.value = false;
    }, feedback.hitstopMs);
  }

  if (feedback.shakePx > 0) {
    shakeSeq.value++;
    shakeTier.value = impactTierFor({ kind, crit });
    clearTimeout(shakeTimer);
    shakeTimer = window.setTimeout(() => {
      shakeTier.value = null;
    }, feedback.shakeMs);
  }
}

function currentBeatGateMode(): BattleBeatGateMode {
  if (props.pulse) return 'pulse';
  if (spawning.value) return 'spawn';
  return 'active';
}

function consumeBeatGate(mode = currentBeatGateMode()): void {
  const advance = advanceBattleBeatGate(beatGateState, props.beats, mode);
  beatGateState = advance.state;
  if (advance.reset || mode !== 'active') clearAllBeats();
  for (const beat of advance.consume) addLiveBeat(beat);
}

watch(
  () => props.beats,
  () => consumeBeatGate(),
  { deep: false },
);

watch(
  () => props.classId,
  () => {
    beatGateState = createBattleBeatGateState();
    clearAllBeats();
  },
);

watch(reduceMotionEnabled, (enabled) => {
  if (!enabled) return;
  clearTimeout(hitstopTimer);
  clearTimeout(shakeTimer);
  hitstop.value = false;
  shakeTier.value = null;
});

function addLiveBeat(beat: BattleBeat): void {
  const beatSkill = beat.kind === 'player-skill' ? requireRhythmSkill(beat.skillId) : null;
  if (beat.kind === 'monster-attack') {
    triggerMonsterAttack(beat.seq);
  } else {
    highestPlayerSourceSeq.value = Math.max(highestPlayerSourceSeq.value, beat.seq);
  }
  const offsets: readonly number[] =
    beat.kind === 'monster-attack'
      ? [monsterImpactDelay.value]
      : beatSkill && beatSkill.hitOffsetsMs.length > 0
        ? beatSkill.hitOffsetsMs
        : [0];
  const damagePerHit = Math.max(1, Math.round(beat.damage / offsets.length));

  offsets.forEach((delayMs, hitIndex) => {
    const visualSeq = beat.seq * 100 + hitIndex;
    const append = () => appendLiveBeat(beat, visualSeq, damagePerHit);
    if (delayMs <= 0) {
      append();
      return;
    }
    const timerId = window.setTimeout(() => {
      queuedTimers.delete(timerId);
      append();
    }, delayMs);
    queuedTimers.add(timerId);
  });
}

function appendLiveBeat(beat: BattleBeat, visualSeq: number, damage: number): void {
  if (beat.kind !== 'monster-attack') triggerMonsterHit(visualSeq);
  else triggerHeroReact();
  // 这里是所有命中的唯一汇合点 —— 打击反馈挂在这，多段技能的每一段都能各自震一下
  triggerImpact(beat.kind, beat.crit);
  liveBeats.value.push({
    seq: visualSeq,
    sourceSeq: beat.seq,
    kind: beat.kind,
    crit: beat.crit,
    damage,
    skillId: beat.skillId,
    // 用序号做伪随机偏移，无需引入随机源，且同一拍每次渲染位置稳定
    offset: ((visualSeq * 37) % 46) - 23,
    tier: impactTierFor({ kind: beat.kind, crit: beat.crit }),
    tag: beat.kind === 'monster-attack' ? '' : matchupTag.value,
  });
  if (liveBeats.value.length > MAX_LIVE_BEATS) {
    const dropped = liveBeats.value.shift();
    if (dropped) clearBeatTimer(dropped.seq);
  }
  const id = window.setTimeout(() => removeLiveBeat(visualSeq), BEAT_LIFE_MS);
  timers.set(visualSeq, id);
}

/**
 * 批 1 感知层：玩家武器元素 vs 当前怪物的克制短标签。
 * 飘字与徽章共用同一来源（elementMatchupPresentation），不另写一套三角关系。
 */
const matchupTag = computed(() => {
  if (props.playerElement === undefined || props.playerElement === 'none') return '';
  if (props.monster.element === 'none') return '';
  return elementMatchupPresentation(props.playerElement, props.monster.element).hitTag;
});

function removeLiveBeat(seq: number): void {
  liveBeats.value = liveBeats.value.filter((b) => b.seq !== seq);
  clearBeatTimer(seq);
}

function clearBeatTimer(seq: number): void {
  const id = timers.get(seq);
  if (id !== undefined) {
    clearTimeout(id);
    timers.delete(seq);
  }
}

function triggerMonsterAttack(seq: number): void {
  monsterAttackSeq.value = seq;
  clearTimeout(monsterAttackTimer);
  monsterAttackTimer = window.setTimeout(() => {
    if (monsterAttackSeq.value === seq) monsterAttackSeq.value = null;
  }, monsterMotionTiming.value.attackMs);
}

function triggerMonsterHit(seq: number): void {
  monsterHitSeq.value = seq;
  clearTimeout(monsterHitTimer);
  monsterHitTimer = window.setTimeout(() => {
    if (monsterHitSeq.value === seq) monsterHitSeq.value = null;
  }, monsterMotionTiming.value.hitMs);
}

function clearActionCues(): void {
  clearTimeout(monsterAttackTimer);
  clearTimeout(monsterHitTimer);
  monsterAttackTimer = 0;
  monsterHitTimer = 0;
  highestPlayerSourceSeq.value = 0;
  monsterAttackSeq.value = null;
  monsterHitSeq.value = null;
}

function clearAllBeats(): void {
  for (const id of timers.values()) clearTimeout(id);
  for (const id of queuedTimers) clearTimeout(id);
  timers.clear();
  queuedTimers.clear();
  liveBeats.value = [];
  clearActionCues();
}

/** 玩家出手的拍子（普攻或技能） */
const playerBeats = computed(() => liveBeats.value.filter((b) => b.kind !== 'monster-attack'));

/** 最近一次玩家出手，决定角色摆什么动作 */
const latestPlayerBeat = computed(() =>
  latestSourceBeat(playerBeats.value, highestPlayerSourceSeq.value),
);

/**
 * 与 core/battleRhythm 使用完全相同的主动技能集合。
 * 拍子保存稳定 skillId，新增或重新排序技能配置也不会把动作串给另一张卡。
 */
const rhythmSkills = computed<readonly ActiveVisualSkill[]>(() =>
  battleRhythmSkills(props.classId, props.level),
);
const rhythmSkillsById = computed(
  () => new Map(rhythmSkills.value.map((skill) => [skill.id, skill])),
);

function skillForBeat(beat: LiveBeat): ActiveVisualSkill | null {
  if (beat.kind !== 'player-skill') return null;
  return requireRhythmSkill(beat.skillId);
}

function requireRhythmSkill(skillId: string | null): ActiveVisualSkill {
  if (!skillId) {
    throw new Error(`[战斗演出] 技能拍缺少稳定 ID：${String(skillId)}`);
  }
  const skill = rhythmSkillsById.value.get(skillId);
  if (!skill) {
    throw new Error(`[战斗演出] 技能拍引用了当前职业未登记的技能：${skillId}`);
  }
  return skill;
}

function effectUrlForBeat(beat: LiveBeat): string {
  const beatSkill = skillForBeat(beat);
  return beatSkill
    ? `${import.meta.env.BASE_URL}${beatSkill.effectAsset}`
    : equippedBasicEffectUrl.value;
}

const latestRhythmSkill = computed(() => {
  const beat = latestPlayerBeat.value;
  return beat ? skillForBeat(beat) : null;
});

/**
 * 角色动作。
 * 技能动作来自唯一的冷却拍子流；击杀脉冲只负责受击与掉落，不再另选技能。
 */
const heroAction = computed<CharacterAction>(() => {
  if (spawning.value) return 'idle';
  // 精英与 BOSS 被击倒才摆胜利姿势。小怪一秒能杀好几只，
  // 每只都庆祝的话，1.3 秒的收势动作会把整场战斗淹没。
  if (props.pulse) return props.monster.type === 'normal' ? 'idle' : 'victory';
  const beat = latestPlayerBeat.value;
  // 技能永远不被打断 —— 玩家自己放的大招被怪物一下顶掉，手感最差。
  // 普攻则让位给受击，这样「挨打」在画面上读得出来。
  if (latestRhythmSkill.value) return latestRhythmSkill.value.characterAction;
  if (heroReacting.value) return 'react';
  if (beat) return basicBattleAction(props.classId, beat.sourceSeq);
  return 'idle';
});

/**
 * 角色立绘的重挂 key。
 * 每次出手都换 key，让 CharacterAppearance 重新播放一次动作，
 * 否则连续攻击时立绘只会在第一次动一下。
 */
const heroActorKey = computed(() => {
  // 受击与胜利也要换 key，否则连续挨打时立绘只在第一次动一下
  if (props.pulse && props.monster.type !== 'normal') return `win:${props.pulse.id}`;
  if (heroReacting.value) return `react:${heroReactSeq.value}`;
  return `beat:${latestPlayerBeat.value?.sourceSeq ?? 0}`;
});

/**
 * 怪物动作优先级：
 * 击倒 > 怪物出手 > 玩家命中 > 待机。
 * pulse 存活的 0.72 秒始终展示被击倒的旧目标，禁止“尸体继续反击”。
 */
const enemyAction = computed<MonsterAction>(() => {
  return monsterActionFor({
    defeated: props.pulse !== null,
    attacking: monsterAttackSeq.value !== null,
    hit: monsterHitSeq.value !== null,
  });
});
const enemyActorKey = computed(() => {
  if (props.pulse) return `${props.monster.id}:defeat:${props.pulse.id}`;
  if (enemyAction.value === 'attack') {
    return `${props.monster.id}:attack:${monsterAttackSeq.value!}`;
  }
  if (enemyAction.value === 'hit') {
    return `${props.monster.id}:hit:${monsterHitSeq.value!}`;
  }
  return `${props.monster.id}:idle`;
});
/** 玩家正在挨打 */
const heroHurt = computed(() => !props.pulse && !spawning.value && monsterAttackSeq.value !== null);
const heroUnitKey = computed(() => (heroHurt.value ? `hurt:${monsterAttackSeq.value!}` : 'ready'));

onUnmounted(() => {
  clearAllBeats();
});
const playerHpPercent = computed(
  () => (props.vitals.player.currentHp / props.vitals.player.maxHp) * 100,
);
const monsterHpPercent = computed(
  () => (props.vitals.monster.currentHp / props.vitals.monster.maxHp) * 100,
);

/**
 * 目标切换（新怪物上场）时播一次入场动画。
 * 与受击动画分开：受击作用在立绘上，入场作用在整个怪物单元上，互不冲突。
 */
function playSpawn(): void {
  spawning.value = true;
  clearTimeout(spawnTimer);
  spawnTimer = window.setTimeout(() => {
    spawning.value = false;
    // 入场期间没有制造假动作；这里一次性消费真正由 rhythm 产生并缓存的新拍。
    consumeBeatGate('active');
  }, 480);
}

watch(
  [() => props.monster.id, () => props.pulse?.id ?? 0],
  ([monsterId, pulseId], [previousMonsterId, previousPulseId]) => {
    if (pulseId > 0 && pulseId !== previousPulseId) {
      clearAllBeats();
      return;
    }
    if (
      shouldPlayMonsterSpawn(
        { monsterId, pulseId },
        { monsterId: previousMonsterId, pulseId: previousPulseId },
      )
    ) {
      clearAllBeats();
      playSpawn();
    }
  },
);

onUnmounted(() => {
  clearTimeout(spawnTimer);
  clearTimeout(hitstopTimer);
  clearTimeout(shakeTimer);
  clearTimeout(heroReactTimer);
});
</script>

<template>
  <section class="battle-performance">
    <div
      class="battle-scene"
      :class="[
        `target-${monster.type}`,
        shakeTier ? `shake-${shakeTier}` : null,
        {
          active,
          casting: heroAction === 'cast',
          'hero-catkin': classId === 'catkin',
          'player-low': playerHpPercent <= 25,
          'is-hitstop': hitstop,
          'reduced-motion': reduceMotionEnabled,
        },
      ]"
      :style="{
        '--impact-delay': latestRhythmSkill ? '300ms' : '110ms',
        '--monster-impact-delay': `${monsterImpactDelay}ms`,
        '--shake-key': shakeSeq,
      }"
      :aria-label="`${playerName}正在与${monster.name}战斗`"
    >
      <Transition name="bg-fade">
        <img
          :key="backgroundUrl"
          class="scene-background"
          :src="backgroundUrl"
          alt=""
          aria-hidden="true"
        />
      </Transition>
      <span class="scene-haze" aria-hidden="true" />
      <span class="scene-glow" aria-hidden="true" />

      <div class="ambient-particles" aria-hidden="true">
        <i v-for="n in 9" :key="n" />
      </div>

      <div class="battle-status">
        <span class="status-dot" />
        <span>{{ statusText }}</span>
        <strong class="num">{{ progressText }}</strong>
        <span v-if="waveRatio !== undefined" class="wave-track" aria-hidden="true">
          <i :style="{ transform: `scaleX(${Math.min(1, Math.max(0, waveRatio))})` }" />
        </span>
      </div>

      <div class="enemy-hud">
        <div class="enemy-line">
          <span v-if="monster.type !== 'normal'" class="enemy-rank">
            {{ monster.type === 'boss' ? 'BOSS' : '精英' }}
          </span>
          <strong>{{ monster.name }}</strong>
          <span class="num">Lv.{{ monster.level }}</span>
        </div>
        <div class="hp-readout">
          <span>生命</span>
          <strong class="num">
            {{ abbr(vitals.monster.currentHp) }} / {{ abbr(vitals.monster.maxHp) }}
          </strong>
        </div>
        <div
          class="hpbar"
          :class="{ low: monsterHpPercent <= 25 }"
          role="meter"
          aria-label="目标生命"
          aria-valuemin="0"
          :aria-valuemax="vitals.monster.maxHp"
          :aria-valuenow="vitals.monster.currentHp"
          :aria-valuetext="`${vitals.monster.currentHp} / ${vitals.monster.maxHp}`"
        >
          <span class="hp-ghost" :style="{ width: `${monsterHpPercent}%` }" />
          <span class="hpbar-fill" :style="{ width: `${monsterHpPercent}%` }" />
          <span class="hp-shine" />
        </div>
      </div>

      <div class="hero-hud">
        <div class="hp-readout hero-hp-line">
          <strong>{{ playerName }}</strong>
          <span class="num">
            {{ abbr(vitals.player.currentHp) }} / {{ abbr(vitals.player.maxHp) }}
          </span>
        </div>
        <div
          class="hpbar hero-hpbar"
          :class="{ low: playerHpPercent <= 25 }"
          role="meter"
          aria-label="玩家生命"
          aria-valuemin="0"
          :aria-valuemax="vitals.player.maxHp"
          :aria-valuenow="vitals.player.currentHp"
          :aria-valuetext="`${vitals.player.currentHp} / ${vitals.player.maxHp}`"
        >
          <span class="hp-ghost" :style="{ width: `${playerHpPercent}%` }" />
          <span class="hpbar-fill" :style="{ width: `${playerHpPercent}%` }" />
          <span class="hp-shine" />
        </div>
      </div>

      <div :key="heroUnitKey" class="hero-unit" :class="{ hurt: heroHurt }">
        <span class="actor-shadow" aria-hidden="true" />
        <div class="hero-actor">
          <CharacterAppearance
            :key="heroActorKey"
            :class-id="classId"
            :level="level"
            :equipped="equipped"
            variant="battle"
            :action="heroAction"
            :reduce-motion="reduceMotionEnabled"
          />
        </div>
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

      <div
        :key="`${monster.id}:${pulse?.id ?? 'active'}`"
        class="enemy-unit"
        :class="{ spawn: spawning }"
      >
        <span class="actor-shadow" aria-hidden="true" />
        <div class="enemy-actor">
          <MonsterArtwork
            :key="enemyActorKey"
            :monster="monster"
            :action="enemyAction"
            :awakening="spawning"
          />
        </div>
        <span class="actor-name enemy-name">{{ monster.name }}</span>
        <ElementGaugeBadge
          class="enemy-gauge-badge"
          :monster-element="monster.element"
          :player-element="playerElement ?? 'none'"
        />
      </div>

      <span v-if="pulse" :key="pulse.id" class="damage num">
        -{{ abbr(pulse.damage) }}
        <small v-if="pulse.kills > 1">×{{ pulse.kills }}</small>
      </span>

      <!-- 持续战斗飘字：每一拍一个数字，暴击更大更亮 -->
      <TransitionGroup name="beat-float" tag="div" class="beat-layer" aria-hidden="true">
        <span
          v-for="b in liveBeats"
          :key="b.seq"
          class="beat-damage num"
          :class="[
            b.kind === 'monster-attack' ? 'to-hero' : 'to-enemy',
            `tier-${b.tier}`,
            { crit: b.crit },
          ]"
          :style="{ '--beat-offset': b.offset + 'px' }"
        >
          <template v-if="b.kind === 'monster-attack'">-{{ abbr(b.damage) }}</template>
          <template v-else>{{ b.crit ? '暴击 ' : '' }}-{{ abbr(b.damage) }}</template>
          <small v-if="b.tag" class="beat-tag">{{ b.tag }}</small>
        </span>
      </TransitionGroup>

      <!-- 持续普攻特效：每次玩家出手闪一次 -->
      <TransitionGroup name="swing" tag="div" class="swing-layer" aria-hidden="true">
        <div
          v-for="b in playerBeats"
          :key="b.seq"
          class="swing-fx"
          :class="[
            `swing-${classId}`,
            skillForBeat(b) ? `kind-${skillForBeat(b)!.visualKind}` : 'kind-basic',
            { 'is-skill': b.kind === 'player-skill', crit: b.crit },
          ]"
        >
          <img :src="effectUrlForBeat(b)" alt="" draggable="false" />
        </div>
      </TransitionGroup>

      <div
        v-if="drop"
        :key="`drop-${drop.id}`"
        class="loot-burst"
        :class="`drop-${drop.quality}`"
        aria-hidden="true"
      >
        <span class="loot-ring" />
        <span class="loot-orb">
          <img :src="drop.assetUrl" alt="" draggable="false" />
        </span>
        <strong>{{ drop.name }}</strong>
        <i v-for="n in 6" :key="n" />
      </div>

      <span class="foreground-vignette" aria-hidden="true" />
    </div>

    <AutoSkillDeck
      v-if="game.battleRhythmSnapshot"
      :class-id="classId"
      :level="level"
      :active="active"
      :snapshot="game.battleRhythmSnapshot"
      :reduce-motion="reduceMotionEnabled"
      :haptics-enabled="game.save?.settings.haptics ?? false"
    />
  </section>
</template>

<style scoped>
.battle-performance {
  width: 100%;
}

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

/*
 * 矮屏手机把战场压扁一档：3:2 → 16:9.6。
 * 角色与特效全部按百分比定位，扁一点不穿帮，
 * 省下的 60+px 正好让掉落速览挤进首屏。
 */
@media (max-height: 740px) {
  .battle-scene {
    aspect-ratio: 16 / 9.6;
    min-height: 178px;
  }
}

@media (max-width: 350px) {
  .battle-scene {
    min-height: 164px;
  }
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

/* 极慢的背景漂移让战场保持活力，同时不会干扰角色和技能演出。 */
.active .scene-background {
  animation: bg-drift 26s ease-in-out infinite alternate;
}

/* 玩家濒危时以边缘红晕提醒，避免遮挡战斗主体。 */
.player-low::after {
  position: absolute;
  z-index: 30;
  inset: 0;
  content: '';
  border-radius: inherit;
  box-shadow: inset 0 0 26px 4px rgb(255 90 110 / 42%);
  pointer-events: none;
  animation: danger-vignette 1.1s ease-in-out infinite;
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
.hero-hud,
.actor-name {
  text-shadow: 0 1px 3px rgb(24 31 44 / 82%);
  backdrop-filter: blur(9px) saturate(1.45);
  -webkit-backdrop-filter: blur(9px) saturate(1.45);
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
  padding: 5px 9px;
  font-size: 10px;
  line-height: 1.1;
  background: rgb(24 37 55 / 46%);
  border: 1px solid rgb(255 255 255 / 20%);
  border-radius: 12px;
  box-shadow:
    inset 0 1px 0 rgb(255 255 255 / 14%),
    0 4px 12px rgb(25 33 47 / 20%);
}

.battle-status strong {
  grid-column: 1 / -1;
  padding-left: 11px;
  font-size: 9px;
  color: #fff5c7;
}

.wave-track {
  grid-column: 1 / -1;
  display: block;
  height: 3px;
  margin-top: 2px;
  overflow: hidden;
  background: rgb(255 255 255 / 24%);
  border-radius: 999px;
}

.wave-track i {
  position: relative;
  display: block;
  width: 100%;
  height: 100%;
  background: linear-gradient(90deg, #ffc2d9, #ffe596, #9fd8f7);
  border-radius: inherit;
  box-shadow: 0 0 5px rgb(255 194 217 / 70%);
  transform-origin: left center;
  transition: transform 0.45s var(--ease-soft);
}

/* 进度前端的发光引导点，像 Apple Watch 活动环的端点。 */
.wave-track i::after {
  position: absolute;
  top: 50%;
  right: -1px;
  width: 5px;
  height: 5px;
  content: '';
  background: #fff;
  border-radius: 50%;
  box-shadow: 0 0 6px 2px rgb(255 235 245 / 85%);
  transform: translateY(-50%);
}

.bg-fade-enter-from,
.bg-fade-leave-to {
  opacity: 0;
}

.bg-fade-enter-active,
.bg-fade-leave-active {
  transition: opacity 0.5s var(--ease-soft);
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
  padding: 6px 8px 7px;
  background: rgb(24 34 52 / 48%);
  border: 1px solid rgb(255 255 255 / 20%);
  border-radius: 12px;
  box-shadow:
    inset 0 1px 0 rgb(255 255 255 / 14%),
    0 4px 12px rgb(25 33 47 / 20%);
}

.hero-hud {
  position: absolute;
  z-index: 12;
  bottom: 9px;
  left: 9px;
  width: min(42%, 148px);
  padding: 6px 8px 7px;
  background: rgb(24 34 52 / 48%);
  border: 1px solid rgb(255 255 255 / 20%);
  border-radius: 12px;
  box-shadow:
    inset 0 1px 0 rgb(255 255 255 / 14%),
    0 4px 12px rgb(25 33 47 / 20%);
}

.enemy-line {
  display: flex;
  align-items: center;
  gap: 4px;
  min-width: 0;
  margin-bottom: 4px;
  font-size: 10px;
}

.hp-readout {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 5px;
  min-width: 0;
  margin-bottom: 3px;
  font-size: 7px;
  color: rgb(255 255 255 / 74%);
}

.hp-readout strong {
  overflow: hidden;
  font-size: 8px;
  color: #fff;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.hero-hp-line {
  font-size: 7px;
}

.hero-hp-line > .num {
  flex-shrink: 0;
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
  height: 5px;
  overflow: hidden;
  background: rgb(15 21 32 / 52%);
  border: 1px solid rgb(255 255 255 / 24%);
  border-radius: 999px;
}

/* 幽灵拖尾：受击时白色残条延迟消退，伤害读起来更有份量（纯 CSS 双填充）。 */
.hp-ghost {
  position: absolute;
  top: 0;
  bottom: 0;
  left: 0;
  background: rgb(255 255 255 / 62%);
  border-radius: inherit;
  transition: width 0.72s var(--ease-ios) 0.3s;
}

.hpbar-fill {
  position: relative;
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

.hero-hpbar .hpbar-fill,
.target-elite .hero-hpbar .hpbar-fill,
.target-boss .hero-hpbar .hpbar-fill {
  background: linear-gradient(90deg, #54d6a0, #a1f0c8);
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

.battle-scene.hero-catkin .hero-unit {
  /* 猫科动作有横向空翻包围盒，整体右移给尾巴与后撤动作留安全边。 */
  left: 8%;
}

.hero-actor {
  position: absolute;
  inset: 0 0 6px;
  filter: drop-shadow(0 5px 4px rgb(29 35 51 / 28%));
  transform-origin: 50% 92%;
}

.hero-actor :deep(.boutique-effect) {
  /* 主挂机命中特效由 swing-layer 放到怪物身上，避免角色中心重复炸一次。 */
  display: none;
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

/* 新怪物从右侧轻轻弹入 */
.enemy-unit.spawn {
  animation: enemy-spawn 0.44s var(--ease-out-back) both;
}

/* 低血量警报：血条外发光脉冲 */
.hpbar.low .hpbar-fill {
  animation: hp-low-pulse 0.9s ease-in-out infinite;
}

.hero-actor :deep(.class-art),
.enemy-actor :deep(.monster-art),
.support-unit :deep(.monster-art) {
  width: 100%;
  height: 100%;
}

/*
 * 纵深陪衬怪的空气透视。
 *
 * 原本靠 opacity: 0.68 压远，问题是**背景会从怪物身体里透出来**——
 * 读起来是「半透明的残影」，不是「站在远处的敌人」。
 * 真实的空气透视靠的是三件事，没有一件是透明度：
 *   失焦（景深）、失对比（雾气冲淡明暗）、提亮偏冷（大气散射）。
 *
 * 所以这里几乎保持不透明，只用 filter 做雾化。
 * 远的那只（support-2）三项都更重一档，前后关系自然拉开。
 */
.support-unit {
  z-index: 3;
  width: 19%;
  height: 29%;
  opacity: 0.94;
  filter: blur(0.7px) saturate(0.62) contrast(0.84) brightness(1.12);
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

  /* 站得更远：雾更重、更糊、对比更低，但依然是实体不是残影 */
  opacity: 0.88;
  filter: blur(1.3px) saturate(0.48) contrast(0.76) brightness(1.2);
  animation: support-bob 2.8s 0.35s ease-in-out infinite;
}

.actor-name {
  position: absolute;
  bottom: -1px;
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

.enemy-name {
  right: 8px;
}

.damage {
  position: absolute;
  z-index: 14;
  top: 35%;
  right: 18%;
  font-size: 21px;
  font-weight: 900;
  letter-spacing: -0.02em;
  color: #fff4bc;
  text-shadow:
    0 2px 0 #bd4d59,
    0 0 10px rgb(255 105 137 / 80%),
    0 4px 14px rgb(120 40 70 / 35%);
  pointer-events: none;
  animation: damage-pop 0.82s var(--ease-ios) both;
  animation-delay: var(--impact-delay);
}

.damage small {
  font-size: 11px;
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
  animation: basic-impact 0.58s ease-out both;
  animation-delay: 70ms;
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

.basic-catkin {
  right: 15%;
  bottom: 20%;
  width: 43%;
  transform: rotate(-5deg);
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

.drop-prismatic {
  --loot-color: var(--q-prismatic);
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

/* 掉落出生时的扩散光环，强化“爆装备”的获得感。 */
.loot-ring {
  position: absolute;
  left: 50%;
  top: 17px;
  width: 34px;
  height: 34px;
  border: 2px solid var(--loot-color);
  border-radius: 50%;
  opacity: 0;
  pointer-events: none;
  transform: translate(-50%, -50%) scale(0.5);
  animation: loot-ring-expand 0.72s var(--ease-ios) both;
}

@keyframes loot-ring-expand {
  0% {
    opacity: 0.9;
    transform: translate(-50%, -50%) scale(0.5);
  }
  100% {
    opacity: 0;
    transform: translate(-50%, -50%) scale(2.4);
  }
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

@keyframes enemy-spawn {
  0% {
    opacity: 0;
    transform: translateX(26px) scale(0.86);
  }
  100% {
    opacity: 1;
    transform: translateX(0) scale(1);
  }
}

@keyframes bg-drift {
  0% {
    transform: scale(1.03) translate(0.4%, 0.3%);
  }
  100% {
    transform: scale(1.08) translate(-0.7%, -0.5%);
  }
}

@keyframes danger-vignette {
  0%,
  100% {
    opacity: 0.35;
  }
  50% {
    opacity: 1;
  }
}

@keyframes hp-low-pulse {
  0%,
  100% {
    filter: brightness(1);
    box-shadow: 0 0 0 rgb(255 107 122 / 0%);
  }
  50% {
    filter: brightness(1.35) saturate(1.3);
    box-shadow: 0 0 8px rgb(255 107 122 / 85%);
  }
}

@keyframes basic-impact {
  0% {
    opacity: 0;
    transform: translate(-18px, 10px) scale(0.28) rotate(-14deg);
  }
  34%,
  58% {
    opacity: 1;
  }
  100% {
    opacity: 0;
    transform: translate(7px, -3px) scale(1.05) rotate(4deg);
  }
}

@keyframes damage-pop {
  0% {
    opacity: 0;
    transform: translateY(14px) scale(0.5);
  }
  18% {
    opacity: 1;
    transform: translateY(-2px) scale(1.22);
  }
  32%,
  55% {
    opacity: 1;
    transform: translateY(0) scale(1);
  }
  100% {
    opacity: 0;
    transform: translateY(-26px) scale(1.06);
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

.battle-scene.reduced-motion
  :is(
    .hero-actor,
    .enemy-actor,
    .enemy-unit,
    .hpbar.low .hpbar-fill,
    .scene-background,
    .support-unit,
    .ambient-particles i,
    .loot-burst,
    .loot-burst i,
    .loot-ring,
    .hero-unit.hurt
  ) {
  animation: none !important;
  transition: none !important;
}

.battle-scene.reduced-motion.player-low::after {
  animation: none !important;
}

.battle-scene.reduced-motion :is(.ambient-particles, .swing-layer, .loot-burst i, .loot-ring) {
  display: none;
}

.battle-scene.reduced-motion :is(.wave-track i, .hp-ghost) {
  transition: none !important;
}

.battle-scene.reduced-motion :deep(.monster-art),
.battle-scene.reduced-motion :deep(.monster-art *) {
  animation: none !important;
  transition: none !important;
}

.battle-scene.reduced-motion.is-hitstop :is(.hero-unit, .hero-unit *, .enemy-unit, .enemy-unit *) {
  animation-play-state: running;
}

.battle-scene.reduced-motion[class*='shake-'] :is(.scene-background, .hero-unit, .enemy-unit) {
  animation: none !important;
}

@media (prefers-reduced-motion: reduce) {
  .hero-actor,
  .enemy-actor,
  .enemy-unit,
  .hpbar.low .hpbar-fill,
  .scene-background,
  .player-low::after,
  .support-unit,
  .ambient-particles i,
  .basic-attack-fx,
  .basic-attack-fx i,
  .loot-burst,
  .loot-burst i,
  .loot-ring {
    animation: none !important;
  }

  .wave-track i,
  .hp-ghost,
  .bg-fade-enter-active,
  .bg-fade-leave-active {
    transition: none !important;
  }

  .ambient-particles,
  .swing-layer,
  .spell-fx,
  .basic-attack-fx,
  .damage {
    display: none;
  }

  .loot-burst i,
  .loot-ring {
    display: none;
  }
}
/* ─────────────────────────────────────────────
   持续战斗演出
   由 core/battleRhythm 的拍子驱动，独立于击杀
   ───────────────────────────────────────────── */

.beat-layer,
.swing-layer {
  position: absolute;
  inset: 0;
  pointer-events: none;
  z-index: 6;
}

/* 飘字 */
.beat-damage {
  position: absolute;
  font-weight: 800;
  font-size: 15px;
  white-space: nowrap;
  text-shadow:
    0 1px 0 rgb(255 255 255 / 85%),
    0 2px 8px rgb(60 80 110 / 45%);
  transform: translateX(var(--beat-offset, 0));
}

/* 元素克制短标签（批 1 感知层）：伤害数字下的小字，克制绿/被克红 */
.beat-tag {
  display: block;
  font-size: 10px;
  font-weight: 700;
  line-height: 1.1;
  text-shadow: 0 1px 0 rgb(255 255 255 / 90%);
  color: #455a64;
}

.enemy-gauge-badge {
  margin-left: 6px;
  vertical-align: middle;
}

/* 打怪：数字出现在右侧怪物身上 */
.beat-damage.to-enemy {
  right: 22%;
  top: 34%;
  color: #ff7043;
}

.beat-damage.to-enemy.crit {
  font-size: 20px;
  color: #ff3d3d;
  text-shadow:
    0 1px 0 #fff,
    0 0 14px rgb(255 120 90 / 80%);
}

/* ─────────────────────────────────────────────
   打击反馈（④）
   强度分档见 data/battleMotions 的 IMPACT_FEEDBACK
   ───────────────────────────────────────────── */

/*
 * 顿帧：命中瞬间把双方冻住几十毫秒。
 *
 * 这是「打到了」最主要的来源，比震屏和特效都重要 ——
 * 短暂静止会让大脑把前后两帧读成一次真实碰撞。
 * 只冻角色与怪物，不冻飘字和特效：数字必须继续往上飘，
 * 否则看起来像是整个页面卡住了，而不是打击有分量。
 */
.battle-scene.is-hitstop .hero-unit,
.battle-scene.is-hitstop .hero-unit *,
.battle-scene.is-hitstop .enemy-unit,
.battle-scene.is-hitstop .enemy-unit * {
  animation-play-state: paused;
}

/*
 * 震屏：只有技能和暴击才震，普攻永远不震。
 * 挂机是长时间挂着看的，每次普攻都震十分钟就晕了。
 *
 * 震的是场景内容而不是 .battle-scene 自身 ——
 * 根节点还挂着圆角和 overflow，抖动根节点会让边缘露出背景缝。
 */
.battle-scene.shake-heavy .scene-background,
.battle-scene.shake-critical .scene-background,
.battle-scene.shake-ultimate .scene-background,
.battle-scene.shake-heavy .hero-unit,
.battle-scene.shake-critical .hero-unit,
.battle-scene.shake-ultimate .hero-unit,
.battle-scene.shake-heavy .enemy-unit,
.battle-scene.shake-critical .enemy-unit,
.battle-scene.shake-ultimate .enemy-unit {
  animation: impact-shake var(--shake-ms, 220ms) var(--ease-ios) both;
}

.battle-scene.shake-heavy {
  --shake-px: 3px;
  --shake-ms: 160ms;
}

.battle-scene.shake-critical {
  --shake-px: 5px;
  --shake-ms: 220ms;
}

.battle-scene.shake-ultimate {
  --shake-px: 8px;
  --shake-ms: 300ms;
}

/* 衰减式震动：第一下最重，之后迅速收敛。等幅抖动看起来像故障不像撞击。 */
@keyframes impact-shake {
  0% {
    transform: translate3d(0, 0, 0);
  }
  15% {
    transform: translate3d(calc(var(--shake-px, 4px) * -1), calc(var(--shake-px, 4px) * 0.5), 0);
  }
  32% {
    transform: translate3d(calc(var(--shake-px, 4px) * 0.72), calc(var(--shake-px, 4px) * -0.4), 0);
  }
  52% {
    transform: translate3d(calc(var(--shake-px, 4px) * -0.45), 0, 0);
  }
  74% {
    transform: translate3d(calc(var(--shake-px, 4px) * 0.22), 0, 0);
  }
  100% {
    transform: translate3d(0, 0, 0);
  }
}

/*
 * 伤害飘字分档。
 * 光靠颜色区分不够 —— 挂机时玩家是扫视而不是盯着看，
 * 字号差异才是一眼能读出「这下打得重」的信号。
 */
.beat-damage.tier-heavy {
  font-size: 18px;
  color: #ff8a3d;
}

.beat-damage.tier-critical {
  font-size: 22px;
}

.beat-damage.tier-ultimate {
  font-size: 27px;
  color: #ff2d55;
  text-shadow:
    0 1px 0 #fff,
    0 0 18px rgb(255 90 120 / 90%),
    0 0 34px rgb(255 200 90 / 70%);
}

/*
 * 打击反馈的无障碍兜底。
 *
 * 顿帧和震屏正是前庭敏感人群最难受的两类效果，必须彻底关掉，
 * 而不是「减弱」。字号分档保留 —— 那是静态信息不是动效，
 * 关掉反而让这些玩家失去了判断打击轻重的唯一线索。
 */
@media (prefers-reduced-motion: reduce) {
  .battle-scene.is-hitstop .hero-unit,
  .battle-scene.is-hitstop .hero-unit *,
  .battle-scene.is-hitstop .enemy-unit,
  .battle-scene.is-hitstop .enemy-unit * {
    animation-play-state: running;
  }

  .battle-scene[class*='shake-'] .scene-background,
  .battle-scene[class*='shake-'] .hero-unit,
  .battle-scene[class*='shake-'] .enemy-unit {
    animation: none;
  }
}

/* 挨打：数字出现在左侧角色身上 */
.beat-damage.to-hero {
  left: 20%;
  top: 52%;
  font-size: 13px;
  color: #7f8fa6;
}

.beat-float-enter-from {
  opacity: 0;
  transform: translate(var(--beat-offset, 0), 10px) scale(0.7);
}

.beat-float-enter-active {
  transition: all 0.18s var(--ease-out-back, cubic-bezier(0.34, 1.56, 0.64, 1));
}

.beat-float-leave-to {
  opacity: 0;
  transform: translate(var(--beat-offset, 0), -34px) scale(1.05);
}

.beat-float-leave-active {
  transition: all 0.44s ease-out;
}

/* 挥砍 / 技能特效 */
.swing-fx {
  position: absolute;
  right: 20%;
  top: 30%;
  width: 96px;
  height: 96px;
  display: grid;
  place-items: center;
}

.swing-fx img {
  width: 100%;
  height: 100%;
  object-fit: contain;
  filter: drop-shadow(0 0 10px rgb(255 210 235 / 70%));
}

.swing-fx.is-skill {
  width: 150px;
  height: 150px;
  right: 14%;
  top: 20%;
}

.swing-fx.kind-multi-slash,
.swing-fx.kind-ultimate {
  width: 172px;
  height: 172px;
  right: 9%;
  top: 15%;
}

.swing-fx.kind-dash-impact,
.swing-fx.kind-ambush {
  width: 162px;
  height: 162px;
  right: 11%;
  top: 18%;
}

.swing-fx.kind-counter {
  width: 142px;
  height: 142px;
  right: 35%;
  top: 24%;
}

.swing-fx.kind-vortex,
.swing-fx.kind-storm {
  width: 178px;
  height: 178px;
  right: 7%;
  top: 13%;
}

.swing-fx.kind-multi-slash img {
  animation: rhythm-claw-flurry 0.58s steps(3, end) both;
}

.swing-fx.kind-dash-impact img,
.swing-fx.kind-ambush img {
  animation: rhythm-dash-impact 0.58s ease-out both;
}

.swing-fx.kind-counter img {
  animation: rhythm-counter-guard 0.58s ease-out both;
}

.swing-fx.kind-vortex img {
  animation: rhythm-vortex 0.62s ease-out both;
}

.swing-fx.kind-storm img {
  animation: rhythm-storm 0.62s ease-out both;
}

.swing-fx.kind-ultimate img {
  animation: rhythm-ultimate 0.62s cubic-bezier(0.2, 0.74, 0.22, 1) both;
}

.swing-fx.crit img {
  filter: drop-shadow(0 0 16px rgb(255 140 120 / 95%)) saturate(1.3);
}

.swing-enter-from {
  opacity: 0;
  transform: scale(0.55) rotate(-16deg);
}

.swing-enter-active {
  transition: all 0.14s ease-out;
}

.swing-leave-to {
  opacity: 0;
  transform: scale(1.28) rotate(10deg);
}

.swing-leave-active {
  transition: all 0.34s ease-in;
}

/* 玩家受击时整个单元轻微后仰并泛红 */
.hero-unit.hurt {
  animation: hero-hurt 0.32s ease-out;
  animation-delay: var(--monster-impact-delay, 0ms);
}

@keyframes hero-hurt {
  0% {
    transform: translateX(0);
    filter: none;
  }
  35% {
    transform: translateX(-7px);
    filter: brightness(1.15) saturate(0.85) drop-shadow(0 0 8px rgb(255 110 110 / 70%));
  }
  100% {
    transform: translateX(0);
    filter: none;
  }
}

@keyframes rhythm-claw-flurry {
  0% {
    opacity: 0;
    transform: scale(0.55) rotate(-18deg);
  }
  38% {
    opacity: 1;
    transform: scale(1.04) rotate(7deg);
  }
  72% {
    transform: scale(0.94) rotate(-5deg);
  }
  100% {
    opacity: 0;
    transform: scale(1.18) rotate(10deg);
  }
}

@keyframes rhythm-dash-impact {
  0% {
    opacity: 0;
    transform: translateX(-54px) scale(0.42);
  }
  42% {
    opacity: 1;
    transform: translateX(0) scale(1.08);
  }
  100% {
    opacity: 0;
    transform: translateX(18px) scale(1.2);
  }
}

@keyframes rhythm-counter-guard {
  0% {
    opacity: 0;
    transform: scale(0.5) rotate(-14deg);
  }
  45%,
  72% {
    opacity: 1;
    transform: scale(1.05) rotate(3deg);
  }
  100% {
    opacity: 0;
    transform: scale(1.16) rotate(8deg);
  }
}

@keyframes rhythm-vortex {
  0% {
    opacity: 0;
    transform: scale(0.42) rotate(-70deg);
  }
  48% {
    opacity: 1;
  }
  100% {
    opacity: 0;
    transform: scale(1.16) rotate(42deg);
  }
}

@keyframes rhythm-storm {
  0% {
    opacity: 0;
    transform: translateY(30px) scale(0.55);
  }
  42%,
  72% {
    opacity: 1;
    filter: brightness(1.18) drop-shadow(0 0 14px rgb(119 196 255 / 78%));
  }
  100% {
    opacity: 0;
    transform: translateY(-12px) scale(1.14);
  }
}

@keyframes rhythm-ultimate {
  0% {
    opacity: 0;
    transform: scale(0.3) rotate(-24deg);
  }
  32%,
  65% {
    opacity: 1;
    filter: brightness(1.28) saturate(1.2) drop-shadow(0 0 18px rgb(255 121 196 / 88%));
  }
  100% {
    opacity: 0;
    transform: scale(1.28) rotate(12deg);
  }
}

.battle-scene.reduced-motion
  :is(
    .beat-float-enter-active,
    .beat-float-leave-active,
    .swing-enter-active,
    .swing-leave-active
  ) {
  transition-duration: 0.01ms;
}

@media (prefers-reduced-motion: reduce) {
  .beat-float-enter-active,
  .beat-float-leave-active,
  .swing-enter-active,
  .swing-leave-active {
    transition-duration: 0.01ms;
  }

  .hero-unit.hurt {
    animation: none;
  }
}
</style>
