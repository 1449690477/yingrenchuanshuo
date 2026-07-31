<script setup lang="ts">
import { computed } from 'vue';
import { ChevronLeft, Layers } from '@lucide/vue';
import { useInventoryStore } from '@/stores/inventory';
import { usePlayerStore } from '@/stores/player';
import { useUiStore } from '@/stores/ui';
import SetCodexCard from '@/components/setCodex/SetCodexCard.vue';
import {
  buildSetCodex,
  SET_CODEX_GROUP_LABELS,
  setProgressFor,
  type SetCodexGroup,
} from '@/components/setCodex/setCodexData';

const emit = defineEmits<{ (e: 'close'): void }>();

const player = usePlayerStore();
const inventory = useInventoryStore();
const ui = useUiStore();

const classId = computed(() => {
  const id = player.player?.classId;
  if (!id) throw new Error('[套装图鉴错误] 存档未载入，无法解析职业外观');
  return id;
});

const entries = computed(() => buildSetCodex(classId.value));

/** 拥有集合只建一次，所有卡片共用。 */
// 「曾经获得过」∪「此刻持有」：分解掉的装备仍然算收集过（docs/63 §4.2）。
// 并上当前持有是为了让迁移前后的任何中间状态都不倒退。
const ownedDefIds = computed<ReadonlySet<string>>(() => {
  const set = new Set<string>(inventory.discoveredDefIds);
  for (const inst of inventory.bag?.equipment ?? []) set.add(inst.defId);
  for (const inst of Object.values(inventory.equipped ?? {})) {
    if (inst) set.add(inst.defId);
  }
  return set;
});

const collectionInput = computed(() => ({
  bagEquipment: inventory.bag?.equipment ?? [],
  equipped: Object.values(inventory.equipped ?? {}),
  bagItems: inventory.bag?.items ?? {},
  discoveredDefIds: inventory.discoveredDefIds,
}));

const progressBySetId = computed(() => {
  const map = new Map<string, ReturnType<typeof setProgressFor>>();
  for (const entry of entries.value) {
    map.set(entry.setId, setProgressFor(entry, collectionInput.value));
  }
  return map;
});

const groups = computed(() => {
  const order: SetCodexGroup[] = ['region', 'dungeon', 'arena'];
  return order.map((group) => {
    const list = entries.value.filter((entry) => entry.group === group);
    return {
      key: group,
      label: SET_CODEX_GROUP_LABELS[group],
      entries: list,
      completeCount: list.filter((entry) => progressBySetId.value.get(entry.setId)?.complete).length,
    };
  });
});

const summary = computed(() => {
  const all = entries.value;
  const completeSets = all.filter((entry) => progressBySetId.value.get(entry.setId)?.complete).length;
  let owned = 0;
  let total = 0;
  for (const entry of all) {
    const progress = progressBySetId.value.get(entry.setId);
    owned += progress?.ownedPieces ?? 0;
    total += progress?.totalPieces ?? 0;
  }
  return { completeSets, totalSets: all.length, owned, total };
});

function jumpCraft() {
  ui.setTab('bag');
  emit('close');
}
</script>

<template>
  <section class="codex-view" role="region" aria-label="套装图鉴">
    <header class="codex-top">
      <button type="button" class="codex-back" aria-label="返回" @click="emit('close')">
        <ChevronLeft :size="18" />
      </button>
      <span class="codex-title">
        <small>已集齐 / 缺哪件 / 从哪掉</small>
        <strong>套装图鉴</strong>
      </span>
      <span class="codex-sum" aria-label="图鉴总进度">
        <Layers :size="11" />
        {{ summary.completeSets }}/{{ summary.totalSets }} 套
      </span>
    </header>

    <main class="codex-scroll scroll-y">
      <!--
        存档 v17 起这里是「已收集」而不是「当前持有」：拥有关系取自永久图鉴
        账本（曾经获得过 ∪ 此刻持有），分解不会让它倒退。
        账本落地之前这一页只能按背包推导，那会踩 docs/40 红线
        「不许进度条倒退」—— 所以当时的文案刻意写成「当前持有」。
      -->
      <p class="codex-hint">
        共 {{ summary.totalSets }} 套 · 已收集 {{ summary.owned }}/{{ summary.total }} 件；
        点亮全部部位即算集齐，穿上对应件数可激活套装效果。
      </p>
      <p class="codex-note">
        <b>分解不会抹掉收集记录</b> —— 曾经获得过就一直亮着，
        放心清背包。账本从本次更新开始记录，此前已分解的装备无法追溯。
      </p>

      <section
        v-for="group in groups"
        :key="group.key"
        class="codex-group"
        :aria-label="group.label"
      >
        <h2 class="group-head">
          {{ group.label }}
          <em>{{ group.completeCount }}/{{ group.entries.length }} 集齐</em>
        </h2>
        <SetCodexCard
          v-for="(entry, i) in group.entries"
          :key="entry.setId"
          class="codex-card"
          :style="{ '--card-delay': `${Math.min(i, 5) * 45}ms` }"
          :entry="entry"
          :progress="progressBySetId.get(entry.setId)!"
          :class-id="classId"
          :owned-def-ids="ownedDefIds"
          @jump-craft="jumpCraft"
        />
      </section>
    </main>
  </section>
</template>

<style scoped>
.codex-view {
  position: absolute;
  z-index: 30;
  inset: 0;
  display: flex;
  flex-direction: column;
  min-height: 0;
  color: var(--text);
  background:
    radial-gradient(120% 60% at 50% -10%, rgb(255 214 232 / 55%), transparent 60%),
    radial-gradient(100% 50% at 100% 0%, rgb(205 224 248 / 5%), transparent 55%),
    linear-gradient(180deg, #fdf6fa 0%, #f3f6fc 100%);
}

.codex-top {
  display: grid;
  grid-template-columns: 40px minmax(0, 1fr) auto;
  align-items: center;
  gap: 8px;
  padding: calc(10px + env(safe-area-inset-top)) 12px 10px;
  background: rgb(255 255 255 / 72%);
  border-bottom: 1px solid var(--hairline);
  backdrop-filter: blur(10px);
}

.codex-back {
  width: 40px;
  height: 40px;
  display: grid;
  place-items: center;
  color: var(--text-mid);
  background: #fff;
  border: 1px solid var(--hairline);
  border-radius: 12px;
  box-shadow: 0 3px 8px rgb(67 50 76 / 8%);
  transition: transform var(--t-fast) var(--ease-spring);
}

.codex-back:active {
  transform: scale(0.94);
}

.codex-title {
  display: flex;
  flex-direction: column;
  gap: 1px;
  min-width: 0;
}

.codex-title small {
  font-size: 9px;
  color: var(--text-dim);
}

.codex-title strong {
  font-size: 16px;
}

.codex-sum {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 6px 10px;
  font-size: 10px;
  font-weight: 800;
  color: #78405f;
  background: #fff;
  border: 1px solid #ffd9e7;
  border-radius: 999px;
  box-shadow: 0 3px 8px rgb(192 74 119 / 12%);
}

.codex-scroll {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  gap: 14px;
  padding: 12px 12px calc(18px + env(safe-area-inset-bottom));
}

.codex-hint {
  margin: 0;
  padding: 0 2px;
  font-size: 10px;
  line-height: 1.6;
  color: var(--text-dim);
}

/* 口径说明比正文再弱一档：它是防误解的注脚，不该和进度数字抢注意力 */
.codex-note {
  margin: -4px 0 0;
  padding: 0 2px;
  font-size: 9.5px;
  line-height: 1.6;
  color: var(--text-dim);
  opacity: 0.82;
}

.codex-note b {
  font-weight: 700;
  color: var(--text);
}

.codex-group {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.group-head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  margin: 0;
  padding: 0 2px;
  font-size: 12px;
}

.group-head em {
  font-size: 9px;
  font-style: normal;
  font-weight: 600;
  color: var(--text-dim);
}

.codex-card {
  animation: codex-card-in 0.5s var(--ease-soft) both;
  animation-delay: var(--card-delay, 0ms);
}

@keyframes codex-card-in {
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
  .codex-card {
    animation: none;
  }
}
</style>
