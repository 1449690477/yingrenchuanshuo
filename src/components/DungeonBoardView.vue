<!--
  秘境榜（docs/51 §4 榜 5 · 网络层契约 docs/64）：一层一张榜的速通竞速。

  三条口径都是被数据逼出来的，不是审美（docs/64 §三）：
    1. 默认展示玩家打过的**最深那一层**，不是第 1 层 —— 低层的用时会
       成批撞在 200ms 下界上（满级玩家一帧秒杀），点开一屏 0.2 秒，
       玩家的第一反应是「这榜坏了」
    2. 并列按首通更早排，**且必须把这条规则写在榜上** —— 否则并列的人
       以为名次是随机的
    3. 老档没有记录不补记（同 docs/62 §4.1）：没有证据就不能主张

  与羁绊榜/进度榜同一条展示红线：弱化名次 —— 小号暗色、无奖牌、无皇冠。
  名次只是找到自己的锚点，不是攀比的刻度。
-->
<script setup lang="ts">
import { computed, onMounted } from 'vue';
import { Clock, CloudOff, Info, Layers, Sparkles } from '@lucide/vue';
import { useGameStore } from '@/stores/game';
import { useDungeonBoardStore } from '@/stores/dungeonBoard';
import { formatDungeonDuration } from '@/core/dungeonBoard';
import { EQUIPMENT_DUNGEON_TIERS } from '@/data/equipmentDungeonGear';
import ProfileAvatar from '@/components/ProfileAvatar.vue';

const game = useGameStore();
const board = useDungeonBoardStore();

const systemReduced =
  typeof window !== 'undefined' &&
  typeof window.matchMedia === 'function' &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const motionReduced = computed(() => systemReduced || Boolean(game.save?.settings.reduceMotion));

const tiers = computed(() =>
  board.openTierIds.map((id) => ({
    id,
    name: EQUIPMENT_DUNGEON_TIERS.find((tier) => tier.id === id)?.name ?? id,
    played: board.playedTierIds.includes(id),
  })),
);

const stages = computed(() =>
  board.selectedTierId ? board.stagesInTier(board.selectedTierId) : [],
);

const depths = computed(() =>
  board.selectedStageId ? board.depthsInStage(board.selectedStageId) : [],
);

/** 这一层我打没打过 —— 没打过的层照样能看榜，只是没有自己的成绩。 */
const myBest = computed(() => board.myLocalRecord);

const heroValue = computed(() =>
  myBest.value ? formatDungeonDuration(myBest.value.bestDurationMs) : '尚未通关',
);

const heroSub = computed(() => {
  const entry = board.selectedEntry;
  if (!entry) return '选一层看看谁最快';
  if (!myBest.value) return `${entry.name} —— 你还没有这一层的记录`;
  return `${entry.name} · 已通关 ${myBest.value.clears} 次`;
});

function fmtFirstClear(at: number): string {
  return `首通于 ${new Date(at).toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })}`;
}

function fmtRowTime(at: number): string {
  return new Date(at).toLocaleString('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

const syncHint = computed(() => {
  if (board.syncing) return '成绩同步中…';
  if (!myBest.value) return '打通这一层，你的用时就会出现在榜上';
  if (!board.lastSubmit) return '开榜时会自动把你的成绩交上去';
  // improved=false 是常态不是失败：没打得更快时什么都不该变（docs/64 §二）
  return board.lastSubmit.improved
    ? '成绩已更新 —— 榜上那行就是你'
    : '成绩已是最快，本次没有变化';
});

function selectTier(tierId: string): void {
  const firstStage = board.stagesInTier(tierId as never)[0]?.stageId;
  if (!firstStage) return;
  const target = board.depthsInStage(firstStage)[0];
  if (target) void board.selectDungeon(target.id);
}

function selectStage(stageId: string): void {
  const target = board.depthsInStage(stageId)[0];
  if (target) void board.selectDungeon(target.id);
}

onMounted(() => {
  void board.openBoard();
});
</script>

<template>
  <div class="depths">
    <!-- ═══ 我的最快 ═══ -->
    <section class="card depths-hero">
      <template v-if="!motionReduced">
        <span class="depths-aura" aria-hidden="true" />
      </template>

      <header class="depths-head">
        <span class="depths-title"><Layers :size="13" aria-hidden="true" />秘境速通</span>
        <span class="depths-tag">一层一张榜</span>
      </header>

      <div class="depths-body">
        <span class="depths-label">我的最快通关</span>
        <strong class="depths-value">{{ heroValue }}</strong>
        <span class="depths-sub">{{ heroSub }}</span>
        <span v-if="myBest" class="depths-time">{{ fmtFirstClear(myBest.firstClearedAt) }}</span>
        <span v-if="board.myRow" class="depths-badge">
          <Sparkles :size="11" aria-hidden="true" />当前第 {{ board.myRow.rank }} 名
        </span>
      </div>

      <p class="depths-hint">{{ syncHint }}</p>

      <div v-if="board.status === 'unconfigured'" class="net-banner">
        <Info :size="13" aria-hidden="true" />
        <span>当前是单机模式，秘境成绩记录在本地；联机开启后会自动上榜。</span>
      </div>
      <div v-else-if="board.status === 'offline'" class="net-banner warn">
        <CloudOff :size="13" aria-hidden="true" />
        <span>网络未连接，榜单暂不可用；你的通关记录在本地安然无恙。</span>
      </div>
      <p v-if="board.lastError && board.status === 'ready'" class="depths-error">
        {{ board.lastError }}
      </p>
    </section>

    <!-- ═══ 选层：档位 → 部位 → 层 ═══ -->
    <section class="card picker">
      <div class="picker-row" role="group" aria-label="选择档位">
        <button
          v-for="tier in tiers"
          :key="tier.id"
          class="chip"
          :class="{ on: tier.id === board.selectedTierId, dim: !tier.played }"
          type="button"
          @click="selectTier(tier.id)"
        >
          {{ tier.name }}
        </button>
      </div>

      <div class="picker-row sub" role="group" aria-label="选择部位">
        <button
          v-for="stage in stages"
          :key="stage.stageId"
          class="chip sm"
          :class="{ on: stage.stageId === board.selectedStageId }"
          type="button"
          @click="selectStage(stage.stageId)"
        >
          {{ stage.slotLabel }}
        </button>
      </div>

      <div class="picker-row sub" role="group" aria-label="选择深度">
        <button
          v-for="entry in depths"
          :key="entry.id"
          class="chip sm"
          :class="{ on: entry.id === board.selectedDungeonId }"
          type="button"
          @click="board.selectDungeon(entry.id)"
        >
          第 {{ entry.depth }} 层
        </button>
      </div>
    </section>

    <!-- ═══ 榜单 ═══ -->
    <section class="card depths-board">
      <header class="board-head">
        <span class="board-title"><Clock :size="12" aria-hidden="true" />最快通关榜</span>
        <!-- §3.2 硬要求：并列规则必须写在榜上，否则并列的人以为名次随机 -->
        <span class="board-note">用时越短越靠前 —— 用时相同时，更早首通者在前</span>
      </header>

      <div v-if="board.boardLoading && board.rows.length === 0" class="rows">
        <div v-for="n in 5" :key="n" class="row sk-row"><span class="sk" /></div>
      </div>

      <div v-else-if="board.rows.length === 0" class="empty">
        这一层还没有人上榜 —— 你的记录会是第一个。
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
          <span class="time-cell">
            <b>{{ formatDungeonDuration(row.bestDurationMs) }}</b>
            <small>{{ fmtRowTime(row.firstClearedAt) }}</small>
          </span>
        </div>
      </div>

      <p class="board-foot">名次不发放任何奖励 —— 打得更快这件事本身，就是奖励。</p>
    </section>
  </div>
</template>

<style scoped>
.depths {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

/* ═══ 我的最快 ═══ */
.depths-hero {
  position: relative;
  overflow: hidden;
  padding: 16px 16px 14px;
}

.depths-aura {
  position: absolute;
  right: -16%;
  top: -38%;
  width: 58%;
  aspect-ratio: 1;
  border-radius: 50%;
  background: radial-gradient(circle, var(--pink), transparent 62%);
  opacity: 0.3;
  filter: blur(8px);
  animation: depths-breathe 5.6s ease-in-out infinite;
  pointer-events: none;
}

@keyframes depths-breathe {
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

.depths-head {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 10px;
}
.depths-title {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  font-size: 13px;
  font-weight: 800;
  color: var(--pink-deep);
}
.depths-tag {
  font-size: 10px;
  font-weight: 700;
  color: var(--pink-deep);
  background: var(--pink-soft);
  border-radius: 999px;
  padding: 3px 8px;
}

.depths-body {
  position: relative;
  display: flex;
  flex-direction: column;
  gap: 3px;
}
.depths-label {
  font-size: 11px;
  font-weight: 600;
  color: var(--text-dim);
}
.depths-value {
  font-size: 26px;
  font-weight: 900;
  line-height: 1.15;
  font-variant-numeric: tabular-nums;
  background: linear-gradient(120deg, var(--pink-deep), #b98cf7);
  -webkit-background-clip: text;
  background-clip: text;
  color: transparent;
}
.depths-sub {
  font-size: 11px;
  color: var(--text-dim);
}
.depths-time {
  font-size: 10px;
  color: var(--text-dim);
  font-variant-numeric: tabular-nums;
}
.depths-badge {
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
.depths-hint {
  position: relative;
  margin-top: 8px;
  font-size: 11px;
  color: var(--text-dim);
}
.depths-error {
  margin-top: 6px;
  font-size: 11px;
  color: #d2544e;
}

/* ═══ 选层 ═══ */
.picker {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 12px;
}
.picker-row {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}
.chip {
  border: 1px solid var(--line);
  background: var(--card);
  color: var(--text);
  border-radius: 999px;
  padding: 5px 12px;
  font-size: 12px;
  font-weight: 700;
  cursor: pointer;
  transition:
    background 0.16s ease,
    color 0.16s ease,
    border-color 0.16s ease;
}
.chip.sm {
  padding: 4px 10px;
  font-size: 11px;
  font-weight: 600;
}
.chip.dim {
  color: var(--text-dim);
}
.chip.on {
  background: var(--pink-soft);
  border-color: var(--pink);
  color: var(--pink-deep);
}

/* ═══ 榜单 ═══ */
.board-head {
  display: flex;
  flex-direction: column;
  gap: 2px;
  margin-bottom: 8px;
}
.board-title {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  font-size: 13px;
  font-weight: 800;
  color: var(--pink-deep);
}
.board-note {
  font-size: 10px;
  color: var(--text-dim);
}
.rows {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.row {
  display: grid;
  grid-template-columns: 28px 1fr auto;
  align-items: center;
  gap: 8px;
  padding: 8px 10px;
  border-radius: 12px;
  background: var(--card-soft, rgba(255, 255, 255, 0.04));
}
.row.me {
  background: var(--pink-soft);
}
.row-in {
  animation: row-in 0.34s ease both;
  animation-delay: var(--row-delay, 0ms);
}
@keyframes row-in {
  from {
    opacity: 0;
    transform: translateY(6px);
  }
  to {
    opacity: 1;
    transform: none;
  }
}
.rank-no {
  font-size: 12px;
  font-weight: 800;
  text-align: center;
  font-variant-numeric: tabular-nums;
}
.rank-no.soft {
  color: var(--text-dim);
}
.who {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
}
.row-avatar {
  width: 28px;
  height: 28px;
  border-radius: 50%;
  flex: none;
}
.identity-line {
  display: inline-flex;
  align-items: baseline;
  gap: 5px;
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
}
.time-cell {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 1px;
}
.time-cell b {
  font-size: 13px;
  font-variant-numeric: tabular-nums;
}
.time-cell small {
  font-size: 10px;
  color: var(--text-dim);
  font-variant-numeric: tabular-nums;
}
.empty {
  padding: 20px 12px;
  text-align: center;
  font-size: 12px;
  color: var(--text-dim);
}
.board-foot {
  margin-top: 10px;
  font-size: 10px;
  color: var(--text-dim);
  text-align: center;
}
.sk-row {
  height: 44px;
}
.sk {
  display: block;
  width: 100%;
  height: 100%;
  border-radius: 8px;
  background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.08), transparent);
  animation: sk-shimmer 1.2s linear infinite;
}
@keyframes sk-shimmer {
  from {
    background-position: -200px 0;
  }
  to {
    background-position: 200px 0;
  }
}
</style>
