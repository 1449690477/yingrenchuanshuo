<script setup lang="ts">
import StubPanel from '@/components/StubPanel.vue';
</script>

<template>
  <StubPanel
    title="挂机"
    desc="自动战斗、掉落流水、关卡切换、扫荡入口。这是玩家停留时间最长的页面。"
    :tasks="['M2-6 战斗区与伤害飘字', 'M2-9 关卡选择与推荐战力警告', 'M2-10 离线收益弹窗', 'M3-7 扫荡功能']"
  />
</template>
