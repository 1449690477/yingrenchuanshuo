<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue';
import { ChevronDown, Heart, Sparkles, X } from '@lucide/vue';
import { createFocusTrap, type FocusTrap } from 'focus-trap';
import type { AffectionMood } from '@/core/affection';
import type { EncounterLine } from '@/core/encounters';
import type {
  AffectionStoryChoiceDefinition,
  AffectionStoryDefinition,
} from '@/data/affection';

const props = withDefaults(
  defineProps<{
    story: AffectionStoryDefinition;
    characterName: string;
    characterAccent: string;
    characterGlow: string;
    memoryDialogue?: readonly EncounterLine[];
    busy?: boolean;
    feedback?: string | null;
    portraitLabel?: string;
    replay?: boolean;
  }>(),
  {
    memoryDialogue: () => [],
    busy: false,
    feedback: null,
    portraitLabel: '',
    replay: false,
  },
);

const emit = defineEmits<{
  close: [];
  choose: [storyId: string, choiceId: string];
  finish: [storyId: string, choiceId: string];
}>();

type StoryPhase = 'opening' | 'response';

const dialogRef = ref<HTMLElement | null>(null);
const closeButtonRef = ref<HTMLButtonElement | null>(null);
const phase = ref<StoryPhase>('opening');
const selectedChoice = ref<AffectionStoryChoiceDefinition | null>(null);
const lineIndex = ref(0);
const typedCount = ref(0);
let typeTimer = 0;
let dialogFocusTrap: FocusTrap | null = null;

const modalStyle = computed(() => ({
  '--story-accent': props.characterAccent,
  '--story-glow': props.characterGlow,
}));
const openingDialogue = computed(() => [
  ...props.memoryDialogue.map((line) => ({ ...line })),
  ...props.story.openingDialogue.map((line) => ({ ...line })),
]);
const dialogue = computed<readonly EncounterLine[]>(() =>
  phase.value === 'response'
    ? (selectedChoice.value?.responseDialogue ?? [])
    : openingDialogue.value,
);
const currentLine = computed(() => dialogue.value[lineIndex.value] ?? null);
const isTyping = computed(() => typedCount.value < (currentLine.value?.text.length ?? 0));
const isLastLine = computed(
  () => dialogue.value.length === 0 || lineIndex.value >= dialogue.value.length - 1,
);
const dialogueDone = computed(() => isLastLine.value && !isTyping.value);
const typedText = computed(() => (currentLine.value?.text ?? '').slice(0, typedCount.value));
const responseDone = computed(() => phase.value === 'response' && dialogueDone.value);
const sceneAsset = computed(() =>
  selectedChoice.value && props.story.cgAsset ? props.story.cgAsset : props.story.backgroundAsset,
);
const sceneUrl = computed(() => `${import.meta.env.BASE_URL}${sceneAsset.value}`);
const hasMemoryEcho = computed(
  () => phase.value === 'opening' && props.memoryDialogue.length > 0,
);
const activeMood = computed<AffectionMood>(
  () => selectedChoice.value?.mood ?? 'calm',
);

const TYPE_SPEED_MS = 32;

function stopTyping(): void {
  if (!typeTimer) return;
  clearInterval(typeTimer);
  typeTimer = 0;
}

function startTyping(): void {
  stopTyping();
  typedCount.value = 0;
  const fullText = currentLine.value?.text ?? '';
  if (!fullText) return;
  if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) {
    typedCount.value = fullText.length;
    return;
  }
  typeTimer = window.setInterval(() => {
    if (typedCount.value >= fullText.length) {
      stopTyping();
      return;
    }
    typedCount.value++;
  }, TYPE_SPEED_MS);
}

function completeCurrentLine(): void {
  stopTyping();
  typedCount.value = currentLine.value?.text.length ?? 0;
}

function advanceDialogue(): void {
  if (isTyping.value) {
    completeCurrentLine();
    return;
  }
  if (!isLastLine.value) lineIndex.value++;
}

async function skipDialogue(): Promise<void> {
  lineIndex.value = Math.max(0, dialogue.value.length - 1);
  await nextTick();
  completeCurrentLine();
}

function choose(choice: AffectionStoryChoiceDefinition): void {
  if (props.busy || selectedChoice.value) return;
  selectedChoice.value = choice;
  phase.value = 'response';
  lineIndex.value = 0;
  emit('choose', props.story.id, choice.id);
}

function finishStory(): void {
  const choice = selectedChoice.value;
  if (!choice || props.busy) return;
  emit('finish', props.story.id, choice.id);
}

function requestClose(): void {
  if (props.busy) return;
  if (dialogFocusTrap?.active) {
    dialogFocusTrap.deactivate();
    return;
  }
  emit('close');
}

function resetStory(): void {
  stopTyping();
  phase.value = 'opening';
  selectedChoice.value = null;
  lineIndex.value = 0;
  typedCount.value = 0;
  nextTick(startTyping);
}

watch(currentLine, startTyping, { immediate: true });
watch(() => props.story.id, resetStory);

onMounted(async () => {
  await nextTick();
  const dialog = dialogRef.value;
  if (!dialog) return;
  dialogFocusTrap = createFocusTrap(dialog, {
    initialFocus: () => closeButtonRef.value ?? dialog,
    fallbackFocus: () => dialog,
    // busy 会在保存阶段动态变化，必须每次事件都读最新值。
    // 若这里只传挂载时的布尔快照，保存中按 Esc 会让焦点陷阱失活，
    // 但父组件又会拒绝关闭，最终留下一个无法继续键盘操作的弹窗。
    clickOutsideDeactivates: () => !props.busy,
    escapeDeactivates: () => !props.busy,
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
</script>

<template>
  <Teleport to="body">
    <Transition name="story-modal" appear>
      <div class="story-overlay" :style="modalStyle">
        <section
          ref="dialogRef"
          class="story-dialog"
          role="dialog"
          aria-modal="true"
          :aria-labelledby="`affection-story-title-${story.id}`"
          :aria-describedby="`affection-story-status-${story.id}`"
          :aria-busy="busy"
          tabindex="-1"
        >
          <header class="story-head">
            <span class="episode-seal" aria-hidden="true">
              <Heart :size="17" fill="currentColor" />
            </span>
            <span class="head-copy">
              <small>{{ characterName }} · {{ story.episodeLabel }}</small>
              <strong :id="`affection-story-title-${story.id}`">{{ story.title }}</strong>
            </span>
            <button
              ref="closeButtonRef"
              type="button"
              class="close-button"
              aria-label="暂时离开这段故事"
              :disabled="busy"
              @click="requestClose"
            >
              <X :size="19" aria-hidden="true" />
            </button>
          </header>

          <div class="story-stage" :class="[`mood-${activeMood}`, { response: selectedChoice }]">
            <img class="scene-art" :src="sceneUrl" alt="" aria-hidden="true" />
            <span class="scene-veil" aria-hidden="true" />
            <span class="scene-bloom" aria-hidden="true" />
            <span class="floating-hearts" aria-hidden="true">
              <i v-for="index in 5" :key="index">♥</i>
            </span>

            <div
              class="portrait-slot"
              :role="portraitLabel ? 'img' : undefined"
              :aria-label="portraitLabel || undefined"
            >
              <slot
                name="portrait"
                :mood="activeMood"
                :phase="phase"
                :choice-id="selectedChoice?.id ?? null"
              >
                <span class="portrait-placeholder" aria-hidden="true">
                  <Heart :size="40" fill="currentColor" />
                </span>
              </slot>
            </div>

            <p v-if="hasMemoryEcho" class="memory-echo">
              <Sparkles :size="13" aria-hidden="true" />
              她还记得你上一次的回答
            </p>

            <button
              v-if="!dialogueDone"
              type="button"
              class="skip-button"
              @click="skipDialogue"
            >
              跳过对白
            </button>
          </div>

          <div class="dialogue-area">
            <div
              v-if="currentLine"
              class="dialogue-box"
              role="button"
              tabindex="0"
              :aria-label="isTyping ? '点击立即显示整句' : '点击继续对话'"
              @click="advanceDialogue"
              @keydown.enter.prevent="advanceDialogue"
              @keydown.space.prevent="advanceDialogue"
            >
              <span v-if="currentLine.speaker" class="nameplate">
                {{ currentLine.speaker }}
              </span>
              <span v-else class="nameplate narration-label">心之手札</span>

              <p :class="{ narration: !currentLine.speaker }">
                {{ typedText }}<span v-if="isTyping" class="typing-caret" aria-hidden="true" />
              </p>

              <span class="line-progress" aria-hidden="true">
                <i
                  v-for="(_, index) in dialogue"
                  :key="index"
                  :class="{ active: index <= lineIndex }"
                />
              </span>
              <ChevronDown
                v-if="!isTyping && !isLastLine"
                class="continue-mark"
                :size="17"
                aria-hidden="true"
              />
            </div>

            <div
              v-if="phase === 'opening' && dialogueDone"
              class="choice-list"
              aria-labelledby="affection-choice-heading"
            >
              <div class="choice-heading">
                <span id="affection-choice-heading">你想怎样回应她？</span>
                <small>每个答案都被尊重，奖励不会因此变少</small>
              </div>
              <button
                v-for="(choice, index) in story.choices"
                :key="choice.id"
                type="button"
                class="choice-button"
                :disabled="busy"
                @click="choose(choice)"
              >
                <span class="choice-index">{{ index + 1 }}</span>
                <span>{{ choice.label }}</span>
                <Heart :size="15" aria-hidden="true" />
              </button>
            </div>

            <div
              v-if="feedback"
              :id="`affection-story-status-${story.id}`"
              class="story-feedback"
              role="status"
              aria-live="polite"
            >
              <Sparkles :size="14" aria-hidden="true" />
              {{ feedback }}
            </div>
            <span v-else :id="`affection-story-status-${story.id}`" class="sr-only">
              {{
                phase === 'opening'
                  ? '正在阅读剧情'
                  : busy
                    ? '正在保存选择'
                    : '正在阅读角色回应'
              }}
            </span>

            <button
              v-if="responseDone"
              type="button"
              class="finish-button"
              :disabled="busy"
              @click="finishStory"
            >
              <Heart :size="17" fill="currentColor" aria-hidden="true" />
              {{
                busy
                  ? '正在珍藏这段回忆…'
                  : replay
                    ? '结束这次回忆'
                    : `珍藏回忆 · +${story.completionPoints} 心意`
              }}
            </button>
          </div>
        </section>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.story-overlay {
  --story-accent: #ff7fa6;
  --story-glow: #ffd6e4;
  position: fixed;
  z-index: 240;
  inset: 0;
  width: 100%;
  max-width: var(--app-max-w);
  margin: 0 auto;
  display: grid;
  place-items: end center;
  padding: max(8px, var(--sat)) 8px max(8px, var(--sab));
  background: rgb(25 29 46 / 68%);
  backdrop-filter: blur(7px);
  -webkit-backdrop-filter: blur(7px);
}

.story-dialog {
  width: min(100%, 390px);
  max-height: calc(100dvh - var(--sat) - var(--sab) - 16px);
  display: flex;
  flex-direction: column;
  overflow: hidden;
  background:
    radial-gradient(circle at 100% 0%, color-mix(in srgb, var(--story-glow) 50%, transparent), transparent 35%),
    linear-gradient(160deg, #fff, #fff8fb 58%, #eef7ff);
  border: 1px solid rgb(255 255 255 / 82%);
  border-radius: 24px 24px 18px 18px;
  box-shadow:
    0 28px 70px rgb(24 27 43 / 42%),
    0 0 32px color-mix(in srgb, var(--story-accent) 22%, transparent);
}

.story-head {
  min-height: 64px;
  flex: 0 0 auto;
  display: grid;
  grid-template-columns: 39px minmax(0, 1fr) 44px;
  align-items: center;
  gap: 8px;
  padding: 8px 10px 8px 13px;
  background: rgb(255 255 255 / 88%);
  border-bottom: 1px solid var(--line);
}

.episode-seal {
  display: grid;
  width: 39px;
  height: 39px;
  place-items: center;
  color: #fff;
  background: linear-gradient(145deg, var(--story-accent), #aa83dd);
  border: 2px solid #fff;
  border-radius: 14px;
  box-shadow: 0 4px 11px color-mix(in srgb, var(--story-accent) 32%, transparent);
}

.head-copy {
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.head-copy small {
  overflow: hidden;
  font-size: 8px;
  font-weight: 800;
  color: var(--story-accent);
  text-overflow: ellipsis;
  white-space: nowrap;
}

.head-copy strong {
  overflow: hidden;
  font-size: 15px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.close-button {
  width: 44px;
  height: 44px;
  display: grid;
  place-items: center;
  color: var(--text-mid);
  background: var(--panel-3);
  border: 1px solid var(--line);
  border-radius: 50%;
}

.story-stage {
  position: relative;
  min-height: clamp(216px, 37dvh, 310px);
  flex: 1 1 310px;
  overflow: hidden;
  isolation: isolate;
  background: #eaf4ff;
}

.scene-art,
.scene-veil,
.scene-bloom {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
}

.scene-art {
  z-index: -4;
  object-fit: cover;
  transition:
    opacity 0.35s var(--ease-soft),
    transform 1.5s var(--ease-soft);
}

.story-stage.response .scene-art {
  transform: scale(1.025);
}

.scene-veil {
  z-index: -3;
  background:
    linear-gradient(0deg, rgb(26 31 48 / 43%), transparent 47%),
    radial-gradient(circle at 65% 36%, transparent 26%, rgb(42 42 66 / 16%));
}

.scene-bloom {
  z-index: -2;
  opacity: 0.58;
  background:
    radial-gradient(circle at 76% 27%, var(--story-glow), transparent 25%),
    radial-gradient(circle at 18% 72%, color-mix(in srgb, var(--story-accent) 28%, transparent), transparent 23%);
  mix-blend-mode: screen;
}

.portrait-slot {
  position: absolute;
  inset: 4% 3% 0 31%;
  display: grid;
  place-items: end center;
  pointer-events: none;
}

.portrait-slot :deep(> *) {
  max-width: 100%;
  max-height: 100%;
}

.portrait-placeholder {
  display: grid;
  width: 92px;
  height: 92px;
  margin-bottom: 24px;
  place-items: center;
  color: var(--story-accent);
  background: rgb(255 255 255 / 68%);
  border: 1px solid rgb(255 255 255 / 84%);
  border-radius: 50%;
  box-shadow: 0 0 28px var(--story-glow);
}

.memory-echo,
.skip-button {
  position: absolute;
  top: 10px;
  min-height: 36px;
  display: flex;
  align-items: center;
  z-index: 2;
  font-size: 8px;
  font-weight: 800;
  color: #fff;
  background: rgb(50 44 69 / 54%);
  border: 1px solid rgb(255 255 255 / 36%);
  border-radius: 999px;
  backdrop-filter: blur(9px);
}

.memory-echo {
  left: 10px;
  gap: 5px;
  max-width: 64%;
  padding: 7px 10px;
}

.skip-button {
  right: 10px;
  min-width: 82px;
  justify-content: center;
  padding: 0 10px;
}

.floating-hearts {
  position: absolute;
  inset: 0;
  z-index: -1;
  overflow: hidden;
  color: var(--story-accent);
  pointer-events: none;
}

.floating-hearts i {
  position: absolute;
  bottom: -20px;
  font-size: 10px;
  font-style: normal;
  opacity: 0;
  filter: drop-shadow(0 0 5px var(--story-glow));
  animation: heart-float 4.8s ease-in infinite;
}

.floating-hearts i:nth-child(1) {
  left: 9%;
}

.floating-hearts i:nth-child(2) {
  left: 27%;
  animation-delay: -1.5s;
}

.floating-hearts i:nth-child(3) {
  left: 53%;
  animation-delay: -3.1s;
}

.floating-hearts i:nth-child(4) {
  left: 78%;
  animation-delay: -0.7s;
}

.floating-hearts i:nth-child(5) {
  left: 91%;
  animation-delay: -2.4s;
}

.dialogue-area {
  position: relative;
  z-index: 3;
  flex: 0 0 auto;
  min-height: 154px;
  max-height: min(45dvh, 380px);
  padding: 0 11px calc(11px + var(--sab));
  overflow-y: auto;
  background: rgb(255 255 255 / 93%);
  overscroll-behavior: contain;
}

.dialogue-box {
  position: relative;
  min-height: 132px;
  padding: 27px 13px 23px;
  margin-top: -10px;
  color: #584653;
  background:
    linear-gradient(145deg, rgb(255 255 255 / 96%), rgb(255 246 251 / 96%)) padding-box,
    linear-gradient(100deg, var(--story-accent), #ffd474, #83cdee) border-box;
  border: 1px solid transparent;
  border-radius: 17px;
  box-shadow: 0 8px 23px rgb(46 48 70 / 15%);
  cursor: pointer;
}

.dialogue-box:focus-visible {
  outline: 3px solid color-mix(in srgb, var(--story-accent) 34%, transparent);
  outline-offset: 2px;
}

.nameplate {
  position: absolute;
  top: -13px;
  left: 12px;
  min-height: 30px;
  display: flex;
  align-items: center;
  padding: 5px 13px;
  font-size: 10px;
  font-weight: 900;
  color: #fff;
  background: linear-gradient(120deg, var(--story-accent), #a27fd7);
  border: 2px solid #fff;
  border-radius: 999px;
  box-shadow: 0 4px 10px color-mix(in srgb, var(--story-accent) 25%, transparent);
}

.nameplate.narration-label {
  color: #755f72;
  background: #fff4f8;
}

.dialogue-box p {
  min-height: 48px;
  font-size: 12px;
  line-height: 1.8;
}

.dialogue-box p.narration {
  color: var(--text-mid);
  font-style: italic;
}

.typing-caret {
  display: inline-block;
  width: 2px;
  height: 1.1em;
  margin-left: 2px;
  vertical-align: -0.16em;
  background: var(--story-accent);
  animation: caret-blink 0.75s steps(1) infinite;
}

.line-progress {
  position: absolute;
  bottom: 11px;
  left: 13px;
  display: flex;
  gap: 4px;
}

.line-progress i {
  width: 5px;
  height: 3px;
  background: var(--line);
  border-radius: 999px;
}

.line-progress i.active {
  width: 11px;
  background: var(--story-accent);
}

.continue-mark {
  position: absolute;
  right: 12px;
  bottom: 8px;
  color: var(--story-accent);
  animation: continue-bob 0.9s ease-in-out infinite alternate;
}

.choice-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding-top: 13px;
}

.choice-heading {
  display: flex;
  flex-direction: column;
  gap: 2px;
  padding: 0 2px;
}

.choice-heading span {
  font-size: 12px;
  font-weight: 900;
  color: #695064;
}

.choice-heading small {
  font-size: 8px;
  color: var(--text-dim);
}

.choice-button {
  min-height: 58px;
  display: grid;
  grid-template-columns: 27px minmax(0, 1fr) 18px;
  align-items: center;
  gap: 8px;
  padding: 8px 10px;
  color: #675163;
  text-align: left;
  background: linear-gradient(145deg, #fff, #fff8fb);
  border: 1px solid color-mix(in srgb, var(--story-accent) 24%, var(--line));
  border-radius: 14px;
  box-shadow: 0 3px 9px rgb(77 65 87 / 7%);
  transition:
    transform var(--t-fast) var(--ease-spring),
    border-color var(--t-fast) var(--ease-soft);
}

.choice-button:not(:disabled):active {
  transform: scale(0.975);
  border-color: var(--story-accent);
}

.choice-index {
  display: grid;
  width: 27px;
  height: 27px;
  place-items: center;
  font-size: 9px;
  font-weight: 900;
  color: var(--story-accent);
  background: color-mix(in srgb, var(--story-glow) 52%, white);
  border-radius: 9px;
}

.choice-button > span:nth-child(2) {
  font-size: 10px;
  line-height: 1.55;
}

.choice-button svg {
  color: var(--story-accent);
}

.story-feedback {
  display: flex;
  align-items: flex-start;
  gap: 6px;
  padding: 9px 11px;
  margin-top: 9px;
  font-size: 9px;
  line-height: 1.55;
  color: #337a64;
  background: #eaf9f3;
  border: 1px solid #c9eadc;
  border-radius: 12px;
}

.finish-button {
  width: 100%;
  min-height: 50px;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 7px;
  margin-top: 10px;
  color: #fff;
  font-size: 11px;
  font-weight: 900;
  background: linear-gradient(120deg, var(--story-accent), #aa7edb 58%, #72bde7);
  border: 1px solid rgb(255 255 255 / 62%);
  border-radius: 15px;
  box-shadow: 0 7px 18px color-mix(in srgb, var(--story-accent) 30%, transparent);
}

.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border: 0;
}

@keyframes heart-float {
  0% {
    opacity: 0;
    transform: translateY(0) scale(0.7) rotate(-8deg);
  }
  20% {
    opacity: 0.65;
  }
  100% {
    opacity: 0;
    transform: translateY(-260px) scale(1.18) rotate(12deg);
  }
}

@keyframes caret-blink {
  50% {
    opacity: 0;
  }
}

@keyframes continue-bob {
  to {
    transform: translateY(3px);
  }
}

.story-modal-enter-active,
.story-modal-leave-active {
  transition: opacity 0.22s var(--ease-soft);
}

.story-modal-enter-active .story-dialog,
.story-modal-leave-active .story-dialog {
  transition: transform 0.28s var(--ease-spring);
}

.story-modal-enter-from,
.story-modal-leave-to {
  opacity: 0;
}

.story-modal-enter-from .story-dialog,
.story-modal-leave-to .story-dialog {
  transform: translateY(22px) scale(0.975);
}

@media (max-width: 350px) {
  .story-overlay {
    padding-right: 5px;
    padding-left: 5px;
  }

  .story-stage {
    min-height: clamp(190px, 32dvh, 250px);
  }

  .dialogue-area {
    padding-right: 8px;
    padding-left: 8px;
  }

  .dialogue-box {
    min-height: 120px;
    padding-right: 10px;
    padding-left: 10px;
  }
}

@media (prefers-reduced-motion: reduce) {
  .floating-hearts i,
  .typing-caret,
  .continue-mark {
    animation: none;
  }

  .scene-art,
  .choice-button,
  .story-modal-enter-active,
  .story-modal-leave-active,
  .story-modal-enter-active .story-dialog,
  .story-modal-leave-active .story-dialog {
    transition: none;
  }
}
</style>
