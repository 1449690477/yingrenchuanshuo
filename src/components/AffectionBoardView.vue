<!--
  羁绊榜（docs/63 §三 · P2）：不打战斗的旅人，也有自己的赛道。

  三条硬口径（claude 20:39 拍板）：
    1. 按四角色心意之和排，不按单角色排 —— 不逼玩家「选最优角色」
    2. 不显示单角色明细 —— 谁给谁刷了多少好感是私事
    3. 弱化名次、强化「你陪伴了多久」—— 这个榜的价值不在竞争

  因此行内刻意不做名次奖牌 / 皇冠 / 点击查看他人 —— 名次只是找到
  自己的锚点，不是攀比的刻度。
-->
<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue';
import { CloudOff, Heart, Info, Sparkles } from '@lucide/vue';
import { useGameStore } from '@/stores/game';
import { useAffectionBoardStore } from '@/stores/affectionBoard';
import ProfileAvatar from '@/components/ProfileAvatar.vue';

const game = useGameStore();
const board = useAffectionBoardStore();

// ─────────── 减弱动效（设置项 + 系统偏好，任一开启都生效） ───────────
const systemReduced =
  typeof window !== 'undefined' &&
  typeof window.matchMedia === 'function' &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const motionReduced = computed(() => systemReduced || Boolean(game.save?.settings.reduceMotion));

// ─────────── 心意数字的轻柔滚动（减弱动效时直接落定） ───────────
const shownTotal = ref(board.myAffectionTotal);
let countUpFrame = 0;
function animateTotal(target: number) {
  cancelAnimationFrame(countUpFrame);
  if (motionReduced.value) {
    shownTotal.value = target;
    return;
  }
  const from = shownTotal.value;
  if (from === target) return;
  const start = performance.now();
  const duration = 620;
  const step = (now: number) => {
    const t = Math.min(1, (now - start) / duration);
    const eased = 1 - Math.pow(1 - t, 3);
    shownTotal.value = Math.round(from + (target - from) * eased);
    if (t < 1) countUpFrame = requestAnimationFrame(step);
  };
  countUpFrame = requestAnimationFrame(step);
}
watch(
  () => board.myAffectionTotal,
  (total) => animateTotal(total),
);

const companionText = computed(() =>
  board.myTotalInteractions > 0 ? `已累计相伴 ${board.myTotalInteractions.toLocaleString('zh-CN')} 次` : '还没有相伴记录，去她那里坐坐吧',
);

const syncHint = computed(() => {
  if (board.syncing) return '心意同步中…';
  if (!board.lastSync) return '同步后，你的心意才会出现在榜单上';
  if (board.lastSync.updated && (board.lastSync.affectionTotal ?? 0) > 0) {
    return '心意已同步 —— 榜上那个数字就是你';
  }
  if (board.lastSync.updated) return '同步成功，累积心意后就会上榜';
  return '这份心意快照有些异常，未能入榜';
});

onMounted(() => {
  animateTotal(board.myAffectionTotal);
  void board.refreshBoard();
});
onUnmounted(() => cancelAnimationFrame(countUpFrame));
</script>

<template>
  <div class="bond">
    <!-- ═══ 你的陪伴 ═══ -->
    <section class="card bond-hero">
      <template v-if="!motionReduced">
        <span class="bond-aura" aria-hidden="true" />
        <i v-for="n in 10" :key="n" class="petal" :class="`petal-${n}`" aria-hidden="true" />
      </template>

      <header class="bond-head">
        <span class="bond-title"><Heart :size="13" aria-hidden="true" />羁绊长卷</span>
        <span class="bond-tag">不战斗的赛道</span>
      </header>

      <div class="bond-body">
        <span class="bond-label">心意总值</span>
        <strong class="bond-value num">{{ shownTotal.toLocaleString('zh-CN') }}</strong>
        <span class="bond-sub">{{ companionText }}</span>
        <span v-if="board.myPercentile !== null" class="bond-badge">
          <Sparkles :size="11" aria-hidden="true" />心意超过 {{ board.myPercentile }}% 的旅人
        </span>
      </div>

      <div class="bond-actions">
        <button
          class="btn btn-pink"
          :disabled="board.syncing || board.status === 'unconfigured'"
          @click="board.syncAffection()"
        >
          <Heart :size="13" aria-hidden="true" />
          {{ board.syncing ? '同步中…' : board.lastSync ? '再次同步心意' : '同步心意' }}
        </button>
        <p class="bond-hint">{{ syncHint }}</p>
      </div>

      <div v-if="board.status === 'unconfigured'" class="net-banner">
        <Info :size="13" aria-hidden="true" />
        <span>当前是单机模式，心意记录在本地；联机开启后同步即可上榜。</span>
      </div>
      <div v-else-if="board.status === 'offline'" class="net-banner warn">
        <CloudOff :size="13" aria-hidden="true" />
        <span>网络未连接，榜单暂不可用；你的心意在本地安然无恙。</span>
      </div>
      <p v-if="board.lastError && board.status === 'ready'" class="bond-error">{{ board.lastError }}</p>
    </section>

    <!-- ═══ 心意同行榜 ═══ -->
    <section class="card bond-board">
      <header class="board-head">
        <span class="board-title">心意同行榜</span>
        <span class="board-note">只展示心意之和 —— 陪伴了谁，是彼此的秘密</span>
      </header>

      <div v-if="board.boardLoading && board.rows.length === 0" class="rows">
        <div v-for="n in 5" :key="n" class="row sk-row"><span class="sk" /></div>
      </div>

      <div v-else-if="board.rows.length === 0" class="empty">
        还没有人同步过心意 —— 你的第一次同步，就会是榜上的第一行。
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
          <span class="bond-num num"><Heart :size="10" aria-hidden="true" />{{ row.affectionTotal.toLocaleString('zh-CN') }}</span>
        </div>
      </div>

      <p class="board-foot">名次不发放任何竞技奖励 —— 陪伴本身就是奖励。</p>
    </section>
  </div>
</template>

<style scoped>
.bond {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

/* ═══ 你的陪伴英雄卡 ═══ */
.bond-hero {
  position: relative;
  overflow: hidden;
  padding: 16px 16px 14px;
}

.bond-aura {
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

/* 上浮心意粒子：大小、起点、时长全部错开，纯 CSS 零 JS 开销 */
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

.bond-head {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 10px;
}
.bond-title {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  font-size: 13px;
  font-weight: 800;
  color: var(--pink-deep);
}
.bond-tag {
  font-size: 10px;
  font-weight: 700;
  color: var(--pink-deep);
  background: var(--pink-soft);
  border-radius: 999px;
  padding: 3px 8px;
}

.bond-body {
  position: relative;
  display: flex;
  flex-direction: column;
  gap: 3px;
}
.bond-label {
  font-size: 11px;
  font-weight: 600;
  color: var(--text-dim);
}
.bond-value {
  font-size: 34px;
  font-weight: 900;
  line-height: 1.1;
  background: linear-gradient(120deg, var(--pink-deep), #b98cf7);
  -webkit-background-clip: text;
  background-clip: text;
  color: transparent;
}
.bond-sub {
  font-size: 11px;
  color: var(--text-dim);
}
.bond-badge {
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

.bond-actions {
  position: relative;
  margin-top: 12px;
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.bond-actions .btn {
  align-self: flex-start;
  display: inline-flex;
  align-items: center;
  gap: 6px;
}
.bond-hint {
  font-size: 10px;
  color: var(--text-dim);
}
.bond-error {
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
.bond-board {
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

.bond-num {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 13px;
  font-weight: 800;
  color: var(--pink-deep);
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
  .bond-hero {
    padding: 13px 12px 11px;
  }
  .bond-value {
    font-size: 28px;
  }
  .bond-board {
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
  .bond-num {
    font-size: 12px;
  }
  .rows {
    max-height: 400px;
  }
}

/* ═══ 减弱动效 ═══ */
@media (prefers-reduced-motion: reduce) {
  .bond-aura,
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
