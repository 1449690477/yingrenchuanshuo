<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref } from 'vue';
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
import { isAffixSettlementActive } from '@/data/constants';
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
import ItemIcon from '@/components/ItemIcon.vue';

const props = defineProps<{ inst: EquipmentInstance }>();
const emit = defineEmits<{ close: []; resolved: [adopted: boolean] }>();

const inventory = useInventoryStore();
const player = usePlayerStore();
const game = useGameStore();
const operation = ref<AffixChangeOperation>('reforge');
const lockedIndices = ref<number[]>([]);
const resonateTarget = ref<number | null>(null);
const rolling = ref(false);
const feedback = ref('');
const sheetRef = ref<HTMLElement | null>(null);
const closeButtonRef = ref<HTMLButtonElement | null>(null);
let dialogFocusTrap: FocusTrap | null = null;
let revealTimer = 0;

const definition = computed(() => requireEquipment(props.inst.defId));
const pending = computed(() => props.inst.pendingAffixChange ?? null);
const oldPendingAffix = computed<Affix | null>(() => {
  const value = pending.value;
  if (!value) return null;
  const previous = props.inst.affixes[value.affixIndex];
  if (!previous) {
    throw new Error(`[存档错误] 洗练候选下标越界：${value.affixIndex}`);
  }
  return previous;
});
const regionMaterials = computed(() =>
  requireRegionReforgeMaterials(requireRegionOfChapter(game.currentStage.chapterId).id),
);
const itemCounts = computed(() => inventory.bag?.items ?? {});
const levelUnlocked = computed(() => (player.player?.level ?? 0) >= REFORGE_UNLOCK_LEVEL);
const unlockedIndices = computed(() =>
  props.inst.affixes
    .map((_, index) => index)
    .filter((index) => !lockedIndices.value.includes(index)),
);
const hasDeferredAffix = computed(() =>
  props.inst.affixes.some((affix) => !isAffixSettlementActive(affix.key)),
);
const operationTargets = computed(() => {
  if (operation.value === 'resonate') {
    return resonateTarget.value === null ? [] : [resonateTarget.value];
  }
  if (operation.value === 'temper') {
    return unlockedIndices.value.filter((index) =>
      isAffixSettlementActive(props.inst.affixes[index]!.key),
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
const reforgeSwirlUrl = `${import.meta.env.BASE_URL}assets/effects/reforge/reforge-swirl.png`;
const tierUpBurstUrl = `${import.meta.env.BASE_URL}assets/effects/reforge/tier-up-burst.png`;
const lockSealUrl = `${import.meta.env.BASE_URL}assets/effects/reforge/lock-seal.png`;

const pendingTierUp = computed(
  () =>
    oldPendingAffix.value !== null &&
    pending.value !== null &&
    pending.value.candidate.tier > oldPendingAffix.value.tier,
);

interface CostRange {
  gold: { min: number; max: number };
  items: { itemId: string; min: number; max: number }[];
}

const costRange = computed<CostRange | null>(() => {
  const currentPlayer = player.player;
  if (!currentPlayer || pending.value || operationTargets.value.length === 0) return null;
  const costs = operationTargets.value.map((index) =>
    affixChangeCost(
      operation.value,
      definition.value.level,
      props.inst.affixes[index]!.tier,
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

const canStart = computed(
  () =>
    levelUnlocked.value &&
    !pending.value &&
    !rolling.value &&
    operationTargets.value.length > 0 &&
    canAffordPreview.value &&
    !(
      operation.value === 'resonate' &&
      resonateTarget.value !== null &&
      props.inst.affixes[resonateTarget.value]?.tier === 5
    ),
);

const bindCost = computed(() =>
  operation.value === 'resonate' ? 0 : bindMaterialCost(lockedIndices.value.length),
);
const rollHint = computed(() => {
  if (operation.value === 'resonate') return '点选一条未满阶词条作为同调目标。';
  if (operation.value === 'temper') {
    return `本次会从 ${operationTargets.value.length} 条已结算词条中随机选 1 条；延后词条不会参与。`;
  }
  if (lockedIndices.value.length === 0) {
    return `本次会从全部 ${props.inst.affixes.length} 条中随机选 1 条。`;
  }
  return `已定契 ${lockedIndices.value.length} 条，本次从其余 ${unlockedIndices.value.length} 条中随机选 1 条。`;
});

function selectOperation(next: AffixChangeOperation) {
  if (pending.value || rolling.value) return;
  operation.value = next;
  feedback.value = '';
  lockedIndices.value = [];
  resonateTarget.value = null;
}

function toggleAffix(index: number) {
  if (pending.value || rolling.value) return;
  feedback.value = '';
  if (operation.value === 'resonate') {
    const selected = props.inst.affixes[index];
    if (selected && isAffixSettlementActive(selected.key) && selected.tier < 5) {
      resonateTarget.value = index;
    }
    return;
  }
  if (
    operation.value === 'temper' &&
    !isAffixSettlementActive(props.inst.affixes[index]!.key)
  ) {
    return;
  }
  lockedIndices.value = lockedIndices.value.includes(index)
    ? lockedIndices.value.filter((candidate) => candidate !== index)
    : [...lockedIndices.value, index].sort((a, b) => a - b);
}

function startChange() {
  if (!canStart.value) return;
  feedback.value = '';
  const result = inventory.startAffixChange(
    props.inst.uid,
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

function decide(decision: 'adopt' | 'keep') {
  const result = inventory.resolveAffixChange(props.inst.uid, decision);
  if (!result.ok) {
    feedback.value = blockMessage(result.reason);
    return;
  }
  feedback.value = result.adopted ? '新词条已采用。' : '已保留原词条，材料与共鸣结算不回退。';
  lockedIndices.value = [];
  resonateTarget.value = null;
  emit('resolved', result.adopted);
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
  <div class="reforge-overlay" role="dialog" aria-modal="true" aria-label="词条洗练">
    <section ref="sheetRef" class="reforge-sheet" tabindex="-1">
      <header class="reforge-head">
        <div>
          <small>词条养成</small>
          <h2>{{ definition.name }}</h2>
        </div>
        <button
          ref="closeButtonRef"
          class="icon-button"
          aria-label="关闭洗练"
          @click="requestClose"
        >
          <X :size="19" aria-hidden="true" />
        </button>
      </header>

      <div class="resonance">
        <div>
          <span>共鸣值</span>
          <b>{{ inst.reforgeResonance }} / {{ REFORGE_RESONANCE_MAX }}</b>
        </div>
        <div class="resonance-track">
          <i :style="{ width: `${(inst.reforgeResonance / REFORGE_RESONANCE_MAX) * 100}%` }" />
        </div>
        <p>满 20 后，下一次随机洗练必出「卓越」或「极品」。</p>
      </div>

      <div v-if="pending && !rolling" class="result-card" aria-live="polite">
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
            <b>{{ option.name }}</b>
            <small>{{ option.desc }}</small>
          </button>
        </nav>

        <div class="affix-picker">
          <button
            v-for="(value, index) in inst.affixes"
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
              operation === 'resonate' ? resonateTarget === index : lockedIndices.includes(index)
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

        <p v-if="!levelUnlocked" class="feedback">
          角色达到 Lv{{ REFORGE_UNLOCK_LEVEL }} 后开放洗练。
        </p>
        <p v-else-if="feedback" class="feedback">{{ feedback }}</p>
        <p v-else-if="costRange && !canAffordPreview" class="feedback">材料不足，暂时无法操作。</p>

        <button class="start-button" :disabled="!canStart" @click="startChange">
          {{ activeOperationName }}一次
        </button>
      </template>

      <div v-if="rolling" class="rolling-fx" aria-live="polite">
        <img :src="reforgeSwirlUrl" alt="" />
        <b>力量正在重新共鸣……</b>
      </div>
      <img
        v-if="pending && !rolling && pendingTierUp"
        class="tier-up-fx"
        :src="tierUpBurstUrl"
        alt=""
      />
    </section>
  </div>
</template>

<style scoped>
.reforge-overlay {
  position: fixed;
  z-index: 140;
  inset: 0;
  display: flex;
  align-items: flex-end;
  justify-content: center;
  padding: 18px max(10px, env(safe-area-inset-right)) max(10px, env(safe-area-inset-bottom))
    max(10px, env(safe-area-inset-left));
  background: rgb(29 35 54 / 55%);
  backdrop-filter: blur(4px);
}

.reforge-sheet {
  position: relative;
  width: min(100%, 390px);
  max-height: min(92dvh, 820px);
  overflow: auto;
  padding: 15px;
  color: var(--text);
  background:
    radial-gradient(circle at 90% 0%, rgb(132 204 255 / 20%), transparent 34%),
    radial-gradient(circle at 5% 12%, rgb(255 154 210 / 22%), transparent 30%), var(--panel);
  border: 1px solid rgb(255 255 255 / 75%);
  border-radius: 22px;
  box-shadow: 0 18px 54px rgb(28 37 62 / 30%);
}

.reforge-head,
.reforge-head > div,
.resonance > div:first-child,
.result-title,
.decision-row,
.affix-row,
.cost-item,
.cost-gold {
  display: flex;
  align-items: center;
}

.reforge-head {
  justify-content: space-between;
  margin-bottom: 10px;
}

.reforge-head > div {
  align-items: flex-start;
  flex-direction: column;
}

.reforge-head small {
  color: var(--pink-deep);
  font-size: 10px;
  font-weight: 800;
  letter-spacing: 0.12em;
}

.reforge-head h2 {
  margin: 2px 0 0;
  font-size: 17px;
}

.icon-button {
  width: 44px;
  height: 44px;
  display: grid;
  color: var(--text-mid);
  background: rgb(255 255 255 / 70%);
  border: 1px solid var(--line);
  border-radius: 50%;
  place-items: center;
}

.resonance {
  padding: 10px 12px;
  background: rgb(238 247 255 / 86%);
  border: 1px solid #cbe3f4;
  border-radius: 13px;
}

.resonance > div:first-child {
  justify-content: space-between;
  color: #3a6e91;
  font-size: 11px;
}

.resonance-track {
  height: 7px;
  margin-top: 7px;
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
  margin: 6px 0 0;
  color: var(--text-dim);
  font-size: 9px;
  line-height: 1.45;
}

.operation-tabs {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 6px;
  margin-top: 10px;
}

.operation-tabs button {
  min-height: 54px;
  display: flex;
  align-items: flex-start;
  flex-direction: column;
  justify-content: center;
  padding: 7px 10px;
  color: var(--text-mid);
  text-align: left;
  background: rgb(255 255 255 / 68%);
  border: 1px solid var(--line);
  border-radius: 11px;
}

.operation-tabs button.active {
  color: #8d4770;
  background: linear-gradient(135deg, #fff0f7, #f2f8ff);
  border-color: #edb8d3;
  box-shadow: inset 0 0 0 1px rgb(255 255 255 / 75%);
}

.operation-tabs b {
  font-size: 12px;
}

.operation-tabs small {
  margin-top: 2px;
  font-size: 8px;
  line-height: 1.3;
}

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
  gap: 8px;
  width: 100%;
  overflow: hidden;
  padding: 7px 9px;
  text-align: left;
  background: rgb(255 255 255 / 78%);
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

.affix-row.maxed {
  opacity: 0.58;
}

.affix-row.deferred {
  opacity: 0.66;
}

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

.costs {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 5px;
  margin-top: 8px;
}

.cost-gold,
.cost-item {
  min-height: 43px;
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
.cost-item b {
  font-size: 9px;
}

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
  min-height: 46px;
  margin-top: 9px;
  color: #fff;
  font-size: 13px;
  font-weight: 800;
  background: linear-gradient(100deg, #79bde8, #ee88bd 55%, #f0b66f);
  border-radius: 12px;
  box-shadow: 0 7px 18px rgb(211 110 163 / 20%);
}

.start-button:disabled {
  filter: grayscale(0.35);
  box-shadow: none;
  opacity: 0.45;
}

.feedback {
  color: #b04f60;
  text-align: center;
}

.result-card {
  position: relative;
  z-index: 2;
  margin-top: 10px;
  padding: 12px;
  background: rgb(255 255 255 / 88%);
  border: 1px solid #e8c6d9;
  border-radius: 14px;
  box-shadow: 0 8px 24px rgb(80 66 107 / 10%);
}

.result-title {
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
  gap: 7px;
  margin-top: 10px;
}

.decision-row button {
  min-height: 44px;
  flex: 1;
}

.rolling-fx {
  position: absolute;
  z-index: 6;
  inset: 0;
  display: flex;
  align-items: center;
  flex-direction: column;
  justify-content: center;
  color: #80517c;
  background: rgb(250 249 255 / 89%);
  border-radius: inherit;
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

.tier-up-fx {
  position: absolute;
  z-index: 1;
  top: 78px;
  left: 50%;
  width: min(88vw, 350px);
  opacity: 0.28;
  pointer-events: none;
  transform: translateX(-50%);
  animation: tier-burst 700ms ease-out both;
}

.tier-1 {
  color: #7c828b;
}

.tier-2 {
  color: #526276;
}

.tier-3 {
  color: #3b9967;
}

.tier-4 {
  color: #397db5;
}

.tier-5 {
  color: #b37722;
  text-shadow: 0 0 8px rgb(244 185 66 / 35%);
}

@keyframes reforge-spin {
  from {
    opacity: 0;
    transform: rotate(-34deg) scale(0.65);
  }
  55% {
    opacity: 1;
  }
  to {
    opacity: 0.88;
    transform: rotate(180deg) scale(1);
  }
}

@keyframes tier-burst {
  from {
    opacity: 0;
    transform: translateX(-50%) scale(0.55);
  }
  35% {
    opacity: 0.42;
  }
  to {
    opacity: 0.1;
    transform: translateX(-50%) scale(1.12);
  }
}

@media (width <= 350px) {
  .reforge-sheet {
    padding: 12px;
    border-radius: 18px;
  }

  .operation-tabs button {
    min-height: 50px;
    padding-inline: 8px;
  }

  .tier-badge {
    width: 62px;
    flex-basis: 62px;
  }

  .costs {
    grid-template-columns: 1fr;
  }
}

@media (prefers-reduced-motion: reduce) {
  .rolling-fx img,
  .tier-up-fx,
  .resonance-track i {
    animation: none;
    transition: none;
  }
}
</style>
