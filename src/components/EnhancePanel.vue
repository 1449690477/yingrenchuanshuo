<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { abbr, signed } from '@/core/format';
import { enhanceCost, enhanceRule, luckGainForRate, type EnhanceOutcome } from '@/core/enhance';
import { forgeStageAt } from '@/core/equipment';
import type { EquipmentDef, EquipmentInstance, EquipSlot, ForgeStage } from '@/core/types';
import { useInventoryStore } from '@/stores/inventory';
import { usePlayerStore } from '@/stores/player';
import {
  ENHANCE_MATERIAL_IDS,
  ENHANCE_MAX,
  LUCK_FULL,
  SLOT_LABELS,
  SLOT_ORDER,
} from '@/data/constants';
import { requireEquipment } from '@/data/equipment';
import { requireItem } from '@/data/items';
import EquipmentIcon from '@/components/EquipmentIcon.vue';
import ItemIcon from '@/components/ItemIcon.vue';
import SystemArtwork from '@/components/SystemArtwork.vue';

interface EnhanceCandidate {
  instance: EquipmentInstance;
  definition: EquipmentDef;
  source: 'equipped' | 'bag';
  slot: EquipSlot;
}

interface EnhancePreview {
  targetLevel: number;
  stage: ForgeStage;
  rate: number;
  failure: 'none' | 'downgrade' | 'break';
  gold: number;
  stone: number;
  ore: number;
  lucky: number;
  luck: number;
  luckGain: number;
  guaranteed: boolean;
}

interface ResultFeedback {
  outcome: EnhanceOutcome | 'blocked';
  title: string;
  detail: string;
  tone: 'success' | 'failure' | 'danger';
}

const inventory = useInventoryStore();
const player = usePlayerStore();

const selectedUid = ref<string | null>(null);
const pickerOpen = ref(false);
const useProtection = ref(false);
const dangerConfirm = ref(false);
const feedback = ref<ResultFeedback | null>(null);
const resultSequence = ref(0);
let initializedSelection = false;

const candidates = computed<EnhanceCandidate[]>(() => {
  const result: EnhanceCandidate[] = [];
  const seen = new Set<string>();

  for (const slot of SLOT_ORDER) {
    const instance = inventory.equipped?.[slot] ?? null;
    if (!instance) continue;
    result.push({
      instance,
      definition: requireEquipment(instance.defId),
      source: 'equipped',
      slot,
    });
    seen.add(instance.uid);
  }

  for (const instance of inventory.bag?.equipment ?? []) {
    if (seen.has(instance.uid)) continue;
    const definition = requireEquipment(instance.defId);
    result.push({
      instance,
      definition,
      source: 'bag',
      slot: definition.slot,
    });
  }

  return result;
});

watch(
  candidates,
  (list) => {
    if (initializedSelection || list.length === 0) return;
    const initial =
      list.find((entry) => entry.source === 'equipped' && entry.slot === 'weapon') ??
      list.find((entry) => entry.source === 'equipped') ??
      list[0]!;
    selectedUid.value = initial.instance.uid;
    initializedSelection = true;
  },
  { immediate: true },
);

const selected = computed(
  () => candidates.value.find((entry) => entry.instance.uid === selectedUid.value) ?? null,
);

const preview = computed<EnhancePreview | null>(() => {
  if (!selected.value || selected.value.instance.enhance >= ENHANCE_MAX) return null;

  const { instance, definition } = selected.value;
  const targetLevel = instance.enhance + 1;
  const rule = enhanceRule(targetLevel);
  const cost = enhanceCost(targetLevel, definition.level);
  const luck = instance.enhanceLuck[String(targetLevel)] ?? 0;

  return {
    targetLevel,
    stage: forgeStageAt(targetLevel),
    rate: rule.rate,
    failure: rule.failure,
    gold: cost.gold,
    stone: cost.stone,
    ore: cost.ore,
    lucky: cost.lucky,
    luck,
    luckGain: luckGainForRate(rule.rate),
    guaranteed: rule.rate < 1 && luck === LUCK_FULL,
  };
});

watch(
  () => preview.value?.failure,
  (failure) => {
    if (failure !== 'break') useProtection.value = false;
    dangerConfirm.value = false;
  },
);

watch(selectedUid, () => {
  dangerConfirm.value = false;
  useProtection.value = false;
  feedback.value = null;
});

const quote = computed(() => {
  if (!selectedUid.value) return null;
  return inventory.quoteEnhance(selectedUid.value, useProtection.value);
});

const protectionCount = computed(() => inventory.bag?.items[ENHANCE_MATERIAL_IDS.protection] ?? 0);

const materialRows = computed(() => {
  if (!preview.value) return [];
  return [
    {
      id: ENHANCE_MATERIAL_IDS.stone,
      need: preview.value.stone,
      have: materialCount(ENHANCE_MATERIAL_IDS.stone),
    },
    {
      id: ENHANCE_MATERIAL_IDS.ore,
      need: preview.value.ore,
      have: materialCount(ENHANCE_MATERIAL_IDS.ore),
    },
    {
      id: ENHANCE_MATERIAL_IDS.lucky,
      need: preview.value.lucky,
      have: materialCount(ENHANCE_MATERIAL_IDS.lucky),
    },
  ].filter((row) => row.need > 0);
});

const failureCopy = computed(() => {
  switch (preview.value?.failure) {
    case 'downgrade':
      return '失败会掉 1 级，已掷出的成长不会消失';
    case 'break':
      return useProtection.value ? '失败时保护符会保住装备与等级' : '失败会碎裂，装备将永久消失';
    default:
      return '失败等级保持，幸运值继续累积';
  }
});

const actionLabel = computed(() => {
  if (!selected.value) return '请选择装备';
  if (!preview.value) return `已达 +${ENHANCE_MAX}`;
  if (preview.value.guaranteed) return `幸运保底至 +${preview.value.targetLevel}`;
  return `强化至 +${preview.value.targetLevel}`;
});

const blockedCopy = computed(() => {
  if (!quote.value || quote.value.ok) return '';
  const labels = {
    'not-found': '这件装备已不在背包或穿戴栏',
    'max-level': `装备已经强化至 +${ENHANCE_MAX}`,
    'protection-not-allowed': '当前阶段不能使用保护符',
    'insufficient-gold': '金币不足',
    'insufficient-stone': '强化石不足',
    'insufficient-ore': '玄铁矿不足',
    'insufficient-lucky': '幸运九不足',
    'insufficient-protection': '保护符不足，请关闭保护后再决定',
  } as const;
  return labels[quote.value.reason];
});

function materialCount(itemId: string): number {
  return inventory.bag?.items[itemId] ?? 0;
}

function pick(candidate: EnhanceCandidate): void {
  selectedUid.value = candidate.instance.uid;
  pickerOpen.value = false;
}

function attempt(forceDanger = false): void {
  if (!selectedUid.value || !preview.value) return;

  if (preview.value.failure === 'break' && !useProtection.value && !forceDanger) {
    dangerConfirm.value = true;
    return;
  }

  dangerConfirm.value = false;
  const response = inventory.enhance(selectedUid.value, useProtection.value);
  resultSequence.value += 1;

  if (!response.ok) {
    feedback.value = {
      outcome: 'blocked',
      title: '本次没有消耗任何资源',
      detail: blockedCopy.value || '强化条件发生变化，请重新确认。',
      tone: 'failure',
    };
    return;
  }

  const nextLevel = response.result.nextLevel;
  const gainCopy = response.gainRoll
    ? `本级基础成长 +${(response.gainRoll.permille / 10).toFixed(1)}%（${
        response.gainRoll.grade === 'miracle'
          ? '奇迹'
          : response.gainRoll.grade === 'excellent'
            ? '优秀'
            : '稳定'
      }）`
    : '';
  const cpCopy = response.cpDelta === 0 ? '' : `，战力 ${signed(response.cpDelta)}`;

  const messages: Record<EnhanceOutcome, ResultFeedback> = {
    success: {
      outcome: 'success',
      title: `樱光绽放，强化成功 +${nextLevel}`,
      detail: `${gainCopy}${cpCopy}`.replace(/^，/, '') || '装备属性已提升。',
      tone: 'success',
    },
    failed: {
      outcome: 'failed',
      title: '星屑消散，等级保持',
      detail: `目标 +${response.result.targetLevel} 幸运值提升至 ${response.result.nextLuck}/${LUCK_FULL}`,
      tone: 'failure',
    },
    downgraded: {
      outcome: 'downgraded',
      title: `锻造失衡，回落至 +${nextLevel}`,
      detail: `目标 +${response.result.targetLevel} 的幸运值已保留为 ${response.result.nextLuck}/${LUCK_FULL}`,
      tone: 'failure',
    },
    protected: {
      outcome: 'protected',
      title: '保护符化作樱盾，装备安然无恙',
      detail: `等级保持 +${nextLevel}，幸运值提升至 ${response.result.nextLuck}/${LUCK_FULL}`,
      tone: 'failure',
    },
    broken: {
      outcome: 'broken',
      title: '装备已化为星屑',
      detail: '这次碎裂不会自动切换到别的装备，请由你重新选择。',
      tone: 'danger',
    },
  };
  feedback.value = messages[response.result.outcome];
}
</script>

<template>
  <section class="enhance-panel card" aria-labelledby="enhance-title">
    <div class="panel-art" aria-hidden="true">
      <SystemArtwork kind="enhance" />
    </div>

    <header class="panel-head">
      <span>
        <small>装备成长</small>
        <strong id="enhance-title">樱光强化台</strong>
      </span>
      <button class="change-button" type="button" @click="pickerOpen = true">
        {{ selected ? '更换装备' : '选择装备' }}
      </button>
    </header>

    <div v-if="selected" :key="selected.instance.uid" class="selected-equipment">
      <EquipmentIcon
        :def="selected.definition"
        :enhance="selected.instance.enhance"
        :locked="selected.instance.locked"
        size="lg"
        decorative
      />
      <span class="selected-copy">
        <strong :class="`q-${selected.definition.quality}`">
          {{ selected.definition.name }}
          <b v-if="selected.instance.enhance > 0">+{{ selected.instance.enhance }}</b>
        </strong>
        <span>
          {{ SLOT_LABELS[selected.slot] }} ·
          {{ selected.source === 'equipped' ? '已穿戴' : '背包中' }}
        </span>
        <small>
          胚子属性 +{{ ((selected.instance.baseRollPermille - 1000) / 10).toFixed(1) }}%
        </small>
      </span>
      <span v-if="preview" class="level-route" :class="`stage-${preview.stage}`">
        <small>目标</small>
        <b>+{{ preview.targetLevel }}</b>
      </span>
      <span v-else class="level-route stage-sakura">
        <small>满级</small>
        <b>+{{ ENHANCE_MAX }}</b>
      </span>
    </div>

    <div v-else class="empty-selection">
      <span aria-hidden="true">✦</span>
      <strong>{{ selectedUid ? '刚才的装备已经离开强化台' : '还没有可强化的装备' }}</strong>
      <small>
        {{ selectedUid ? '碎裂或移除后不会擅自替你选择下一件。' : '挂机获得装备后即可开始强化。' }}
      </small>
      <button v-if="candidates.length > 0" type="button" @click="pickerOpen = true">
        重新选择
      </button>
    </div>

    <template v-if="selected && preview">
      <div class="chance-row">
        <span class="chance">
          <small>基础成功率</small>
          <strong>{{ Math.round(preview.rate * 100) }}%</strong>
        </span>
        <span class="failure" :class="{ dangerous: preview.failure === 'break' }">
          {{ failureCopy }}
        </span>
      </div>

      <div class="luck-block">
        <span class="luck-label">
          <b>{{ preview.guaranteed ? '本次幸运保底' : '目标等级幸运值' }}</b>
          <span>{{ preview.luck }} / {{ LUCK_FULL }}</span>
        </span>
        <span
          class="luck-track"
          role="progressbar"
          aria-label="当前目标等级幸运值"
          :aria-valuenow="preview.luck"
          :aria-valuemax="LUCK_FULL"
        >
          <i :style="{ width: `${preview.luck}%` }" />
        </span>
        <small v-if="!preview.guaranteed">本次若失败，幸运值 +{{ preview.luckGain }}</small>
        <small v-else>仍显示基础成功率，但本次结果必定成功。</small>
      </div>

      <div class="costs">
        <span class="gold-cost" :class="{ missing: (player.player?.gold ?? 0) < preview.gold }">
          <small>金币</small>
          <b>{{ abbr(player.player?.gold ?? 0) }} / {{ abbr(preview.gold) }}</b>
        </span>
        <span
          v-for="row in materialRows"
          :key="row.id"
          class="material-cost"
          :class="{ missing: row.have < row.need }"
        >
          <ItemIcon :item="requireItem(row.id)" size="sm" />
          <span>
            <small>{{ requireItem(row.id).name }}</small>
            <b>{{ abbr(row.have) }} / {{ abbr(row.need) }}</b>
          </span>
        </span>
      </div>

      <label
        v-if="preview.failure === 'break'"
        class="protection-toggle"
        :class="{ disabled: preview.guaranteed || protectionCount < 1 }"
      >
        <input
          v-model="useProtection"
          type="checkbox"
          :disabled="preview.guaranteed || protectionCount < 1"
        />
        <span class="toggle-dot" aria-hidden="true" />
        <span>
          <b>启用保护符</b>
          <small>
            {{
              preview.guaranteed
                ? '幸运保底无需消耗'
                : `持有 ${protectionCount} · 仅在实际防住碎裂时消耗`
            }}
          </small>
        </span>
      </label>

      <div v-if="dangerConfirm" class="danger-confirm" role="alert">
        <strong>未启用保护，失败会永久失去这件装备。</strong>
        <span>
          <button type="button" @click="dangerConfirm = false">再想想</button>
          <button type="button" class="danger-button" @click="attempt(true)">确认冒险强化</button>
        </span>
      </div>

      <button
        v-else
        class="enhance-button"
        type="button"
        :disabled="!quote?.ok"
        @click="attempt(false)"
      >
        <span aria-hidden="true">✦</span>
        {{ actionLabel }}
      </button>

      <p v-if="blockedCopy" class="blocked-copy" role="status">{{ blockedCopy }}</p>
    </template>

    <div v-else-if="selected" class="maxed-copy">
      <strong>樱华锻造完成</strong>
      <span>这件装备已经达到当前版本上限，并启用最高阶图标与角色粒子外观。</span>
    </div>

    <Transition name="result-pop" mode="out-in">
      <div
        v-if="feedback"
        :key="resultSequence"
        class="result-feedback"
        :class="`tone-${feedback.tone}`"
        role="status"
        aria-live="polite"
      >
        <span class="result-spark" aria-hidden="true">✦</span>
        <span>
          <strong>{{ feedback.title }}</strong>
          <small>{{ feedback.detail }}</small>
        </span>
      </div>
    </Transition>
  </section>

  <Teleport to="body">
    <Transition name="picker">
      <div v-if="pickerOpen" class="picker-overlay" @click.self="pickerOpen = false">
        <section
          class="picker-sheet"
          role="dialog"
          aria-modal="true"
          aria-labelledby="picker-title"
        >
          <header>
            <span>
              <small>穿戴与背包</small>
              <strong id="picker-title">选择要强化的装备</strong>
            </span>
            <button type="button" aria-label="关闭装备选择" @click="pickerOpen = false">×</button>
          </header>
          <div class="picker-list scroll-y">
            <button
              v-for="(candidate, i) in candidates"
              :key="candidate.instance.uid"
              type="button"
              class="picker-row"
              :class="{ active: candidate.instance.uid === selectedUid }"
              :style="{ '--row-delay': `${Math.min(i, 8) * 30}ms` }"
              @click="pick(candidate)"
            >
              <EquipmentIcon
                :def="candidate.definition"
                :enhance="candidate.instance.enhance"
                :locked="candidate.instance.locked"
                size="md"
                decorative
              />
              <span class="picker-copy">
                <strong :class="`q-${candidate.definition.quality}`">
                  {{ candidate.definition.name }}
                  <b v-if="candidate.instance.enhance > 0">+{{ candidate.instance.enhance }}</b>
                </strong>
                <small>
                  {{ SLOT_LABELS[candidate.slot] }} ·
                  {{ candidate.source === 'equipped' ? '已穿戴' : '背包中' }} · 胚子 +{{
                    ((candidate.instance.baseRollPermille - 1000) / 10).toFixed(1)
                  }}%
                </small>
              </span>
              <i aria-hidden="true">{{ candidate.instance.uid === selectedUid ? '✓' : '›' }}</i>
            </button>
            <p v-if="candidates.length === 0">当前没有可强化的装备。</p>
          </div>
        </section>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.enhance-panel {
  isolation: isolate;
  position: relative;
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 12px;
  overflow: hidden;
  background:
    radial-gradient(circle at 100% 0%, rgb(204 229 255 / 58%), transparent 42%),
    linear-gradient(145deg, rgb(255 255 255 / 98%), rgb(255 245 251 / 96%));
}

.panel-art {
  position: absolute;
  z-index: -1;
  top: 38px;
  right: -28px;
  width: 148px;
  height: 148px;
  opacity: 0.12;
  filter: saturate(0.8);
  pointer-events: none;
}

.panel-art :deep(img),
.panel-art :deep(.system-artwork) {
  width: 100%;
  height: 100%;
  object-fit: contain;
}

.panel-head,
.selected-equipment,
.chance-row,
.luck-label,
.protection-toggle,
.picker-sheet header,
.picker-row {
  display: flex;
  align-items: center;
}

.panel-head {
  justify-content: space-between;
}

.panel-head > span,
.picker-sheet header > span {
  display: flex;
  flex-direction: column;
}

.panel-head small,
.picker-sheet header small {
  color: var(--pink-deep);
  font-size: 9px;
  letter-spacing: 0.08em;
}

.panel-head strong {
  font-size: 16px;
}

.change-button {
  min-height: 36px;
  padding: 0 11px;
  color: var(--blue-deep);
  font-size: 11px;
  font-weight: 700;
  background: rgb(241 248 255 / 88%);
  border: 1px solid rgb(157 202 235 / 56%);
  border-radius: 999px;
}

.selected-equipment {
  gap: 10px;
  min-height: 88px;
  padding: 7px 9px;
  background: rgb(255 255 255 / 78%);
  border: 1px solid rgb(232 201 220 / 66%);
  border-radius: 17px;
  box-shadow: inset 0 1px rgb(255 255 255 / 90%);
  animation: selected-swap 0.3s var(--ease-soft) both;
}

@keyframes selected-swap {
  0% {
    opacity: 0;
    transform: translateY(6px) scale(0.98);
  }
  100% {
    opacity: 1;
    transform: translateY(0) scale(1);
  }
}

.selected-copy {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 3px;
}

.selected-copy strong,
.picker-row strong {
  overflow: hidden;
  font-size: 13px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.selected-copy strong b,
.picker-row strong b {
  color: var(--q-legendary);
}

.selected-copy > span,
.selected-copy small,
.picker-row small {
  color: var(--text-dim);
  font-size: 9px;
}

.level-route {
  display: grid;
  place-items: center;
  flex: 0 0 48px;
  width: 48px;
  height: 48px;
  color: #507090;
  background: #f0f8ff;
  border: 1px solid #b9d8ee;
  border-radius: 50%;
  box-shadow: 0 0 12px rgb(108 190 238 / 20%);
  animation: route-pulse 2.4s ease-in-out infinite;
}

@keyframes route-pulse {
  0%,
  100% {
    box-shadow: 0 0 8px rgb(108 190 238 / 18%);
  }
  50% {
    box-shadow: 0 0 18px rgb(108 190 238 / 45%);
  }
}

.level-route small {
  margin-bottom: -5px;
  font-size: 8px;
}

.level-route b {
  font-size: 16px;
}

.level-route.stage-radiant {
  color: #725ac0;
  background: #f3efff;
  border-color: #cbbcff;
}

.level-route.stage-starforged {
  color: #ae6d25;
  background: #fff4df;
  border-color: #f5c686;
}

.level-route.stage-sakura {
  color: #a84a6d;
  background: linear-gradient(145deg, #fffce7, #ffe4f0);
  border-color: #f0afc8;
}

.chance-row {
  gap: 9px;
}

.chance {
  display: flex;
  flex: 0 0 92px;
  flex-direction: column;
  padding: 8px 10px;
  color: #285f88;
  background: #edf8ff;
  border-radius: 12px;
}

.chance small {
  font-size: 8px;
}

.chance strong {
  font-size: 20px;
  line-height: 1;
}

.failure {
  flex: 1;
  color: var(--text-mid);
  font-size: 10px;
  line-height: 1.5;
}

.failure.dangerous {
  color: #a64f5b;
  font-weight: 700;
}

.luck-block {
  display: flex;
  flex-direction: column;
  gap: 5px;
  padding: 9px 10px;
  background: rgb(255 249 252 / 84%);
  border: 1px solid rgb(243 211 227 / 72%);
  border-radius: 12px;
}

.luck-label {
  justify-content: space-between;
  font-size: 10px;
}

.luck-label span {
  color: var(--pink-deep);
  font-weight: 700;
}

.luck-track {
  display: block;
  height: 7px;
  overflow: hidden;
  background: #f0e8ed;
  border-radius: 999px;
}

.luck-track i {
  position: relative;
  display: block;
  height: 100%;
  background: linear-gradient(90deg, #9bcff3, #f69fc3, #ffe596);
  border-radius: inherit;
  box-shadow: 0 0 8px rgb(255 145 191 / 42%);
  transition: width 0.35s ease;
}

.luck-track i::after {
  content: '';
  position: absolute;
  inset: 0;
  border-radius: inherit;
  background: linear-gradient(100deg, transparent 15%, rgb(255 255 255 / 70%) 50%, transparent 85%);
  background-size: 220% 100%;
  animation: luck-shimmer 2.4s var(--ease-soft) infinite;
}

@keyframes luck-shimmer {
  0% {
    background-position: 120% 0;
  }
  60%,
  100% {
    background-position: -120% 0;
  }
}

.luck-block > small {
  color: var(--text-dim);
  font-size: 8px;
}

.costs {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 6px;
}

.gold-cost,
.material-cost {
  display: flex;
  align-items: center;
  gap: 6px;
  min-height: 44px;
  padding: 6px 8px;
  background: rgb(255 255 255 / 82%);
  border: 1px solid var(--line);
  border-radius: 11px;
}

.gold-cost {
  flex-direction: column;
  align-items: flex-start;
  justify-content: center;
  gap: 1px;
}

.gold-cost small,
.material-cost small {
  color: var(--text-dim);
  font-size: 8px;
}

.gold-cost b,
.material-cost b {
  font-size: 10px;
}

.material-cost > span {
  display: flex;
  min-width: 0;
  flex-direction: column;
}

.costs .missing {
  color: #aa4653;
  background: #fff1f3;
  border-color: #f0b6bd;
}

.protection-toggle {
  position: relative;
  gap: 9px;
  min-height: 50px;
  padding: 7px 9px;
  cursor: pointer;
  background: #f2f7ff;
  border: 1px solid #c8d8f0;
  border-radius: 12px;
}

.protection-toggle input {
  position: absolute;
  opacity: 0;
  pointer-events: none;
}

.toggle-dot {
  position: relative;
  flex: 0 0 36px;
  height: 22px;
  background: #ccd5df;
  border-radius: 999px;
  transition: background 0.2s ease;
}

.toggle-dot::after {
  position: absolute;
  top: 3px;
  left: 3px;
  width: 16px;
  height: 16px;
  content: '';
  background: #fff;
  border-radius: 50%;
  box-shadow: 0 1px 4px rgb(44 62 80 / 25%);
  transition: transform 0.2s ease;
}

.protection-toggle input:checked + .toggle-dot {
  background: linear-gradient(90deg, #80bde8, #d28fef);
}

.protection-toggle input:checked + .toggle-dot::after {
  transform: translateX(14px);
}

.protection-toggle > span:last-child {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.protection-toggle b {
  font-size: 10px;
}

.protection-toggle small {
  color: var(--text-dim);
  font-size: 8px;
}

.protection-toggle.disabled {
  cursor: default;
  opacity: 0.64;
}

.enhance-button {
  position: relative;
  min-height: 48px;
  overflow: hidden;
  color: #fff;
  font-size: 13px;
  font-weight: 800;
  letter-spacing: 0.03em;
  background: linear-gradient(135deg, #75bde9, #bf91ed 48%, #f092ba);
  border: 1px solid rgb(255 255 255 / 58%);
  border-radius: 15px;
  box-shadow:
    inset 0 1px rgb(255 255 255 / 44%),
    0 7px 16px rgb(167 112 196 / 24%);
  transition:
    transform var(--t-fast) var(--ease-spring),
    filter var(--t-mid) var(--ease-soft);
}

.enhance-button:active:not(:disabled) {
  transform: scale(0.97);
  filter: brightness(1.07);
}

/* 按钮上的低频扫光 */
.enhance-button:not(:disabled)::after {
  content: '';
  position: absolute;
  top: 0;
  bottom: 0;
  left: -46%;
  width: 38%;
  background: linear-gradient(100deg, transparent, rgb(255 255 255 / 34%), transparent);
  transform: skewX(-18deg);
  animation: forge-shine 4.2s var(--ease-soft) infinite;
  pointer-events: none;
}

.enhance-button span {
  margin-right: 5px;
  color: #fff4b1;
  animation: forge-spark 2.2s ease-in-out infinite;
}

@keyframes forge-shine {
  0%,
  55% {
    left: -46%;
  }
  82%,
  100% {
    left: 116%;
  }
}

@keyframes forge-spark {
  0%,
  100% {
    opacity: 0.6;
    transform: scale(0.9) rotate(0deg);
  }
  50% {
    opacity: 1;
    transform: scale(1.25) rotate(20deg);
  }
}

.enhance-button:disabled {
  color: #8a96a3;
  background: #e4e9ee;
  box-shadow: none;
}

.blocked-copy {
  margin: -5px 0 0;
  color: #ad4756;
  font-size: 9px;
  text-align: center;
}

.danger-confirm {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 10px;
  color: #983e4c;
  font-size: 10px;
  background: #fff0f2;
  border: 1px solid #efb1bb;
  border-radius: 13px;
  animation: danger-shake 0.42s ease-out both;
}

@keyframes danger-shake {
  0%,
  100% {
    transform: translateX(0);
  }
  20% {
    transform: translateX(-5px);
  }
  40% {
    transform: translateX(4px);
  }
  60% {
    transform: translateX(-3px);
  }
  80% {
    transform: translateX(2px);
  }
}

.danger-confirm > span {
  display: flex;
  gap: 6px;
}

.danger-confirm button {
  flex: 1;
  min-height: 44px;
  font-weight: 700;
  background: #fff;
  border: 1px solid #e8b4bc;
  border-radius: 11px;
}

.danger-confirm .danger-button {
  color: #fff;
  background: #c75768;
  border-color: #c75768;
}

.result-feedback {
  position: relative;
  display: flex;
  align-items: center;
  gap: 8px;
  min-height: 50px;
  padding: 8px 10px;
  overflow: hidden;
  background: #effaf5;
  border: 1px solid #bde5d3;
  border-radius: 13px;
}

/* 强化成功时四瓣樱花向外绽放 */
.result-feedback.tone-success::before,
.result-feedback.tone-success::after {
  content: '';
  position: absolute;
  left: 22px;
  top: 50%;
  width: 7px;
  height: 9px;
  margin-top: -4px;
  background: linear-gradient(160deg, #ffd9e8, #ff9fc4);
  border-radius: 78% 22% 68% 32%;
  pointer-events: none;
  animation: success-petal 0.9s var(--ease-soft) both;
}

.result-feedback.tone-success::before {
  --px: 58px;
  --py: -30px;
}

.result-feedback.tone-success::after {
  --px: -44px;
  --py: -26px;
  animation-delay: 0.08s;
}

.result-feedback.tone-success .result-spark::before,
.result-feedback.tone-success .result-spark::after {
  content: '';
  position: absolute;
  width: 6px;
  height: 8px;
  background: linear-gradient(160deg, #ffe9d0, #ffcf8a);
  border-radius: 78% 22% 68% 32%;
  pointer-events: none;
  animation: success-petal 0.9s var(--ease-soft) both;
}

.result-feedback.tone-success .result-spark {
  position: relative;
}

.result-feedback.tone-success .result-spark::before {
  left: 4px;
  top: 2px;
  --px: 30px;
  --py: 26px;
  animation-delay: 0.04s;
}

.result-feedback.tone-success .result-spark::after {
  left: 8px;
  top: 4px;
  --px: -26px;
  --py: 22px;
  animation-delay: 0.12s;
}

@keyframes success-petal {
  0% {
    opacity: 1;
    transform: translate(0, 0) rotate(0deg) scale(0.7);
  }
  100% {
    opacity: 0;
    transform: translate(var(--px), var(--py)) rotate(260deg) scale(1.1);
  }
}

.result-feedback > span:last-child {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.result-feedback strong {
  font-size: 10px;
}

.result-feedback small {
  color: var(--text-mid);
  font-size: 8px;
}

.result-spark {
  color: #55b98a;
  font-size: 19px;
  animation: result-spark 0.72s ease-out;
}

.tone-failure {
  background: #f6f3fb;
  border-color: #d7c9e8;
}

.tone-failure .result-spark {
  color: #9c84bf;
}

.tone-danger {
  background: #fff0f2;
  border-color: #eab3bd;
}

.tone-danger .result-spark {
  color: #cb596b;
}

.empty-selection,
.maxed-copy {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 5px;
  padding: 18px 12px;
  text-align: center;
  background: rgb(255 255 255 / 72%);
  border: 1px dashed #dfc8d6;
  border-radius: 15px;
}

.empty-selection > span {
  color: #c793df;
  font-size: 22px;
}

.empty-selection strong,
.maxed-copy strong {
  font-size: 11px;
}

.empty-selection small,
.maxed-copy span {
  color: var(--text-dim);
  font-size: 9px;
}

.empty-selection button {
  min-height: 44px;
  margin-top: 4px;
  padding: 0 18px;
  color: var(--blue-deep);
  font-weight: 700;
  background: #eef8ff;
  border: 1px solid #b7daef;
  border-radius: 999px;
}

.result-pop-enter-active,
.result-pop-leave-active {
  transition: all 0.2s ease;
}

.result-pop-enter-from,
.result-pop-leave-to {
  opacity: 0;
  transform: translateY(5px) scale(0.98);
}

@keyframes result-spark {
  0% {
    opacity: 0;
    transform: scale(0.2) rotate(-80deg);
  }
  55% {
    opacity: 1;
    transform: scale(1.35) rotate(18deg);
  }
}

.picker-overlay {
  position: fixed;
  z-index: 120;
  inset: 0;
  display: flex;
  align-items: flex-end;
  justify-content: center;
  padding: 10px;
  background: rgb(32 40 55 / 45%);
  backdrop-filter: blur(3px);
}

.picker-sheet {
  position: relative;
  display: flex;
  width: min(100%, 390px);
  max-height: min(72dvh, 620px);
  flex-direction: column;
  overflow: hidden;
  background: #fffafd;
  border: 1px solid rgb(255 255 255 / 82%);
  border-radius: 22px 22px 16px 16px;
  box-shadow: 0 18px 48px rgb(32 39 56 / 30%);
}

/* 面板顶部品牌渐变条 */
.picker-sheet::before {
  content: '';
  position: absolute;
  z-index: 1;
  top: 0;
  left: 0;
  right: 0;
  height: 4px;
  background: linear-gradient(90deg, var(--pink), var(--gold), var(--blue));
}

.picker-sheet header {
  justify-content: space-between;
  padding: 13px 15px 10px;
  border-bottom: 1px solid #eedee7;
}

.picker-sheet header strong {
  font-size: 14px;
}

.picker-sheet header button {
  width: 44px;
  height: 44px;
  margin: -7px -8px -7px 0;
  color: var(--text-dim);
  font-size: 24px;
}

.picker-list {
  display: flex;
  min-height: 0;
  flex-direction: column;
  gap: 7px;
  padding: 9px 10px calc(10px + env(safe-area-inset-bottom));
}

.picker-row {
  gap: 9px;
  min-height: 66px;
  padding: 7px 9px;
  text-align: left;
  background: #fff;
  border: 1px solid var(--line);
  border-radius: 14px;
  animation: row-in var(--t-slow) var(--ease-soft) both;
  animation-delay: var(--row-delay, 0ms);
  transition:
    transform var(--t-fast) var(--ease-spring),
    border-color var(--t-mid) var(--ease-soft),
    background-color var(--t-mid) var(--ease-soft);
}

.picker-row:active {
  transform: scale(0.97);
}

.picker-row.active {
  background: #fff4fa;
  border-color: #e9a9c4;
  box-shadow: 0 0 0 1px rgb(236 167 197 / 20%);
}

.picker-row > .picker-copy {
  display: flex;
  min-width: 0;
  flex: 1;
  flex-direction: column;
  gap: 3px;
}

.picker-row > i {
  color: var(--pink-deep);
  font-size: 18px;
  font-style: normal;
}

.picker-list > p {
  padding: 28px 10px;
  color: var(--text-dim);
  font-size: 11px;
  text-align: center;
}

.picker-enter-active,
.picker-leave-active {
  transition: opacity 0.2s ease;
}

.picker-enter-active .picker-sheet,
.picker-leave-active .picker-sheet {
  transition: transform 0.24s ease;
}

.picker-enter-from,
.picker-leave-to {
  opacity: 0;
}

.picker-enter-from .picker-sheet,
.picker-leave-to .picker-sheet {
  transform: translateY(18px);
}

@media (prefers-reduced-motion: reduce) {
  .luck-track i,
  .luck-track i::after,
  .result-spark,
  .result-feedback::before,
  .result-feedback::after,
  .result-spark::before,
  .result-spark::after,
  .selected-equipment,
  .level-route,
  .enhance-button,
  .enhance-button::after,
  .enhance-button span,
  .danger-confirm,
  .picker-row,
  .result-pop-enter-active,
  .result-pop-leave-active,
  .picker-enter-active,
  .picker-leave-active,
  .picker-enter-active .picker-sheet,
  .picker-leave-active .picker-sheet {
    animation: none !important;
    transition: none !important;
  }
}
</style>
