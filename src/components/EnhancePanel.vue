<script setup lang="ts">
import { computed, onUnmounted, ref, watch } from 'vue';
import { Anvil, ChevronDown, Hammer, Sparkles } from '@lucide/vue';
import { abbr, signed } from '@/core/format';
import { enhanceCost, enhanceRule, luckGainForRate, type EnhanceOutcome } from '@/core/enhance';
import { ENHANCE_BATCH_MILESTONES } from '@/core/enhanceBatch';
import { forgeStageAt } from '@/core/equipment';
import type { EquipmentDef, EquipmentInstance, EquipSlot, ForgeStage } from '@/core/types';
import { useInventoryStore } from '@/stores/inventory';
import { usePlayerStore } from '@/stores/player';
import {
  ENHANCE_BREAK_FROM,
  ENHANCE_MATERIAL_IDS,
  ENHANCE_MAX,
  LUCK_FULL,
  SLOT_LABELS,
  SLOT_ORDER,
} from '@/data/constants';
import { requireEquipment } from '@/data/equipment';
import { equipmentDisplayPresentation } from '@/data/equipmentPresentation';
import {
  FORGE_STAGE_ORDER,
  FORGE_STAGE_VISUALS,
  requireForgeStageVisual,
  type ForgeStageVisual,
} from '@/data/forgeVisuals';
import { requireItem } from '@/data/items';
import EquipmentIcon from '@/components/EquipmentIcon.vue';
import ItemIcon from '@/components/ItemIcon.vue';
import SystemArtwork from '@/components/SystemArtwork.vue';
import { prefersCompactLayout, useFold } from '@/ui/useFold';

defineOptions({ inheritAttrs: false });

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

const STAGE_NODES = FORGE_STAGE_ORDER.map((stage) => FORGE_STAGE_VISUALS[stage]);

const inventory = useInventoryStore();
const player = usePlayerStore();
const activeClassId = computed(() => {
  const classId = player.player?.classId;
  if (!classId) throw new Error('[强化台错误] 存档未载入，无法解析装备职业外观');
  return classId;
});
const equipmentName = (definition: EquipmentDef): string =>
  equipmentDisplayPresentation(definition, activeClassId.value).name;

const selectedUid = ref<string | null>(null);
const pickerOpen = ref(false);
const useProtection = ref(false);
const dangerConfirm = ref(false);
const feedback = ref<ResultFeedback | null>(null);
const resultSequence = ref(0);
const batchTarget = ref<number>(9);
const batchMode = ref<'single' | 'balanced' | null>(null);
const ritual = ref(false);
const awakening = ref<ForgeStageVisual | null>(null);
let initializedSelection = false;
let awakenTimer = 0;
let ritualTimer = 0;
let finishRitual: (() => void) | null = null;
let disposed = false;

/*
 * 强化台是养成页最高的一块，整块折叠交给 useFold 记忆。
 * 矮屏默认收起：玩家进来先看到好感与角色，强化时一键展开。
 * 折叠动画与 CollapsibleCard 同套 0fr ↔ 1fr 方案。
 */
const { open: bodyOpen, toggle: toggleBody } = useFold('growth.enhance', !prefersCompactLayout());

/** 收起时的一行速览：当前台上是哪件装备、强化到几级 */
const peekCopy = computed(() => {
  if (!selected.value) return '尚未选择装备';
  const { definition, instance } = selected.value;
  const plus = instance.enhance > 0 ? ` +${instance.enhance}` : '';
  return `${equipmentName(definition)}${plus} 在强化台上`;
});

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

const currentNodeIndex = computed(() => {
  const enhance = selected.value?.instance.enhance ?? 0;
  return STAGE_NODES.reduce(
    (current, node, index) => (enhance >= node.minLevel ? index : current),
    0,
  );
});

const nextNode = computed(() => {
  const enhance = selected.value?.instance.enhance ?? 0;
  return STAGE_NODES.find((node) => node.minLevel > enhance) ?? null;
});

const levelsToNextNode = computed(() => {
  if (!selected.value || !nextNode.value) return null;
  return nextNode.value.minLevel - selected.value.instance.enhance;
});

const equippedCandidates = computed(() =>
  candidates.value.filter((candidate) => candidate.source === 'equipped'),
);

const singleBatchDisabled = computed(
  () =>
    !selected.value ||
    selected.value.instance.enhance >= batchTarget.value ||
    batchMode.value !== null ||
    ritual.value,
);

const allBatchDisabled = computed(
  () =>
    equippedCandidates.value.length === 0 ||
    equippedCandidates.value.every(
      (candidate) => candidate.instance.enhance >= batchTarget.value,
    ) ||
    batchMode.value !== null ||
    ritual.value,
);

const ritualCopy = computed(() => (batchMode.value === 'balanced' ? '全身共鸣锻造中…' : '锻造中…'));

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
  return enhanceBlockLabel(quote.value.reason);
});

function enhanceBlockLabel(reason: string): string {
  const labels: Record<string, string> = {
    'not-found': '这件装备已不在背包或穿戴栏',
    'pending-affix-result': '请先采用或保留当前洗练候选，再进行强化',
    'max-level': `装备已经强化至 +${ENHANCE_MAX}`,
    'protection-not-allowed': '当前阶段不能使用保护符',
    'insufficient-gold': '金币不足',
    'insufficient-stone': '强化石不足',
    'insufficient-ore': '玄铁矿不足',
    'insufficient-lucky': '幸运九不足',
    'insufficient-protection': '保护符不足，请关闭保护后再决定',
    'no-equipped': '当前没有已穿戴装备',
    'invalid-target': '目标强化等级不合法',
  };
  return labels[reason] ?? '强化条件发生变化，请重新确认';
}

function materialCount(itemId: string): number {
  return inventory.bag?.items[itemId] ?? 0;
}

function assetUrl(asset: string): string {
  return `${import.meta.env.BASE_URL}${asset}`;
}

function pick(candidate: EnhanceCandidate): void {
  selectedUid.value = candidate.instance.uid;
  pickerOpen.value = false;
}

function revealAwakening(stage: ForgeStage): void {
  if (stage === 'original') return;
  awakening.value = requireForgeStageVisual(stage);
  clearTimeout(awakenTimer);
  awakenTimer = window.setTimeout(() => {
    awakening.value = null;
  }, 2_600);
}

function highestForgeStage(levels: readonly number[]): ForgeStage {
  return levels.reduce<ForgeStage>((highest, level) => {
    const stage = forgeStageAt(level);
    return FORGE_STAGE_ORDER.indexOf(stage) > FORGE_STAGE_ORDER.indexOf(highest) ? stage : highest;
  }, 'original');
}

function revealCrossedStage(beforeLevels: readonly number[], afterLevels: readonly number[]): void {
  const before = highestForgeStage(beforeLevels);
  const after = highestForgeStage(afterLevels);
  if (FORGE_STAGE_ORDER.indexOf(after) > FORGE_STAGE_ORDER.indexOf(before)) {
    revealAwakening(after);
  }
}

async function playForgeRitual(): Promise<void> {
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  ritual.value = true;
  await new Promise<void>((resolve) => {
    let finished = false;
    const finish = (): void => {
      if (finished) return;
      finished = true;
      clearTimeout(ritualTimer);
      ritualTimer = 0;
      finishRitual = null;
      resolve();
    };
    finishRitual = finish;
    ritualTimer = window.setTimeout(finish, 780);
  });
  ritual.value = false;
}

async function attempt(forceDanger = false): Promise<void> {
  if (!selectedUid.value || !selected.value || !preview.value || batchMode.value || ritual.value) {
    return;
  }

  const uid = selectedUid.value;
  const protection = useProtection.value;
  const stageBefore = forgeStageAt(selected.value.instance.enhance);

  if (preview.value.failure === 'break' && !protection && !forceDanger) {
    dangerConfirm.value = true;
    return;
  }

  dangerConfirm.value = false;
  const response = inventory.enhance(uid, protection);
  if (!response.ok) {
    resultSequence.value += 1;
    feedback.value = {
      outcome: 'blocked',
      title: '本次没有消耗任何资源',
      detail: enhanceBlockLabel(response.reason),
      tone: 'failure',
    };
    return;
  }

  await playForgeRitual();
  if (disposed) return;
  resultSequence.value += 1;

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

  if (response.result.outcome === 'success' && response.result.nextLevel !== null) {
    const stageAfter = forgeStageAt(response.result.nextLevel);
    if (stageAfter !== stageBefore) revealAwakening(stageAfter);
  }
}

async function runBatch(mode: 'single' | 'balanced'): Promise<void> {
  if (batchMode.value || ritual.value) return;
  if (mode === 'single' && !selected.value) return;

  const target = batchTarget.value;
  const beforeLevels =
    mode === 'single'
      ? [selected.value!.instance.enhance]
      : equippedCandidates.value.map((candidate) => candidate.instance.enhance);

  batchMode.value = mode;
  try {
    const response =
      mode === 'single'
        ? inventory.autoEnhance(selected.value!.instance.uid, target)
        : inventory.autoEnhanceAll(target);

    if (!response.ok) {
      resultSequence.value += 1;
      feedback.value = {
        outcome: 'blocked',
        title: '本次没有消耗任何资源',
        detail: enhanceBlockLabel(response.reason),
        tone: 'failure',
      };
      return;
    }

    if (response.attempts.length > 0) await playForgeRitual();
    if (disposed) return;
    resultSequence.value += 1;

    const successes = response.attempts.filter(
      (event) => event.result.outcome === 'success',
    ).length;
    const held = response.attempts.length - successes;
    const afterLevels = response.instances.map((instance) => instance.enhance);
    const firstBlocked = response.blocked[0];
    const stopCopy = firstBlocked
      ? `因${enhanceBlockLabel(firstBlocked.reason)}停止`
      : response.stopReason === 'attempt-limit'
        ? '已到单次操作上限'
        : '已到所选目标';
    const cpCopy = response.cpDelta === 0 ? '' : ` · 战力 ${signed(response.cpDelta)}`;

    if (response.attempts.length === 0) {
      feedback.value = {
        outcome: 'blocked',
        title: firstBlocked ? '资源不足，未进行强化' : '装备已经达到所选目标',
        detail: stopCopy,
        tone: 'failure',
      };
      return;
    }

    const levelCopy =
      mode === 'single'
        ? `当前 +${afterLevels[0] ?? beforeLevels[0]}`
        : `全身 +${Math.min(...afterLevels)}～+${Math.max(...afterLevels)}`;
    const completed = response.stopReason === 'target-reached';
    feedback.value = {
      outcome: 'success',
      title:
        mode === 'single'
          ? `一键强化${completed ? '完成' : '部分完成'}，${levelCopy}`
          : `全身均衡强化${completed ? '完成' : '部分完成'}`,
      detail: `${response.attempts.length} 次尝试 · 成功 ${successes} 次${
        held > 0 ? ` · 其余 ${held} 次保级或回落` : ''
      } · ${stopCopy}${cpCopy}`,
      tone: successes > 0 ? 'success' : 'failure',
    };
    revealCrossedStage(beforeLevels, afterLevels);
  } finally {
    if (!disposed) batchMode.value = null;
  }
}

onUnmounted(() => {
  disposed = true;
  clearTimeout(awakenTimer);
  clearTimeout(ritualTimer);
  finishRitual?.();
});
</script>

<template>
  <section v-bind="$attrs" class="enhance-panel card" aria-labelledby="enhance-title">
    <div class="panel-art" aria-hidden="true">
      <SystemArtwork kind="enhance" />
    </div>

    <header class="panel-head">
      <span>
        <small>装备成长</small>
        <strong id="enhance-title">樱光强化台</strong>
      </span>
      <button
        class="change-button"
        type="button"
        :disabled="batchMode !== null || ritual"
        @click="pickerOpen = true"
      >
        {{ selected ? '更换装备' : '选择装备' }}
      </button>
      <button
        class="fold-button"
        type="button"
        :aria-expanded="bodyOpen"
        :aria-label="bodyOpen ? '收起强化台' : '展开强化台'"
        @click="toggleBody"
      >
        <ChevronDown
          :size="15"
          class="fold-chev"
          :class="{ closed: !bodyOpen }"
          aria-hidden="true"
        />
      </button>
    </header>

    <!-- 收起态速览：一行告诉玩家台上是哪件装备，点一下即展开 -->
    <button v-if="!bodyOpen" type="button" class="enhance-peek" @click="toggleBody">
      <span class="peek-text">{{ peekCopy }}</span>
      <span class="peek-cta">展开 ›</span>
    </button>

    <div class="enhance-fold" :class="{ closed: !bodyOpen }">
      <div class="enhance-fold-inner">
        <div v-if="selected" :key="selected.instance.uid" class="selected-equipment">
          <EquipmentIcon
            :def="selected.definition"
            :class-id="activeClassId"
            :enhance="selected.instance.enhance"
            :locked="selected.instance.locked"
            size="lg"
            decorative
          />
          <span class="selected-copy">
            <strong :class="`q-${selected.definition.quality}`">
              {{ equipmentName(selected.definition) }}
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
            {{
              selectedUid ? '碎裂或移除后不会擅自替你选择下一件。' : '挂机获得装备后即可开始强化。'
            }}
          </small>
          <button v-if="candidates.length > 0" type="button" @click="pickerOpen = true">
            重新选择
          </button>
        </div>

        <div v-if="selected" class="stage-block">
          <div
            class="stage-track"
            role="img"
            :aria-label="`锻造外观进度 +${selected.instance.enhance} / ${ENHANCE_MAX}`"
          >
            <span class="track-rail" />
            <span
              class="track-fill"
              :style="{ width: `${(selected.instance.enhance / ENHANCE_MAX) * 100}%` }"
            />
            <span
              v-for="(node, index) in STAGE_NODES"
              :key="node.stage"
              class="stage-node"
              :class="{
                reached: selected.instance.enhance >= node.minLevel,
                current: currentNodeIndex === index,
              }"
              :style="{ left: `${(node.minLevel / ENHANCE_MAX) * 100}%` }"
            >
              <i class="node-dot" :class="`dot-${node.stage}`" />
              <small>{{ node.name }}</small>
              <em class="num">+{{ node.minLevel }}</em>
            </span>
          </div>
          <p v-if="nextNode && levelsToNextNode !== null" class="stage-hint">
            再强化 <b class="num">{{ levelsToNextNode }}</b> 级，外观觉醒为「{{ nextNode.name }}」
          </p>
          <p v-else class="stage-hint maxed">外观已觉醒至最高阶「樱华」✦</p>
        </div>

        <section v-if="selected" class="batch-tools" aria-labelledby="batch-title">
          <header>
            <span>
              <strong id="batch-title">一键强化</strong>
              <small>选择目标档，资源不足会安全停止</small>
            </span>
            <span class="safe-badge">+{{ ENHANCE_BREAK_FROM }} 起自动保护</span>
          </header>
          <div class="batch-targets" role="group" aria-label="一键强化目标等级">
            <button
              v-for="target in ENHANCE_BATCH_MILESTONES"
              :key="target"
              type="button"
              :class="{ active: batchTarget === target }"
              :aria-pressed="batchTarget === target"
              :disabled="batchMode !== null || ritual"
              @click="batchTarget = target"
            >
              +{{ target }}
            </button>
          </div>
          <div class="batch-actions">
            <button
              type="button"
              class="batch-single"
              :disabled="singleBatchDisabled"
              @click="runBatch('single')"
            >
              当前装备一键强化
            </button>
            <button
              type="button"
              class="batch-all"
              :disabled="allBatchDisabled"
              @click="runBatch('balanced')"
            >
              全身均衡强化
            </button>
          </div>
          <small class="batch-safe-copy">
            一键操作绝不会碎装；保护符不足时停在安全等级，已完成的强化会保留。
          </small>
        </section>

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
              <button type="button" class="danger-button" @click="attempt(true)">
                确认冒险强化
              </button>
            </span>
          </div>

          <button
            v-else
            class="enhance-button"
            type="button"
            :disabled="!quote?.ok || ritual || batchMode !== null"
            @click="attempt(false)"
          >
            <Sparkles :size="16" aria-hidden="true" />
            {{ ritual && batchMode === null ? '锻造中…' : actionLabel }}
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
            <span v-if="feedback.tone === 'success'" class="burst" aria-hidden="true">
              <b class="burst-ring" />
              <i class="b1" /><i class="b2" /><i class="b3" /><i class="b4" /><i class="b5" /><i
                class="b6"
              />
            </span>
            <span
              v-else
              class="burst ash"
              :class="{ danger: feedback.tone === 'danger' }"
              aria-hidden="true"
            >
              <i class="b1" /><i class="b2" /><i class="b3" />
            </span>
            <span class="result-spark" aria-hidden="true">✦</span>
            <span>
              <strong>{{ feedback.title }}</strong>
              <small>{{ feedback.detail }}</small>
            </span>
          </div>
        </Transition>
      </div>
    </div>

    <Transition name="ritual-fade">
      <div v-if="ritual" class="forge-ritual" aria-hidden="true">
        <span class="ritual-backdrop" />
        <Hammer class="ritual-hammer" :size="42" :stroke-width="1.8" />
        <Anvil class="ritual-anvil" :size="38" :stroke-width="1.8" />
        <span class="ritual-flash" />
        <i class="ritual-spark s1" /><i class="ritual-spark s2" /><i class="ritual-spark s3" /><i
          class="ritual-spark s4"
        />
        <span class="ritual-copy">{{ ritualCopy }}</span>
      </div>
    </Transition>

    <Transition name="awaken-pop">
      <div v-if="awakening" class="stage-awakening" :class="`awaken-${awakening.stage}`">
        <span class="awaken-rays" />
        <img
          v-if="awakening.overlayAsset"
          class="awaken-overlay"
          :src="assetUrl(awakening.overlayAsset)"
          alt=""
          aria-hidden="true"
        />
        <strong>外观觉醒 · {{ awakening.name }}</strong>
        <small>装备外观焕然一新</small>
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
                :class-id="activeClassId"
                :enhance="candidate.instance.enhance"
                :locked="candidate.instance.locked"
                size="md"
                decorative
              />
              <span class="picker-copy">
                <strong :class="`q-${candidate.definition.quality}`">
                  {{ equipmentName(candidate.definition) }}
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

/* 标题吃掉中间剩余空间，把「更换装备 + 折叠钮」一起顶到右缘 */
.panel-head > span:first-child {
  flex: 1;
  min-width: 0;
}

/* 折叠开关：贴在「更换装备」右侧的小圆钮，不占标题空间 */
.fold-button {
  display: grid;
  flex-shrink: 0;
  width: 30px;
  height: 30px;
  place-items: center;
  margin-left: 6px;
  color: var(--text-dim);
  background: var(--panel-3);
  border-radius: 50%;
  transition: background-color var(--t-fast) var(--ease-soft);
}

.fold-button:active {
  background: var(--line);
}

.fold-chev {
  transition: transform var(--t-mid) var(--ease-soft);
}

.fold-chev.closed {
  transform: rotate(-90deg);
}

/* 收起态速览行：整个条带都是热区，一键展开 */
.enhance-peek {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  width: 100%;
  min-height: 40px;
  padding: 8px 12px;
  text-align: left;
  background: linear-gradient(100deg, #fff8fb, #f5f8ff);
  border: 1px solid var(--line);
  border-radius: var(--r-sm);
}

.enhance-peek .peek-text {
  overflow: hidden;
  font-size: 11px;
  font-weight: 700;
  color: var(--text-mid);
  text-overflow: ellipsis;
  white-space: nowrap;
}

.enhance-peek .peek-cta {
  flex-shrink: 0;
  font-size: 10px;
  font-weight: 800;
  color: var(--pink-deep);
}

/* 0fr ↔ 1fr 折叠动画，与 CollapsibleCard 同套方案 */
.enhance-fold {
  display: grid;
  grid-template-rows: 1fr;
  opacity: 1;
  transition:
    grid-template-rows var(--t-mid) var(--ease-soft),
    opacity var(--t-fast) ease;
}

.enhance-fold.closed {
  grid-template-rows: 0fr;
  opacity: 0;
}

.enhance-fold-inner {
  display: grid;
  gap: 10px;
  overflow: hidden;
  min-height: 0;
}

@media (prefers-reduced-motion: reduce) {
  .enhance-fold,
  .fold-chev {
    transition: none;
  }
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
  min-height: 44px;
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
  position: absolute;
  inset: 0;
  content: '';
  background: linear-gradient(100deg, transparent 15%, rgb(255 255 255 / 70%) 50%, transparent 85%);
  background-size: 220% 100%;
  border-radius: inherit;
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
  filter: brightness(1.07);
  transform: scale(0.97);
}

.enhance-button:not(:disabled)::after {
  position: absolute;
  top: 0;
  bottom: 0;
  left: 0;
  width: 38%;
  content: '';
  background: linear-gradient(100deg, transparent, rgb(255 255 255 / 34%), transparent);
  pointer-events: none;
  animation: forge-shine 4.2s var(--ease-soft) infinite;
}

.enhance-button > svg {
  margin-right: 5px;
  color: #fff4b1;
  animation: forge-spark 2.2s ease-in-out infinite;
}

@keyframes forge-shine {
  0%,
  55% {
    transform: translate3d(-130%, 0, 0) skewX(-18deg);
  }
  82%,
  100% {
    transform: translate3d(410%, 0, 0) skewX(-18deg);
  }
}

@keyframes forge-spark {
  0%,
  100% {
    opacity: 0.6;
    transform: scale(0.9) rotate(0);
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

.result-feedback.tone-success::before,
.result-feedback.tone-success::after {
  position: absolute;
  top: 50%;
  left: 22px;
  width: 7px;
  height: 9px;
  margin-top: -4px;
  content: '';
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

.result-feedback.tone-success .result-spark {
  position: relative;
}

.result-feedback.tone-success .result-spark::before,
.result-feedback.tone-success .result-spark::after {
  position: absolute;
  width: 6px;
  height: 8px;
  content: '';
  background: linear-gradient(160deg, #ffe9d0, #ffcf8a);
  border-radius: 78% 22% 68% 32%;
  pointer-events: none;
  animation: success-petal 0.9s var(--ease-soft) both;
}

.result-feedback.tone-success .result-spark::before {
  top: 2px;
  left: 4px;
  --px: 30px;
  --py: 26px;
  animation-delay: 0.04s;
}

.result-feedback.tone-success .result-spark::after {
  top: 4px;
  left: 8px;
  --px: -26px;
  --py: 22px;
  animation-delay: 0.12s;
}

@keyframes success-petal {
  0% {
    opacity: 1;
    transform: translate(0, 0) rotate(0) scale(0.7);
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
  /*
   * 底部弹出式：原本 align-items:flex-end 贴底，内容一高就向上溢出且滚不到。
   * 改成可滚动 flex + 子面板 margin-top:auto —— 放得下仍贴底，
   * 放不下自动退化成顶部对齐并可滚完。详见 style.css 里 .overlay 的说明。
   */
  display: flex;
  overflow-y: auto;
  overscroll-behavior: contain;
  -webkit-overflow-scrolling: touch;
  padding: max(10px, env(safe-area-inset-top)) 10px max(10px, env(safe-area-inset-bottom));
  background: rgb(32 40 55 / 45%);
  backdrop-filter: blur(3px);
}

.picker-sheet {
  position: relative;
  margin: auto auto 0;
  flex-shrink: 0;
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

.picker-sheet::before {
  position: absolute;
  z-index: 1;
  top: 0;
  right: 0;
  left: 0;
  height: 4px;
  content: '';
  background: linear-gradient(90deg, var(--pink), var(--gold), var(--blue));
  pointer-events: none;
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

/* 锻造外观里程碑 */
.stage-block {
  display: flex;
  flex-direction: column;
  gap: 5px;
  padding: 9px 4px 1px;
}

.stage-track {
  position: relative;
  height: 42px;
  margin-inline: 22px;
}

.track-rail,
.track-fill {
  position: absolute;
  top: 8px;
  left: 0;
  height: 4px;
  border-radius: 999px;
}

.track-rail {
  right: 0;
  background: rgb(190 205 220 / 45%);
}

.track-fill {
  max-width: 100%;
  background: linear-gradient(90deg, #9bcff3, #f69fc3, #ffe596);
  box-shadow: 0 0 7px rgb(246 159 195 / 55%);
  transition: width 0.5s var(--ease-soft);
}

.stage-node {
  position: absolute;
  top: 0;
  display: flex;
  width: 44px;
  margin-left: -22px;
  flex-direction: column;
  align-items: center;
  color: var(--text-dim);
  text-align: center;
  opacity: 0.55;
  transform: scale(0.92);
  transition:
    opacity var(--t-mid) var(--ease-soft),
    transform var(--t-mid) var(--ease-spring);
}

.stage-node.reached {
  color: var(--text);
  opacity: 1;
}

.stage-node.current {
  transform: scale(1.06);
}

.node-dot {
  width: 16px;
  height: 16px;
  background: #fff;
  border: 2.5px solid #c6d3de;
  border-radius: 50%;
  box-shadow: 0 1px 4px rgb(90 110 130 / 20%);
}

.stage-node.reached .dot-original {
  border-color: #b9c8d4;
}

.stage-node.reached .dot-gleam {
  border-color: #7dddf0;
  box-shadow: 0 0 7px rgb(105 210 238 / 55%);
}

.stage-node.reached .dot-radiant {
  border-color: #8fb8ff;
  box-shadow: 0 0 7px rgb(102 157 244 / 60%);
}

.stage-node.reached .dot-starforged {
  border-color: #e6a8ff;
  box-shadow: 0 0 8px rgb(202 126 243 / 65%);
}

.stage-node.reached .dot-sakura {
  border-color: #ffd98b;
  box-shadow: 0 0 10px rgb(255 179 210 / 75%);
}

.stage-node.current .node-dot {
  animation: node-pulse 1.8s ease-in-out infinite;
}

.stage-node small {
  margin-top: 3px;
  font-size: 9px;
  font-weight: 700;
  line-height: 1;
}

.stage-node em {
  font-size: 8px;
  font-style: normal;
  line-height: 1.2;
}

.stage-hint {
  margin: 0;
  font-size: 9.5px;
  color: var(--text-dim);
}

.stage-hint b {
  color: var(--pink-deep);
}

.stage-hint.maxed {
  color: #a8790f;
}

@keyframes node-pulse {
  50% {
    transform: scale(1.22);
  }
}

/* 安全的一键强化入口 */
.batch-tools {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 10px;
  background: linear-gradient(145deg, rgb(247 251 255 / 94%), rgb(255 246 251 / 94%));
  border: 1px solid rgb(185 210 233 / 64%);
  border-radius: 15px;
  box-shadow: inset 0 0 0 1px rgb(255 255 255 / 70%);
}

.batch-tools header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.batch-tools header > span:first-child {
  display: flex;
  min-width: 0;
  flex-direction: column;
}

.batch-tools header strong {
  font-size: 11px;
}

.batch-tools header small,
.batch-safe-copy {
  color: var(--text-dim);
  font-size: 8px;
}

.safe-badge {
  flex-shrink: 0;
  padding: 3px 7px;
  color: #6575a5;
  font-size: 8px;
  font-weight: 800;
  background: linear-gradient(120deg, #eef8ff, #f4edff);
  border: 1px solid #cfdaef;
  border-radius: 999px;
}

.batch-targets,
.batch-actions {
  display: grid;
  gap: 6px;
}

.batch-targets {
  grid-template-columns: repeat(4, minmax(0, 1fr));
}

.batch-targets button {
  min-height: 40px;
  color: var(--text-mid);
  font-size: 11px;
  font-weight: 800;
  background: rgb(255 255 255 / 82%);
  border: 1px solid var(--line);
  border-radius: 11px;
}

.batch-targets button.active {
  color: var(--pink-deep);
  background: #fff0f6;
  border-color: #f0a9c8;
  box-shadow: 0 0 0 2px rgb(240 169 200 / 14%);
}

.batch-actions {
  grid-template-columns: repeat(2, minmax(0, 1fr));
}

.batch-actions button {
  min-height: 44px;
  padding: 6px 8px;
  font-size: 9.5px;
  font-weight: 800;
  border-radius: 12px;
}

.batch-single {
  color: #437ca4;
  background: #edf8ff;
  border: 1px solid #a9d5ee;
}

.batch-all {
  color: #fff;
  background: linear-gradient(135deg, #819fdf, #e880ad);
  border: 1px solid rgb(255 255 255 / 65%);
  box-shadow: 0 4px 10px rgb(106 120 178 / 20%);
}

.batch-targets button:disabled,
.batch-actions button:disabled,
.change-button:disabled {
  cursor: default;
  opacity: 0.48;
}

.batch-safe-copy {
  line-height: 1.45;
}

/* 成功花瓣、失败灰烬与碎裂红屑 */
.burst {
  position: absolute;
  inset: 0;
  pointer-events: none;
}

.burst i {
  position: absolute;
  top: 50%;
  left: 24px;
  width: 7px;
  height: 9px;
  margin-top: -5px;
  background: linear-gradient(160deg, #ffd9e8, #ff9fc4);
  border-radius: 78% 22% 68% 32%;
  opacity: 0;
  animation: burst-fly 0.95s var(--ease-soft) both;
}

.burst .b1 {
  --bx: 66px;
  --by: -34px;
}

.burst .b2 {
  --bx: -52px;
  --by: -30px;
  animation-delay: 0.07s;
}

.burst .b3 {
  --bx: 40px;
  --by: 30px;
  background: linear-gradient(160deg, #ffe9d0, #ffcf8a);
  animation-delay: 0.11s;
}

.burst .b4 {
  --bx: -34px;
  --by: 28px;
  background: linear-gradient(160deg, #ffe9d0, #ffcf8a);
  animation-delay: 0.15s;
}

.burst .b5 {
  --bx: 12px;
  --by: -42px;
  animation-delay: 0.19s;
}

.burst .b6 {
  --bx: 84px;
  --by: 4px;
  background: linear-gradient(160deg, #d6ecff, #9fd0f5);
  animation-delay: 0.23s;
}

.burst-ring {
  position: absolute;
  top: 50%;
  left: 24px;
  width: 10px;
  height: 10px;
  margin: -5px 0 0 -5px;
  border: 2px solid rgb(255 190 120 / 90%);
  border-radius: 50%;
  animation: burst-ring 0.7s ease-out both;
}

.burst.ash i {
  width: 6px;
  height: 6px;
  background: linear-gradient(160deg, #cdd6dd, #a8b4bd);
  border-radius: 45%;
  animation: ash-fall 1.1s ease-in both;
}

.burst.ash .b1 {
  --bx: 30px;
  --by: 26px;
}

.burst.ash .b2 {
  --bx: -20px;
  --by: 22px;
  animation-delay: 0.14s;
}

.burst.ash .b3 {
  --bx: 56px;
  --by: 18px;
  animation-delay: 0.22s;
}

.burst.ash.danger i {
  background: linear-gradient(160deg, #ffb3b8, #e4566c);
}

@keyframes burst-fly {
  from {
    opacity: 1;
    transform: translate(0) rotate(0) scale(0.6);
  }
  to {
    opacity: 0;
    transform: translate(var(--bx), var(--by)) rotate(300deg) scale(1.15);
  }
}

@keyframes burst-ring {
  from {
    opacity: 0.95;
    transform: scale(0.4);
  }
  to {
    opacity: 0;
    transform: scale(5.2);
  }
}

@keyframes ash-fall {
  from {
    opacity: 0.9;
    transform: translateY(-6px) rotate(0);
  }
  to {
    opacity: 0;
    transform: translate(var(--bx), var(--by)) rotate(160deg);
  }
}

/* 锻造仪式遮罩 */
.forge-ritual {
  position: absolute;
  z-index: 30;
  inset: 0;
  display: grid;
  overflow: hidden;
  place-items: center;
  border-radius: inherit;
}

.ritual-backdrop {
  position: absolute;
  inset: 0;
  background: rgb(58 46 68 / 46%);
  backdrop-filter: blur(2px);
}

.ritual-hammer,
.ritual-anvil {
  position: absolute;
  color: #fff2c4;
  filter: drop-shadow(0 4px 6px rgb(0 0 0 / 30%));
}

.ritual-hammer {
  z-index: 2;
  transform-origin: 70% 80%;
  animation: hammer-strike 0.78s ease-in both;
}

.ritual-anvil {
  z-index: 1;
  margin-top: 48px;
  color: #d9e8f4;
  animation: anvil-bounce 0.78s ease-in both;
}

.ritual-flash {
  position: absolute;
  z-index: 3;
  width: 18px;
  height: 18px;
  margin-top: 40px;
  background: radial-gradient(circle, #fff 0%, #ffe596 45%, transparent 72%);
  border-radius: 50%;
  animation: ritual-flash 0.78s ease-out both;
}

.ritual-spark {
  position: absolute;
  z-index: 3;
  width: 5px;
  height: 5px;
  margin-top: 40px;
  background: #ffe596;
  border-radius: 50%;
  box-shadow: 0 0 6px #ffcf6a;
  opacity: 0;
  animation: ritual-spark 0.78s ease-out both;
}

.ritual-spark.s1 {
  --sx: -46px;
  --sy: -34px;
}

.ritual-spark.s2 {
  --sx: 44px;
  --sy: -30px;
  animation-delay: 0.02s;
}

.ritual-spark.s3 {
  --sx: -30px;
  --sy: 26px;
  animation-delay: 0.04s;
}

.ritual-spark.s4 {
  --sx: 34px;
  --sy: 30px;
  animation-delay: 0.06s;
}

.ritual-copy {
  position: absolute;
  z-index: 4;
  bottom: 27%;
  color: #ffe9f3;
  font-size: 11px;
  font-weight: 800;
  letter-spacing: 2px;
  text-shadow: 0 1px 6px rgb(0 0 0 / 45%);
}

.ritual-fade-enter-active,
.ritual-fade-leave-active {
  transition: opacity 0.16s ease;
}

.ritual-fade-enter-from,
.ritual-fade-leave-to {
  opacity: 0;
}

@keyframes hammer-strike {
  0% {
    transform: translate(26px, -46px) rotate(38deg);
  }
  42%,
  54% {
    transform: translate(0, 6px) rotate(-14deg);
  }
  100% {
    opacity: 0.9;
    transform: translate(8px, -30px) rotate(20deg);
  }
}

@keyframes anvil-bounce {
  42% {
    transform: translateY(3px) scaleY(0.94);
  }
  60% {
    transform: translateY(-2px);
  }
}

@keyframes ritual-flash {
  0%,
  34% {
    opacity: 0;
    transform: scale(0.3);
  }
  44% {
    opacity: 1;
    transform: scale(2.6);
  }
  100% {
    opacity: 0;
    transform: scale(4.4);
  }
}

@keyframes ritual-spark {
  0%,
  30% {
    opacity: 0;
    transform: translate(0) scale(0.5);
  }
  42% {
    opacity: 1;
  }
  100% {
    opacity: 0;
    transform: translate(var(--sx), var(--sy));
  }
}

/* 跨阶段外观觉醒横幅 */
.stage-awakening {
  position: absolute;
  z-index: 32;
  top: 34%;
  left: 50%;
  display: flex;
  min-width: 230px;
  padding: 12px 24px 12px 68px;
  overflow: hidden;
  flex-direction: column;
  align-items: flex-start;
  gap: 2px;
  background: linear-gradient(135deg, rgb(255 251 235 / 98%), rgb(255 240 250 / 98%));
  border: 1px solid rgb(240 200 110 / 80%);
  border-radius: 999px;
  box-shadow:
    0 8px 30px rgb(240 180 60 / 40%),
    inset 0 0 18px rgb(255 235 170 / 60%);
  transform: translateX(-50%);
}

.awaken-overlay {
  position: absolute;
  z-index: 1;
  top: 50%;
  left: 8px;
  width: 54px;
  height: 54px;
  object-fit: contain;
  transform: translateY(-50%);
  pointer-events: none;
}

.stage-awakening strong,
.stage-awakening small {
  position: relative;
  z-index: 2;
}

.stage-awakening strong {
  font-size: 14px;
  letter-spacing: 1px;
  background: linear-gradient(90deg, #c98f10, #e06ba4);
  background-clip: text;
  color: transparent;
}

.stage-awakening small {
  color: #a08a50;
  font-size: 9px;
}

.awaken-rays {
  position: absolute;
  inset: -80%;
  background: repeating-conic-gradient(
    from 0deg,
    transparent 0deg 24deg,
    rgb(255 203 139 / 32%) 24deg 36deg
  );
  animation: rays-spin 3.2s linear infinite;
}

.awaken-pop-enter-active {
  animation: awaken-in 0.5s var(--ease-out-back) both;
}

.awaken-pop-leave-active {
  transition:
    opacity 0.24s ease-in,
    transform 0.24s ease-in;
}

.awaken-pop-leave-to {
  opacity: 0;
  transform: translateX(-50%) translateY(-10px) scale(0.92);
}

@keyframes awaken-in {
  from {
    opacity: 0;
    transform: translateX(-50%) translateY(14px) scale(0.7);
  }
}

@keyframes rays-spin {
  to {
    transform: rotate(360deg);
  }
}

@media (prefers-reduced-motion: reduce) {
  .luck-track i,
  .luck-track i::after,
  .result-spark,
  .result-feedback::before,
  .result-feedback::after,
  .result-spark::before,
  .result-spark::after,
  .burst i,
  .burst-ring,
  .stage-node.current .node-dot,
  .track-fill,
  .forge-ritual,
  .forge-ritual svg,
  .forge-ritual span,
  .forge-ritual i,
  .stage-awakening,
  .awaken-rays,
  .selected-equipment,
  .level-route,
  .enhance-button,
  .enhance-button::after,
  .enhance-button > svg,
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
