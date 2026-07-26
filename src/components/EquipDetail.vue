<script setup lang="ts">
import { computed } from 'vue';
import { abbr, signed } from '@/core/format';
import { zeroStats } from '@/core/formula';
import { instanceStats } from '@/core/equipment';
import type { EquipmentInstance, Stats } from '@/core/types';
import { useInventoryStore } from '@/stores/inventory';
import { usePlayerStore } from '@/stores/player';
import { requireEquipment } from '@/data/equipment';
import { AFFIX_LABELS, QUALITY_LABELS, SLOT_LABELS, STAT_LABELS } from '@/data/constants';

const props = defineProps<{ inst: EquipmentInstance; from: 'bag' | 'equipped' }>();
const emit = defineEmits<{ close: [] }>();

const inventory = useInventoryStore();
const player = usePlayerStore();
const def = computed(() => requireEquipment(props.inst.defId));

const stats = computed<Stats>(() =>
  def.value ? instanceStats(def.value, props.inst) : zeroStats(),
);

const cp = computed(() => inventory.contributionCp(props.inst));
const canEquip = computed(() => (player.player?.level ?? 0) >= def.value.level);

/** 与当前已穿戴的同部位装备对比 */
const compare = computed(() => {
  if (props.from !== 'bag' || !def.value || !inventory.equipped) return null;
  const worn = inventory.equipped[def.value.slot];
  if (!worn) return { delta: cp.value, wornName: '（空）' };
  const wornDef = requireEquipment(worn.defId);
  return {
    delta: inventory.cpDelta(props.inst),
    wornName: wornDef.name,
  };
});

/** 只显示非零的属性 */
const shownStats = computed(() =>
  (Object.keys(stats.value) as (keyof Stats)[])
    .filter((k) => Math.abs(stats.value[k]) > 0.001 && !(k === 'spd' && stats.value[k] === 0))
    .map((k) => ({ key: k, label: STAT_LABELS[k], value: stats.value[k] })),
);

function fmtStat(key: keyof Stats, v: number): string {
  if (key === 'critRate' || key === 'critDmg') return `+${v.toFixed(1)}%`;
  if (key === 'spd') return `+${v.toFixed(2)}`;
  return `+${abbr(Math.round(v))}`;
}

function doEquip() {
  inventory.equip(props.inst.uid);
  emit('close');
}

function doUnequip() {
  if (def.value) inventory.unequip(def.value.slot);
  emit('close');
}

function doDecompose() {
  inventory.decompose([props.inst.uid]);
  emit('close');
}
</script>

<template>
  <div class="overlay" @click.self="emit('close')">
    <div v-if="def" class="sheet">
      <header class="head" :class="'hq-' + def.quality">
        <div class="title">
          <span class="name" :class="'q-' + def.quality">
            {{ def.name }}
            <span v-if="inst.enhance > 0" class="enh">+{{ inst.enhance }}</span>
          </span>
          <span class="sub">
            {{ SLOT_LABELS[def.slot] }} · {{ QUALITY_LABELS[def.quality] }} · 需求 Lv{{ def.level }}
          </span>
        </div>
        <button class="x" @click="emit('close')">✕</button>
      </header>

      <div class="body scroll-y">
        <div class="cp-row">
          <span>战力</span>
          <span class="cp num">{{ abbr(cp) }}</span>
        </div>

        <div v-if="compare" class="cmp" :class="compare.delta >= 0 ? 'up' : 'down'">
          <span>对比已穿戴「{{ compare.wornName }}」</span>
          <span class="num">{{ signed(compare.delta) }}</span>
        </div>

        <section class="group">
          <div class="group-head">属性</div>
          <div v-for="s in shownStats" :key="s.key" class="stat">
            <span>{{ s.label }}</span>
            <span class="num">{{ fmtStat(s.key, s.value) }}</span>
          </div>
        </section>

        <section v-if="inst.affixes.length > 0" class="group">
          <div class="group-head">随机词条</div>
          <div v-for="(a, i) in inst.affixes" :key="i" class="stat affix">
            <span>{{ AFFIX_LABELS[a.key] }}</span>
            <span class="num">+{{ a.value }}</span>
          </div>
        </section>
      </div>

      <footer class="foot">
        <template v-if="from === 'bag'">
          <button class="btn btn-plain f" @click="inventory.toggleLock(inst.uid)">
            {{ inst.locked ? '解锁' : '锁定' }}
          </button>
          <button class="btn btn-plain f" :disabled="inst.locked" @click="doDecompose">分解</button>
          <button class="btn btn-pink f2" :disabled="!canEquip" @click="doEquip">
            {{ canEquip ? '穿戴' : `Lv${def.level} 可穿戴` }}
          </button>
        </template>
        <template v-else>
          <button class="btn btn-plain f2" @click="doUnequip">卸下</button>
        </template>
      </footer>
    </div>
  </div>
</template>

<style scoped>
.sheet {
  width: 100%;
  max-height: 78dvh;
  display: flex;
  flex-direction: column;
  background: var(--panel);
  border-radius: var(--r-lg);
  box-shadow: var(--shadow-lg);
  overflow: hidden;
}

.head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 10px;
  padding: 14px 16px;
}

.hq-common {
  background: #f4f7fa;
}
.hq-fine {
  background: #ecf9f1;
}
.hq-rare {
  background: #e9f3fd;
}
.hq-epic {
  background: #f5eefd;
}
.hq-legendary {
  background: #fff4e6;
}
.hq-mythic {
  background: #ffecee;
}
.hq-divine {
  background: #fdf7e2;
}

.title {
  display: flex;
  flex-direction: column;
  gap: 3px;
  min-width: 0;
}

.name {
  font-size: 16px;
  font-weight: 700;
}

.enh {
  color: var(--q-legendary);
}

.sub {
  font-size: 11px;
  color: var(--text-mid);
}

.x {
  font-size: 15px;
  color: var(--text-dim);
  flex-shrink: 0;
}

.body {
  flex: 1;
  min-height: 0;
  padding: 12px 16px;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.cp-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 12px;
  background: var(--blue-soft);
  border-radius: var(--r-sm);
  font-size: 12px;
}

.cp {
  font-size: 17px;
  font-weight: 800;
  color: var(--blue-deep);
}

.cmp {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 12px;
  font-size: 11px;
  font-weight: 600;
  border-radius: var(--r-sm);
}

.cmp.up {
  color: #2f8a5b;
  background: #eafaf1;
}

.cmp.down {
  color: #a33b43;
  background: #ffeef0;
}

.group {
  display: flex;
  flex-direction: column;
  gap: 3px;
}

.group-head {
  font-size: 10px;
  color: var(--text-dim);
  margin-bottom: 2px;
}

.stat {
  display: flex;
  justify-content: space-between;
  padding: 6px 10px;
  font-size: 12px;
  background: var(--panel-2);
  border-radius: 8px;
}

.stat.affix {
  color: var(--q-epic);
  background: #f8f2fe;
}

.foot {
  display: flex;
  gap: 6px;
  padding: 12px 16px calc(12px + var(--sab));
  border-top: 1px solid var(--line);
}

.f {
  flex: 1;
  font-size: 12px;
}

.f2 {
  flex: 2;
}
</style>
