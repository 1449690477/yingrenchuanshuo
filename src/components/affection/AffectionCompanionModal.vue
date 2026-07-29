<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue';
import {
  BookHeart,
  ChevronLeft,
  ChevronRight,
  EyeOff,
  Heart,
  Images,
  LockKeyhole,
  MessageCircleHeart,
  Sparkles,
  X,
} from '@lucide/vue';
import { createFocusTrap, type FocusTrap } from 'focus-trap';
import type { AffectionCharacterProgress, AffectionMood } from '@/core/affection';
import {
  isAffectionMemoryUnlocked,
  resolveAffectionLetterVariant,
  selectAffectionInterlude,
} from '@/core/affectionCompanion';
import type { ClassId } from '@/core/types';
import {
  affectionInterludesForClass,
  type AffectionInterludeDefinition,
} from '@/data/affectionInterludes';
import { affectionLettersForClass, type AffectionLetterDefinition } from '@/data/affectionLetters';
import { requireAffectionCharacter, type AffectionStoryDefinition } from '@/data/affection';
import StorySceneLayer from '@/components/StorySceneLayer.vue';
import type { AffectionCompanionSection } from './AffectionCompanionPanel.vue';

const props = defineProps<{
  classId: ClassId;
  progress: AffectionCharacterProgress;
  initialSection: AffectionCompanionSection;
}>();

const emit = defineEmits<{
  close: [];
}>();

interface GalleryEntry {
  id: string;
  story: AffectionStoryDefinition;
  kind: 'scene' | 'cg';
  label: string;
  asset: string;
  unlocked: boolean;
}

const BASE = import.meta.env.BASE_URL;
const dialogRef = ref<HTMLElement | null>(null);
const closeButtonRef = ref<HTMLButtonElement | null>(null);
const section = ref<AffectionCompanionSection>(props.initialSection);
const chatCursor = ref(0);
const chatLineIndex = ref(0);
const selectedLetterId = ref<string | null>(null);
const previewEntry = ref<GalleryEntry | null>(null);
const previewHudHidden = ref(false);
let focusTrap: FocusTrap | null = null;

const character = computed(() => requireAffectionCharacter(props.classId));
const modalStyle = computed(() => ({
  '--companion-accent': character.value.accent,
  '--companion-glow': character.value.glow,
}));
const interludes = computed(() => affectionInterludesForClass(props.classId));
const currentInterlude = computed<AffectionInterludeDefinition>(() =>
  selectAffectionInterlude(interludes.value, props.progress, chatCursor.value),
);
const chatLine = computed(
  () => currentInterlude.value.dialogue[chatLineIndex.value] ?? currentInterlude.value.dialogue[0]!,
);
const chatMood = computed<AffectionMood>(() => chatLine.value.mood ?? 'calm');
const letters = computed(() => affectionLettersForClass(props.classId));
const unlockedLetterCount = computed(
  () =>
    letters.value.filter((letter) =>
      props.progress.completedStoryIds.includes(letter.requiredStoryId),
    ).length,
);
const selectedLetter = computed<AffectionLetterDefinition | null>(() => {
  const id = selectedLetterId.value;
  if (!id) return null;
  const letter = letters.value.find((entry) => entry.id === id) ?? null;
  if (!letter || !props.progress.completedStoryIds.includes(letter.requiredStoryId)) return null;
  return letter;
});
const selectedLetterVariant = computed(() =>
  selectedLetter.value ? resolveAffectionLetterVariant(selectedLetter.value, props.progress) : null,
);
const galleryEntries = computed<readonly GalleryEntry[]>(() =>
  character.value.stories.flatMap((story): GalleryEntry[] => {
    const unlocked = isAffectionMemoryUnlocked(story.id, props.progress.completedStoryIds);
    const entries: GalleryEntry[] = [
      {
        id: `${story.id}:scene`,
        story,
        kind: 'scene',
        label: `${story.episodeLabel} · 场景`,
        asset: story.backgroundAsset,
        unlocked,
      },
    ];
    if (story.cgAsset) {
      entries.push({
        id: `${story.id}:cg`,
        story,
        kind: 'cg',
        label: `${story.episodeLabel} · 珍藏`,
        asset: story.cgAsset,
        unlocked,
      });
    }
    return entries;
  }),
);
const unlockedMemoryCount = computed(
  () => galleryEntries.value.filter((entry) => entry.unlocked).length,
);

function setSection(nextSection: AffectionCompanionSection): void {
  section.value = nextSection;
  previewEntry.value = null;
  previewHudHidden.value = false;
}

function advanceChat(): void {
  if (chatLineIndex.value < currentInterlude.value.dialogue.length - 1) {
    chatLineIndex.value++;
    return;
  }
  chatCursor.value++;
  chatLineIndex.value = 0;
}

function selectLetter(letter: AffectionLetterDefinition): void {
  if (!props.progress.completedStoryIds.includes(letter.requiredStoryId)) return;
  selectedLetterId.value = letter.id;
}

function openPreview(entry: GalleryEntry): void {
  if (!entry.unlocked) return;
  previewEntry.value = entry;
  previewHudHidden.value = false;
}

function closePreview(): void {
  previewEntry.value = null;
  previewHudHidden.value = false;
}

function requestClose(): void {
  if (focusTrap?.active) {
    focusTrap.deactivate();
    return;
  }
  emit('close');
}

function selectFirstUnlockedLetter(): void {
  const first = letters.value.find((letter) =>
    props.progress.completedStoryIds.includes(letter.requiredStoryId),
  );
  selectedLetterId.value = first?.id ?? null;
}

watch(
  () => props.initialSection,
  (nextSection) => setSection(nextSection),
);
watch(
  () => props.classId,
  () => {
    chatCursor.value = 0;
    chatLineIndex.value = 0;
    selectFirstUnlockedLetter();
    closePreview();
  },
);

onMounted(async () => {
  selectFirstUnlockedLetter();
  await nextTick();
  const dialog = dialogRef.value;
  if (!dialog) return;
  focusTrap = createFocusTrap(dialog, {
    initialFocus: () => closeButtonRef.value ?? dialog,
    fallbackFocus: () => dialog,
    clickOutsideDeactivates: true,
    escapeDeactivates: true,
    isolateSubtrees: 'aria-hidden',
    onDeactivate: () => emit('close'),
  });
  focusTrap.activate();
});

onUnmounted(() => {
  if (focusTrap?.active) {
    focusTrap.deactivate({
      returnFocus: true,
      onDeactivate: () => undefined,
    });
  }
  focusTrap = null;
});
</script>

<template>
  <Teleport to="body">
    <Transition name="companion-modal" appear>
      <div class="companion-overlay" :style="modalStyle">
        <section
          ref="dialogRef"
          class="companion-dialog"
          role="dialog"
          aria-modal="true"
          aria-labelledby="companion-modal-title"
          tabindex="-1"
        >
          <header class="modal-head">
            <span class="head-seal" aria-hidden="true"
              ><Heart :size="17" fill="currentColor"
            /></span>
            <span class="head-copy">
              <small>{{ character.name }} · {{ currentInterlude.tierLabel }}</small>
              <strong id="companion-modal-title">心之间</strong>
            </span>
            <button
              ref="closeButtonRef"
              type="button"
              class="close-button"
              aria-label="离开心之间"
              @click="requestClose"
            >
              <X :size="20" aria-hidden="true" />
            </button>
          </header>

          <nav class="section-tabs" aria-label="心之间功能">
            <button
              type="button"
              :class="{ active: section === 'chat' }"
              :aria-current="section === 'chat' ? 'page' : undefined"
              @click="setSection('chat')"
            >
              <MessageCircleHeart :size="16" aria-hidden="true" />
              聊聊
            </button>
            <button
              type="button"
              :class="{ active: section === 'letters' }"
              :aria-current="section === 'letters' ? 'page' : undefined"
              @click="setSection('letters')"
            >
              <BookHeart :size="16" aria-hidden="true" />
              来信
              <i>{{ unlockedLetterCount }}/{{ letters.length }}</i>
            </button>
            <button
              type="button"
              :class="{ active: section === 'gallery' }"
              :aria-current="section === 'gallery' ? 'page' : undefined"
              @click="setSection('gallery')"
            >
              <Images :size="16" aria-hidden="true" />
              回忆
              <i>{{ unlockedMemoryCount }}/{{ galleryEntries.length }}</i>
            </button>
          </nav>

          <div class="modal-scroll">
            <section v-if="section === 'chat'" class="chat-section" aria-labelledby="chat-title">
              <div class="chat-stage" :class="`mood-${chatMood}`">
                <StorySceneLayer :src="`${BASE}${character.hubBackgroundAsset}`" />
                <span class="stage-veil" aria-hidden="true" />
                <div class="portrait-slot">
                  <slot name="portrait" :mood="chatMood">
                    <Heart :size="46" fill="currentColor" aria-hidden="true" />
                  </slot>
                </div>
                <span class="tier-chip">{{ currentInterlude.tierLabel }} · 日常片段</span>
              </div>

              <div class="chat-dialogue">
                <span class="chat-title-row">
                  <small>INTERLUDE {{ (chatCursor % 4) + 1 }}/4</small>
                  <strong id="chat-title">{{ currentInterlude.title }}</strong>
                </span>
                <span class="speaker">
                  {{ chatLine.speaker ?? '心之手札' }}
                </span>
                <p :class="{ narration: !chatLine.speaker }">{{ chatLine.text }}</p>
                <button type="button" class="primary-action" @click="advanceChat">
                  <template v-if="chatLineIndex < currentInterlude.dialogue.length - 1">
                    听她继续说
                  </template>
                  <template v-else>再聊一句</template>
                  <ChevronRight :size="17" aria-hidden="true" />
                </button>
              </div>

              <p class="no-pressure-note">
                <Sparkles :size="13" aria-hidden="true" />
                幕间闲聊不会消耗每日次数，也不提供数值奖励；只是陪她待一会儿。
              </p>
            </section>

            <section
              v-else-if="section === 'letters'"
              class="letters-section"
              aria-labelledby="letters-title"
            >
              <div class="section-heading">
                <span>
                  <small>LETTERS FROM HER</small>
                  <strong id="letters-title">心之间信</strong>
                </span>
                <em>{{ unlockedLetterCount }}/{{ letters.length }} 封已收到</em>
              </div>
              <p class="section-note">关键篇章结束后，她会写信回应你当时真正选择的话。</p>

              <div class="letter-list">
                <button
                  v-for="letter in letters"
                  :key="letter.id"
                  type="button"
                  class="letter-card"
                  :class="{
                    selected: selectedLetterId === letter.id,
                    locked: !progress.completedStoryIds.includes(letter.requiredStoryId),
                  }"
                  :disabled="!progress.completedStoryIds.includes(letter.requiredStoryId)"
                  @click="selectLetter(letter)"
                >
                  <span class="letter-stamp" aria-hidden="true">
                    <BookHeart
                      v-if="progress.completedStoryIds.includes(letter.requiredStoryId)"
                      :size="18"
                    />
                    <LockKeyhole v-else :size="17" />
                  </span>
                  <span>
                    <small>第 {{ letter.sourceEpisode }} 幕之后</small>
                    <strong>{{
                      progress.completedStoryIds.includes(letter.requiredStoryId)
                        ? letter.title
                        : '尚未寄出的信'
                    }}</strong>
                  </span>
                  <ChevronRight
                    v-if="progress.completedStoryIds.includes(letter.requiredStoryId)"
                    :size="17"
                    aria-hidden="true"
                  />
                </button>
              </div>

              <article v-if="selectedLetter && selectedLetterVariant" class="letter-paper">
                <small>{{ selectedLetter.preface }}</small>
                <h3>{{ selectedLetter.title }}</h3>
                <p class="salutation">{{ selectedLetter.salutation }}</p>
                <p v-for="paragraph in selectedLetterVariant.paragraphs" :key="paragraph">
                  {{ paragraph }}
                </p>
                <p class="signature">{{ selectedLetter.signature }}</p>
              </article>
              <div v-else class="empty-letter">
                <BookHeart :size="30" aria-hidden="true" />
                <strong>下一封信仍在故事里</strong>
                <span>完成第 3、6、9、12 幕后，她会写下新的心意。</span>
              </div>
            </section>

            <section v-else class="gallery-section" aria-labelledby="gallery-title">
              <div class="section-heading">
                <span>
                  <small>MEMORY GALLERY</small>
                  <strong id="gallery-title">回忆画廊</strong>
                </span>
                <em>{{ unlockedMemoryCount }}/{{ galleryEntries.length }} 格已点亮</em>
              </div>
              <p class="section-note">完成篇章后解锁场景；拥有专属珍藏图的篇章会多一格。</p>

              <div class="memory-grid">
                <button
                  v-for="entry in galleryEntries"
                  :key="entry.id"
                  type="button"
                  class="memory-card"
                  :class="{ locked: !entry.unlocked, cg: entry.kind === 'cg' }"
                  :disabled="!entry.unlocked"
                  @click="openPreview(entry)"
                >
                  <img
                    v-if="entry.unlocked"
                    :src="`${BASE}${entry.asset}`"
                    :alt="`${entry.story.title}${entry.kind === 'cg' ? '珍藏图' : '场景图'}`"
                  />
                  <span v-else class="locked-art" aria-hidden="true">
                    <LockKeyhole :size="24" />
                  </span>
                  <span class="memory-copy">
                    <small>{{ entry.label }}</small>
                    <strong>{{
                      entry.unlocked ? entry.story.title : `完成第 ${entry.story.episode} 幕解锁`
                    }}</strong>
                  </span>
                  <i v-if="entry.kind === 'cg'" class="cg-mark">CG</i>
                </button>
              </div>
            </section>
          </div>

          <div
            v-if="previewEntry"
            class="memory-preview"
            :class="{ 'hud-hidden': previewHudHidden }"
            @click="previewHudHidden = !previewHudHidden"
          >
            <StorySceneLayer
              :src="`${BASE}${previewEntry.asset}`"
              :alt="`${previewEntry.story.title}${previewEntry.kind === 'cg' ? '珍藏图' : '场景图'}`"
              :zoomed="previewEntry.kind === 'cg'"
            />
            <span class="preview-shade" aria-hidden="true" />
            <header class="preview-head" @click.stop>
              <button type="button" aria-label="返回回忆画廊" @click="closePreview">
                <ChevronLeft :size="20" aria-hidden="true" />
              </button>
              <span>
                <small>{{ previewEntry.label }}</small>
                <strong>{{ previewEntry.story.title }}</strong>
              </span>
              <button type="button" aria-label="隐藏界面纯享画面" @click="previewHudHidden = true">
                <EyeOff :size="18" aria-hidden="true" />
              </button>
            </header>
            <span class="preview-hint" aria-hidden="true">
              {{ previewHudHidden ? '点击画面返回界面' : '轻触画面切换沉浸模式' }}
            </span>
          </div>
        </section>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.companion-overlay {
  --companion-accent: #ff7fa9;
  --companion-glow: #ffe2ed;
  position: fixed;
  z-index: 100;
  inset: 0;
  display: grid;
  place-items: center;
  padding: max(8px, env(safe-area-inset-top)) 8px max(8px, env(safe-area-inset-bottom));
  background: rgb(28 22 35 / 58%);
  backdrop-filter: blur(9px);
}

.companion-dialog {
  position: relative;
  isolation: isolate;
  width: min(100%, 390px);
  max-height: min(92dvh, 800px);
  display: flex;
  flex-direction: column;
  overflow: hidden;
  color: #493f52;
  background: linear-gradient(160deg, #fff, #fff9fc);
  border: 1px solid rgb(255 255 255 / 82%);
  border-radius: 27px;
  box-shadow: 0 28px 72px rgb(24 17 31 / 32%);
}

.modal-head {
  min-height: 64px;
  display: flex;
  align-items: center;
  gap: 9px;
  padding: 10px 11px 8px 13px;
  background: radial-gradient(circle at 14% 10%, var(--companion-glow), transparent 58%), white;
}

.head-seal {
  width: 38px;
  height: 38px;
  display: grid;
  flex: 0 0 auto;
  place-items: center;
  color: white;
  background: linear-gradient(145deg, var(--companion-accent), #a98eea);
  border: 2px solid white;
  border-radius: 13px;
  box-shadow: 0 5px 13px color-mix(in srgb, var(--companion-accent) 30%, transparent);
}

.head-copy {
  min-width: 0;
  display: flex;
  flex: 1;
  flex-direction: column;
}

.head-copy small {
  font-size: 8px;
  font-weight: 900;
  color: var(--companion-accent);
}

.head-copy strong {
  margin-top: 1px;
  font-size: 16px;
}

.close-button,
.preview-head button {
  width: 44px;
  height: 44px;
  display: grid;
  flex: 0 0 auto;
  place-items: center;
  color: #73859a;
  background: #f0f6fb;
  border: 1px solid #dde9f3;
  border-radius: 50%;
}

.section-tabs {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 5px;
  padding: 0 10px 9px;
  background: white;
  border-bottom: 1px solid #f0e8ef;
}

.section-tabs button {
  min-height: 44px;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 5px;
  padding: 6px 5px;
  font-size: 10px;
  font-weight: 800;
  color: #8b7c8d;
  background: #f8f5f8;
  border: 1px solid transparent;
  border-radius: 13px;
}

.section-tabs button.active {
  color: var(--companion-accent);
  background: color-mix(in srgb, var(--companion-glow) 56%, white);
  border-color: color-mix(in srgb, var(--companion-accent) 25%, white);
}

.section-tabs i {
  min-width: 25px;
  padding: 2px 4px;
  font-size: 7px;
  font-style: normal;
  color: #8a7184;
  background: rgb(255 255 255 / 70%);
  border-radius: 999px;
}

.modal-scroll {
  flex: 1;
  min-height: 0;
  overflow: auto;
  overscroll-behavior: contain;
  scrollbar-width: thin;
}

.chat-section,
.letters-section,
.gallery-section {
  padding: 10px;
}

.chat-stage {
  position: relative;
  isolation: isolate;
  height: clamp(230px, 37dvh, 310px);
  overflow: hidden;
  background: #e8edf4;
  border-radius: 19px 19px 13px 13px;
}

.stage-veil {
  position: absolute;
  z-index: -3;
  inset: 0;
  background: linear-gradient(to bottom, transparent 46%, rgb(21 17 28 / 48%));
  pointer-events: none;
}

.portrait-slot {
  position: absolute;
  z-index: -2;
  inset: 7% 3% 0;
  display: flex;
  align-items: flex-end;
  justify-content: center;
  color: var(--companion-accent);
  pointer-events: none;
}

.portrait-slot > :deep(*) {
  width: min(78%, 260px);
  height: 100%;
}

.tier-chip {
  position: absolute;
  left: 10px;
  bottom: 10px;
  padding: 5px 8px;
  font-size: 8px;
  font-weight: 900;
  color: white;
  background: rgb(48 38 55 / 66%);
  border: 1px solid rgb(255 255 255 / 28%);
  border-radius: 999px;
  backdrop-filter: blur(7px);
}

.chat-dialogue {
  position: relative;
  z-index: 2;
  margin: -7px 7px 0;
  padding: 12px;
  background: rgb(255 255 255 / 96%);
  border: 1px solid color-mix(in srgb, var(--companion-accent) 26%, white);
  border-radius: 16px;
  box-shadow: 0 8px 24px rgb(65 42 68 / 10%);
}

.chat-title-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.chat-title-row small,
.section-heading small {
  font-size: 7px;
  font-weight: 900;
  letter-spacing: 0.1em;
  color: var(--companion-accent);
}

.chat-title-row strong {
  overflow: hidden;
  font-size: 12px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.speaker {
  display: inline-flex;
  margin-top: 9px;
  padding: 3px 7px;
  font-size: 8px;
  font-weight: 900;
  color: white;
  background: var(--companion-accent);
  border-radius: 7px 7px 7px 2px;
}

.chat-dialogue p {
  min-height: 44px;
  margin: 7px 0 10px;
  font-size: 11px;
  line-height: 1.8;
}

.chat-dialogue p.narration {
  color: #79879a;
  font-style: italic;
}

.primary-action {
  min-height: 44px;
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 5px;
  color: white;
  font-size: 11px;
  font-weight: 900;
  background: linear-gradient(110deg, var(--companion-accent), #a886e5);
  border: 0;
  border-radius: 13px;
  box-shadow: 0 6px 14px color-mix(in srgb, var(--companion-accent) 24%, transparent);
}

.no-pressure-note,
.section-note {
  display: flex;
  align-items: flex-start;
  gap: 5px;
  margin: 9px 4px 0;
  font-size: 8px;
  line-height: 1.6;
  color: #938795;
}

.section-heading {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 8px;
  padding: 2px 3px 0;
}

.section-heading > span {
  min-width: 0;
  display: flex;
  flex-direction: column;
}

.section-heading strong {
  margin-top: 2px;
  font-size: 15px;
}

.section-heading em {
  font-size: 8px;
  font-style: normal;
  color: #8e7c8d;
}

.section-note {
  margin: 5px 3px 10px;
}

.letter-list {
  display: grid;
  gap: 6px;
}

.letter-card {
  min-height: 58px;
  display: grid;
  grid-template-columns: 38px minmax(0, 1fr) 20px;
  align-items: center;
  gap: 8px;
  padding: 8px 9px;
  color: #5a4b5c;
  text-align: left;
  background: white;
  border: 1px solid #eadfe7;
  border-radius: 14px;
}

.letter-card.selected {
  border-color: color-mix(in srgb, var(--companion-accent) 45%, white);
  box-shadow: 0 0 0 2px color-mix(in srgb, var(--companion-glow) 45%, transparent);
}

.letter-card.locked {
  color: #a69da7;
  background: #f7f4f6;
}

.letter-stamp {
  width: 36px;
  height: 36px;
  display: grid;
  place-items: center;
  color: var(--companion-accent);
  background: color-mix(in srgb, var(--companion-glow) 58%, white);
  border-radius: 11px;
}

.letter-card.locked .letter-stamp {
  color: #aaa1ab;
  background: #ebe7ea;
}

.letter-card > span:nth-child(2) {
  min-width: 0;
  display: flex;
  flex-direction: column;
}

.letter-card small {
  font-size: 8px;
  color: #9b8999;
}

.letter-card strong {
  margin-top: 2px;
  overflow: hidden;
  font-size: 11px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.letter-paper {
  position: relative;
  margin-top: 10px;
  padding: 17px 15px;
  overflow: hidden;
  background:
    linear-gradient(90deg, rgb(255 204 218 / 14%) 1px, transparent 1px) 29px 0 / 24px 100%,
    #fffdf8;
  border: 1px solid #eadbcf;
  border-radius: 16px;
  box-shadow: 0 8px 24px rgb(81 58 54 / 8%);
}

.letter-paper::after {
  content: '♥';
  position: absolute;
  right: 12px;
  top: 10px;
  color: color-mix(in srgb, var(--companion-accent) 34%, transparent);
  font-size: 25px;
  transform: rotate(12deg);
}

.letter-paper > small {
  font-size: 8px;
  color: #a3928c;
}

.letter-paper h3 {
  margin: 5px 0 14px;
  padding-right: 24px;
  font-family: ui-serif, 'Songti SC', serif;
  font-size: 16px;
  color: #5d4a4f;
}

.letter-paper p {
  margin: 0 0 10px;
  font-family: ui-serif, 'Songti SC', serif;
  font-size: 11px;
  line-height: 1.9;
  text-indent: 2em;
}

.letter-paper p.salutation {
  text-indent: 0;
  font-weight: 800;
}

.letter-paper p.signature {
  margin: 15px 0 0;
  color: var(--companion-accent);
  text-align: right;
  text-indent: 0;
}

.empty-letter {
  min-height: 140px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 6px;
  margin-top: 10px;
  color: #9c8f9e;
  background: #faf7f9;
  border: 1px dashed #ddd2dc;
  border-radius: 16px;
}

.empty-letter strong {
  font-size: 12px;
}

.empty-letter span {
  padding: 0 16px;
  font-size: 9px;
  text-align: center;
}

.memory-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 8px;
}

.memory-card {
  position: relative;
  min-width: 0;
  padding: 0;
  overflow: hidden;
  color: white;
  text-align: left;
  aspect-ratio: 4 / 3;
  background: #ede8ee;
  border: 1px solid #e6dce4;
  border-radius: 14px;
}

.memory-card img {
  width: 100%;
  height: 100%;
  display: block;
  object-fit: cover;
}

.memory-card::after {
  content: '';
  position: absolute;
  inset: 38% 0 0;
  background: linear-gradient(to bottom, transparent, rgb(30 23 35 / 83%));
  pointer-events: none;
}

.memory-card.locked::after {
  display: none;
}

.locked-art {
  position: absolute;
  inset: 0;
  display: grid;
  place-items: center;
  color: #ada2ad;
  background:
    radial-gradient(circle, rgb(255 255 255 / 65%), transparent 44%),
    linear-gradient(145deg, #eee9ee, #ddd7df);
}

.memory-copy {
  position: absolute;
  z-index: 1;
  right: 7px;
  bottom: 7px;
  left: 7px;
  display: flex;
  flex-direction: column;
}

.memory-card.locked .memory-copy {
  color: #8d838e;
}

.memory-copy small {
  font-size: 7px;
  opacity: 0.8;
}

.memory-copy strong {
  margin-top: 1px;
  overflow: hidden;
  font-size: 10px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.cg-mark {
  position: absolute;
  z-index: 2;
  top: 7px;
  right: 7px;
  padding: 3px 5px;
  color: white;
  font-size: 7px;
  font-style: normal;
  font-weight: 900;
  background: linear-gradient(120deg, #ff84aa, #a988ed);
  border-radius: 999px;
}

.memory-preview {
  position: absolute;
  z-index: 10;
  isolation: isolate;
  inset: 0;
  overflow: hidden;
  background: #16131c;
  cursor: pointer;
}

.preview-shade {
  position: absolute;
  z-index: -3;
  inset: 0;
  background: linear-gradient(to bottom, rgb(15 12 18 / 38%), transparent 32%, rgb(15 12 18 / 35%));
  pointer-events: none;
}

.preview-head {
  position: absolute;
  top: 0;
  right: 0;
  left: 0;
  display: grid;
  grid-template-columns: 44px minmax(0, 1fr) 44px;
  align-items: center;
  gap: 8px;
  padding: max(10px, env(safe-area-inset-top)) 10px 12px;
  color: white;
  background: linear-gradient(to bottom, rgb(20 15 24 / 68%), transparent);
  transition: opacity 0.2s ease;
}

.preview-head button {
  color: white;
  background: rgb(30 24 35 / 52%);
  border-color: rgb(255 255 255 / 22%);
  backdrop-filter: blur(8px);
}

.preview-head span {
  min-width: 0;
  display: flex;
  flex-direction: column;
  text-align: center;
}

.preview-head small {
  font-size: 8px;
  opacity: 0.76;
}

.preview-head strong {
  margin-top: 2px;
  overflow: hidden;
  font-size: 13px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.preview-hint {
  position: absolute;
  bottom: max(15px, env(safe-area-inset-bottom));
  left: 50%;
  padding: 6px 9px;
  color: white;
  font-size: 8px;
  background: rgb(28 22 34 / 62%);
  border: 1px solid rgb(255 255 255 / 18%);
  border-radius: 999px;
  transform: translateX(-50%);
  transition: opacity 0.2s ease;
  white-space: nowrap;
}

.memory-preview.hud-hidden .preview-head,
.memory-preview.hud-hidden .preview-hint {
  opacity: 0;
  pointer-events: none;
}

.companion-modal-enter-active,
.companion-modal-leave-active {
  transition: opacity 0.2s ease;
}

.companion-modal-enter-active .companion-dialog,
.companion-modal-leave-active .companion-dialog {
  transition: transform 0.24s ease;
}

.companion-modal-enter-from,
.companion-modal-leave-to {
  opacity: 0;
}

.companion-modal-enter-from .companion-dialog,
.companion-modal-leave-to .companion-dialog {
  transform: translateY(14px) scale(0.975);
}

button:focus-visible {
  outline: 3px solid color-mix(in srgb, var(--companion-accent) 38%, transparent);
  outline-offset: 2px;
}

@media (max-height: 620px) {
  .companion-dialog {
    max-height: calc(100dvh - 8px);
    border-radius: 22px;
  }

  .chat-stage {
    height: 220px;
  }
}

@media (max-width: 340px) {
  .companion-overlay {
    padding-inline: 4px;
  }

  .companion-dialog {
    border-radius: 22px;
  }

  .section-tabs button {
    gap: 3px;
    font-size: 9px;
  }

  .section-tabs i {
    display: none;
  }

  .chat-stage {
    height: 222px;
  }

  .memory-grid {
    gap: 6px;
  }
}

@media (prefers-reduced-motion: reduce) {
  .companion-modal-enter-active,
  .companion-modal-leave-active,
  .companion-modal-enter-active .companion-dialog,
  .companion-modal-leave-active .companion-dialog,
  .preview-head,
  .preview-hint {
    transition: none;
  }
}
</style>
