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
const goldBump = ref(false);
const backButton = ref<HTMLButtonElement | null>(null);
const detailSheet = ref<HTMLElement | null>(null);
const detailCloseButton = ref<HTMLButtonElement | null>(null);
let detailReturnFocus: HTMLElement | null = null;
let toastTimer = 0;
let bumpTimer = 0;
let bumpFrame = 0;
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

watch(
  () => shop.gold,
  (now, before) => {
    if (now <= before) return;
    goldBump.value = false;
    clearTimeout(bumpTimer);
    cancelAnimationFrame(bumpFrame);
    bumpFrame = requestAnimationFrame(() => {
      bumpFrame = 0;
      goldBump.value = true;
      bumpTimer = window.setTimeout(() => (goldBump.value = false), 420);
    });
  },
);

onMounted(() => {
  window.addEventListener('keydown', onShopKeydown);
  backButton.value?.focus();
});

onUnmounted(() => {
  clearTimeout(toastTimer);
  clearTimeout(bumpTimer);
  cancelAnimationFrame(bumpFrame);
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
      <span class="gold-pill" :class="{ bump: goldBump }">
        <Coins :size="14" />{{ abbr(shop.gold) }}
      </span>
    </header>

    <section class="shop-scene">
      <img :src="shopSceneUrl" alt="樱花珍品店内景，左右是华丽装备货架，中央展示洛丽塔裙装" />
      <span class="scene-shade" />
      <i class="scene-petal p1" aria-hidden="true" />
      <i class="scene-petal p2" aria-hidden="true" />
      <i class="scene-petal p3" aria-hidden="true" />
      <span class="shopkeeper-copy">
        <small>店主 · 樱桃</small>
        <strong>欢迎试穿，喜欢再带走～</strong>
        <span>已收藏 {{ shop.purchasedCount }}/{{ shop.offers.length }} 件本职业珍品</span>
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
        v-for="(entry, i) in visibleOffers"
        :key="entry.offer.id"
        class="offer-card"
        :class="[qualityClass(entry.def.quality), { sold: !entry.assessment.ok }]"
        :style="{ '--row-delay': `${Math.min(i, 11) * 30}ms` }"
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
  background: var(--glass-bg-strong);
  border-bottom: 1px solid var(--hairline);
  backdrop-filter: var(--blur-glass);
  -webkit-backdrop-filter: var(--blur-glass);
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
  padding: 0 10px;
  font-size: 11px;
  font-weight: 800;
  letter-spacing: 0.01em;
  color: #8d651c;
  background: linear-gradient(180deg, #fffaf0, #fff3c8);
  border: 1px solid rgb(214 173 78 / 38%);
  border-radius: 999px;
  box-shadow:
    inset 0 1px 0 rgb(255 255 255 / 90%),
    0 3px 8px rgb(196 152 60 / 16%);
}

.gold-pill.bump {
  animation: pill-bump 0.4s var(--ease-out-back);
}

@keyframes pill-bump {
  0% {
    transform: scale(1);
  }
  45% {
    transform: scale(1.1);
  }
  100% {
    transform: scale(1);
  }
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

.scene-petal {
  position: absolute;
  z-index: 1;
  top: -12px;
  width: 7px;
  height: 9px;
  opacity: 0;
  background: linear-gradient(160deg, #ffd9e8, #ffabc9);
  border-radius: 78% 22% 68% 32%;
  pointer-events: none;
  animation: scene-petal-fall 8s linear infinite;
}

.scene-petal.p1 {
  left: 46%;
  --petal-scale: 1;
  animation-delay: -1.8s;
}

.scene-petal.p2 {
  left: 68%;
  --petal-scale: 0.8;
  animation-delay: -5.1s;
}

.scene-petal.p3 {
  left: 88%;
  --petal-scale: 0.64;
  animation-delay: -7s;
}

@keyframes scene-petal-fall {
  0% {
    opacity: 0;
    transform: translate3d(0, 0, 0) rotate(0) scale(var(--petal-scale));
  }
  16%,
  80% {
    opacity: 0.9;
  }
  100% {
    opacity: 0;
    transform: translate3d(30px, 168px, 0) rotate(320deg) scale(var(--petal-scale));
  }
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
  gap: 3px;
  overflow-x: auto;
  margin: 8px 9px 0;
  padding: 3px;
  background: rgb(233 240 248 / 72%);
  border: 1px solid var(--hairline);
  border-radius: 999px;
  box-shadow: inset 0 1px 3px rgb(70 89 107 / 7%);
  scrollbar-width: none;
  scroll-padding-inline: 3px;
  scroll-snap-type: x proximity;
  overscroll-behavior-x: contain;
  -webkit-overflow-scrolling: touch;
}

.shop-filters::-webkit-scrollbar {
  display: none;
}

.shop-filters button {
  flex: 0 0 auto;
  min-height: 44px;
  padding: 0 13px;
  font-size: 9px;
  font-weight: 600;
  color: var(--text-mid);
  background: transparent;
  border: none;
  border-radius: 999px;
  scroll-snap-align: center;
  transition:
    color var(--t-fast) var(--ease-soft),
    background var(--t-fast) var(--ease-soft),
    box-shadow var(--t-fast) var(--ease-soft),
    transform var(--t-fast) var(--ease-spring);
}

.shop-filters button:active {
  transform: scale(0.94);
}

.shop-filters button.active {
  font-weight: 800;
  color: var(--pink-deep);
  background: #fff;
  box-shadow:
    0 1px 2px rgb(70 89 107 / 8%),
    0 4px 10px rgb(150 110 140 / 14%);
  animation: seg-pop 0.34s var(--ease-out-back);
}

@keyframes seg-pop {
  0% {
    transform: scale(0.88);
  }
  100% {
    transform: scale(1);
  }
}

.shelf {
  flex: 1;
  min-height: 0;
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  align-content: start;
  gap: 9px;
  padding: 10px 9px calc(12px + var(--sab));
}

.offer-card {
  --tile-glow: rgb(154 168 181 / 16%);
  position: relative;
  min-width: 0;
  min-height: 116px;
  display: grid;
  grid-template-columns: 58px minmax(0, 1fr);
  align-items: center;
  gap: 8px;
  padding: 8px;
  text-align: left;
  background: rgb(255 255 255 / 94%);
  border: 1px solid var(--hairline);
  border-radius: 18px;
  overflow: hidden;
  box-shadow: var(--shadow-float);
  animation: tile-in 0.5s var(--ease-ios) both;
  animation-delay: var(--row-delay, 0ms);
  transition:
    transform var(--t-fast) var(--ease-spring),
    box-shadow var(--t-mid) var(--ease-soft);
}

@keyframes tile-in {
  0% {
    opacity: 0;
    transform: translateY(10px) scale(0.97);
  }
  100% {
    opacity: 1;
    transform: translateY(0) scale(1);
  }
}

/* 品质色台座柔光：商品像摆在 Apple 产品页的彩色展台上。 */
.offer-card::after {
  position: absolute;
  top: 50%;
  left: 8px;
  z-index: 0;
  width: 58px;
  height: 58px;
  content: '';
  background: radial-gradient(circle, var(--tile-glow), transparent 68%);
  border-radius: 50%;
  transform: translateY(-50%) scale(1.45);
  pointer-events: none;
}

@media (hover: hover) {
  .offer-card:hover {
    box-shadow:
      0 1px 2px rgb(70 89 107 / 6%),
      0 16px 36px rgb(96 118 150 / 18%),
      0 4px 10px rgb(122 165 200 / 10%);
    transform: translateY(-2px);
  }
}

.offer-card:active {
  transform: scale(0.965);
}

.offer-card::before {
  position: absolute;
  top: 0;
  right: 10px;
  left: 10px;
  height: 3px;
  content: '';
  background: var(--q-common);
  border-radius: 0 0 3px 3px;
  opacity: 0.55;
}

.offer-card.quality-epic::before {
  background: var(--q-epic);
}

.offer-card.quality-legendary::before {
  background: var(--q-legendary);
  opacity: 0.8;
}

.offer-card.quality-mythic::before {
  background: linear-gradient(90deg, var(--q-mythic), var(--q-legendary));
  opacity: 0.9;
}

.offer-card.quality-prismatic::before {
  background: var(--q-prismatic-gradient);
  background-size: 240% 100%;
  opacity: 0.95;
  animation: shop-prismatic-cycle 3.8s linear infinite;
}

.offer-card.quality-fine {
  --tile-glow: rgb(79 190 120 / 22%);
}

.offer-card.quality-rare {
  --tile-glow: rgb(63 163 232 / 24%);
}

.offer-card.quality-epic {
  --tile-glow: rgb(171 111 224 / 26%);
}

.offer-card.quality-legendary {
  --tile-glow: rgb(255 154 60 / 28%);
}

.offer-card.quality-mythic {
  --tile-glow: rgb(255 107 122 / 26%);
}

.offer-card.quality-prismatic {
  --tile-glow: rgb(199 91 219 / 28%);
}

.offer-card.quality-divine {
  --tile-glow: rgb(232 172 31 / 28%);
}

.offer-card :deep(.equipment-icon) {
  z-index: 1;
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

.offer-card.quality-prismatic {
  border-color: #d8a7e7;
  background: linear-gradient(145deg, #fffaff, #eef8ff 54%, #fff3fa);
}

@keyframes shop-prismatic-cycle {
  to {
    background-position: 240% 0;
  }
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
  animation: spark-twinkle 2.8s ease-in-out infinite;
}

@keyframes spark-twinkle {
  0%,
  100% {
    opacity: 0.45;
    transform: scale(0.86) rotate(0);
  }
  50% {
    opacity: 1;
    transform: scale(1.18) rotate(18deg);
  }
}

.offer-copy {
  position: relative;
  z-index: 1;
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
  font-weight: 800;
  letter-spacing: -0.01em;
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

.detail-sheet::before {
  position: absolute;
  z-index: 5;
  top: 0;
  right: 0;
  left: 0;
  height: 4px;
  content: '';
  background: linear-gradient(90deg, var(--pink), var(--gold), var(--blue));
  pointer-events: none;
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
  padding: 5px 10px;
  font-size: 7px;
  font-weight: 600;
  letter-spacing: 0.02em;
  color: var(--text-mid);
  white-space: nowrap;
  background: var(--glass-bg-strong);
  border: 1px solid var(--glass-brd);
  border-radius: 999px;
  box-shadow: 0 3px 8px rgb(70 89 107 / 10%);
  backdrop-filter: blur(8px) saturate(1.3);
  -webkit-backdrop-filter: blur(8px) saturate(1.3);
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
  padding: 4px 9px;
  font-size: 8px;
  font-weight: 800;
  letter-spacing: 0.06em;
  color: #b0567e;
  background: linear-gradient(120deg, #fff0f7, #ffe8f2);
  border: 1px solid rgb(240 158 192 / 30%);
  border-radius: 999px;
}

.detail-copy h2 {
  margin: 0;
  font-size: 21px;
  font-weight: 800;
  letter-spacing: -0.02em;
  line-height: 1.25;
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
  align-items: center;
  justify-content: space-between;
  padding: 9px 11px;
  font-size: 9px;
  color: #26764b;
  background: linear-gradient(120deg, #f0fbf5, #e6f8ef);
  border: 1px solid rgb(95 207 149 / 24%);
  border-radius: 12px;
  box-shadow: var(--shadow-ambient);
}

.power-delta .num {
  font-size: 13px;
  letter-spacing: -0.01em;
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
  background: var(--glass-bg-strong);
  border-top: 1px solid var(--hairline);
  backdrop-filter: var(--blur-glass);
  -webkit-backdrop-filter: var(--blur-glass);
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
  position: relative;
  min-height: 50px;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 5px;
  padding: 0 12px;
  overflow: hidden;
  font-size: 10px;
  font-weight: 800;
  letter-spacing: 0.02em;
  color: #fff;
  text-shadow: 0 1px 2px rgb(122 52 96 / 30%);
  background: linear-gradient(135deg, #f77fab 8%, #b07fd8 58%, #8b80d7);
  border-radius: 16px;
  box-shadow:
    inset 0 1px 0 rgb(255 255 255 / 32%),
    0 8px 20px rgb(188 106 168 / 34%),
    0 2px 6px rgb(140 83 139 / 20%);
  transition:
    transform var(--t-fast) var(--ease-spring),
    filter var(--t-mid) var(--ease-soft),
    box-shadow var(--t-mid) var(--ease-soft);
}

.buy-button:active:not(:disabled) {
  filter: brightness(1.06);
  transform: scale(0.96);
}

.buy-button:not(:disabled)::after {
  position: absolute;
  top: 0;
  bottom: 0;
  left: 0;
  width: 38%;
  content: '';
  background: linear-gradient(100deg, transparent, rgb(255 255 255 / 30%), transparent);
  pointer-events: none;
  animation: buy-shine 4.8s var(--ease-soft) infinite;
}

@keyframes buy-shine {
  0%,
  58% {
    transform: translate3d(-130%, 0, 0) skewX(-18deg);
  }
  82%,
  100% {
    transform: translate3d(410%, 0, 0) skewX(-18deg);
  }
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

  .offer-card,
  .offer-card.quality-prismatic::before,
  .offer-spark,
  .scene-petal,
  .buy-button,
  .buy-button::after,
  .gold-pill.bump,
  .shop-filters button,
  .shop-filters button.active {
    animation: none !important;
    transition: none !important;
  }
}
</style>
