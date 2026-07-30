<script setup lang="ts">
/**
 * 榜单头像的唯一显示入口。
 *
 * 加载顺序固定为：玩家上传头像 → 职业默认立绘 → 职业符号。
 * 任一图片失败都会切到下一层，不把浏览器的裂图图标暴露给玩家。
 */
import { computed, ref, watch } from 'vue';
import type { ClassId } from '@/core/types';
import { CLASS_VISUALS } from '@/data/classVisuals';

const props = defineProps<{
  avatarUrl: string | null;
  classId: ClassId;
  alt: string;
}>();

const failedSourceCount = ref(0);

const sources = computed(() => {
  const portrait = CLASS_VISUALS[props.classId]?.portrait;
  const fallback = portrait ? `${import.meta.env.BASE_URL}${portrait}` : null;
  return [
    ...new Set([props.avatarUrl, fallback].filter((source): source is string => Boolean(source))),
  ];
});

const currentSource = computed(() => sources.value[failedSourceCount.value] ?? null);
const symbol = computed(() => CLASS_VISUALS[props.classId]?.symbol ?? '·');

watch(
  () => [props.avatarUrl, props.classId],
  () => {
    failedSourceCount.value = 0;
  },
);

function onImageError(): void {
  failedSourceCount.value++;
}
</script>

<template>
  <span class="profile-avatar" :data-class="classId">
    <img v-if="currentSource" :src="currentSource" :alt="alt" @error="onImageError" />
    <span v-else class="avatar-symbol" role="img" :aria-label="alt">{{ symbol }}</span>
  </span>
</template>

<style scoped>
.profile-avatar {
  position: relative;
  display: grid;
  flex: none;
  place-items: center;
  overflow: hidden;
  color: var(--text-mid);
  background: linear-gradient(145deg, var(--blue-soft), var(--pink-soft));
  border: 1px solid rgb(255 255 255 / 86%);
  border-radius: 50%;
  box-shadow: 0 2px 7px rgb(76 105 145 / 16%);
}

.profile-avatar img {
  width: 100%;
  height: 100%;
  display: block;
  object-fit: cover;
}

.avatar-symbol {
  font-size: 0.72em;
  line-height: 1;
}
</style>
