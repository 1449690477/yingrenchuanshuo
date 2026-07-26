<script setup lang="ts">
import { computed } from 'vue';
import type { SystemVisualId } from '@/data/systemVisuals';
import { requireSystemVisual } from '@/data/systemVisuals';

const props = defineProps<{
  kind: SystemVisualId;
  decorative?: boolean;
}>();

const visual = computed(() => requireSystemVisual(props.kind));
const assetUrl = computed(() => `${import.meta.env.BASE_URL}${visual.value.asset}`);
</script>

<template>
  <img
    class="system-artwork"
    :src="assetUrl"
    :alt="decorative ? '' : visual.alt"
    :aria-hidden="decorative ? 'true' : undefined"
    draggable="false"
  />
</template>

<style scoped>
.system-artwork {
  display: block;
  object-fit: contain;
  user-select: none;
  -webkit-user-drag: none;
}
</style>
