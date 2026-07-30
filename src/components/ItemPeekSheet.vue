<script setup lang="ts">
import { nextTick, onMounted, onUnmounted, ref } from 'vue';
import { X } from '@lucide/vue';
import { createFocusTrap, type FocusTrap } from 'focus-trap';
import type { ItemDef } from '@/data/items';

/**
 * 非装备掉落的轻量速览弹层。
 *
 * 掉落面板的材料/消耗品/碎片/货币行点开后弹出：
 * 图标 + 描述 + 当前持有 + 出售单价 —— 「这是什么、有多少、值多少」
 * 一眼答完，不需要跳背包。装备行走的是 EquipDetail，不经过这里。
 */
const props = defineProps<{
  item: ItemDef;
  /** 背包当前持有数（掉落聚合数与背包数可能不同，展示背包数更有用） */
  owned: number;
}>();
const emit = defineEmits<{ close: [] }>();

const kindLabels: Readonly<Record<ItemDef['kind'], string>> = {
  material: '材料',
  consumable: '消耗品',
  fragment: '碎片',
  currency: '货币',
};

const sheetRef = ref<HTMLElement | null>(null);
const closeButtonRef = ref<HTMLButtonElement | null>(null);
let dialogFocusTrap: FocusTrap | null = null;

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

onUnmounted(() => {
  if (dialogFocusTrap?.active) {
    dialogFocusTrap.deactivate({
      returnFocus: true,
      onDeactivate: () => undefined,
    });
  }
  dialogFocusTrap = null;
});

function requestClose(): void {
  if (dialogFocusTrap?.active) {
    dialogFocusTrap.deactivate();
    return;
  }
  emit('close');
}

function assetUrl(path: string): string {
  return `${import.meta.env.BASE_URL}${path}`;
}
</script>

<template>
  <Teleport to="body">
    <div class="peek-overlay">
      <section
        ref="sheetRef"
        class="peek-sheet"
        role="dialog"
        aria-modal="true"
        :aria-label="`${item.name}详情`"
        :class="'q-' + item.tier"
        tabindex="-1"
      >
        <span class="peek-glow" aria-hidden="true" />
        <header class="peek-head">
          <span class="peek-icon" :class="'q-' + item.tier">
            <img :src="assetUrl(item.icon)" :alt="item.name" draggable="false" />
          </span>
          <span class="peek-title">
            <small>{{ kindLabels[item.kind] }} · 掉落速览</small>
            <strong :class="'q-' + item.tier">{{ item.name }}</strong>
          </span>
          <button
            ref="closeButtonRef"
            type="button"
            class="peek-close"
            aria-label="关闭"
            @click="requestClose"
          >
            <X :size="17" />
          </button>
        </header>

        <p class="peek-desc">{{ item.desc }}</p>

        <dl class="peek-facts">
          <div>
            <dt>当前持有</dt>
            <dd class="num">×{{ props.owned }}</dd>
          </div>
          <div>
            <dt>出售单价</dt>
            <dd class="num">{{ item.sellPrice > 0 ? `${item.sellPrice} 金币` : '不可出售' }}</dd>
          </div>
        </dl>
      </section>
    </div>
  </Teleport>
</template>

<style scoped>
.peek-overlay {
  position: fixed;
  z-index: 90;
  inset: 0;
  display: flex;
  align-items: flex-end;
  justify-content: center;
  padding: 16px 16px max(20px, env(safe-area-inset-bottom));
  background: rgb(70 89 107 / 35%);
  backdrop-filter: blur(3px);
  animation: peek-fade var(--t-mid) ease both;
}

.peek-sheet {
  position: relative;
  overflow: hidden;
  width: 100%;
  max-width: 400px;
  padding: 14px 14px 12px;
  background: rgb(255 255 255 / 94%);
  border: 1px solid rgb(255 255 255 / 88%);
  border-radius: 20px;
  box-shadow:
    0 18px 44px rgb(53 69 91 / 24%),
    0 2px 8px rgb(53 69 91 / 10%);
  backdrop-filter: blur(16px) saturate(1.4);
  -webkit-backdrop-filter: blur(16px) saturate(1.4);
  animation: peek-rise var(--t-slow) var(--ease-out-back) both;
}

/* 品质色柔光从图标位晕开，史诗以上尤其明显 */
.peek-glow {
  position: absolute;
  top: -46px;
  left: -30px;
  width: 170px;
  height: 170px;
  background: radial-gradient(circle, currentcolor 0%, transparent 68%);
  opacity: 0.14;
  pointer-events: none;
}

.peek-head {
  position: relative;
  display: flex;
  align-items: center;
  gap: 10px;
}

.peek-icon {
  display: grid;
  width: 46px;
  height: 46px;
  flex-shrink: 0;
  place-items: center;
  background: linear-gradient(145deg, rgb(255 255 255 / 95%), rgb(243 249 255 / 80%));
  border: 1px solid currentcolor;
  border-radius: 14px;
  box-shadow: 0 4px 12px rgb(53 69 91 / 12%);
}

.peek-icon img {
  width: 32px;
  height: 32px;
  object-fit: contain;
  filter: drop-shadow(0 2px 3px rgb(24 38 52 / 20%));
}

.peek-title {
  display: flex;
  min-width: 0;
  flex: 1;
  flex-direction: column;
  gap: 1px;
}

.peek-title small {
  font-size: 9px;
  color: var(--text-dim);
}

.peek-title strong {
  overflow: hidden;
  font-size: 15px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.peek-close {
  display: grid;
  width: 30px;
  height: 30px;
  flex-shrink: 0;
  place-items: center;
  color: var(--text-mid);
  background: var(--panel-3);
  border-radius: 50%;
}

.peek-desc {
  position: relative;
  margin-top: 10px;
  font-size: 12px;
  line-height: 1.65;
  color: var(--text-mid);
}

.peek-facts {
  position: relative;
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 6px;
  margin-top: 10px;
}

.peek-facts > div {
  padding: 7px 10px;
  background: var(--panel-2);
  border: 1px solid var(--hairline);
  border-radius: 12px;
}

.peek-facts dt {
  font-size: 9px;
  color: var(--text-dim);
}

.peek-facts dd {
  margin-top: 1px;
  font-size: 12px;
  font-weight: 800;
  color: var(--text);
}

/* 内容错峰入场：头部→描述→数据依次浮起，速览也有仪式感 */
.peek-head,
.peek-desc,
.peek-facts {
  animation: peek-content-rise 0.34s var(--ease-soft) both;
}

.peek-desc {
  animation-delay: 45ms;
}

.peek-facts {
  animation-delay: 90ms;
}

@keyframes peek-content-rise {
  from {
    opacity: 0;
    transform: translateY(9px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

@keyframes peek-fade {
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
  }
}

@keyframes peek-rise {
  from {
    opacity: 0;
    transform: translateY(26px) scale(0.95);
  }
  to {
    opacity: 1;
    transform: translateY(0) scale(1);
  }
}

@media (prefers-reduced-motion: reduce) {
  .peek-overlay,
  .peek-sheet,
  .peek-head,
  .peek-desc,
  .peek-facts {
    animation: none;
  }
}
</style>
