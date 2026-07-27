<script setup lang="ts">
import { computed } from 'vue';
import type { MonsterDef } from '@/core/types';
import {
  getMonsterBattleAnimation,
  type BattleVisualAction,
} from '@/data/spriteAnimations';
import SpriteSheet from '@/components/SpriteSheet.vue';

const props = withDefaults(
  defineProps<{
    monster: MonsterDef;
    variant?: 'battle' | 'thumb';
    action?: BattleVisualAction;
  }>(),
  {
    variant: 'battle',
    action: 'idle',
  },
);

const spriteUrl = computed(() =>
  props.monster.sprite ? `${import.meta.env.BASE_URL}${props.monster.sprite}` : null,
);
const animation = computed(() => getMonsterBattleAnimation(props.monster.id, props.action));
</script>

<template>
  <span
    class="monster-art"
    :class="[`is-${variant}`, `type-${monster.type}`]"
    role="img"
    :aria-label="`${monster.name}怪物形象`"
  >
    <SpriteSheet v-if="variant === 'battle' && animation" :animation="animation" />
    <img v-else-if="spriteUrl" :src="spriteUrl" alt="" draggable="false" decoding="async" />
    <span v-else class="placeholder" aria-hidden="true">{{ monster.name.slice(0, 1) }}</span>
  </span>
</template>

<style scoped>
.monster-art {
  position: relative;
  display: grid;
  place-items: center;
  flex-shrink: 0;
}

img {
  display: block;
  width: 100%;
  height: 100%;
  object-fit: contain;
  filter: drop-shadow(0 3px 3px rgb(58 53 81 / 17%));
  pointer-events: none;
}

.is-battle {
  width: 82px;
  height: 82px;
}

.is-battle.type-boss {
  width: 88px;
  height: 88px;
}

.is-thumb {
  width: 22px;
  height: 22px;
}

.placeholder {
  display: grid;
  place-items: center;
  width: 76%;
  height: 76%;
  font-size: 12px;
  font-weight: 700;
  color: var(--text-dim);
  background: var(--panel-3);
  border: 1px dashed var(--line-strong);
  border-radius: 50%;
}

.is-battle .placeholder {
  font-size: 24px;
}
</style>
