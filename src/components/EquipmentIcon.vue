<script setup lang="ts">
import { computed } from 'vue';
import type { EquipmentDef } from '@/core/types';

const props = withDefaults(
  defineProps<{
    def: EquipmentDef;
    locked?: boolean;
    size?: 'sm' | 'md' | 'lg';
  }>(),
  {
    locked: false,
    size: 'md',
  },
);

const iconUrl = computed(() => `${import.meta.env.BASE_URL}${props.def.icon}`);
</script>

<template>
  <span
    class="equipment-icon"
    :class="[`quality-${def.quality}`, `size-${size}`, { locked }]"
    role="img"
    :aria-label="`${def.name}装备图标`"
  >
    <span class="shine" aria-hidden="true"></span>
    <img :src="iconUrl" alt="" draggable="false" decoding="async" />
    <span v-if="locked" class="lock" aria-hidden="true">◆</span>
  </span>
</template>

<style scoped>
.equipment-icon {
  --quality: var(--q-common);
  position: relative;
  display: grid;
  place-items: center;
  flex-shrink: 0;
  overflow: hidden;
  background:
    radial-gradient(circle at 32% 24%, rgb(255 255 255 / 95%), transparent 42%),
    linear-gradient(145deg, #fff, #eef2f6);
  border: 1.5px solid color-mix(in srgb, var(--quality) 66%, white);
  border-radius: 14px;
  box-shadow:
    inset 0 0 0 1px rgb(255 255 255 / 74%),
    0 4px 10px color-mix(in srgb, var(--quality) 18%, transparent);
}

.size-sm {
  width: 34px;
  height: 34px;
  border-radius: 11px;
}

.size-md {
  width: 50px;
  height: 50px;
}

.size-lg {
  width: 76px;
  height: 76px;
  border-radius: 20px;
}

.quality-fine {
  --quality: var(--q-fine);
  background: linear-gradient(145deg, #fff, #eaf8ef);
}

.quality-rare {
  --quality: var(--q-rare);
  background: linear-gradient(145deg, #fff, #e8f4ff);
}

.quality-epic {
  --quality: var(--q-epic);
  background: linear-gradient(145deg, #fff, #f4eaff);
}

.quality-legendary {
  --quality: var(--q-legendary);
  background: linear-gradient(145deg, #fffdf6, #fff0d8);
}

.quality-mythic {
  --quality: var(--q-mythic);
  background: linear-gradient(145deg, #fff8fa, #ffe6ea);
}

.quality-divine {
  --quality: var(--q-divine);
  background: linear-gradient(145deg, #fffef2, #fff4c8);
}

img {
  z-index: 1;
  width: 92%;
  height: 92%;
  object-fit: contain;
  filter: drop-shadow(0 2px 2px rgb(39 50 69 / 16%));
}

.shine {
  position: absolute;
  top: -38%;
  left: -65%;
  width: 42%;
  height: 176%;
  background: linear-gradient(90deg, transparent, rgb(255 255 255 / 66%), transparent);
  transform: rotate(20deg);
}

.quality-epic .shine,
.quality-legendary .shine,
.quality-mythic .shine,
.quality-divine .shine {
  animation: quality-shine 3.8s ease-in-out infinite;
}

.locked img {
  opacity: 0.48;
  filter: grayscale(0.55);
}

.lock {
  position: absolute;
  z-index: 2;
  right: 3px;
  bottom: 3px;
  display: grid;
  place-items: center;
  width: 14px;
  height: 14px;
  font-size: 7px;
  color: #fff;
  background: rgb(70 82 101 / 84%);
  border: 1px solid rgb(255 255 255 / 78%);
  border-radius: 50%;
}

@keyframes quality-shine {
  0%,
  56% {
    left: -65%;
  }
  82%,
  100% {
    left: 130%;
  }
}

@media (prefers-reduced-motion: reduce) {
  .shine {
    animation: none !important;
  }
}
</style>
