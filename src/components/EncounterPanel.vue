<script setup lang="ts">
import { computed, ref, watch } from 'vue';
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
/** 已经念到第几句（含当前句） */
const visibleLines = computed(() => dialogue.value.slice(0, lineIndex.value + 1));
const dialogueDone = computed(
  () => !hasDialogue.value || lineIndex.value >= dialogue.value.length - 1,
);

function advanceDialogue(): void {
  if (dialogueDone.value) return;
  lineIndex.value = Math.min(lineIndex.value + 1, dialogue.value.length - 1);
}

function skipDialogue(): void {
  lineIndex.value = Math.max(0, dialogue.value.length - 1);
}

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

        <!-- 对话区 -->
        <div v-if="hasDialogue" class="dialogue" @click="advanceDialogue">
          <TransitionGroup name="line" tag="div" class="line-list">
            <p
              v-for="(line, i) in visibleLines"
              :key="i"
              class="line"
              :class="{ narration: !line.speaker, latest: i === visibleLines.length - 1 }"
            >
              <span v-if="line.speaker" class="speaker">{{ line.speaker }}</span>
              <span class="line-text">{{ line.text }}</span>
            </p>
          </TransitionGroup>
          <span v-if="!dialogueDone" class="tap-hint">轻触继续 ▾</span>
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
   奇遇演出：场景舞台 + 立绘 + 逐句对话
   ───────────────────────────────────────── */

.stage-view {
  position: relative;
  height: 148px;
  margin: 0 14px 10px;
  border-radius: var(--r);
  overflow: hidden;
  background: linear-gradient(150deg, var(--blue-soft), var(--pink-soft));
  box-shadow: inset 0 0 0 1px rgb(255 255 255 / 60%);
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
  object-position: center 42%;
}

.scene-veil {
  position: absolute;
  inset: 0;
  background: linear-gradient(
    180deg,
    rgb(255 255 255 / 10%) 0%,
    rgb(255 255 255 / 5%) 45%,
    rgb(255 255 255 / 72%) 100%
  );
}

/* 立绘 / 占位头像 */
.portrait {
  position: absolute;
  right: 16px;
  bottom: 0;
  width: 96px;
  height: 128px;
  display: grid;
  place-items: center;
}

.portrait.is-art img {
  width: 100%;
  height: 100%;
  object-fit: contain;
  object-position: bottom center;
  filter: drop-shadow(0 4px 10px rgb(90 110 140 / 35%));
}

/* 还没出立绘时的风格化占位：一枚发光的圆牌 */
.portrait-glyph {
  width: 74px;
  height: 74px;
  display: grid;
  place-items: center;
  font-size: 34px;
  border-radius: 50%;
  background: radial-gradient(circle at 35% 30%, #fff, var(--pink-soft) 65%, var(--blue-soft));
  box-shadow:
    0 0 0 3px rgb(255 255 255 / 85%),
    0 6px 18px rgb(120 140 175 / 35%);
  animation: portrait-float 3.4s ease-in-out infinite;
}

@keyframes portrait-float {
  0%,
  100% {
    transform: translateY(0);
  }
  50% {
    transform: translateY(-6px);
  }
}

.skip {
  position: absolute;
  right: 10px;
  top: 8px;
  padding: 3px 10px;
  font-size: 10px;
  color: var(--text-mid);
  background: rgb(255 255 255 / 82%);
  border-radius: 999px;
  backdrop-filter: blur(2px);
}

/* 对话区 */
.dialogue {
  position: relative;
  margin: 0 14px 12px;
  padding: 12px 14px 20px;
  background: var(--panel);
  border: 1px solid var(--line);
  border-radius: var(--r);
  cursor: pointer;
  min-height: 92px;
}

.line-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.line {
  font-size: 13px;
  line-height: 1.75;
  color: var(--text);
}

.line.narration {
  font-size: 12px;
  color: var(--text-mid);
  font-style: italic;
  text-align: center;
}

.line:not(.latest) {
  opacity: 0.5;
}

.speaker {
  display: inline-block;
  margin-right: 6px;
  padding: 1px 9px;
  font-size: 11px;
  font-weight: 700;
  color: #fff;
  background: linear-gradient(135deg, #ffb0d0, var(--pink-deep));
  border-radius: 999px;
  vertical-align: 2px;
}

.tap-hint {
  position: absolute;
  right: 12px;
  bottom: 6px;
  font-size: 10px;
  color: var(--text-dim);
  animation: tap-blink 1.4s ease-in-out infinite;
}

@keyframes tap-blink {
  0%,
  100% {
    opacity: 0.35;
  }
  50% {
    opacity: 1;
  }
}

.line-enter-from {
  opacity: 0;
  transform: translateY(8px);
}

.line-enter-active {
  transition: all 0.24s ease-out;
}

@media (prefers-reduced-motion: reduce) {
  .portrait-glyph,
  .tap-hint {
    animation: none;
  }

  .line-enter-active {
    transition-duration: 0.01ms;
  }
}

</style>
