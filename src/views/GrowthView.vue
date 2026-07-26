<script setup lang="ts">
import { computed, ref } from 'vue';
import { abbr } from '@/core/format';
import type { EquipmentInstance, EquipSlot, Stats } from '@/core/types';
import { useInventoryStore } from '@/stores/inventory';
import { usePlayerStore } from '@/stores/player';
import { requireEquipment } from '@/data/equipment';
import { CLASS_INFO, SLOT_LABELS, SLOT_ORDER, STAT_LABELS } from '@/data/constants';
import EquipDetail from '@/components/EquipDetail.vue';

const inventory = useInventoryStore();
const player = usePlayerStore();
const detail = ref<EquipmentInstance | null>(null);

const equipped = computed(() => inventory.equipped);

const statRows = computed(() => {
  const s = player.finalStats;
  return (Object.keys(s) as (keyof Stats)[]).map((k) => ({
    key: k,
    label: STAT_LABELS[k],
    value: fmt(k, s[k]),
  }));
});

function fmt(key: keyof Stats, v: number): string {
  if (key === 'critRate' || key === 'critDmg') return v.toFixed(1) + '%';
  if (key === 'spd') return v.toFixed(2);
  return abbr(Math.round(v));
}

function slotOf(slot: EquipSlot) {
  return equipped.value?.[slot] ?? null;
}

function nameOf(slot: EquipSlot): string {
  const inst = slotOf(slot);
  if (!inst) return SLOT_LABELS[slot];
  return requireEquipment(inst.defId).name;
}

function qualityOf(slot: EquipSlot): string {
  const inst = slotOf(slot);
  if (!inst) return 'empty';
  return requireEquipment(inst.defId).quality;
}

function open(slot: EquipSlot) {
  const inst = slotOf(slot);
  if (inst) detail.value = inst;
}
</script>

<template>
  <div v-if="player.player" class="growth scroll-y">
    <!-- 角色卡 -->
    <section class="hero card">
      <div class="hero-face">🌸</div>
      <div class="hero-info">
        <div class="hero-name">
          {{ player.player.name }}
          <span class="hero-cls">{{ CLASS_INFO[player.player.classId].name }}</span>
        </div>
        <div class="hero-role">{{ CLASS_INFO[player.player.classId].role }}</div>
        <div class="hero-cp">
          战力 <span class="num">{{ abbr(player.cp) }}</span>
        </div>
      </div>
    </section>

    <!-- 装备槽 -->
    <section class="card slots-card">
      <div class="card-head">
        <span>装备</span>
        <button class="mini" @click="inventory.equipBest()">一键最优</button>
      </div>
      <div class="slots">
        <button
          v-for="slot in SLOT_ORDER"
          :key="slot"
          class="slot"
          :class="['sq-' + qualityOf(slot), { filled: !!slotOf(slot) }]"
          @click="open(slot)"
        >
          <span class="slot-label">{{ SLOT_LABELS[slot] }}</span>
          <span class="slot-name" :class="slotOf(slot) ? 'q-' + qualityOf(slot) : 'dim'">
            {{ slotOf(slot) ? nameOf(slot) : '空' }}
          </span>
          <span v-if="slotOf(slot)?.enhance" class="slot-enh">+{{ slotOf(slot)!.enhance }}</span>
        </button>
      </div>
    </section>

    <!-- 属性面板 -->
    <section class="card stats-card">
      <div class="card-head"><span>属性</span></div>
      <div class="stats">
        <div v-for="r in statRows" :key="r.key" class="stat">
          <span class="s-label">{{ r.label }}</span>
          <span class="s-value num">{{ r.value }}</span>
        </div>
      </div>
    </section>

    <!-- 后续系统占位 -->
    <section class="card soon">
      <div class="card-head"><span>即将开放</span></div>
      <div class="soon-list">
        <span class="chip">强化 · M3-2</span>
        <span class="chip">技能 · M3-5</span>
        <span class="chip">洗练 · M4-6</span>
        <span class="chip">套装 · M5-1</span>
        <span class="chip">宠物 · M6-1</span>
      </div>
    </section>

    <EquipDetail v-if="detail" :inst="detail" from="equipped" @close="detail = null" />
  </div>
</template>

<style scoped>
.growth {
  height: 100%;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

/* ── 角色卡 ── */
.hero {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 14px;
  background: linear-gradient(100deg, var(--pink-soft), var(--blue-soft));
}

.hero-face {
  width: 54px;
  height: 54px;
  flex-shrink: 0;
  display: grid;
  place-items: center;
  font-size: 26px;
  background: #fff;
  border: 2px solid var(--pink);
  border-radius: 50%;
}

.hero-info {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.hero-name {
  font-size: 16px;
  font-weight: 700;
}

.hero-cls {
  margin-left: 6px;
  padding: 1px 7px;
  font-size: 10px;
  color: var(--pink-deep);
  background: #fff;
  border-radius: 999px;
}

.hero-role {
  font-size: 10px;
  color: var(--text-mid);
}

.hero-cp {
  margin-top: 2px;
  font-size: 12px;
  color: var(--text-mid);
}

.hero-cp .num {
  font-size: 16px;
  font-weight: 800;
  color: var(--blue-deep);
}

/* ── 卡片通用 ── */
.card-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 12px;
  font-size: 11px;
  color: var(--text-dim);
  border-bottom: 1px solid var(--line);
}

.mini {
  padding: 3px 10px;
  font-size: 10px;
  font-weight: 600;
  color: var(--pink-deep);
  background: var(--pink-soft);
  border-radius: 999px;
}

/* ── 装备槽 ── */
.slots {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 6px;
  padding: 10px;
}

.slot {
  position: relative;
  display: flex;
  flex-direction: column;
  gap: 2px;
  padding: 8px 10px;
  background: var(--panel-2);
  border: 1px solid var(--line);
  border-radius: var(--r-sm);
  text-align: left;
}

.slot.filled {
  background: #fff;
}

.sq-fine {
  border-color: #cdebd8;
}
.sq-rare {
  border-color: #cbe4f8;
}
.sq-epic {
  border-color: #e2cef7;
}
.sq-legendary {
  border-color: #ffdcae;
}
.sq-mythic {
  border-color: #ffcdd2;
}
.sq-divine {
  border-color: #f3e0a0;
}

.slot-label {
  font-size: 9px;
  color: var(--text-dim);
}

.slot-name {
  font-size: 12px;
  font-weight: 600;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.slot-name.dim {
  color: var(--text-dim);
  font-weight: 400;
}

.slot-enh {
  position: absolute;
  top: 6px;
  right: 8px;
  font-size: 10px;
  font-weight: 700;
  color: var(--q-legendary);
}

/* ── 属性 ── */
.stats {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 1px;
  padding: 8px;
}

.stat {
  display: flex;
  justify-content: space-between;
  padding: 6px 8px;
  font-size: 12px;
  border-radius: 6px;
}

.stat:nth-child(4n + 1),
.stat:nth-child(4n + 2) {
  background: var(--panel-2);
}

.s-label {
  color: var(--text-mid);
}

.s-value {
  font-weight: 600;
}

/* ── 占位 ── */
.soon-list {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  padding: 10px;
}

.chip {
  padding: 4px 10px;
  font-size: 10px;
  color: var(--text-dim);
  background: var(--panel-3);
  border-radius: 999px;
}
</style>
