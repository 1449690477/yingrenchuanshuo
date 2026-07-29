<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { Lock, Sparkles, X } from '@lucide/vue';
import { createFocusTrap, type FocusTrap } from 'focus-trap';
import type { Affix, AffixChangeOperation, EquipmentInstance } from '@/core/types';
import { affixChangeCost, bindMaterialCost, type AffixChangeBlockReason } from '@/core/reforge';
import { abbr } from '@/core/format';
import { useGameStore } from '@/stores/game';
import { useInventoryStore } from '@/stores/inventory';
import { usePlayerStore } from '@/stores/player';
import { requireEquipment } from '@/data/equipment';
import { requireItem } from '@/data/items';
import {
  isAffixSettlementActive,
  QUALITY_LABELS,
  SLOT_LABELS,
  SLOT_ORDER,
} from '@/data/constants';
import {
  REFORGE_RESONANCE_MAX,
  REFORGE_UNLOCK_LEVEL,
  requireRegionReforgeMaterials,
} from '@/data/reforgeRules';
import { requireRegionOfChapter } from '@/data/regions';
import {
  affixDisplayName,
  affixProfessionLabel,
  affixRuntimeNotice,
  affixTierName,
  formatAffixValue,
} from '@/ui/affixPresentation';
import {
  adviseReforge,
  topRecommendation,
  type EquipmentAssessment,
  type ReforgeRecommendation,
} from '@/core/reforgeAdvisor';
import ItemIcon from '@/components/ItemIcon.vue';

/**
 * 星辉洗练坊：词条洗练的独立操作台。
 *
 * 与装备详情页里的 ReforgePanel 共用同一套核心规则（core/reforge.ts），
 * 这里额外承担两件事：
 *  1. 把背包+穿戴里所有可洗练装备聚到一条轨道上，玩家不用逐件翻详情；
 *  2. 用 core/reforgeAdvisor 给出首推建议，一键「按推荐选用」只做选中与
 *     切换操作，消耗材料永远由玩家亲手点「洗练一次」。
 */
const emit = defineEmits<{ close: [] }>();

const inventory = useInventoryStore();
const player = usePlayerStore();
const game = useGameStore();

const selectedUid = ref<string | null>(null);
const operation = ref<AffixChangeOperation>('reforge');
const lockedIndices = ref<number[]>([]);
const resonateTarget = ref<number | null>(null);
const rolling = ref(false);
const feedback = ref('');
const shellRef = ref<HTMLElement | null>(null);
const closeButtonRef = ref<HTMLButtonElement | null>(null);
let dialogFocusTrap: FocusTrap | null = null;
let revealTimer = 0;
let initializedSelection = false;

const BASE = import.meta.env.BASE_URL;
const bannerUrl = `${BASE}assets/effects/reforge/reforge-studio-banner.webp`;
const reforgeSwirlUrl = `${BASE}assets/effects/reforge/reforge-swirl.png`;
const tierUpBurstUrl = `${BASE}assets/effects/reforge/tier-up-burst.png`;
const lockSealUrl = `${BASE}assets/effects/reforge/lock-seal.png`;
const emblemUrls: Readonly<Record<AffixChangeOperation, string>> = {
  reforge: `${BASE}assets/effects/reforge/op-reforge.png`,
  temper: `${BASE}assets/effects/reforge/op-temper.png`,
  inscribe: `${BASE}assets/effects/reforge/op-inscribe.png`,
  resonate: `${BASE}assets/effects/reforge/op-resonate.png`,
};

interface GearEntry {
  instance: EquipmentInstance;
  source: 'equipped' | 'bag';
}

const gearEntries = computed<GearEntry[]>(() => {
  const result: GearEntry[] = [];
  const seen = new Set<string>();
  for (const slot of SLOT_ORDER) {
    const instance = inventory.equipped?.[slot] ?? null;
    if (!instance) continue;
    result.push({ instance, source: 'equipped' });
    seen.add(instance.uid);
  }
  for (const instance of inventory.bag?.equipment ?? []) {
    if (seen.has(instance.uid)) continue;
    result.push({ instance, source: 'bag' });
  }
  return result;
});

const assessments = computed<EquipmentAssessment[]>(() => {
  const classId = player.player?.classId;
  if (!classId) return [];
  return adviseReforge({
    classId,
    entries: gearEntries.value.map(({ instance, source }) => ({
      instance,
      definition: requireEquipment(instance.defId),
      source,
    })),
  });
});

const topPick = computed(() => topRecommendation(assessments.value));

const selectedAssessment = computed(
  () => assessments.value.find((entry) => entry.uid === selectedUid.value) ?? null,
);
const selectedInstance = computed(
  () =>
    gearEntries.value.find((entry) => entry.instance.uid === selectedUid.value)?.instance ?? null,
);
const selectedDefinition = computed(() =>
  selectedInstance.value ? requireEquipment(selectedInstance.value.defId) : null,
);

watch(
  assessments,
  (list) => {
    if (list.length === 0) {
      selectedUid.value = null;
      return;
    }
    if (selectedUid.value && list.some((entry) => entry.uid === selectedUid.value)) return;
    if (initializedSelection) {
      selectedUid.value = list[0]!.uid;
      return;
    }
    selectedUid.value = (topPick.value?.assessment ?? list[0]!).uid;
    initializedSelection = true;
  },
  { immediate: true },
);

const pending = computed(() => selectedInstance.value?.pendingAffixChange ?? null);
const oldPendingAffix = computed<Affix | null>(() => {
  const value = pending.value;
  const inst = selectedInstance.value;
  if (!value || !inst) return null;
  const previous = inst.affixes[value.affixIndex];
  if (!previous) {
    throw new Error(`[存档错误] 洗练候选下标越界：${value.affixIndex}`);
  }
  return previous;
});
const pendingTierUp = computed(
  () =>
    oldPendingAffix.value !== null &&
    pending.value !== null &&
    pending.value.candidate.tier > oldPendingAffix.value.tier,
);

const regionMaterials = computed(() =>
  requireRegionReforgeMaterials(requireRegionOfChapter(game.currentStage.chapterId).id),
);
const itemCounts = computed(() => inventory.bag?.items ?? {});
const levelUnlocked = computed(() => (player.player?.level ?? 0) >= REFORGE_UNLOCK_LEVEL);

const unlockedIndices = computed(() => {
  const inst = selectedInstance.value;
  if (!inst) return [];
  return inst.affixes
    .map((_, index) => index)
    .filter((index) => !lockedIndices.value.includes(index));
});
const hasDeferredAffix = computed(() =>
  Boolean(
    selectedInstance.value?.affixes.some((affix) => !isAffixSettlementActive(affix.key)),
  ),
);
const operationTargets = computed(() => {
  const inst = selectedInstance.value;
  if (!inst) return [];
  if (operation.value === 'resonate') {
    return resonateTarget.value === null ? [] : [resonateTarget.value];
  }
  if (operation.value === 'temper') {
    return unlockedIndices.value.filter((index) =>
      isAffixSettlementActive(inst.affixes[index]!.key),
    );
  }
  return unlockedIndices.value;
});

const operationOptions: readonly {
  id: AffixChangeOperation;
  name: string;
  desc: string;
}[] = [
  { id: 'reforge', name: '重铸', desc: '随机一条：类型与品阶都变' },
  { id: 'temper', name: '淬炼', desc: '随机一条：保留类型，只洗品阶' },
  { id: 'inscribe', name: '铭刻', desc: '随机一条：必出当前职业专属' },
  { id: 'resonate', name: '同调', desc: '指定一条：直接提升一个品阶' },
];
const activeOperationName = computed(() => {
  const selected = operationOptions.find((entry) => entry.id === operation.value);
  if (!selected) throw new Error(`[洗练错误] 未登记的操作：${operation.value}`);
  return selected.name;
});

interface CostRange {
  gold: { min: number; max: number };
  items: { itemId: string; min: number; max: number }[];
}

const costRange = computed<CostRange | null>(() => {
  const currentPlayer = player.player;
  const inst = selectedInstance.value;
  const def = selectedDefinition.value;
  if (!currentPlayer || !inst || !def || pending.value || operationTargets.value.length === 0) {
    return null;
  }
  const costs = operationTargets.value.map((index) =>
    affixChangeCost(
      operation.value,
      def.level,
      inst.affixes[index]!.tier,
      operation.value === 'resonate' ? 0 : lockedIndices.value.length,
      currentPlayer.classId,
      regionMaterials.value,
    ),
  );
  const itemIds = [...new Set(costs.flatMap((cost) => Object.keys(cost.items)))];
  return {
    gold: {
      min: Math.min(...costs.map((cost) => cost.gold)),
      max: Math.max(...costs.map((cost) => cost.gold)),
    },
    items: itemIds.map((itemId) => ({
      itemId,
      min: Math.min(...costs.map((cost) => cost.items[itemId] ?? 0)),
      max: Math.max(...costs.map((cost) => cost.items[itemId] ?? 0)),
    })),
  };
});

const canAffordPreview = computed(() => {
  const cost = costRange.value;
  if (!cost || (player.player?.gold ?? 0) < cost.gold.max) return false;
  return cost.items.every(({ itemId, max }) => (itemCounts.value[itemId] ?? 0) >= max);
});

const canStart = computed(() => {
  const inst = selectedInstance.value;
  return (
    levelUnlocked.value &&
    inst !== null &&
    !pending.value &&
    !rolling.value &&
    operationTargets.value.length > 0 &&
    canAffordPreview.value &&
    !(
      operation.value === 'resonate' &&
      resonateTarget.value !== null &&
      inst.affixes[resonateTarget.value]?.tier === 5
    )
  );
});

const bindCost = computed(() =>
  operation.value === 'resonate' ? 0 : bindMaterialCost(lockedIndices.value.length),
);
const rollHint = computed(() => {
  const inst = selectedInstance.value;
  if (!inst) return '';
  if (operation.value === 'resonate') return '点选一条未满阶词条作为同调目标。';
  if (operation.value === 'temper') {
    return `本次会从 ${operationTargets.value.length} 条已结算词条中随机选 1 条；延后词条不会参与。`;
  }
  if (lockedIndices.value.length === 0) {
    return `本次会从全部 ${inst.affixes.length} 条中随机选 1 条。`;
  }
  return `已定契 ${lockedIndices.value.length} 条，本次从其余 ${unlockedIndices.value.length} 条中随机选 1 条。`;
});

function gradeOf(affixScore: number): { grade: string; label: string } {
  if (affixScore >= 80) return { grade: 's', label: 'S' };
  if (affixScore >= 60) return { grade: 'a', label: 'A' };
  if (affixScore >= 40) return { grade: 'b', label: 'B' };
  return { grade: 'c', label: 'C' };
}

function operationName(id: AffixChangeOperation): string {
  return operationOptions.find((entry) => entry.id === id)?.name ?? id;
}

function selectGear(uid: string): void {
  if (rolling.value) return;
  if (uid === selectedUid.value) return;
  selectedUid.value = uid;
  feedback.value = '';
  lockedIndices.value = [];
  resonateTarget.value = null;
}

function applyRecommendation(pick: {
  assessment: EquipmentAssessment;
  recommendation: ReforgeRecommendation;
}): void {
  if (rolling.value) return;
  selectedUid.value = pick.assessment.uid;
  operation.value = pick.recommendation.operation;
  resonateTarget.value = pick.recommendation.operation === 'resonate'
    ? (pick.recommendation.targetIndex ?? null)
    : null;
  lockedIndices.value = [];
  feedback.value = '';
}

function selectOperation(next: AffixChangeOperation): void {
  if (pending.value || rolling.value) return;
  operation.value = next;
  feedback.value = '';
  lockedIndices.value = [];
  resonateTarget.value = null;
}

function toggleAffix(index: number): void {
  const inst = selectedInstance.value;
  if (!inst || pending.value || rolling.value) return;
  feedback.value = '';
  if (operation.value === 'resonate') {
    const selected = inst.affixes[index];
    if (selected && isAffixSettlementActive(selected.key) && selected.tier < 5) {
      resonateTarget.value = index;
    }
    return;
  }
  if (operation.value === 'temper' && !isAffixSettlementActive(inst.affixes[index]!.key)) {
    return;
  }
  lockedIndices.value = lockedIndices.value.includes(index)
    ? lockedIndices.value.filter((candidate) => candidate !== index)
    : [...lockedIndices.value, index].sort((a, b) => a - b);
}

function startChange(): void {
  const inst = selectedInstance.value;
  if (!inst || !canStart.value) return;
  feedback.value = '';
  const result = inventory.startAffixChange(
    inst.uid,
    operation.value,
    lockedIndices.value,
    operation.value === 'resonate' ? (resonateTarget.value ?? undefined) : undefined,
  );
  if (!result.ok) {
    feedback.value = blockMessage(result.reason, 'itemId' in result ? result.itemId : undefined);
    return;
  }
  rolling.value = true;
  window.clearTimeout(revealTimer);
  revealTimer = window.setTimeout(() => {
    rolling.value = false;
  }, 520);
}

function decide(decision: 'adopt' | 'keep'): void {
  const inst = selectedInstance.value;
  if (!inst) return;
  const result = inventory.resolveAffixChange(inst.uid, decision);
  if (!result.ok) {
    feedback.value = blockMessage(result.reason);
    return;
  }
  feedback.value = result.adopted ? '新词条已采用。' : '已保留原词条，材料与共鸣结算不回退。';
  lockedIndices.value = [];
  resonateTarget.value = null;
}

type UiBlockReason =
  AffixChangeBlockReason | 'no-save' | 'not-found' | 'level-locked' | 'no-pending-result';

function blockMessage(reason: UiBlockReason, itemId?: string): string {
  switch (reason) {
    case 'no-save':
      return '存档尚未载入。';
    case 'not-found':
      return '这件装备已不在背包或穿戴栏。';
    case 'level-locked':
      return `角色达到 Lv${REFORGE_UNLOCK_LEVEL} 后开放洗练。`;
    case 'pending-result':
      return '请先处理上一条洗练结果。';
    case 'no-random-affixes':
      return '固定珍品没有可洗练的随机词条。';
    case 'invalid-locks':
      return '定契选择无效，请重新选择。';
    case 'all-affixes-locked':
      return '至少要留一条未锁词条。';
    case 'invalid-target':
      return '请先选择同调目标。';
    case 'deferred-affix':
      return '该词条等待后续技能结算，只能通过重铸或铭刻换掉。';
    case 'max-tier':
      return '极品词条已经达到最高品阶。';
    case 'no-candidate':
      return '当前组合没有不重复的新词条，请少锁一条或换一种操作。';
    case 'insufficient-gold':
      return '金币不足。';
    case 'insufficient-item':
      if (!itemId) throw new Error('[洗练错误] 材料不足结果缺少物品 ID');
      return `${requireItem(itemId).name}不足。`;
    case 'no-pending-result':
      return '洗练候选已经处理过了。';
    default: {
      const exhaustive: never = reason;
      throw new Error(`[洗练错误] 未处理的阻止原因：${exhaustive}`);
    }
  }
}

function rangeText(min: number, max: number): string {
  return min === max ? String(max) : `${min}～${max}`;
}

onMounted(async () => {
  await nextTick();
  const shell = shellRef.value;
  if (!shell) return;
  dialogFocusTrap = createFocusTrap(shell, {
    initialFocus: () => closeButtonRef.value ?? shell,
    fallbackFocus: () => shell,
    clickOutsideDeactivates: true,
    isolateSubtrees: 'aria-hidden',
    onDeactivate: () => emit('close'),
  });
  dialogFocusTrap.activate();
});

function requestClose(): void {
  if (dialogFocusTrap?.active) {
    dialogFocusTrap.deactivate();
    return;
  }
  emit('close');
}

onBeforeUnmount(() => {
  window.clearTimeout(revealTimer);
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
  <div class="studio-overlay" role="dialog" aria-modal="true" aria-label="星辉洗练坊">
    <div ref="shellRef" class="studio-shell" tabindex="-1">
      <header class="studio-head">
        <img class="head-banner" :src="bannerUrl" alt="" aria-hidden="true" />
        <div class="head-veil" aria-hidden="true" />
        <span v-for="n in 5" :key="n" class="head-sparkle" :class="`sp-${n}`" aria-hidden="true" />
        <div class="head-copy">
          <small>星辉洗练坊</small>
          <h2>让每一件装备都回应你的心意</h2>
          <p>{{ assessments.length }} 件装备可以洗练</p>
        </div>
        <button
          ref="closeButtonRef"
          class="icon-button head-close"
          aria-label="关闭洗练坊"
          @click="requestClose"
        >
          <X :size="19" aria-hidden="true" />
        </button>
      </header>

      <div class="studio-body">
        <p v-if="!levelUnlocked" class="locked-banner">
          角色达到 Lv{{ REFORGE_UNLOCK_LEVEL }} 后，洗练坊才会开张；先去冒险提升等级吧。
        </p>

        <template v-else>
          <!-- 首推建议 -->
          <section v-if="topPick" class="advisor-banner" data-testid="advisor-banner">
            <div class="advisor-glow" aria-hidden="true" />
            <div class="advisor-title">
              <Sparkles :size="15" aria-hidden="true" />
              <b>洗练推荐</b>
              <span class="advisor-op">{{ operationName(topPick.recommendation.operation) }}</span>
            </div>
            <p class="advisor-headline">
              <b>{{ requireEquipment(topPick.assessment.defId).name }}</b>
              · {{ topPick.recommendation.headline }}
            </p>
            <p class="advisor-reason">{{ topPick.recommendation.reason }}</p>
            <p class="advisor-expected">预期：{{ topPick.recommendation.expected }}</p>
            <button class="btn advisor-apply" @click="applyRecommendation(topPick)">
              按推荐选用
            </button>
          </section>
          <section v-else-if="assessments.length > 0" class="advisor-banner calm">
            <div class="advisor-title">
              <Sparkles :size="15" aria-hidden="true" />
              <b>词条组状态良好</b>
            </div>
            <p class="advisor-reason">
              当前没有急需处理的装备。想追求完美品阶的话，仍可在下方任选一件继续打磨。
            </p>
          </section>

          <!-- 装备轨道 -->
          <section v-if="assessments.length > 0" class="gear-rail-wrap">
            <div class="rail-head">
              <span>选择装备</span>
              <small>按推荐优先级排序</small>
            </div>
            <div class="gear-rail" role="listbox" aria-label="可洗练装备">
              <button
                v-for="entry in assessments"
                :key="entry.uid"
                class="gear-card"
                :class="{ active: entry.uid === selectedUid, advised: Boolean(entry.recommendation) }"
                :style="{ '--gear-q': `var(--q-${requireEquipment(entry.defId).quality})` }"
                role="option"
                :aria-selected="entry.uid === selectedUid"
                @click="selectGear(entry.uid)"
              >
                <span class="gear-grade" :class="`grade-${gradeOf(entry.affixScore).grade}`">
                  {{ gradeOf(entry.affixScore).label }}
                </span>
                <img class="gear-icon" :src="`${BASE}${requireEquipment(entry.defId).icon}`" :alt="requireEquipment(entry.defId).name" />
                <span class="gear-name">{{ requireEquipment(entry.defId).name }}</span>
                <span class="gear-meta">
                  {{ QUALITY_LABELS[requireEquipment(entry.defId).quality] }} ·
                  {{ entry.source === 'equipped' ? '已穿戴' : '背包' }}
                </span>
                <span v-if="entry.recommendation" class="gear-advice">
                  建议{{ operationName(entry.recommendation.operation) }}
                </span>
              </button>
            </div>
          </section>

          <p v-if="assessments.length === 0" class="empty-banner">
            背包里还没有带随机词条的装备。去关卡里打几件带词条的装备再来吧。
          </p>

          <!-- 洗练台 -->
          <section
            v-if="selectedInstance && selectedDefinition && selectedAssessment"
            class="anvil"
            :style="{ '--gear-q': `var(--q-${selectedDefinition.quality})` }"
          >
            <div class="anvil-head">
              <img class="anvil-icon" :src="`${BASE}${selectedDefinition.icon}`" :alt="selectedDefinition.name" />
              <div class="anvil-title">
                <b>{{ selectedDefinition.name }}</b>
                <small>
                  {{ QUALITY_LABELS[selectedDefinition.quality] }} ·
                  {{ SLOT_LABELS[selectedDefinition.slot] }} · Lv{{ selectedDefinition.level }}
                  <template v-if="selectedInstance.enhance > 0">
                    · 强化 +{{ selectedInstance.enhance }}
                  </template>
                </small>
              </div>
              <span class="anvil-grade" :class="`grade-${gradeOf(selectedAssessment.affixScore).grade}`">
                词条 {{ gradeOf(selectedAssessment.affixScore).label }}
              </span>
            </div>

            <div class="resonance">
              <div class="resonance-row">
                <span>共鸣值</span>
                <b>{{ selectedInstance.reforgeResonance }} / {{ REFORGE_RESONANCE_MAX }}</b>
              </div>
              <div class="resonance-track">
                <i
                  :style="{
                    width: `${(selectedInstance.reforgeResonance / REFORGE_RESONANCE_MAX) * 100}%`,
                  }"
                />
              </div>
              <p>满 {{ REFORGE_RESONANCE_MAX }} 后，下一次随机洗练必出「卓越」或「极品」。</p>
            </div>

            <div v-if="pending && !rolling" class="result-card" aria-live="polite">
              <img
                v-if="pendingTierUp"
                class="tier-up-fx"
                :src="tierUpBurstUrl"
                alt=""
                aria-hidden="true"
              />
              <div class="result-title">
                <Sparkles :size="17" aria-hidden="true" />
                <b>洗练结果已保留在存档</b>
              </div>
              <div v-if="oldPendingAffix" class="compare-affix">
                <div>
                  <small>原词条</small>
                  <span :class="`tier-${oldPendingAffix.tier}`">
                    T{{ oldPendingAffix.tier }} {{ affixTierName(oldPendingAffix.tier) }}
                  </span>
                  <b>{{ affixDisplayName(oldPendingAffix) }} {{ formatAffixValue(oldPendingAffix) }}</b>
                  <em v-if="affixProfessionLabel(oldPendingAffix.key)">
                    {{ affixProfessionLabel(oldPendingAffix.key) }}
                  </em>
                  <em v-if="affixRuntimeNotice(oldPendingAffix.key)" class="runtime-notice">
                    {{ affixRuntimeNotice(oldPendingAffix.key) }}
                  </em>
                </div>
                <span class="arrow">→</span>
                <div class="candidate" :class="{ upgraded: pendingTierUp }">
                  <small>新候选</small>
                  <span :class="`tier-${pending.candidate.tier}`">
                    T{{ pending.candidate.tier }} {{ affixTierName(pending.candidate.tier) }}
                  </span>
                  <b>
                    {{ affixDisplayName(pending.candidate) }}
                    {{ formatAffixValue(pending.candidate) }}
                  </b>
                  <em v-if="affixProfessionLabel(pending.candidate.key)">
                    {{ affixProfessionLabel(pending.candidate.key) }}
                  </em>
                  <em v-if="affixRuntimeNotice(pending.candidate.key)" class="runtime-notice">
                    {{ affixRuntimeNotice(pending.candidate.key) }}
                  </em>
                </div>
              </div>
              <p>材料已经消耗；采用与否由你决定，保留原样不会把装备洗坏。</p>
              <div class="decision-row">
                <button class="btn btn-plain" @click="decide('keep')">保留原样</button>
                <button class="btn btn-pink" @click="decide('adopt')">采用新词条</button>
              </div>
            </div>

            <template v-else>
              <nav class="operation-tabs" aria-label="洗练方式">
                <button
                  v-for="option in operationOptions"
                  :key="option.id"
                  :class="{ active: operation === option.id }"
                  :disabled="Boolean(pending) || rolling"
                  @click="selectOperation(option.id)"
                >
                  <img class="op-emblem" :src="emblemUrls[option.id]" alt="" aria-hidden="true" />
                  <b>{{ option.name }}</b>
                  <small>{{ option.desc }}</small>
                </button>
              </nav>

              <div class="affix-picker">
                <button
                  v-for="(value, index) in selectedInstance.affixes"
                  :key="`${index}-${value.key}`"
                  class="affix-row"
                  :class="{
                    bound: lockedIndices.includes(index),
                    selected: operation === 'resonate' && resonateTarget === index,
                    maxed: operation === 'resonate' && value.tier === 5,
                    deferred:
                      (operation === 'temper' || operation === 'resonate') &&
                      !isAffixSettlementActive(value.key),
                  }"
                  :aria-pressed="
                    operation === 'resonate'
                      ? resonateTarget === index
                      : lockedIndices.includes(index)
                  "
                  :disabled="
                    rolling ||
                    (operation === 'resonate' && value.tier === 5) ||
                    ((operation === 'temper' || operation === 'resonate') &&
                      !isAffixSettlementActive(value.key))
                  "
                  @click="toggleAffix(index)"
                >
                  <span class="tier-badge" :class="`tier-${value.tier}`">
                    T{{ value.tier }} {{ affixTierName(value.tier) }}
                  </span>
                  <span class="affix-main">
                    <b>{{ affixDisplayName(value) }}</b>
                    <small>
                      {{ formatAffixValue(value) }}
                      <em v-if="affixProfessionLabel(value.key)">
                        · {{ affixProfessionLabel(value.key) }}
                      </em>
                      <em v-if="affixRuntimeNotice(value.key)" class="runtime-notice">
                        · {{ affixRuntimeNotice(value.key) }}
                      </em>
                    </small>
                  </span>
                  <span v-if="operation === 'resonate'" class="row-state">
                    {{
                      !isAffixSettlementActive(value.key)
                        ? '待开放'
                        : value.tier === 5
                          ? '已满阶'
                          : resonateTarget === index
                            ? '已选择'
                            : '选择'
                    }}
                  </span>
                  <span v-else class="row-state">
                    <template v-if="operation === 'temper' && !isAffixSettlementActive(value.key)">
                      待开放
                    </template>
                    <template v-else>
                      <Lock v-if="lockedIndices.includes(index)" :size="14" aria-hidden="true" />
                      {{ lockedIndices.includes(index) ? '已定契' : '参与随机' }}
                    </template>
                  </span>
                  <img
                    v-if="operation !== 'resonate' && lockedIndices.includes(index)"
                    class="lock-seal-fx"
                    :src="lockSealUrl"
                    alt=""
                    aria-hidden="true"
                  />
                </button>
              </div>

              <div class="operation-note">
                <p>{{ rollHint }}</p>
                <small v-if="hasDeferredAffix">
                  「待 M3-4 技能结算」词条仍可查看，并可通过重铸或铭刻换掉；淬炼、同调不会继续投入。
                </small>
                <small v-if="operation !== 'resonate'">
                  定契本次消耗 {{ bindCost }} 张；完成洗练后自动解除。
                </small>
                <small v-if="selectedAssessment.recommendation">
                  推荐思路：{{ selectedAssessment.recommendation.headline }}（{{
                    selectedAssessment.recommendation.expected
                  }}）
                </small>
              </div>

              <div v-if="costRange" class="costs">
                <div class="cost-gold">
                  <span>金币</span>
                  <b>{{ rangeText(costRange.gold.min, costRange.gold.max) }}</b>
                  <small>持有 {{ abbr(player.player?.gold ?? 0) }}</small>
                </div>
                <div
                  v-for="cost in costRange.items"
                  :key="cost.itemId"
                  class="cost-item"
                  :class="{ short: (itemCounts[cost.itemId] ?? 0) < cost.max }"
                >
                  <ItemIcon :item="requireItem(cost.itemId)" size="sm" />
                  <span>
                    <b>{{ requireItem(cost.itemId).name }} ×{{ rangeText(cost.min, cost.max) }}</b>
                    <small>持有 {{ itemCounts[cost.itemId] ?? 0 }}</small>
                  </span>
                </div>
              </div>

              <p v-if="feedback" class="feedback">{{ feedback }}</p>
              <p v-else-if="costRange && !canAffordPreview" class="feedback">
                材料不足，暂时无法操作。
              </p>

              <button class="start-button" :disabled="!canStart" @click="startChange">
                <img class="start-emblem" :src="emblemUrls[operation]" alt="" aria-hidden="true" />
                {{ activeOperationName }}一次
              </button>
            </template>
          </section>
        </template>
      </div>

      <div v-if="rolling" class="rolling-fx" aria-live="polite">
        <img :src="reforgeSwirlUrl" alt="" />
        <b>力量正在重新共鸣……</b>
      </div>
    </div>
  </div>
</template>

<style scoped>
.studio-overlay {
  position: fixed;
  z-index: 150;
  inset: 0;
  display: flex;
  justify-content: center;
  background: rgb(29 35 54 / 55%);
  backdrop-filter: blur(5px);
  animation: studio-fade 180ms ease-out;
}

.studio-shell {
  position: relative;
  width: min(100%, 430px);
  max-height: 100dvh;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  color: var(--text);
  background:
    radial-gradient(circle at 92% 0%, rgb(132 204 255 / 18%), transparent 36%),
    radial-gradient(circle at 4% 10%, rgb(255 154 210 / 20%), transparent 32%), var(--panel);
  box-shadow: 0 24px 70px rgb(28 37 62 / 38%);
  animation: studio-rise 260ms var(--ease-spring, ease-out);
}

@media (min-width: 520px) {
  .studio-overlay {
    align-items: center;
    padding: 22px;
  }

  .studio-shell {
    max-height: min(94dvh, 900px);
    border: 1px solid rgb(255 255 255 / 75%);
    border-radius: 24px;
  }
}

/* ── 头部横幅 ── */
.studio-head {
  position: relative;
  min-height: 128px;
  display: flex;
  align-items: flex-end;
  overflow: hidden;
  isolation: isolate;
}

.head-banner {
  position: absolute;
  z-index: 0;
  inset: 0;
  width: 100%;
  height: 100%;
  object-fit: cover;
  object-position: center 32%;
}

.head-veil {
  position: absolute;
  z-index: 1;
  inset: 0;
  background: linear-gradient(180deg, rgb(255 246 251 / 8%) 0%, rgb(255 244 250 / 55%) 58%, rgb(255 250 253 / 96%) 100%);
}

.head-sparkle {
  position: absolute;
  z-index: 2;
  width: 7px;
  height: 7px;
  background: radial-gradient(circle, #fff 12%, rgb(255 190 226 / 90%) 46%, transparent 72%);
  border-radius: 50%;
  filter: drop-shadow(0 0 5px rgb(255 178 220 / 85%));
  animation: sparkle-float 3.4s ease-in-out infinite;
  pointer-events: none;
}

.head-sparkle.sp-1 { top: 22%; left: 12%; animation-delay: 0ms; }
.head-sparkle.sp-2 { top: 30%; left: 34%; width: 5px; height: 5px; animation-delay: 700ms; }
.head-sparkle.sp-3 { top: 18%; right: 30%; animation-delay: 1300ms; }
.head-sparkle.sp-4 { top: 40%; right: 14%; width: 5px; height: 5px; animation-delay: 1900ms; }
.head-sparkle.sp-5 { top: 52%; left: 22%; width: 4px; height: 4px; animation-delay: 2500ms; }

.head-copy {
  position: relative;
  z-index: 3;
  display: flex;
  flex: 1;
  flex-direction: column;
  padding: 14px 15px 12px;
}

.head-copy small {
  color: var(--pink-deep);
  font-size: 10px;
  font-weight: 800;
  letter-spacing: 0.22em;
}

.head-copy h2 {
  margin: 3px 0 0;
  font-size: 17px;
  text-shadow: 0 1px 0 rgb(255 255 255 / 70%);
}

.head-copy p {
  margin: 3px 0 0;
  color: var(--text-mid);
  font-size: 10px;
}

.head-close {
  position: absolute;
  z-index: 4;
  top: 12px;
  right: 12px;
}

.icon-button {
  width: 44px;
  height: 44px;
  display: grid;
  color: var(--text-mid);
  background: rgb(255 255 255 / 72%);
  border: 1px solid var(--line);
  border-radius: 50%;
  place-items: center;
}

/* ── 主体滚动区 ── */
.studio-body {
  display: flex;
  flex: 1;
  flex-direction: column;
  gap: 10px;
  overflow-y: auto;
  /* 滚到底时不要把身后的页面一起拖走 */
  overscroll-behavior: contain;
  -webkit-overflow-scrolling: touch;
  /* 手机上工坊是满屏浮层，末行操作按钮必须避开 Home 指示条 */
  padding: 4px 13px calc(16px + env(safe-area-inset-bottom));
}

@media (min-width: 520px) {
  /* 居中弹窗形态下四周已有 padding，不需要再补安全区 */
  .studio-body {
    padding-bottom: 16px;
  }
}

.locked-banner,
.empty-banner {
  margin: 8px 2px;
  padding: 12px;
  color: var(--text-mid);
  font-size: 11px;
  line-height: 1.55;
  text-align: center;
  background: rgb(255 255 255 / 70%);
  border: 1px dashed var(--line);
  border-radius: 13px;
}

/* ── 推荐横幅 ── */
.advisor-banner {
  position: relative;
  isolation: isolate;
  overflow: hidden;
  padding: 11px 12px;
  background: linear-gradient(120deg, #fff3f9 0%, #f3f2ff 52%, #eef8ff 100%);
  border: 1px solid #ecc4da;
  border-radius: 15px;
  box-shadow: 0 8px 22px rgb(190 120 170 / 14%);
}

.advisor-banner.calm {
  background: rgb(255 255 255 / 76%);
  border-color: var(--line);
  box-shadow: none;
}

.advisor-glow {
  position: absolute;
  z-index: 0;
  top: -46px;
  right: -38px;
  width: 150px;
  height: 150px;
  background: radial-gradient(circle, rgb(255 183 224 / 55%), rgb(149 205 255 / 32%) 55%, transparent 72%);
  animation: advisor-breathe 2.6s ease-in-out infinite;
  pointer-events: none;
}

.advisor-title,
.advisor-headline,
.advisor-reason,
.advisor-expected,
.advisor-apply {
  position: relative;
  z-index: 1;
}

.advisor-title {
  display: flex;
  align-items: center;
  gap: 5px;
  color: #96516f;
  font-size: 12px;
}

.advisor-op {
  margin-left: auto;
  padding: 2px 8px;
  color: #fff;
  font-size: 9px;
  font-weight: 800;
  background: linear-gradient(100deg, #79bde8, #ee88bd);
  border-radius: 999px;
}

.advisor-headline {
  margin: 7px 0 0;
  font-size: 11px;
  line-height: 1.5;
}

.advisor-reason {
  margin: 4px 0 0;
  color: var(--text-mid);
  font-size: 10px;
  line-height: 1.5;
}

.advisor-expected {
  margin: 4px 0 0;
  color: #3a6e91;
  font-size: 10px;
  font-weight: 700;
}

.advisor-apply {
  min-height: 40px;
  width: 100%;
  margin-top: 9px;
  color: #fff;
  font-size: 12px;
  font-weight: 800;
  background: linear-gradient(100deg, #79bde8, #ee88bd 60%, #f0b66f);
  border-radius: 11px;
  box-shadow: 0 6px 15px rgb(211 110 163 / 22%);
}

/* ── 装备轨道 ── */
.rail-head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  padding: 0 2px 6px;
  font-size: 11px;
  color: var(--text-dim);
}

.rail-head small {
  font-size: 9px;
}

.gear-rail {
  display: flex;
  gap: 8px;
  overflow-x: auto;
  padding: 2px 2px 6px;
  scrollbar-width: thin;
}

.gear-card {
  position: relative;
  width: 96px;
  flex: 0 0 96px;
  display: flex;
  align-items: center;
  flex-direction: column;
  gap: 3px;
  padding: 9px 6px 8px;
  background: rgb(255 255 255 / 82%);
  border: 1px solid var(--line);
  border-radius: 13px;
  transition:
    transform 160ms var(--ease-soft, ease-out),
    border-color 160ms ease,
    box-shadow 160ms ease;
}

.gear-card.active {
  background: linear-gradient(150deg, #fff5fa, #eef7ff);
  border-color: var(--gear-q, #edb8d3);
  box-shadow:
    0 0 0 2px color-mix(in srgb, var(--gear-q, #ee88bd) 24%, transparent),
    0 7px 16px rgb(80 66 107 / 12%);
  transform: translateY(-2px);
}

.gear-grade {
  position: absolute;
  top: 5px;
  right: 5px;
  width: 17px;
  height: 17px;
  display: grid;
  font-size: 9px;
  font-weight: 900;
  border-radius: 6px;
  place-items: center;
}

.grade-s { color: #8a5b00; background: linear-gradient(135deg, #ffe9ae, #ffd35e); }
.grade-a { color: #8d3a63; background: linear-gradient(135deg, #ffd9ec, #ffb3d6); }
.grade-b { color: #275d85; background: linear-gradient(135deg, #d2ecff, #aad9ff); }
.grade-c { color: #5c6672; background: #e8ebef; }

.gear-icon {
  width: 44px;
  height: 44px;
  object-fit: contain;
  filter: drop-shadow(0 3px 5px rgb(50 60 90 / 16%));
}

.gear-name {
  max-width: 100%;
  overflow: hidden;
  font-size: 10px;
  font-weight: 700;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.gear-meta {
  color: var(--gear-q, var(--text-dim));
  font-size: 8px;
  font-weight: 700;
}

.gear-advice {
  padding: 1px 7px;
  color: #96516f;
  font-size: 8px;
  font-weight: 800;
  background: #ffeaf4;
  border: 1px solid #f3c9dd;
  border-radius: 999px;
}

/* ── 洗练台 ── */
.anvil {
  padding: 11px;
  background: rgb(255 255 255 / 66%);
  border: 1px solid color-mix(in srgb, var(--gear-q, var(--line)) 38%, var(--line));
  border-radius: 16px;
  box-shadow: 0 10px 26px rgb(80 66 107 / 10%);
}

.anvil-head {
  display: flex;
  align-items: center;
  gap: 9px;
}

.anvil-icon {
  width: 46px;
  height: 46px;
  object-fit: contain;
  padding: 4px;
  background: #fff;
  border: 1px solid color-mix(in srgb, var(--gear-q, var(--line)) 42%, var(--line));
  border-radius: 12px;
  filter: drop-shadow(0 3px 5px rgb(50 60 90 / 12%));
}

.anvil-title {
  min-width: 0;
  display: flex;
  flex: 1;
  flex-direction: column;
}

.anvil-title b {
  overflow: hidden;
  font-size: 13px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.anvil-title small {
  color: var(--text-mid);
  font-size: 9px;
}

.anvil-grade {
  padding: 3px 9px;
  font-size: 10px;
  font-weight: 900;
  border-radius: 999px;
}

.resonance {
  margin-top: 9px;
  padding: 9px 11px;
  background: rgb(238 247 255 / 86%);
  border: 1px solid #cbe3f4;
  border-radius: 13px;
}

.resonance-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  color: #3a6e91;
  font-size: 11px;
}

.resonance-track {
  height: 7px;
  margin-top: 6px;
  overflow: hidden;
  background: #dbeaf3;
  border-radius: 999px;
}

.resonance-track i {
  display: block;
  height: 100%;
  background: linear-gradient(90deg, var(--blue), var(--pink), var(--gold));
  border-radius: inherit;
  transition: width 260ms ease;
}

.resonance p,
.result-card > p,
.operation-note p,
.operation-note small,
.feedback {
  margin: 5px 0 0;
  color: var(--text-dim);
  font-size: 9px;
  line-height: 1.45;
}

/* ── 四操作 ── */
.operation-tabs {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 6px;
  margin-top: 10px;
}

.operation-tabs button {
  position: relative;
  min-height: 84px;
  display: flex;
  align-items: center;
  flex-direction: column;
  justify-content: flex-start;
  gap: 2px;
  padding: 7px 4px 6px;
  color: var(--text-mid);
  text-align: center;
  background: rgb(255 255 255 / 70%);
  border: 1px solid var(--line);
  border-radius: 12px;
  transition:
    border-color 160ms ease,
    box-shadow 160ms ease,
    transform 160ms var(--ease-soft, ease-out);
}

.operation-tabs button.active {
  color: #8d4770;
  background: linear-gradient(160deg, #fff0f7, #f2f8ff);
  border-color: #edb8d3;
  box-shadow:
    inset 0 0 0 1px rgb(255 255 255 / 78%),
    0 6px 14px rgb(211 110 163 / 16%);
  transform: translateY(-2px);
}

.operation-tabs button.active .op-emblem {
  filter: drop-shadow(0 0 7px rgb(238 136 189 / 60%));
  transform: scale(1.1);
}

.op-emblem {
  width: 34px;
  height: 34px;
  object-fit: contain;
  transition:
    transform 220ms var(--ease-spring, ease-out),
    filter 220ms ease;
}

.operation-tabs b {
  font-size: 11px;
}

.operation-tabs small {
  color: var(--text-dim);
  font-size: 7px;
  line-height: 1.3;
}

/* ── 词条行 ── */
.affix-picker {
  display: flex;
  flex-direction: column;
  gap: 5px;
  margin-top: 10px;
}

.affix-row {
  position: relative;
  isolation: isolate;
  min-height: 48px;
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  overflow: hidden;
  padding: 7px 9px;
  text-align: left;
  background: rgb(255 255 255 / 80%);
  border: 1px solid #e3e8ef;
  border-radius: 10px;
}

.affix-row > :not(.lock-seal-fx) {
  position: relative;
  z-index: 1;
}

.lock-seal-fx {
  position: absolute;
  z-index: 0;
  top: 50%;
  right: 28px;
  width: 64px;
  height: 64px;
  opacity: 0.18;
  pointer-events: none;
  transform: translateY(-50%);
}

.affix-row.bound {
  background: radial-gradient(circle at 90% 50%, rgb(255 189 220 / 20%), transparent 34%), #fff8fb;
  border-color: #e9b4cf;
}

.affix-row.selected {
  background: #eef8ff;
  border-color: #91c7ea;
  box-shadow: 0 0 0 2px rgb(126 202 241 / 14%);
}

.affix-row.maxed { opacity: 0.58; }
.affix-row.deferred { opacity: 0.66; }

.tier-badge {
  width: 68px;
  flex: 0 0 68px;
  padding: 4px 5px;
  font-size: 9px;
  font-weight: 800;
  text-align: center;
  background: #f3f4f6;
  border-radius: 7px;
}

.affix-main {
  min-width: 0;
  display: flex;
  flex: 1;
  flex-direction: column;
}

.affix-main b {
  overflow: hidden;
  font-size: 11px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.affix-main small {
  color: var(--text-mid);
  font-size: 10px;
}

.affix-main em,
.compare-affix em {
  color: #8a62aa;
  font-size: 8px;
  font-style: normal;
  font-weight: 700;
}

.affix-main em.runtime-notice,
.compare-affix em.runtime-notice {
  color: #b16a43;
}

.row-state {
  display: flex;
  align-items: center;
  gap: 3px;
  color: var(--text-dim);
  font-size: 9px;
  white-space: nowrap;
}

.operation-note {
  min-height: 44px;
  margin-top: 7px;
  padding: 7px 10px;
  background: #faf7ff;
  border-radius: 9px;
}

.operation-note p {
  margin: 0;
  color: #66537f;
}

.operation-note small {
  display: block;
}

.costs {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 5px;
  margin-top: 8px;
}

.cost-gold,
.cost-item {
  min-height: 43px;
  display: flex;
  align-items: center;
  gap: 7px;
  padding: 6px 8px;
  background: rgb(255 255 255 / 78%);
  border: 1px solid var(--line);
  border-radius: 9px;
}

.cost-gold {
  align-items: flex-start;
  flex-direction: column;
  gap: 0;
}

.cost-gold span,
.cost-item b { font-size: 9px; }

.cost-gold b {
  color: #ae7134;
  font-size: 12px;
}

.cost-gold small,
.cost-item small {
  color: var(--text-dim);
  font-size: 8px;
}

.cost-item > span {
  min-width: 0;
  display: flex;
  flex-direction: column;
}

.cost-item.short {
  color: #b34d59;
  background: #fff2f3;
  border-color: #efc1c6;
}

.start-button {
  width: 100%;
  min-height: 48px;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  margin-top: 9px;
  color: #fff;
  font-size: 13px;
  font-weight: 800;
  background: linear-gradient(100deg, #79bde8, #ee88bd 55%, #f0b66f);
  border-radius: 12px;
  box-shadow: 0 7px 18px rgb(211 110 163 / 24%);
}

.start-button:disabled {
  filter: grayscale(0.35);
  box-shadow: none;
  opacity: 0.45;
}

.start-emblem {
  width: 26px;
  height: 26px;
  object-fit: contain;
  filter: drop-shadow(0 0 4px rgb(255 255 255 / 55%));
}

.feedback {
  color: #b04f60;
  text-align: center;
}

/* ── 结果卡 ── */
.result-card {
  position: relative;
  z-index: 2;
  margin-top: 10px;
  overflow: hidden;
  padding: 12px;
  background: rgb(255 255 255 / 90%);
  border: 1px solid #e8c6d9;
  border-radius: 14px;
  box-shadow: 0 8px 24px rgb(80 66 107 / 10%);
}

.tier-up-fx {
  position: absolute;
  z-index: 0;
  top: -30px;
  left: 50%;
  width: min(88vw, 340px);
  opacity: 0.3;
  pointer-events: none;
  transform: translateX(-50%);
  animation: tier-burst 700ms ease-out both;
}

.result-card > :not(.tier-up-fx) {
  position: relative;
  z-index: 1;
}

.result-title {
  display: flex;
  align-items: center;
  gap: 6px;
  color: #96516f;
  font-size: 12px;
}

.compare-affix {
  display: grid;
  grid-template-columns: 1fr 22px 1fr;
  gap: 5px;
  align-items: stretch;
  margin-top: 10px;
}

.compare-affix > div {
  display: flex;
  min-width: 0;
  flex-direction: column;
  gap: 4px;
  padding: 8px;
  background: #f5f6f8;
  border-radius: 9px;
}

.compare-affix > div.candidate {
  background: linear-gradient(135deg, #fff3f8, #eef8ff);
}

.compare-affix > div.upgraded {
  box-shadow: inset 0 0 0 1px #f0c36b;
}

.compare-affix small {
  color: var(--text-dim);
  font-size: 8px;
}

.compare-affix span:not(.arrow) {
  font-size: 9px;
  font-weight: 800;
}

.compare-affix b {
  overflow-wrap: anywhere;
  font-size: 10px;
}

.arrow {
  align-self: center;
  color: var(--pink-deep);
  font-weight: 800;
  text-align: center;
}

.decision-row {
  display: flex;
  align-items: center;
  gap: 7px;
  margin-top: 10px;
}

.decision-row button {
  min-height: 44px;
  flex: 1;
}

/* ── 洗练特效 ── */
.rolling-fx {
  position: absolute;
  z-index: 8;
  inset: 0;
  display: flex;
  align-items: center;
  flex-direction: column;
  justify-content: center;
  color: #80517c;
  background: rgb(250 249 255 / 90%);
  backdrop-filter: blur(3px);
}

.rolling-fx img {
  width: min(68vw, 270px);
  animation: reforge-spin 520ms ease-out both;
}

.rolling-fx b {
  margin-top: -18px;
  font-size: 12px;
}

/* ── 品阶色 ── */
.tier-1 { color: #7c828b; }
.tier-2 { color: #526276; }
.tier-3 { color: #3b9967; }
.tier-4 { color: #397db5; }
.tier-5 { color: #b37722; }

/* ── 动画 ── */
@keyframes studio-fade {
  from { opacity: 0; }
}

@keyframes studio-rise {
  from {
    opacity: 0;
    transform: translateY(26px) scale(0.985);
  }
}

@keyframes sparkle-float {
  0%, 100% {
    opacity: 0.35;
    transform: translateY(0) scale(0.85);
  }
  50% {
    opacity: 1;
    transform: translateY(-7px) scale(1.12);
  }
}

@keyframes advisor-breathe {
  0%, 100% {
    opacity: 0.6;
    transform: scale(0.94);
  }
  50% {
    opacity: 1;
    transform: scale(1.06);
  }
}

@keyframes reforge-spin {
  0% {
    opacity: 0;
    transform: rotate(-140deg) scale(0.62);
  }
  55% {
    opacity: 1;
  }
  100% {
    opacity: 1;
    transform: rotate(0deg) scale(1);
  }
}

@keyframes tier-burst {
  0% {
    opacity: 0;
    transform: translateX(-50%) scale(0.7);
  }
  35% {
    opacity: 0.34;
  }
  100% {
    opacity: 0.28;
    transform: translateX(-50%) scale(1.05);
  }
}

@media (prefers-reduced-motion: reduce) {
  .studio-overlay,
  .studio-shell,
  .gear-card,
  .operation-tabs button,
  .op-emblem {
    animation: none;
    transition: none;
  }

  .head-sparkle,
  .advisor-glow {
    animation: none;
  }

  .rolling-fx img,
  .tier-up-fx {
    animation: none;
  }
}
</style>
