<script setup lang="ts">
/** 公会广场列表：名片行 + 容量条 + 声望章，点击整行打开详情底部弹层。 */
import { Castle, ChevronRight } from '@lucide/vue';
import { abbr } from '@/core/format';
import type { GuildSummary } from '@/net/guild';
import { crestInitial, crestTintClass } from './guildCrest';

defineProps<{
  guilds: GuildSummary[];
  myGuildId?: string | null;
  mutating?: boolean;
  loading?: boolean;
}>();

const emit = defineEmits<{ select: [guild: GuildSummary] }>();
</script>

<template>
  <div v-if="loading && guilds.length === 0" class="plaza-skeleton" aria-live="polite">
    <div v-for="n in 3" :key="n" class="sk-row">
      <i class="sk-crest" />
      <span class="sk-lines"><i /><i class="short" /></span>
    </div>
  </div>
  <div v-else-if="guilds.length" class="plaza-list">
    <button
      v-for="(item, index) in guilds"
      :key="item.id"
      class="plaza-row row-clickable row-in"
      :style="{ '--row-delay': `${Math.min(index, 12) * 45}ms` }"
      :aria-label="`查看公会 ${item.name} 的详情`"
      @click="emit('select', item)"
    >
      <span class="plaza-crest" :class="crestTintClass(item.name)" aria-hidden="true">
        {{ crestInitial(item.name) }}
      </span>
      <span class="plaza-copy">
        <strong>
          {{ item.name }}
          <em v-if="item.id === myGuildId" class="mine-chip">我的公会</em>
        </strong>
        <span class="plaza-notice">{{ item.notice || '会长还没有写公告' }}</span>
        <span class="plaza-meter" aria-hidden="true">
          <i
            class="meter-track"
            :class="{ full: item.memberCount >= item.memberLimit }"
          >
            <i
              class="meter-fill"
              :style="{ width: `${Math.min(100, (item.memberCount / Math.max(1, item.memberLimit)) * 100)}%` }"
            />
          </i>
          <small class="num">{{ item.memberCount }}/{{ item.memberLimit }}</small>
        </span>
      </span>
      <span class="plaza-side">
        <span class="rep-chip num">声望 {{ abbr(item.reputation) }}</span>
        <ChevronRight :size="16" aria-hidden="true" />
      </span>
    </button>
  </div>
  <div v-else class="plaza-empty">
    <span class="empty-crest"><Castle :size="26" aria-hidden="true" /></span>
    <strong>还没有点灯开放的樱庭</strong>
    <p>成为第一位会长，为旅伴点亮回家的灯。</p>
  </div>
</template>

<style scoped>
.plaza-list {
  display: flex;
  flex-direction: column;
}
.plaza-row {
  min-width: 0;
  min-height: 4.4rem;
  display: grid;
  grid-template-columns: 2.9rem minmax(0, 1fr) auto;
  align-items: center;
  gap: 0.65rem;
  padding: 0.6rem 0.75rem;
  text-align: left;
  border-bottom: 1px solid var(--line);
}
.plaza-row:last-child {
  border-bottom: 0;
}
.plaza-row:active {
  background: #f3f9ff;
}
.plaza-crest {
  width: 2.9rem;
  height: 2.9rem;
  display: grid;
  place-items: center;
  font-size: 1.02rem;
  font-weight: 900;
  color: #fff;
  text-shadow: 0 1px 3px rgb(70 89 107 / 30%);
  border: 2px solid rgb(255 255 255 / 85%);
  border-radius: 1rem;
  box-shadow: var(--shadow-sm);
}
.plaza-copy {
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 0.14rem;
}
.plaza-copy strong {
  display: flex;
  align-items: center;
  gap: 0.35rem;
  font-size: 0.82rem;
  color: var(--text);
}
.mine-chip {
  padding: 0.1rem 0.4rem;
  font-size: 0.58rem;
  font-style: normal;
  font-weight: 800;
  color: #d2608c;
  background: var(--pink-soft);
  border: 1px solid #ffd5e4;
  border-radius: 999px;
}
.plaza-notice {
  overflow: hidden;
  font-size: 0.66rem;
  color: var(--text-mid);
  text-overflow: ellipsis;
  white-space: nowrap;
}
.plaza-meter {
  display: flex;
  align-items: center;
  gap: 0.4rem;
}
.meter-track {
  width: 5.2rem;
  height: 0.3rem;
  overflow: hidden;
  background: #e8f2fa;
  border-radius: 999px;
}
.meter-fill {
  display: block;
  height: 100%;
  background: linear-gradient(90deg, var(--blue), var(--pink));
  border-radius: inherit;
  transition: width 0.5s var(--ease-soft);
}
.meter-track.full .meter-fill {
  background: linear-gradient(90deg, #ffb0c8, #ff8fae);
}
.plaza-meter small {
  font-size: 0.6rem;
  color: var(--text-dim);
}
.plaza-side {
  display: flex;
  align-items: center;
  gap: 0.15rem;
  color: var(--text-dim);
}
.rep-chip {
  padding: 0.22rem 0.45rem;
  font-size: 0.6rem;
  font-weight: 800;
  color: #5d7f9a;
  background: var(--blue-soft);
  border: 1px solid #d8ecfa;
  border-radius: 999px;
  white-space: nowrap;
}
.plaza-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.45rem;
  padding: 1.6rem 1rem;
  text-align: center;
  color: var(--text-mid);
}
.empty-crest {
  width: 3.4rem;
  height: 3.4rem;
  display: grid;
  place-items: center;
  color: #d98bae;
  background: linear-gradient(145deg, #fff3f8, #ecf6ff);
  border-radius: 1.1rem;
}
.plaza-empty strong {
  font-size: 0.8rem;
  color: var(--text);
}
.plaza-empty p {
  margin: 0;
  font-size: 0.68rem;
  line-height: 1.6;
}
/* 列表加载骨架：慢网络下不再闪出「空状态」 */
.plaza-skeleton {
  display: flex;
  flex-direction: column;
}
.sk-row {
  min-height: 4.4rem;
  display: flex;
  align-items: center;
  gap: 0.65rem;
  padding: 0.6rem 0.75rem;
  border-bottom: 1px solid var(--line);
}
.sk-row:last-child {
  border-bottom: 0;
}
.sk-row i {
  display: block;
  background: linear-gradient(90deg, #eef4fa 25%, #f8fbfe 50%, #eef4fa 75%);
  background-size: 200% 100%;
  animation: sk-shine 1.4s ease infinite;
}
.sk-crest {
  width: 2.9rem;
  height: 2.9rem;
  border-radius: 1rem;
}
.sk-lines {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
}
.sk-lines i {
  height: 0.7rem;
  border-radius: 999px;
}
.sk-lines i.short {
  width: 55%;
}
@keyframes sk-shine {
  from {
    background-position: 200% 0;
  }
  to {
    background-position: -200% 0;
  }
}
@media (prefers-reduced-motion: reduce) {
  .meter-fill {
    transition: none;
  }
  .sk-row i {
    animation: none;
  }
}
</style>
