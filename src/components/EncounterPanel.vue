<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue';
import { ChevronLeft, ChevronRight, Sparkles, X } from '@lucide/vue';
import { createFocusTrap, type FocusTrap } from 'focus-trap';
import {
  canAfford,
  characterProgress,
  memoryDialogueForEncounter,
  portraitCueAtLine,
  relationshipStage,
  type EncounterChoice,
  type EncounterStoryChoice,
  type ResourceBundle,
} from '@/core/encounters';
import { abbr } from '@/core/format';
import { requireEncounter } from '@/data/encounters';
import { requireEncounterPortraitAsset } from '@/data/encounterVisuals';
import { requireItem } from '@/data/items';
import { useInventoryStore } from '@/stores/inventory';
import { usePlayerStore } from '@/stores/player';
import { useStageStore } from '@/stores/stage';

const emit = defineEmits<{ close: [] }>();
const stage = useStageStore();
const player = usePlayerStore();
const inventory = useInventoryStore();
type EncounterFeedback = { text: string; tone: 'success' | 'notice' };

const feedback = ref<EncounterFeedback | null>(null);
const selectedUid = ref<string | null>(stage.pendingEncounters[0]?.uid ?? null);
const lineIndex = ref(0);
const typedCount = ref(0);
const sheetRef = ref<HTMLElement | null>(null);
const closeButtonRef = ref<HTMLButtonElement | null>(null);
const dialogueRef = ref<HTMLElement | null>(null);
const doneButtonRef = ref<HTMLButtonElement | null>(null);
let typeTimer = 0;
let dialogFocusTrap: FocusTrap | null = null;

const entry = computed(() => {
  if (!selectedUid.value) return null;
  return stage.pendingEncounters.find((candidate) => candidate.uid === selectedUid.value) ?? null;
});
const activeIndex = computed(() =>
  entry.value
    ? stage.pendingEncounters.findIndex((candidate) => candidate.uid === entry.value?.uid)
    : -1,
);
const encounter = computed(() => (entry.value ? requireEncounter(entry.value.encounterId) : null));
const encounterView = computed(() => (entry.value ? stage.viewEncounter(entry.value.uid) : null));
const storyArc = computed(() => encounter.value?.storyArc ?? null);
const selectedStoryChoice = computed(
  () =>
    storyArc.value?.storyChoices.find((choice) => choice.id === entry.value?.storyChoiceId) ?? null,
);
const memoryLines = computed(() =>
  encounter.value ? memoryDialogueForEncounter(encounter.value, stage.encounterState) : [],
);
const dialogue = computed(() => {
  if (selectedStoryChoice.value) return selectedStoryChoice.value.responseDialogue;
  return [...memoryLines.value, ...(encounterView.value?.dialogue ?? [])];
});
const hasDialogue = computed(() => dialogue.value.length > 0);
const currentLine = computed(() => dialogue.value[lineIndex.value] ?? null);
const isLastLine = computed(
  () => !hasDialogue.value || lineIndex.value >= dialogue.value.length - 1,
);
const typedText = computed(() => (currentLine.value?.text ?? '').slice(0, typedCount.value));
const isTyping = computed(() => typedCount.value < (currentLine.value?.text.length ?? 0));
const dialogueDone = computed(() => isLastLine.value && !isTyping.value);
const dialogueAriaLabel = computed(() => {
  const line = currentLine.value;
  if (!line) return '';
  const speaker = line.speaker ? `${line.speaker}：` : '旁白：';
  const instruction = isTyping.value
    ? '按回车立即显示整句'
    : dialogueDone.value
      ? '本段对话已读完'
      : '按回车继续对话';
  return `${speaker}${line.text} ${instruction}`;
});
const relationship = computed(() => {
  const arc = storyArc.value;
  if (!arc) return null;
  return relationshipStage(characterProgress(stage.encounterState, arc.characterId).bond);
});
const storyStepLabel = computed(() =>
  selectedStoryChoice.value ? '是否伸出援手' : '你想怎样回应她？',
);
const wallet = computed(() => ({
  gold: player.player?.gold ?? 0,
  items: inventory.bag?.items ?? {},
}));
const isClimaxScene = computed(
  () =>
    Boolean(encounter.value?.climaxAsset) &&
    Boolean(selectedStoryChoice.value) &&
    dialogueDone.value,
);
const sceneUrl = computed(() => {
  const asset = isClimaxScene.value
    ? encounter.value?.climaxAsset
    : encounterView.value?.sceneAsset;
  return asset ? `${import.meta.env.BASE_URL}${asset}` : null;
});
const sceneAlt = computed(() => (isClimaxScene.value ? (encounter.value?.climaxAlt ?? '') : ''));
const activePortraitCue = computed(() => {
  return portraitCueAtLine(
    encounterView.value?.initialPortrait ?? null,
    dialogue.value,
    lineIndex.value,
  );
});
const portraitUrl = computed(() => {
  if (isClimaxScene.value || !activePortraitCue.value) return null;
  return `${import.meta.env.BASE_URL}${requireEncounterPortraitAsset(activePortraitCue.value)}`;
});

const TYPE_SPEED_MS = 34;

function stopTyping(): void {
  if (!typeTimer) return;
  clearInterval(typeTimer);
  typeTimer = 0;
}

function startTyping(): void {
  stopTyping();
  typedCount.value = 0;
  const full = currentLine.value?.text ?? '';
  if (!full) return;
  if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) {
    typedCount.value = full.length;
    return;
  }
  typeTimer = window.setInterval(() => {
    if (typedCount.value >= full.length) {
      stopTyping();
      return;
    }
    typedCount.value++;
  }, TYPE_SPEED_MS);
}

function completeLine(): void {
  stopTyping();
  typedCount.value = currentLine.value?.text.length ?? 0;
}

function advanceDialogue(): void {
  if (isTyping.value) {
    completeLine();
    return;
  }
  if (!isLastLine.value) lineIndex.value++;
}

async function skipDialogue(): Promise<void> {
  lineIndex.value = Math.max(0, dialogue.value.length - 1);
  await nextTick();
  completeLine();
}

watch(selectedUid, () => {
  lineIndex.value = 0;
});
watch(
  () => entry.value?.storyChoiceId,
  () => {
    lineIndex.value = 0;
  },
);
watch(currentLine, startTyping, { immediate: true });

onMounted(async () => {
  await nextTick();
  const sheet = sheetRef.value;
  if (!sheet) return;
  dialogFocusTrap = createFocusTrap(sheet, {
    initialFocus: () => closeButtonRef.value ?? sheet,
    fallbackFocus: () => sheet,
    clickOutsideDeactivates: true,
    isolateSubtrees: 'aria-hidden',
    onDeactivate: () => emit('close'),
  });
  dialogFocusTrap.activate();
});

onUnmounted(() => {
  stopTyping();
  if (dialogFocusTrap?.active) {
    dialogFocusTrap.deactivate({
      returnFocus: true,
      onDeactivate: () => undefined,
    });
  }
  dialogFocusTrap = null;
});

function requestClose(): void {
  if (dialogFocusTrap?.active) {
    dialogFocusTrap.deactivate();
    return;
  }
  emit('close');
}

function resourceText(bundle: ResourceBundle | undefined, emptyLabel = '无需材料'): string {
  if (!bundle) return emptyLabel;
  const parts: string[] = [];
  if (bundle.gold) parts.push(`金币 ×${abbr(bundle.gold)}`);
  for (const [id, count] of Object.entries(bundle.items ?? {})) {
    parts.push(`${requireItem(id).name} ×${abbr(count)}`);
  }
  return parts.length > 0 ? parts.join('、') : emptyLabel;
}

function selectRelative(offset: number): void {
  const count = stage.pendingEncounters.length;
  if (count < 2 || activeIndex.value < 0) return;
  const nextIndex = (activeIndex.value + offset + count) % count;
  selectedUid.value = stage.pendingEncounters[nextIndex]?.uid ?? null;
  feedback.value = null;
}

async function showNextPending(): Promise<void> {
  selectedUid.value = stage.pendingEncounters[0]?.uid ?? null;
  feedback.value = null;
  await nextTick();
  dialogueRef.value?.focus();
}

async function chooseStory(choice: EncounterStoryChoice): Promise<void> {
  if (!entry.value) return;
  const result = stage.rememberEncounterChoice(entry.value.uid, choice.id);
  if (!result.ok) {
    feedback.value = { text: '这段回应没有记下来，请重新打开奇遇再试', tone: 'notice' };
    return;
  }
  feedback.value = null;
  await nextTick();
  dialogueRef.value?.focus();
}

async function choose(choice: EncounterChoice): Promise<void> {
  if (!entry.value) return;
  const result = stage.resolveEncounter(entry.value.uid, choice.id);
  if (!result.ok) {
    feedback.value = {
      text:
        result.reason === 'insufficient-resource'
          ? '手头的材料还不够。先去挂机收集吧，这段故事会为你保留。'
          : result.reason === 'story-choice-required'
            ? '先回应她，再决定是否伸出援手。'
            : result.reason === 'invalid-story-choice'
              ? '这段回答已与当前剧情配置不一致，请重新载入有效存档。'
              : '这段奇遇已经结束了。',
      tone: 'notice',
    };
    return;
  }
  const reveal = resourceText(result.rewards, '');
  feedback.value = {
    text: reveal ? `${result.outcome} 获得：${reveal}` : result.outcome,
    tone: 'success',
  };
  selectedUid.value = null;
  lineIndex.value = 0;
  await nextTick();
  doneButtonRef.value?.focus();
}
</script>

<template>
  <div class="overlay encounter-overlay">
    <section
      ref="sheetRef"
      class="sheet"
      role="dialog"
      aria-modal="true"
      aria-label="旅途奇遇"
      tabindex="-1"
    >
      <header class="head">
        <span class="sigil"><Sparkles :size="20" aria-hidden="true" /></span>
        <span>
          <small>
            {{ storyArc ? '旅途手札' : '旅途奇遇' }} ·
            {{
              encounter
                ? `第 ${activeIndex + 1}/${stage.pendingEncounters.length} 件`
                : `待处理 ${stage.pendingEncounters.length}/3`
            }}
          </small>
          <strong>{{ encounterView?.title ?? encounter?.title ?? '奇遇已处理' }}</strong>
        </span>
        <button ref="closeButtonRef" class="close" aria-label="稍后处理" @click="requestClose">
          <X :size="18" />
        </button>
      </header>

      <template v-if="encounter">
        <nav
          v-if="stage.pendingEncounters.length > 1"
          class="encounter-nav"
          aria-label="切换待处理奇遇"
        >
          <button type="button" aria-label="查看上一个奇遇" @click="selectRelative(-1)">
            <ChevronLeft :size="16" aria-hidden="true" />
            上一个
          </button>
          <span class="num">{{ activeIndex + 1 }} / {{ stage.pendingEncounters.length }}</span>
          <button type="button" aria-label="查看下一个奇遇" @click="selectRelative(1)">
            下一个
            <ChevronRight :size="16" aria-hidden="true" />
          </button>
        </nav>
        <div v-if="storyArc" class="story-meta" aria-label="角色篇章信息">
          <span>{{ storyArc.characterName }} · {{ storyArc.episodeLabel }}</span>
          <span class="relationship">关系 · {{ relationship }}</span>
        </div>
        <p v-if="storyArc && memoryLines.length > 0 && !selectedStoryChoice" class="memory-echo">
          <Sparkles :size="14" aria-hidden="true" />
          她还记得你上次说过的话。
        </p>
        <!-- 场景舞台：背景 + 立绘 + 名牌 -->
        <div class="stage-view" :class="{ tappable: !dialogueDone }" @click="advanceDialogue">
          <Transition name="scene-swap">
            <img
              v-if="sceneUrl"
              :key="sceneUrl"
              class="scene-art"
              :src="sceneUrl"
              :alt="sceneAlt"
              :aria-hidden="sceneAlt ? undefined : 'true'"
            />
          </Transition>
          <span class="scene-veil" aria-hidden="true" />

          <Transition name="portrait-swap" mode="out-in">
            <div v-if="portraitUrl" :key="portraitUrl" class="portrait is-art">
              <img :src="portraitUrl" :alt="encounter.speaker ?? '奇遇角色'" />
            </div>
          </Transition>

          <span v-if="isClimaxScene" class="climax-badge">
            <Sparkles :size="13" aria-hidden="true" />
            记忆定格
          </span>
          <button v-if="!dialogueDone" type="button" class="skip" @click.stop="skipDialogue">
            跳过
          </button>
        </div>

        <!-- 对话区：galgame 式单行打字机 -->
        <div
          v-if="hasDialogue && currentLine"
          ref="dialogueRef"
          class="dialogue"
          :role="dialogueDone ? 'group' : 'button'"
          :tabindex="dialogueDone ? -1 : 0"
          :aria-label="dialogueAriaLabel"
          @click="advanceDialogue"
          @keydown.enter.prevent="advanceDialogue"
          @keydown.space.prevent="advanceDialogue"
        >
          <!-- 名牌做成对话框上沿的一个小标签，旁白时不显示 -->
          <span v-if="currentLine.speaker" class="nameplate">{{ currentLine.speaker }}</span>

          <p class="line" :class="{ narration: !currentLine.speaker }">
            {{ typedText }}<span v-if="isTyping" class="caret" aria-hidden="true" />
          </p>

          <span class="progress-dots" aria-hidden="true">
            <i v-for="(_, i) in dialogue" :key="i" :class="{ on: i <= lineIndex }" />
          </span>

          <span v-if="!isTyping && !isLastLine" class="tap-hint" aria-hidden="true">▼</span>
        </div>

        <p v-else class="story">{{ encounterView?.story ?? encounter.story }}</p>
        <div v-if="feedback" class="feedback" :class="`tone-${feedback.tone}`" role="status">
          {{ feedback.text }}
        </div>
        <div v-if="dialogueDone" class="choices">
          <p v-if="storyArc" class="choice-step">{{ storyStepLabel }}</p>
          <template v-if="storyArc && !selectedStoryChoice">
            <button
              v-for="choice in storyArc.storyChoices"
              :key="choice.id"
              class="choice story-choice"
              type="button"
              @click="chooseStory(choice)"
            >
              <span class="choice-title">{{ choice.label }}</span>
              <span class="choice-hint">只影响之后的对白，不影响奖励</span>
            </button>
          </template>
          <template v-else>
            <button
              v-for="choice in encounterView?.choices ?? encounter.choices"
              :key="choice.id"
              class="choice"
              :class="{ unavailable: !canAfford(choice.costs, wallet) }"
              :disabled="!canAfford(choice.costs, wallet)"
              type="button"
              @click="choose(choice)"
            >
              <span class="choice-title">{{ choice.label }}</span>
              <span class="cost">需要：{{ resourceText(choice.costs) }}</span>
              <span v-if="!canAfford(choice.costs, wallet)" class="lack">当前材料不足</span>
            </button>
          </template>
        </div>
        <p class="aside">关闭后会保留，下次再处理也可以；挂机始终继续。</p>
      </template>

      <template v-else>
        <div class="done">
          <Sparkles :size="30" aria-hidden="true" />
          <p>{{ feedback?.text || '旅途恢复了平静。' }}</p>
          <button
            ref="doneButtonRef"
            class="btn btn-pink"
            @click="stage.pendingEncounters.length > 0 ? showNextPending() : requestClose()"
          >
            {{
              stage.pendingEncounters.length > 0
                ? `查看下一件奇遇（${stage.pendingEncounters.length}）`
                : '返回挂机'
            }}
          </button>
        </div>
      </template>
    </section>
  </div>
</template>

<style scoped>
.encounter-overlay {
  align-items: flex-end;
  padding: 14px;
}
.sheet {
  width: min(100%, 390px);
  max-height: min(78dvh, 620px);
  overflow-y: auto;
  padding: 16px;
  background: linear-gradient(165deg, #fff 35%, var(--blue-soft));
  border: 1px solid rgb(255 255 255 / 85%);
  border-radius: 22px 22px 16px 16px;
  box-shadow: var(--shadow-lg);
}
.head {
  display: grid;
  grid-template-columns: auto 1fr auto;
  align-items: center;
  gap: 10px;
}
.head > span:nth-child(2) {
  display: flex;
  min-width: 0;
  flex-direction: column;
}
.head small {
  font-size: 9px;
  color: var(--text-dim);
}
.head strong {
  overflow: hidden;
  font-size: 17px;
  color: var(--text);
  text-overflow: ellipsis;
  white-space: nowrap;
}
.sigil {
  display: grid;
  width: 38px;
  height: 38px;
  place-items: center;
  color: var(--pink-deep);
  background: #fff0f6;
  border-radius: 50%;
}
.close {
  display: grid;
  width: 44px;
  height: 44px;
  place-items: center;
  color: var(--text-dim);
  background: var(--panel-2);
  border-radius: 50%;
}
.encounter-nav {
  display: grid;
  grid-template-columns: 1fr auto 1fr;
  align-items: center;
  gap: 8px;
  margin-top: 12px;
}
.encounter-nav button {
  min-height: 44px;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 4px;
  font-size: 11px;
  font-weight: 700;
  color: var(--blue-deep);
  background: rgb(255 255 255 / 82%);
  border: 1px solid var(--line);
  border-radius: var(--r-sm);
}
.encounter-nav span {
  min-width: 42px;
  font-size: 10px;
  font-weight: 800;
  color: var(--text-dim);
  text-align: center;
}
.story {
  padding: 14px;
  margin-top: 12px;
  font-size: 12px;
  line-height: 1.75;
  color: var(--text-mid);
  background: rgb(255 255 255 / 78%);
  border: 1px solid var(--line);
  border-radius: var(--r);
}
.feedback {
  padding: 9px 11px;
  margin-top: 9px;
  font-size: 11px;
  line-height: 1.55;
  border-radius: var(--r-sm);
}
.feedback.tone-success {
  color: #2e8a68;
  background: #eafaf3;
}
.feedback.tone-notice {
  color: #8a7330;
  background: #fff6e0;
}
.choices {
  display: grid;
  gap: 8px;
  margin-top: 10px;
}
.choice {
  display: flex;
  min-height: 82px;
  flex-direction: column;
  align-items: flex-start;
  gap: 3px;
  padding: 11px 12px;
  text-align: left;
  background: #fff;
  border: 1px solid var(--line);
  border-radius: var(--r);
  box-shadow: var(--shadow-sm);
}
.choice:not(:disabled):active {
  transform: scale(0.99);
}
.choice-title {
  font-size: 13px;
  font-weight: 800;
  color: var(--blue-deep);
}
.cost,
.lack {
  font-size: 10px;
  line-height: 1.45;
}
.cost {
  color: var(--text-dim);
}
.lack {
  color: var(--warn);
}
.choice.unavailable {
  color: var(--text-dim);
  background: #f7f8fa;
  box-shadow: none;
  opacity: 0.78;
}
.aside {
  margin-top: 10px;
  font-size: 9px;
  text-align: center;
  color: var(--text-dim);
}
.done {
  display: grid;
  min-height: 180px;
  place-items: center;
  align-content: center;
  gap: 14px;
  color: var(--pink-deep);
  text-align: center;
}
.done p {
  font-size: 12px;
  line-height: 1.7;
  color: var(--text-mid);
}
.done .btn {
  width: 100%;
  min-height: 44px;
}
/* ─────────────────────────────────────────
   奇遇演出（galgame 式）
   大场景舞台 + 立绘 + 底部单行打字机对话框
   ───────────────────────────────────────── */

.stage-view {
  position: relative;
  height: 190px;
  margin: 0 14px;
  border-radius: var(--r) var(--r) 0 0;
  overflow: hidden;
  background: linear-gradient(150deg, var(--blue-soft), var(--pink-soft));
}

.stage-view.tappable {
  cursor: pointer;
}

.scene-art {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  object-fit: cover;
  object-position: center 40%;
  /* 场景缓慢推近，静止画面也有呼吸感 */
  animation: scene-drift 18s ease-in-out infinite alternate;
}

.scene-swap-enter-active,
.scene-swap-leave-active {
  transition:
    opacity 0.36s ease,
    filter 0.36s ease;
}

.scene-swap-enter-from,
.scene-swap-leave-to {
  opacity: 0;
  filter: blur(3px);
}

@keyframes scene-drift {
  from {
    transform: scale(1.02) translateX(-1%);
  }
  to {
    transform: scale(1.08) translateX(1%);
  }
}

.scene-veil {
  position: absolute;
  inset: 0;
  background: linear-gradient(
    180deg,
    rgb(30 45 65 / 18%) 0%,
    rgb(30 45 65 / 4%) 40%,
    rgb(20 32 48 / 42%) 100%
  );
}

/* ── 立绘 ── */
.portrait {
  position: absolute;
  right: 2px;
  bottom: -32px;
  width: min(46%, 164px);
  /* 始终从舞台顶边开始，窄屏缩短舞台时也不会把头发裁掉。 */
  height: calc(100% + 32px);
  display: grid;
  place-items: end center;
}

.portrait.is-art img {
  width: 100%;
  height: 100%;
  object-fit: contain;
  object-position: bottom center;
  filter: drop-shadow(0 6px 14px rgb(30 45 70 / 45%));
}

.portrait-swap-enter-active,
.portrait-swap-leave-active {
  transition:
    opacity 0.2s ease,
    transform 0.2s ease,
    filter 0.2s ease;
}

.portrait-swap-enter-from {
  opacity: 0;
  transform: translateX(10px) scale(0.98);
  filter: blur(2px);
}

.portrait-swap-leave-to {
  opacity: 0;
  transform: translateX(-6px) scale(1.01);
  filter: blur(2px);
}

.climax-badge {
  position: absolute;
  top: 10px;
  left: 10px;
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 6px 10px;
  font-size: 10px;
  font-weight: 800;
  color: #fff;
  letter-spacing: 0.08em;
  background: linear-gradient(135deg, rgb(245 121 159 / 82%), rgb(94 157 218 / 82%));
  border: 1px solid rgb(255 255 255 / 68%);
  border-radius: 999px;
  box-shadow: 0 6px 18px rgb(55 72 110 / 22%);
  backdrop-filter: blur(7px);
}

.skip {
  position: absolute;
  left: 10px;
  top: 10px;
  padding: 4px 12px;
  font-size: 10px;
  font-weight: 600;
  color: #fff;
  background: rgb(30 45 65 / 52%);
  border-radius: 999px;
  backdrop-filter: blur(3px);
}

/* ── 对话框 ── */
.dialogue {
  position: relative;
  margin: 0 14px 12px;
  padding: 20px 16px 22px;
  min-height: 104px;
  background: linear-gradient(180deg, rgb(255 255 255 / 96%), rgb(248 252 255 / 98%));
  border: 1px solid var(--line);
  border-top: none;
  border-radius: 0 0 var(--r) var(--r);
  box-shadow: 0 6px 18px rgb(90 120 160 / 14%);
  cursor: pointer;
  user-select: none;
}

.dialogue:focus-visible {
  outline: 2px solid var(--pink);
  outline-offset: 2px;
}

/* 名牌骑在对话框上沿 */
.nameplate {
  position: absolute;
  left: 14px;
  top: -13px;
  padding: 4px 14px;
  font-size: 12px;
  font-weight: 700;
  color: #fff;
  background: linear-gradient(135deg, #ffb0d0, var(--pink-deep));
  border-radius: 999px;
  box-shadow: 0 3px 10px rgb(245 121 159 / 38%);
  white-space: nowrap;
}

.line {
  font-size: 14px;
  line-height: 1.85;
  color: var(--text);
  min-height: 3.7em;
}

.line.narration {
  font-size: 13px;
  color: var(--text-mid);
  font-style: italic;
}

/* 打字机光标 */
.caret {
  display: inline-block;
  width: 2px;
  height: 1em;
  margin-left: 2px;
  vertical-align: -2px;
  background: var(--pink-deep);
  animation: caret-blink 0.8s step-end infinite;
}

@keyframes caret-blink {
  0%,
  100% {
    opacity: 1;
  }
  50% {
    opacity: 0;
  }
}

/* 进度点：让玩家知道这段话还有多长 */
.progress-dots {
  position: absolute;
  left: 16px;
  bottom: 8px;
  display: flex;
  gap: 4px;
}

.progress-dots i {
  width: 5px;
  height: 5px;
  border-radius: 50%;
  background: var(--line-strong);
  transition: background 0.2s;
}

.progress-dots i.on {
  background: var(--pink);
}

.tap-hint {
  position: absolute;
  right: 14px;
  bottom: 8px;
  font-size: 11px;
  color: var(--pink-deep);
  animation: tap-bounce 1.1s ease-in-out infinite;
}

@keyframes tap-bounce {
  0%,
  100% {
    transform: translateY(0);
    opacity: 0.45;
  }
  50% {
    transform: translateY(3px);
    opacity: 1;
  }
}

.story-meta {
  display: flex;
  min-height: 40px;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  padding: 8px 12px;
  margin-top: 10px;
  font-size: 12px;
  font-weight: 750;
  color: var(--blue-deep);
  background: rgb(255 255 255 / 78%);
  border: 1px solid var(--line);
  border-radius: var(--r-sm);
}
.relationship {
  flex: none;
  padding: 4px 9px;
  color: var(--pink-deep);
  background: var(--pink-soft);
  border-radius: 999px;
}
.memory-echo {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px 11px;
  margin-top: 8px;
  font-size: 12px;
  line-height: 1.5;
  color: #81703d;
  background: #fff8df;
  border: 1px solid #f1df9e;
  border-radius: var(--r-sm);
}
.choice-step {
  margin: 2px 2px 0;
  font-size: 12px;
  font-weight: 800;
  color: var(--text-mid);
}
.choice-hint {
  font-size: 11px;
  line-height: 1.45;
  color: var(--text-dim);
}
.story-choice {
  min-height: 64px;
  border-color: rgb(245 121 159 / 30%);
  background: linear-gradient(135deg, #fff, #fff7fb);
}
.skip {
  min-width: 52px;
  min-height: 44px;
}

@media (max-width: 340px) {
  .encounter-overlay {
    padding: 8px;
  }
  .sheet {
    max-height: 88dvh;
    padding: 12px;
  }
  .stage-view,
  .dialogue {
    margin-right: 4px;
    margin-left: 4px;
  }
  .stage-view {
    height: 172px;
  }
  .story-meta {
    align-items: flex-start;
    flex-direction: column;
  }
}
@media (prefers-reduced-motion: reduce) {
  .scene-art,
  .portrait,
  .tap-hint,
  .caret {
    animation: none;
  }

  .scene-swap-enter-active,
  .scene-swap-leave-active,
  .portrait-swap-enter-active,
  .portrait-swap-leave-active {
    transition: none;
  }
}
</style>
