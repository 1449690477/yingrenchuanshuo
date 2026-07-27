<script setup lang="ts">
import { computed, onUnmounted, ref, watch } from 'vue';
import { ChevronLeft, ChevronRight, Sparkles, X } from '@lucide/vue';
import { canAfford, type EncounterChoice, type ResourceBundle } from '@/core/encounters';
import { abbr } from '@/core/format';
import { requireEncounter } from '@/data/encounters';
import { REGIONS } from '@/data/regions';
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

/**
 * 对话推进游标。
 *
 * 奇遇要像「一小段剧情」而不是一个提示框：先逐句把话说完，
 * 读到最后一句才展示选项。玩家点任意处推进，也可以直接跳过。
 */
const lineIndex = ref(0);

const dialogue = computed(() => encounter.value?.dialogue ?? []);
const hasDialogue = computed(() => dialogue.value.length > 0);

/** 当前正在念的这一句。galgame 一次只显示一句，而不是堆成列表。 */
const currentLine = computed(() => dialogue.value[lineIndex.value] ?? null);
const isLastLine = computed(
  () => !hasDialogue.value || lineIndex.value >= dialogue.value.length - 1,
);

// ── 打字机 ──
//
// 逐字显示是 galgame 的灵魂：文字一次性糊上去就没有「在跟你说话」的感觉。
// 打到一半时点击先补完整句，再点才推进 —— 这是玩家最熟悉的交互习惯。

/** 每个字的间隔（毫秒）。中文比英文慢一点更好读。 */
const TYPE_SPEED_MS = 34;

const typedCount = ref(0);
let typeTimer = 0;

const typedText = computed(() => (currentLine.value?.text ?? '').slice(0, typedCount.value));
const isTyping = computed(() => typedCount.value < (currentLine.value?.text.length ?? 0));

function startTyping(): void {
  stopTyping();
  typedCount.value = 0;
  const full = currentLine.value?.text ?? '';
  if (!full) return;

  // 尊重系统的「减弱动效」设置，直接整句显示
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

function stopTyping(): void {
  if (typeTimer) {
    clearInterval(typeTimer);
    typeTimer = 0;
  }
}

/** 整句立刻显示完 */
function completeLine(): void {
  stopTyping();
  typedCount.value = currentLine.value?.text.length ?? 0;
}

/**
 * 点击对话区：正在打字就补完，已打完就推进下一句。
 * 这是 galgame 的标准手感。
 */
function advanceDialogue(): void {
  if (isTyping.value) {
    completeLine();
    return;
  }
  if (isLastLine.value) return;
  lineIndex.value++;
}

/** 跳过整段对话，直接看选项 */
function skipDialogue(): void {
  lineIndex.value = Math.max(0, dialogue.value.length - 1);
  completeLine();
}

/** 对话是否已经念完（最后一句且打完字），选项在此之后才出现 */
const dialogueDone = computed(() => isLastLine.value && !isTyping.value);

onUnmounted(stopTyping);

/** 换奇遇时对话要从头开始 */
watch(selectedUid, () => {
  lineIndex.value = 0;
});

/** 场景背景：奇遇自带优先，否则退回该区域的地图美术 */
const sceneUrl = computed(() => {
  const asset = encounter.value?.sceneAsset ?? regionOfEncounter.value?.mapAsset;
  return asset ? `${import.meta.env.BASE_URL}${asset}` : null;
});

const regionOfEncounter = computed(() => {
  const regionId = entry.value?.regionId;
  return regionId ? REGIONS.find((r) => r.id === regionId) ?? null : null;
});

/** 立绘：还没出图时用 glyph 渲染风格化占位，看起来是刻意设计而非坏图 */
const portraitUrl = computed(() =>
  encounter.value?.portraitAsset
    ? `${import.meta.env.BASE_URL}${encounter.value.portraitAsset}`
    : null,
);

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
const wallet = computed(() => ({
  gold: player.player?.gold ?? 0,
  items: inventory.bag?.items ?? {},
}));

/**
 * 换一句就重新打字。
 *
 * ⚠ 这个 watch 必须放在 encounter / entry 声明之后。
 * immediate 会在 setup 阶段立刻求值 currentLine → dialogue → encounter，
 * 而 encounter 是下面才声明的 const，提前访问会触发 TDZ 报错，
 * 整个面板会渲染失败且只在控制台留下一行错误（真踩过这个坑）。
 */
watch(currentLine, startTyping, { immediate: true });

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

function showNextPending(): void {
  selectedUid.value = stage.pendingEncounters[0]?.uid ?? null;
  feedback.value = null;
}

function choose(choice: EncounterChoice): void {
  if (!entry.value) return;
  const result = stage.resolveEncounter(entry.value.uid, choice.id);
  if (!result.ok) {
    feedback.value = {
      text:
        result.reason === 'insufficient-resource'
          ? '材料数量刚刚发生变化，可以稍后再试'
          : '这段奇遇已经结束了',
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
}
</script>

<template>
  <div class="overlay encounter-overlay" @click.self="emit('close')">
    <section class="sheet" role="dialog" aria-modal="true" aria-label="旅途奇遇">
      <header class="head">
        <span class="sigil"><Sparkles :size="20" aria-hidden="true" /></span>
        <span>
          <small>
            旅途奇遇 ·
            {{
              encounter
                ? `第 ${activeIndex + 1}/${stage.pendingEncounters.length} 件`
                : `待处理 ${stage.pendingEncounters.length}/3`
            }}
          </small>
          <strong>{{ encounter?.title ?? '奇遇已处理' }}</strong>
        </span>
        <button class="close" aria-label="稍后处理" @click="emit('close')"><X :size="18" /></button>
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
        <!-- 场景舞台：背景 + 立绘 + 名牌 -->
        <div class="stage-view" :class="{ tappable: !dialogueDone }" @click="advanceDialogue">
          <img v-if="sceneUrl" class="scene-art" :src="sceneUrl" alt="" aria-hidden="true" />
          <span class="scene-veil" aria-hidden="true" />

          <div class="portrait" :class="{ 'is-art': !!portraitUrl }">
            <img v-if="portraitUrl" :src="portraitUrl" :alt="encounter.speaker ?? '奇遇角色'" />
            <span v-else class="portrait-glyph" aria-hidden="true">{{ encounter.glyph ?? '✦' }}</span>
          </div>

          <button
            v-if="!dialogueDone"
            type="button"
            class="skip"
            @click.stop="skipDialogue"
          >
            跳过
          </button>
        </div>

        <!-- 对话区：galgame 式单行打字机 -->
        <div
          v-if="hasDialogue && currentLine"
          class="dialogue"
          role="button"
          tabindex="0"
          :aria-label="isTyping ? '点击立即显示整句' : '点击继续对话'"
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
            <i
              v-for="(_, i) in dialogue"
              :key="i"
              :class="{ on: i <= lineIndex }"
            />
          </span>

          <span v-if="!isTyping && !isLastLine" class="tap-hint" aria-hidden="true">▼</span>
        </div>

        <p v-else class="story">{{ encounter.story }}</p>
        <div v-if="feedback" class="feedback" :class="`tone-${feedback.tone}`" role="status">
          {{ feedback.text }}
        </div>
        <div v-if="dialogueDone" class="choices">
          <button
            v-for="choice in encounter.choices"
            :key="choice.id"
            class="choice"
            :class="{ unavailable: !canAfford(choice.costs, wallet) }"
            :disabled="!canAfford(choice.costs, wallet)"
            @click="choose(choice)"
          >
            <span class="choice-title">{{ choice.label }}</span>
            <span class="cost">需要：{{ resourceText(choice.costs) }}</span>
            <span v-if="!canAfford(choice.costs, wallet)" class="lack">当前材料不足</span>
          </button>
        </div>
        <p class="aside">关闭后会保留，下次再处理也可以；挂机始终继续。</p>
      </template>

      <template v-else>
        <div class="done">
          <Sparkles :size="30" aria-hidden="true" />
          <p>{{ feedback?.text || '旅途恢复了平静。' }}</p>
          <button
            class="btn btn-pink"
            @click="stage.pendingEncounters.length > 0 ? showNextPending() : emit('close')"
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
  right: 14px;
  bottom: 0;
  width: 128px;
  height: 178px;
  display: grid;
  place-items: end center;
  animation: portrait-enter 0.45s var(--ease-out-back, cubic-bezier(0.34, 1.56, 0.64, 1));
}

@keyframes portrait-enter {
  from {
    opacity: 0;
    transform: translateX(26px) scale(0.94);
  }
  to {
    opacity: 1;
    transform: none;
  }
}

.portrait.is-art img {
  width: 100%;
  height: 100%;
  object-fit: contain;
  object-position: bottom center;
  filter: drop-shadow(0 6px 14px rgb(30 45 70 / 45%));
}

/* 还没出立绘时的风格化占位 */
.portrait-glyph {
  align-self: center;
  width: 86px;
  height: 86px;
  display: grid;
  place-items: center;
  font-size: 40px;
  border-radius: 50%;
  background: radial-gradient(circle at 35% 30%, #fff, var(--pink-soft) 62%, var(--blue-soft));
  box-shadow:
    0 0 0 4px rgb(255 255 255 / 78%),
    0 8px 22px rgb(60 90 130 / 40%);
  animation: portrait-float 3.6s ease-in-out infinite;
}

@keyframes portrait-float {
  0%,
  100% {
    transform: translateY(0);
  }
  50% {
    transform: translateY(-7px);
  }
}

.skip {
  position: absolute;
  right: 10px;
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

@media (prefers-reduced-motion: reduce) {
  .scene-art,
  .portrait,
  .portrait-glyph,
  .tap-hint,
  .caret {
    animation: none;
  }
}
</style>
