<!--
  封神榜（外挂榜，docs/78）：物理上不可能的成绩公示。

  与其余五榜的展示口径**刻意相反**：那五榜弱化名次、保护小号；
  这一榜的全部意义就是让人看见「谁改了什么、改了多少」。

  但它的准入极严（docs/78 §2.3 四道闸门）：
  只认物理不可能、超额 ≥2 倍、重复或极端、且判据必须版本漂移免疫。
  一个正常玩家（哪怕全服第一的肝帝+欧皇+氪佬）不可能出现在这里。

  空榜是**好消息**，所以空态写得像好消息，不写「暂无数据」那种冷脸。
-->
<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { CloudOff, ShieldCheck, ShieldAlert } from '@lucide/vue';
import { getSupabaseClient } from '@/net/supabase';
import { fetchCheaterBoard, type CheaterBoardRow } from '@/net/cheatBoard';

const rows = ref<CheaterBoardRow[]>([]);
const loading = ref(true);
const error = ref<string | null>(null);

const isEmpty = computed(() => !loading.value && !error.value && rows.value.length === 0);

function fmtDate(at: string): string {
  return new Date(at).toLocaleDateString('zh-CN', { month: '2-digit', day: '2-digit' });
}

onMounted(async () => {
  try {
    const client = await getSupabaseClient();
    if (!client) {
      error.value = '未连接服务器';
      return;
    }
    const { data } = await client.auth.getUser();
    rows.value = await fetchCheaterBoard(client, data.user?.id ?? null);
  } catch (e) {
    error.value = e instanceof Error ? e.message : '封神榜读取失败';
  } finally {
    loading.value = false;
  }
});
</script>

<template>
  <section class="cheat-board">
    <p class="board-note">
      这里的成绩<strong>物理上不可能存在</strong>。判定只认「超过该等级能达到的极限」，
      不看谁强谁弱 —— 肝帝与欧皇不会出现在这里。
    </p>

    <p v-if="loading" class="state">读取中…</p>

    <p v-else-if="error" class="state state-error">
      <CloudOff :size="16" />
      {{ error }}
    </p>

    <div v-else-if="isEmpty" class="state state-clean">
      <ShieldCheck :size="20" />
      <div>
        <p class="clean-title">榜上无人</p>
        <p class="clean-sub">目前没有任何一条不可能的成绩 —— 这一榜空着是最好的样子。</p>
      </div>
    </div>

    <ol v-else class="list">
      <li v-for="row in rows" :key="row.userId" class="row" :class="{ me: row.isMe }">
        <ShieldAlert class="icon" :size="18" />
        <div class="body">
          <p class="name">
            {{ row.displayName }}
            <span v-if="row.evidenceCount > 1" class="count">累计 {{ row.evidenceCount }} 次</span>
          </p>
          <p class="summary">{{ row.summary }}</p>
        </div>
        <time class="date">{{ fmtDate(row.detectedAt) }}</time>
      </li>
    </ol>
  </section>
</template>

<style scoped>
.cheat-board {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.board-note {
  margin: 0;
  padding: 0.6rem 0.75rem;
  border-radius: var(--radius-md, 12px);
  background: color-mix(in srgb, var(--danger, #d4483b) 8%, transparent);
  color: var(--text-secondary, #6b6472);
  font-size: 0.78rem;
  line-height: 1.5;
}

.board-note strong {
  color: var(--danger, #d4483b);
}

.state {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin: 0;
  padding: 1.25rem 0.75rem;
  color: var(--text-secondary, #6b6472);
  font-size: 0.85rem;
}

.state-clean {
  align-items: flex-start;
  color: var(--mint, #3f9f86);
}

.clean-title {
  margin: 0 0 0.2rem;
  font-weight: 600;
}

.clean-sub {
  margin: 0;
  color: var(--text-secondary, #6b6472);
  font-size: 0.78rem;
  line-height: 1.5;
}

.list {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  margin: 0;
  padding: 0;
  list-style: none;
}

.row {
  display: flex;
  align-items: flex-start;
  gap: 0.6rem;
  padding: 0.65rem 0.75rem;
  border-radius: var(--radius-md, 12px);
  background: color-mix(in srgb, var(--danger, #d4483b) 6%, var(--surface, #fff));
  border: 1px solid color-mix(in srgb, var(--danger, #d4483b) 22%, transparent);
}

.row.me {
  border-color: var(--danger, #d4483b);
}

.icon {
  flex: none;
  margin-top: 0.1rem;
  color: var(--danger, #d4483b);
}

.body {
  flex: 1;
  min-width: 0;
}

.name {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  gap: 0.4rem;
  margin: 0 0 0.15rem;
  font-size: 0.9rem;
  font-weight: 600;
}

.count {
  padding: 0.05rem 0.35rem;
  border-radius: 999px;
  background: color-mix(in srgb, var(--danger, #d4483b) 15%, transparent);
  color: var(--danger, #d4483b);
  font-size: 0.68rem;
  font-weight: 500;
}

.summary {
  margin: 0;
  color: var(--text-secondary, #6b6472);
  font-size: 0.78rem;
  line-height: 1.45;
  overflow-wrap: anywhere;
}

.date {
  flex: none;
  color: var(--text-tertiary, #9a94a1);
  font-size: 0.72rem;
}
</style>
