<script setup lang="ts">
import { computed, ref } from 'vue';
import { ArrowUpRight, Sparkles, X } from '@lucide/vue';
import { abbr, signed } from '@/core/format';
import { zeroStats } from '@/core/formula';
import {
  baseRollGrade,
  enhanceMultiplier,
  forgeStageAt,
  instanceStatsForClass,
} from '@/core/equipment';
import type { EquipmentInstance, Stats } from '@/core/types';
import { useInventoryStore } from '@/stores/inventory';
import { usePlayerStore } from '@/stores/player';
import { requireEquipment } from '@/data/equipment';
import { AFFIX_LABELS, QUALITY_LABELS, SLOT_LABELS, STAT_LABELS } from '@/data/constants';
import { REFORGE_RESONANCE_MAX } from '@/data/reforgeRules';
import { WEAPON_ELEMENT_LABELS } from '@/data/weaponElements';
import {
  affixDisplayName,
  affixProfession,
  affixProfessionLabel,
  affixRuntimeNotice,
  affixTierLabel,
  formatAffixValue,
} from '@/ui/affixPresentation';
import EquipmentIcon from '@/components/EquipmentIcon.vue';
import EquipmentAdvancementPanel from '@/components/EquipmentAdvancementPanel.vue';
import ReforgePanel from '@/components/ReforgePanel.vue';

const props = defineProps<{ inst: EquipmentInstance; from: 'bag' | 'equipped' }>();
const emit = defineEmits<{ close: [] }>();

const inventory = useInventoryStore();
const player = usePlayerStore();
const showReforge = ref(false);
const showAdvancement = ref(false);
const def = computed(() => requireEquipment(props.inst.defId));
const advancementOption = computed(() => inventory.equipmentAdvancementOption(props.inst.uid));

const stats = computed<Stats>(() =>
  def.value && player.player
    ? instanceStatsForClass(def.value, props.inst, player.player.classId)
    : zeroStats(),
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
const canReforge = computed(
  () => props.inst.affixes.length > 0 && def.value.fixedTemplate !== true,
);
const weaponElementLabel = computed(() =>
  def.value.slot === 'weapon' ? WEAPON_ELEMENT_LABELS[def.value.element] : null,
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

function affixInactiveForCurrentClass(key: EquipmentInstance['affixes'][number]['key']): boolean {
  const owner = affixProfession(key);
  return owner !== null && owner !== player.player?.classId;
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
  const result = inventory.decompose([props.inst.uid]);
  if (result.reason === 'pending-affix-result') return;
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
          <span v-if="weaponElementLabel" class="weapon-element">{{ weaponElementLabel }}</span>
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
          <div class="group-head affix-head">
            <span>随机词条</span>
            <span
              class="resonance-chip"
              :class="{ full: inst.reforgeResonance >= REFORGE_RESONANCE_MAX }"
            >
              共鸣 {{ inst.reforgeResonance }}/{{ REFORGE_RESONANCE_MAX }}
            </span>
          </div>
          <div v-for="(a, i) in inst.affixes" :key="`${i}-${a.key}`" class="stat affix-detail">
            <span class="affix-tier" :class="`tier-${a.tier}`">{{ affixTierLabel(a.tier) }}</span>
            <span class="affix-copy">
              <b>{{ affixDisplayName(a) }}</b>
              <small v-if="affixProfessionLabel(a.key)">
                {{ affixProfessionLabel(a.key) }}
              </small>
              <small v-if="affixInactiveForCurrentClass(a.key)" class="inactive-notice">
                当前职业不生效
              </small>
              <small v-if="affixRuntimeNotice(a.key)" class="runtime-notice">
                {{ affixRuntimeNotice(a.key) }}
              </small>
            </span>
            <span class="num">{{ formatAffixValue(a) }}</span>
          </div>
          <p v-if="inst.reforgeResonance >= REFORGE_RESONANCE_MAX" class="resonance-ready">
            共鸣已满：下一次随机洗练必出卓越或极品。
          </p>
        </section>

        <section v-if="def.fixedAffixes?.length" class="group">
          <div class="group-head fixed-head">
            <span>珍品固定词条</span>
            <span v-if="def.fixedTemplate" class="fixed-chip">完整固定 · 不可洗练</span>
          </div>
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
        <button
          v-if="advancementOption"
          class="btn advancement-entry"
          @click="showAdvancement = true"
        >
          <ArrowUpRight :size="16" aria-hidden="true" />
          跨区升阶
        </button>
        <button v-if="canReforge" class="btn reforge-entry" @click="showReforge = true">
          <Sparkles :size="16" aria-hidden="true" />
          {{ inst.pendingAffixChange ? '查看洗练候选' : '词条洗练' }}
        </button>
        <template v-if="from === 'bag'">
          <button
            class="btn btn-plain f"
            :disabled="Boolean(inst.pendingAffixChange)"
            @click="inventory.toggleLock(inst.uid)"
          >
            {{ inst.pendingAffixChange ? '候选保护中' : inst.locked ? '解锁' : '锁定' }}
          </button>
          <button
            class="btn btn-plain f"
            :disabled="inst.locked || Boolean(inst.pendingAffixChange)"
            :title="inst.pendingAffixChange ? '请先采用或保留洗练候选' : undefined"
            @click="doDecompose"
          >
            {{ inst.pendingAffixChange ? '先确认洗练' : '分解' }}
          </button>
          <button class="btn btn-pink f2" :disabled="!canEquip" @click="doEquip">
            {{ canEquip ? '穿戴' : classMatched ? `Lv${def.level} 可穿戴` : '职业不适用' }}
          </button>
        </template>
        <template v-else>
          <button class="btn btn-plain f2" @click="doUnequip">卸下</button>
        </template>
      </footer>

      <ReforgePanel v-if="showReforge" :inst="inst" @close="showReforge = false" />
      <EquipmentAdvancementPanel
        v-if="showAdvancement"
        :inst="inst"
        @close="showAdvancement = false"
      />
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

/* 和离线收益弹窗共用一条品牌渐变顶边。 */
.sheet::before {
  position: absolute;
  z-index: 1;
  top: 0;
  right: 0;
  left: 0;
  height: 4px;
  content: '';
  background: linear-gradient(90deg, var(--pink), var(--gold), var(--blue));
  pointer-events: none;
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
.hq-prismatic {
  background:
    radial-gradient(circle at 12% 0%, rgb(255 175 220 / 22%), transparent 44%),
    linear-gradient(135deg, #fffaff, #f1f8ff 55%, #fff5fb);
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

.weapon-element {
  align-self: flex-start;
  padding: 2px 7px;
  color: #9a5b25;
  font-size: 9px;
  font-weight: 700;
  background: rgb(255 246 218 / 82%);
  border: 1px solid rgb(226 186 108 / 58%);
  border-radius: 999px;
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

.affix-head,
.fixed-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.resonance-chip,
.fixed-chip {
  padding: 3px 7px;
  color: #4d7590;
  font-size: 8px;
  font-weight: 800;
  background: #edf7fd;
  border: 1px solid #cce3f0;
  border-radius: 999px;
}

.resonance-chip.full {
  color: #9a5b25;
  background: linear-gradient(100deg, #fff7d9, #fff0f7);
  border-color: #efcd93;
}

.fixed-chip {
  color: #9a5c20;
  background: #fff6df;
  border-color: #efd6a8;
}

.stat.affix-detail {
  display: grid;
  grid-template-columns: 64px minmax(0, 1fr) auto;
  gap: 8px;
  align-items: center;
  min-height: 44px;
  color: #655084;
  background: #f8f2fe;
}

.affix-tier {
  padding: 4px 5px;
  font-size: 8px;
  font-weight: 800;
  text-align: center;
  background: rgb(255 255 255 / 66%);
  border-radius: 6px;
}

.affix-copy {
  min-width: 0;
  display: flex;
  flex-direction: column;
}

.affix-copy b {
  overflow: hidden;
  font-size: 11px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.affix-copy small {
  color: #8b5caa;
  font-size: 8px;
  font-weight: 700;
}

.affix-copy small.runtime-notice {
  color: #ad673d;
}

.resonance-ready {
  margin: 2px 0 0;
  padding: 6px 9px;
  color: #95632e;
  font-size: 8px;
  line-height: 1.45;
  background: linear-gradient(90deg, #fff8df, #fff2f7);
  border-radius: 7px;
}

.tier-1 {
  color: #7c828b;
}

.tier-2 {
  color: #526276;
}

.tier-3 {
  color: #3b9967;
}

.tier-4 {
  color: #397db5;
}

.tier-5 {
  color: #b37722;
  text-shadow: 0 0 8px rgb(244 185 66 / 35%);
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
  flex-wrap: wrap;
  gap: 6px;
  padding: 12px 16px calc(12px + var(--sab));
  border-top: 1px solid var(--line);
}

.foot button {
  min-height: 44px;
}

.reforge-entry {
  min-width: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  color: #86506f;
  font-size: 12px;
  font-weight: 800;
  background: linear-gradient(100deg, rgb(228 245 255 / 92%), rgb(255 230 244 / 92%)), #fff;
  border: 1px solid #eab9d1;
  box-shadow: inset 0 0 0 1px rgb(255 255 255 / 75%);
}

.advancement-entry {
  min-width: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  color: #80551f;
  font-size: 12px;
  font-weight: 800;
  background:
    linear-gradient(100deg, rgb(255 245 216 / 94%), rgb(232 247 255 / 94%)),
    #fff;
  border: 1px solid #ecd09b;
  box-shadow: inset 0 0 0 1px rgb(255 255 255 / 76%);
}

.f {
  flex: 1;
  font-size: 12px;
}

.f2 {
  flex: 2;
}
</style>
