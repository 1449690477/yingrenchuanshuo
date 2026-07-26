<script setup lang="ts">
import { computed } from 'vue';
import type { ItemDef } from '@/data/items';

const props = withDefaults(
  defineProps<{
    item: ItemDef;
    size?: 'sm' | 'md';
  }>(),
  {
    size: 'sm',
  },
);

const iconUrl = computed(() => `${import.meta.env.BASE_URL}${props.item.icon}`);
</script>

<template>
  <span
    class="item-icon"
    :class="[`tier-${item.tier}`, `size-${size}`]"
    role="img"
    :aria-label="`${item.name}物品图标`"
  >
    <img :src="iconUrl" alt="" draggable="false" decoding="async" />
  </span>
</template>

<style scoped>
.item-icon {
  --tier: var(--q-common);
  display: grid;
  place-items: center;
  flex-shrink: 0;
  overflow: hidden;
  background:
    radial-gradient(circle at 28% 23%, #fff, transparent 42%),
    linear-gradient(145deg, #fff, #f1f4f7);
  border: 1.5px solid color-mix(in srgb, var(--tier) 58%, white);
  border-radius: 11px;
  box-shadow: inset 0 0 0 1px rgb(255 255 255 / 72%);
}

.size-sm {
  width: 32px;
  height: 32px;
}

.size-md {
  width: 48px;
  height: 48px;
  border-radius: 14px;
}

.tier-fine {
  --tier: var(--q-fine);
  background: linear-gradient(145deg, #fff, #ebf8ef);
}

.tier-rare {
  --tier: var(--q-rare);
  background: linear-gradient(145deg, #fff, #e9f4ff);
}

.tier-epic {
  --tier: var(--q-epic);
  background: linear-gradient(145deg, #fff, #f5ebff);
}

.tier-legendary {
  --tier: var(--q-legendary);
  background: linear-gradient(145deg, #fffdf7, #fff0d8);
}

img {
  width: 92%;
  height: 92%;
  object-fit: contain;
  filter: drop-shadow(0 2px 2px rgb(49 48 67 / 15%));
}
</style>
