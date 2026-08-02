<script setup lang="ts">
import { computed } from 'vue';
import { LockKeyhole } from '@lucide/vue';
import type { Skill } from '@/core/types';

const props = defineProps<{
  /**
   * 这里要的只是 `icon` / `element` / `name`，三者 `Skill` 上都有，
   * 所以类型取 `Skill` 而不是 `VisualSkill`。
   *
   * 原先写 `VisualSkill` 是过窄的：`VisualSkill = Skill & 演出字段`，只有配了
   * 演出定义的技能才是它，而**主动技能编成要列出该职业全部可选主动技**——
   * 其中相当一部分没有演出定义。按原类型，那些技能就没法用这个图标组件，
   * 界面只能退化成显示裸技能 id。组件本身一个演出字段都没用到。
   */
  skill: Skill;
  locked?: boolean;
}>();

const iconUrl = computed(() => `${import.meta.env.BASE_URL}${props.skill.icon}`);
</script>

<template>
  <span
    class="skill-icon"
    :class="[`element-${skill.element}`, { locked }]"
    role="img"
    :aria-label="`${skill.name}技能图标`"
  >
    <img :src="iconUrl" alt="" draggable="false" decoding="async" />
    <span v-if="locked" class="lock" aria-hidden="true">
      <LockKeyhole :size="9" :stroke-width="2.4" />
    </span>
  </span>
</template>

<style scoped>
.skill-icon {
  position: relative;
  display: grid;
  place-items: center;
  width: 42px;
  height: 42px;
  flex-shrink: 0;
  overflow: hidden;
  background: linear-gradient(145deg, #fff, var(--pink-soft));
  border: 1.5px solid #ffc7da;
  border-radius: 14px;
  box-shadow: inset 0 0 0 1px rgb(255 255 255 / 78%);
}

.skill-icon.element-thunder {
  background: linear-gradient(145deg, #fff, #eeeaff);
  border-color: #c9c4ff;
}

img {
  width: 118%;
  height: 118%;
  object-fit: contain;
}

.locked img {
  opacity: 0.32;
  filter: grayscale(0.55);
}

.lock {
  position: absolute;
  right: 3px;
  bottom: 3px;
  display: grid;
  place-items: center;
  width: 14px;
  height: 14px;
  font-size: 10px;
  font-weight: 800;
  color: #fff;
  background: rgb(97 111 130 / 78%);
  border-radius: 50%;
}
</style>
