<script setup lang="ts">
import { computed, ref } from 'vue';
import { abbr } from '@/core/format';
import type { EquipmentInstance } from '@/core/types';
import { useInventoryStore } from '@/stores/inventory';
import { requireEquipment } from '@/data/equipment';
import { requireItem } from '@/data/items';
import { QUALITY_LABELS, SLOT_LABELS } from '@/data/constants';
import EquipDetail from '@/components/EquipDetail.vue';
import EquipmentIcon from '@/components/EquipmentIcon.vue';
import ItemIcon from '@/components/ItemIcon.vue';
import SystemArtwork from '@/components/SystemArtwork.vue';

const inventory = useInventoryStore();
const tab = ref<'equip' | 'item'>('equip');
const detail = ref<EquipmentInstance | null>(null);
const toast = ref('');
const salvageBurst = ref(false);

/**
 * 一次渲染的最大条数。
 *
 * 背包可能堆到上万件（挂机一下午就能到 1.5 万），
 * 全部渲染成 DOM 会直接把浏览器卡死 —— 真出过这个事故。
 * 只渲染战力最高的一批，剩下的用「一键分解」处理。
 */
const RENDER_LIMIT = 150;

/** 装备总数。只读长度，不做任何战力计算。 */
const equipCount = computed(() => inventory.bag?.equipment.length ?? 0);

const bagEquips = computed(() => {
  // 只在装备页激活时才做昂贵的评分与排序
  if (tab.value !== 'equip') return [];
  const list = inventory.bag?.equipment ?? [];
  if (list.length === 0) return [];

  // ⚠ 关键：战力只算一遍。
  // 早先写成 sort((a,b) => scoreOf(b) - scoreOf(a))，
  // 1.5 万件时 sort 会触发约 43 万次战力计算，页面直接假死。
  const scored = list.map((inst) => ({
    inst,
    def: requireEquipment(inst.defId),
    score: scoreOf(inst),
  }));
  scored.sort((a, b) => b.score - a.score);
  return scored;
});

/** 实际渲染的那一批 */
const visibleEquips = computed(() => bagEquips.value.slice(0, RENDER_LIMIT));

/** 被折叠没显示的数量 */
const hiddenEquipCount = computed(() => Math.max(0, bagEquips.value.length - RENDER_LIMIT));

const bagItems = computed(() => {
  const items = inventory.bag?.items ?? {};
  return Object.entries(items)
    .filter(([, n]) => n > 0)
    .map(([id, n]) => ({ id, count: n, def: requireItem(id) }))
    .sort((a, b) => b.def.sellPrice - a.def.sellPrice);
});

function scoreOf(inst: EquipmentInstance): number {
  return inventory.contributionCp(inst);
}

/** 一键分解：白绿装且未锁定的 */
function decomposeJunk() {
  const targets = bagEquips.value
    .filter((r) => (r.def.quality === 'common' || r.def.quality === 'fine') && !r.inst.locked)
    .map((r) => r.inst.uid);

  if (targets.length === 0) {
    show('没有可分解的白/绿装备');
    return;
  }
  const r = inventory.decompose(targets);
  playSalvageBurst();
  show(`分解 ${r.count} 件，获得 ${abbr(r.gold)} 金币`);
}

function equipBest() {
  const n = inventory.equipBest();
  show(n > 0 ? `已更换 ${n} 个部位` : '当前装备已经是最优了');
}

let toastTimer = 0;
let effectTimer = 0;
function show(msg: string) {
  toast.value = msg;
  clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => (toast.value = ''), 2000);
}

function playSalvageBurst() {
  salvageBurst.value = false;
  window.requestAnimationFrame(() => {
    salvageBurst.value = true;
    clearTimeout(effectTimer);
    effectTimer = window.setTimeout(() => (salvageBurst.value = false), 1250);
  });
}
</script>

<template>
  <div class="bag">
    <div class="tabs">
      <button class="t" :class="{ on: tab === 'equip' }" @click="tab = 'equip'">
        <!-- 用 equipCount 而不是 bagEquips.length：后者会触发全量战力计算，
             而这个标签是常驻渲染的，挂机时每次掉落都会重算一遍 -->
        装备 <span class="n num">{{ equipCount }}</span>
      </button>
      <button class="t" :class="{ on: tab === 'item' }" @click="tab = 'item'">
        材料 <span class="n num">{{ bagItems.length }}</span>
      </button>
    </div>

    <div v-if="tab === 'equip'" class="actions">
      <button class="btn btn-pink sm" @click="equipBest">一键穿戴最优</button>
      <button class="btn btn-plain sm" @click="decomposeJunk">分解白绿</button>
    </div>

    <div class="list scroll-y" :class="{ 'equip-list': tab === 'equip' }">
      <template v-if="tab === 'equip'">
        <!--
          合并说明：视觉部分取 UI 打磨版（空态图标、品质描边、入场错峰动画），
          但列表数据必须保留性能版的 visibleEquips / row.def ——
          直接 v-for 全量 bagEquips 并在模板里反复调 requireEquipment，
          背包上万件时会把页面卡死（见 67334df）。
        -->
        <p v-if="equipCount === 0" class="empty">
          <span class="empty-icon" aria-hidden="true">🎒</span>
          背包空空的，去挂机打点装备吧～
        </p>
        <button
          v-for="(row, i) in visibleEquips"
          :key="row.inst.uid"
          class="row equip-row row-clickable"
          :class="'q-accent-' + row.def.quality"
          :style="{ '--row-delay': `${Math.min(i, 9) * 32}ms` }"
          @click="detail = row.inst"
        >
          <EquipmentIcon :def="row.def" :enhance="row.inst.enhance" :locked="row.inst.locked" />
          <span class="mid">
            <span class="name" :class="'q-' + row.def.quality">
              {{ row.def.name }}
              <span v-if="row.inst.enhance > 0" class="enh">+{{ row.inst.enhance }}</span>
            </span>
            <span class="sub">
              {{ SLOT_LABELS[row.def.slot] }} · {{ QUALITY_LABELS[row.def.quality] }} · Lv{{
                row.def.level
              }}
            </span>
          </span>
          <span class="cp">
            <span class="cp-label">战力</span>
            <span class="num">{{ abbr(row.score) }}</span>
          </span>
        </button>

        <p v-if="hiddenEquipCount > 0" class="more-hint">
          只显示战力最高的 {{ RENDER_LIMIT }} 件，还有
          <b class="num">{{ abbr(hiddenEquipCount) }}</b> 件未显示。
          <br />
          背包太满会拖慢游戏，建议点上面的「分解白绿」清理一下。
        </p>
      </template>

      <template v-else>
        <p v-if="bagItems.length === 0" class="empty">
          <span class="empty-icon" aria-hidden="true">🧺</span>
          还没有材料。
        </p>
        <div
          v-for="(it, i) in bagItems"
          :key="it.id"
          class="row static"
          :style="{ '--row-delay': `${Math.min(i, 9) * 32}ms` }"
        >
          <ItemIcon :item="it.def" size="md" />
          <span class="mid">
            <span class="name" :class="'q-' + it.def.tier">
              {{ it.def.name }}
            </span>
            <span class="sub">{{ it.def.desc }}</span>
          </span>
          <span class="cp num">×{{ abbr(it.count) }}</span>
        </div>
      </template>
    </div>

    <Transition name="toast-up">
      <div v-if="toast" class="toast">{{ toast }}</div>
    </Transition>

    <Transition name="salvage-pop">
      <div v-if="salvageBurst" class="salvage-burst" aria-live="polite">
        <SystemArtwork kind="salvage" class="salvage-art" />
        <span class="salvage-copy">星屑回收完成</span>
        <i class="salvage-particle p1" />
        <i class="salvage-particle p2" />
        <i class="salvage-particle p3" />
      </div>
    </Transition>

    <Transition name="modal-pop">
      <EquipDetail v-if="detail" :inst="detail" from="bag" @close="detail = null" />
    </Transition>
  </div>
</template>

<style scoped>
.bag {
  display: flex;
  flex-direction: column;
  gap: 10px;
  height: 100%;
  min-height: 0;
  position: relative;
}

.tabs {
  display: flex;
  gap: 6px;
}

.t {
  flex: 1;
  padding: 9px;
  font-size: 13px;
  font-weight: 600;
  color: var(--text-mid);
  background: var(--panel);
  border: 1px solid var(--line);
  border-radius: 999px;
  transition:
    color var(--t-mid) var(--ease-soft),
    border-color var(--t-mid) var(--ease-soft),
    transform var(--t-fast) var(--ease-spring);
}

.t:active {
  transform: scale(0.95);
}

.t.on {
  color: var(--text-on-color);
  background: linear-gradient(135deg, #ffb0d0, var(--pink-deep));
  border-color: transparent;
}

.n {
  font-size: 11px;
  opacity: 0.8;
}

.actions {
  display: flex;
  gap: 6px;
}

.sm {
  flex: 1;
  padding: 8px;
  font-size: 12px;
}

.list {
  flex: 1;
  min-height: 0;
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  grid-auto-rows: min-content;
  align-content: start;
  gap: 6px;
}

.list.equip-list {
  grid-template-columns: 1fr;
  gap: 7px;
}

.more-hint {
  padding: 14px 12px 22px;
  font-size: 11px;
  line-height: 1.8;
  text-align: center;
  color: var(--text-dim);
}

.more-hint b {
  color: var(--pink-deep);
}

.empty {
  grid-column: 1 / -1;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  padding: 30px 10px;
  font-size: 12px;
  text-align: center;
  color: var(--text-dim);
}

.empty-icon {
  font-size: 26px;
  filter: grayscale(20%) opacity(85%);
  animation: empty-bob 2.6s ease-in-out infinite;
}

@keyframes empty-bob {
  0%,
  100% {
    transform: translateY(0);
  }
  50% {
    transform: translateY(-4px);
  }
}

.row {
  display: flex;
  align-items: center;
  gap: 7px;
  padding: 8px;
  background: var(--panel);
  border: 1px solid var(--line);
  border-radius: var(--r);
  text-align: left;
  animation: row-in var(--t-slow) var(--ease-soft) both;
  animation-delay: var(--row-delay, 0ms);
}

.row.static {
  cursor: default;
}

.equip-row {
  min-height: 66px;
  padding: 7px 9px;
}

/* 品质左边条：不翻动详情也能快速分辨稀有度 */
.q-accent-common {
  box-shadow: inset 3px 0 0 var(--q-common);
}

.q-accent-fine {
  box-shadow: inset 3px 0 0 var(--q-fine);
}

.q-accent-rare {
  box-shadow: inset 3px 0 0 var(--q-rare);
}

.q-accent-epic {
  box-shadow: inset 3px 0 0 var(--q-epic);
}

.q-accent-legendary {
  box-shadow: inset 3px 0 0 var(--q-legendary);
}

.q-accent-mythic {
  box-shadow: inset 3px 0 0 var(--q-mythic);
}

.q-accent-divine {
  box-shadow: inset 3px 0 0 var(--q-divine);
}

.mid {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.name {
  font-size: 11px;
  font-weight: 600;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.enh {
  font-size: 11px;
  color: var(--q-legendary);
}

.sub {
  font-size: 9px;
  color: var(--text-dim);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.cp {
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 1px;
  font-size: 10px;
  font-weight: 700;
  color: var(--blue-deep);
}

.cp-label {
  font-size: 8px;
  font-weight: 500;
  color: var(--text-dim);
}

.toast {
  position: absolute;
  left: 50%;
  bottom: 16px;
  transform: translateX(-50%);
  padding: 9px 16px;
  font-size: 12px;
  color: #fff;
  background: rgb(70 89 107 / 92%);
  border-radius: 999px;
  white-space: nowrap;
  z-index: 20;
}

.salvage-burst {
  position: absolute;
  top: 42%;
  left: 50%;
  z-index: 25;
  width: 174px;
  height: 174px;
  display: grid;
  place-items: center;
  pointer-events: none;
  transform: translate(-50%, -50%);
  filter: drop-shadow(0 12px 22px rgb(74 111 142 / 24%));
}

.salvage-art {
  width: 148px;
  height: 148px;
}

.salvage-copy {
  position: absolute;
  bottom: -6px;
  padding: 5px 12px;
  font-size: 10px;
  font-weight: 800;
  color: #fff;
  background: linear-gradient(120deg, var(--blue-deep), var(--pink-deep));
  border: 2px solid #fff;
  border-radius: 999px;
  box-shadow: var(--shadow);
}

.salvage-particle {
  position: absolute;
  width: 7px;
  height: 7px;
  background: #ffb6d2;
  border: 1px solid #fff;
  transform: rotate(45deg);
  box-shadow: 0 0 8px #ff9dc2;
}

.p1 {
  top: 20px;
  left: 17px;
}

.p2 {
  top: 8px;
  right: 23px;
  background: #8ce5f7;
}

.p3 {
  right: 7px;
  bottom: 35px;
  background: #ffd476;
}

.salvage-pop-enter-active {
  animation: salvage-in 0.32s cubic-bezier(0.2, 1.5, 0.4, 1);
}

.salvage-pop-leave-active {
  transition:
    opacity 0.22s,
    transform 0.22s;
}

.salvage-pop-leave-to {
  opacity: 0;
  transform: translate(-50%, -54%) scale(0.92);
}

@keyframes salvage-in {
  from {
    opacity: 0;
    transform: translate(-50%, -44%) scale(0.52) rotate(-8deg);
  }
  to {
    opacity: 1;
    transform: translate(-50%, -50%) scale(1) rotate(0);
  }
}

@media (prefers-reduced-motion: reduce) {
  .salvage-pop-enter-active {
    animation: none;
  }
}

</style>
