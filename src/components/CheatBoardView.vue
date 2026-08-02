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
import { CloudOff, ShieldCheck, ShieldAlert, Sparkles } from '@lucide/vue';
import { getSupabaseClient } from '@/net/supabase';
import { fetchCheaterBoard, type CheaterBoardRow } from '@/net/cheatBoard';
import { CHEAT_BOARD_VISUAL } from '@/data/boardVisuals';

const rows = ref<CheaterBoardRow[]>([]);
const loading = ref(true);
const error = ref<string | null>(null);

const isEmpty = computed(() => !loading.value && !error.value && rows.value.length === 0);
const evidenceTotal = computed(() => rows.value.reduce((sum, row) => sum + row.evidenceCount, 0));
const sceneUrl = `${import.meta.env.BASE_URL}${CHEAT_BOARD_VISUAL.sceneAsset}`;

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
    <section class="seal-hero" aria-labelledby="seal-hero-title">
      <img class="seal-scene" :src="sceneUrl" alt="" aria-hidden="true" />
      <span class="seal-veil" aria-hidden="true" />
      <header class="seal-head">
        <span><ShieldCheck :size="15" aria-hidden="true" />{{ CHEAT_BOARD_VISUAL.arenaName }}</span>
        <small><i aria-hidden="true" />只读公示</small>
      </header>
      <div class="seal-body">
        <span class="seal-core" aria-hidden="true">
          <i /><ShieldCheck :size="32" :stroke-width="1.7" />
        </span>
        <span class="seal-copy">
          <small>服务器物理上限守门</small>
          <strong id="seal-hero-title">不可能的成绩，在这里留下判据</strong>
          <em><Sparkles :size="12" aria-hidden="true" />{{ CHEAT_BOARD_VISUAL.ruleLabel }}</em>
        </span>
      </div>
      <footer class="seal-stats" aria-label="封神榜复核概览">
        <span
          ><small>当前记录</small><b class="num">{{ loading ? '—' : rows.length }}</b></span
        >
        <span
          ><small>累计判据</small><b class="num">{{ loading ? '—' : evidenceTotal }}</b></span
        >
        <span><small>正常玩家</small><b>永不入榜</b></span>
      </footer>
    </section>

    <p class="board-note">
      这里的成绩<strong>物理上不可能存在</strong>。判定只认「超过该等级能达到的极限」， 不看谁强谁弱
      —— 肝帝与欧皇不会出现在这里。
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

.seal-hero {
  position: relative;
  min-height: 224px;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  padding: 13px;
  color: #fff;
  background: #283548;
  border: 1px solid rgb(255 255 255 / 74%);
  border-radius: 18px;
  box-shadow: 0 14px 30px rgb(43 53 76 / 24%);
}

.seal-scene,
.seal-veil {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
}

.seal-scene {
  object-fit: cover;
  filter: saturate(0.72) contrast(1.08);
  transform: scale(1.04);
  animation: seal-scene-drift 13s ease-in-out infinite alternate;
}

.seal-veil {
  background:
    radial-gradient(circle at 28% 52%, rgb(118 203 232 / 18%), transparent 27%),
    linear-gradient(100deg, rgb(20 29 45 / 88%) 0%, rgb(34 42 61 / 62%) 58%, rgb(59 40 61 / 46%)),
    linear-gradient(0deg, rgb(21 29 43 / 84%) 0%, transparent 64%);
}

.seal-head,
.seal-body,
.seal-stats {
  position: relative;
  z-index: 1;
}

.seal-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.seal-head > span,
.seal-head small {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  font-size: 11px;
  font-weight: 800;
}

.seal-head small {
  padding: 4px 8px;
  color: rgb(255 255 255 / 84%);
  background: rgb(255 255 255 / 13%);
  border: 1px solid rgb(255 255 255 / 20%);
  border-radius: 999px;
  backdrop-filter: blur(8px);
}

.seal-head small i {
  width: 6px;
  height: 6px;
  background: #74e1bc;
  border-radius: 50%;
  box-shadow: 0 0 8px #74e1bc;
}

.seal-body {
  display: grid;
  grid-template-columns: 62px minmax(0, 1fr);
  align-items: center;
  gap: 11px;
}

.seal-core {
  position: relative;
  width: 62px;
  height: 62px;
  display: grid;
  place-items: center;
  color: #d8f7ff;
  background: rgb(89 160 191 / 22%);
  border: 1px solid rgb(191 235 255 / 54%);
  border-radius: 50%;
  box-shadow:
    inset 0 0 18px rgb(169 230 255 / 20%),
    0 0 24px rgb(93 197 234 / 20%);
}

.seal-core i {
  position: absolute;
  inset: -7px;
  border: 1px dashed rgb(207 239 255 / 46%);
  border-radius: 50%;
  animation: seal-spin 12s linear infinite;
}

.seal-copy {
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.seal-copy small {
  font-size: 10px;
  color: rgb(255 255 255 / 70%);
}

.seal-copy strong {
  max-width: 245px;
  font-size: 16px;
  line-height: 1.35;
  text-shadow: 0 2px 8px rgb(12 22 35 / 70%);
}

.seal-copy em {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  align-self: flex-start;
  padding: 3px 8px;
  font-size: 9px;
  font-style: normal;
  color: #dff9ff;
  background: rgb(99 186 220 / 20%);
  border-radius: 999px;
}

.seal-stats {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  overflow: hidden;
  background: rgb(16 27 42 / 42%);
  border: 1px solid rgb(255 255 255 / 14%);
  border-radius: 12px;
  backdrop-filter: blur(8px);
}

.seal-stats span {
  min-width: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
  padding: 7px 4px;
  border-right: 1px solid rgb(255 255 255 / 12%);
}

.seal-stats span:last-child {
  border-right: 0;
}

.seal-stats small {
  font-size: 8px;
  color: rgb(255 255 255 / 62%);
}

.seal-stats b {
  overflow: hidden;
  max-width: 100%;
  font-size: 11px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

@keyframes seal-spin {
  to {
    transform: rotate(360deg);
  }
}

@keyframes seal-scene-drift {
  to {
    transform: scale(1.09) translateX(-1.2%);
  }
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

@media (max-width: 340px) {
  .seal-hero {
    min-height: 214px;
    padding: 11px;
  }
  .seal-body {
    grid-template-columns: 52px minmax(0, 1fr);
    gap: 9px;
  }
  .seal-core {
    width: 52px;
    height: 52px;
  }
  .seal-copy strong {
    font-size: 14px;
  }
}

@media (prefers-reduced-motion: reduce) {
  .seal-scene,
  .seal-core i {
    animation: none;
  }
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
