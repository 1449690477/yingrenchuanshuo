<script setup lang="ts">
/**
 * RankView —— 联机排行榜（docs/51-联机排行榜设计方案.md）。
 *
 * 结构严格按方案 §8 的 UI 规格：
 *   1. 周常试炼英雄卡（本周 Boss + 词条倾向提示 + 中性倒计时）
 *   2. 我的成绩卡（最好成绩 + 只在上升时出现的环比箭头 + 唯一主决策「挑战」）
 *   3. 榜单卡（「你附近」是默认视图！前 100 / 战力榜是次级页签）
 *
 * 红线落实：
 *   - 没有「你被超越了」、没有掉名提示、没有名次下降动画
 *   - 倒计时用中性措辞（「剩余 3 天」），不用「仅剩！」
 *   - 一屏内立即决策只有一个：挑战
 */
import { computed, onMounted, onUnmounted, ref, shallowRef } from 'vue';
import {
  CloudOff,
  Flag,
  Flame,
  Info,
  Pencil,
  RefreshCw,
  Snowflake,
  Sparkles,
  Swords,
  Timer,
  Upload,
  Zap,
} from '@lucide/vue';
import type { SupabaseClient } from '@supabase/supabase-js';
import { abbr, duration, pct } from '@/core/format';
import { trialWeekRemainingMs, upperPercentText } from '@/core/trial';
import type { ClassId, Element } from '@/core/types';
import { AFFECTION_CHARACTERS } from '@/data/affection';
import { CLASS_VISUALS } from '@/data/classVisuals';
import { ELEMENT_LABELS } from '@/data/trialRules';
import { useGameStore } from '@/stores/game';
import { useLeaderboardStore, type TrialChallengeOutcome } from '@/stores/leaderboard';
import type { TrialSubmitResult } from '@/net/leaderboard';
import { getSupabaseClient } from '@/net/supabase';
import { reportProfile, type PlayerProfile } from '@/net/profile';
import ProfileAvatar from '@/components/ProfileAvatar.vue';
import ProfileEditor from '@/components/ProfileEditor.vue';
import TrialBattleScene from '@/components/TrialBattleScene.vue';

const game = useGameStore();
const lb = useLeaderboardStore();

// ─────────── 减弱动效（设置项 + 系统偏好，任一开启都生效） ───────────
const systemReduced =
  typeof window !== 'undefined' &&
  typeof window.matchMedia === 'function' &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const motionReduced = computed(() => systemReduced || Boolean(game.save?.settings.reduceMotion));

// ─────────── 职业 / 元素展示 ───────────
const className = (id: ClassId) => AFFECTION_CHARACTERS[id]?.name ?? id;
const classSymbol = (id: ClassId) => CLASS_VISUALS[id]?.symbol ?? '·';
const ELEMENT_ICONS = { fire: Flame, ice: Snowflake, thunder: Zap, none: Sparkles } as const;
const elementIcon = computed(() => ELEMENT_ICONS[lb.boss.combatant.element as Element]);
const elementLabel = computed(() => ELEMENT_LABELS[lb.boss.combatant.element as Element]);

// ─────────── 中性倒计时：周一 04:00 重置 ───────────
const nowTick = ref(Date.now());
let tickTimer = 0;
const remainingText = computed(() => {
  const seconds = Math.ceil(trialWeekRemainingMs(nowTick.value) / 1000);
  return `剩余 ${duration(seconds)}`;
});

// ─────────── 挑战（确定性模拟，成绩与服务端复算逐点一致） ───────────
const challenging = ref(false);
const outcome = ref<TrialChallengeOutcome | null>(null);
const pendingOutcome = ref<TrialChallengeOutcome | null>(null);
const battleRun = ref<TrialChallengeOutcome['result'] | null>(null);
const playbackKey = ref(0);
const displayDamage = ref(0);
let countUpFrame = 0;

function animateCountUp(target: number, durationMs = 900): void {
  cancelAnimationFrame(countUpFrame);
  if (motionReduced.value) {
    displayDamage.value = target;
    return;
  }
  const start = performance.now();
  const step = (t: number) => {
    const p = Math.min(1, (t - start) / durationMs);
    const eased = 1 - Math.pow(1 - p, 3);
    displayDamage.value = Math.round(target * eased);
    if (p < 1) countUpFrame = requestAnimationFrame(step);
  };
  countUpFrame = requestAnimationFrame(step);
}

function onChallenge(): void {
  if (challenging.value) return;
  challenging.value = true;
  outcome.value = null;
  try {
    const next = lb.challengeTrial();
    pendingOutcome.value = next;
    battleRun.value = next.result;
    playbackKey.value++;
  } catch (error) {
    challenging.value = false;
    throw error;
  }
}

function onBattleComplete(completedKey: number): void {
  if (completedKey !== playbackKey.value || !pendingOutcome.value) return;
  outcome.value = pendingOutcome.value;
  pendingOutcome.value = null;
  challenging.value = false;
  displayDamage.value = 0;
  animateCountUp(outcome.value.result.damage);
}

function closeOutcome(): void {
  outcome.value = null;
}

// ─────────── 上传成绩（玩家主动触发；载荷只有搭配，没有伤害） ───────────
const toast = ref<{ text: string; ok: boolean } | null>(null);
let toastTimer = 0;
function say(text: string, ok: boolean): void {
  toast.value = { text, ok };
  clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => (toast.value = null), 3200);
}

// ─────────── 玩家公开档案（与游戏角色名解耦） ───────────
// SupabaseClient 是带私有字段的类，必须 shallowRef，避免 Vue 深层解包破坏类型身份。
const profileClient = shallowRef<SupabaseClient | null>(null);
const profileOpen = ref(false);

async function requireProfileClient(): Promise<SupabaseClient | null> {
  if (!(await lb.connect())) {
    say(lb.lastError ?? '联机档案暂不可用，请稍后重试', false);
    return null;
  }
  const client = await getSupabaseClient();
  if (!client || !lb.userId) {
    say('联机档案暂不可用，请稍后重试', false);
    return null;
  }
  profileClient.value = client;
  return client;
}

async function openProfileEditor(): Promise<void> {
  if (!(await requireProfileClient())) return;
  profileOpen.value = true;
}

async function onProfileSaved(_profile: PlayerProfile): Promise<void> {
  say('榜单档案已更新', true);
  await lb.refreshBoards(true);
}

interface ReportTarget {
  userId: string;
  displayName: string;
}

const reportTarget = ref<ReportTarget | null>(null);
const reportReason = ref('');
const reporting = ref(false);
const canReport = computed(
  () => Boolean(reportTarget.value) && reportReason.value.trim().length > 0 && !reporting.value,
);

function openReport(target: ReportTarget): void {
  if (target.userId === lb.userId) return;
  reportTarget.value = target;
  reportReason.value = '';
}

function closeReport(): void {
  if (reporting.value) return;
  reportTarget.value = null;
  reportReason.value = '';
}

async function submitReport(): Promise<void> {
  if (!canReport.value || !reportTarget.value) return;
  const client = await requireProfileClient();
  if (!client || !lb.userId) return;
  reporting.value = true;
  try {
    await reportProfile(client, {
      reporterId: lb.userId,
      targetId: reportTarget.value.userId,
      reason: reportReason.value,
    });
    say('已收到举报，我们会人工核查', true);
    reportTarget.value = null;
    reportReason.value = '';
  } catch (error) {
    say(error instanceof Error ? error.message : '举报失败，请稍后重试', false);
  } finally {
    reporting.value = false;
  }
}

const canUpload = computed(
  () =>
    lb.myBestThisWeek !== null &&
    !lb.myBestThisWeek.submitted &&
    (lb.status === 'ready' || lb.status === 'offline'),
);

async function onUpload(): Promise<void> {
  if (lb.submitting) return;
  const res: TrialSubmitResult | null = await lb.submitBest();
  if (res) {
    outcome.value = null;
    if (res.verified) {
      say(`已入榜 · 第 ${res.rank} 名 · ${upperPercentText(res.rank, res.total)}`, true);
    } else {
      say('本次成绩未通过合理性复核，未计入榜单', false);
    }
  } else {
    say(lb.lastError ?? '上传失败，请稍后重试', false);
  }
}

// ─────────── 榜单页签：「你附近」是默认视图（方案 §5.1） ───────────
type BoardTab = 'neighborhood' | 'top' | 'power';
const boardTab = ref<BoardTab>('neighborhood');
const BOARD_TABS: { key: BoardTab; label: string }[] = [
  { key: 'neighborhood', label: '你附近' },
  { key: 'top', label: '全服总榜' },
  { key: 'power', label: '战力榜' },
];

const neighborhoodRows = computed(() => lb.neighborhoodCache?.value ?? []);
const topRows = computed(() => lb.topCache?.value ?? []);
const powerRows = computed(() => lb.powerCache?.value.rows ?? []);
const myPowerRank = computed(() => lb.powerCache?.value.myRank ?? null);

/** 我的试炼名次与总人数（来自邻域行），用于「上位 N%」段位。 */
const myStanding = computed(() => {
  const me = neighborhoodRows.value.find((r) => r.isMe);
  return me ? { rank: me.rank, total: me.total } : null;
});

const boardEmpty = computed(() => {
  if (lb.status === 'unconfigured' || lb.status === 'offline') return false;
  if (boardTab.value === 'neighborhood') return neighborhoodRows.value.length === 0;
  if (boardTab.value === 'top') return topRows.value.length === 0;
  return powerRows.value.length === 0;
});

// ─────────── 生命周期 ───────────
onMounted(() => {
  // 静默拉取；失败全部收进 store.status，不打断页面
  void lb.refreshBoards();
  tickTimer = window.setInterval(() => (nowTick.value = Date.now()), 30_000);
});

onUnmounted(() => {
  clearInterval(tickTimer);
  clearTimeout(toastTimer);
  cancelAnimationFrame(countUpFrame);
});
</script>

<template>
  <div class="rank scroll-y">
    <!-- ═══ 周常试炼英雄卡 ═══ -->
    <section class="boss-card" :data-element="lb.boss.combatant.element">
      <!-- 本卡专属粒子场：上升光尘 + 旋转光环，纯 CSS 零 JS 开销 -->
      <span class="boss-aura" aria-hidden="true" />
      <i v-for="n in 12" :key="n" class="mote" :class="`mote-${n}`" aria-hidden="true" />

      <header class="boss-head">
        <span class="boss-title"><Sparkles :size="13" aria-hidden="true" />周常试炼</span>
        <span class="countdown-chip"
          ><Timer :size="11" aria-hidden="true" />{{ remainingText }}</span
        >
      </header>

      <div class="boss-body brief-body">
        <div class="boss-copy">
          <span class="boss-week brief-element">
            <component :is="elementIcon" :size="12" :stroke-width="2.2" aria-hidden="true" />
            本周 Boss · {{ elementLabel }}属性
          </span>
          <strong class="boss-name">{{ lb.boss.name }}</strong>
          <em class="boss-hint">「{{ lb.boss.tilt.hint }}」</em>
          <span class="boss-badges">
            <b>{{ lb.bracket.name }}段</b>
            <b>{{ classSymbol(lb.classId) }} {{ className(lb.classId) }}榜</b>
          </span>
        </div>
      </div>
    </section>

    <TrialBattleScene
      :boss="lb.boss"
      :class-id="lb.classId"
      :level="game.player?.level ?? 1"
      :equipped="game.save?.equipped ?? null"
      :player-name="game.player?.name ?? '挑战者'"
      :run="battleRun"
      :playback-key="playbackKey"
      :reduce-motion="motionReduced"
      @complete="onBattleComplete"
    />

    <!-- ═══ 我的成绩卡 ═══ -->
    <section class="card my-score">
      <div class="score-left">
        <span class="score-label">本周最好成绩</span>
        <strong class="score-value num">
          {{ lb.myBestThisWeek ? abbr(lb.myBestThisWeek.damage) : '—' }}
        </strong>
        <!-- 箭头只在上升时出现；下降不显示箭头、不显示红色 -->
        <span v-if="lb.weekOverWeekGain !== null" class="gain-badge">
          ↑ 比上周 +{{ pct(lb.weekOverWeekGain, 0) }}
        </span>
        <span class="score-sub">
          <template v-if="myStanding">
            {{ lb.bracket.name }}·{{ className(lb.classId) }}
            <b>{{ upperPercentText(myStanding.rank, myStanding.total) }}</b>
          </template>
          <template v-else-if="lb.myBestThisWeek?.submitted">已入榜，名次同步中…</template>
          <template v-else-if="lb.myBestThisWeek">成绩已记录，上传后即可看到名次</template>
          <template v-else>挑战一次，打出你的本周成绩</template>
        </span>
      </div>
      <div class="score-actions">
        <button class="btn btn-pink challenge-btn" :disabled="challenging" @click="onChallenge">
          <Swords :size="14" aria-hidden="true" />
          {{ challenging ? '试炼进行中…' : lb.myBestThisWeek ? '再次挑战' : '挑战试炼' }}
          <i v-if="challenging" class="clash" aria-hidden="true" />
        </button>
        <button
          v-if="canUpload"
          class="btn btn-blue upload-btn"
          :disabled="lb.submitting"
          @click="onUpload"
        >
          <Upload :size="13" aria-hidden="true" />
          {{ lb.submitting ? '上传中…' : '上传成绩' }}
        </button>
        <button
          v-if="lb.status === 'ready'"
          class="btn btn-plain profile-btn"
          @click="openProfileEditor"
        >
          <Pencil :size="12" aria-hidden="true" />
          编辑档案
        </button>
      </div>
    </section>

    <!-- ═══ 榜单卡 ═══ -->
    <section class="card board">
      <div class="seg" role="tablist" aria-label="榜单切换">
        <span
          class="seg-pill"
          :style="{ '--seg-x': BOARD_TABS.findIndex((t) => t.key === boardTab) }"
          aria-hidden="true"
        />
        <button
          v-for="tab in BOARD_TABS"
          :key="tab.key"
          role="tab"
          class="seg-tab"
          :class="{ active: boardTab === tab.key }"
          :aria-selected="boardTab === tab.key"
          @click="boardTab = tab.key"
        >
          {{ tab.label }}
        </button>
      </div>

      <!-- 联机状态横幅：静默降级，绝不阻塞 -->
      <div v-if="lb.status === 'unconfigured'" class="net-banner">
        <Info :size="13" aria-hidden="true" />
        <span>当前是单机试炼模式，成绩记录在本地；联机榜开启后即可上传排名。</span>
      </div>
      <div v-else-if="lb.status === 'offline'" class="net-banner warn">
        <CloudOff :size="13" aria-hidden="true" />
        <span>网络未连接，榜单暂不可用。</span>
        <button class="retry" @click="lb.refreshBoards(true)">
          <RefreshCw :size="12" aria-hidden="true" />重试
        </button>
      </div>

      <!-- 加载骨架 -->
      <div v-if="lb.boardsLoading && boardEmpty" class="rows">
        <div v-for="n in 5" :key="n" class="row skeleton" :style="{ '--row-delay': `${n * 60}ms` }">
          <span class="sk sk-rank" /><span class="sk sk-name" /><span class="sk sk-damage" />
        </div>
      </div>

      <!-- 空态：够得着的目标，从第一次挑战开始 -->
      <div v-else-if="boardEmpty" class="empty">
        <template v-if="boardTab === 'neighborhood'">
          这一带还很安静 —— 上传一次成绩，就能看到你±5名的对手。
        </template>
        <template v-else>本周还没有人上榜，虚位以待。</template>
      </div>

      <!-- 试炼邻域 / 总榜 -->
      <div v-else-if="boardTab !== 'power'" class="rows">
        <div
          v-for="(row, index) in boardTab === 'neighborhood' ? neighborhoodRows : topRows"
          :key="row.userId"
          class="row row-in"
          :class="{ me: row.isMe, podium: row.rank <= 3 && boardTab === 'top' }"
          :style="{ '--row-delay': `${Math.min(index, 14) * 45}ms` }"
        >
          <span class="rank-no" :data-rank="row.rank">{{ row.rank }}</span>
          <span class="who">
            <ProfileAvatar
              class="row-avatar"
              :avatar-url="row.avatarUrl"
              :class-id="row.classId"
              :alt="`${row.displayName}的头像`"
            />
            <span class="identity-copy">
              <span class="identity-line">
                <b>{{ row.displayName }}</b>
                <em v-if="row.isMe">你</em>
              </span>
              <small>{{ row.bio || `${className(row.classId)}挑战者` }}</small>
            </span>
          </span>
          <span class="damage num">{{ abbr(row.damage) }}</span>
          <button
            v-if="!row.isMe && lb.status === 'ready'"
            class="report-entry"
            :aria-label="`举报${row.displayName}的档案`"
            title="举报档案"
            @click.stop="openReport(row)"
          >
            <Flag :size="12" aria-hidden="true" />
          </button>
        </div>
      </div>

      <!-- 战力榜（次级页签：玩家期待看到，但我们不主推） -->
      <div v-else class="rows">
        <div
          v-for="(row, index) in powerRows"
          :key="row.userId"
          class="row row-in"
          :class="{ me: row.isMe }"
          :style="{ '--row-delay': `${Math.min(index, 14) * 45}ms` }"
        >
          <span class="rank-no">{{ row.rank }}</span>
          <span class="who">
            <ProfileAvatar
              class="row-avatar"
              :avatar-url="row.avatarUrl"
              :class-id="row.classId"
              :alt="`${row.displayName}的头像`"
            />
            <span class="identity-copy">
              <span class="identity-line">
                <b>{{ row.displayName }}</b>
                <em v-if="row.isMe">你</em>
              </span>
              <small
                >Lv.{{ row.level }}<template v-if="row.bio"> · {{ row.bio }}</template></small
              >
            </span>
          </span>
          <span class="damage num">{{ abbr(row.combatPower) }}</span>
          <button
            v-if="!row.isMe && lb.status === 'ready'"
            class="report-entry"
            :aria-label="`举报${row.displayName}的档案`"
            title="举报档案"
            @click.stop="openReport(row)"
          >
            <Flag :size="12" aria-hidden="true" />
          </button>
        </div>
        <p v-if="myPowerRank && !powerRows.some((r) => r.isMe)" class="my-power-note">
          我的战力名次：第 {{ myPowerRank }} 名
        </p>
      </div>
    </section>

    <p class="fair-note">
      试炼为固定种子：同一套搭配必得同一成绩，提升只来自搭配的改善。榜单奖励只含称号与外观。
    </p>

    <!-- ═══ 挑战结果揭晓 ═══ -->
    <Transition name="modal-pop">
      <div v-if="outcome" class="overlay" @click.self="closeOutcome">
        <div class="result-panel" role="dialog" aria-label="试炼结果">
          <span v-if="outcome.improved" class="burst" aria-hidden="true">
            <i v-for="n in 8" :key="n" :class="`burst-${n}`" />
          </span>
          <span class="result-label">60 秒总伤害</span>
          <strong class="result-value num">{{ abbr(displayDamage) }}</strong>
          <span v-if="outcome.improved" class="record-badge">✦ 新纪录 ✦</span>
          <span v-else class="result-note">
            本周最好成绩仍是 {{ abbr(outcome.best.damage) }}，换套搭配再试试
          </span>
          <span v-if="!outcome.result.survived" class="result-note">
            没能打满全程 —— 生存也是实力的一部分
          </span>
          <div class="result-actions">
            <button
              v-if="lb.status === 'ready' && (outcome.improved || !outcome.best.submitted)"
              class="btn btn-pink"
              :disabled="lb.submitting"
              @click="onUpload"
            >
              <Upload :size="13" aria-hidden="true" />
              {{ lb.submitting ? '上传中…' : '上传成绩' }}
            </button>
            <button class="btn btn-plain" @click="closeOutcome">完成</button>
          </div>
          <p v-if="lb.status !== 'ready'" class="result-note dim">
            单机试炼模式：成绩已记录在本机，联机后可随时上传。
          </p>
        </div>
      </div>
    </Transition>

    <ProfileEditor
      v-if="profileOpen && profileClient && lb.userId"
      :client="profileClient"
      :user-id="lb.userId"
      :class-id="lb.classId"
      :fallback-name="game.player?.name ?? '无名旅人'"
      @saved="onProfileSaved"
      @close="profileOpen = false"
    />

    <Transition name="modal-pop">
      <div v-if="reportTarget" class="overlay" @click.self="closeReport">
        <section
          class="result-panel report-panel"
          role="dialog"
          aria-modal="true"
          :aria-label="`举报${reportTarget.displayName}的档案`"
          @keydown.esc.stop="closeReport"
        >
          <Flag :size="22" aria-hidden="true" />
          <strong>举报 {{ reportTarget.displayName }}</strong>
          <p>仅用于不当头像、昵称或简介。举报内容不会公开，项目所有者会人工核查。</p>
          <textarea
            v-model="reportReason"
            maxlength="200"
            rows="3"
            autofocus
            placeholder="请简要说明问题"
          />
          <small>{{ reportReason.trim().length }} / 200</small>
          <div class="result-actions">
            <button class="btn btn-plain" :disabled="reporting" @click="closeReport">取消</button>
            <button class="btn btn-pink" :disabled="!canReport" @click="submitReport">
              {{ reporting ? '提交中…' : '提交举报' }}
            </button>
          </div>
        </section>
      </div>
    </Transition>

    <Transition name="toast-up">
      <div v-if="toast" class="toast" :class="{ bad: !toast.ok }">{{ toast.text }}</div>
    </Transition>
  </div>
</template>

<style scoped>
.rank {
  /* 同 .dungeon：锁高会被 flex 负空间压扁子卡，min-height 保底、交给 main 滚动 */
  min-height: 100%;
  display: flex;
  flex-direction: column;
  gap: 10px;
  position: relative;
}

/* ═══════════ 试炼英雄卡 ═══════════ */
.boss-card {
  --elem-glow: var(--pink);
  --elem-deep: var(--pink-deep);
  position: relative;
  overflow: hidden;
  padding: 14px 14px 16px;
  border-radius: var(--r-lg);
  border: 1px solid var(--glass-brd);
  background:
    radial-gradient(130% 90% at 85% -10%, rgb(255 255 255 / 80%), transparent 55%),
    linear-gradient(135deg, var(--blue-soft), var(--pink-soft) 88%);
  box-shadow: var(--shadow-float);
}

.boss-card[data-element='fire'] {
  --elem-glow: #ffb37a;
  --elem-deep: #ff8a4a;
}
.boss-card[data-element='ice'] {
  --elem-glow: #9fd8f7;
  --elem-deep: #4aa8dd;
}
.boss-card[data-element='thunder'] {
  --elem-glow: #cdb2f2;
  --elem-deep: #9463d8;
}

/* 元素色柔光，缓慢呼吸 */
.boss-aura {
  position: absolute;
  right: -18%;
  top: -32%;
  width: 62%;
  aspect-ratio: 1;
  border-radius: 50%;
  background: radial-gradient(circle, var(--elem-glow), transparent 62%);
  opacity: 0.34;
  filter: blur(6px);
  animation: aura-breathe 5.2s ease-in-out infinite;
  pointer-events: none;
}

@keyframes aura-breathe {
  0%,
  100% {
    transform: scale(1);
    opacity: 0.3;
  }
  50% {
    transform: scale(1.12);
    opacity: 0.42;
  }
}

/* 上升光尘粒子：大小、起点、时长全部错开 */
.mote {
  --mx: 8%;
  --mdur: 7s;
  --msize: 4px;
  position: absolute;
  left: var(--mx);
  bottom: -8px;
  width: var(--msize);
  height: var(--msize);
  border-radius: 50%;
  background: radial-gradient(circle, #fff, var(--elem-glow));
  box-shadow: 0 0 6px var(--elem-glow);
  opacity: 0;
  animation: mote-rise var(--mdur) linear infinite;
  pointer-events: none;
}
.mote-1 {
  --mx: 6%;
  --mdur: 6.4s;
  --msize: 3px;
  animation-delay: -1.2s;
}
.mote-2 {
  --mx: 14%;
  --mdur: 8.2s;
  --msize: 5px;
  animation-delay: -4.6s;
}
.mote-3 {
  --mx: 23%;
  --mdur: 7.1s;
  --msize: 3px;
  animation-delay: -2.8s;
}
.mote-4 {
  --mx: 32%;
  --mdur: 9s;
  --msize: 4px;
  animation-delay: -6.1s;
}
.mote-5 {
  --mx: 41%;
  --mdur: 6.8s;
  --msize: 3px;
  animation-delay: -0.6s;
}
.mote-6 {
  --mx: 50%;
  --mdur: 8.6s;
  --msize: 5px;
  animation-delay: -5.2s;
}
.mote-7 {
  --mx: 59%;
  --mdur: 7.4s;
  --msize: 3px;
  animation-delay: -3.3s;
}
.mote-8 {
  --mx: 68%;
  --mdur: 6.2s;
  --msize: 4px;
  animation-delay: -1.8s;
}
.mote-9 {
  --mx: 76%;
  --mdur: 8.9s;
  --msize: 3px;
  animation-delay: -7s;
}
.mote-10 {
  --mx: 84%;
  --mdur: 7.8s;
  --msize: 5px;
  animation-delay: -4s;
}
.mote-11 {
  --mx: 91%;
  --mdur: 6.6s;
  --msize: 3px;
  animation-delay: -2.2s;
}
.mote-12 {
  --mx: 96%;
  --mdur: 9.4s;
  --msize: 4px;
  animation-delay: -5.8s;
}

@keyframes mote-rise {
  0% {
    opacity: 0;
    transform: translate3d(0, 0, 0) scale(0.7);
  }
  12%,
  70% {
    opacity: 0.85;
  }
  100% {
    opacity: 0;
    transform: translate3d(10px, -150px, 0) scale(1.15);
  }
}

.boss-head {
  position: relative;
  z-index: 1;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.boss-title {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  font-size: 12px;
  font-weight: 800;
  letter-spacing: 1px;
  color: var(--text);
}

.countdown-chip {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 4px 10px;
  font-size: 10px;
  color: var(--text-mid);
  background: var(--glass-bg-strong);
  border: 1px solid var(--glass-brd);
  border-radius: 999px;
  backdrop-filter: var(--blur-glass);
}

.boss-body {
  position: relative;
  z-index: 1;
  display: flex;
  align-items: center;
  gap: 14px;
  margin-top: 12px;
}

/* Boss 徽章：双层旋转光环 + 元素核心 */
.emblem {
  position: relative;
  width: 76px;
  height: 76px;
  flex-shrink: 0;
}

.emblem-ring {
  position: absolute;
  inset: 0;
  border-radius: 50%;
}

.ring-a {
  border: 2px dashed color-mix(in srgb, var(--elem-deep) 55%, transparent);
  animation: ring-spin 14s linear infinite;
}

.ring-b {
  inset: 7px;
  border: 1.5px solid color-mix(in srgb, var(--elem-deep) 30%, transparent);
  border-top-color: color-mix(in srgb, var(--elem-deep) 85%, transparent);
  animation: ring-spin 7s linear infinite reverse;
}

@keyframes ring-spin {
  to {
    transform: rotate(360deg);
  }
}

.emblem-core {
  position: absolute;
  inset: 15px;
  display: grid;
  place-items: center;
  color: #fff;
  background: radial-gradient(circle at 32% 28%, var(--elem-glow), var(--elem-deep) 78%);
  border-radius: 50%;
  box-shadow:
    0 4px 14px color-mix(in srgb, var(--elem-deep) 45%, transparent),
    inset 0 1px 3px rgb(255 255 255 / 55%);
  animation: core-float 3.6s ease-in-out infinite;
}

@keyframes core-float {
  0%,
  100% {
    transform: translateY(0);
  }
  50% {
    transform: translateY(-3px);
  }
}

.boss-copy {
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 3px;
}

.boss-week {
  font-size: 10px;
  color: var(--text-mid);
  letter-spacing: 0.5px;
}

.boss-name {
  font-size: 19px;
  font-weight: 800;
  letter-spacing: 0.5px;
  background: linear-gradient(115deg, var(--text), var(--elem-deep));
  -webkit-background-clip: text;
  background-clip: text;
  color: transparent;
}

.boss-hint {
  font-size: 10px;
  font-style: normal;
  line-height: 1.5;
  color: var(--text-mid);
}

.boss-badges {
  display: flex;
  gap: 5px;
  margin-top: 3px;
}

.boss-badges b {
  padding: 3px 8px;
  font-size: 9px;
  font-weight: 700;
  color: var(--elem-deep);
  background: rgb(255 255 255 / 70%);
  border: 1px solid color-mix(in srgb, var(--elem-deep) 26%, transparent);
  border-radius: 999px;
}

.brief-body {
  align-items: flex-start;
  gap: 0;
  margin-top: 8px;
}

.brief-body .boss-copy {
  width: 100%;
}

.brief-element {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  color: var(--elem-deep);
}

/* ═══════════ 我的成绩卡 ═══════════ */
.my-score {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  padding: 13px 14px;
}

.score-left {
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.score-label {
  font-size: 10px;
  color: var(--text-dim);
}

.score-value {
  font-size: 26px;
  font-weight: 800;
  line-height: 1.15;
  background: linear-gradient(120deg, var(--pink-deep), var(--blue-deep));
  -webkit-background-clip: text;
  background-clip: text;
  color: transparent;
}

.gain-badge {
  align-self: flex-start;
  padding: 2px 8px;
  font-size: 9px;
  font-weight: 700;
  color: #2e9e6b;
  background: #e4f8ee;
  border: 1px solid #b9ecd3;
  border-radius: 999px;
  animation: gain-pop var(--t-slow) var(--ease-out-back) both;
}

@keyframes gain-pop {
  from {
    opacity: 0;
    transform: scale(0.7);
  }
  to {
    opacity: 1;
    transform: scale(1);
  }
}

.score-sub {
  font-size: 10px;
  color: var(--text-mid);
}

.score-sub b {
  color: var(--blue-deep);
}

.score-actions {
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.challenge-btn {
  position: relative;
  min-width: 108px;
  min-height: 42px;
  overflow: hidden;
}

.upload-btn {
  min-width: 108px;
  min-height: 32px;
  font-size: 11px;
}

.profile-btn {
  min-width: 108px;
  min-height: 30px;
  gap: 4px;
  font-size: 10px;
}

/* 交锋演出：按钮上的刀光闪过 */
.clash {
  position: absolute;
  inset: 0;
  background: linear-gradient(100deg, transparent 20%, rgb(255 255 255 / 65%) 50%, transparent 80%);
  animation: clash-sweep 0.72s var(--ease-soft) infinite;
}

@keyframes clash-sweep {
  from {
    transform: translateX(-110%) skewX(-16deg);
  }
  to {
    transform: translateX(110%) skewX(-16deg);
  }
}

/* ═══════════ 榜单卡 ═══════════ */
.board {
  padding: 10px;
}

.seg {
  position: relative;
  display: flex;
  padding: 3px;
  background: var(--panel-3);
  border-radius: 12px;
}

.seg-pill {
  position: absolute;
  top: 3px;
  bottom: 3px;
  left: 0;
  width: calc(100% / 3);
  border-radius: 10px;
  background: var(--panel);
  box-shadow: var(--shadow-sm);
  transform: translateX(calc(var(--seg-x) * 100%));
  transition: transform var(--t-mid) var(--ease-spring);
}

.seg-tab {
  position: relative;
  z-index: 1;
  flex: 1;
  padding: 7px 0;
  font-size: 11px;
  font-weight: 600;
  color: var(--text-dim);
  border-radius: 10px;
  transition: color var(--t-mid);
}

.seg-tab.active {
  color: var(--pink-deep);
}

.net-banner {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-top: 8px;
  padding: 8px 10px;
  font-size: 10px;
  line-height: 1.5;
  color: var(--text-mid);
  background: var(--blue-soft);
  border: 1px solid var(--line);
  border-radius: var(--r-sm);
}

.net-banner.warn {
  color: #8a6d3b;
  background: #fdf3e0;
  border-color: #f5e0b8;
}

.net-banner .retry {
  margin-left: auto;
  display: inline-flex;
  align-items: center;
  gap: 3px;
  padding: 3px 9px;
  font-size: 10px;
  font-weight: 700;
  color: var(--blue-deep);
  background: #fff;
  border: 1px solid var(--line-strong);
  border-radius: 999px;
}

.rows {
  margin-top: 8px;
  display: flex;
  flex-direction: column;
  gap: 4px;
  max-height: 348px;
  overflow-y: auto;
  scrollbar-width: thin;
  scrollbar-color: var(--line-strong) transparent;
}

.row {
  display: flex;
  align-items: center;
  gap: 7px;
  padding: 7px 8px;
  border-radius: var(--r-sm);
  background: var(--panel-2);
}

.row.me {
  background: linear-gradient(90deg, var(--pink-soft), #fff 70%);
  border: 1px solid #ffd3e4;
  box-shadow: 0 2px 8px rgb(245 121 159 / 14%);
}

.rank-no {
  width: 26px;
  flex-shrink: 0;
  font-size: 12px;
  font-weight: 800;
  text-align: center;
  color: var(--text-dim);
  font-variant-numeric: tabular-nums;
}

.row.podium .rank-no[data-rank='1'] {
  color: #e8a91f;
}
.row.podium .rank-no[data-rank='2'] {
  color: #9aa8b5;
}
.row.podium .rank-no[data-rank='3'] {
  color: #c98a5e;
}

.row.podium .rank-no[data-rank='1'],
.row.podium .rank-no[data-rank='2'],
.row.podium .rank-no[data-rank='3'] {
  font-size: 13px;
  text-shadow: 0 1px 4px rgb(232 169 31 / 30%);
}

.who {
  min-width: 0;
  flex: 1;
  display: flex;
  align-items: center;
  gap: 7px;
}

.row-avatar {
  width: 32px;
  height: 32px;
  font-size: 18px;
}

.identity-copy {
  min-width: 0;
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 1px;
}

.identity-line {
  min-width: 0;
  display: flex;
  align-items: center;
  gap: 5px;
}

.identity-line b {
  min-width: 0;
  font-size: 12px;
  font-weight: 600;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.identity-copy small {
  display: block;
  max-width: 100%;
  font-size: 9px;
  color: var(--text-dim);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.identity-line em {
  flex-shrink: 0;
  padding: 1px 7px;
  font-size: 9px;
  font-style: normal;
  font-weight: 700;
  color: var(--pink-deep);
  background: #ffe4ef;
  border-radius: 999px;
}

.damage {
  flex-shrink: 0;
  font-size: 13px;
  font-weight: 800;
  color: var(--text);
}

.report-entry {
  width: 26px;
  height: 26px;
  display: grid;
  flex: none;
  place-items: center;
  color: var(--text-dim);
  background: rgb(255 255 255 / 62%);
  border: 1px solid var(--line);
  border-radius: 50%;
  transition:
    color var(--t-fast),
    border-color var(--t-fast),
    transform var(--t-fast);
}

.report-entry:active {
  color: var(--pink-deep);
  border-color: var(--pink);
  transform: scale(0.9);
}

.my-power-note {
  padding: 8px 4px 2px;
  font-size: 10px;
  color: var(--text-mid);
  text-align: center;
}

.empty {
  padding: 26px 16px;
  font-size: 11px;
  line-height: 1.7;
  color: var(--text-dim);
  text-align: center;
}

/* 骨架屏 */
.skeleton {
  background: var(--panel-2);
}

.sk {
  height: 12px;
  border-radius: 6px;
  background: linear-gradient(90deg, var(--panel-3) 25%, #fff 50%, var(--panel-3) 75%);
  background-size: 200% 100%;
  animation: sk-shimmer 1.4s linear infinite;
}

.sk-rank {
  width: 26px;
}
.sk-name {
  flex: 1;
}
.sk-damage {
  width: 54px;
}

@keyframes sk-shimmer {
  from {
    background-position: 180% 0;
  }
  to {
    background-position: -20% 0;
  }
}

.fair-note {
  padding: 2px 6px 6px;
  font-size: 9px;
  line-height: 1.6;
  color: var(--text-dim);
  text-align: center;
}

/* ═══════════ 挑战结果面板 ═══════════ */
.result-panel {
  position: relative;
  width: min(300px, 100%);
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  padding: 26px 20px 18px;
  background: var(--glass-bg-strong);
  border: 1px solid var(--glass-brd);
  border-radius: var(--r-lg);
  box-shadow: var(--shadow-float);
  backdrop-filter: var(--blur-glass);
  overflow: hidden;
}

.result-label {
  font-size: 11px;
  color: var(--text-dim);
  letter-spacing: 2px;
}

.result-value {
  font-size: 40px;
  font-weight: 800;
  line-height: 1.1;
  background: linear-gradient(120deg, var(--pink-deep), var(--blue-deep));
  -webkit-background-clip: text;
  background-clip: text;
  color: transparent;
}

.record-badge {
  padding: 3px 14px;
  font-size: 11px;
  font-weight: 800;
  letter-spacing: 2px;
  color: #b47b12;
  background: linear-gradient(120deg, #fff3d1, #ffe9ad);
  border: 1px solid #f5dc92;
  border-radius: 999px;
  animation: gain-pop var(--t-slow) var(--ease-out-back) both;
}

.result-note {
  font-size: 10px;
  line-height: 1.6;
  color: var(--text-mid);
  text-align: center;
}

.result-note.dim {
  color: var(--text-dim);
}

.result-actions {
  display: flex;
  gap: 8px;
  margin-top: 8px;
}

.report-panel {
  align-items: stretch;
  width: min(330px, 100%);
}

.report-panel > svg {
  align-self: center;
  color: var(--pink-deep);
}

.report-panel > strong {
  text-align: center;
}

.report-panel > p {
  margin: 0;
  color: var(--text-mid);
  font-size: 10px;
  line-height: 1.6;
}

.report-panel textarea {
  width: 100%;
  padding: 9px 10px;
  color: var(--text);
  font: inherit;
  font-size: 12px;
  line-height: 1.5;
  resize: none;
  background: rgb(255 255 255 / 76%);
  border: 1px solid var(--line-strong);
  border-radius: 10px;
}

.report-panel > small {
  color: var(--text-dim);
  font-size: 9px;
  text-align: right;
}

.report-panel .result-actions {
  justify-content: flex-end;
}

/* 新纪录粒子迸发 */
.burst {
  position: absolute;
  inset: 0;
  pointer-events: none;
}

.burst i {
  position: absolute;
  left: 50%;
  top: 38%;
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: radial-gradient(circle, #fff, var(--gold));
  box-shadow: 0 0 8px var(--gold);
  opacity: 0;
  animation: burst-fly 1.15s var(--ease-soft) 0.15s both;
}

.burst-1 {
  --bx: -88px;
  --by: -52px;
  animation-delay: 0.1s;
}
.burst-2 {
  --bx: 76px;
  --by: -64px;
  animation-delay: 0.18s;
}
.burst-3 {
  --bx: -64px;
  --by: 46px;
  animation-delay: 0.24s;
}
.burst-4 {
  --bx: 92px;
  --by: 38px;
  animation-delay: 0.12s;
}
.burst-5 {
  --bx: -30px;
  --by: -84px;
  animation-delay: 0.28s;
}
.burst-6 {
  --bx: 36px;
  --by: 74px;
  animation-delay: 0.2s;
}
.burst-7 {
  --bx: -104px;
  --by: 6px;
  animation-delay: 0.32s;
}
.burst-8 {
  --bx: 108px;
  --by: -12px;
  animation-delay: 0.26s;
}

@keyframes burst-fly {
  0% {
    opacity: 0;
    transform: translate(-50%, -50%) scale(0.4);
  }
  18% {
    opacity: 1;
  }
  100% {
    opacity: 0;
    transform: translate(calc(-50% + var(--bx)), calc(-50% + var(--by))) scale(1.1);
  }
}

.toast {
  position: absolute;
  left: 50%;
  bottom: 14px;
  transform: translateX(-50%);
  max-width: 90%;
  padding: 9px 16px;
  font-size: 12px;
  color: #fff;
  background: rgb(70 89 107 / 92%);
  border-radius: 999px;
  text-align: center;
  z-index: 60;
}

.toast.bad {
  background: rgb(200 70 80 / 94%);
}

/* ═══════════ 小屏适配（< 350px 或矮屏） ═══════════ */
@media (max-width: 350px), (max-height: 700px) {
  .boss-body {
    gap: 10px;
  }
  .emblem {
    width: 64px;
    height: 64px;
  }
  .emblem-core {
    inset: 12px;
  }
  .boss-name {
    font-size: 16px;
  }
  .score-value {
    font-size: 22px;
  }
  .challenge-btn,
  .upload-btn {
    min-width: 96px;
  }
  .rows {
    max-height: 300px;
  }
}

/* ═══════════ 减弱动效 ═══════════ */
@media (prefers-reduced-motion: reduce) {
  .mote,
  .boss-aura,
  .emblem-ring,
  .emblem-core,
  .clash,
  .sk,
  .burst i {
    animation: none;
  }
  .mote {
    opacity: 0.25;
  }
}
</style>
