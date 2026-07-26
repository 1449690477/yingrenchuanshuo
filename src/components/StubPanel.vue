<script setup lang="ts">
defineProps<{
  title: string;
  desc: string;
  tasks: string[];
}>();
</script>

<template>
  <section class="stub">
    <h2 class="title">{{ title }}</h2>
    <p class="desc">{{ desc }}</p>
    <div class="card">
      <div class="card-head">待开发任务</div>
      <ul class="list">
        <li v-for="t in tasks" :key="t">{{ t }}</li>
      </ul>
    </div>
  </section>
</template>

<style scoped>
.stub {
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.title {
  font-size: 17px;
  font-weight: 700;
  color: var(--accent);
}
.desc {
  font-size: 12px;
  color: var(--text-dim);
  line-height: 1.7;
}
.card {
  background: var(--bg-panel);
  border: 1px solid rgb(167 139 250 / 12%);
  border-radius: 10px;
  overflow: hidden;
}
.card-head {
  padding: 8px 12px;
  font-size: 11px;
  color: var(--text-faint);
  background: var(--bg-panel-2);
}
.list {
  list-style: none;
  padding: 8px 12px 12px;
  display: flex;
  flex-direction: column;
  gap: 7px;
}
.list li {
  font-size: 12px;
  color: var(--text-dim);
  padding-left: 16px;
  position: relative;
}
.list li::before {
  content: '☐';
  position: absolute;
  left: 0;
  color: var(--purple);
}
</style>
