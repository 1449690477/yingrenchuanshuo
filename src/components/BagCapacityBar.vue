<script setup lang="ts">
import { computed } from 'vue';
import { Coins, PackagePlus, ShieldCheck } from '@lucide/vue';
import { abbr } from '@/core/format';
import {
  BAG_EXPANSION_MAX_CAPACITY,
  nextBagExpansion,
} from '@/core/bagExpansion';

const props = defineProps<{
  /** 当前背包容量（存档值）。 */
  capacity: number;
  /** 当前装备数量。 */
  equipCount: number;
  /** 玩家金币（负担判定）。 */
  gold: number;
  /** 扩容回调：父级接线（game.buyBagCapacity）。 */
  onExpand?: () => void;
}>();

const next = computed(() => nextBagExpansion(props.capacity));
const max = computed(() => BAG_EXPANSION_MAX_CAPACITY);
const percent = computed(() => {
  return Math.min(100, Math.round((props.capacity / max.value) * 100));
});
const full = computed(() => next.value === null);
const canAfford = computed(() => next.value !== null && props.gold >= next.value.goldCost);
</script>

<template>
  <section class="bag-capacity card" data-testid="bag-capacity">
    <div class="cap-head">
      <span class="cap-title">
        <ShieldCheck :size="14" aria-hidden="true" />
        背包容量
      </span>
      <span class="cap-num num">
        {{ equipCount }} / {{ capacity }}
        <small v-if="!full">· 可扩至 {{ max }}</small>
      </span>
    </div>

    <div class="cap-track" :aria-label="`容量 ${capacity}/${max}`">
      <i class="cap-fill" :style="{ width: `${percent}%` }" />
    </div>

    <div class="cap-foot">
      <span v-if="full" class="cap-state done">已满档 · 容量 {{ max }}</span>
      <span v-else class="cap-next">
        <Coins :size="12" aria-hidden="true" />
        下一档 +50 · {{ abbr(next!.goldCost) }} 金币
      </span>
      <button
        v-if="!full"
        type="button"
        class="cap-btn"
        :disabled="!canAfford"
        :aria-label="`扩容至 ${next!.capacity}（${abbr(next!.goldCost)} 金币）`"
        @click="onExpand?.()"
      >
        <PackagePlus :size="14" aria-hidden="true" />
        扩容
      </button>
    </div>
  </section>
</template>

<style scoped>
.bag-capacity {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 10px 12px;
  border-radius: 12px;
  background: linear-gradient(160deg, #eef4ff, var(--surface-2, #faf5fa));
  border: 1px solid #dde7f7;
}

.cap-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.cap-title {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  font-size: 12px;
  font-weight: 600;
  color: #4a5b82;
}

.cap-num {
  font-size: 13px;
}

.cap-num small {
  font-size: 11px;
  color: var(--text-dim, #8b7f93);
}

.cap-track {
  height: 6px;
  border-radius: 4px;
  background: #dbe4f2;
  overflow: hidden;
}

.cap-fill {
  display: block;
  height: 100%;
  border-radius: 4px;
  background: linear-gradient(90deg, #7fa8f2, #4a7de0);
  transition: width 0.25s ease-out;
}

.cap-foot {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.cap-next,
.cap-state {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 11px;
  color: var(--text-dim, #8b7f93);
}

.cap-state.done {
  color: #3f7f4f;
}

.cap-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 4px;
  min-height: 38px;
  padding: 0 12px;
  border: 0;
  border-radius: 9px;
  font-size: 12px;
  font-weight: 600;
  color: #fff;
  background: #4a7de0;
  flex: none;
}

.cap-btn:disabled {
  color: var(--text-dim, #8b7f93);
  background: #e2e8f2;
  cursor: not-allowed;
}
</style>
