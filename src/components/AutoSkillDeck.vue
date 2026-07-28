<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, ref, watch, type CSSProperties } from 'vue';
import { Clock, LockKeyhole, Sparkles, X, Zap } from '@lucide/vue';
import { createFocusTrap, type FocusTrap } from 'focus-trap';
import type {
  BattleRhythmSnapshot,
  RhythmActionSnapshot,
  RhythmSkillSnapshot,
} from '@/core/battleRhythm';
import type { ClassId, Element } from '@/core/types';
import {
  autoBattleSkillCards,
  type AutoBattleSkillCard,
  type SkillCardMode,
} from '@/data/skillCards';
import { triggerHaptic } from '@/ui/haptics';

const props = defineProps<{
  classId: ClassId;
  level: number;
  active: boolean;
  snapshot: BattleRhythmSnapshot;
  reduceMotion?: boolean;
  hapticsEnabled?: boolean;
}>();

type CardPhase = 'locked' | 'waiting' | 'syncing' | 'paused' | 'ready' | 'cooling';

interface PresentedCard {
  definition: AutoBattleSkillCard;
  phase: CardPhase;
  status: string;
  remainingSec: number;
  ratio: number;
  isNext: boolean;
  castToken: number;
}

const railRef = ref<HTMLElement | null>(null);
const selectedCardId = ref<string | null>(null);
const sheetRef = ref<HTMLElement | null>(null);
const closeButtonRef = ref<HTMLButtonElement | null>(null);
const castTokens = ref<Record<string, number>>({});
const latestCastName = ref<string | null>(null);
const systemReduceMotion = ref(false);
const railPointerActive = ref(false);
let castLabelTimer = 0;
let sheetFocusTrap: FocusTrap | null = null;
let motionQuery: MediaQueryList | null = null;

const definitions = computed(() => autoBattleSkillCards(props.classId, props.level));
const snapshotMatches = computed(() => props.snapshot.contextId === props.classId);
const motionReduced = computed(() => Boolean(props.reduceMotion || systemReduceMotion.value));
const skillRuntime = computed(
  () => new Map(props.snapshot.skills.map((skill) => [skill.skillId, skill])),
);

const nextCardId = computed(() => {
  if (!props.active || !props.snapshot.running || !snapshotMatches.value) return null;
  const candidates: { id: string; remainingSec: number; priority: number }[] = [
    {
      id: `basic-${props.classId}`,
      remainingSec: props.snapshot.basic.remainingSec,
      priority: Number.MAX_SAFE_INTEGER,
    },
  ];
  for (const card of definitions.value) {
    if (card.mode !== 'auto' || !card.skillId) continue;
    const runtime = skillRuntime.value.get(card.skillId);
    if (runtime) {
      candidates.push({
        id: card.id,
        remainingSec: runtime.remainingSec,
        priority: card.priority ?? 0,
      });
    }
  }
  candidates.sort(
    (a, b) =>
      a.remainingSec - b.remainingSec || b.priority - a.priority || a.id.localeCompare(b.id),
  );
  return candidates[0]?.id ?? null;
});

const presentedCards = computed<readonly PresentedCard[]>(() =>
  definitions.value.map((definition) => {
    const runtime = runtimeFor(definition);
    const phase = phaseFor(definition.mode, runtime);
    return {
      definition,
      phase,
      status: statusFor(definition, phase, runtime),
      remainingSec: runtime?.remainingSec ?? 0,
      ratio: runtime?.ratio ?? (phase === 'locked' ? 1 : 0),
      isNext: definition.id === nextCardId.value,
      castToken: castTokens.value[definition.id] ?? 0,
    };
  }),
);

const selectedPresentedCard = computed(
  () => presentedCards.value.find((entry) => entry.definition.id === selectedCardId.value) ?? null,
);

const deckStatus = computed(() => {
  if (!props.active) return '轮转已暂停';
  if (!props.snapshot.running) return '准备下一轮';
  if (!snapshotMatches.value) return '正在同步角色';
  return latestCastName.value ? `${latestCastName.value} · 已释放` : '按冷却自动轮转';
});

const elementLabels: Readonly<Record<Element, string>> = {
  fire: '炎',
  ice: '冰',
  thunder: '雷',
  none: '无属性',
};

function runtimeFor(card: AutoBattleSkillCard): RhythmActionSnapshot | null {
  if (!snapshotMatches.value) return null;
  if (card.mode === 'basic') return props.snapshot.basic;
  if (card.mode !== 'auto' || !card.skillId) return null;
  const runtime = skillRuntime.value.get(card.skillId);
  if (!runtime) {
    throw new Error(`[技能卡] 同源快照缺少自动技能：${card.skillId}`);
  }
  return runtime;
}

function phaseFor(mode: SkillCardMode, runtime: RhythmActionSnapshot | null): CardPhase {
  if (mode === 'locked') return 'locked';
  if (mode === 'conditional') return 'waiting';
  if (!snapshotMatches.value || !runtime) return 'syncing';
  if (!props.active) return 'paused';
  if (!props.snapshot.running) return 'syncing';
  return runtime.remainingSec <= 0.08 ? 'ready' : 'cooling';
}

function statusFor(
  card: AutoBattleSkillCard,
  phase: CardPhase,
  runtime: RhythmActionSnapshot | null,
): string {
  switch (phase) {
    case 'locked':
      return `Lv.${card.unlockLevel}`;
    case 'waiting':
      return '条件待机';
    case 'syncing':
      return '同步中';
    case 'paused':
      return '已暂停';
    case 'ready':
      return '就绪';
    case 'cooling':
      return formatSeconds(runtime?.remainingSec ?? 0);
  }
}

function formatSeconds(value: number): string {
  if (value >= 9.95) return `${Math.ceil(value)}s`;
  return `${Math.max(0, value).toFixed(1)}s`;
}

function cardStyle(entry: PresentedCard): CSSProperties {
  return {
    '--cooldown-turn': `${Math.min(1, Math.max(0, entry.ratio))}turn`,
    '--skill-accent': accentFor(entry.definition.element),
  } as CSSProperties;
}

function accentFor(element: Element): string {
  if (element === 'fire') return '#ff9aaf';
  if (element === 'ice') return '#70c9f2';
  if (element === 'thunder') return '#a998f5';
  return '#83d8c2';
}

function assetUrl(path: string): string {
  return `${import.meta.env.BASE_URL}${path}`;
}

function cardAriaLabel(card: AutoBattleSkillCard): string {
  if (card.mode === 'locked') {
    return `${card.name}，${card.kind}，Lv.${card.unlockLevel} 开放，点按查看详情`;
  }
  if (card.mode === 'conditional') {
    return `${card.name}，${card.kind}，条件待机，点按查看详情`;
  }
  return `${card.name}，${card.kind}，自动轮转，点按查看详情`;
}

function snapshotCastSeqs(snapshot: BattleRhythmSnapshot): Map<string, number | null> {
  const result = new Map<string, number | null>([
    [`basic-${snapshot.contextId}`, snapshot.basic.lastCastSeq],
  ]);
  for (const skill of snapshot.skills) result.set(skill.skillId, skill.lastCastSeq);
  return result;
}

watch(
  () => props.snapshot,
  (next, previous) => {
    if (
      next.contextId !== props.classId ||
      previous.contextId !== next.contextId ||
      previous.epoch !== next.epoch
    ) {
      castTokens.value = {};
      latestCastName.value = null;
      return;
    }

    const previousCasts = snapshotCastSeqs(previous);
    const nextCasts = snapshotCastSeqs(next);
    const fresh = [...nextCasts.entries()]
      .filter(
        ([id, seq]) =>
          seq !== null &&
          seq > (previousCasts.get(id) ?? 0) &&
          definitions.value.some((c) => c.id === id),
      )
      .sort((a, b) => (a[1] ?? 0) - (b[1] ?? 0));
    if (fresh.length === 0) return;

    const nextTokens = { ...castTokens.value };
    for (const [id, seq] of fresh) nextTokens[id] = seq ?? 0;
    castTokens.value = nextTokens;

    const latestId = fresh.at(-1)?.[0] ?? null;
    latestCastName.value =
      definitions.value.find((definition) => definition.id === latestId)?.name ?? null;
    const rail = railRef.value;
    const focusInsideRail = rail?.contains(document.activeElement) ?? false;
    if (
      rail &&
      latestId &&
      !latestId.startsWith('basic-') &&
      !selectedCardId.value &&
      !railPointerActive.value &&
      !focusInsideRail
    ) {
      void nextTick(() => {
        const currentRail = railRef.value;
        const button = [
          ...(currentRail?.querySelectorAll<HTMLButtonElement>('.skill-card') ?? []),
        ].find((candidate) => candidate.dataset.cardId === latestId);
        if (!currentRail || !button) return;
        const centeredLeft =
          button.offsetLeft + button.offsetWidth / 2 - currentRail.clientWidth / 2;
        currentRail.scrollTo({
          left: Math.max(
            0,
            Math.min(centeredLeft, currentRail.scrollWidth - currentRail.clientWidth),
          ),
          behavior: motionReduced.value ? 'auto' : 'smooth',
        });
      });
    }
    clearTimeout(castLabelTimer);
    castLabelTimer = window.setTimeout(() => {
      latestCastName.value = null;
    }, 1050);
  },
);

watch(
  () => props.classId,
  () => {
    requestClose(false);
    castTokens.value = {};
    latestCastName.value = null;
  },
);

async function openCard(card: AutoBattleSkillCard): Promise<void> {
  triggerHaptic('skill-card', Boolean(props.hapticsEnabled), motionReduced.value);
  selectedCardId.value = card.id;
  await nextTick();
  const sheet = sheetRef.value;
  if (!sheet) return;
  sheetFocusTrap = createFocusTrap(sheet, {
    initialFocus: () => closeButtonRef.value ?? sheet,
    fallbackFocus: () => sheet,
    clickOutsideDeactivates: true,
    isolateSubtrees: 'aria-hidden',
    onDeactivate: () => {
      selectedCardId.value = null;
      sheetFocusTrap = null;
    },
  });
  sheetFocusTrap.activate();
}

function requestClose(returnFocus = true): void {
  if (sheetFocusTrap?.active) {
    sheetFocusTrap.deactivate({
      returnFocus,
    });
    return;
  }
  selectedCardId.value = null;
  sheetFocusTrap = null;
}

function focusRelative(event: KeyboardEvent, index: number, offset: number): void {
  event.preventDefault();
  const buttons = railRef.value?.querySelectorAll<HTMLButtonElement>('.skill-card');
  if (!buttons?.length) return;
  const nextIndex = (index + offset + buttons.length) % buttons.length;
  buttons[nextIndex]?.focus();
}

function detailStatus(entry: PresentedCard): string {
  if (entry.phase === 'waiting') {
    return entry.definition.conditionText ?? '根据战况待机';
  }
  if (entry.phase === 'locked') return `角色达到 Lv.${entry.definition.unlockLevel} 后开放`;
  if (entry.phase === 'syncing') return '正在与当前角色的挂机节奏同步';
  if (entry.phase === 'paused') return '挂机暂停，冷却保持不变';
  if (entry.phase === 'ready') return entry.isNext ? '就绪 · 下一次自动行动' : '就绪';
  return `冷却剩余 ${formatSeconds(entry.remainingSec)}`;
}

function runtimeSnapshotForDetail(entry: PresentedCard): RhythmSkillSnapshot | null {
  const id = entry.definition.skillId;
  return id ? (skillRuntime.value.get(id) ?? null) : null;
}

function handleMotionPreference(event: MediaQueryListEvent): void {
  systemReduceMotion.value = event.matches;
}

onMounted(() => {
  motionQuery = window.matchMedia?.('(prefers-reduced-motion: reduce)') ?? null;
  systemReduceMotion.value = Boolean(motionQuery?.matches);
  motionQuery?.addEventListener?.('change', handleMotionPreference);
});

onUnmounted(() => {
  clearTimeout(castLabelTimer);
  motionQuery?.removeEventListener?.('change', handleMotionPreference);
  motionQuery = null;
  if (sheetFocusTrap?.active) {
    sheetFocusTrap.deactivate({
      returnFocus: false,
      onDeactivate: () => undefined,
    });
  }
  sheetFocusTrap = null;
});
</script>

<template>
  <section
    class="skill-deck"
    :class="{
      paused: !active,
      'reduced-motion': motionReduced,
    }"
    aria-labelledby="auto-skill-deck-title"
  >
    <header class="deck-head">
      <span class="deck-title">
        <span class="deck-sigil" aria-hidden="true"><Sparkles :size="13" /></span>
        <span>
          <strong id="auto-skill-deck-title">自动技能演出</strong>
          <small>{{ deckStatus }}</small>
        </span>
      </span>
      <span class="deck-hint">点按查看</span>
    </header>

    <div
      ref="railRef"
      class="skill-rail"
      role="group"
      aria-label="当前角色自动技能卡片"
      @pointerdown="railPointerActive = true"
      @pointerup="railPointerActive = false"
      @pointercancel="railPointerActive = false"
      @pointerleave="railPointerActive = false"
    >
      <button
        v-for="(entry, index) in presentedCards"
        :key="entry.definition.id"
        :data-card-id="entry.definition.id"
        type="button"
        class="skill-card"
        :class="[
          `phase-${entry.phase}`,
          `element-${entry.definition.element}`,
          {
            'is-next': entry.isNext,
            'has-cast': entry.castToken > 0,
          },
        ]"
        :style="cardStyle(entry)"
        :aria-label="cardAriaLabel(entry.definition)"
        @click="openCard(entry.definition)"
        @keydown.left="focusRelative($event, index, -1)"
        @keydown.right="focusRelative($event, index, 1)"
      >
        <span
          :key="`${entry.definition.id}-${entry.castToken}`"
          class="card-face"
          :class="{ 'cast-pop': entry.castToken > 0 }"
        >
          <span v-if="entry.isNext" class="next-dot" aria-hidden="true" />
          <span class="kind-chip">{{ entry.definition.kind }}</span>
          <span class="skill-orb" aria-hidden="true">
            <img
              :src="assetUrl(entry.definition.iconAsset)"
              alt=""
              draggable="false"
              decoding="async"
            />
            <span v-if="entry.phase === 'cooling'" class="cooldown-shade" />
            <LockKeyhole
              v-if="entry.phase === 'locked'"
              class="lock"
              :size="15"
              :stroke-width="2.4"
            />
            <i v-for="particle in 4" :key="particle" class="cast-particle" />
          </span>
          <strong class="skill-name">{{ entry.definition.name }}</strong>
          <span class="skill-status num">
            <Clock v-if="entry.phase === 'cooling'" :size="9" aria-hidden="true" />
            {{ entry.status }}
          </span>
        </span>
      </button>
    </div>

    <Teleport to="body">
      <Transition name="skill-sheet">
        <div
          v-if="selectedPresentedCard"
          class="skill-sheet-overlay"
          :class="{ 'reduced-motion': motionReduced }"
          @click.self="requestClose()"
        >
          <section
            ref="sheetRef"
            class="skill-sheet"
            role="dialog"
            aria-modal="true"
            :aria-labelledby="`skill-sheet-title-${selectedPresentedCard.definition.id}`"
            tabindex="-1"
          >
            <img
              class="sheet-effect"
              :src="assetUrl(selectedPresentedCard.definition.effectAsset)"
              alt=""
              aria-hidden="true"
            />
            <header class="sheet-head">
              <span
                class="sheet-icon"
                :style="{ '--skill-accent': accentFor(selectedPresentedCard.definition.element) }"
              >
                <img :src="assetUrl(selectedPresentedCard.definition.iconAsset)" alt="" />
              </span>
              <span>
                <small>
                  {{ selectedPresentedCard.definition.kind }} ·
                  {{ elementLabels[selectedPresentedCard.definition.element] }}
                </small>
                <strong :id="`skill-sheet-title-${selectedPresentedCard.definition.id}`">
                  {{ selectedPresentedCard.definition.name }}
                </strong>
              </span>
              <button
                ref="closeButtonRef"
                type="button"
                class="sheet-close"
                aria-label="关闭技能详情"
                @click="requestClose()"
              >
                <X :size="18" />
              </button>
            </header>

            <p class="sheet-desc">{{ selectedPresentedCard.definition.desc }}</p>

            <dl class="skill-facts">
              <div>
                <dt>当前状态</dt>
                <dd>{{ detailStatus(selectedPresentedCard) }}</dd>
              </div>
              <div>
                <dt>配置冷却</dt>
                <dd class="num">
                  {{
                    selectedPresentedCard.definition.cooldownSec === null
                      ? `${snapshot.basic.cooldownSec}s`
                      : `${selectedPresentedCard.definition.cooldownSec}s`
                  }}
                </dd>
              </div>
              <div>
                <dt>动作表现</dt>
                <dd>
                  {{
                    selectedPresentedCard.definition.hitCount > 1
                      ? `${selectedPresentedCard.definition.hitCount} 段反馈`
                      : '单次反馈'
                  }}
                </dd>
              </div>
              <div>
                <dt>开放等级</dt>
                <dd class="num">Lv.{{ selectedPresentedCard.definition.unlockLevel }}</dd>
              </div>
              <div v-if="selectedPresentedCard.definition.priority !== null">
                <dt>演出优先</dt>
                <dd class="num">{{ selectedPresentedCard.definition.priority }}</dd>
              </div>
              <div v-if="runtimeSnapshotForDetail(selectedPresentedCard)">
                <dt>本轮拍子</dt>
                <dd class="num">
                  #{{ runtimeSnapshotForDetail(selectedPresentedCard)?.lastCastSeq ?? '待机' }}
                </dd>
              </div>
            </dl>

            <p v-if="selectedPresentedCard.phase === 'waiting'" class="condition-note">
              <Zap :size="14" aria-hidden="true" />
              条件技能已登记为战况待机；当前不会用假的伤害动作冒充触发。
            </p>
            <p class="auto-note">
              技能由挂机节奏自动轮转；点按只用于查看，不会手动施放或打断战斗。
            </p>
          </section>
        </div>
      </Transition>
    </Teleport>
  </section>
</template>

<style scoped>
.skill-deck {
  position: relative;
  z-index: 1;
  overflow: hidden;
  padding: 4px 8px 6px;
  background:
    radial-gradient(circle at 8% 0%, rgb(255 187 216 / 22%), transparent 38%),
    radial-gradient(circle at 92% 100%, rgb(129 203 244 / 20%), transparent 42%),
    rgb(250 253 255 / 78%);
  border-block: 1px solid rgb(255 255 255 / 86%);
  box-shadow:
    inset 0 1px rgb(255 255 255 / 84%),
    inset 0 -1px rgb(116 158 195 / 8%);
  backdrop-filter: blur(12px) saturate(1.35);
  -webkit-backdrop-filter: blur(12px) saturate(1.35);
}

.deck-head {
  display: flex;
  min-height: 21px;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 0 2px 3px;
}

.deck-title {
  display: flex;
  min-width: 0;
  align-items: center;
  gap: 6px;
}

.deck-title > span:last-child {
  display: flex;
  min-width: 0;
  align-items: baseline;
  gap: 6px;
}

.deck-title strong {
  flex-shrink: 0;
  font-size: 11px;
  letter-spacing: 0.02em;
  color: var(--text);
}

.deck-title small,
.deck-hint {
  overflow: hidden;
  font-size: 9px;
  color: var(--text-dim);
  text-overflow: ellipsis;
  white-space: nowrap;
}

.deck-sigil {
  display: grid;
  width: 20px;
  height: 20px;
  flex-shrink: 0;
  place-items: center;
  color: #fff;
  background: linear-gradient(145deg, #ffb4d1, #75c9f2);
  border: 1px solid rgb(255 255 255 / 88%);
  border-radius: 8px;
  box-shadow: 0 3px 8px rgb(111 177 219 / 21%);
}

.deck-hint {
  flex-shrink: 0;
  padding: 2px 6px;
  color: var(--blue-deep);
  background: rgb(230 244 253 / 75%);
  border-radius: 999px;
}

.skill-rail {
  display: grid;
  grid-auto-columns: calc((100% - 18px) / 4);
  grid-auto-flow: column;
  gap: 6px;
  overflow-x: auto;
  padding: 3px 5px 4px;
  scroll-snap-type: x mandatory;
  scrollbar-width: none;
  overscroll-behavior-x: contain;
  -webkit-overflow-scrolling: touch;
}

.skill-rail::-webkit-scrollbar {
  display: none;
}

.skill-card {
  position: relative;
  min-width: 0;
  height: 70px;
  scroll-snap-align: start;
  border-radius: 17px;
  outline-offset: 1px;
  transition:
    transform 140ms var(--ease-spring),
    filter 180ms var(--ease-soft);
}

.skill-card:active {
  transform: scale(0.95) translateY(1px);
}

.skill-card:focus-visible {
  outline: 3px solid rgb(74 168 221 / 70%);
  outline-offset: 1px;
}

.card-face {
  isolation: isolate;
  position: absolute;
  inset: 0;
  display: grid;
  grid-template-rows: 1fr auto auto;
  place-items: center;
  overflow: hidden;
  padding: 5px 4px 4px;
  background:
    linear-gradient(145deg, rgb(255 255 255 / 91%), rgb(243 249 255 / 67%)),
    linear-gradient(135deg, rgb(255 184 214 / 20%), rgb(117 201 242 / 18%));
  border: 1px solid rgb(255 255 255 / 88%);
  border-radius: inherit;
  box-shadow:
    inset 0 0 0 1px color-mix(in srgb, var(--skill-accent) 28%, transparent),
    inset 0 1px 0 rgb(255 255 255 / 92%),
    0 4px 11px rgb(106 144 179 / 13%);
}

.card-face::before {
  position: absolute;
  inset: 0;
  z-index: -1;
  content: '';
  background:
    radial-gradient(circle at 15% 8%, rgb(255 255 255 / 95%), transparent 30%),
    radial-gradient(
      circle at 90% 100%,
      color-mix(in srgb, var(--skill-accent) 20%, transparent),
      transparent 50%
    );
}

.kind-chip {
  position: absolute;
  z-index: 3;
  top: 4px;
  left: 4px;
  padding: 1px 4px;
  font-size: 8px;
  font-weight: 700;
  line-height: 1.25;
  color: color-mix(in srgb, var(--skill-accent) 72%, #506579);
  background: rgb(255 255 255 / 76%);
  border: 1px solid rgb(255 255 255 / 90%);
  border-radius: 999px;
}

.next-dot {
  position: absolute;
  z-index: 4;
  top: 5px;
  right: 6px;
  width: 7px;
  height: 7px;
  background: linear-gradient(145deg, #ff92bc, #68c6f2);
  border: 1px solid #fff;
  border-radius: 50%;
  box-shadow: 0 0 0 3px rgb(127 199 238 / 16%);
  animation: next-breathe 1.8s ease-in-out infinite;
}

.skill-orb {
  position: relative;
  display: grid;
  width: 38px;
  height: 38px;
  align-self: end;
  place-items: center;
  overflow: visible;
  background: linear-gradient(145deg, #fff, color-mix(in srgb, var(--skill-accent) 14%, #fff));
  border: 1px solid color-mix(in srgb, var(--skill-accent) 45%, #fff);
  border-radius: 14px;
  box-shadow:
    inset 0 0 0 1px rgb(255 255 255 / 75%),
    0 3px 8px color-mix(in srgb, var(--skill-accent) 17%, transparent);
}

.skill-orb img {
  width: 116%;
  height: 116%;
  object-fit: contain;
  border-radius: inherit;
  pointer-events: none;
}

.cooldown-shade {
  position: absolute;
  inset: 0;
  background: conic-gradient(
    from 0turn,
    rgb(49 67 89 / 54%) 0 var(--cooldown-turn),
    transparent var(--cooldown-turn) 1turn
  );
  border-radius: inherit;
  pointer-events: none;
}

.skill-name {
  display: block;
  width: 100%;
  overflow: hidden;
  font-size: 9px;
  line-height: 1.25;
  color: var(--text);
  text-align: center;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.skill-status {
  display: flex;
  min-height: 12px;
  align-items: center;
  justify-content: center;
  gap: 2px;
  font-size: 8px;
  line-height: 1.2;
  color: var(--text-dim);
}

.phase-ready .skill-status,
.is-next .skill-status {
  color: var(--blue-deep);
}

.phase-waiting .card-face {
  border-style: dashed;
}

.phase-waiting .skill-orb {
  filter: saturate(0.72);
}

.phase-locked .card-face {
  background: linear-gradient(145deg, rgb(244 248 252 / 82%), rgb(234 241 248 / 64%));
}

.phase-locked .skill-orb img {
  opacity: 0.28;
  filter: grayscale(0.68);
}

.lock {
  position: absolute;
  padding: 4px;
  color: #fff;
  background: rgb(78 96 116 / 72%);
  border-radius: 50%;
  box-sizing: content-box;
}

.paused {
  filter: saturate(0.72);
}

.paused .skill-card {
  opacity: 0.68;
}

.cast-particle {
  position: absolute;
  z-index: 4;
  width: 4px;
  height: 4px;
  opacity: 0;
  background: linear-gradient(145deg, #ff9fc5, #72c9f2);
  border-radius: 50%;
  pointer-events: none;
}

.cast-pop {
  animation: card-release 520ms var(--ease-out-back) both;
}

.cast-pop::after {
  position: absolute;
  z-index: 6;
  inset: -30% auto -30% -35%;
  width: 34%;
  content: '';
  background: linear-gradient(90deg, transparent, rgb(255 255 255 / 80%), transparent);
  transform: skewX(-18deg);
  animation: cast-shine 500ms var(--ease-soft) both;
  pointer-events: none;
}

.cast-pop .cast-particle {
  animation: particle-pop 460ms var(--ease-out-back) both;
}

.cast-pop .cast-particle:nth-of-type(1) {
  --particle-x: -16px;
  --particle-y: -18px;
}

.cast-pop .cast-particle:nth-of-type(2) {
  --particle-x: 18px;
  --particle-y: -14px;
  animation-delay: 28ms;
}

.cast-pop .cast-particle:nth-of-type(3) {
  --particle-x: -19px;
  --particle-y: 12px;
  animation-delay: 50ms;
}

.cast-pop .cast-particle:nth-of-type(4) {
  --particle-x: 17px;
  --particle-y: 15px;
  animation-delay: 72ms;
}

@keyframes card-release {
  0% {
    transform: translateY(0) scale(1) rotate(0);
  }
  18% {
    transform: translateY(1px) scale(0.94) rotate(-1deg);
  }
  52% {
    transform: translateY(-6px) scale(1.06) rotate(1.5deg);
    filter: brightness(1.08);
  }
  74% {
    transform: translateY(1px) scale(0.985) rotate(-0.7deg);
  }
  100% {
    transform: translateY(0) scale(1) rotate(0);
  }
}

@keyframes cast-shine {
  from {
    transform: translateX(0) skewX(-18deg);
  }
  to {
    transform: translateX(430%) skewX(-18deg);
  }
}

@keyframes particle-pop {
  0% {
    opacity: 0;
    transform: translate(0, 0) scale(0.4);
  }
  34% {
    opacity: 0.9;
  }
  100% {
    opacity: 0;
    transform: translate(var(--particle-x), var(--particle-y)) scale(1.3);
  }
}

@keyframes next-breathe {
  0%,
  100% {
    transform: scale(0.86);
    box-shadow: 0 0 0 2px rgb(127 199 238 / 12%);
  }
  50% {
    transform: scale(1.12);
    box-shadow: 0 0 0 5px rgb(127 199 238 / 17%);
  }
}

.skill-sheet-overlay {
  position: fixed;
  z-index: 90;
  inset: 0;
  display: flex;
  align-items: flex-end;
  justify-content: center;
  padding: 16px max(12px, env(safe-area-inset-right)) max(calc(var(--sab) + 72px), 78px)
    max(12px, env(safe-area-inset-left));
  background: rgb(53 69 91 / 38%);
  backdrop-filter: blur(5px);
  -webkit-backdrop-filter: blur(5px);
}

.skill-sheet {
  isolation: isolate;
  position: relative;
  width: min(100%, 456px);
  max-height: 52dvh;
  overflow: hidden auto;
  padding: 15px;
  background:
    radial-gradient(circle at 100% 0%, rgb(213 237 255 / 82%), transparent 46%),
    radial-gradient(circle at 0% 100%, rgb(255 225 239 / 68%), transparent 42%),
    rgb(255 255 255 / 94%);
  border: 1px solid rgb(255 255 255 / 92%);
  border-radius: 24px;
  box-shadow:
    0 24px 64px rgb(55 76 104 / 25%),
    inset 0 0 0 1px rgb(123 172 211 / 10%);
}

.sheet-effect {
  position: absolute;
  z-index: -1;
  top: -55px;
  right: -42px;
  width: 180px;
  height: 180px;
  opacity: 0.1;
  object-fit: contain;
  filter: saturate(1.2);
  pointer-events: none;
}

.sheet-head {
  display: grid;
  grid-template-columns: auto 1fr auto;
  align-items: center;
  gap: 10px;
}

.sheet-icon {
  display: grid;
  width: 54px;
  height: 54px;
  place-items: center;
  overflow: hidden;
  background: linear-gradient(145deg, #fff, color-mix(in srgb, var(--skill-accent) 17%, #fff));
  border: 1px solid color-mix(in srgb, var(--skill-accent) 48%, #fff);
  border-radius: 18px;
  box-shadow:
    inset 0 0 0 1px rgb(255 255 255 / 80%),
    0 6px 16px color-mix(in srgb, var(--skill-accent) 18%, transparent);
}

.sheet-icon img {
  width: 116%;
  height: 116%;
  object-fit: contain;
}

.sheet-head small {
  display: block;
  margin-bottom: 2px;
  font-size: 10px;
  color: var(--blue-deep);
}

.sheet-head strong {
  display: block;
  font-size: 18px;
  color: var(--text);
}

.sheet-close {
  display: grid;
  width: 34px;
  height: 34px;
  place-items: center;
  color: var(--text-mid);
  background: rgb(241 247 252 / 82%);
  border: 1px solid rgb(255 255 255 / 88%);
  border-radius: 12px;
}

.sheet-desc {
  margin: 12px 0;
  font-size: 12px;
  line-height: 1.65;
  color: var(--text-mid);
}

.skill-facts {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 7px;
}

.skill-facts div {
  min-width: 0;
  padding: 8px 9px;
  background: rgb(245 250 255 / 74%);
  border: 1px solid rgb(221 237 248 / 80%);
  border-radius: 13px;
}

.skill-facts dt {
  margin-bottom: 2px;
  font-size: 9px;
  color: var(--text-dim);
}

.skill-facts dd {
  overflow: hidden;
  font-size: 11px;
  font-weight: 700;
  color: var(--text);
  text-overflow: ellipsis;
}

.condition-note,
.auto-note {
  display: flex;
  align-items: flex-start;
  gap: 5px;
  margin-top: 9px;
  padding: 8px 9px;
  font-size: 10px;
  line-height: 1.5;
  color: var(--text-mid);
  background: rgb(255 241 247 / 76%);
  border: 1px solid rgb(255 207 226 / 68%);
  border-radius: 12px;
}

.condition-note {
  color: #9b7289;
}

.condition-note svg {
  flex-shrink: 0;
  margin-top: 1px;
  color: var(--pink-deep);
}

.auto-note {
  background: rgb(235 247 255 / 75%);
  border-color: rgb(194 228 248 / 72%);
}

.skill-sheet-enter-active,
.skill-sheet-leave-active {
  transition: opacity 180ms ease;
}

.skill-sheet-enter-active .skill-sheet {
  animation: sheet-in 320ms var(--ease-out-back) both;
}

.skill-sheet-leave-active .skill-sheet {
  animation: sheet-out 150ms ease-in both;
}

.skill-sheet-enter-from,
.skill-sheet-leave-to {
  opacity: 0;
}

@keyframes sheet-in {
  from {
    opacity: 0;
    transform: translateY(24px) scale(0.95);
  }
  to {
    opacity: 1;
    transform: translateY(0) scale(1);
  }
}

@keyframes sheet-out {
  to {
    opacity: 0;
    transform: translateY(14px) scale(0.97);
  }
}

.reduced-motion .next-dot,
.reduced-motion .cast-pop::after,
.reduced-motion .cast-pop .cast-particle {
  animation: none !important;
}

.reduced-motion .cast-pop {
  animation: card-release-reduced 140ms ease both !important;
}

.reduced-motion .skill-card,
.reduced-motion.skill-sheet-overlay,
.reduced-motion.skill-sheet-overlay .skill-sheet {
  transition: none !important;
}

.reduced-motion.skill-sheet-overlay .skill-sheet {
  animation: none !important;
}

@keyframes card-release-reduced {
  0%,
  100% {
    filter: none;
  }
  50% {
    filter: brightness(1.08);
  }
}

@media (max-width: 340px) {
  .skill-deck {
    padding-inline: 6px;
  }

  .skill-card {
    height: 66px;
    border-radius: 15px;
  }

  .skill-orb {
    width: 34px;
    height: 34px;
    border-radius: 12px;
  }

  .skill-name {
    font-size: 8px;
  }

  .deck-title small {
    display: none;
  }
}

@media (prefers-reduced-motion: reduce) {
  .next-dot,
  .cast-pop::after,
  .cast-pop .cast-particle,
  .skill-sheet-enter-active .skill-sheet,
  .skill-sheet-leave-active .skill-sheet {
    animation: none !important;
  }

  .skill-card,
  .skill-sheet-enter-active,
  .skill-sheet-leave-active {
    transition: none !important;
  }

  .cast-pop {
    animation: card-release-reduced 140ms ease both !important;
  }
}
</style>
