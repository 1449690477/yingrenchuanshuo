<script setup lang="ts">
defineProps<{ label: string }>();
</script>

<template>
  <span class="red-dot" role="img" :aria-label="label" />
</template>

<style scoped>
/* 信息型提示（docs/40/41）：静态小圆点，无数字、无闪烁。 */
.red-dot {
  position: absolute;
  top: -3px;
  right: -4px;
  width: 7px;
  height: 7px;
  border-radius: 999px;
  background: linear-gradient(135deg, var(--pink), var(--pink-deep));
  box-shadow: 0 0 0 2px rgb(255 255 255 / 96%);
  pointer-events: none;
}
</style>
