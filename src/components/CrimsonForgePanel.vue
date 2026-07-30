<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, ref } from 'vue';
import {
  Check,
  ChevronRight,
  Flame,
  Hammer,
  LockKeyhole,
  MoonStar,
  ShieldCheck,
  Sparkles,
  X,
} from '@lucide/vue';
import { createFocusTrap, type FocusTrap } from 'focus-trap';
import type { EquipmentInstance, EquipSlot } from '@/core/types';
import type { EquippedRecord } from '@/data/characterAppearance';
import { SLOT_LABELS } from '@/data/constants';
import { requireEquipment } from '@/data/equipment';
import { equipmentPresentation } from '@/data/equipmentPresentation';
import { requireEquipmentSet } from '@/data/equipmentSets';
import { requireEquipmentSetCraftingRecipe } from '@/data/equipmentSetCrafting';
import { requireItem } from '@/data/items';
import { requireMonster } from '@/data/monsters';
import { REGION_5_FRAGMENT_LOOT_SOURCES } from '@/data/region5Loot';
import { REGION_6_FRAGMENT_LOOT_SOURCES } from '@/data/region6Loot';
import {
  REGION_7_COMPLETION_BADGE,
  REGION_7_COMPLETION_TITLE,
} from '@/data/region7';
import { REGION_7_FRAGMENT_LOOT_SOURCES } from '@/data/region7Loot';
import { useInventoryStore } from '@/stores/inventory';
import { usePlayerStore } from '@/stores/player';
import type { EquipmentSetCraftingActionResult } from '@/stores/game';
import CharacterAppearance from '@/components/CharacterAppearance.vue';
import EquipmentIcon from '@/components/EquipmentIcon.vue';
import ItemIcon from '@/components/ItemIcon.vue';

const emit = defineEmits<{
  crafted: [result: { equipmentName: string; targetSlot: EquipSlot }];
}>();

const props = withDefaults(
  defineProps<{
    recipeId?: 'craft_set_crimson' | 'craft_set_shadow' | 'craft_set_bloodmoon';
  }>(),
  {
    recipeId: 'craft_set_crimson',
  },
);

const recipe = requireEquipmentSetCraftingRecipe(props.recipeId);
const setDefinition = requireEquipmentSet(recipe.setId);
const fragment = requireItem(recipe.fragmentItemId);
const targetSlots = Object.keys(recipe.targetDefIds) as EquipSlot[];
const inventory = useInventoryStore();
const player = usePlayerStore();
const isShadow = recipe.id === 'craft_set_shadow';
const isBloodmoon = recipe.id === 'craft_set_bloodmoon';
const themeIcon = isShadow || isBloodmoon ? MoonStar : Flame;
const regionName = isBloodmoon ? '血月峡谷' : isShadow ? '幽影祀塔' : '熔岩神殿';
const setDisplayName = setDefinition.name.replace(/套$/, '');
const forgeTitle = `${setDisplayName}重铸`;
const entryTitleId = `${recipe.id}-entry-title`;
const dialogTitleId = `${recipe.id}-forge-title`;
const dialogNoteId = `${recipe.id}-forge-note`;

if (targetSlots.length !== setDefinition.pieceSlots.length) {
  throw new Error(`[配置错误] ${recipe.id} 合成部位与 ${setDefinition.id} 套装部位数量不一致`);
}

const open = ref(false);
const selectedSlot = ref<EquipSlot>(targetSlots[0]!);
const submitting = ref(false);
const feedback = ref('');
const lastCraftedSlot = ref<EquipSlot | null>(null);
const sheetRef = ref<HTMLElement | null>(null);
const closeButtonRef = ref<HTMLButtonElement | null>(null);
let dialogFocusTrap: FocusTrap | null = null;

const teleportDisabled = typeof document === 'undefined';
const fragmentOwned = computed(() => inventory.bag?.items[recipe.fragmentItemId] ?? 0);
const fragmentProgress = computed(() =>
  Math.min(100, (fragmentOwned.value / recipe.fragmentCount) * 100),
);
const selectedDefinition = computed(() =>
  requireEquipment(recipe.targetDefIds[selectedSlot.value]!),
);
const activeClassId = computed(() => {
  const classId = player.player?.classId;
  if (!classId) throw new Error(`[${setDefinition.name}重铸错误] 存档未载入，无法解析职业武器外观`);
  return classId;
});
const selectedPresentation = computed(() =>
  equipmentPresentation(selectedDefinition.value, activeClassId.value),
);

const allOwnedEquipment = computed(() => [
  ...(inventory.bag?.equipment ?? []),
  ...Object.values(inventory.equipped ?? {}).filter(
    (instance): instance is EquipmentInstance => instance !== null,
  ),
]);

const ownedCounts = computed(
  () =>
    Object.fromEntries(
      targetSlots.map((slot) => {
        const defId = recipe.targetDefIds[slot]!;
        return [
          slot,
          allOwnedEquipment.value.filter((instance) => instance.defId === defId).length,
        ];
      }),
    ) as Record<EquipSlot, number>,
);

const collectedSlotCount = computed(
  () => targetSlots.filter((slot) => ownedCounts.value[slot] > 0).length,
);
const equippedSetCount = computed(
  () =>
    Object.values(inventory.equipped ?? {}).filter(
      (instance) => instance && requireEquipment(instance.defId).setId === recipe.setId,
    ).length,
);

const sourceNames = [
  ...new Set(
    (
      isBloodmoon
        ? REGION_7_FRAGMENT_LOOT_SOURCES
        : isShadow
          ? REGION_6_FRAGMENT_LOOT_SOURCES
          : REGION_5_FRAGMENT_LOOT_SOURCES
    ).map((source) => requireMonster(source.monsterId).name),
  ),
];

function previewInstance(slot: EquipSlot): EquipmentInstance {
  return {
    uid: `${recipe.id}-preview-${slot}`,
    defId: recipe.targetDefIds[slot]!,
    enhance: 0,
    baseRollPermille: 1000,
    enhanceGainPermille: Array.from({ length: 15 }, () => 0),
    enhanceLuck: {},
    affixes: [],
    reforgeResonance: 0,
    locked: true,
  };
}

/**
 * 预览只换上当前套装自身的可见图层，避免玩家当前礼服或武器混进来，
 * 造成“合成后就是这套混搭”的错误承诺。首饰仍按现有规则只在装备槽显示。
 */
const previewEquipped = computed<EquippedRecord>(() => ({
  weapon: targetSlots.includes('weapon') ? previewInstance('weapon') : null,
  head: targetSlots.includes('head') ? previewInstance('head') : null,
  body: targetSlots.includes('body') ? previewInstance('body') : null,
  necklace: targetSlots.includes('necklace') ? previewInstance('necklace') : null,
  bracelet: targetSlots.includes('bracelet') ? previewInstance('bracelet') : null,
  ring: targetSlots.includes('ring') ? previewInstance('ring') : null,
  belt: targetSlots.includes('belt') ? previewInstance('belt') : null,
  shoes: targetSlots.includes('shoes') ? previewInstance('shoes') : null,
}));

const canCraft = computed(() => fragmentOwned.value >= recipe.fragmentCount && !submitting.value);

const readyMessage = computed(() => {
  if (fragmentOwned.value < recipe.fragmentCount) {
    return `还差 ${recipe.fragmentCount - fragmentOwned.value} 枚${fragment.name}。`;
  }
  const duplicates = ownedCounts.value[selectedSlot.value];
  if (duplicates > 0) {
    return `已经拥有 ${duplicates} 件同部位${setDisplayName}装备；仍可继续重铸，确认后会进入背包。`;
  }
  return `材料齐备，将重铸 ${selectedPresentation.value.name} 并放入背包。`;
});

function failureMessage(result: Exclude<EquipmentSetCraftingActionResult, { ok: true }>): string {
  switch (result.reason) {
    case 'no-save':
      return '存档尚未载入，请稍后再试。';
    case 'no-recipe':
      return '重铸配方已经变化，请关闭面板后重新进入。';
    case 'unsupported-slot':
      return `所选部位不属于${setDisplayName}套，请重新选择。`;
    case 'insufficient-fragment':
      return `${requireItem(result.itemId).name}不足：持有 ${result.owned}，需要 ${result.required}。`;
    case 'persistence-pending':
      return '上一笔付费养成仍在安全写入，请等待完成后再试。';
    case 'persistence-conflict':
      return '另一页面已经更新存档。为防止覆盖进度，本页面已停机，请刷新后继续。';
    case 'persistence-failed':
      return '存档写入失败，碎片与装备已全部恢复；请检查浏览器空间后重试。';
    default: {
      const exhaustive: never = result;
      throw new Error(
        `[${setDefinition.name}重铸错误] 未处理的动作结果：${JSON.stringify(exhaustive)}`,
      );
    }
  }
}

function selectSlot(slot: EquipSlot): void {
  if (submitting.value) return;
  selectedSlot.value = slot;
  feedback.value = '';
  lastCraftedSlot.value = null;
}

async function confirmCraft(): Promise<void> {
  if (!canCraft.value || submitting.value) return;
  feedback.value = '正在安全写入存档，请不要关闭窗口…';
  submitting.value = true;

  try {
    const targetSlot = selectedSlot.value;
    const result = await inventory.craftEquipmentSetPiece(recipe.id, targetSlot);
    if (!result.ok) {
      feedback.value = failureMessage(result);
      return;
    }

    const definition = requireEquipment(result.targetDefId);
    const presentation = equipmentPresentation(definition, activeClassId.value);
    lastCraftedSlot.value = result.targetSlot;
    feedback.value = `${presentation.name}重铸完成，已安全放入背包。`;
    emit('crafted', { equipmentName: presentation.name, targetSlot: result.targetSlot });
  } finally {
    submitting.value = false;
  }
}

async function activateDialog(): Promise<void> {
  await nextTick();
  const sheet = sheetRef.value;
  if (!sheet || !open.value) return;
  dialogFocusTrap = createFocusTrap(sheet, {
    initialFocus: () => closeButtonRef.value ?? sheet,
    fallbackFocus: () => sheet,
    escapeDeactivates: () => !submitting.value,
    clickOutsideDeactivates: () => !submitting.value,
    returnFocusOnDeactivate: true,
    isolateSubtrees: 'aria-hidden',
    onDeactivate: () => {
      open.value = false;
      dialogFocusTrap = null;
    },
  });
  dialogFocusTrap.activate();
}

function openForge(): void {
  if (open.value) return;
  feedback.value = '';
  lastCraftedSlot.value = null;
  open.value = true;
  void activateDialog();
}

function requestClose(): void {
  if (submitting.value) return;
  if (dialogFocusTrap?.active) {
    dialogFocusTrap.deactivate();
    return;
  }
  open.value = false;
}

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
  <section
    class="forge-entry"
    :class="{ 'is-shadow': isShadow, 'is-bloodmoon': isBloodmoon }"
    :aria-labelledby="entryTitleId"
  >
    <i class="entry-glow entry-glow-one" aria-hidden="true" />
    <i class="entry-glow entry-glow-two" aria-hidden="true" />
    <span class="entry-sigil" aria-hidden="true">
      <component :is="themeIcon" :size="25" :stroke-width="1.8" />
    </span>
    <span class="entry-copy">
      <small>{{ regionName }} · 套装图鉴</small>
      <strong :id="entryTitleId">{{ forgeTitle }}台</strong>
      <span>
        <b class="num">{{ fragmentOwned }}</b
        >/{{ recipe.fragmentCount }} 枚 · 已收集 {{ collectedSlotCount }}/{{ targetSlots.length }}
      </span>
    </span>
    <button type="button" class="forge-launch" @click="openForge">
      <span>选择部位</span>
      <ChevronRight :size="15" aria-hidden="true" />
    </button>
    <span class="entry-progress" aria-hidden="true">
      <i :style="{ width: `${fragmentProgress}%` }" />
    </span>
  </section>

  <Teleport to="body" :disabled="teleportDisabled">
    <Transition name="crimson-modal">
      <div v-if="open" class="forge-overlay" @click.self="requestClose">
        <section
          ref="sheetRef"
          class="forge-sheet"
          :class="{
            'is-success': lastCraftedSlot,
            'is-shadow': isShadow,
            'is-bloodmoon': isBloodmoon,
          }"
          role="dialog"
          aria-modal="true"
          :aria-labelledby="dialogTitleId"
          :aria-describedby="dialogNoteId"
          :aria-busy="submitting"
          tabindex="-1"
        >
          <i class="sheet-orb orb-pink" aria-hidden="true" />
          <i class="sheet-orb orb-blue" aria-hidden="true" />

          <header class="forge-head">
            <span class="head-emblem" aria-hidden="true">
              <Hammer :size="20" :stroke-width="2" />
            </span>
            <span>
              <small>{{ targetSlots.length }} 槽自选 · 不随机部位</small>
              <h2 :id="dialogTitleId">{{ forgeTitle }}</h2>
            </span>
            <button
              ref="closeButtonRef"
              type="button"
              class="close-button"
              :aria-label="`关闭${forgeTitle}`"
              :disabled="submitting"
              @click="requestClose"
            >
              <X :size="18" aria-hidden="true" />
            </button>
          </header>

          <p :id="dialogNoteId" class="forge-note">
            {{ recipe.fragmentCount }} 枚通用碎片可指定一件，结果不会随机成别的部位，也不会直接替换身上装备。
          </p>

          <div class="forge-scroll">
            <section class="material-ribbon" aria-label="重铸材料">
              <ItemIcon :item="fragment" size="md" />
              <span>
                <small>定向重铸素材</small>
                <strong>{{ fragment.name }}</strong>
                <em>来自 {{ sourceNames.join('、') }}</em>
              </span>
              <b class="num" :class="{ enough: fragmentOwned >= recipe.fragmentCount }">
                {{ fragmentOwned }}/{{ recipe.fragmentCount }}
              </b>
              <span class="material-progress" aria-hidden="true">
                <i :style="{ width: `${fragmentProgress}%` }" />
              </span>
            </section>

            <div class="forge-showcase">
              <section
                class="outfit-preview"
                :aria-label="`当前角色${setDefinition.name}整套外观预览`"
              >
                <span class="preview-label">整套外观</span>
                <span v-if="player.player" class="doll-preview">
                  <CharacterAppearance
                    :class-id="player.player.classId"
                    :level="player.player.level"
                    :equipped="previewEquipped"
                    variant="showcase"
                    action="idle"
                  />
                </span>
                <span v-else class="preview-unavailable">
                  <LockKeyhole :size="20" aria-hidden="true" />
                  存档载入后预览
                </span>
                <span class="preview-stats">
                  <b>穿戴 {{ equippedSetCount }}/{{ targetSlots.length }}</b>
                  <small>收集 {{ collectedSlotCount }}/{{ targetSlots.length }}</small>
                </span>
              </section>

              <section class="slot-picker" aria-labelledby="slot-picker-title">
                <div class="section-title">
                  <span>
                    <small>本次不会随机</small>
                    <strong id="slot-picker-title">选择重铸部位</strong>
                  </span>
                  <em>{{ SLOT_LABELS[selectedSlot] }}</em>
                </div>
                <div
                  class="slot-grid"
                  role="group"
                  :aria-label="`${setDefinition.name}重铸部位`"
                >
                  <button
                    v-for="slot in targetSlots"
                    :key="slot"
                    type="button"
                    class="slot-choice"
                    :class="{
                      selected: selectedSlot === slot,
                      collected: ownedCounts[slot] > 0,
                      crafted: lastCraftedSlot === slot,
                    }"
                    :aria-pressed="selectedSlot === slot"
                    :aria-label="`${SLOT_LABELS[slot]}，已拥有 ${ownedCounts[slot]} 件`"
                    :disabled="submitting"
                    @click="selectSlot(slot)"
                  >
                    <EquipmentIcon
                      :def="requireEquipment(recipe.targetDefIds[slot]!)"
                      :class-id="activeClassId"
                      size="sm"
                      decorative
                    />
                    <span>
                      <b>{{ SLOT_LABELS[slot] }}</b>
                      <small v-if="ownedCounts[slot] > 0">已有 {{ ownedCounts[slot] }}</small>
                      <small v-else>未收集</small>
                    </span>
                    <Check v-if="ownedCounts[slot] > 0" :size="12" aria-hidden="true" />
                  </button>
                </div>
              </section>
            </div>

            <section class="selected-preview" aria-label="选中装备预览">
              <EquipmentIcon :def="selectedDefinition" :class-id="activeClassId" size="lg" />
              <span class="selected-copy">
                <small>本次重铸</small>
                <strong>{{ selectedPresentation.name }}</strong>
                <span
                  >传说 · {{ SLOT_LABELS[selectedSlot] }} · Lv{{ selectedDefinition.level }}</span
                >
              </span>
              <span class="fixed-result">
                <ShieldCheck :size="14" aria-hidden="true" />
                部位确定
              </span>
            </section>

            <section class="set-bonus-list" aria-labelledby="set-bonus-title">
              <div class="section-title compact">
                <span>
                  <small>同源真实战斗结算</small>
                  <strong id="set-bonus-title">{{ setDefinition.name }}共鸣</strong>
                </span>
              </div>
              <article
                v-for="bonus in setDefinition.bonuses"
                :key="bonus.pieces"
                :class="{ active: equippedSetCount >= bonus.pieces }"
              >
                <b>{{ bonus.pieces }}件</b>
                <span>
                  <strong>{{ bonus.label }}</strong>
                  <small>{{ bonus.description }}</small>
                </span>
                <Sparkles :size="14" aria-hidden="true" />
              </article>
              <figure v-if="isBloodmoon" class="bloodmoon-title-preview">
                <img
                  :src="`/${REGION_7_COMPLETION_BADGE}`"
                  alt=""
                  width="64"
                  height="64"
                />
                <figcaption>
                  <small>集齐 8 件后静态展示</small>
                  <strong>{{ REGION_7_COMPLETION_TITLE }}</strong>
                  <span>称号与血月徽记不提供战斗属性</span>
                </figcaption>
              </figure>
            </section>
          </div>

          <footer class="forge-actions">
            <p
              class="forge-feedback"
              :class="{ success: lastCraftedSlot, blocked: !canCraft && !submitting }"
              aria-live="polite"
            >
              {{ feedback || readyMessage }}
            </p>
            <button
              type="button"
              class="confirm-button"
              :disabled="!canCraft"
              @click="confirmCraft"
            >
              <span v-if="submitting" class="write-spinner" aria-hidden="true" />
              <component :is="themeIcon" v-else :size="17" aria-hidden="true" />
              {{
                submitting
                  ? '正在安全写入'
                  : fragmentOwned >= recipe.fragmentCount
                    ? `重铸${SLOT_LABELS[selectedSlot]}`
                    : `还差 ${recipe.fragmentCount - fragmentOwned} 枚`
              }}
            </button>
          </footer>

          <span v-if="lastCraftedSlot" class="success-burst" aria-hidden="true">
            <i v-for="index in 10" :key="index" :style="{ '--spark': index }" />
          </span>
        </section>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.forge-entry {
  position: relative;
  grid-column: 1 / -1;
  min-height: 86px;
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) auto;
  align-items: center;
  gap: 10px;
  overflow: hidden;
  padding: 13px 12px 17px;
  background:
    linear-gradient(
      120deg,
      rgb(255 255 255 / 93%),
      rgb(255 239 242 / 91%) 54%,
      rgb(232 247 255 / 91%)
    ),
    var(--panel);
  border: 1px solid rgb(235 181 198 / 55%);
  border-radius: 20px;
  box-shadow:
    inset 0 1px 0 rgb(255 255 255 / 90%),
    0 9px 22px rgb(151 78 104 / 9%);
}

.forge-entry.is-shadow {
  background:
    radial-gradient(circle at 8% 20%, rgb(255 255 255 / 91%), transparent 34%),
    radial-gradient(circle at 92% 88%, rgb(122 220 255 / 23%), transparent 39%),
    linear-gradient(122deg, rgb(238 232 255 / 88%), rgb(250 244 255 / 86%) 54%, rgb(228 247 255 / 84%));
  border-color: rgb(161 143 222 / 48%);
}

.forge-entry.is-shadow .entry-sigil {
  background: linear-gradient(145deg, #7662b9, #9c82dc 54%, #6cc9e4);
  box-shadow: 0 7px 16px rgb(96 72 165 / 24%);
}

.forge-entry.is-bloodmoon {
  background:
    radial-gradient(circle at 9% 18%, rgb(255 255 255 / 92%), transparent 34%),
    radial-gradient(circle at 91% 86%, rgb(245 104 133 / 22%), transparent 40%),
    linear-gradient(122deg, rgb(255 243 247 / 91%), rgb(250 235 242 / 89%) 56%, rgb(233 242 255 / 88%));
  border-color: rgb(174 63 94 / 42%);
}

.forge-entry.is-bloodmoon .entry-sigil {
  background:
    radial-gradient(circle at 35% 22%, rgb(255 255 255 / 42%), transparent 27%),
    linear-gradient(145deg, #6e1834, #b93256 58%, #ef7691);
  box-shadow: 0 7px 17px rgb(116 27 55 / 28%);
}

.forge-sheet.is-shadow {
  background:
    radial-gradient(circle at 84% 3%, rgb(146 208 255 / 17%), transparent 31%),
    radial-gradient(circle at 3% 32%, rgb(176 137 239 / 16%), transparent 29%),
    linear-gradient(160deg, rgb(252 250 255 / 97%), rgb(244 241 255 / 96%) 52%, rgb(237 249 255 / 96%));
}

.forge-sheet.is-bloodmoon {
  background:
    radial-gradient(circle at 84% 2%, rgb(220 72 111 / 17%), transparent 31%),
    radial-gradient(circle at 4% 32%, rgb(110 37 72 / 13%), transparent 30%),
    linear-gradient(160deg, rgb(255 252 253 / 97%), rgb(251 239 245 / 96%) 54%, rgb(238 246 255 / 96%));
}

.forge-sheet.is-bloodmoon .head-emblem,
.forge-sheet.is-bloodmoon .confirm-button {
  background:
    radial-gradient(circle at 30% 0, rgb(255 255 255 / 28%), transparent 35%),
    linear-gradient(135deg, #771b3a, #b83158 58%, #e66b89);
  box-shadow:
    0 9px 18px rgb(106 28 56 / 24%),
    inset 0 1px 0 rgb(255 255 255 / 36%);
}

.forge-sheet.is-bloodmoon .slot-choice.selected {
  border-color: rgb(174 55 91 / 61%);
  box-shadow:
    0 0 0 3px rgb(195 63 102 / 10%),
    0 8px 16px rgb(114 32 61 / 12%);
}

.forge-sheet.is-shadow .head-emblem,
.forge-sheet.is-shadow .confirm-button {
  background:
    radial-gradient(circle at 30% 0, rgb(255 255 255 / 27%), transparent 35%),
    linear-gradient(135deg, #8c78d8, #7a68c4 58%, #54b7d4);
  box-shadow:
    0 9px 18px rgb(93 73 170 / 22%),
    inset 0 1px 0 rgb(255 255 255 / 40%);
}

.forge-sheet.is-shadow .slot-choice.selected {
  border-color: rgb(132 106 214 / 62%);
  box-shadow:
    0 0 0 3px rgb(145 113 224 / 10%),
    0 8px 16px rgb(98 79 169 / 12%);
}

.entry-glow {
  position: absolute;
  width: 76px;
  aspect-ratio: 1;
  border-radius: 50%;
  filter: blur(4px);
  opacity: 0.45;
  pointer-events: none;
}

.entry-glow-one {
  top: -45px;
  right: 18%;
  background: #ff9eaa;
}

.entry-glow-two {
  right: -38px;
  bottom: -45px;
  background: #9fe4ff;
}

.entry-sigil {
  z-index: 1;
  width: 48px;
  height: 48px;
  display: grid;
  place-items: center;
  color: #fff;
  background:
    radial-gradient(circle at 35% 28%, rgb(255 255 255 / 50%), transparent 26%),
    linear-gradient(145deg, #ffbf9d, #f46e86 65%, #dc526e);
  border: 2px solid rgb(255 255 255 / 82%);
  border-radius: 17px;
  box-shadow:
    0 7px 15px rgb(210 75 105 / 24%),
    inset 0 0 13px rgb(255 255 255 / 28%);
  transform: rotate(-3deg);
}

.entry-copy {
  z-index: 1;
  min-width: 0;
  display: grid;
  gap: 2px;
}

.entry-copy small {
  font-size: 9px;
  letter-spacing: 0.08em;
  color: #b47788;
}

.entry-copy strong {
  font-family: var(--font-display);
  font-size: 15px;
  color: #663d4b;
}

.entry-copy span {
  overflow: hidden;
  font-size: 10px;
  color: var(--text-dim);
  text-overflow: ellipsis;
  white-space: nowrap;
}

.entry-copy b {
  color: #e8617e;
}

.forge-launch {
  z-index: 1;
  min-height: 38px;
  display: flex;
  align-items: center;
  gap: 1px;
  padding: 0 10px;
  font-size: 10px;
  font-weight: 800;
  color: #865062;
  background: rgb(255 255 255 / 71%);
  border: 1px solid rgb(230 164 184 / 55%);
  border-radius: 999px;
  box-shadow: inset 0 1px 0 #fff;
  transition:
    transform var(--t-fast) var(--ease-spring),
    box-shadow var(--t-fast) ease;
}

.forge-launch:active {
  box-shadow: inset 0 2px 6px rgb(144 80 104 / 12%);
  transform: scale(0.94);
}

.entry-progress {
  position: absolute;
  right: 12px;
  bottom: 8px;
  left: 72px;
  height: 3px;
  overflow: hidden;
  background: rgb(132 111 124 / 10%);
  border-radius: 999px;
}

.entry-progress i,
.material-progress i {
  display: block;
  height: 100%;
  background: linear-gradient(90deg, #ff97ae, #ffc98e 55%, #8eddf6);
  border-radius: inherit;
  box-shadow: 0 0 7px rgb(242 104 135 / 35%);
  transition: width 0.55s var(--ease-soft);
}

.forge-overlay {
  position: fixed;
  z-index: 320;
  inset: 0;
  display: grid;
  align-items: end;
  padding: max(12px, env(safe-area-inset-top)) 10px max(8px, env(safe-area-inset-bottom));
  background:
    radial-gradient(circle at 50% 72%, rgb(255 173 187 / 16%), transparent 38%), rgb(39 34 48 / 46%);
  backdrop-filter: blur(10px) saturate(1.05);
}

.forge-sheet {
  position: relative;
  width: min(100%, 410px);
  max-height: min(790px, calc(100dvh - max(24px, env(safe-area-inset-top))));
  margin: 0 auto;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  color: var(--text);
  background: linear-gradient(
    156deg,
    rgb(255 255 255 / 97%),
    rgb(255 242 247 / 96%) 52%,
    rgb(237 249 255 / 96%)
  );
  border: 1px solid rgb(255 255 255 / 84%);
  border-radius: 28px;
  box-shadow:
    0 24px 68px rgb(47 32 50 / 31%),
    inset 0 1px 0 rgb(255 255 255 / 94%);
}

.sheet-orb {
  position: absolute;
  width: 150px;
  aspect-ratio: 1;
  border-radius: 50%;
  filter: blur(16px);
  opacity: 0.22;
  pointer-events: none;
}

.orb-pink {
  top: -72px;
  left: -64px;
  background: #ff789c;
}

.orb-blue {
  right: -70px;
  bottom: 22%;
  background: #77d9ff;
}

.forge-head {
  z-index: 2;
  display: grid;
  grid-template-columns: auto 1fr auto;
  align-items: center;
  gap: 10px;
  padding: 16px 16px 8px;
}

.head-emblem {
  width: 39px;
  height: 39px;
  display: grid;
  place-items: center;
  color: #fff;
  background: linear-gradient(145deg, #ffb587, #eb6682);
  border: 2px solid rgb(255 255 255 / 78%);
  border-radius: 14px;
  box-shadow: 0 6px 14px rgb(206 75 106 / 21%);
}

.forge-head small,
.section-title small,
.selected-copy small,
.material-ribbon small {
  display: block;
  font-size: 9px;
  font-style: normal;
  letter-spacing: 0.07em;
  color: #af7a8a;
}

.forge-head h2 {
  margin: 1px 0 0;
  font-family: var(--font-display);
  font-size: 19px;
  color: #63404c;
}

.close-button {
  width: 36px;
  height: 36px;
  display: grid;
  place-items: center;
  color: #8d6875;
  background: rgb(255 255 255 / 65%);
  border: 1px solid rgb(210 174 188 / 45%);
  border-radius: 50%;
  transition: transform var(--t-fast) var(--ease-spring);
}

.close-button:active:not(:disabled) {
  transform: scale(0.9) rotate(5deg);
}

.close-button:disabled {
  cursor: wait;
  opacity: 0.45;
}

.forge-note {
  z-index: 1;
  margin: 0;
  padding: 0 17px 10px;
  font-size: 10px;
  line-height: 1.45;
  color: var(--text-dim);
}

.forge-scroll {
  z-index: 1;
  min-height: 0;
  display: grid;
  grid-auto-rows: max-content;
  gap: 10px;
  overflow: auto;
  padding: 0 13px 12px;
  overscroll-behavior: contain;
}

.material-ribbon {
  position: relative;
  min-height: 65px;
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) auto;
  align-items: center;
  gap: 9px;
  overflow: hidden;
  padding: 8px 10px 11px;
  background: linear-gradient(135deg, rgb(255 255 255 / 76%), rgb(255 232 237 / 72%));
  border: 1px solid rgb(236 176 192 / 47%);
  border-radius: 18px;
}

.material-ribbon > span {
  min-width: 0;
}

.material-ribbon strong {
  display: block;
  margin-top: 1px;
  font-size: 12px;
  color: #704652;
}

.material-ribbon em {
  display: block;
  overflow: hidden;
  margin-top: 2px;
  font-size: 8px;
  font-style: normal;
  color: var(--text-dim);
  text-overflow: ellipsis;
  white-space: nowrap;
}

.material-ribbon > b {
  font-size: 13px;
  color: #bd6679;
}

.material-ribbon > b.enough {
  color: #28a68d;
}

.material-progress {
  position: absolute;
  right: 10px;
  bottom: 6px;
  left: 69px;
  height: 3px;
  overflow: hidden;
  background: rgb(115 90 105 / 10%);
  border-radius: 999px;
}

.forge-showcase {
  display: grid;
  grid-template-columns: 118px minmax(0, 1fr);
  gap: 9px;
}

.outfit-preview,
.slot-picker,
.selected-preview,
.set-bonus-list {
  background: rgb(255 255 255 / 58%);
  border: 1px solid rgb(229 191 204 / 42%);
  box-shadow: inset 0 1px 0 rgb(255 255 255 / 80%);
}

.outfit-preview {
  position: relative;
  min-height: 190px;
  display: flex;
  align-items: center;
  flex-direction: column;
  overflow: hidden;
  padding: 8px 6px;
  border-radius: 20px;
}

.outfit-preview::before {
  position: absolute;
  inset: 32% 8% 7%;
  content: '';
  background: radial-gradient(ellipse, rgb(255 150 154 / 18%), transparent 67%);
  border-radius: 50%;
}

.preview-label {
  align-self: flex-start;
  padding: 3px 7px;
  font-size: 8px;
  font-weight: 800;
  color: #9c6678;
  background: rgb(255 238 244 / 78%);
  border-radius: 999px;
}

.doll-preview {
  position: relative;
  width: 104px;
  height: 135px;
  margin: -3px auto -1px;
}

.preview-unavailable {
  min-height: 128px;
  display: grid;
  place-items: center;
  align-content: center;
  gap: 6px;
  font-size: 9px;
  color: var(--text-dim);
}

.preview-stats {
  z-index: 1;
  width: 100%;
  display: flex;
  justify-content: space-between;
  gap: 4px;
  padding: 5px 7px;
  font-size: 8px;
  color: #936272;
  background: rgb(255 255 255 / 68%);
  border-radius: 10px;
}

.preview-stats small {
  color: var(--text-dim);
}

.slot-picker {
  min-width: 0;
  padding: 9px;
  border-radius: 20px;
}

.section-title {
  display: flex;
  align-items: end;
  justify-content: space-between;
  gap: 6px;
  margin-bottom: 7px;
}

.section-title strong {
  display: block;
  margin-top: 1px;
  font-size: 12px;
  color: #694550;
}

.section-title em {
  padding: 3px 6px;
  font-size: 8px;
  font-style: normal;
  font-weight: 800;
  color: #fff;
  background: linear-gradient(135deg, #f18aa2, #eea679);
  border-radius: 999px;
}

.slot-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 5px;
}

.slot-choice {
  position: relative;
  min-width: 0;
  min-height: 55px;
  display: grid;
  grid-template-columns: auto minmax(0, 1fr);
  align-items: center;
  gap: 5px;
  padding: 5px;
  color: #755560;
  background: rgb(250 246 248 / 68%);
  border: 1px solid rgb(214 189 198 / 52%);
  border-radius: 13px;
  text-align: left;
  transition:
    transform var(--t-fast) var(--ease-spring),
    border-color var(--t-fast) ease,
    box-shadow var(--t-fast) ease;
}

.slot-choice > span {
  min-width: 0;
}

.slot-choice b,
.slot-choice small {
  display: block;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.slot-choice b {
  font-size: 9px;
}

.slot-choice small {
  margin-top: 2px;
  font-size: 7px;
  color: var(--text-dim);
}

.slot-choice > svg {
  position: absolute;
  top: 3px;
  right: 3px;
  padding: 2px;
  color: #fff;
  background: #55bea8;
  border-radius: 50%;
  box-sizing: content-box;
}

.slot-choice.selected {
  border-color: rgb(235 110 139 / 80%);
  box-shadow:
    0 0 0 2px rgb(255 141 165 / 14%),
    0 5px 11px rgb(194 91 117 / 12%);
  transform: translateY(-1px);
}

.slot-choice.crafted {
  animation: crafted-pulse 0.72s var(--ease-spring);
}

.slot-choice:active:not(:disabled) {
  transform: scale(0.94) rotate(-1deg);
}

.selected-preview {
  position: relative;
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) auto;
  align-items: center;
  gap: 9px;
  overflow: hidden;
  padding: 10px;
  background:
    radial-gradient(circle at 10% 18%, rgb(255 255 255 / 90%), transparent 34%),
    linear-gradient(
      120deg,
      rgb(255 237 231 / 76%),
      rgb(255 248 250 / 71%) 58%,
      rgb(234 248 255 / 73%)
    );
  border-radius: 20px;
}

.selected-preview::after {
  position: absolute;
  right: -22px;
  width: 78px;
  aspect-ratio: 1;
  content: '';
  background: radial-gradient(circle, rgb(255 147 116 / 18%), transparent 65%);
}

.selected-copy {
  min-width: 0;
}

.selected-copy strong {
  display: block;
  overflow: hidden;
  margin: 2px 0;
  font-size: 13px;
  color: #7f4b52;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.selected-copy span {
  display: block;
  font-size: 9px;
  color: var(--text-dim);
}

.fixed-result {
  z-index: 1;
  display: flex;
  align-items: center;
  gap: 3px;
  padding: 5px 7px;
  font-size: 8px;
  font-weight: 800;
  color: #388f83;
  background: rgb(230 255 250 / 70%);
  border: 1px solid rgb(113 204 188 / 31%);
  border-radius: 999px;
  white-space: nowrap;
}

.set-bonus-list {
  display: grid;
  gap: 5px;
  padding: 10px;
  border-radius: 20px;
}

.section-title.compact {
  margin-bottom: 1px;
}

.set-bonus-list article {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) auto;
  align-items: center;
  gap: 8px;
  padding: 7px 8px;
  color: #8d7880;
  background: rgb(245 241 243 / 65%);
  border: 1px solid rgb(215 200 205 / 44%);
  border-radius: 13px;
}

.set-bonus-list article > b {
  width: 37px;
  padding: 4px 0;
  font-size: 9px;
  color: #9e7885;
  background: rgb(255 255 255 / 66%);
  border-radius: 999px;
  text-align: center;
}

.set-bonus-list article span,
.set-bonus-list article strong,
.set-bonus-list article small {
  min-width: 0;
  display: block;
}

.set-bonus-list article strong {
  font-size: 9px;
}

.set-bonus-list article small {
  margin-top: 1px;
  font-size: 8px;
  line-height: 1.35;
  color: var(--text-dim);
}

.set-bonus-list article > svg {
  opacity: 0.24;
}

.set-bonus-list article.active {
  color: #854957;
  background: linear-gradient(120deg, rgb(255 232 237 / 76%), rgb(255 247 238 / 72%));
  border-color: rgb(235 155 175 / 50%);
}

.set-bonus-list article.active > b {
  color: #fff;
  background: linear-gradient(135deg, #f27f9b, #efaa76);
}

.set-bonus-list article.active > svg {
  color: #f07b96;
  opacity: 1;
}

.bloodmoon-title-preview {
  min-height: 82px;
  margin: 4px 0 0;
  display: grid;
  grid-template-columns: 64px minmax(0, 1fr);
  align-items: center;
  gap: 10px;
  padding: 8px 10px;
  background:
    radial-gradient(circle at 18% 50%, rgb(239 93 127 / 15%), transparent 38%),
    linear-gradient(120deg, rgb(255 255 255 / 80%), rgb(255 235 242 / 72%));
  border: 1px solid rgb(189 70 102 / 23%);
  border-radius: 17px;
  box-shadow: inset 0 1px 0 rgb(255 255 255 / 86%);
}

.bloodmoon-title-preview img {
  width: 64px;
  height: 64px;
  object-fit: contain;
  filter: drop-shadow(0 6px 9px rgb(91 24 48 / 18%));
}

.bloodmoon-title-preview figcaption {
  min-width: 0;
  display: grid;
  gap: 2px;
}

.bloodmoon-title-preview small,
.bloodmoon-title-preview span {
  font-size: 9px;
  line-height: 1.4;
  color: var(--text-dim);
}

.bloodmoon-title-preview strong {
  font-family: var(--font-display);
  font-size: 14px;
  color: #812845;
}

.forge-actions {
  z-index: 2;
  display: grid;
  gap: 7px;
  padding: 10px 13px max(13px, env(safe-area-inset-bottom));
  background: rgb(255 255 255 / 80%);
  border-top: 1px solid rgb(225 194 205 / 38%);
  backdrop-filter: blur(12px);
}

.forge-feedback {
  min-height: 28px;
  margin: 0;
  padding: 6px 8px;
  font-size: 9px;
  line-height: 1.45;
  color: #7c6870;
  background: rgb(244 240 242 / 62%);
  border-radius: 11px;
}

.forge-feedback.success {
  color: #2f8879;
  background: rgb(227 251 246 / 74%);
}

.forge-feedback.blocked {
  color: #9c6c79;
}

.confirm-button {
  min-height: 45px;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 7px;
  font-size: 12px;
  font-weight: 900;
  color: #fff;
  background:
    radial-gradient(circle at 30% 0, rgb(255 255 255 / 27%), transparent 35%),
    linear-gradient(135deg, #ff9c8e, #ef6684 61%, #d95676);
  border: 1px solid rgb(255 255 255 / 70%);
  border-radius: 15px;
  box-shadow:
    0 9px 18px rgb(205 77 108 / 22%),
    inset 0 1px 0 rgb(255 255 255 / 40%);
  transition:
    transform var(--t-fast) var(--ease-spring),
    filter var(--t-fast) ease;
}

.confirm-button:active:not(:disabled) {
  transform: scale(0.97) translateY(1px);
}

.confirm-button:disabled {
  cursor: not-allowed;
  color: #ac929a;
  background: linear-gradient(135deg, #eee7e9, #e4dde0);
  border-color: rgb(255 255 255 / 55%);
  box-shadow: none;
}

.write-spinner {
  width: 15px;
  height: 15px;
  border: 2px solid rgb(255 255 255 / 38%);
  border-top-color: #fff;
  border-radius: 50%;
  animation: spinner-turn 0.72s linear infinite;
}

.success-burst {
  position: absolute;
  z-index: 5;
  top: 52%;
  left: 50%;
  width: 1px;
  height: 1px;
  pointer-events: none;
}

.success-burst i {
  --spark: 1;
  position: absolute;
  width: 5px;
  height: 13px;
  background: linear-gradient(#fff, #ff9b88);
  border-radius: 999px;
  box-shadow: 0 0 8px #ff9d8a;
  transform: rotate(calc(var(--spark) * 36deg)) translateY(-76px);
  animation: spark-fade 0.85s ease-out both;
  animation-delay: calc(var(--spark) * 16ms);
}

.crimson-modal-enter-active {
  animation: overlay-in 0.22s ease-out;
}

.crimson-modal-enter-active .forge-sheet {
  animation: sheet-in 0.42s var(--ease-spring);
}

.crimson-modal-leave-active {
  animation: overlay-in 0.18s ease-in reverse;
}

@keyframes overlay-in {
  from {
    opacity: 0;
  }
}

@keyframes sheet-in {
  from {
    opacity: 0;
    transform: translateY(24px) scale(0.96);
  }
}

@keyframes spinner-turn {
  to {
    transform: rotate(360deg);
  }
}

@keyframes crafted-pulse {
  50% {
    box-shadow:
      0 0 0 5px rgb(255 117 145 / 12%),
      0 8px 16px rgb(194 91 117 / 18%);
    transform: translateY(-2px) scale(1.03);
  }
}

@keyframes spark-fade {
  from {
    opacity: 0;
    transform: rotate(calc(var(--spark) * 36deg)) translateY(-20px) scale(0.4);
  }
  28% {
    opacity: 1;
  }
  to {
    opacity: 0;
    transform: rotate(calc(var(--spark) * 36deg)) translateY(-105px) scale(0.7);
  }
}

@media (min-width: 600px) {
  .forge-overlay {
    align-items: center;
  }
}

@media (max-width: 350px) {
  .forge-entry {
    grid-template-columns: auto minmax(0, 1fr);
  }

  .forge-launch {
    grid-column: 1 / -1;
    justify-self: stretch;
    justify-content: center;
  }

  .entry-progress {
    left: 12px;
  }

  .forge-showcase {
    grid-template-columns: 105px minmax(0, 1fr);
  }

  .slot-choice {
    grid-template-columns: 1fr;
    justify-items: center;
    text-align: center;
  }

  .slot-choice :deep(.equipment-icon) {
    display: none;
  }
}

@media (prefers-reduced-motion: reduce) {
  .crimson-modal-enter-active,
  .crimson-modal-enter-active .forge-sheet,
  .crimson-modal-leave-active,
  .slot-choice.crafted,
  .success-burst i,
  .write-spinner {
    animation: none;
  }
}
</style>
