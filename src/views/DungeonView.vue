<script setup lang="ts">
import type { Component } from 'vue';
import { CalendarDays, Castle, Crown, Gem, TowerControl, UsersRound } from '@lucide/vue';

const planned = [
  {
    name: '日常材料副本',
    when: 'M4-4',
    desc: '周一到周日轮换，定向刷强化材料',
    icon: CalendarDays,
  },
  {
    name: '装备副本',
    when: 'M5-4',
    desc: '8 个部位各一个，缺哪件刷哪件',
    icon: Gem,
  },
  { name: '无尽塔', when: 'M6-4', desc: '爬塔，层数上排行榜', icon: TowerControl },
  {
    name: '世界 BOSS',
    when: 'M8-1',
    desc: '每日定时两场，全服伤害排名',
    icon: Crown,
  },
  {
    name: '公会团本',
    when: 'M8-5',
    desc: '成员各自打，伤害累加到共享血条',
    icon: UsersRound,
  },
] satisfies {
  name: string;
  when: string;
  desc: string;
  icon: Component;
}[];
</script>

<template>
  <div class="dungeon scroll-y">
    <div class="banner">
      <div class="banner-icon">
        <Castle :size="28" :stroke-width="1.9" aria-hidden="true" />
      </div>
      <div class="banner-text">
        <strong>副本还没开放</strong>
        <span>先把挂机和装备玩起来，副本会按下面的顺序逐个上线。</span>
      </div>
    </div>

    <div v-for="p in planned" :key="p.name" class="row card">
      <span class="row-icon">
        <component :is="p.icon" :size="18" :stroke-width="2" aria-hidden="true" />
      </span>
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
  display: grid;
  place-items: center;
  color: var(--blue-deep);
}

.row-icon {
  display: grid;
  place-items: center;
  width: 34px;
  height: 34px;
  flex-shrink: 0;
  color: var(--blue-deep);
  background: linear-gradient(145deg, var(--blue-soft), var(--pink-soft));
  border-radius: 11px;
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
