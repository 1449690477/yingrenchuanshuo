<script setup lang="ts">
import { computed } from 'vue';
import type { SpriteSheetAnimation } from '@/data/spriteAnimations';

const props = defineProps<{
  animation: SpriteSheetAnimation;
}>();

const spriteUrl = computed(() => `${import.meta.env.BASE_URL}${props.animation.asset}`);
const style = computed(() => ({
  '--sprite-url': `url("${spriteUrl.value}")`,
  '--sprite-frames': String(props.animation.frames),
  '--sprite-duration': `${props.animation.frames / props.animation.fps}s`,
  '--sprite-iteration': props.animation.loop ? 'infinite' : '1',
}));
</script>

<template>
  <span class="sprite-sheet" :style="style" aria-hidden="true" />
</template>

<style scoped>
.sprite-sheet {
  display: block;
  width: 100%;
  height: 100%;
  background-image: var(--sprite-url);
  background-repeat: no-repeat;
  background-position: 0 0;
  background-size: calc(var(--sprite-frames) * 100%) 100%;
  animation: sprite-frames var(--sprite-duration) steps(var(--sprite-frames))
    var(--sprite-iteration) both;
}

@keyframes sprite-frames {
  to {
    background-position: 100% 0;
  }
}

@media (prefers-reduced-motion: reduce) {
  .sprite-sheet {
    animation: none;
  }
}
</style>
