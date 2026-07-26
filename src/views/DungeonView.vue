<script setup lang="ts">
const planned = [
  { name: '日常材料副本', when: 'M4-4', desc: '周一到周日轮换，定向刷强化材料' },
  { name: '装备副本', when: 'M5-4', desc: '8 个部位各一个，缺哪件刷哪件' },
  { name: '无尽塔', when: 'M6-4', desc: '爬塔，层数上排行榜' },
  { name: '世界 BOSS', when: 'M8-1', desc: '每日定时两场，全服伤害排名' },
  { name: '公会团本', when: 'M8-5', desc: '成员各自打，伤害累加到共享血条' },
];
</script>

<template>
  <div class="dungeon scroll-y">
    <div class="banner">
      <div class="banner-icon">🏰</div>
      <div class="banner-text">
        <strong>副本还没开放</strong>
        <span>先把挂机和装备玩起来，副本会按下面的顺序逐个上线。</span>
      </div>
    </div>

    <div v-for="p in planned" :key="p.name" class="row card">
      <div class="row-main">
        <span class="name">{{ p.name }}</span>
        <span class="desc">{{ p.desc }}</span>
      </div>
      <span class="when">{{ p.when }}</span>
    </div>
  </div>
</template>

<style scoped>
.dungeon {
  height: 100%;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.banner {
  display: flex;
  gap: 12px;
  padding: 14px;
  background: linear-gradient(100deg, var(--blue-soft), var(--pink-soft));
  border-radius: var(--r);
}

.banner-icon {
  font-size: 26px;
}

.banner-text {
  display: flex;
  flex-direction: column;
  gap: 3px;
  font-size: 11px;
  color: var(--text-mid);
  line-height: 1.6;
}

.banner-text strong {
  font-size: 13px;
  color: var(--text);
}

.row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  padding: 11px 13px;
}

.row-main {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}

.name {
  font-size: 13px;
  font-weight: 600;
}

.desc {
  font-size: 10px;
  color: var(--text-dim);
}

.when {
  flex-shrink: 0;
  padding: 3px 9px;
  font-size: 10px;
  font-weight: 700;
  color: var(--blue-deep);
  background: var(--blue-soft);
  border-radius: 999px;
}
</style>
