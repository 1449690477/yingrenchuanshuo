<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref } from 'vue';
import { ArrowRight, Check, Coins, LockKeyhole, ShieldCheck, Sparkles, X } from '@lucide/vue';
import { createFocusTrap, type FocusTrap } from 'focus-trap';
import { equipmentAdvancementCost } from '@/core/equipmentAdvancement';
import { abbr } from '@/core/format';
import type { EquipmentInstance } from '@/core/types';
import { QUALITY_LABELS, SLOT_LABELS } from '@/data/constants';
import { requireEquipment } from '@/data/equipment';
import { equipmentDisplayPresentation } from '@/data/equipmentPresentation';
import { requireItem, type ItemDef } from '@/data/items';
import { WEAPON_ELEMENT_LABELS } from '@/data/weaponElements';
import { useInventoryStore } from '@/stores/inventory';
import { usePlayerStore } from '@/stores/player';
import type { EquipmentAdvancementActionResult } from '@/stores/game';
import EquipmentIcon from '@/components/EquipmentIcon.vue';
import ItemIcon from '@/components/ItemIcon.vue';

const props = defineProps<{
  inst: EquipmentInstance;
}>();

const emit = defineEmits<{
  close: [];
  upgraded: [result: { targetName: string; cpDelta: number }];
}>();

const inventory = useInventoryStore();
const player = usePlayerStore();
const activeClassId = computed(() => {
  const classId = player.player?.classId;
  if (!classId) throw new Error('[装备升阶错误] 存档未载入，无法解析装备职业外观');
  return classId;
});
const sheetRef = ref<HTMLElement | null>(null);
const closeButtonRef = ref<HTMLButtonElement | null>(null);
const submitting = ref(false);
const succeeded = ref(false);
const feedback = ref('');
const successCpDelta = ref(0);
let dialogFocusTrap: FocusTrap | null = null;

/**
 * 弹层打开时固定来源与路线快照。
 *
 * 第一次升阶会原地改变 inst.defId；如果这里跟着实时 defId 再查路线，快速双击
 * 就可能把同一件装备连续跨两个区域。提交时继续传这份来源 ID，让 store 的
 * source-changed 门禁成为第二道原子保护。
 */
const expectedSourceDefId = props.inst.defId;
const openingOption = inventory.equipmentAdvancementOption(props.inst.uid);
const sourceDefinition = openingOption?.source ?? requireEquipment(expectedSourceDefId);
const targetDefinition = openingOption?.target ?? null;
const sourcePresentation = computed(() =>
  equipmentDisplayPresentation(sourceDefinition, activeClassId.value),
);
const targetPresentation = computed(() =>
  targetDefinition ? equipmentDisplayPresentation(targetDefinition, activeClassId.value) : null,
);
const cost = openingOption
  ? equipmentAdvancementCost(openingOption.target, openingOption.requirement)
  : null;
const teleportDisabled = typeof document === 'undefined';

/**
 * 元素权威数据合入后才展示；旧配置没有显式 element 时保持空白，
 * 不能用地区名或词条反推基础攻击属性。
 */
const baseElementChange = (() => {
  if (sourceDefinition.slot !== 'weapon' || targetDefinition?.slot !== 'weapon') {
    return null;
  }
  const sourceElement = sourceDefinition.element;
  const targetElement = targetDefinition.element;
  if (
    sourceElement === undefined ||
    targetElement === undefined ||
    sourceElement === targetElement
  ) {
    return null;
  }
  return {
    sourceLabel: WEAPON_ELEMENT_LABELS[sourceElement],
    targetLabel: WEAPON_ELEMENT_LABELS[targetElement],
  };
})();

interface MaterialCostPreview {
  item: ItemDef;
  required: number;
  owned: number;
  enough: boolean;
}

const ownedItems = computed(() => inventory.bag?.items ?? {});
const ownedGold = computed(() => player.player?.gold ?? 0);
const playerLevel = computed(() => player.player?.level ?? 0);
const materialCosts = computed<MaterialCostPreview[]>(() => {
  if (!cost) return [];
  return Object.entries(cost.items).map(([itemId, required]) => {
    const owned = ownedItems.value[itemId] ?? 0;
    return {
      item: requireItem(itemId),
      required,
      owned,
      enough: owned >= required,
    };
  });
});

const preservedFacts = computed(() => {
  const facts = [
    props.inst.enhance > 0 ? `强化 +${props.inst.enhance}` : '强化等级 0',
    `${props.inst.affixes.length} 条现有词条`,
    `洗练共鸣 ${props.inst.reforgeResonance}`,
  ];
  if (props.inst.locked) facts.push('分解保护已锁定');
  return facts;
});

type PreviewState = 'ready' | 'blocked' | 'success';

const preview = computed<{ state: PreviewState; message: string }>(() => {
  if (succeeded.value) {
    return {
      state: 'success',
      message:
        successCpDelta.value === 0
          ? '升阶完成，原有投入已完整保留。'
          : `升阶完成，战力 ${successCpDelta.value > 0 ? '+' : ''}${abbr(successCpDelta.value)}。`,
    };
  }
  if (props.inst.pendingAffixChange) {
    return {
      state: 'blocked',
      message: '这件装备有待确认的洗练候选，请先采用或保留候选。',
    };
  }
  if (!openingOption || !targetDefinition || !cost) {
    return {
      state: 'blocked',
      message: '下一地区没有同部位、同品质目标，当前不能升阶。',
    };
  }
  if (!player.player) {
    return { state: 'blocked', message: '存档尚未载入，请稍后再试。' };
  }
  if (playerLevel.value < targetDefinition.level) {
    return {
      state: 'blocked',
      message: `角色达到 Lv${targetDefinition.level} 后才能穿戴并升阶。`,
    };
  }
  if (ownedGold.value < cost.gold) {
    return {
      state: 'blocked',
      message: `金币不足，还差 ${abbr(cost.gold - ownedGold.value)}。`,
    };
  }
  const missing = materialCosts.value.find((entry) => !entry.enough);
  if (missing) {
    return {
      state: 'blocked',
      message: `${missing.item.name}不足，还差 ${abbr(missing.required - missing.owned)}。`,
    };
  }
  return {
    state: 'ready',
    message: '材料齐备。升阶不会重掷词条，也不会改变强化与洗练投入。',
  };
});

const liveMessage = computed(() => feedback.value || preview.value.message);
const canAdvance = computed(
  () => preview.value.state === 'ready' && !submitting.value && !succeeded.value,
);

function failureMessage(result: Exclude<EquipmentAdvancementActionResult, { ok: true }>): string {
  switch (result.reason) {
    case 'no-save':
      return '存档尚未载入，请稍后再试。';
    case 'not-found':
      return '这件装备已不在背包或穿戴栏。';
    case 'no-route':
      return '升阶路线已经变化，请关闭后重新查看。';
    case 'source-changed':
      return '装备已经变化，本次旧确认不会再次扣除材料。';
    case 'persistence-pending':
      return '上一笔付费养成仍在安全写入，请等待完成后再试。';
    case 'persistence-conflict':
      return '另一页面已经更新存档。为防止进度被覆盖，本页面已停机，请刷新后继续。';
    case 'persistence-failed':
      return '存档写入失败，金币、材料与装备已全部恢复；请检查浏览器空间后重试。';
    case 'pending-affix-change':
      return '请先处理这件装备待确认的洗练候选。';
    case 'level-locked':
      return `角色达到 Lv${result.requiredLevel} 后才能升阶。`;
    case 'insufficient-gold':
      return `金币不足：持有 ${abbr(result.owned)}，需要 ${abbr(result.required)}。`;
    case 'insufficient-item':
      return `${requireItem(result.itemId).name}不足：持有 ${abbr(result.owned)}，需要 ${abbr(
        result.required,
      )}。`;
    default: {
      const exhaustive: never = result;
      throw new Error(`[升阶错误] 未处理的动作结果：${JSON.stringify(exhaustive)}`);
    }
  }
}

async function confirmAdvancement(): Promise<void> {
  if (!canAdvance.value || submitting.value) return;
  feedback.value = '正在安全写入存档，请不要关闭窗口…';
  submitting.value = true;

  try {
    const result = await inventory.advanceEquipment(props.inst.uid, expectedSourceDefId);
    if (!result.ok) {
      feedback.value = failureMessage(result);
      return;
    }

    succeeded.value = true;
    successCpDelta.value = result.cpDelta;
    feedback.value = '';
    const targetName = equipmentDisplayPresentation(
      requireEquipment(result.targetDefId),
      activeClassId.value,
    ).name;
    emit('upgraded', { targetName, cpDelta: result.cpDelta });
  } finally {
    submitting.value = false;
  }
}

function requestClose(): void {
  if (submitting.value) return;
  if (dialogFocusTrap?.active) {
    dialogFocusTrap.deactivate();
    return;
  }
  emit('close');
}

onMounted(async () => {
  await nextTick();
  const sheet = sheetRef.value;
  if (!sheet) return;
  dialogFocusTrap = createFocusTrap(sheet, {
    initialFocus: () => closeButtonRef.value ?? sheet,
    fallbackFocus: () => sheet,
    escapeDeactivates: () => !submitting.value,
    clickOutsideDeactivates: () => !submitting.value,
    returnFocusOnDeactivate: true,
    isolateSubtrees: 'aria-hidden',
    onDeactivate: () => emit('close'),
  });
  dialogFocusTrap.activate();
});

onBeforeUnmount(() => {
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
  <Teleport to="body" :disabled="teleportDisabled">
    <div class="advance-overlay">
      <section
        ref="sheetRef"
        class="advance-sheet"
        :class="{ succeeded }"
        role="dialog"
        aria-modal="true"
        aria-labelledby="advance-title"
        aria-describedby="advance-note"
        :aria-busy="submitting"
        tabindex="-1"
      >
        <i class="glass-orb orb-pink" aria-hidden="true" />
        <i class="glass-orb orb-blue" aria-hidden="true" />

        <header class="advance-head">
          <span class="head-sigil" aria-hidden="true">
            <Sparkles :size="20" />
          </span>
          <span>
            <small>区域装备 · 星阶锻造</small>
            <h2 id="advance-title">跨区升阶</h2>
          </span>
          <button
            ref="closeButtonRef"
            type="button"
            class="icon-button close-button"
            aria-label="关闭装备升阶"
            :disabled="submitting"
            @click="requestClose"
          >
            <X :size="19" aria-hidden="true" />
          </button>
        </header>

        <p id="advance-note" class="advance-note">
          将区域装备送往下一地区，同品质成长，已经投入的养成内容不会被重置。
        </p>

        <div class="equipment-route" :class="{ unavailable: !targetDefinition }">
          <article class="equipment-card source-card">
            <small>当前装备</small>
            <EquipmentIcon
              :def="sourceDefinition"
              :class-id="activeClassId"
              :enhance="inst.enhance"
              :locked="inst.locked"
            />
            <strong :class="`q-${sourceDefinition.quality}`">
              {{ sourcePresentation.name }}
            </strong>
            <span>
              {{ SLOT_LABELS[sourceDefinition.slot] }} ·
              {{ QUALITY_LABELS[sourceDefinition.quality] }}
            </span>
            <em class="num">Lv{{ sourceDefinition.level }}</em>
          </article>

          <span class="route-arrow" aria-hidden="true">
            <ArrowRight :size="19" />
          </span>

          <article v-if="targetDefinition" class="equipment-card target-card">
            <small>升阶目标</small>
            <EquipmentIcon
              :def="targetDefinition"
              :class-id="activeClassId"
              :enhance="inst.enhance"
              :locked="inst.locked"
            />
            <strong :class="`q-${targetDefinition.quality}`">
              {{ targetPresentation?.name }}
            </strong>
            <span>
              {{ SLOT_LABELS[targetDefinition.slot] }} ·
              {{ QUALITY_LABELS[targetDefinition.quality] }}
            </span>
            <em class="num">Lv{{ targetDefinition.level }}</em>
          </article>
          <article v-else class="equipment-card target-card empty-target">
            <span class="empty-sigil" aria-hidden="true">?</span>
            <strong>暂无同品质目标</strong>
            <span>不会自动改变品质</span>
          </article>
        </div>

        <aside
          v-if="baseElementChange"
          class="element-change"
          aria-label="基础攻击属性变化"
        >
          <header>
            <strong>基础攻击属性变化</strong>
            <span>
              <b>{{ baseElementChange.sourceLabel }}</b>
              <ArrowRight :size="13" aria-hidden="true" />
              <b>{{ baseElementChange.targetLabel }}</b>
            </span>
          </header>
          <p>升阶后采用目标武器的基础攻击属性；强化、洗练与现有词条仍原样保留。</p>
        </aside>

        <section class="preserve-card" aria-label="升阶保留内容">
          <header>
            <ShieldCheck :size="17" aria-hidden="true" />
            <span>
              <strong>原样保留投入</strong>
              <small>只替换装备定义，不重新随机</small>
            </span>
          </header>
          <div class="preserve-chips">
            <span v-for="fact in preservedFacts" :key="fact">
              <Check :size="11" aria-hidden="true" />
              {{ fact }}
            </span>
          </div>
        </section>

        <section v-if="cost && targetDefinition" class="cost-section" aria-label="升阶消耗">
          <header class="section-title">
            <span>
              <small>真实消耗</small>
              <strong>持有 / 需要</strong>
            </span>
            <em class="level-gate" :class="{ enough: playerLevel >= targetDefinition.level }">
              穿戴条件 Lv{{ targetDefinition.level }}
            </em>
          </header>

          <div class="cost-grid">
            <article class="cost-card" :class="{ missing: ownedGold < cost.gold }">
              <span class="cost-icon gold-icon">
                <Coins :size="21" aria-hidden="true" />
              </span>
              <span>
                <small>金币</small>
                <strong class="num">{{ abbr(ownedGold) }} / {{ abbr(cost.gold) }}</strong>
              </span>
              <Check
                v-if="ownedGold >= cost.gold"
                :size="15"
                class="cost-check"
                aria-hidden="true"
              />
            </article>

            <article
              v-for="entry in materialCosts"
              :key="entry.item.id"
              class="cost-card"
              :class="{ missing: !entry.enough }"
            >
              <ItemIcon :item="entry.item" size="sm" />
              <span>
                <small>{{ entry.item.name }}</small>
                <strong class="num">{{ abbr(entry.owned) }} / {{ abbr(entry.required) }}</strong>
              </span>
              <Check v-if="entry.enough" :size="15" class="cost-check" aria-hidden="true" />
            </article>
          </div>
        </section>

        <section
          class="advance-status"
          :class="`state-${preview.state}`"
          role="status"
          aria-live="polite"
        >
          <span class="status-icon" aria-hidden="true">
            <Check v-if="preview.state === 'success'" :size="17" />
            <LockKeyhole v-else-if="preview.state === 'blocked'" :size="16" />
            <Sparkles v-else :size="16" />
          </span>
          <p>{{ liveMessage }}</p>
        </section>

        <button
          type="button"
          class="confirm-button"
          :class="{ complete: succeeded }"
          :disabled="!canAdvance"
          @click="confirmAdvancement"
        >
          <span class="button-shine" aria-hidden="true" />
          <Check v-if="succeeded" :size="18" aria-hidden="true" />
          <Sparkles v-else :size="18" aria-hidden="true" />
          {{
            succeeded
              ? '升阶完成'
              : submitting
                ? '正在安全写入…'
                : canAdvance
                  ? '确认升阶'
                  : '暂不可升阶'
          }}
        </button>
      </section>
    </div>
  </Teleport>
</template>

<style scoped>
.advance-overlay {
  position: fixed;
  z-index: 170;
  inset: 0;
  display: flex;
  align-items: flex-end;
  justify-content: center;
  padding: 14px 14px max(14px, env(safe-area-inset-bottom));
  background: rgb(49 61 82 / 48%);
  backdrop-filter: blur(7px);
  -webkit-backdrop-filter: blur(7px);
  animation: overlay-in var(--t-mid) ease both;
}

.advance-sheet {
  position: relative;
  width: min(100%, 390px);
  max-height: min(790px, calc(100dvh - 28px - env(safe-area-inset-bottom)));
  overflow-x: hidden;
  overflow-y: auto;
  padding: 14px;
  color: var(--text);
  background:
    radial-gradient(circle at 14% 0%, rgb(255 205 229 / 44%), transparent 31%),
    radial-gradient(circle at 92% 17%, rgb(185 232 255 / 42%), transparent 34%),
    linear-gradient(165deg, rgb(255 255 255 / 96%), rgb(248 246 255 / 94%));
  border: 1px solid rgb(255 255 255 / 92%);
  border-radius: 26px 26px 20px 20px;
  box-shadow:
    0 28px 76px rgb(43 55 79 / 34%),
    inset 0 1px 0 rgb(255 255 255 / 95%);
  backdrop-filter: blur(20px) saturate(1.35);
  -webkit-backdrop-filter: blur(20px) saturate(1.35);
  overscroll-behavior: contain;
  animation: sheet-rise var(--t-slow) var(--ease-out-back) both;
}

.glass-orb {
  position: absolute;
  width: 86px;
  height: 86px;
  border-radius: 50%;
  filter: blur(1px);
  opacity: 0.42;
  pointer-events: none;
}

.orb-pink {
  top: 82px;
  left: -50px;
  background: radial-gradient(circle at 65% 38%, #fff, #ffb4d4 32%, transparent 68%);
}

.orb-blue {
  top: 250px;
  right: -52px;
  background: radial-gradient(circle at 34% 38%, #fff, #95dcfa 32%, transparent 68%);
}

.advance-head {
  position: relative;
  z-index: 1;
  display: grid;
  grid-template-columns: 43px minmax(0, 1fr) 44px;
  align-items: center;
  gap: 9px;
}

.head-sigil {
  width: 43px;
  height: 43px;
  display: grid;
  place-items: center;
  color: #fff;
  background: linear-gradient(145deg, #8cdff8, #ef91bd);
  border: 2px solid rgb(255 255 255 / 88%);
  border-radius: 15px;
  box-shadow: 0 7px 18px rgb(122 179 216 / 26%);
  transform: rotate(-4deg);
}

.advance-head > span:nth-child(2) {
  min-width: 0;
}

.advance-head small,
.section-title small {
  display: block;
  font-size: 9px;
  font-weight: 800;
  letter-spacing: 0.08em;
  color: var(--pink-deep);
}

.advance-head h2 {
  margin: 1px 0 0;
  font-size: 18px;
  line-height: 1.2;
}

.close-button {
  width: 44px;
  height: 44px;
  display: grid;
  place-items: center;
  color: var(--text-mid);
  background: rgb(255 255 255 / 72%);
  border: 1px solid rgb(218 225 239 / 76%);
  border-radius: 50%;
  transition:
    transform var(--t-fast) var(--ease-spring),
    background var(--t-mid) ease;
}

.close-button:active {
  background: #fff;
  transform: scale(0.91) rotate(-5deg);
}

.close-button:disabled {
  cursor: wait;
  opacity: 0.45;
  transform: none;
}

.advance-note {
  position: relative;
  z-index: 1;
  margin: 8px 2px 10px;
  font-size: 10px;
  line-height: 1.55;
  color: var(--text-dim);
}

.equipment-route {
  position: relative;
  z-index: 1;
  display: grid;
  grid-template-columns: minmax(0, 1fr) 27px minmax(0, 1fr);
  align-items: center;
  gap: 4px;
}

.equipment-card {
  min-width: 0;
  min-height: 142px;
  display: flex;
  align-items: center;
  flex-direction: column;
  padding: 9px 7px 8px;
  text-align: center;
  background: rgb(255 255 255 / 69%);
  border: 1px solid rgb(216 226 240 / 78%);
  border-radius: 17px;
  box-shadow:
    inset 0 1px 0 rgb(255 255 255 / 88%),
    0 7px 18px rgb(76 101 131 / 8%);
}

.target-card {
  background:
    radial-gradient(circle at 50% 8%, rgb(255 201 229 / 32%), transparent 48%),
    linear-gradient(155deg, rgb(255 255 255 / 84%), rgb(238 248 255 / 80%));
  border-color: rgb(215 178 218 / 62%);
}

.equipment-card > small {
  align-self: stretch;
  margin-bottom: 4px;
  font-size: 8px;
  font-weight: 800;
  letter-spacing: 0.08em;
  color: var(--text-dim);
}

.equipment-card :deep(.equipment-icon) {
  margin: 1px 0 4px;
}

.equipment-card > strong {
  width: 100%;
  overflow: hidden;
  font-size: 11px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.equipment-card > span {
  width: 100%;
  overflow: hidden;
  margin-top: 2px;
  font-size: 8px;
  color: var(--text-dim);
  text-overflow: ellipsis;
  white-space: nowrap;
}

.equipment-card > em {
  margin-top: auto;
  padding: 2px 7px;
  font-size: 9px;
  font-style: normal;
  font-weight: 800;
  color: var(--blue-deep);
  background: rgb(230 246 255 / 88%);
  border-radius: 999px;
}

.route-arrow {
  width: 27px;
  height: 27px;
  display: grid;
  place-items: center;
  color: #fff;
  background: linear-gradient(135deg, #75d1ef, #e887b5);
  border: 2px solid #fff;
  border-radius: 50%;
  box-shadow: 0 5px 13px rgb(212 119 163 / 24%);
  animation: arrow-breathe 1.8s ease-in-out infinite;
}

.empty-target {
  justify-content: center;
  opacity: 0.74;
}

.empty-sigil {
  width: 43px !important;
  height: 43px;
  display: grid;
  place-items: center;
  margin-bottom: 8px;
  font-size: 18px !important;
  font-weight: 800;
  color: var(--text-dim) !important;
  background: rgb(235 238 246 / 86%);
  border-radius: 14px;
}

.element-change {
  position: relative;
  z-index: 1;
  margin-top: 8px;
  padding: 8px 10px;
  color: #855337;
  background:
    radial-gradient(circle at 12% 0%, rgb(255 197 144 / 28%), transparent 44%),
    linear-gradient(145deg, rgb(255 248 237 / 88%), rgb(248 244 255 / 82%));
  border: 1px solid rgb(227 188 151 / 62%);
  border-radius: 14px;
  box-shadow: inset 0 1px 0 rgb(255 255 255 / 78%);
}

.element-change > header,
.element-change > header > span {
  display: flex;
  align-items: center;
}

.element-change > header {
  justify-content: space-between;
  gap: 8px;
}

.element-change > header > strong {
  font-size: 10px;
}

.element-change > header > span {
  flex: none;
  gap: 4px;
  padding: 3px 7px;
  font-size: 8px;
  color: #9d5e3f;
  background: rgb(255 255 255 / 66%);
  border-radius: 999px;
}

.element-change b {
  font-weight: 800;
}

.element-change p {
  margin: 5px 0 0;
  font-size: 8px;
  line-height: 1.55;
  color: var(--text-dim);
}

.preserve-card {
  position: relative;
  z-index: 1;
  margin-top: 8px;
  padding: 9px 10px;
  color: #376e88;
  background: linear-gradient(145deg, rgb(231 249 255 / 80%), rgb(255 241 249 / 76%));
  border: 1px solid rgb(180 220 237 / 58%);
  border-radius: 14px;
}

.preserve-card > header {
  display: flex;
  align-items: center;
  gap: 7px;
}

.preserve-card > header > span {
  display: flex;
  min-width: 0;
  flex-direction: column;
}

.preserve-card strong {
  font-size: 10px;
}

.preserve-card small {
  font-size: 8px;
  color: var(--text-dim);
}

.preserve-chips {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  margin-top: 7px;
}

.preserve-chips span {
  display: inline-flex;
  align-items: center;
  gap: 3px;
  padding: 3px 6px;
  font-size: 8px;
  font-weight: 700;
  color: var(--text-mid);
  background: rgb(255 255 255 / 70%);
  border: 1px solid rgb(255 255 255 / 82%);
  border-radius: 999px;
}

.cost-section {
  position: relative;
  z-index: 1;
  margin-top: 9px;
}

.section-title {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 8px;
  margin: 0 2px 6px;
}

.section-title strong {
  display: block;
  font-size: 11px;
}

.level-gate {
  padding: 3px 7px;
  font-size: 8px;
  font-style: normal;
  font-weight: 800;
  color: #a14b65;
  background: rgb(255 228 238 / 78%);
  border-radius: 999px;
}

.level-gate.enough {
  color: #34738a;
  background: rgb(224 246 253 / 82%);
}

.cost-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 5px;
}

.cost-card {
  position: relative;
  min-width: 0;
  min-height: 58px;
  display: flex;
  align-items: center;
  gap: 5px;
  padding: 7px 6px;
  background: rgb(255 255 255 / 74%);
  border: 1px solid rgb(216 226 240 / 76%);
  border-radius: 12px;
}

.cost-card.missing {
  background: rgb(255 241 245 / 80%);
  border-color: rgb(234 159 183 / 52%);
}

.cost-card > span:not(.cost-icon) {
  min-width: 0;
  display: flex;
  flex: 1;
  flex-direction: column;
}

.cost-card small {
  overflow: hidden;
  font-size: 7px;
  color: var(--text-dim);
  text-overflow: ellipsis;
  white-space: nowrap;
}

.cost-card strong {
  overflow: hidden;
  font-size: 8px;
  color: var(--text);
  text-overflow: ellipsis;
  white-space: nowrap;
}

.cost-card.missing strong {
  color: #ac4f6a;
}

.cost-icon {
  width: 30px;
  height: 30px;
  flex: 0 0 auto;
  display: grid;
  place-items: center;
  border-radius: 9px;
}

.gold-icon {
  color: #b67b18;
  background: linear-gradient(145deg, #fff6cf, #ffe7a3);
  border: 1px solid rgb(225 178 62 / 30%);
}

.cost-card :deep(.item-icon) {
  flex: 0 0 auto;
}

.cost-check {
  position: absolute;
  top: 3px;
  right: 3px;
  padding: 1px;
  color: #fff;
  background: #67b6c9;
  border-radius: 50%;
}

.advance-status {
  position: relative;
  z-index: 1;
  min-height: 38px;
  display: flex;
  align-items: center;
  gap: 7px;
  margin-top: 8px;
  padding: 7px 9px;
  color: var(--blue-deep);
  background: rgb(230 247 253 / 76%);
  border-radius: 12px;
}

.advance-status.state-blocked {
  color: #96536a;
  background: rgb(255 237 244 / 84%);
}

.advance-status.state-success {
  color: #367e77;
  background: rgb(225 250 242 / 86%);
  animation: success-pulse 0.52s var(--ease-out-back) both;
}

.status-icon {
  width: 25px;
  height: 25px;
  flex: 0 0 auto;
  display: grid;
  place-items: center;
  color: #fff;
  background: #72bcd3;
  border-radius: 9px;
}

.state-blocked .status-icon {
  background: #d487a4;
}

.state-success .status-icon {
  background: #68b7a5;
}

.advance-status p {
  margin: 0;
  font-size: 9px;
  line-height: 1.45;
}

.confirm-button {
  position: relative;
  z-index: 1;
  width: 100%;
  min-height: 48px;
  overflow: hidden;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 7px;
  margin-top: 9px;
  font-size: 12px;
  font-weight: 900;
  letter-spacing: 0.04em;
  color: #fff;
  background: linear-gradient(125deg, #72cdec, #df7fab 62%, #ef9fc2);
  border: 1px solid rgb(255 255 255 / 68%);
  border-radius: 15px;
  box-shadow: 0 9px 22px rgb(208 105 157 / 25%);
  transition:
    transform var(--t-fast) var(--ease-spring),
    box-shadow var(--t-mid) ease,
    filter var(--t-mid) ease;
}

.confirm-button:active:not(:disabled) {
  transform: translateY(1px) scale(0.965);
  box-shadow: 0 4px 11px rgb(208 105 157 / 20%);
}

.confirm-button:disabled {
  color: var(--text-dim);
  background: rgb(229 231 238 / 88%);
  border-color: transparent;
  box-shadow: none;
}

.confirm-button.complete {
  color: #fff;
  background: linear-gradient(125deg, #75c9b9, #77bdda);
}

.button-shine {
  position: absolute;
  top: -30%;
  left: -35%;
  width: 25%;
  height: 160%;
  background: linear-gradient(90deg, transparent, rgb(255 255 255 / 58%), transparent);
  transform: skewX(-18deg);
  animation: button-shine 2.2s ease-in-out infinite;
}

.confirm-button:disabled .button-shine {
  display: none;
}

@keyframes overlay-in {
  from {
    opacity: 0;
  }
}

@keyframes sheet-rise {
  from {
    opacity: 0;
    transform: translateY(28px) scale(0.96);
  }
}

@keyframes arrow-breathe {
  0%,
  100% {
    transform: translateX(-1px) scale(0.94);
  }
  50% {
    transform: translateX(2px) scale(1.05);
  }
}

@keyframes button-shine {
  0%,
  52% {
    left: -35%;
  }
  82%,
  100% {
    left: 120%;
  }
}

@keyframes success-pulse {
  from {
    opacity: 0.4;
    transform: scale(0.96);
  }
}

@media (max-height: 650px) {
  .advance-sheet {
    border-radius: 20px 20px 14px 14px;
  }

  .equipment-card {
    min-height: 126px;
  }

  .preserve-card {
    padding-block: 7px;
  }
}

@media (prefers-reduced-motion: reduce) {
  .advance-overlay,
  .advance-sheet,
  .route-arrow,
  .button-shine,
  .advance-status.state-success {
    animation: none;
  }

  .confirm-button,
  .close-button {
    transition: none;
  }
}
</style>
