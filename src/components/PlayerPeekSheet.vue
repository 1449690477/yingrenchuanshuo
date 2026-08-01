<script setup lang="ts">
/**
 * PlayerPeekSheet —— 玩家详情弹层。
 *
 * 排行榜两种行（试炼伤害榜 / 战力榜）与公会名册点击后弹出：
 *   立绘 + 大头像光环 + 名次奖牌 + 上位百分比进度 + 伤害/战力大数字 + 签名
 *   自己的卡多一个「编辑档案」入口，别人的卡保留「举报」。
 *
 * 只做展示与互动，不拉取额外数据——行上有什么就呈现什么，
 * 用立绘、奖牌、进度条和错峰入场把「看一个人」变成一次小仪式。
 */
import { computed, nextTick, onMounted, onUnmounted, ref } from 'vue';
import { Flag, Pencil, X } from '@lucide/vue';
import { createFocusTrap, type FocusTrap } from 'focus-trap';
import { abbr } from '@/core/format';
import { upperPercentText } from '@/core/trial';
import type { ClassId } from '@/core/types';
import { AFFECTION_CHARACTERS } from '@/data/affection';
import { CLASS_INFO } from '@/data/constants';
import { CLASS_VISUALS } from '@/data/classVisuals';
import ClassArtwork from '@/components/ClassArtwork.vue';
import ProfileAvatar from '@/components/ProfileAvatar.vue';

const props = defineProps<{
  displayName: string;
  bio: string | null;
  avatarUrl: string | null;
  classId: ClassId;
  rank: number;
  isMe: boolean;
  /** 总榜前三名给奖牌配色 */
  podium: boolean;
  /** 试炼榜总人数；与 rank 一起算「上位 N%」 */
  total?: number;
  /** 试炼榜：本周伤害 */
  damage?: number;
  /** 战力榜：等级与战力 */
  level?: number;
  combatPower?: number;
  /** 联机就绪且不是自己时可举报 */
  canReport: boolean;
  /** 展示语境；公会名册不冒充排行榜，也不展示上位百分比。 */
  context?: 'leaderboard' | 'guild';
}>();

const emit = defineEmits<{ close: []; report: []; editProfile: [] }>();

const className = computed(() => AFFECTION_CHARACTERS[props.classId]?.name ?? props.classId);
const classSymbol = computed(() => CLASS_VISUALS[props.classId]?.symbol ?? '·');
const classColor = computed(() => CLASS_INFO[props.classId]?.color ?? 'var(--pink-deep)');

const isTrial = computed(() => props.damage !== undefined);
const isGuild = computed(() => props.context === 'guild');
const upperText = computed(() =>
  props.total && props.total > 0 ? upperPercentText(props.rank, props.total) : null,
);
const upperRatio = computed(() =>
  props.total && props.total > 0 ? Math.min(1, Math.max(0.02, props.rank / props.total)) : 0,
);
const medalTone = computed(() =>
  props.podium && props.rank <= 3 ? (['gold', 'silver', 'bronze'] as const)[props.rank - 1] : null,
);

// ─────────── 大数字 count-up：打开弹层时成绩从零滚到真值 ───────────
const systemReduced =
  typeof window !== 'undefined' &&
  typeof window.matchMedia === 'function' &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const displayValue = ref(0);
let countFrame = 0;

onMounted(() => {
  const target = Math.round(props.damage ?? props.combatPower ?? 0);
  if (systemReduced || target <= 0) {
    displayValue.value = target;
    return;
  }
  const start = performance.now();
  const durationMs = 760;
  const step = (t: number) => {
    const p = Math.min(1, (t - start) / durationMs);
    displayValue.value = Math.round(target * (1 - Math.pow(1 - p, 3)));
    if (p < 1) countFrame = requestAnimationFrame(step);
  };
  countFrame = requestAnimationFrame(step);
});

onUnmounted(() => cancelAnimationFrame(countFrame));

// ─────────── 焦点圈（与 ItemPeekSheet 同一模式） ───────────
const sheetRef = ref<HTMLElement | null>(null);
const closeButtonRef = ref<HTMLButtonElement | null>(null);
let dialogFocusTrap: FocusTrap | null = null;

onMounted(async () => {
  await nextTick();
  const sheet = sheetRef.value;
  if (!sheet) return;
  dialogFocusTrap = createFocusTrap(sheet, {
    initialFocus: () => closeButtonRef.value ?? sheet,
    fallbackFocus: () => sheet,
    clickOutsideDeactivates: true,
    isolateSubtrees: 'aria-hidden',
    onDeactivate: () => emit('close'),
  });
  dialogFocusTrap.activate();
});

onUnmounted(() => {
  if (dialogFocusTrap?.active) {
    dialogFocusTrap.deactivate({
      returnFocus: true,
      onDeactivate: () => undefined,
    });
  }
  dialogFocusTrap = null;
});

function requestClose(): void {
  if (dialogFocusTrap?.active) {
    dialogFocusTrap.deactivate();
    return;
  }
  emit('close');
}
</script>

<template>
  <Teleport to="body">
    <div class="peek-overlay">
      <section
        ref="sheetRef"
        class="player-sheet"
        role="dialog"
        aria-modal="true"
        :aria-label="`${displayName}的玩家详情`"
        :data-medal="medalTone"
        tabindex="-1"
      >
        <span class="sheet-glow" aria-hidden="true" />

        <header class="sheet-head">
          <span class="avatar-wrap" aria-hidden="true">
            <i class="avatar-ring" />
            <ProfileAvatar
              class="sheet-avatar"
              :avatar-url="avatarUrl"
              :class-id="classId"
              :alt="`${displayName}的头像`"
            />
          </span>
          <span class="head-copy">
            <small>
              {{ classSymbol }} {{ className }} · {{ isGuild ? '樱庭同行者' : '旅途同路人' }}
            </small>
            <strong>
              {{ displayName }}
              <em v-if="isMe" class="me-badge">你</em>
            </strong>
          </span>
          <button
            ref="closeButtonRef"
            type="button"
            class="sheet-close"
            aria-label="关闭"
            @click="requestClose"
          >
            <X :size="17" />
          </button>
        </header>

        <!-- 立绘舞台：角色形象浮动展示 -->
        <div class="art-stage" :style="{ '--class-color': classColor }">
          <span class="art-aura" aria-hidden="true" />
          <ClassArtwork :class-id="classId" variant="preview" class="art-figure" />
          <span class="art-class" :style="{ color: classColor }">{{ className }}</span>
        </div>

        <!-- 名次 / 名册席位与对应语境 -->
        <div class="rank-band">
          <span class="rank-medal" :data-medal="medalTone">
            <small>{{ isGuild ? '席位' : '名次' }}</small>
            <b class="num">{{ rank }}</b>
          </span>
          <span class="rank-progress">
            <small v-if="isGuild">公会名册 · 共 {{ total ?? '—' }} 人同行</small>
            <small v-else-if="upperText"
              >{{ isTrial ? '本周试炼' : '战力榜' }} · {{ upperText }}</small
            >
            <small v-else>{{ isTrial ? '本周试炼榜' : '战力榜' }}</small>
            <i v-if="total && !isGuild" class="progress-track">
              <i class="progress-fill" :style="{ width: `${upperRatio * 100}%` }" />
            </i>
            <span v-if="isGuild" class="guild-context">同一座樱庭，共同建设与远征</span>
          </span>
        </div>

        <!-- 大数字：本周伤害 / 战力 -->
        <div class="hero-stat">
          <small>{{ isTrial ? '本周最好成绩' : `等级 Lv.${level ?? '—'} · 战力` }}</small>
          <strong class="num">{{ abbr(displayValue) }}</strong>
        </div>

        <p v-if="bio" class="sheet-bio">「{{ bio }}」</p>

        <footer class="sheet-actions">
          <button
            v-if="isMe && !isGuild"
            type="button"
            class="action-btn edit"
            @click="emit('editProfile')"
          >
            <Pencil :size="13" aria-hidden="true" />
            编辑档案
          </button>
          <button
            v-else-if="canReport"
            type="button"
            class="action-btn report"
            @click="emit('report')"
          >
            <Flag :size="13" aria-hidden="true" />
            举报档案
          </button>
          <button type="button" class="action-btn plain" @click="requestClose">
            {{ isGuild ? '返回名册' : '返回榜单' }}
          </button>
        </footer>
      </section>
    </div>
  </Teleport>
</template>

<style scoped>
.peek-overlay {
  position: fixed;
  z-index: 90;
  inset: 0;
  display: flex;
  align-items: flex-end;
  justify-content: center;
  padding: 16px 16px max(20px, env(safe-area-inset-bottom));
  background: rgb(70 89 107 / 38%);
  backdrop-filter: blur(4px);
  animation: peek-fade var(--t-mid) ease both;
}

.player-sheet {
  position: relative;
  overflow: hidden;
  width: 100%;
  max-width: 400px;
  padding: 14px 14px 12px;
  background: rgb(255 255 255 / 95%);
  border: 1px solid rgb(255 255 255 / 88%);
  border-radius: 22px;
  box-shadow:
    0 20px 48px rgb(53 69 91 / 26%),
    0 2px 8px rgb(53 69 91 / 10%);
  backdrop-filter: blur(16px) saturate(1.4);
  -webkit-backdrop-filter: blur(16px) saturate(1.4);
  animation: sheet-rise var(--t-slow) var(--ease-out-back) both;
}

/* 奖牌色柔光：前三名开卡自带金/银/铜氛围 */
.sheet-glow {
  position: absolute;
  top: -60px;
  right: -40px;
  width: 200px;
  height: 200px;
  background: radial-gradient(circle, var(--pink-soft) 0%, transparent 66%);
  opacity: 0.7;
  pointer-events: none;
}

.player-sheet[data-medal='gold'] .sheet-glow {
  background: radial-gradient(circle, rgb(246 207 106 / 55%) 0%, transparent 66%);
}
.player-sheet[data-medal='silver'] .sheet-glow {
  background: radial-gradient(circle, rgb(215 225 234 / 70%) 0%, transparent 66%);
}
.player-sheet[data-medal='bronze'] .sheet-glow {
  background: radial-gradient(circle, rgb(234 177 139 / 50%) 0%, transparent 66%);
}

/* ── 头部：旋转光环大头像 ── */
.sheet-head {
  position: relative;
  display: flex;
  align-items: center;
  gap: 11px;
}

.avatar-wrap {
  position: relative;
  display: grid;
  width: 56px;
  height: 56px;
  flex-shrink: 0;
  place-items: center;
}

.avatar-ring {
  position: absolute;
  inset: 0;
  border: 2px dashed rgb(232 155 190 / 60%);
  border-radius: 50%;
  animation: ring-spin 12s linear infinite;
}

@keyframes ring-spin {
  to {
    transform: rotate(360deg);
  }
}

.sheet-avatar {
  width: 44px;
  height: 44px;
  font-size: 24px;
  box-shadow: 0 4px 12px rgb(127 95 127 / 18%);
}

.head-copy {
  display: flex;
  min-width: 0;
  flex: 1;
  flex-direction: column;
  gap: 2px;
}

.head-copy small {
  font-size: 9px;
  color: var(--text-dim);
}

.head-copy strong {
  overflow: hidden;
  font-size: 16px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.me-badge {
  padding: 2px 7px;
  font-size: 9px;
  font-style: normal;
  font-weight: 800;
  color: #fff;
  vertical-align: 2px;
  background: linear-gradient(135deg, var(--pink), var(--pink-deep));
  border-radius: 999px;
}

.sheet-close {
  display: grid;
  width: 44px;
  height: 44px;
  flex-shrink: 0;
  place-items: center;
  color: var(--text-mid);
  background: var(--panel-3);
  border-radius: 50%;
}

/* ── 立绘舞台 ── */
.art-stage {
  position: relative;
  overflow: hidden;
  display: flex;
  align-items: center;
  justify-content: center;
  height: 148px;
  margin-top: 12px;
  background:
    radial-gradient(
      80% 120% at 50% 118%,
      color-mix(in srgb, var(--class-color, #e88eb8) 22%, transparent),
      transparent 62%
    ),
    linear-gradient(180deg, rgb(250 246 251 / 66%), rgb(240 246 252 / 80%));
  border: 1px solid var(--hairline);
  border-radius: 16px;
}

.art-aura {
  position: absolute;
  inset: -40%;
  background: conic-gradient(
    from 0deg,
    transparent,
    color-mix(in srgb, var(--class-color, #e88eb8) 16%, transparent),
    transparent 30%
  );
  animation: aura-spin 9s linear infinite;
  pointer-events: none;
}

@keyframes aura-spin {
  to {
    transform: rotate(360deg);
  }
}

.art-figure {
  width: min(52%, 168px);
  height: 134px;
  animation: figure-float 3.8s ease-in-out infinite;
  filter: drop-shadow(0 8px 16px rgb(53 69 91 / 20%));
}

@keyframes figure-float {
  0%,
  100% {
    transform: translateY(0);
  }
  50% {
    transform: translateY(-5px);
  }
}

.art-class {
  position: absolute;
  right: 10px;
  bottom: 8px;
  font-size: 10px;
  font-weight: 800;
  letter-spacing: 1px;
  opacity: 0.85;
}

/* ── 名次与上位进度 ── */
.rank-band {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-top: 10px;
}

.rank-medal {
  display: grid;
  width: 58px;
  height: 58px;
  flex-shrink: 0;
  place-items: center;
  align-content: center;
  color: var(--text-mid);
  background: var(--panel-2);
  border: 1px solid var(--line);
  border-radius: 18px;
}

.rank-medal small {
  font-size: 8px;
  color: var(--text-dim);
}

.rank-medal b {
  font-size: 19px;
  font-weight: 900;
  line-height: 1.1;
}

.rank-medal[data-medal='gold'],
.rank-medal[data-medal='silver'],
.rank-medal[data-medal='bronze'] {
  color: #fff;
  border: 1px solid rgb(255 255 255 / 65%);
  box-shadow:
    inset 0 1px 0 rgb(255 255 255 / 40%),
    0 5px 14px rgb(96 74 32 / 18%);
  animation: medal-pop 0.5s var(--ease-out-back) both 0.14s;
}

.rank-medal[data-medal='gold'] {
  background: linear-gradient(150deg, #f6cf6a, #dfa018);
}
.rank-medal[data-medal='silver'] {
  background: linear-gradient(150deg, #d7e1ea, #9aa8b5);
}
.rank-medal[data-medal='bronze'] {
  background: linear-gradient(150deg, #eab18b, #c07846);
}

.rank-medal[data-medal] small {
  color: rgb(255 255 255 / 82%);
}

.rank-medal[data-medal] b {
  text-shadow: 0 1px 3px rgb(0 0 0 / 20%);
}

@keyframes medal-pop {
  from {
    opacity: 0;
    transform: scale(0.5) rotate(-8deg);
  }
  to {
    opacity: 1;
    transform: scale(1) rotate(0);
  }
}

.rank-progress {
  display: flex;
  min-width: 0;
  flex: 1;
  flex-direction: column;
  gap: 6px;
}

.rank-progress small {
  font-size: 10px;
  color: var(--text-mid);
}

.guild-context {
  font-size: 9px;
  line-height: 1.45;
  color: var(--text-dim);
}

.progress-track {
  overflow: hidden;
  height: 8px;
  background: var(--panel-3);
  border-radius: 999px;
}

.progress-fill {
  display: block;
  height: 100%;
  background: linear-gradient(90deg, var(--blue), var(--pink));
  border-radius: 999px;
  animation: fill-grow 0.7s var(--ease-soft) both 0.24s;
}

@keyframes fill-grow {
  from {
    width: 0;
  }
}

/* ── 大数字 ── */
.hero-stat {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1px;
  margin-top: 10px;
  padding: 9px 10px 8px;
  background: linear-gradient(120deg, rgb(255 240 247 / 80%), rgb(237 248 255 / 80%));
  border: 1px solid var(--hairline);
  border-radius: 14px;
}

.hero-stat small {
  font-size: 9px;
  color: var(--text-dim);
}

.hero-stat strong {
  font-size: 27px;
  font-weight: 900;
  line-height: 1.15;
  background: linear-gradient(120deg, var(--pink-deep), var(--blue-deep));
  -webkit-background-clip: text;
  background-clip: text;
  color: transparent;
}

.sheet-bio {
  margin-top: 9px;
  font-size: 11px;
  line-height: 1.6;
  text-align: center;
  color: var(--text-mid);
}

/* ── 操作行 ── */
.sheet-actions {
  display: flex;
  gap: 7px;
  margin-top: 11px;
}

.action-btn {
  flex: 1;
  min-height: 44px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 5px;
  font-size: 12px;
  font-weight: 800;
  border-radius: 999px;
  transition:
    transform var(--t-fast) var(--ease-spring),
    filter var(--t-mid) ease;
}

.action-btn:active {
  transform: scale(0.94);
}

.action-btn.edit {
  color: #fff;
  background: linear-gradient(135deg, var(--pink), var(--pink-deep));
  box-shadow: 0 4px 12px rgb(245 121 159 / 32%);
}

.action-btn.report {
  color: var(--text-mid);
  background: var(--panel-3);
  border: 1px solid var(--line);
}

.action-btn.plain {
  color: var(--blue-deep);
  background: #eef8ff;
  border: 1px solid #b7daef;
}

/* ── 内容错峰入场 ── */
.sheet-head,
.art-stage,
.rank-band,
.hero-stat,
.sheet-bio,
.sheet-actions {
  animation: rise-in 0.36s var(--ease-soft) both;
}

.art-stage {
  animation-delay: 45ms;
}
.rank-band {
  animation-delay: 90ms;
}
.hero-stat {
  animation-delay: 135ms;
}
.sheet-bio {
  animation-delay: 175ms;
}
.sheet-actions {
  animation-delay: 215ms;
}

@keyframes peek-fade {
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
  }
}

@keyframes sheet-rise {
  from {
    opacity: 0;
    transform: translateY(30px) scale(0.95);
  }
  to {
    opacity: 1;
    transform: translateY(0) scale(1);
  }
}

@keyframes rise-in {
  from {
    opacity: 0;
    transform: translateY(10px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

@media (prefers-reduced-motion: reduce) {
  .peek-overlay,
  .player-sheet,
  .sheet-head,
  .art-stage,
  .rank-band,
  .hero-stat,
  .sheet-bio,
  .sheet-actions,
  .art-figure,
  .art-aura,
  .avatar-ring,
  .rank-medal[data-medal],
  .progress-fill {
    animation: none;
  }
}
</style>
