<!--
  进度榜（docs/63 §五 · P4，docs/51 §4 榜 3）：开荒者的荣誉。

  口径：最深关卡优先，同关按最早达成排；老档已通关的关卡没有时刻
  且不补记 —— 无时刻的行同关排最后，行上写「时刻未记录」，不假装
  知道一个已经丢失的时间（docs/62 §4.1）。

  与羁绊榜同一条展示红线：弱化名次 —— 小号暗色无奖牌、无皇冠、
  无点击查看他人。名次只是找到自己的锚点，不是攀比的刻度。
-->
<script setup lang="ts">
import { computed, onMounted } from 'vue';
import { CloudOff, Flag, Info, Sparkles } from '@lucide/vue';
import { useGameStore } from '@/stores/game';
import { useProgressBoardStore } from '@/stores/progressBoard';
import ProfileAvatar from '@/components/ProfileAvatar.vue';

const game = useGameStore();
const board = useProgressBoardStore();

// ─────────── 减弱动效（设置项 + 系统偏好，任一开启都生效） ───────────
const systemReduced =
  typeof window !== 'undefined' &&
  typeof window.matchMedia === 'function' &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const motionReduced = computed(() => systemReduced || Boolean(game.save?.settings.reduceMotion));

const heroTitle = computed(() => board.localStageLabel?.stageName ?? '尚未启程');
const heroSub = computed(() => {
  if (!board.localClaim || !board.localStageLabel) {
    return '还没有通关记录 —— 去推第一关吧';
  }
  return `第 ${board.localClaim ? board.localClearedCount : 0} 关已通关 · 最深关 Lv${board.localStageLabel.stageLevel}`;
});

function fmtDate(at: number | null): string {
  if (at === null) return '首通时刻未记录（老档不补记）';
  return `首通于 ${new Date(at).toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })}`;
}

function fmtTime(at: number | null): string {
  if (at === null) return '时刻未记录';
  return new Date(at).toLocaleString('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

const syncHint = computed(() => {
  if (board.syncing) return '进度同步中…';
  if (!board.localClaim) return '通关任意关卡后，就能在这里同步上榜';
  if (!board.lastSync) return '同步后，你的开荒进度才会出现在榜单上';
  if (board.lastSync.updated && board.lastSync.verified) {
    return '进度已同步 —— 榜上那行就是你';
  }
  if (board.lastSync.updated) return '已收下，但这份快照未能通过校验，暂不入榜';
  return '另一台设备报过更深的进度 —— 榜上以更深的那条为准';
});

onMounted(() => {
  void board.openBoard();
});
</script>

<template>
  <div class="rally">
    <!-- ═══ 你的开荒 ═══ -->
    <section class="card rally-hero">
      <template v-if="!motionReduced">
        <span class="rally-aura" aria-hidden="true" />
        <i v-for="n in 10" :key="n" class="petal" :class="`petal-${n}`" aria-hidden="true" />
      </template>

      <header class="rally-head">
        <span class="rally-title"><Flag :size="13" aria-hidden="true" />开荒长卷</span>
        <span class="rally-tag">开荒者的荣誉</span>
      </header>

      <div class="rally-body">
        <span class="rally-label">最深首通</span>
        <strong class="rally-value">{{ heroTitle }}</strong>
        <span class="rally-sub">{{ heroSub }}</span>
        <span v-if="board.localClaim" class="rally-time">{{ fmtDate(board.localClaim.firstClearedAt) }}</span>
        <span v-if="board.myPercentile !== null" class="rally-badge">
          <Sparkles :size="11" aria-hidden="true" />进度超过 {{ board.myPercentile }}% 的旅人
        </span>
      </div>

      <div class="rally-actions">
        <button
          class="btn btn-pink"
          :disabled="board.syncing || board.status === 'unconfigured' || !board.localClaim"
          @click="board.syncProgress()"
        >
          <Flag :size="13" aria-hidden="true" />
          {{ board.syncing ? '同步中…' : board.lastSync ? '再次同步进度' : '同步进度' }}
        </button>
        <p class="rally-hint">{{ syncHint }}</p>
      </div>

      <div v-if="board.status === 'unconfigured'" class="net-banner">
        <Info :size="13" aria-hidden="true" />
        <span>当前是单机模式，开荒进度记录在本地；联机开启后同步即可上榜。</span>
      </div>
      <div v-else-if="board.status === 'offline'" class="net-banner warn">
        <CloudOff :size="13" aria-hidden="true" />
        <span>网络未连接，榜单暂不可用；你的开荒进度在本地安然无恙。</span>
      </div>
      <p v-if="board.lastError && board.status === 'ready'" class="rally-error">{{ board.lastError }}</p>
    </section>

    <!-- ═══ 开荒同行榜 ═══ -->
    <section class="card rally-board">
      <header class="board-head">
        <span class="board-title">开荒同行榜</span>
        <span class="board-note">最深关卡优先，同关按最早达成排 —— 并列时早到者在前</span>
      </header>

      <div v-if="board.boardLoading && board.rows.length === 0" class="rows">
        <div v-for="n in 5" :key="n" class="row sk-row"><span class="sk" /></div>
      </div>

      <div v-else-if="board.rows.length === 0" class="empty">
        还没有人同步过开荒进度 —— 你的第一次同步，就会是榜上的第一行。
      </div>

      <div v-else class="rows">
        <div
          v-for="(row, index) in board.rows"
          :key="row.userId"
          class="row row-in"
          :class="{ me: row.isMe }"
          :style="{ '--row-delay': `${Math.min(index, 14) * 45}ms` }"
        >
          <!-- 弱化名次：小号暗色无装饰 —— 它只是找到自己的锚点 -->
          <span class="rank-no soft">{{ row.rank }}</span>
          <span class="who">
            <ProfileAvatar
              class="row-avatar"
              :avatar-url="row.avatarUrl"
              :class-id="row.classId"
              :alt="`${row.displayName}的头像`"
            />
            <span class="identity-line">
              <b>{{ row.displayName }}</b>
              <em v-if="row.isMe">你</em>
            </span>
          </span>
          <span class="stage-cell">
            <b>{{ row.stageName }}</b>
            <small>{{ fmtTime(row.firstClearedAt) }}</small>
          </span>
        </div>
      </div>

      <p class="board-foot">名次不发放任何竞技奖励 —— 先到达这件事本身，就是奖励。</p>
    </section>
  </div>
</template>

<style scoped>
.rally {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

/* ═══ 你的开荒英雄卡 ═══ */
.rally-hero {
  position: relative;
  overflow: hidden;
  padding: 16px 16px 14px;
}

.rally-aura {
  position: absolute;
  right: -16%;
  top: -38%;
  width: 58%;
  aspect-ratio: 1;
  border-radius: 50%;
  background: radial-gradient(circle, var(--pink), transparent 62%);
  opacity: 0.3;
  filter: blur(8px);
  animation: aura-breathe 5.6s ease-in-out infinite;
  pointer-events: none;
}

@keyframes aura-breathe {
  0%,
  100% {
    transform: scale(1);
    opacity: 0.26;
  }
  50% {
    transform: scale(1.12);
    opacity: 0.38;
  }
}

/* 上浮星尘粒子：大小、起点、时长全部错开，纯 CSS 零 JS 开销 */
.petal {
  --mx: 10%;
  --mdur: 7s;
  --msize: 4px;
  position: absolute;
  left: var(--mx);
  bottom: -8px;
  width: var(--msize);
  height: var(--msize);
  border-radius: 50%;
  background: radial-gradient(circle, #fff, var(--pink));
  box-shadow: 0 0 6px var(--pink);
  opacity: 0;
  animation: petal-rise var(--mdur) linear infinite;
  pointer-events: none;
}

.petal-1 { --mx: 6%;  --mdur: 6.4s; --msize: 3px; animation-delay: -1.2s; }
.petal-2 { --mx: 16%; --mdur: 7.8s; --msize: 5px; animation-delay: -4.1s; }
.petal-3 { --mx: 27%; --mdur: 5.9s; --msize: 3px; animation-delay: -2.6s; }
.petal-4 { --mx: 38%; --mdur: 8.4s; --msize: 4px; animation-delay: -6.3s; }
.petal-5 { --mx: 47%; --mdur: 6.8s; --msize: 3px; animation-delay: -0.7s; }
.petal-6 { --mx: 58%; --mdur: 7.4s; --msize: 5px; animation-delay: -3.8s; }
.petal-7 { --mx: 67%; --mdur: 6.1s; --msize: 3px; animation-delay: -5.2s; }
.petal-8 { --mx: 76%; --mdur: 8.9s; --msize: 4px; animation-delay: -2.1s; }
.petal-9 { --mx: 85%; --mdur: 7.1s; --msize: 3px; animation-delay: -4.9s; }
.petal-10 { --mx: 93%; --mdur: 6.6s; --msize: 4px; animation-delay: -1.6s; }

@keyframes petal-rise {
  0% {
    opacity: 0;
    transform: translate3d(0, 0, 0) scale(0.7);
  }
  12%,
  70% {
    opacity: 0.8;
  }
  100% {
    opacity: 0;
    transform: translate3d(10px, -150px, 0) scale(1.15);
  }
}

.rally-head {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 10px;
}
.rally-title {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  font-size: 13px;
  font-weight: 800;
  color: var(--pink-deep);
}
.rally-tag {
  font-size: 10px;
  font-weight: 700;
  color: var(--pink-deep);
  background: var(--pink-soft);
  border-radius: 999px;
  padding: 3px 8px;
}

.rally-body {
  position: relative;
  display: flex;
  flex-direction: column;
  gap: 3px;
}
.rally-label {
  font-size: 11px;
  font-weight: 600;
  color: var(--text-dim);
}
.rally-value {
  font-size: 26px;
  font-weight: 900;
  line-height: 1.15;
  background: linear-gradient(120deg, var(--pink-deep), #b98cf7);
  -webkit-background-clip: text;
  background-clip: text;
  color: transparent;
}
.rally-sub {
  font-size: 11px;
  color: var(--text-dim);
}
.rally-time {
  font-size: 10px;
  color: var(--text-dim);
  font-variant-numeric: tabular-nums;
}
.rally-badge {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  align-self: flex-start;
  margin-top: 6px;
  font-size: 11px;
  font-weight: 700;
  color: var(--pink-deep);
  background: var(--pink-soft);
  border-radius: 999px;
  padding: 4px 10px;
}

.rally-actions {
  position: relative;
  margin-top: 12px;
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.rally-actions .btn {
  align-self: flex-start;
  display: inline-flex;
  align-items: center;
  gap: 6px;
}
.rally-hint {
  font-size: 10px;
  color: var(--text-dim);
}
.rally-error {
  position: relative;
  margin-top: 8px;
  font-size: 11px;
  color: #d66;
}

.net-banner {
  position: relative;
  display: flex;
  align-items: flex-start;
  gap: 6px;
  margin-top: 10px;
  padding: 8px 10px;
  border-radius: 10px;
  background: var(--panel-3);
  font-size: 11px;
  color: var(--text-dim);
  line-height: 1.5;
}
.net-banner.warn {
  background: #fff4e8;
}

/* ═══ 榜单卡 ═══ */
.rally-board {
  padding: 14px 12px 10px;
}
.board-head {
  display: flex;
  flex-direction: column;
  gap: 2px;
  margin-bottom: 8px;
  padding: 0 4px;
}
.board-title {
  font-size: 13px;
  font-weight: 800;
}
.board-note {
  font-size: 10px;
  color: var(--text-dim);
}

.rows {
  display: flex;
  flex-direction: column;
  gap: 4px;
  max-height: 462px;
  overflow-y: auto;
}

.row {
  position: relative;
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 10px;
  border-radius: 12px;
  background: var(--panel-2);
}
.row.me {
  background: linear-gradient(120deg, var(--pink-soft), #f1e9ff);
  box-shadow: inset 0 0 0 1px var(--pink);
}

.row-in {
  animation: row-in 0.5s var(--ease-spring) both;
  animation-delay: var(--row-delay, 0ms);
}
@keyframes row-in {
  from {
    opacity: 0;
    transform: translateY(8px);
  }
  to {
    opacity: 1;
    transform: none;
  }
}

.rank-no.soft {
  width: 26px;
  text-align: center;
  font-size: 11px;
  font-weight: 700;
  color: var(--text-dim);
}

.who {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
  flex: 1;
}
.row-avatar {
  width: 30px;
  height: 30px;
  border-radius: 50%;
  flex: none;
}
.identity-line {
  display: flex;
  align-items: center;
  gap: 6px;
  min-width: 0;
}
.identity-line b {
  font-size: 12px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.identity-line em {
  font-style: normal;
  font-size: 10px;
  font-weight: 700;
  color: var(--pink-deep);
  background: var(--pink-soft);
  border-radius: 6px;
  padding: 1px 5px;
}

.stage-cell {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 1px;
  flex: none;
  max-width: 42%;
}
.stage-cell b {
  font-size: 11px;
  font-weight: 800;
  color: var(--pink-deep);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  max-width: 100%;
}
.stage-cell small {
  font-size: 9px;
  color: var(--text-dim);
  font-variant-numeric: tabular-nums;
}

.empty {
  padding: 26px 12px;
  text-align: center;
  font-size: 12px;
  color: var(--text-dim);
  line-height: 1.7;
}

.board-foot {
  margin-top: 8px;
  padding: 0 4px;
  font-size: 10px;
  color: var(--text-dim);
}

.sk-row {
  padding: 12px;
}
.sk {
  display: block;
  width: 100%;
  height: 18px;
  border-radius: 8px;
  background: linear-gradient(90deg, var(--panel-3) 25%, #fff 50%, var(--panel-3) 75%);
  background-size: 200% 100%;
  animation: sk-slide 1.2s linear infinite;
}
@keyframes sk-slide {
  from {
    background-position: 200% 0;
  }
  to {
    background-position: -200% 0;
  }
}

/* ═══ 小屏适配（320px 一档不疏忽） ═══ */
@media (max-width: 340px) {
  .rally-hero {
    padding: 13px 12px 11px;
  }
  .rally-value {
    font-size: 21px;
  }
  .rally-board {
    padding: 12px 8px 8px;
  }
  .row {
    gap: 6px;
    padding: 7px 8px;
  }
  .rank-no.soft {
    width: 20px;
  }
  .row-avatar {
    width: 26px;
    height: 26px;
  }
  .stage-cell b {
    font-size: 10px;
  }
  .rows {
    max-height: 400px;
  }
}

/* ═══ 减弱动效 ═══ */
@media (prefers-reduced-motion: reduce) {
  .rally-aura,
  .petal,
  .sk,
  .row-in {
    animation: none;
  }
  .row-in {
    opacity: 1;
  }
}
</style>
