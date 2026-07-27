<script setup lang="ts">
import { computed } from 'vue';
import { X } from '@lucide/vue';
import { abbr, signed } from '@/core/format';
import type { EquipmentInstance, Stats } from '@/core/types';
import { useInventoryStore } from '@/stores/inventory';
import { usePlayerStore } from '@/stores/player';
import { requireEquipment } from '@/data/equipment';
import { AFFIX_LABELS, QUALITY_LABELS, SLOT_LABELS, STAT_LABELS } from '@/data/constants';
import EquipmentIcon from '@/components/EquipmentIcon.vue';

const props = defineProps<{ inst: EquipmentInstance; from: 'bag' | 'equipped' }>();
const emit = defineEmits<{ close: [] }>();

const inventory = useInventoryStore();
const player = usePlayerStore();
const def = computed(() => requireEquipment(props.inst.defId));

const breakdown = computed(() => inventory.statBreakdown(props.inst));
const cp = computed(() => inventory.contributionCp(props.inst));
const classMatched = computed(
  () => !def.value.classId || def.value.classId === player.player?.classId,
);
const canEquip = computed(
  () => (player.player?.level ?? 0) >= def.value.level && classMatched.value,
);

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

/** 基础区只展示隐藏浮动与强化后的基础属性，不重复包含词条。 */
const shownBaseStats = computed(() =>
  (Object.keys(breakdown.value.base) as (keyof Stats)[])
    .filter((key) => Math.abs(breakdown.value.base[key]) > 0.001)
    .map((key) => ({ key, label: STAT_LABELS[key], value: breakdown.value.base[key] })),
);

/** 换装比较使用角色最终属性，包含职业系数、暴击上限和其余七个槽位。 */
const shownStatDeltas = computed(() => {
  if (props.from !== 'bag') return [];
  const delta = inventory.statDelta(props.inst);
  return (Object.keys(delta) as (keyof Stats)[])
    .filter((key) => Math.abs(delta[key]) > 0.001)
    .map((key) => ({ key, label: STAT_LABELS[key], value: delta[key] }));
});

function fmtStat(key: keyof Stats, v: number): string {
  if (key === 'critRate' || key === 'critDmg') return `+${v.toFixed(1)}%`;
  if (key === 'spd') return `+${v.toFixed(2)}`;
  return `+${abbr(Math.round(v))}`;
}

function fmtDelta(key: keyof Stats, value: number): string {
  const prefix = value > 0 ? '+' : '';
  if (key === 'critRate' || key === 'critDmg') return `${prefix}${value.toFixed(1)}%`;
  if (key === 'spd') return `${prefix}${value.toFixed(2)}`;
  return signed(Math.round(value));
}

function fmtAffix(key: string, value: number): string {
  if (key === 'critRate' || key === 'critDmg') return `+${value.toFixed(1)}%`;
  if (key === 'spd') return `+${value.toFixed(2)}`;
  return `+${abbr(Math.round(value))}`;
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
        <EquipmentIcon :def="def" :enhance="inst.enhance" size="lg" :locked="inst.locked" />
        <div class="title">
          <span class="name" :class="'q-' + def.quality">
            {{ def.name }}
            <span v-if="inst.enhance > 0" class="enh">+{{ inst.enhance }}</span>
          </span>
          <span class="sub">
            {{ SLOT_LABELS[def.slot] }} · {{ QUALITY_LABELS[def.quality] }} · 需求 Lv{{ def.level }}
          </span>
        </div>
        <button class="x" aria-label="关闭装备详情" @click="emit('close')">
          <X :size="17" :stroke-width="2.2" aria-hidden="true" />
        </button>
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
          <div class="group-head">
            <span>基础属性</span>
            <small>已包含当前强化</small>
          </div>
          <div v-for="stat in shownBaseStats" :key="stat.key" class="stat">
            <span>{{ stat.label }}</span>
            <span class="num">{{ fmtStat(stat.key, stat.value) }}</span>
          </div>
        </section>

        <section v-if="def.fixedAffixes?.length" class="group">
          <div class="group-head">
            <span>固定词条</span>
            <small>不会被强化或洗练改变</small>
          </div>
          <div v-for="(affix, index) in def.fixedAffixes" :key="index" class="stat fixed-affix">
            <span>{{ AFFIX_LABELS[affix.key] }}</span>
            <span class="num">{{ fmtAffix(affix.key, affix.value) }}</span>
          </div>
        </section>

        <section v-if="inst.affixes.length > 0" class="group">
          <div class="group-head">
            <span>随机词条</span>
            <small>未来洗练只改变这里</small>
          </div>
          <div v-for="(affix, index) in inst.affixes" :key="index" class="stat affix">
            <span>{{ AFFIX_LABELS[affix.key] }}</span>
            <span class="num">{{ fmtAffix(affix.key, affix.value) }}</span>
          </div>
        </section>

        <section v-if="compare" class="group compare-group">
          <div class="group-head">
            <span>换装后的角色总属性变化</span>
            <small>固定词条与随机词条已计入一次</small>
          </div>
          <div v-if="shownStatDeltas.length === 0" class="no-delta">角色总属性没有变化</div>
          <div
            v-for="stat in shownStatDeltas"
            :key="stat.key"
            class="stat stat-delta"
            :class="stat.value > 0 ? 'up' : 'down'"
          >
            <span>{{ stat.label }}</span>
            <span class="num">{{ fmtDelta(stat.key, stat.value) }}</span>
          </div>
        </section>

        <section v-if="def.uniqueEffect" class="unique-effect">
          <strong>专属视觉</strong>
          <span>{{ def.uniqueEffect }}</span>
          <small>当前为真实外观与演出换肤；战斗机制效果将在技能系统接通后单独标明。</small>
        </section>
      </div>

      <footer class="foot">
        <template v-if="from === 'bag'">
          <button class="btn btn-plain f" @click="inventory.toggleLock(inst.uid)">
            {{ inst.locked ? '解锁' : '锁定' }}
          </button>
          <button class="btn btn-plain f" :disabled="inst.locked" @click="doDecompose">分解</button>
          <button class="btn btn-pink f2" :disabled="!canEquip" @click="doEquip">
            {{ canEquip ? '穿戴' : classMatched ? `Lv${def.level} 可穿戴` : '职业不适用' }}
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
  position: relative;
  width: 100%;
  max-height: 78dvh;
  display: flex;
  flex-direction: column;
  background: var(--panel);
  border-radius: var(--r-lg);
  box-shadow: var(--shadow-lg);
  overflow: hidden;
}

/* 面板顶部品牌渐变条 */
.sheet::before {
  content: '';
  position: absolute;
  z-index: 1;
  top: 0;
  left: 0;
  right: 0;
  height: 4px;
  background: linear-gradient(90deg, var(--pink), var(--gold), var(--blue));
}

.head {
  display: flex;
  align-items: center;
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
  flex: 1;
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
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 8px;
  margin-bottom: 2px;
  font-size: 10px;
  color: var(--text-dim);
}

.group-head small {
  min-width: 0;
  font-size: 8px;
  text-align: right;
  color: var(--text-dim);
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

.stat.fixed-affix {
  color: #9a5c20;
  background: linear-gradient(90deg, #fff8e5, #fff1f7);
}

.compare-group {
  padding-top: 2px;
}

.stat-delta.up {
  color: #2f8a5b;
  background: #eafaf1;
}

.stat-delta.down {
  color: #a33b43;
  background: #ffeef0;
}

.no-delta {
  padding: 8px 10px;
  font-size: 11px;
  text-align: center;
  color: var(--text-dim);
  background: var(--panel-2);
  border-radius: 8px;
}

.unique-effect {
  display: flex;
  flex-direction: column;
  gap: 5px;
  padding: 10px 12px;
  color: #7f3659;
  background: linear-gradient(135deg, #fff0f6, #fff8df);
  border: 1px solid #f5d5bb;
  border-radius: 10px;
}

.unique-effect strong {
  font-size: 11px;
}

.unique-effect span {
  font-size: 11px;
  line-height: 1.55;
}

.unique-effect small {
  font-size: 8px;
  line-height: 1.45;
  color: var(--text-dim);
}

.foot {
  display: flex;
  gap: 6px;
  padding: 12px 16px calc(12px + var(--sab));
  border-top: 1px solid var(--line);
}

.foot .btn {
  min-height: 44px;
}

.f {
  flex: 1;
  font-size: 12px;
}

.f2 {
  flex: 2;
}
</style>
