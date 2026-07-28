<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import {
  Check,
  ChevronRight,
  Gem,
  Heart,
  LockKeyhole,
  Shirt,
  Sparkles,
} from '@lucide/vue';

interface AffectionEquipmentViewModel {
  id: string;
  name: string;
  slotLabel: string;
  iconAsset: string;
  owned: boolean;
  equipped?: boolean;
  eligible?: boolean;
  requiredPoints?: number;
  effectText: string;
  flavorText?: string;
  setNodeText?: string;
}

const props = withDefaults(
  defineProps<{
    items: readonly AffectionEquipmentViewModel[];
    characterName: string;
    selectedId?: string | null;
    title?: string;
    dropHint?: string;
    pityHint?: string;
    accent?: string;
    glow?: string;
    busy?: boolean;
    showClose?: boolean;
  }>(),
  {
    selectedId: null,
    title: '心虹珍藏',
    dropHint: '每日有效互动均有机会获得，未收集款式优先',
    pityHint: '连续未掉落会逐步提升概率，并设有必得次数',
    accent: '#ff7fa6',
    glow: '#ffd6e4',
    busy: false,
    showClose: false,
  },
);

const emit = defineEmits<{
  select: [equipmentId: string];
  close: [];
}>();

const localSelectedId = ref<string | null>(props.selectedId);

const galleryStyle = computed(() => ({
  '--gallery-accent': props.accent,
  '--gallery-glow': props.glow,
}));
const ownedCount = computed(() => props.items.filter((item) => item.owned).length);
const collectionRatio = computed(() =>
  props.items.length > 0 ? ownedCount.value / props.items.length : 0,
);
const selectedItem = computed(
  () =>
    props.items.find((item) => item.id === localSelectedId.value) ??
    props.items.find((item) => item.owned) ??
    props.items[0] ??
    null,
);

watch(
  () => props.selectedId,
  (value) => {
    localSelectedId.value = value;
  },
);
watch(
  () => props.items,
  (items) => {
    if (!items.some((item) => item.id === localSelectedId.value)) {
      localSelectedId.value = items.find((item) => item.owned)?.id ?? items[0]?.id ?? null;
    }
  },
);

function selectItem(item: AffectionEquipmentViewModel): void {
  if (props.busy) return;
  localSelectedId.value = item.id;
  emit('select', item.id);
}

function iconUrl(item: AffectionEquipmentViewModel): string {
  return `${import.meta.env.BASE_URL}${item.iconAsset}`;
}
</script>

<template>
  <section
    class="equipment-gallery"
    :style="galleryStyle"
    :aria-label="`${characterName}的${title}`"
  >
    <header class="gallery-head">
      <span class="gallery-seal" aria-hidden="true">
        <Gem :size="22" />
      </span>
      <span class="gallery-title">
        <small>HEART-RAINBOW COLLECTION</small>
        <strong>{{ characterName }} · {{ title }}</strong>
      </span>
      <button
        v-if="showClose"
        type="button"
        class="close-button"
        aria-label="关闭心虹装备收藏"
        @click="emit('close')"
      >
        ×
      </button>
      <span v-else class="collection-count">{{ ownedCount }} / {{ items.length }}</span>
    </header>

    <div class="collection-progress">
      <div
        class="collection-track"
        role="progressbar"
        :aria-valuenow="ownedCount"
        aria-valuemin="0"
        :aria-valuemax="items.length"
        :aria-label="`已收集 ${ownedCount} 件，共 ${items.length} 件`"
      >
        <span :style="{ width: `${collectionRatio * 100}%` }" />
      </div>
      <p>
        <Sparkles :size="13" aria-hidden="true" />
        收集进度 {{ Math.round(collectionRatio * 100) }}%
      </p>
    </div>

    <div class="drop-rules">
      <span>
        <Heart :size="14" fill="currentColor" aria-hidden="true" />
        {{ dropHint }}
      </span>
      <span>
        <Sparkles :size="14" aria-hidden="true" />
        {{ pityHint }}
      </span>
    </div>

    <div v-if="items.length > 0" class="equipment-grid" aria-label="专属装备收藏列表">
      <button
        v-for="item in items"
        :key="item.id"
        type="button"
        class="equipment-card"
        :class="{
          owned: item.owned,
          missing: !item.owned,
          equipped: item.equipped,
          selected: selectedItem?.id === item.id,
        }"
        :aria-pressed="selectedItem?.id === item.id"
        :aria-label="`${item.name}，${item.owned ? '图鉴已点亮' : '尚未收集'}${item.equipped ? '，当前仍持有并已装备' : ''}`"
        :disabled="busy"
        @click="selectItem(item)"
      >
        <span class="rainbow-frame">
          <span class="rainbow-shine" aria-hidden="true" />
          <img
            :src="iconUrl(item)"
            alt=""
            draggable="false"
            decoding="async"
            :class="{ silhouette: !item.owned }"
          />
          <span v-if="!item.owned" class="missing-lock" aria-hidden="true">
            <LockKeyhole :size="15" />
          </span>
          <span v-if="item.equipped" class="equipped-mark" aria-hidden="true">
            <Check :size="12" :stroke-width="3" />
          </span>
        </span>
        <span class="equipment-name">{{ item.owned ? item.name : '未收集珍藏' }}</span>
        <small>{{ item.slotLabel }}</small>
      </button>
    </div>

    <div v-else class="empty-gallery">
      <Shirt :size="30" aria-hidden="true" />
      <strong>专属珍藏正在整理中</strong>
      <span>装备数据接入后，会在这里显示每一件心虹装备。</span>
    </div>

    <article v-if="selectedItem" class="equipment-detail" aria-live="polite">
      <div
        class="detail-icon rainbow-frame"
        :class="{ missing: !selectedItem.owned }"
        aria-hidden="true"
      >
        <span class="rainbow-shine" />
        <img
          :src="iconUrl(selectedItem)"
          alt=""
          draggable="false"
          decoding="async"
          :class="{ silhouette: !selectedItem.owned }"
        />
      </div>

      <div class="detail-copy">
        <span class="detail-tags">
          <em>动态心虹品质</em>
          <em>{{ selectedItem.slotLabel }}</em>
          <em v-if="selectedItem.equipped">穿戴中</em>
        </span>
        <strong>{{ selectedItem.owned ? selectedItem.name : '尚未邂逅的专属珍藏' }}</strong>
        <p v-if="selectedItem.owned">{{ selectedItem.effectText }}</p>
        <p v-else>
          {{
            selectedItem.eligible === false
              ? `好感达到 ${selectedItem.requiredPoints ?? 0} 心意后，才会加入互动掉落。`
              : '继续与她相处，这件装备有机会从有效互动中出现。'
          }}
        </p>
        <small v-if="selectedItem.flavorText && selectedItem.owned">
          “{{ selectedItem.flavorText }}”
        </small>
        <span v-if="selectedItem.setNodeText" class="set-node">
          <Sparkles :size="13" aria-hidden="true" />
          {{ selectedItem.setNodeText }}
        </span>
      </div>
    </article>

    <footer class="gallery-foot">
      <span>
        <LockKeyhole :size="13" aria-hidden="true" />
        首次获得自动锁定，不会被批量分解
      </span>
      <span>
        <ChevronRight :size="13" aria-hidden="true" />
        点击任意装备查看专属效果
      </span>
    </footer>
  </section>
</template>

<style scoped>
.equipment-gallery {
  --gallery-accent: #ff7fa6;
  --gallery-glow: #ffd6e4;
  position: relative;
  overflow: hidden;
  padding: 13px;
  background:
    radial-gradient(circle at 100% 0%, color-mix(in srgb, var(--gallery-glow) 62%, transparent), transparent 31%),
    linear-gradient(155deg, rgb(255 255 255 / 96%), rgb(255 248 252 / 96%) 58%, rgb(237 248 255 / 96%));
  border: 1px solid rgb(255 255 255 / 92%);
  border-radius: 22px;
  box-shadow:
    0 12px 26px rgb(65 59 84 / 12%),
    inset 0 1px rgb(255 255 255 / 88%);
}

.equipment-gallery::before {
  position: absolute;
  top: 0;
  right: 0;
  left: 0;
  height: 4px;
  content: '';
  background: linear-gradient(90deg, #ff78a9, #ffd566, #68d4cf, #789ee9, #b17add, #ff78a9);
  background-size: 220% 100%;
  animation: rainbow-drift 5s linear infinite;
}

.gallery-head {
  min-height: 48px;
  display: grid;
  grid-template-columns: 42px minmax(0, 1fr) auto;
  align-items: center;
  gap: 9px;
}

.gallery-seal {
  display: grid;
  width: 42px;
  height: 42px;
  place-items: center;
  color: #fff;
  background: linear-gradient(145deg, #ff83af, #f1b75f 43%, #72c9c8 68%, #9a7ddf);
  border: 2px solid #fff;
  border-radius: 14px;
  box-shadow: 0 5px 13px rgb(122 81 141 / 23%);
}

.gallery-title {
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.gallery-title small {
  overflow: hidden;
  font-size: 7px;
  font-weight: 900;
  letter-spacing: 0.1em;
  color: var(--gallery-accent);
  text-overflow: ellipsis;
  white-space: nowrap;
}

.gallery-title strong {
  overflow: hidden;
  font-size: 14px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.collection-count {
  padding: 5px 8px;
  font-size: 9px;
  font-weight: 900;
  color: #765d72;
  background: rgb(255 255 255 / 82%);
  border: 1px solid var(--line);
  border-radius: 999px;
}

.close-button {
  width: 44px;
  height: 44px;
  display: grid;
  place-items: center;
  font-size: 22px;
  color: var(--text-mid);
  background: var(--panel-3);
  border: 1px solid var(--line);
  border-radius: 50%;
}

.collection-progress {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  align-items: center;
  gap: 8px;
  margin-top: 10px;
}

.collection-track {
  height: 8px;
  overflow: hidden;
  background: #edf1f5;
  border-radius: 999px;
}

.collection-track span {
  display: block;
  height: 100%;
  background: linear-gradient(90deg, #ff7eab, #ffcf68, #68d4cb, #8297ec, #b47edb);
  background-size: 220% 100%;
  border-radius: inherit;
  box-shadow: 0 0 9px var(--gallery-glow);
  animation: rainbow-drift 4s linear infinite;
  transition: width 0.4s var(--ease-soft);
}

.collection-progress p {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 8px;
  font-weight: 800;
  color: #765d72;
}

.drop-rules {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 6px;
  margin-top: 9px;
}

.drop-rules span {
  min-height: 42px;
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 7px 8px;
  font-size: 7px;
  line-height: 1.45;
  color: var(--text-mid);
  background: rgb(255 255 255 / 72%);
  border: 1px solid var(--line);
  border-radius: 11px;
}

.drop-rules svg {
  flex: 0 0 auto;
  color: var(--gallery-accent);
}

.equipment-grid {
  display: grid;
  grid-template-columns: repeat(5, minmax(0, 1fr));
  gap: 7px;
  margin-top: 11px;
}

.equipment-card {
  min-width: 0;
  min-height: 83px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 3px;
  padding: 5px 3px;
  color: var(--text-mid);
  background: rgb(255 255 255 / 68%);
  border: 1px solid transparent;
  border-radius: 12px;
  transition:
    transform var(--t-fast) var(--ease-spring),
    border-color var(--t-fast) var(--ease-soft),
    background-color var(--t-fast) var(--ease-soft);
}

.equipment-card:not(:disabled):active {
  transform: scale(0.95);
}

.equipment-card.selected {
  background: rgb(255 255 255 / 96%);
  border-color: var(--gallery-accent);
  box-shadow: 0 0 0 2px color-mix(in srgb, var(--gallery-accent) 12%, transparent);
}

.equipment-card.missing {
  opacity: 0.7;
}

.rainbow-frame {
  position: relative;
  width: 48px;
  height: 48px;
  display: grid;
  place-items: center;
  overflow: hidden;
  isolation: isolate;
  background:
    linear-gradient(#fff, #f4f7fa) padding-box,
    linear-gradient(135deg, #ff6fa4, #ffd15e, #62d6c6, #748feb, #b26fd8, #ff6fa4) border-box;
  border: 2px solid transparent;
  border-radius: 14px;
  box-shadow:
    0 0 9px rgb(255 115 166 / 20%),
    0 0 15px rgb(105 204 214 / 12%);
}

.rainbow-frame::after {
  position: absolute;
  inset: -55%;
  z-index: -1;
  content: '';
  background: conic-gradient(#ff72a7, #ffd45f, #62d5ca, #718fe7, #b174db, #ff72a7);
  animation: rainbow-spin 4s linear infinite;
}

.rainbow-frame::before {
  position: absolute;
  z-index: 0;
  inset: 2px;
  content: '';
  background:
    radial-gradient(circle at 32% 20%, #fff, transparent 46%),
    linear-gradient(145deg, #fff, #eff4f8);
  border-radius: 10px;
}

.rainbow-frame img {
  position: relative;
  z-index: 1;
  width: 90%;
  height: 90%;
  object-fit: contain;
  filter: drop-shadow(0 2px 2px rgb(48 52 70 / 18%));
}

.rainbow-frame img.silhouette {
  opacity: 0.25;
  filter: grayscale(1) brightness(0.7);
}

.rainbow-shine {
  position: absolute;
  z-index: 2;
  top: -35%;
  left: -55%;
  width: 35%;
  height: 165%;
  background: linear-gradient(90deg, transparent, rgb(255 255 255 / 78%), transparent);
  transform: rotate(22deg);
  animation: shine-pass 3.5s ease-in-out infinite;
  pointer-events: none;
}

.missing-lock,
.equipped-mark {
  position: absolute;
  z-index: 3;
  display: grid;
  place-items: center;
  color: #fff;
  border: 1px solid rgb(255 255 255 / 72%);
  border-radius: 50%;
}

.missing-lock {
  width: 25px;
  height: 25px;
  background: rgb(78 82 99 / 72%);
}

.equipped-mark {
  right: 1px;
  bottom: 1px;
  width: 18px;
  height: 18px;
  background: #57b894;
}

.equipment-name {
  width: 100%;
  overflow: hidden;
  font-size: 7px;
  font-weight: 800;
  text-align: center;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.equipment-card small {
  font-size: 6px;
  color: var(--text-dim);
}

.empty-gallery {
  min-height: 146px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 5px;
  margin-top: 11px;
  color: var(--text-dim);
  background: rgb(255 255 255 / 62%);
  border: 1px dashed var(--line);
  border-radius: 15px;
}

.empty-gallery strong {
  font-size: 11px;
}

.empty-gallery span {
  max-width: 230px;
  font-size: 8px;
  line-height: 1.5;
  text-align: center;
}

.equipment-detail {
  display: grid;
  grid-template-columns: 68px minmax(0, 1fr);
  align-items: center;
  gap: 10px;
  min-height: 112px;
  padding: 11px;
  margin-top: 11px;
  background: rgb(255 255 255 / 85%);
  border: 1px solid color-mix(in srgb, var(--gallery-accent) 20%, var(--line));
  border-radius: 16px;
  box-shadow: 0 5px 13px rgb(73 64 88 / 8%);
}

.detail-icon {
  width: 68px;
  height: 68px;
  border-width: 3px;
  border-radius: 19px;
}

.detail-icon::before {
  border-radius: 14px;
}

.detail-icon.missing {
  opacity: 0.55;
}

.detail-copy {
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.detail-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 3px;
}

.detail-tags em {
  padding: 2px 5px;
  font-size: 6px;
  font-style: normal;
  font-weight: 800;
  color: #765478;
  background: linear-gradient(120deg, #fff0f7, #fff8db, #eaf7ff);
  border-radius: 999px;
}

.detail-copy > strong {
  overflow: hidden;
  font-size: 12px;
  color: #674e63;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.detail-copy p {
  font-size: 8px;
  line-height: 1.55;
  color: var(--text-mid);
}

.detail-copy > small {
  font-size: 7px;
  line-height: 1.45;
  color: var(--gallery-accent);
}

.set-node {
  display: flex;
  align-items: flex-start;
  gap: 4px;
  padding: 5px 6px;
  font-size: 7px;
  line-height: 1.4;
  color: #705878;
  background: #f8f1fb;
  border-radius: 8px;
}

.set-node svg {
  flex: 0 0 auto;
}

.gallery-foot {
  display: flex;
  flex-wrap: wrap;
  justify-content: space-between;
  gap: 6px;
  padding-top: 10px;
  margin-top: 10px;
  border-top: 1px solid var(--line);
}

.gallery-foot span {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 7px;
  color: var(--text-dim);
}

.gallery-foot svg {
  color: var(--gallery-accent);
}

@keyframes rainbow-drift {
  to {
    background-position: 220% 0;
  }
}

@keyframes rainbow-spin {
  to {
    transform: rotate(1turn);
  }
}

@keyframes shine-pass {
  0%,
  35% {
    transform: translateX(0) rotate(22deg);
  }
  75%,
  100% {
    transform: translateX(340%) rotate(22deg);
  }
}

@media (max-width: 350px) {
  .equipment-gallery {
    padding-right: 10px;
    padding-left: 10px;
  }

  .equipment-grid {
    grid-template-columns: repeat(4, minmax(0, 1fr));
  }

  .drop-rules {
    grid-template-columns: 1fr;
  }
}

@media (prefers-reduced-motion: reduce) {
  .equipment-gallery::before,
  .collection-track span,
  .rainbow-frame::after,
  .rainbow-shine {
    animation: none;
  }

  .collection-track span,
  .equipment-card {
    transition: none;
  }
}
</style>
