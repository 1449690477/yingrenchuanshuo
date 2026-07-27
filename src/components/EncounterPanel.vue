<script setup lang="ts">
import { computed, ref } from 'vue';
import { ChevronLeft, ChevronRight, Sparkles, X } from '@lucide/vue';
import { canAfford, type EncounterChoice, type ResourceBundle } from '@/core/encounters';
import { abbr } from '@/core/format';
import { requireEncounter } from '@/data/encounters';
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
        <p class="story">{{ encounter.story }}</p>
        <div v-if="feedback" class="feedback" :class="`tone-${feedback.tone}`" role="status">
          {{ feedback.text }}
        </div>
        <div class="choices">
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
</style>
