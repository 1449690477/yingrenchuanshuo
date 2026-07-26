<script setup lang="ts">
import StubPanel from '@/components/StubPanel.vue';
</script>

<template>
  <StubPanel
    title="养成"
    desc="角色属性、8 装备槽、强化、洗练、技能、宠物、时装。"
    :tasks="['M2-8 装备槽与属性面板', 'M3-2 强化 UI 与幸运值', 'M3-5 技能树与技能栏', 'M4-6 洗练系统', 'M6-1 宠物系统']"
  />
</template>
