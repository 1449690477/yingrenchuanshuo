<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue';
import { ArrowLeft, Coins, LockKeyhole, Sparkles, X } from '@lucide/vue';
import { abbr, signed } from '@/core/format';
import type { EquipmentInstance, Quality } from '@/core/types';
import type { EquippedRecord } from '@/data/characterAppearance';
import { QUALITY_LABELS, SLOT_LABELS } from '@/data/constants';
import { useInventoryStore } from '@/stores/inventory';
import { usePlayerStore } from '@/stores/player';
import { useShopStore } from '@/stores/shop';
import CharacterAppearance from '@/components/CharacterAppearance.vue';
import EquipmentIcon from '@/components/EquipmentIcon.vue';

type FilterId = 'all' | 'epic' | 'legendary' | 'mythic' | 'dress' | 'weapon';

const emit = defineEmits<{ close: [] }>();

const shop = useShopStore();
const inventory = useInventoryStore();
const player = usePlayerStore();
const activeFilter = ref<FilterId>('all');
const selectedId = ref<string | null>(null);
const toast = ref('');
const purchaseBurst = ref(0);
const backButton = ref<HTMLButtonElement | null>(null);
const detailSheet = ref<HTMLElement | null>(null);
const detailCloseButton = ref<HTMLButtonElement | null>(null);
let detailReturnFocus: HTMLElement | null = null;
let toastTimer = 0;
const shopSceneUrl = `${import.meta.env.BASE_URL}assets/shops/sakura-boutique.webp`;

const filters: readonly { id: FilterId; label: string }[] = [
  { id: 'all', label: '全部' },
  { id: 'epic', label: '紫色' },
  { id: 'legendary', label: '金色' },
  { id: 'mythic', label: '红色' },
  { id: 'dress', label: '洛丽塔裙' },
  { id: 'weapon', label: '职业武器' },
];

const visibleOffers = computed(() =>
  shop.offers.filter((entry) => {
    if (activeFilter.value === 'all') return true;
    if (activeFilter.value === 'dress') return entry.offer.category === 'dress';
    if (activeFilter.value === 'weapon') return entry.offer.category === 'weapon';
    return entry.def.quality === activeFilter.value;
  }),
);

const selected = computed(() =>
  selectedId.value
    ? (shop.offers.find((entry) => entry.offer.id === selectedId.value) ?? null)
    : null,
);

const previewInstance = computed<EquipmentInstance | null>(() =>
  selected.value ? shop.previewInstance(selected.value.def.id) : null,
);

const previewEquipped = computed<EquippedRecord | null>(() => {
  if (!inventory.equipped || !selected.value || !previewInstance.value) return inventory.equipped;
  return {
    ...inventory.equipped,
    [selected.value.def.slot]: previewInstance.value,
  };
});

const previewDelta = computed(() =>
  previewInstance.value ? inventory.cpDelta(previewInstance.value) : 0,
);

function reasonText(reason: string, unlockLevel = selected.value?.offer.unlockLevel ?? 0): string {
  switch (reason) {
    case 'sold-out':
      return '本角色已收藏';
    case 'level-locked':
      return `需要 Lv${unlockLevel}`;
    case 'stage-locked':
      return '继续推进主线后开放';
    case 'insufficient-gold':
      return '金币不足，可分解掉落装备积攒';
    case 'wrong-class':
      return '当前职业无法使用';
    default:
      return '暂不可购买';
  }
}

function assessmentText(entry: (typeof shop.offers)[number]): string {
  return entry.assessment.ok
    ? '可购买'
    : reasonText(entry.assessment.reason, entry.offer.unlockLevel);
}

function openDetail(offerId: string, event: MouseEvent): void {
  detailReturnFocus = event.currentTarget as HTMLElement;
  selectedId.value = offerId;
}

function closeDetail(): void {
  selectedId.value = null;
}

function onDetailKeydown(event: KeyboardEvent): void {
  if (event.key === 'Escape') {
    event.preventDefault();
    event.stopPropagation();
    closeDetail();
    return;
  }
  if (event.key !== 'Tab' || !detailSheet.value) return;

  const focusable = [
    ...detailSheet.value.querySelectorAll<HTMLElement>(
      'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
    ),
  ].filter((element) => !element.hasAttribute('hidden'));
  const first = focusable[0];
  const last = focusable.at(-1);
  if (!first || !last) {
    event.preventDefault();
    return;
  }

  const active = document.activeElement;
  if (event.shiftKey && (active === first || !detailSheet.value.contains(active))) {
    event.preventDefault();
    last.focus();
  } else if (!event.shiftKey && active === last) {
    event.preventDefault();
    first.focus();
  }
}

function onShopKeydown(event: KeyboardEvent): void {
  if (event.key === 'Escape' && !selectedId.value) {
    event.preventDefault();
    emit('close');
  }
}

function announce(message: string): void {
  toast.value = message;
  clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => (toast.value = ''), 2_500);
}

function buy(): void {
  if (!selected.value) return;
  const result = shop.purchase(selected.value.offer.id);
  if (!result.ok) {
    announce(reasonText(result.reason));
    return;
  }
  purchaseBurst.value += 1;
  announce(`${result.instance.locked ? '已锁定保护 · ' : ''}${selected.value.def.name} 已放入背包`);
}

function qualityClass(quality: Quality): string {
  return `quality-${quality}`;
}

watch(selectedId, async (offerId, previousOfferId) => {
  if (offerId) {
    await nextTick();
    detailCloseButton.value?.focus();
  } else if (previousOfferId) {
    await nextTick();
    detailReturnFocus?.focus();
    detailReturnFocus = null;
  }
});

onMounted(() => {
  window.addEventListener('keydown', onShopKeydown);
  backButton.value?.focus();
});

onUnmounted(() => {
  clearTimeout(toastTimer);
  window.removeEventListener('keydown', onShopKeydown);
});
</script>

<template>
  <div class="shop-view" role="region" aria-label="樱花珍品店">
    <header class="shop-top">
      <button ref="backButton" class="back" aria-label="返回更多" @click="$emit('close')">
        <ArrowLeft :size="18" aria-hidden="true" />
      </button>
      <span class="shop-title">
        <strong>樱花珍品店</strong>
        <small>装备靠打 · 金币保底收藏</small>
      </span>
      <span class="gold-pill"><Coins :size="14" />{{ abbr(shop.gold) }}</span>
    </header>

    <section class="shop-scene">
      <img :src="shopSceneUrl" alt="樱花珍品店内景，左右是华丽装备货架，中央展示洛丽塔裙装" />
      <span class="scene-shade" />
      <span class="shopkeeper-copy">
        <small>店主 · 樱桃</small>
        <strong>欢迎试穿，喜欢再带走～</strong>
        <span>已收藏 {{ shop.purchasedCount }}/24 件本职业珍品</span>
      </span>
    </section>

    <nav class="shop-filters scroll-x" aria-label="商品分类">
      <button
        v-for="filter in filters"
        :key="filter.id"
        :class="{ active: activeFilter === filter.id }"
        :aria-pressed="activeFilter === filter.id"
        @click="activeFilter = filter.id"
      >
        {{ filter.label }}
      </button>
    </nav>

    <section class="shelf scroll-y">
      <button
        v-for="entry in visibleOffers"
        :key="entry.offer.id"
        class="offer-card"
        :class="[qualityClass(entry.def.quality), { sold: !entry.assessment.ok }]"
        @click="openDetail(entry.offer.id, $event)"
      >
        <span class="offer-spark" aria-hidden="true">✦</span>
        <EquipmentIcon :def="entry.def" size="md" decorative />
        <span class="offer-copy">
          <small>{{ entry.theme.shortName }}珍品 · {{ SLOT_LABELS[entry.def.slot] }}</small>
          <strong :class="`q-${entry.def.quality}`">{{ entry.def.name }}</strong>
          <span class="price"><Coins :size="11" />{{ abbr(entry.offer.price) }}</span>
          <em :class="{ ready: entry.assessment.ok }">{{ assessmentText(entry) }}</em>
        </span>
      </button>
    </section>

    <Transition name="sheet">
      <div v-if="selected" class="detail-overlay" @click.self="closeDetail">
        <section
          ref="detailSheet"
          class="detail-sheet"
          :class="qualityClass(selected.def.quality)"
          role="dialog"
          aria-modal="true"
          aria-labelledby="shop-detail-title"
          @keydown="onDetailKeydown"
        >
          <button
            ref="detailCloseButton"
            class="close"
            aria-label="关闭商品详情"
            @click="closeDetail"
          >
            <X :size="18" />
          </button>

          <div class="try-on">
            <span class="try-glow" />
            <CharacterAppearance
              v-if="player.player"
              :key="`${selected.offer.id}:${purchaseBurst}`"
              :class-id="player.player.classId"
              :level="player.player.level"
              :equipped="previewEquipped"
              action="react"
              variant="showcase"
            />
            <span class="try-label">试穿预览 · 不会自动替换当前装备</span>
          </div>

          <div class="detail-copy scroll-y">
            <span class="series">{{ selected.theme.name }}</span>
            <h2 id="shop-detail-title" :class="`q-${selected.def.quality}`">
              {{ selected.def.name }}
            </h2>
            <p class="meta">
              {{ QUALITY_LABELS[selected.def.quality] }} · {{ SLOT_LABELS[selected.def.slot] }} ·
              Lv{{ selected.def.level }}
            </p>
            <div class="power-delta" :class="{ down: previewDelta < 0 }">
              <span>替换当前部位后的战力变化</span>
              <strong class="num">{{ signed(previewDelta) }}</strong>
            </div>
            <div class="effect-copy">
              <Sparkles :size="16" aria-hidden="true" />
              <span>
                <strong>专属视觉</strong>
                {{ selected.def.uniqueEffect }}
              </span>
            </div>
            <p class="honest-note">
              固定高档属性已真实生效；这里标注的是外观与攻击演出换肤，不冒充尚未接入的技能机制。
            </p>
          </div>

          <footer class="buy-bar">
            <span>
              <small>一次性珍品价</small>
              <strong><Coins :size="14" />{{ selected.offer.price.toLocaleString() }}</strong>
            </span>
            <button class="buy-button" :disabled="!selected.assessment.ok" @click="buy">
              <LockKeyhole v-if="!selected.assessment.ok" :size="15" />
              {{ selected.assessment.ok ? '购买并锁定' : assessmentText(selected) }}
            </button>
          </footer>
        </section>
      </div>
    </Transition>

    <Transition name="toast">
      <div v-if="toast" class="shop-toast" role="status">{{ toast }}</div>
    </Transition>
  </div>
</template>

<style scoped>
.shop-view {
  position: absolute;
  z-index: 30;
  inset: 0;
  display: flex;
  flex-direction: column;
  min-height: 0;
  color: var(--text);
  background: linear-gradient(#fff7fb, #eef6ff);
}

.shop-top {
  min-height: 56px;
  display: grid;
  grid-template-columns: 44px minmax(0, 1fr) auto;
  align-items: center;
  gap: 7px;
  padding: 5px 9px;
  background: rgb(255 255 255 / 92%);
  border-bottom: 1px solid var(--line);
}

.back {
  width: 44px;
  height: 44px;
  display: grid;
  place-items: center;
  color: var(--text-mid);
  background: var(--panel-2);
  border-radius: 13px;
}

.shop-title {
  min-width: 0;
  display: flex;
  flex-direction: column;
}

.shop-title strong {
  font-size: 15px;
}

.shop-title small {
  font-size: 8px;
  color: var(--text-dim);
}

.gold-pill {
  min-height: 36px;
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 0 9px;
  font-size: 11px;
  font-weight: 800;
  color: #8d651c;
  background: #fff5ce;
  border: 1px solid #f1d68e;
  border-radius: 999px;
}

.shop-scene {
  position: relative;
  flex: 0 0 150px;
  overflow: hidden;
}

.shop-scene > img,
.scene-shade {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
}

.shop-scene > img {
  object-fit: cover;
  object-position: center 56%;
}

.scene-shade {
  background: linear-gradient(90deg, rgb(48 38 57 / 64%), transparent 72%);
}

.shopkeeper-copy {
  position: absolute;
  z-index: 1;
  left: 13px;
  bottom: 12px;
  max-width: 230px;
  display: flex;
  flex-direction: column;
  gap: 2px;
  color: #fff;
  text-shadow: 0 1px 5px rgb(38 28 47 / 72%);
}

.shopkeeper-copy small,
.shopkeeper-copy span {
  font-size: 8px;
}

.shopkeeper-copy strong {
  font-size: 13px;
}

.shop-filters {
  flex: 0 0 auto;
  display: flex;
  gap: 5px;
  padding: 7px 8px;
  background: rgb(255 255 255 / 86%);
  border-bottom: 1px solid var(--line);
}

.shop-filters button {
  flex: 0 0 auto;
  min-height: 44px;
  padding: 0 12px;
  font-size: 9px;
  color: var(--text-mid);
  background: var(--panel-2);
  border: 1px solid var(--line);
  border-radius: 999px;
}

.shop-filters button.active {
  color: #fff;
  background: linear-gradient(135deg, #f47ca9, #8c83db);
  border-color: transparent;
}

.shelf {
  flex: 1;
  min-height: 0;
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  align-content: start;
  gap: 7px;
  padding: 8px 8px calc(12px + var(--sab));
}

.offer-card {
  position: relative;
  min-width: 0;
  min-height: 116px;
  display: grid;
  grid-template-columns: 58px minmax(0, 1fr);
  align-items: center;
  gap: 8px;
  padding: 8px;
  text-align: left;
  background: rgb(255 255 255 / 91%);
  border: 1px solid var(--line);
  border-radius: 14px;
  box-shadow: 0 5px 13px rgb(70 71 102 / 9%);
}

.offer-card :deep(.equipment-icon) {
  width: 58px;
  height: 58px;
  border-radius: 16px;
}

.offer-card.quality-epic {
  border-color: #d6b5ef;
}

.offer-card.quality-legendary {
  border-color: #efce81;
  background: linear-gradient(145deg, #fffdf7, #fff6df);
}

.offer-card.quality-mythic {
  border-color: #e8a4b4;
  background: linear-gradient(145deg, #fffafa, #fff0f3);
}

.offer-card.sold {
  filter: saturate(0.78);
}

.offer-spark {
  position: absolute;
  top: 6px;
  right: 8px;
  font-size: 10px;
  color: #f1bb55;
}

.offer-copy {
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 3px;
}

.offer-copy small {
  overflow: hidden;
  font-size: 7px;
  color: var(--text-dim);
  text-overflow: ellipsis;
  white-space: nowrap;
}

.offer-copy strong {
  min-height: 29px;
  display: -webkit-box;
  overflow: hidden;
  font-size: 9.5px;
  line-height: 1.5;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
}

.price {
  display: flex;
  align-items: center;
  gap: 2px;
  font-size: 10px;
  font-weight: 800;
  color: #9a6b1c;
}

.offer-copy em {
  overflow: hidden;
  font-size: 7px;
  font-style: normal;
  color: var(--text-dim);
  text-overflow: ellipsis;
  white-space: nowrap;
}

.offer-copy em.ready {
  color: var(--success);
}

.detail-overlay {
  position: absolute;
  z-index: 40;
  inset: 0;
  display: flex;
  align-items: flex-end;
  background: rgb(36 34 52 / 48%);
  backdrop-filter: blur(2px);
}

.detail-sheet {
  position: relative;
  width: 100%;
  max-height: 84dvh;
  display: grid;
  grid-template-rows: 250px minmax(0, 1fr) auto;
  overflow: hidden;
  background: #fff;
  border-radius: 22px 22px 0 0;
  box-shadow: 0 -12px 32px rgb(28 28 46 / 24%);
}

.close {
  position: absolute;
  z-index: 5;
  top: 10px;
  right: 10px;
  width: 42px;
  height: 42px;
  display: grid;
  place-items: center;
  color: var(--text-mid);
  background: rgb(255 255 255 / 84%);
  border-radius: 50%;
  box-shadow: 0 3px 9px rgb(45 47 65 / 12%);
}

.try-on {
  position: relative;
  overflow: hidden;
  background:
    radial-gradient(circle at 50% 55%, rgb(255 255 255 / 96%), transparent 42%),
    linear-gradient(145deg, #ffeef6, #edf7ff 58%, #fff6dd);
}

.try-on :deep(.character-appearance) {
  position: absolute;
  inset: 5px 24px 0;
}

.try-glow {
  position: absolute;
  inset: 15% 24%;
  border: 1px dashed rgb(237 177 205 / 68%);
  border-radius: 50%;
  transform: rotate(12deg);
}

.try-label {
  position: absolute;
  z-index: 4;
  left: 50%;
  bottom: 8px;
  padding: 4px 9px;
  font-size: 7px;
  color: var(--text-mid);
  white-space: nowrap;
  background: rgb(255 255 255 / 83%);
  border-radius: 999px;
  transform: translateX(-50%);
}

.detail-copy {
  display: flex;
  flex-direction: column;
  gap: 7px;
  padding: 13px 15px;
}

.series {
  align-self: flex-start;
  padding: 3px 8px;
  font-size: 8px;
  color: #89557b;
  background: #fff0f7;
  border-radius: 999px;
}

.detail-copy h2 {
  margin: 0;
  font-size: 17px;
}

.meta,
.honest-note {
  margin: 0;
  font-size: 9px;
  line-height: 1.55;
  color: var(--text-dim);
}

.power-delta {
  display: flex;
  justify-content: space-between;
  padding: 8px 10px;
  font-size: 9px;
  color: #26764b;
  background: #ebfaf2;
  border-radius: 10px;
}

.power-delta.down {
  color: #9a3e4c;
  background: #fff0f2;
}

.effect-copy {
  display: flex;
  align-items: flex-start;
  gap: 7px;
  padding: 9px 10px;
  color: #84445f;
  background: linear-gradient(120deg, #fff0f6, #fff8df);
  border: 1px solid #f3d5c3;
  border-radius: 11px;
}

.effect-copy span {
  display: flex;
  flex-direction: column;
  gap: 2px;
  font-size: 9px;
  line-height: 1.5;
}

.buy-bar {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(160px, 1.6fr);
  align-items: center;
  gap: 9px;
  padding: 10px 14px calc(10px + var(--sab));
  background: #fff;
  border-top: 1px solid var(--line);
}

.buy-bar > span {
  display: flex;
  flex-direction: column;
}

.buy-bar small {
  font-size: 7px;
  color: var(--text-dim);
}

.buy-bar strong {
  display: flex;
  align-items: center;
  gap: 3px;
  font-size: 12px;
  color: #996b1e;
}

.buy-button {
  min-height: 48px;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 5px;
  padding: 0 12px;
  font-size: 10px;
  font-weight: 800;
  color: #fff;
  background: linear-gradient(135deg, #f179a7, #8b80d7);
  border-radius: 14px;
  box-shadow: 0 6px 14px rgb(140 83 139 / 23%);
}

.buy-button:disabled {
  color: var(--text-dim);
  background: #edf0f4;
  box-shadow: none;
}

.shop-toast {
  position: absolute;
  z-index: 60;
  left: 50%;
  bottom: calc(18px + var(--sab));
  max-width: calc(100% - 30px);
  padding: 9px 14px;
  font-size: 10px;
  color: #fff;
  text-align: center;
  background: rgb(49 57 78 / 94%);
  border-radius: 999px;
  box-shadow: 0 7px 18px rgb(33 39 54 / 24%);
  transform: translateX(-50%);
}

.sheet-enter-from .detail-sheet,
.sheet-leave-to .detail-sheet {
  transform: translateY(100%);
}

.sheet-enter-active .detail-sheet,
.sheet-leave-active .detail-sheet {
  transition: transform 0.24s ease;
}

.toast-enter-from,
.toast-leave-to {
  opacity: 0;
  transform: translate(-50%, 6px);
}

.toast-enter-active,
.toast-leave-active {
  transition: all 0.18s ease;
}

@media (prefers-reduced-motion: reduce) {
  .detail-sheet,
  .shop-toast {
    transition: none !important;
  }
}
</style>
