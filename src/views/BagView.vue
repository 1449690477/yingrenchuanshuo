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

const bagEquips = computed(() => {
  const list = inventory.bag?.equipment ?? [];
  // 战力高的排前面，玩家一眼看到值钱的
  return [...list].sort((a, b) => scoreOf(b) - scoreOf(a));
});

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
    .filter((e) => {
      const d = requireEquipment(e.defId);
      return (d.quality === 'common' || d.quality === 'fine') && !e.locked;
    })
    .map((e) => e.uid);

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
        装备 <span class="n num">{{ bagEquips.length }}</span>
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
        <p v-if="bagEquips.length === 0" class="empty">背包空空的，去挂机打点装备吧～</p>
        <button v-for="e in bagEquips" :key="e.uid" class="row equip-row" @click="detail = e">
          <EquipmentIcon :def="requireEquipment(e.defId)" :enhance="e.enhance" :locked="e.locked" />
          <span class="mid">
            <span class="name" :class="'q-' + requireEquipment(e.defId).quality">
              {{ requireEquipment(e.defId).name }}
              <span v-if="e.enhance > 0" class="enh">+{{ e.enhance }}</span>
            </span>
            <span class="sub">
              {{ SLOT_LABELS[requireEquipment(e.defId).slot] }} ·
              {{ QUALITY_LABELS[requireEquipment(e.defId).quality] }} · Lv{{
                requireEquipment(e.defId).level
              }}
            </span>
          </span>
          <span class="cp">
            <span class="cp-label">战力</span>
            <span class="num">{{ abbr(scoreOf(e)) }}</span>
          </span>
        </button>
      </template>

      <template v-else>
        <p v-if="bagItems.length === 0" class="empty">还没有材料。</p>
        <div v-for="it in bagItems" :key="it.id" class="row static">
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

    <Transition name="fade">
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

    <EquipDetail v-if="detail" :inst="detail" from="bag" @close="detail = null" />
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

.empty {
  grid-column: 1 / -1;
  padding: 30px 10px;
  font-size: 12px;
  text-align: center;
  color: var(--text-dim);
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
}

.row.static {
  cursor: default;
}

.equip-row {
  min-height: 66px;
  padding: 7px 9px;
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

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}

.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.2s;
}
</style>
