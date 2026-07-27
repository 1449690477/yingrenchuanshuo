<script setup lang="ts">
import { computed } from 'vue';
import type { ClassId } from '@/core/types';
import { CLASS_INFO } from '@/data/constants';
import { CLASS_VISUALS } from '@/data/classVisuals';
import {
  getClassBattleAnimation,
  type BattleVisualAction,
} from '@/data/spriteAnimations';
import SpriteSheet from '@/components/SpriteSheet.vue';

const props = withDefaults(
  defineProps<{
    classId: ClassId;
    variant?: 'preview' | 'thumb' | 'battle' | 'avatar';
    action?: BattleVisualAction;
  }>(),
  {
    variant: 'preview',
    action: 'idle',
  },
);

const visual = computed(() => CLASS_VISUALS[props.classId]);
const animation = computed(() => getClassBattleAnimation(props.classId, props.action));
const portraitPath = computed(() =>
  props.action === 'attack' ? visual.value.castPortrait : visual.value.portrait,
);
const portraitUrl = computed(() =>
  portraitPath.value ? `${import.meta.env.BASE_URL}${portraitPath.value}` : null,
);
</script>

<template>
  <span
    class="class-art"
    :class="`is-${variant}`"
    role="img"
    :aria-label="`${CLASS_INFO[classId].name}角色形象`"
  >
    <SpriteSheet v-if="variant === 'battle' && animation" :animation="animation" />
    <img
      v-else-if="portraitUrl"
      class="portrait"
      :src="portraitUrl"
      alt=""
      draggable="false"
      decoding="async"
    />
    <span v-else class="symbol" aria-hidden="true">{{ visual.symbol }}</span>
  </span>
</template>

<style scoped>
.class-art {
  position: relative;
  display: grid;
  place-items: center;
  flex-shrink: 0;
  overflow: hidden;
}

.portrait {
  display: block;
  width: 100%;
  height: 100%;
  object-fit: contain;
  pointer-events: none;
}

.symbol {
  line-height: 1;
}

.is-preview {
  width: 100%;
  height: 100%;
}

.is-preview .symbol {
  font-size: 64px;
  filter: drop-shadow(0 8px 12px rgb(78 112 154 / 18%));
}

.is-thumb {
  width: 38px;
  height: 38px;
  border: 1px solid rgb(255 255 255 / 75%);
  border-radius: 50%;
  background: linear-gradient(145deg, #fff, var(--blue-soft));
}

.is-thumb .portrait {
  transform: scale(2.35);
  transform-origin: 50% 18%;
}

.is-thumb .symbol {
  font-size: 24px;
}

.is-battle {
  width: 100%;
  height: 100%;
}

.is-battle .symbol {
  font-size: 34px;
}

.is-avatar {
  width: 100%;
  height: 100%;
}

.is-avatar .portrait {
  transform: scale(2.3);
  transform-origin: 50% 17%;
}

.is-avatar .symbol {
  font-size: 18px;
}
</style>
