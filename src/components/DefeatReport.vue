<script setup lang="ts">
/**
 * DefeatReport —— 战败战报弹层（docs/57 K3）。
 *
 * 效率 <0.5 连续 3 场后被退回上一关时弹出。定位是「有温度的指路牌」：
 * 只退一关、不扣任何资产，所以文案里绝不出现代价类措辞，
 * 并且顺手给一条最短的养成路径（先养成按钮直达养成页）。
 *
 * 全局锚点在 App.vue（与 OfflineModal 同级），game.defeatReport 非 null 即弹。
 * 战报是单值而非队列：连续战败只会更新同一份内容，不会叠多层弹窗。
 */
import { computed } from 'vue';
import { Sprout, Undo2 } from '@lucide/vue';
import { useGameStore } from '@/stores/game';
import { useUiStore } from '@/stores/ui';

const ui = useUiStore();
const game = useGameStore();

/** 战报是单值而非队列：连续战败只更新同一份内容，不会叠多层弹窗。 */
const report = computed(() => game.defeatReport);

function dismiss(): void {
  game.dismissDefeatReport();
}

function goGrowth(): void {
  game.dismissDefeatReport();
  ui.setTab('growth');
}
</script>

<template>
  <Transition name="modal-pop">
    <div
      v-if="report"
      class="overlay"
      role="dialog"
      aria-modal="true"
      aria-label="战败战报"
      @click.self="dismiss"
    >
      <div class="sheet defeat-sheet">
        <div class="top">
          <div class="mark" aria-hidden="true">
            <Undo2 :size="26" :stroke-width="2" />
          </div>
          <h3>稍作休整</h3>
          <p class="sub">
            {{ report.monsterName }} 太凶了，少女退回了「{{ report.toStageName }}」——
            强化装备后再来
          </p>
        </div>

        <div class="route" aria-label="关卡变动">
          <span class="node from">{{ report.fromStageName }}</span>
          <span class="arrow" aria-hidden="true">→</span>
          <span class="node to">{{ report.toStageName }}</span>
        </div>

        <div class="actions">
          <button class="btn btn-pink" @click="goGrowth">
            <Sprout :size="14" aria-hidden="true" />
            先养成
          </button>
          <button class="btn btn-plain" @click="dismiss">知道了</button>
        </div>
      </div>
    </div>
  </Transition>
</template>

<style scoped>
.defeat-sheet {
  width: 100%;
  max-width: 340px;
  padding: 22px 18px 16px;
  background: var(--panel);
  border-radius: var(--r-lg);
  box-shadow: var(--shadow-lg);
  text-align: center;
}

.top {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
}

.mark {
  display: grid;
  place-items: center;
  width: 56px;
  height: 56px;
  color: var(--blue-deep);
  background: linear-gradient(140deg, var(--blue-soft), var(--pink-soft));
  border-radius: 50%;
  box-shadow: 0 6px 16px rgb(105 145 185 / 22%);
}

.top h3 {
  font-size: 16px;
  font-weight: 800;
}

.sub {
  font-size: 12px;
  line-height: 1.7;
  color: var(--text-mid);
}

.route {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  margin: 14px 0 16px;
  padding: 9px 10px;
  background: var(--panel-2);
  border: 1px solid var(--line);
  border-radius: var(--r-sm);
}

.node {
  min-width: 0;
  overflow: hidden;
  font-size: 11px;
  font-weight: 600;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.node.from {
  color: var(--text-dim);
}

.node.to {
  color: var(--blue-deep);
}

.arrow {
  flex-shrink: 0;
  font-size: 11px;
  color: var(--text-dim);
}

.actions {
  display: flex;
  gap: 8px;
}

.actions .btn {
  flex: 1;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 5px;
  padding: 10px 0;
  font-size: 12px;
}
</style>
