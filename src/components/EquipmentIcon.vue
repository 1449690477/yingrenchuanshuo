<script setup lang="ts">
import { computed } from 'vue';
import { LockKeyhole } from '@lucide/vue';
import type { EquipmentDef } from '@/core/types';
import { forgeStageAt } from '@/core/equipment';

const props = withDefaults(
  defineProps<{
    def: EquipmentDef;
    /** 装备实例的强化等级；只改变锻造外观，不改变品质配色。 */
    enhance?: number;
    locked?: boolean;
    size?: 'sm' | 'md' | 'lg';
    /** 父按钮已经提供完整名称时，避免读屏重复朗读同一件装备。 */
    decorative?: boolean;
  }>(),
  {
    enhance: 0,
    locked: false,
    size: 'md',
    decorative: false,
  },
);

const iconUrl = computed(() => `${import.meta.env.BASE_URL}${props.def.icon}`);
const forgeStage = computed(() => forgeStageAt(props.enhance));
const iconLabel = computed(() =>
  props.enhance > 0
    ? `${props.def.name}装备图标，强化 +${props.enhance}`
    : `${props.def.name}装备图标`,
);
</script>

<template>
  <span
    class="equipment-icon"
    :class="[`quality-${def.quality}`, `size-${size}`, `forge-${forgeStage}`, { locked }]"
    :role="decorative ? undefined : 'img'"
    :aria-hidden="decorative ? 'true' : undefined"
    :aria-label="decorative ? undefined : iconLabel"
    :data-forge-stage="forgeStage"
  >
    <span class="shine" aria-hidden="true"></span>
    <img :src="iconUrl" alt="" draggable="false" decoding="async" />
    <span class="forge-frame" aria-hidden="true"></span>
    <span v-if="forgeStage !== 'original'" class="forge-mark" aria-hidden="true">✦</span>
    <span v-if="locked" class="lock" aria-hidden="true">
      <LockKeyhole :size="9" :stroke-width="2.4" />
    </span>
  </span>
</template>

<style scoped>
.equipment-icon {
  --quality: var(--q-common);
  --forge-color: transparent;
  --forge-glow: transparent;
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
    0 4px 10px color-mix(in srgb, var(--quality) 18%, transparent),
    0 0 9px var(--forge-glow);
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
  z-index: 0;
  top: -38%;
  left: -65%;
  width: 42%;
  height: 176%;
  background: linear-gradient(90deg, transparent, rgb(255 255 255 / 66%), transparent);
  transform: rotate(20deg);
}

.forge-frame {
  position: absolute;
  z-index: 2;
  inset: 2px;
  pointer-events: none;
  opacity: 0;
  border: 1px solid var(--forge-color);
  border-radius: inherit;
  box-shadow: inset 0 0 6px var(--forge-glow);
}

.forge-mark {
  position: absolute;
  z-index: 3;
  top: 2px;
  right: 3px;
  color: var(--forge-color);
  font-size: 9px;
  line-height: 1;
  text-shadow: 0 0 4px var(--forge-glow);
  pointer-events: none;
}

.size-sm .forge-mark {
  top: 1px;
  right: 2px;
  font-size: 7px;
}

.size-lg .forge-mark {
  top: 4px;
  right: 5px;
  font-size: 12px;
}

.forge-gleam {
  --forge-color: #7dddf0;
  --forge-glow: rgb(105 210 238 / 22%);
}

.forge-radiant {
  --forge-color: #8fb8ff;
  --forge-glow: rgb(102 157 244 / 31%);
}

.forge-starforged {
  --forge-color: #e6a8ff;
  --forge-glow: rgb(202 126 243 / 38%);
}

.forge-sakura {
  --forge-color: #ffd98b;
  --forge-glow: rgb(255 179 210 / 48%);
}

.forge-gleam .forge-frame,
.forge-radiant .forge-frame,
.forge-starforged .forge-frame,
.forge-sakura .forge-frame {
  opacity: 0.78;
}

.forge-radiant .forge-frame,
.forge-starforged .forge-frame,
.forge-sakura .forge-frame {
  animation: forge-breathe 2.8s ease-in-out infinite;
}

.forge-starforged .forge-mark,
.forge-sakura .forge-mark {
  animation: forge-twinkle 2.1s ease-in-out infinite;
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
  z-index: 4;
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

@keyframes forge-breathe {
  0%,
  100% {
    opacity: 0.62;
  }
  50% {
    opacity: 1;
  }
}

@keyframes forge-twinkle {
  0%,
  100% {
    opacity: 0.58;
    transform: scale(0.86);
  }
  50% {
    opacity: 1;
    transform: scale(1.08);
  }
}

@media (prefers-reduced-motion: reduce) {
  .shine,
  .forge-frame,
  .forge-mark {
    animation: none !important;
  }
}
</style>
