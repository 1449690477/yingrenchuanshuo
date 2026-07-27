<script setup lang="ts">
import type { Component } from 'vue';
import { CalendarDays, Crown, Gem, TowerControl, UsersRound } from '@lucide/vue';
import SystemArtwork from '@/components/SystemArtwork.vue';

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
      <div class="banner-text">
        <span class="eyebrow">樱境传送门</span>
        <strong>副本还没开放</strong>
        <span>先把挂机和装备玩起来，副本会按下面的顺序逐个上线。</span>
      </div>
      <SystemArtwork kind="dungeon" class="banner-art" />
    </div>

    <div
      v-for="(p, i) in planned"
      :key="p.name"
      class="row card row-in"
      :class="`tone-${i % 5}`"
      :style="{ '--row-delay': `${60 + i * 55}ms` }"
    >
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
  position: relative;
  display: flex;
  align-items: center;
  gap: 12px;
  min-height: 112px;
  padding: 16px 126px 16px 16px;
  background: linear-gradient(100deg, var(--blue-soft), var(--pink-soft));
  border-radius: var(--r);
  overflow: hidden;
}

.banner::after {
  position: absolute;
  right: 42px;
  bottom: 4px;
  width: 64px;
  height: 12px;
  content: '';
  background: rgb(126 204 234 / 22%);
  border-radius: 50%;
  filter: blur(5px);
  animation: portal-glow 2.1s ease-in-out infinite;
}

.banner-art {
  position: absolute;
  right: 2px;
  bottom: -6px;
  width: 128px;
  height: 128px;
  z-index: 1;
  animation: portal-float 3.4s ease-in-out infinite;
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

/* 每个规划系统固定一种色调，后续插入其他元素也不会打乱顺序。 */
.tone-0 .row-icon {
  color: var(--blue-deep);
  background: linear-gradient(145deg, #e2f2ff, #f0f9ff);
}

.tone-1 .row-icon {
  color: var(--pink-deep);
  background: linear-gradient(145deg, #ffe7f0, #fff3f8);
}

.tone-2 .row-icon {
  color: #b07f10;
  background: linear-gradient(145deg, #fdf3d7, #fffaec);
}

.tone-3 .row-icon {
  color: #7a5fd0;
  background: linear-gradient(145deg, #efebfb, #f7f4ff);
}

.tone-4 .row-icon {
  color: #3a9e7c;
  background: linear-gradient(145deg, #dcf5ec, #f2fcf7);
}

.banner-text {
  position: relative;
  z-index: 2;
  display: flex;
  flex-direction: column;
  gap: 3px;
  font-size: 11px;
  color: var(--text-mid);
  line-height: 1.6;
}

.eyebrow {
  width: fit-content;
  padding: 2px 7px;
  font-size: 9px;
  font-weight: 700;
  color: var(--blue-deep);
  background: rgb(255 255 255 / 70%);
  border-radius: 999px;
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

@keyframes portal-float {
  0%,
  100% {
    transform: translateY(0);
  }
  50% {
    transform: translateY(-4px);
  }
}

@keyframes portal-glow {
  0%,
  100% {
    opacity: 0.55;
    transform: scaleX(0.9);
  }
  50% {
    opacity: 1;
    transform: scaleX(1.14);
  }
}

@media (prefers-reduced-motion: reduce) {
  .banner-art,
  .banner::after {
    animation: none;
  }
}
</style>
