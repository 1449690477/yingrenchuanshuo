<script setup lang="ts">
/**
 * ArenaView —— 竞技场（docs/54-竞技场对战设计.md §十 UI 规格）。
 *
 * 一屏立即决策 = 2（挑谁、押多少）：
 *   1. 段位/排名/荣誉英雄卡（横幅 + 段位徽章 + 光尘粒子）
 *   2. 反击机会条（有才显示，措辞中性：「反击机会 ×1」）
 *   3. 今日对手三选一（名次/职业/战力/服务端预估胜率）
 *   4. 押注三档 + 发起挑战（唯一主按钮）
 *   5. 昨日防线战报条（战绩，不是受害通知）
 *   6. 荣誉商店（圣痕套全员可得）
 *
 * 红线落实（docs/40）：
 *   - 不显示「你的排名下降了」「XXX 超越了你」
 *   - 剩余次数用完显示「明天见」，没有「购买次数」
 *   - 战报播成战斗动画（ArenaBattleScene），不是结果弹窗
 */
import { computed, onMounted, ref } from 'vue';
import { CloudOff, Coins, RotateCcw, Shield, Swords, Trophy } from '@lucide/vue';
import { abbr } from '@/core/format';
import { AFFECTION_CHARACTERS } from '@/data/affection';
import { CLASS_VISUALS } from '@/data/classVisuals';
import { ARENA_STAKES, ARENA_TIERS } from '@/data/arenaRules';
import { useArenaStore } from '@/stores/arena';
import { useGameStore } from '@/stores/game';
import type { ArenaCandidate, ArenaRevengeEntry } from '@/net/arena';
import ArenaBattleScene from '@/components/arena/ArenaBattleScene.vue';
import ArenaHonorShop from '@/components/arena/ArenaHonorShop.vue';

const arena = useArenaStore();
const game = useGameStore();

const BASE = import.meta.env.BASE_URL;
const assetUrl = (path: string) => `${BASE}${path}`;

const systemReduced =
  typeof window !== 'undefined' &&
  typeof window.matchMedia === 'function' &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const motionReduced = computed(() => systemReduced || Boolean(game.save?.settings.reduceMotion));

// ─────────── 段位展示 ───────────
const tierInfo = computed(
  () => ARENA_TIERS.find((t) => t.id === arena.me?.tier) ?? ARENA_TIERS[ARENA_TIERS.length - 1]!,
);
const tierBadge = computed(() => assetUrl(`assets/arena/tier-${tierInfo.value.id}.png`));

const className = (id: string) =>
  AFFECTION_CHARACTERS[id as keyof typeof AFFECTION_CHARACTERS]?.name ?? id;
const classSymbol = (id: string) => CLASS_VISUALS[id as keyof typeof CLASS_VISUALS]?.symbol ?? '·';

// ─────────── 候选选择 ───────────
const selectedId = ref<string | null>(null);
const selected = computed(
  () => arena.candidates.find((c) => c.userId === selectedId.value) ?? null,
);
function pick(candidate: ArenaCandidate): void {
  selectedId.value = candidate.userId;
}

const winRatePct = (rate: number) => Math.round(rate * 100);
const winRateTone = (rate: number) => (rate >= 0.6 ? 'high' : rate >= 0.4 ? 'mid' : 'low');

// ─────────── 挑战 ───────────
const replayKey = ref(0);
const showReplay = computed(() => arena.lastBattle !== null);

const challengeDisabled = computed(() => {
  if (arena.challenging) return true;
  if (arena.attemptsLeft <= 0) return true;
  if ((arena.me?.honor ?? 0) < arena.stake) return true;
  return !selected.value;
});
const challengeLabel = computed(() => {
  if (arena.attemptsLeft <= 0) return '明天见';
  if (!selected.value) return '先挑一位对手';
  if ((arena.me?.honor ?? 0) < arena.stake) return '荣誉印记不足';
  if (arena.challenging) return '对决中…';
  return '发起挑战';
});

async function onChallenge(): Promise<void> {
  if (!selected.value || challengeDisabled.value) return;
  const target = selected.value;
  const result = await arena.challenge(target);
  if (result) replayKey.value++;
}

function onReplayComplete(): void {
  arena.clearLastBattle();
  // 刷新后候选窗口已变，清掉选中让玩家重新决策
  selectedId.value = null;
}

// ─────────── 反击 ───────────
async function onRevenge(entry: ArenaRevengeEntry): Promise<void> {
  if (arena.challenging) return;
  const result = await arena.challengeRevenge(entry);
  if (result) replayKey.value++;
}

// ─────────── 昨日防线战报（最新一条结算） ───────────
const latestSettle = computed(() => arena.settleReports[0] ?? null);

onMounted(() => {
  if (arena.status !== 'ready' && arena.status !== 'connecting') {
    void arena.refresh();
  }
});
</script>

<template>
  <div class="arena">
    <!-- ═══ 英雄卡：段位 · 排名 · 荣誉 ═══ -->
    <section class="hero-card">
      <img
        :src="assetUrl('assets/arena/arena-banner.webp')"
        alt=""
        class="hero-bg"
        aria-hidden="true"
      />
      <span class="hero-aura" aria-hidden="true" />
      <i v-for="n in 10" :key="n" class="mote" :class="`mote-${n}`" aria-hidden="true" />

      <header class="hero-head">
        <span class="hero-title"><Trophy :size="13" aria-hidden="true" />竞技场</span>
        <span class="attempts-chip">
          今日挑战 <b>{{ arena.me?.attemptsLeft ?? 0 }}/{{ arena.me?.attemptsMax ?? 5 }}</b>
        </span>
      </header>

      <div class="hero-body">
        <span class="badge-wrap">
          <img :src="tierBadge" :alt="`${tierInfo.name}徽章`" class="tier-badge" />
        </span>
        <div class="hero-stats">
          <span class="hero-tier">{{ tierInfo.name }}</span>
          <strong class="hero-rank">
            第 {{ arena.me?.rank ?? '—' }} 名
            <small>/ {{ arena.me?.total ?? '—' }} 人</small>
          </strong>
          <span class="hero-honor">
            <img :src="assetUrl('assets/items/honor_sigil.png')" alt="荣誉印记" />
            {{ arena.me?.honor ?? 0 }}
            <em v-if="(arena.me?.winStreak ?? 0) >= 2" class="streak">
              {{ arena.me!.winStreak }} 连胜
            </em>
          </span>
        </div>
      </div>
    </section>

    <!-- ═══ 联机状态条（未配置 / 离线，静默降级不阻塞） ═══ -->
    <div v-if="arena.status === 'unconfigured'" class="state-strip">
      <CloudOff :size="13" aria-hidden="true" />
      联机未配置，竞技场需要连接后开启
    </div>
    <div v-else-if="arena.status === 'offline'" class="state-strip">
      <CloudOff :size="13" aria-hidden="true" />
      暂时连不上竞技场，稍后再来看看
    </div>
    <div v-else-if="arena.loading && !arena.me" class="state-strip loading">正在进入竞技场…</div>
    <div v-else-if="arena.lastError" class="state-strip error" role="alert">
      {{ arena.lastError }}
    </div>

    <template v-if="arena.me">
      <!-- ═══ 反击机会（有才显示，措辞中性） ═══ -->
      <section v-if="arena.revenge.length > 0" class="card revenge-strip">
        <div v-for="entry in arena.revenge" :key="entry.userId" class="revenge-row">
          <span class="revenge-label"><RotateCcw :size="12" aria-hidden="true" />反击机会 ×1</span>
          <span class="revenge-target">
            {{ classSymbol(entry.classId) }} {{ entry.displayName }}
            <small>#{{ entry.rank }} · 胜率 {{ winRatePct(entry.winRate) }}%</small>
          </span>
          <button
            class="revenge-btn"
            type="button"
            :disabled="arena.challenging"
            @click="onRevenge(entry)"
          >
            去
          </button>
        </div>
      </section>

      <!-- ═══ 今日对手（三选一，服务端挑选） ═══ -->
      <section class="card opponents">
        <header class="opponents-head">
          <span class="opponents-title"><Swords :size="13" aria-hidden="true" />今日对手</span>
          <span class="opponents-hint">只能挑战排名在自己上方的人</span>
        </header>

        <div v-if="arena.candidates.length === 0" class="opponents-empty">
          <span class="empty-crown"><Trophy :size="17" aria-hidden="true" /></span>
          <strong>你已经站在最顶端了</strong>
          <small>今天没有可挑战的对手，守住排名，明天再见</small>
        </div>
        <div v-else class="opponent-grid" role="radiogroup" aria-label="选择挑战对手">
          <button
            v-for="candidate in arena.candidates"
            :key="candidate.userId"
            class="opponent-card"
            :class="{ selected: selectedId === candidate.userId }"
            type="button"
            role="radio"
            :aria-checked="selectedId === candidate.userId"
            @click="pick(candidate)"
          >
            <span class="opp-rank">#{{ candidate.rank }}</span>
            <span class="opp-symbol" aria-hidden="true">{{ classSymbol(candidate.classId) }}</span>
            <span class="opp-name">{{ candidate.displayName }}</span>
            <span class="opp-meta">
              {{ className(candidate.classId) }} · 战力 {{ abbr(candidate.combatPower) }}
            </span>
            <span class="opp-rate" :data-tone="winRateTone(candidate.winRate)">
              <i :style="{ width: `${winRatePct(candidate.winRate)}%` }" />
              <b>胜率 {{ winRatePct(candidate.winRate) }}%</b>
            </span>
          </button>
        </div>
      </section>

      <!-- ═══ 押注 + 发起挑战 ═══ -->
      <section class="card stake-card">
        <div class="stake-row" role="radiogroup" aria-label="选择押注档位">
          <span class="stake-label"><Coins :size="12" aria-hidden="true" />押注</span>
          <button
            v-for="value in ARENA_STAKES"
            :key="value"
            class="stake-pill"
            :class="{ active: arena.stake === value }"
            type="button"
            role="radio"
            :aria-checked="arena.stake === value"
            @click="arena.stake = value"
          >
            {{ value }}
          </button>
        </div>
        <button
          class="challenge-btn"
          type="button"
          :disabled="challengeDisabled"
          @click="onChallenge"
        >
          <Swords :size="15" aria-hidden="true" />
          {{ challengeLabel }}
        </button>
      </section>

      <!-- ═══ 昨日防线战报（战绩，不是受害通知） ═══ -->
      <section v-if="latestSettle" class="card defense-report">
        <Shield :size="13" aria-hidden="true" />
        <span class="defense-text">
          昨日防线：{{ latestSettle.defense.challenged }} 战 {{ latestSettle.defense.held }} 守
          <b>+{{ latestSettle.defense.reward + latestSettle.tierHonor }}</b> 荣誉
        </span>
        <span class="defense-tier">{{ latestSettle.tierName }}嘉奖</span>
      </section>

      <!-- ═══ 荣誉商店 ═══ -->
      <ArenaHonorShop />
    </template>

    <!-- ═══ 战报回放（服务端复算的逐回合日志播成战斗动画） ═══ -->
    <ArenaBattleScene
      v-if="showReplay && arena.lastBattle"
      :key="replayKey"
      :battle="arena.lastBattle.battle"
      :attacker-name="game.player?.name ?? '挑战者'"
      :defender-name="'对手'"
      :attacker-class="game.save?.player.classId ?? 'swordsman'"
      :defender-class="selected?.classId ?? 'swordsman'"
      :won="arena.lastBattle.won"
      :honor-delta="arena.lastBattle.honorDelta"
      :playback-key="replayKey"
      :reduce-motion="motionReduced"
      @complete="onReplayComplete"
    />
  </div>
</template>

<style scoped>
.arena {
  display: flex;
  flex-direction: column;
  gap: 14px;
  padding-bottom: 8px;
}

/* ── 英雄卡 ── */
.hero-card {
  position: relative;
  border-radius: var(--r-lg);
  overflow: hidden;
  border: 1px solid rgb(232 172 31 / 35%);
  box-shadow: 0 8px 28px rgb(232 172 31 / 18%);
  background: linear-gradient(160deg, #2b2416, #463517 55%, #2b2416);
  min-height: 148px;
}
.hero-bg {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  object-fit: cover;
  opacity: 0.34;
}

/* 左侧压暗渐变：文字区对比度保障，背景图不再抢层次 */
.hero-card::after {
  content: '';
  position: absolute;
  z-index: 1;
  inset: 0;
  background: linear-gradient(
    95deg,
    rgb(24 18 8 / 72%) 8%,
    rgb(24 18 8 / 38%) 52%,
    transparent 82%
  );
  pointer-events: none;
}
.hero-aura {
  position: absolute;
  z-index: 2;
  inset: -30%;
  background: conic-gradient(from 90deg, transparent, rgb(255 217 138 / 18%), transparent 32%);
  animation: aura-spin 9s linear infinite;
  pointer-events: none;
}
@keyframes aura-spin {
  to {
    transform: rotate(360deg);
  }
}

.mote {
  position: absolute;
  z-index: 2;
  bottom: -6px;
  width: 4px;
  height: 4px;
  border-radius: 50%;
  background: radial-gradient(circle, #ffe9b0, rgb(255 200 96 / 0%));
  opacity: 0;
  animation: mote-rise 6.5s linear infinite;
  pointer-events: none;
}
.mote-1 {
  left: 10%;
  animation-delay: 0s;
}
.mote-2 {
  left: 22%;
  animation-delay: 1.2s;
  animation-duration: 7.4s;
}
.mote-3 {
  left: 34%;
  animation-delay: 2.6s;
}
.mote-4 {
  left: 46%;
  animation-delay: 0.6s;
  animation-duration: 8s;
}
.mote-5 {
  left: 55%;
  animation-delay: 3.4s;
}
.mote-6 {
  left: 64%;
  animation-delay: 1.8s;
  animation-duration: 7s;
}
.mote-7 {
  left: 73%;
  animation-delay: 4.2s;
}
.mote-8 {
  left: 82%;
  animation-delay: 0.9s;
  animation-duration: 8.6s;
}
.mote-9 {
  left: 90%;
  animation-delay: 2.2s;
}
.mote-10 {
  left: 96%;
  animation-delay: 3s;
  animation-duration: 7.8s;
}

@keyframes mote-rise {
  0% {
    transform: translateY(0) scale(0.6);
    opacity: 0;
  }
  15% {
    opacity: 0.95;
  }
  100% {
    transform: translateY(-150px) scale(1.05);
    opacity: 0;
  }
}

.hero-head {
  position: relative;
  z-index: 2;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 14px 0;
}
.hero-title {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 13px;
  font-weight: 800;
  color: #ffe9b0;
  letter-spacing: 0.06em;
}
.attempts-chip {
  font-size: 11px;
  color: rgb(255 233 176 / 85%);
  background: rgb(0 0 0 / 28%);
  border: 1px solid rgb(255 217 138 / 35%);
  border-radius: 999px;
  padding: 4px 10px;
}
.attempts-chip b {
  color: #ffd98a;
}

.hero-body {
  position: relative;
  z-index: 2;
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 10px 16px 16px;
}
/* 段位徽章光环脉冲：呼吸的金色圆环，荣誉感的来源 */
.badge-wrap {
  position: relative;
  display: grid;
  flex-shrink: 0;
  place-items: center;
}

.badge-wrap::before,
.badge-wrap::after {
  content: '';
  position: absolute;
  inset: -6px;
  border: 1.5px solid rgb(255 217 138 / 55%);
  border-radius: 50%;
  animation: badge-pulse 2.6s var(--ease-soft) infinite;
  pointer-events: none;
}

.badge-wrap::after {
  animation-delay: 1.3s;
}

@keyframes badge-pulse {
  0% {
    opacity: 0.9;
    transform: scale(0.82);
  }
  70% {
    opacity: 0;
    transform: scale(1.28);
  }
  100% {
    opacity: 0;
    transform: scale(1.28);
  }
}

.tier-badge {
  width: 64px;
  height: 64px;
  filter: drop-shadow(0 4px 14px rgb(255 200 96 / 45%));
  animation: badge-float 4s ease-in-out infinite;
}
@keyframes badge-float {
  0%,
  100% {
    transform: translateY(0);
  }
  50% {
    transform: translateY(-5px);
  }
}

.hero-stats {
  display: flex;
  flex-direction: column;
  gap: 3px;
}
.hero-tier {
  font-size: 12px;
  font-weight: 700;
  color: rgb(255 233 176 / 80%);
}
.hero-rank {
  display: flex;
  align-items: center;
  gap: 5px;
  font-size: 22px;
  font-weight: 900;
  color: #fff;
  line-height: 1.1;
}
.hero-rank small {
  font-size: 11px;
  font-weight: 600;
  color: rgb(255 255 255 / 62%);
}
.hero-honor {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  font-size: 15px;
  font-weight: 900;
  color: #ffd98a;
}
.hero-honor img {
  width: 17px;
  height: 17px;
}
.streak {
  font-size: 10px;
  font-style: normal;
  font-weight: 800;
  color: #fff;
  background: linear-gradient(135deg, #f5799f, #ff9ec4);
  border-radius: 999px;
  padding: 2px 8px;
  margin-left: 4px;
}

/* ── 状态条 ── */
.state-strip {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  color: var(--text-mid);
  background: var(--panel-2);
  border: 1px dashed var(--line-strong);
  border-radius: var(--r-sm);
  padding: 10px 12px;
}
.state-strip.error {
  color: var(--danger);
  border-color: rgb(255 129 137 / 40%);
}
.state-strip.loading {
  color: var(--text-dim);
}

/* ── 反击条 ── */
.revenge-strip {
  padding: 10px 12px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.revenge-row {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 10px;
  border-radius: var(--r-sm);
  background: linear-gradient(90deg, rgb(213 87 217 / 10%), rgb(171 111 224 / 5%));
  border: 1px solid rgb(171 111 224 / 28%);
  animation: row-in 0.4s var(--ease-out-back);
}
.revenge-label {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 11px;
  font-weight: 800;
  color: #ab6fe0;
  white-space: nowrap;
}
.revenge-target {
  flex: 1;
  min-width: 0;
  font-size: 12px;
  font-weight: 700;
  color: var(--text);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.revenge-target small {
  display: block;
  font-weight: 500;
  color: var(--text-dim);
}
.revenge-btn {
  border: none;
  border-radius: 999px;
  padding: 6px 14px;
  font-size: 12px;
  font-weight: 800;
  color: #fff;
  background: linear-gradient(135deg, #ab6fe0, #d557d9);
  cursor: pointer;
  transition: transform 0.15s var(--ease-spring);
}
.revenge-btn:active:not(:disabled) {
  transform: scale(0.9);
}
.revenge-btn:disabled {
  opacity: 0.4;
}

/* ── 今日对手 ── */
.opponents {
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.opponents-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}
.opponents-title {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 14px;
  font-weight: 800;
  color: var(--text);
}
.opponents-hint {
  font-size: 10px;
  color: var(--text-dim);
}
.opponents-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 3px;
  padding: 20px 10px 18px;
  text-align: center;
  background:
    radial-gradient(90% 130% at 50% -30%, rgb(255 217 138 / 22%), transparent 60%), var(--panel-2);
  border: 1px solid rgb(232 172 31 / 26%);
  border-radius: var(--r-sm);
}

.empty-crown {
  display: grid;
  width: 38px;
  height: 38px;
  place-items: center;
  margin-bottom: 3px;
  color: #fff;
  background: linear-gradient(150deg, #f6cf6a, #dfa018);
  border-radius: 50%;
  box-shadow:
    inset 0 1px 0 rgb(255 255 255 / 45%),
    0 4px 12px rgb(232 172 31 / 38%);
}

.opponents-empty strong {
  font-size: 13px;
  font-weight: 800;
  color: var(--text);
}

.opponents-empty small {
  font-size: 10px;
  color: var(--text-dim);
}

.opponent-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 8px;
}
.opponent-card {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  padding: 12px 6px 10px;
  border-radius: var(--r);
  background: var(--panel-2);
  border: 2px solid var(--line);
  cursor: pointer;
  transition:
    transform 0.18s var(--ease-spring),
    border-color 0.18s,
    box-shadow 0.18s;
  animation: row-in 0.45s var(--ease-out-back) backwards;
}
.opponent-card:nth-child(2) {
  animation-delay: 0.07s;
}
.opponent-card:nth-child(3) {
  animation-delay: 0.14s;
}
.opponent-card:active {
  transform: scale(0.94);
}
.opponent-card.selected {
  border-color: var(--q-divine);
  background: linear-gradient(180deg, rgb(255 200 96 / 12%), var(--panel-2));
  animation: selected-glow 2.2s ease-in-out infinite;
}

/* 选中金光脉冲：呼吸的金色光晕，锁定感一眼可见 */
@keyframes selected-glow {
  0%,
  100% {
    box-shadow:
      0 0 0 3px rgb(232 172 31 / 18%),
      0 6px 18px rgb(232 172 31 / 25%);
  }
  50% {
    box-shadow:
      0 0 0 5px rgb(232 172 31 / 26%),
      0 8px 24px rgb(232 172 31 / 38%);
  }
}

/* 选中对勾角标：让「已锁定这位对手」一眼可辨 */
.opponent-card.selected::after {
  content: '✓';
  position: absolute;
  top: -7px;
  right: -5px;
  display: grid;
  width: 20px;
  height: 20px;
  place-items: center;
  font-size: 11px;
  font-weight: 900;
  color: #fff;
  background: linear-gradient(150deg, #f6cf6a, #dfa018);
  border: 2px solid #fff;
  border-radius: 50%;
  box-shadow: 0 2px 7px rgb(232 172 31 / 42%);
  animation: check-pop 0.3s var(--ease-out-back) both;
}

@keyframes check-pop {
  from {
    opacity: 0;
    transform: scale(0.4);
  }
  to {
    opacity: 1;
    transform: scale(1);
  }
}

@media (hover: hover) and (pointer: fine) {
  .opponent-card:hover {
    border-color: rgb(232 172 31 / 45%);
    box-shadow: 0 5px 14px rgb(96 74 32 / 12%);
    transform: translateY(-2px);
  }
}

.opp-rank {
  position: absolute;
  top: 6px;
  left: 8px;
  font-size: 10px;
  font-weight: 800;
  color: var(--text-dim);
}
.opponent-card.selected .opp-rank {
  color: var(--q-divine);
}
.opp-symbol {
  font-size: 26px;
  line-height: 1.2;
  margin-top: 6px;
}
.opp-name {
  font-size: 12px;
  font-weight: 800;
  color: var(--text);
  max-width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.opp-meta {
  font-size: 9px;
  color: var(--text-dim);
}

.opp-rate {
  position: relative;
  width: 100%;
  height: 16px;
  border-radius: 999px;
  background: var(--panel-3);
  overflow: hidden;
  margin-top: 2px;
}
.opp-rate i {
  position: absolute;
  inset: 0 auto 0 0;
  border-radius: 999px;
  transition: width 0.5s var(--ease-soft);
}
.opp-rate[data-tone='high'] i {
  background: linear-gradient(90deg, #7be3a8, #5fcf95);
}
.opp-rate[data-tone='mid'] i {
  background: linear-gradient(90deg, #ffd98a, #ffb454);
}
.opp-rate[data-tone='low'] i {
  background: linear-gradient(90deg, #ff9aa2, #ff8189);
}
.opp-rate b {
  position: relative;
  z-index: 1;
  font-size: 9px;
  font-weight: 800;
  color: var(--text);
  line-height: 16px;
}

/* ── 押注与挑战 ── */
.stake-card {
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.stake-row {
  display: flex;
  align-items: center;
  gap: 8px;
}
.stake-label {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 12px;
  font-weight: 700;
  color: var(--text-mid);
  margin-right: 2px;
}
.stake-pill {
  flex: 1;
  border: 2px solid var(--line);
  border-radius: 999px;
  padding: 8px 0;
  font-size: 14px;
  font-weight: 900;
  color: var(--text-mid);
  background: var(--panel-2);
  cursor: pointer;
  transition: all 0.18s var(--ease-spring);
}
.stake-pill:active {
  transform: scale(0.93);
}
.stake-pill.active {
  color: #fff;
  border-color: rgb(255 255 255 / 65%);
  background: linear-gradient(135deg, #f5799f, #ffb37a 78%, #ecc063 125%);
  box-shadow:
    inset 0 1px 0 rgb(255 255 255 / 38%),
    0 4px 14px rgb(245 121 159 / 34%);
  text-shadow: 0 1px 3px rgb(173 62 104 / 35%);
  animation: stake-pop 0.34s var(--ease-out-back) both;
}

/* 押注切换 pop：选中瞬间轻弹一下，确认手感 */
@keyframes stake-pop {
  0% {
    transform: scale(0.88);
  }
  62% {
    transform: scale(1.06);
  }
  100% {
    transform: scale(1);
  }
}

.challenge-btn {
  position: relative;
  overflow: hidden;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  border: 1px solid rgb(255 255 255 / 55%);
  border-radius: var(--r);
  padding: 14px 0;
  font-size: 16px;
  font-weight: 900;
  letter-spacing: 0.06em;
  color: #fff;
  background: linear-gradient(120deg, #f5799f 8%, #ff9e8a 52%, #ecc063 108%);
  box-shadow:
    inset 0 1px 0 rgb(255 255 255 / 34%),
    0 6px 20px rgb(245 121 159 / 36%);
  cursor: pointer;
  text-shadow: 0 1px 4px rgb(173 62 104 / 38%);
  transition:
    transform 0.16s var(--ease-spring),
    box-shadow 0.16s,
    opacity 0.16s;
}

/* 主按钮流光：待命时缓缓扫过，提示「可以点我」 */
.challenge-btn:not(:disabled)::after {
  content: '';
  position: absolute;
  inset: 0;
  background: linear-gradient(100deg, transparent 25%, rgb(255 255 255 / 42%) 50%, transparent 75%);
  transform: translateX(-120%) skewX(-14deg);
  animation: btn-shine 2.8s var(--ease-soft) infinite;
  pointer-events: none;
}

@keyframes btn-shine {
  0% {
    transform: translateX(-120%) skewX(-14deg);
  }
  46% {
    transform: translateX(120%) skewX(-14deg);
  }
  100% {
    transform: translateX(120%) skewX(-14deg);
  }
}

.challenge-btn:active:not(:disabled) {
  transform: scale(0.96);
}
.challenge-btn:disabled {
  opacity: 0.45;
  box-shadow: none;
  cursor: default;
}

/* ── 防线战报条 ── */
.defense-report {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 12px;
  font-size: 12px;
  color: var(--text-mid);
  background: linear-gradient(90deg, rgb(126 200 242 / 10%), var(--panel-2));
  border-color: rgb(126 200 242 / 30%);
  animation: row-in 0.4s var(--ease-out-back);
}
.defense-text b {
  color: var(--blue-deep);
  font-weight: 900;
}
.defense-tier {
  margin-left: auto;
  font-size: 10px;
  font-weight: 800;
  color: var(--q-divine);
}

@keyframes row-in {
  from {
    opacity: 0;
    transform: translateY(10px);
  }
  to {
    opacity: 1;
    transform: none;
  }
}

/* ── 小屏适配（320×568 下限） ── */
@media (max-width: 340px) {
  .tier-badge {
    width: 52px;
    height: 52px;
  }
  .hero-rank {
    font-size: 19px;
  }
  .opp-symbol {
    font-size: 22px;
  }
  .opp-name {
    font-size: 11px;
  }
  .challenge-btn {
    font-size: 14px;
    padding: 12px 0;
  }
}

@media (prefers-reduced-motion: reduce) {
  .mote,
  .hero-aura {
    display: none;
  }
  .tier-badge {
    animation: none;
  }
  .opponent-card,
  .revenge-row,
  .defense-report {
    animation: none;
  }
  .challenge-btn::after {
    display: none;
  }
  .opponent-card.selected::after {
    animation: none;
  }
  .badge-wrap::before,
  .badge-wrap::after {
    display: none;
  }
  .opponent-card.selected,
  .stake-pill.active {
    animation: none;
  }
}
</style>
