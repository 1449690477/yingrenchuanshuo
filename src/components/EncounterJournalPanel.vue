<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue';
import { BookOpen, ChevronLeft, Play, Sparkles, X } from '@lucide/vue';
import { createFocusTrap, type FocusTrap } from 'focus-trap';
import {
  portraitCueAtLine,
  type EncounterJournalCharacter,
  type EncounterLine,
} from '@/core/encounters';
import { requireEncounter } from '@/data/encounters';
import { journalPortraitCue, requireEncounterPortraitAsset } from '@/data/encounterVisuals';
import { useStageStore } from '@/stores/stage';

const emit = defineEmits<{ close: [] }>();
const stage = useStageStore();

const selectedCharacterId = ref<string | null>(stage.encounterJournal[0]?.characterId ?? null);
const replayEncounterId = ref<string | null>(null);
const replayTriggerEncounterId = ref<string | null>(null);
const lineIndex = ref(0);
const typedCount = ref(0);
const sheetRef = ref<HTMLElement | null>(null);
const closeButtonRef = ref<HTMLButtonElement | null>(null);
let typeTimer = 0;
let dialogFocusTrap: FocusTrap | null = null;

const characters = computed(() => stage.encounterJournal);
const selectedCharacter = computed<EncounterJournalCharacter | null>(() => {
  const selected = characters.value.find(
    (character) => character.characterId === selectedCharacterId.value,
  );
  return selected ?? characters.value[0] ?? null;
});
const replayDefinition = computed(() =>
  replayEncounterId.value ? requireEncounter(replayEncounterId.value) : null,
);
const replayLines = computed<EncounterLine[]>(() =>
  replayEncounterId.value ? stage.replayEncounterStory(replayEncounterId.value) : [],
);
const currentLine = computed(() => replayLines.value[lineIndex.value] ?? null);
const isLastLine = computed(
  () => replayLines.value.length === 0 || lineIndex.value >= replayLines.value.length - 1,
);
const typedText = computed(() => (currentLine.value?.text ?? '').slice(0, typedCount.value));
const isTyping = computed(() => typedCount.value < (currentLine.value?.text.length ?? 0));
const replayDone = computed(() => isLastLine.value && !isTyping.value);
const replayDialogueAriaLabel = computed(() => {
  const line = currentLine.value;
  if (!line) return '';
  const speaker = line.speaker ? `${line.speaker}：` : '旁白：';
  const instruction = isTyping.value
    ? '按回车立即显示整句'
    : replayDone.value
      ? '本段回顾已读完'
      : '按回车继续回顾';
  return `${speaker}${line.text} ${instruction}`;
});
const replayIsClimax = computed(
  () => Boolean(replayDefinition.value?.climaxAsset) && replayDone.value,
);
const replaySceneUrl = computed(() => {
  const definition = replayDefinition.value;
  if (!definition) return null;
  const asset =
    replayIsClimax.value && definition.climaxAsset ? definition.climaxAsset : definition.sceneAsset;
  return `${import.meta.env.BASE_URL}${asset}`;
});
const replaySceneAlt = computed(() =>
  replayIsClimax.value ? (replayDefinition.value?.climaxAlt ?? '') : '',
);
const replayPortraitCue = computed(() => {
  const definition = replayDefinition.value;
  if (!definition) return null;
  return portraitCueAtLine(definition.initialPortrait, replayLines.value, lineIndex.value);
});
const replayPortraitUrl = computed(() => {
  if (replayIsClimax.value || !replayPortraitCue.value) return null;
  return `${import.meta.env.BASE_URL}${requireEncounterPortraitAsset(replayPortraitCue.value)}`;
});

function journalPortraitUrl(characterId: string): string {
  const asset = requireEncounterPortraitAsset(journalPortraitCue(characterId));
  return `${import.meta.env.BASE_URL}${asset}`;
}

const TYPE_SPEED_MS = 34;

function stopTyping(): void {
  if (!typeTimer) return;
  clearInterval(typeTimer);
  typeTimer = 0;
}

function startTyping(): void {
  stopTyping();
  typedCount.value = 0;
  const text = currentLine.value?.text ?? '';
  if (!text) return;
  if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) {
    typedCount.value = text.length;
    return;
  }
  typeTimer = window.setInterval(() => {
    if (typedCount.value >= text.length) {
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

function advanceReplay(): void {
  if (isTyping.value) {
    completeLine();
    return;
  }
  if (!isLastLine.value) lineIndex.value++;
}

async function skipReplay(): Promise<void> {
  lineIndex.value = Math.max(0, replayLines.value.length - 1);
  await nextTick();
  completeLine();
}

async function openReplay(encounterId: string): Promise<void> {
  replayTriggerEncounterId.value = encounterId;
  replayEncounterId.value = encounterId;
  lineIndex.value = 0;
  await nextTick();
  closeButtonRef.value?.focus();
}

async function closeReplay(): Promise<void> {
  const triggerEncounterId = replayTriggerEncounterId.value;
  replayEncounterId.value = null;
  lineIndex.value = 0;
  await nextTick();
  replayTriggerEncounterId.value = null;
  if (!triggerEncounterId) return;
  sheetRef.value
    ?.querySelector<HTMLButtonElement>(`[data-replay-encounter-id="${triggerEncounterId}"]`)
    ?.focus();
}

function closePanel(): void {
  if (replayEncounterId.value) void closeReplay();
  else if (dialogFocusTrap?.active) dialogFocusTrap.deactivate();
  else emit('close');
}

watch(currentLine, startTyping, { immediate: true });
watch(characters, (next) => {
  if (!next.some((character) => character.characterId === selectedCharacterId.value)) {
    selectedCharacterId.value = next[0]?.characterId ?? null;
  }
});

onMounted(async () => {
  await nextTick();
  const sheet = sheetRef.value;
  if (!sheet) return;
  dialogFocusTrap = createFocusTrap(sheet, {
    initialFocus: () => closeButtonRef.value ?? sheet,
    fallbackFocus: () => sheet,
    escapeDeactivates: false,
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
</script>

<template>
  <div class="overlay journal-overlay" @keydown.esc="closePanel">
    <section
      ref="sheetRef"
      class="journal-sheet"
      role="dialog"
      aria-modal="true"
      aria-label="旅途手札"
      tabindex="-1"
    >
      <header class="journal-head">
        <span class="book-seal"><BookOpen :size="20" aria-hidden="true" /></span>
        <span class="head-copy">
          <small>{{ replayDefinition ? '无奖励回顾' : '同行者的记忆' }}</small>
          <strong>{{ replayDefinition?.title ?? '旅途手札' }}</strong>
        </span>
        <button
          ref="closeButtonRef"
          class="icon-button"
          :aria-label="replayDefinition ? '返回手札' : '关闭手札'"
          @click="closePanel"
        >
          <ChevronLeft v-if="replayDefinition" :size="19" aria-hidden="true" />
          <X v-else :size="19" aria-hidden="true" />
        </button>
      </header>

      <template v-if="!replayDefinition">
        <p class="journal-intro">
          有些相遇不会变成战利品，却会留在旅途中。这里记着她们与你说过的话。
        </p>

        <nav v-if="characters.length > 1" class="character-tabs" aria-label="选择角色">
          <button
            v-for="character in characters"
            :key="character.characterId"
            type="button"
            :class="{ active: selectedCharacter?.characterId === character.characterId }"
            :aria-pressed="selectedCharacter?.characterId === character.characterId"
            @click="selectedCharacterId = character.characterId"
          >
            <img
              class="tab-portrait"
              :src="journalPortraitUrl(character.characterId)"
              alt=""
              aria-hidden="true"
            />
            {{ character.characterName }}
          </button>
        </nav>

        <template v-if="selectedCharacter">
          <section class="character-card">
            <img
              class="character-portrait"
              :src="journalPortraitUrl(selectedCharacter.characterId)"
              :alt="selectedCharacter.characterName"
            />
            <span class="character-copy">
              <small>旅途中遇见</small>
              <strong>{{ selectedCharacter.characterName }}</strong>
              <span>{{ selectedCharacter.completedEpisodes.length }} 幕记忆已经写下</span>
            </span>
            <span class="bond-ribbon">{{ selectedCharacter.relationship }}</span>
          </section>

          <div v-if="selectedCharacter.completedEpisodes.length" class="episode-list">
            <p class="section-kicker"><Sparkles :size="14" aria-hidden="true" /> 已写下的篇章</p>
            <button
              v-for="episode in selectedCharacter.completedEpisodes"
              :key="episode.encounterId"
              type="button"
              class="episode-card"
              :data-replay-encounter-id="episode.encounterId"
              @click="openReplay(episode.encounterId)"
            >
              <span class="episode-index">{{ episode.episodeLabel }}</span>
              <strong>{{ episode.title }}</strong>
              <q>{{ episode.answerLabel }}</q>
              <span class="replay-label"><Play :size="14" aria-hidden="true" /> 重温</span>
            </button>
          </div>

          <div v-else class="pending-memory">
            <Sparkles :size="24" aria-hidden="true" />
            <strong>初次相遇仍在旅途中</strong>
            <span>处理完她的奇遇后，这一页会记下你当时的回答。</span>
          </div>
        </template>

        <p class="journal-note">回顾不会消耗材料，也不会再次获得奖励；挂机始终继续。</p>
      </template>

      <template v-else>
        <div class="replay-stage" :class="{ tappable: !replayDone }" @click="advanceReplay">
          <Transition name="replay-scene">
            <img
              v-if="replaySceneUrl"
              :key="replaySceneUrl"
              class="replay-scene-art"
              :src="replaySceneUrl"
              :alt="replaySceneAlt"
              :aria-hidden="replaySceneAlt ? undefined : 'true'"
            />
          </Transition>
          <span class="replay-veil" aria-hidden="true" />
          <Transition name="replay-portrait" mode="out-in">
            <img
              v-if="replayPortraitUrl"
              :key="replayPortraitUrl"
              class="replay-portrait"
              :src="replayPortraitUrl"
              :alt="replayDefinition.speaker ?? '奇遇角色'"
            />
          </Transition>
          <span v-if="replayIsClimax" class="replay-climax">
            <Sparkles :size="13" aria-hidden="true" />
            记忆定格
          </span>
          <button v-if="!replayDone" type="button" class="replay-skip" @click.stop="skipReplay">
            跳过
          </button>
        </div>

        <div
          v-if="currentLine"
          class="replay-dialogue"
          :role="replayDone ? 'group' : 'button'"
          :tabindex="replayDone ? -1 : 0"
          :aria-label="replayDialogueAriaLabel"
          @click="advanceReplay"
          @keydown.enter.prevent="advanceReplay"
          @keydown.space.prevent="advanceReplay"
        >
          <span v-if="currentLine.speaker" class="replay-name">{{ currentLine.speaker }}</span>
          <p :class="{ narration: !currentLine.speaker }">
            {{ typedText }}<span v-if="isTyping" class="replay-caret" aria-hidden="true" />
          </p>
          <span class="replay-dots" aria-hidden="true">
            <i v-for="(_, index) in replayLines" :key="index" :class="{ on: index <= lineIndex }" />
          </span>
        </div>

        <div class="replay-footer">
          <span><Sparkles :size="14" aria-hidden="true" /> 这是一段记忆，不会再次结算奖励</span>
          <button v-if="replayDone" type="button" @click="closeReplay">回到手札</button>
        </div>
      </template>
    </section>
  </div>
</template>

<style scoped>
.journal-overlay {
  align-items: flex-end;
  padding: 0.875rem;
}
.journal-sheet {
  width: min(100%, 24.375rem);
  max-height: min(82dvh, 42rem);
  padding: 1rem;
  overflow-x: hidden;
  overflow-y: auto;
  background:
    radial-gradient(circle at 92% 8%, rgb(255 202 224 / 34%), transparent 28%),
    linear-gradient(165deg, #fff 28%, #f5fbff 72%, #fff4f9);
  border: 1px solid rgb(255 255 255 / 90%);
  border-radius: 1.5rem 1.5rem 1rem 1rem;
  box-shadow: var(--shadow-lg);
}
.journal-head {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) auto;
  align-items: center;
  gap: 0.625rem;
}
.book-seal,
.icon-button {
  display: grid;
  width: 2.75rem;
  height: 2.75rem;
  place-items: center;
  border-radius: 50%;
}
.book-seal {
  color: var(--pink-deep);
  background: linear-gradient(145deg, #fff, #ffe7f1);
  box-shadow: 0 0.25rem 0.875rem rgb(245 121 159 / 18%);
}
.icon-button {
  color: var(--text-mid);
  background: rgb(255 255 255 / 78%);
  border: 1px solid var(--line);
}
.head-copy {
  display: flex;
  min-width: 0;
  flex-direction: column;
}
.head-copy small {
  font-size: 0.75rem;
  color: var(--text-dim);
}
.head-copy strong {
  overflow: hidden;
  font-size: 1.125rem;
  color: var(--text);
  text-overflow: ellipsis;
  white-space: nowrap;
}
.journal-intro {
  padding: 0.75rem 0.875rem;
  margin-top: 0.75rem;
  font-size: 0.875rem;
  line-height: 1.65;
  color: var(--text-mid);
  background: rgb(255 255 255 / 68%);
  border-left: 3px solid var(--pink);
  border-radius: 0 var(--r-sm) var(--r-sm) 0;
}
.character-tabs {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0.5rem;
  margin-top: 0.75rem;
}
.character-tabs button {
  display: flex;
  min-width: 0;
  min-height: 2.75rem;
  align-items: center;
  justify-content: center;
  gap: 0.375rem;
  padding: 0.5rem;
  overflow: hidden;
  font-size: 0.8125rem;
  font-weight: 750;
  color: var(--text-mid);
  text-overflow: ellipsis;
  white-space: nowrap;
  background: rgb(255 255 255 / 74%);
  border: 1px solid var(--line);
  border-radius: 999px;
}
.character-tabs button.active {
  color: var(--pink-deep);
  background: #fff0f6;
  border-color: rgb(245 121 159 / 30%);
  box-shadow: 0 0.25rem 0.75rem rgb(245 121 159 / 12%);
}
.tab-portrait {
  width: 1.75rem;
  height: 2rem;
  flex: none;
  object-fit: contain;
  object-position: bottom center;
  filter: drop-shadow(0 0.2rem 0.25rem rgb(50 75 105 / 20%));
}
.character-card {
  position: relative;
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) auto;
  align-items: center;
  gap: 0.75rem;
  min-height: 6.5rem;
  padding: 0.875rem;
  margin-top: 0.75rem;
  overflow: hidden;
  background:
    linear-gradient(115deg, rgb(255 255 255 / 96%), rgb(239 248 255 / 86%)), var(--blue-soft);
  border: 1px solid var(--line);
  border-radius: 1rem;
  box-shadow: var(--shadow-sm);
}
.character-card::after {
  position: absolute;
  right: -1.2rem;
  bottom: -1.8rem;
  width: 5.5rem;
  height: 5.5rem;
  content: '';
  background: radial-gradient(circle, rgb(255 184 214 / 23%), transparent 68%);
  border-radius: 50%;
  pointer-events: none;
}
.character-portrait {
  width: 4rem;
  height: 5rem;
  object-fit: contain;
  object-position: bottom center;
  background: radial-gradient(circle at 50% 35%, #fff, var(--pink-soft) 58%, var(--blue-soft));
  border: 3px solid rgb(255 255 255 / 86%);
  border-radius: 1rem;
  box-shadow: 0 0.4rem 1rem rgb(70 105 145 / 18%);
}
.character-copy {
  display: flex;
  min-width: 0;
  flex-direction: column;
}
.character-copy small,
.character-copy span {
  font-size: 0.75rem;
  color: var(--text-dim);
}
.character-copy strong {
  font-size: 1rem;
  color: var(--text);
}
.bond-ribbon {
  position: relative;
  z-index: 1;
  align-self: start;
  padding: 0.3rem 0.625rem;
  font-size: 0.75rem;
  font-weight: 800;
  color: var(--pink-deep);
  background: #fff0f6;
  border-radius: 999px;
}
.section-kicker {
  display: flex;
  align-items: center;
  gap: 0.35rem;
  margin: 0.875rem 0 0.5rem;
  font-size: 0.8125rem;
  font-weight: 800;
  color: var(--text-mid);
}
.episode-list {
  display: grid;
  gap: 0.5rem;
}
.episode-card {
  position: relative;
  display: flex;
  min-height: 6.5rem;
  flex-direction: column;
  align-items: flex-start;
  gap: 0.25rem;
  padding: 0.75rem 4.25rem 0.75rem 0.875rem;
  text-align: left;
  background: rgb(255 255 255 / 88%);
  border: 1px solid var(--line);
  border-radius: 0.875rem;
  box-shadow: var(--shadow-sm);
}
.episode-card:active {
  transform: scale(0.992);
}
.episode-index {
  font-size: 0.75rem;
  font-weight: 750;
  color: var(--blue-deep);
}
.episode-card strong {
  font-size: 0.9375rem;
  color: var(--text);
}
.episode-card q {
  display: -webkit-box;
  overflow: hidden;
  font-size: 0.8125rem;
  line-height: 1.5;
  color: var(--text-dim);
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
}
.replay-label {
  position: absolute;
  right: 0.75rem;
  top: 50%;
  display: flex;
  min-height: 2.75rem;
  align-items: center;
  gap: 0.25rem;
  font-size: 0.75rem;
  font-weight: 800;
  color: var(--pink-deep);
  transform: translateY(-50%);
}
.pending-memory {
  display: grid;
  min-height: 9rem;
  place-items: center;
  align-content: center;
  gap: 0.35rem;
  padding: 1rem;
  margin-top: 0.875rem;
  color: var(--pink-deep);
  text-align: center;
  background: rgb(255 255 255 / 62%);
  border: 1px dashed var(--line-strong);
  border-radius: 1rem;
}
.pending-memory strong {
  font-size: 0.9375rem;
}
.pending-memory span,
.journal-note {
  font-size: 0.8125rem;
  line-height: 1.55;
  color: var(--text-dim);
}
.journal-note {
  margin-top: 0.75rem;
  text-align: center;
}
.replay-stage {
  position: relative;
  height: 12rem;
  margin-top: 0.75rem;
  overflow: hidden;
  background: linear-gradient(145deg, var(--blue-soft), var(--pink-soft));
  border-radius: 1rem 1rem 0 0;
}
.replay-stage.tappable {
  cursor: pointer;
}
.replay-scene-art {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  object-fit: cover;
  object-position: center 40%;
  animation: memory-drift 18s ease-in-out infinite alternate;
}
.replay-scene-enter-active,
.replay-scene-leave-active {
  transition:
    opacity 0.36s ease,
    filter 0.36s ease;
}
.replay-scene-enter-from,
.replay-scene-leave-to {
  opacity: 0;
  filter: blur(3px);
}
.replay-veil {
  position: absolute;
  inset: 0;
  background: linear-gradient(180deg, rgb(25 40 60 / 10%), rgb(25 40 60 / 42%));
}
.replay-portrait {
  position: absolute;
  right: 0.125rem;
  bottom: -2rem;
  width: min(46%, 10.25rem);
  /* 与舞台高度联动，320px 窄屏不会沿用桌面高度把头顶推出裁切区。 */
  height: calc(100% + 2rem);
  object-fit: contain;
  object-position: bottom center;
  filter: drop-shadow(0 0.45rem 0.9rem rgb(25 40 60 / 36%));
}
.replay-portrait-enter-active,
.replay-portrait-leave-active {
  transition:
    opacity 0.2s ease,
    transform 0.2s ease,
    filter 0.2s ease;
}
.replay-portrait-enter-from {
  opacity: 0;
  transform: translateX(0.625rem) scale(0.98);
  filter: blur(2px);
}
.replay-portrait-leave-to {
  opacity: 0;
  transform: translateX(-0.375rem) scale(1.01);
  filter: blur(2px);
}
.replay-climax {
  position: absolute;
  top: 0.625rem;
  left: 0.625rem;
  display: inline-flex;
  align-items: center;
  gap: 0.3rem;
  padding: 0.375rem 0.625rem;
  font-size: 0.625rem;
  font-weight: 800;
  color: #fff;
  letter-spacing: 0.08em;
  background: linear-gradient(135deg, rgb(245 121 159 / 82%), rgb(94 157 218 / 82%));
  border: 1px solid rgb(255 255 255 / 68%);
  border-radius: 999px;
  box-shadow: 0 0.375rem 1rem rgb(55 72 110 / 22%);
  backdrop-filter: blur(7px);
}
.replay-skip {
  position: absolute;
  top: 0.625rem;
  left: 0.625rem;
  min-width: 3.25rem;
  min-height: 2.75rem;
  color: #fff;
  background: rgb(25 40 60 / 52%);
  border-radius: 999px;
  backdrop-filter: blur(3px);
}
.replay-dialogue {
  position: relative;
  min-height: 8.25rem;
  padding: 1.4rem 1rem 1.6rem;
  cursor: pointer;
  user-select: none;
  background: linear-gradient(180deg, rgb(255 255 255 / 98%), rgb(247 252 255 / 98%));
  border: 1px solid var(--line);
  border-top: none;
  border-radius: 0 0 1rem 1rem;
  box-shadow: 0 0.4rem 1rem rgb(70 105 145 / 12%);
}
.replay-dialogue:focus-visible {
  outline: 2px solid var(--pink);
  outline-offset: 2px;
}
.replay-name {
  position: absolute;
  top: -0.8rem;
  left: 0.875rem;
  padding: 0.3rem 0.875rem;
  font-size: 0.8125rem;
  font-weight: 750;
  color: #fff;
  background: linear-gradient(135deg, #ffb0d0, var(--pink-deep));
  border-radius: 999px;
}
.replay-dialogue p {
  min-height: 4em;
  font-size: 1rem;
  line-height: 1.75;
  color: var(--text);
}
.replay-dialogue p.narration {
  color: var(--text-mid);
  font-style: italic;
}
.replay-caret {
  display: inline-block;
  width: 2px;
  height: 1em;
  margin-left: 2px;
  vertical-align: -2px;
  background: var(--pink-deep);
  animation: memory-caret 0.8s step-end infinite;
}
.replay-dots {
  position: absolute;
  bottom: 0.6rem;
  left: 1rem;
  display: flex;
  flex-wrap: wrap;
  gap: 0.25rem;
  max-width: calc(100% - 2rem);
}
.replay-dots i {
  width: 0.3rem;
  height: 0.3rem;
  background: var(--line-strong);
  border-radius: 50%;
}
.replay-dots i.on {
  background: var(--pink);
}
.replay-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
  margin-top: 0.75rem;
}
.replay-footer > span {
  display: flex;
  min-width: 0;
  align-items: center;
  gap: 0.3rem;
  font-size: 0.75rem;
  line-height: 1.45;
  color: var(--text-dim);
}
.replay-footer button {
  min-width: 6.5rem;
  min-height: 2.75rem;
  flex: none;
  font-size: 0.8125rem;
  font-weight: 800;
  color: #fff;
  background: linear-gradient(135deg, var(--pink), var(--pink-deep));
  border-radius: 999px;
}
@keyframes memory-drift {
  from {
    transform: scale(1.02) translateX(-1%);
  }
  to {
    transform: scale(1.08) translateX(1%);
  }
}
@keyframes memory-caret {
  0%,
  100% {
    opacity: 1;
  }
  50% {
    opacity: 0;
  }
}
@media (max-width: 340px) {
  .journal-overlay {
    padding: 0.5rem;
  }
  .journal-sheet {
    max-height: 88dvh;
    padding: 0.75rem;
  }
  .character-card {
    grid-template-columns: auto minmax(0, 1fr);
  }
  .bond-ribbon {
    grid-column: 2;
    justify-self: start;
  }
  .replay-stage {
    height: 10.75rem;
  }
  .replay-footer {
    align-items: stretch;
    flex-direction: column;
  }
  .replay-footer button {
    width: 100%;
  }
}
@media (prefers-reduced-motion: reduce) {
  .replay-scene-art,
  .replay-caret {
    animation: none;
  }
  .replay-scene-enter-active,
  .replay-scene-leave-active,
  .replay-portrait-enter-active,
  .replay-portrait-leave-active {
    transition: none;
  }
}
</style>
