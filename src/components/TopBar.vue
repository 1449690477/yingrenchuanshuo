<script setup lang="ts">
import { computed, onUnmounted, ref, watch } from 'vue';
import { Coins, Swords, Zap } from '@lucide/vue';
import { abbr, signed } from '@/core/format';
import { useInventoryStore } from '@/stores/inventory';
import { usePlayerStore } from '@/stores/player';
import { CLASS_INFO } from '@/data/constants';
import CharacterAppearance from '@/components/CharacterAppearance.vue';

const playerStore = usePlayerStore();
const inventoryStore = useInventoryStore();

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

onUnmounted(() => clearTimeout(hideTimer));

const cls = computed(() => (playerStore.player ? CLASS_INFO[playerStore.player.classId] : null));
</script>

<template>
  <header v-if="playerStore.player" class="topbar">
    <div class="avatar">
      <CharacterAppearance
        :class-id="playerStore.player.classId"
        :level="playerStore.player.level"
        :equipped="inventoryStore.equipped"
        variant="avatar"
      />
    </div>

    <div class="info">
      <div class="line1">
        <span class="name">{{ playerStore.player.name }}</span>
        <span class="lv num">Lv.{{ playerStore.player.level }}</span>
        <span v-if="cls" class="cls">{{ cls.name }}</span>
      </div>
      <div class="expbar">
        <div class="expbar-fill" :style="{ width: playerStore.expPercent + '%' }" />
      </div>
    </div>

    <div class="stats">
      <div class="stat cp-stat">
        <Swords class="ic cp-icon" :size="12" :stroke-width="2.3" aria-hidden="true" />
        <span class="val num">{{ abbr(playerStore.cp) }}</span>
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
        <Coins class="ic coin-icon" :size="12" :stroke-width="2.3" aria-hidden="true" />
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

.avatar {
  width: 36px;
  height: 36px;
  flex-shrink: 0;
  display: grid;
  place-items: center;
  font-size: 18px;
  border-radius: 50%;
  background: linear-gradient(135deg, var(--pink-soft), var(--blue-soft));
  border: 1.5px solid var(--pink);
  overflow: hidden;
}

.info {
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
  overflow: hidden;
}

.expbar-fill {
  height: 100%;
  border-radius: 3px;
  background: linear-gradient(90deg, var(--pink), var(--gold));
  transition: width 0.35s;
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
</style>
