<script setup lang="ts">
import { computed, onUnmounted, ref, watch } from 'vue';
import { Coins, Swords, Zap } from '@lucide/vue';
import { abbr, signed } from '@/core/format';
import { useGameStore } from '@/stores/game';
import { useInventoryStore } from '@/stores/inventory';
import { usePlayerStore } from '@/stores/player';
import { CLASS_INFO } from '@/data/constants';
import CharacterAppearance from '@/components/CharacterAppearance.vue';

const playerStore = usePlayerStore();
const inventoryStore = useInventoryStore();
const gameStore = useGameStore();

// ─────────── K4 · 经验条冻结态（docs/57）：到达区域顶点时「停住」，攒的经验解锁后释放 ───────────
const capInfo = computed(() => gameStore.levelCapInfo);
const expFrozen = computed(() => capInfo.value.frozen);
const capTipOpen = ref(false);

function toggleCapTip(): void {
  if (!expFrozen.value) return;
  capTipOpen.value = !capTipOpen.value;
}

/** 解锁新章解冻后 tooltip 自动收起，不留残态。 */
watch(expFrozen, (frozen) => {
  if (!frozen) capTipOpen.value = false;
});

/** 战力变化飘字。任何操作导致战力变化都要让玩家看见。 */
const floatCp = ref<{ value: number; key: number } | null>(null);
let seq = 0;
let hideTimer = 0;

watch(
  () => playerStore.cpDelta,
  (d) => {
    if (!d) return;
    floatCp.value = { value: d.value, key: ++seq };
    clearTimeout(hideTimer);
    hideTimer = window.setTimeout(() => (floatCp.value = null), 1400);
  },
);

const cls = computed(() => (playerStore.player ? CLASS_INFO[playerStore.player.classId] : null));

/** 金币增加时给图标一次轻微弹跳；消费金币不会触发。 */
const goldBump = ref(false);
let bumpFrame = 0;
let bumpTimer = 0;

watch(
  () => playerStore.player?.gold ?? 0,
  (now, before) => {
    if (before === undefined || now <= before) return;

    goldBump.value = false;
    clearTimeout(bumpTimer);
    window.cancelAnimationFrame(bumpFrame);
    bumpFrame = window.requestAnimationFrame(() => {
      goldBump.value = true;
      bumpTimer = window.setTimeout(() => (goldBump.value = false), 380);
    });
  },
);

onUnmounted(() => {
  clearTimeout(hideTimer);
  clearTimeout(bumpTimer);
  window.cancelAnimationFrame(bumpFrame);
});
</script>

<template>
  <header v-if="playerStore.player" class="topbar">
    <div class="avatar-halo">
      <div class="avatar">
        <CharacterAppearance
          :class-id="playerStore.player.classId"
          :level="playerStore.player.level"
          :equipped="inventoryStore.equipped"
          variant="avatar"
        />
      </div>
    </div>

    <div class="info">
      <div class="line1">
        <span class="name">{{ playerStore.player.name }}</span>
        <span class="lv num">Lv.{{ playerStore.player.level }}</span>
        <span v-if="cls" class="cls">{{ cls.name }}</span>
      </div>
      <div
        class="expbar"
        :class="{ frozen: expFrozen }"
        :role="expFrozen ? 'button' : undefined"
        :tabindex="expFrozen ? 0 : undefined"
        :aria-expanded="expFrozen ? capTipOpen : undefined"
        :aria-label="expFrozen ? '等级已到当前区域顶点，点击查看说明' : undefined"
        @click="toggleCapTip"
        @keydown.enter.prevent="toggleCapTip"
        @keydown.space.prevent="toggleCapTip"
      >
        <div
          class="expbar-fill"
          :style="{ width: (expFrozen ? 100 : playerStore.expPercent) + '%' }"
        />
        <span v-if="expFrozen" class="cap-badge">区域顶点</span>
      </div>
      <!-- 冻结说明：推进关卡继续升级；积攒的经验解锁后一口气释放（连升是爽点，不是惩罚） -->
      <div v-if="expFrozen && capTipOpen" class="cap-tip" role="status">
        已达当前区域顶点（Lv{{ capInfo.softCap }}）· 推进关卡以继续升级，已积攒
        {{ abbr(capInfo.pendingExp) }} 经验
      </div>
    </div>

    <div class="stats">
      <div
        class="stat cp-stat"
        title="战力不含图鉴 / 成就 / 称号集齐加成（ADR-024/025）"
        :aria-label="`战力 ${abbr(playerStore.cp)}，不含图鉴与成就集齐加成`"
      >
        <Swords class="ic cp-icon" :size="12" :stroke-width="2.3" aria-hidden="true" />
        <span class="val num">{{ abbr(playerStore.cp) }}</span>
        <span class="cp-note" aria-hidden="true">*</span>
        <Transition name="float">
          <span
            v-if="floatCp"
            :key="floatCp.key"
            class="float"
            :class="floatCp.value > 0 ? 'up' : 'down'"
          >
            {{ signed(floatCp.value) }}
          </span>
        </Transition>
      </div>
      <div class="stat">
        <Coins
          class="ic coin-icon"
          :class="{ bump: goldBump }"
          :size="12"
          :stroke-width="2.3"
          aria-hidden="true"
        />
        <span class="val num">{{ abbr(playerStore.player.gold) }}</span>
      </div>
      <div class="stat">
        <Zap class="ic stamina-icon" :size="12" :stroke-width="2.3" aria-hidden="true" />
        <span class="val num"> {{ playerStore.player.stamina }}/{{ playerStore.staminaMax }} </span>
      </div>
    </div>
  </header>
</template>

<style scoped>
.topbar {
  display: flex;
  align-items: center;
  gap: 10px;
  height: calc(var(--topbar-h) + var(--sat));
  padding: var(--sat) 12px 0;
  background: linear-gradient(160deg, #fff, var(--panel-2));
  border-bottom: 1px solid var(--line);
  flex-shrink: 0;
}

.avatar-halo {
  position: relative;
  width: 36px;
  height: 36px;
  flex-shrink: 0;
}

.avatar {
  width: 100%;
  height: 100%;
  display: grid;
  place-items: center;
  font-size: 18px;
  border-radius: 50%;
  background: linear-gradient(135deg, var(--pink-soft), var(--blue-soft));
  border: 1.5px solid var(--pink);
  overflow: hidden;
}

/* 头像外圈呼吸光环 */
.avatar-halo::after {
  content: '';
  position: absolute;
  inset: -5px;
  border-radius: 50%;
  border: 2px solid rgb(255 158 196 / 55%);
  animation: avatar-halo 3.2s ease-out infinite;
  pointer-events: none;
}

.info {
  position: relative;
  flex: 1;
  min-width: 0;
}

.line1 {
  display: flex;
  align-items: baseline;
  gap: 6px;
}

.name {
  font-size: 13px;
  font-weight: 700;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.lv {
  font-size: 11px;
  font-weight: 600;
  color: var(--blue-deep);
  flex-shrink: 0;
}

.cls {
  padding: 0 6px;
  font-size: 9px;
  color: var(--pink-deep);
  background: var(--pink-soft);
  border-radius: 999px;
  flex-shrink: 0;
}

.expbar {
  height: 5px;
  margin-top: 4px;
  border-radius: 3px;
  background: var(--panel-3);
  /* 区域顶点角标会向上浮出 8px；这里裁剪会把文字切成截图里的半截。 */
  overflow: visible;
}

.expbar-fill {
  position: relative;
  height: 100%;
  border-radius: 3px;
  background: linear-gradient(90deg, var(--pink), var(--gold));
  transition: width 0.35s var(--ease-soft);
}

/* 经验条流光 */
.expbar-fill::after {
  content: '';
  position: absolute;
  inset: 0;
  border-radius: inherit;
  background: linear-gradient(100deg, transparent 12%, rgb(255 255 255 / 72%) 50%, transparent 88%);
  background-size: 220% 100%;
  animation: exp-shimmer 2.6s var(--ease-soft) infinite;
}

/* ── K4 冻结态：满格 + 呼吸。「停住了」必须成立——不再播普通增长流光 ── */
.expbar {
  position: relative;
}

.expbar.frozen {
  cursor: pointer;
}

.expbar.frozen .expbar-fill::after {
  content: none;
  animation: none;
}

.expbar.frozen .expbar-fill {
  animation: exp-frozen-breathe 3s ease-in-out infinite;
}

@keyframes exp-frozen-breathe {
  0%,
  100% {
    filter: brightness(1);
    box-shadow: 0 0 2px rgb(245 121 159 / 30%);
  }
  50% {
    filter: brightness(1.12);
    box-shadow: 0 0 9px rgb(245 121 159 / 70%);
  }
}

/* 「区域顶点」角标：浮在经验条右端上方 */
.cap-badge {
  position: absolute;
  right: 0;
  top: -8px;
  z-index: 1;
  padding: 1px 6px;
  font-size: 7px;
  font-weight: 800;
  letter-spacing: 0.04em;
  color: var(--pink-deep);
  background: linear-gradient(120deg, #fff, var(--pink-soft));
  border: 1px solid rgb(245 158 196 / 55%);
  border-radius: 999px;
  box-shadow: 0 2px 5px rgb(245 121 159 / 18%);
  white-space: nowrap;
}

/* 冻结说明 tooltip：点经验条弹出，挂在 info 下方不顶布局 */
.cap-tip {
  position: absolute;
  left: 0;
  top: calc(100% + 5px);
  z-index: 20;
  max-width: 240px;
  padding: 7px 10px;
  font-size: 9px;
  line-height: 1.6;
  color: var(--text-mid);
  background: #fff;
  border: 1px solid rgb(245 158 196 / 45%);
  border-radius: var(--r-sm);
  box-shadow: var(--shadow-lg);
}

.cap-tip::before {
  content: '';
  position: absolute;
  left: 18px;
  top: -4px;
  width: 8px;
  height: 8px;
  background: #fff;
  border-top: 1px solid rgb(245 158 196 / 45%);
  border-left: 1px solid rgb(245 158 196 / 45%);
  transform: rotate(45deg);
}

.stats {
  display: flex;
  flex-direction: column;
  gap: 2px;
  flex-shrink: 0;
}

.stat {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 4px;
  font-size: 11px;
}

.ic {
  flex-shrink: 0;
  opacity: 0.86;
}

.cp-icon {
  color: var(--blue-deep);
}

.coin-icon {
  color: #e7a92d;
}

.coin-icon.bump {
  animation: coin-bump 0.36s var(--ease-out-back);
}

@keyframes coin-bump {
  0% {
    transform: scale(1);
  }
  45% {
    transform: scale(1.35) rotate(-8deg);
  }
  100% {
    transform: scale(1);
  }
}

.stamina-icon {
  color: #d88a31;
}

.val {
  min-width: 42px;
  text-align: right;
  font-weight: 600;
  color: var(--text-mid);
}

.cp-stat .val {
  color: var(--blue-deep);
}

/* 战力口径注记：图鉴 / 成就 / 称号集齐加成为战斗乘区、不进战力（ADR-024/025）。 */
.cp-note {
  font-size: 9px;
  color: var(--text-dim);
  margin-left: 2px;
  align-self: flex-start;
  line-height: 1;
}

/* 战力飘字 */
.float {
  position: absolute;
  right: 0;
  top: -2px;
  font-size: 11px;
  font-weight: 800;
  pointer-events: none;
  white-space: nowrap;
}

.float.up {
  color: var(--success);
}

.float.down {
  color: var(--danger);
}

.float-enter-from {
  opacity: 0;
  transform: translateY(6px);
}

.float-enter-active {
  transition: all 0.25s;
}

.float-leave-to {
  opacity: 0;
  transform: translateY(-14px);
}

.float-leave-active {
  transition: all 0.6s;
}

@keyframes exp-shimmer {
  0% {
    background-position: 120% 0;
  }
  60%,
  100% {
    background-position: -120% 0;
  }
}

@keyframes avatar-halo {
  0% {
    opacity: 0.7;
    transform: scale(0.9);
  }
  70%,
  100% {
    opacity: 0;
    transform: scale(1.22);
  }
}

@media (prefers-reduced-motion: reduce) {
  .expbar-fill::after,
  .expbar.frozen .expbar-fill,
  .avatar-halo::after,
  .coin-icon.bump {
    animation: none;
  }
}
</style>
