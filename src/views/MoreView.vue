<script setup lang="ts">
import StubPanel from '@/components/StubPanel.vue';
</script>

<template>
  <StubPanel
    title="更多"
    desc="公会、排行、成就、图鉴、邮件、设置、存档管理。"
    :tasks="['M2-3 存档导出 / 导入', 'M4-5 邮件系统', 'M4-7 成就系统', 'M4-8 图鉴系统', 'M7-4 排行榜', 'M8-3 公会系统']"
  />
</template>
