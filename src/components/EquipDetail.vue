<script setup lang="ts">
import { computed } from 'vue';
import { X } from '@lucide/vue';
import { abbr, signed } from '@/core/format';
import { zeroStats } from '@/core/formula';
import { baseRollGrade, enhanceMultiplier, forgeStageAt, instanceStats } from '@/core/equipment';
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

const stats = computed<Stats>(() =>
  def.value ? instanceStats(def.value, props.inst) : zeroStats(),
);

const cp = computed(() => inventory.contributionCp(props.inst));
const baseGrade = computed(() => baseRollGrade(props.inst.baseRollPermille));
const forgeStage = computed(() => forgeStageAt(props.inst.enhance));
const enhanceBonus = computed(
  () => (enhanceMultiplier(props.inst.enhance, props.inst.enhanceGainPermille) - 1) * 100,
);
const baseGradeLabel = computed(
  () =>
    ({
      steady: '稳固胚',
      refined: '精工胚',
      miracle: '奇迹胚',
    })[baseGrade.value],
);
const forgeStageLabel = computed(
  () =>
    ({
      original: '原初',
      gleam: '微光',
      radiant: '辉光',
      starforged: '星铸',
      sakura: '樱华',
    })[forgeStage.value],
);
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

        <section class="growth-rolls">
          <span :class="`base-${baseGrade}`">
            <small>随机胚子</small>
            <b>{{ baseGradeLabel }} · +{{ ((inst.baseRollPermille - 1000) / 10).toFixed(1) }}%</b>
          </span>
          <span :class="`forge-${forgeStage}`">
            <small>锻造阶段</small>
            <b>{{ forgeStageLabel }} · 强化成长 +{{ enhanceBonus.toFixed(1) }}%</b>
          </span>
          <p>每级首次强化成功时固定成长；掉级后重新升回不会重掷，惊喜数值会永久保留。</p>
        </section>

        <section class="group">
          <div class="group-head">最终属性（已含胚子、强化与词条）</div>
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

        <section v-if="def.fixedAffixes?.length" class="group">
          <div class="group-head">珍品固定词条</div>
          <div v-for="(a, i) in def.fixedAffixes" :key="i" class="stat fixed-affix">
            <span>{{ AFFIX_LABELS[a.key] }}</span>
            <span class="num">{{ fmtAffix(a.key, a.value) }}</span>
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

.growth-rolls {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 6px;
}

.growth-rolls > span {
  display: flex;
  min-width: 0;
  flex-direction: column;
  gap: 2px;
  padding: 8px 9px;
  color: #416c83;
  background: #eef8fc;
  border: 1px solid #c6e2ee;
  border-radius: 9px;
}

.growth-rolls small {
  font-size: 8px;
  opacity: 0.75;
}

.growth-rolls b {
  overflow: hidden;
  font-size: 9px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.growth-rolls .base-refined,
.growth-rolls .forge-radiant {
  color: #6552a0;
  background: #f4f0ff;
  border-color: #d8caf4;
}

.growth-rolls .base-miracle,
.growth-rolls .forge-starforged,
.growth-rolls .forge-sakura {
  color: #9b5c36;
  background: linear-gradient(120deg, #fff8df, #fff0f6);
  border-color: #f0d0a9;
}

.growth-rolls p {
  grid-column: 1 / -1;
  margin: 0;
  padding: 0 2px;
  color: var(--text-dim);
  font-size: 8px;
  line-height: 1.45;
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

.stat.fixed-affix {
  color: #9a5c20;
  background: linear-gradient(90deg, #fff8e5, #fff1f7);
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

.f {
  flex: 1;
  font-size: 12px;
}

.f2 {
  flex: 2;
}
</style>
