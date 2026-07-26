<script setup lang="ts">
import { computed, ref } from 'vue';
import { abbr } from '@/core/format';
import type { EquipmentInstance, EquipSlot, Stats } from '@/core/types';
import { useInventoryStore } from '@/stores/inventory';
import { usePlayerStore } from '@/stores/player';
import { requireEquipment } from '@/data/equipment';
import { CLASS_INFO, SLOT_LABELS, SLOT_ORDER, STAT_LABELS } from '@/data/constants';
import { visualSkillsFor } from '@/data/skills';
import EquipDetail from '@/components/EquipDetail.vue';
import ClassArtwork from '@/components/ClassArtwork.vue';
import SkillIcon from '@/components/SkillIcon.vue';
import EquipmentIcon from '@/components/EquipmentIcon.vue';
import SystemArtwork from '@/components/SystemArtwork.vue';

const inventory = useInventoryStore();
const player = usePlayerStore();
const detail = ref<EquipmentInstance | null>(null);

const equipped = computed(() => inventory.equipped);
const visualSkills = computed(() => (player.player ? visualSkillsFor(player.player.classId) : []));

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
      <div class="hero-face">
        <ClassArtwork :class-id="player.player.classId" variant="avatar" />
      </div>
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

    <section v-if="visualSkills.length > 0" class="card skills-card">
      <div class="card-head">
        <span>{{ CLASS_INFO[player.player.classId].name }}技能演出</span>
        <span class="skill-hint">随等级解锁</span>
      </div>
      <div class="skills">
        <div
          v-for="skill in visualSkills"
          :key="skill.id"
          class="skill-row"
          :class="{ locked: player.player.level < skill.unlockLevel }"
        >
          <SkillIcon :skill="skill" :locked="player.player.level < skill.unlockLevel" />
          <span class="skill-copy">
            <span class="skill-name">{{ skill.name }}</span>
            <span class="skill-desc">{{ skill.desc }}</span>
          </span>
          <span class="skill-level">
            {{ player.player.level >= skill.unlockLevel ? '已解锁' : `Lv${skill.unlockLevel}` }}
          </span>
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
          <EquipmentIcon
            v-if="slotOf(slot)"
            :def="requireEquipment(slotOf(slot)!.defId)"
            size="sm"
          />
          <span v-else class="empty-slot" aria-hidden="true">{{
            SLOT_LABELS[slot].slice(0, 1)
          }}</span>
          <span class="slot-copy">
            <span class="slot-label">{{ SLOT_LABELS[slot] }}</span>
            <span class="slot-name" :class="slotOf(slot) ? 'q-' + qualityOf(slot) : 'dim'">
              {{ slotOf(slot) ? nameOf(slot) : '尚未装备' }}
            </span>
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

    <!-- 强化系统视觉预告：M3-2 接入真实强化交互时沿用 -->
    <section class="card forge-preview">
      <div class="forge-copy">
        <span class="forge-tag">M3-2 · 即将开放</span>
        <strong>樱光强化台</strong>
        <span>消耗强化石提升装备属性，成功、掉级与碎裂都会有独立演出。</span>
        <div class="forge-feedback" aria-label="计划中的强化反馈">
          <span class="success">成功 · 樱光绽放</span>
          <span class="failed">失败 · 星屑消散</span>
        </div>
      </div>
      <div class="forge-art-wrap">
        <SystemArtwork kind="enhance" class="forge-art" />
        <i class="spark s1" />
        <i class="spark s2" />
        <i class="spark s3" />
      </div>
    </section>

    <section class="card soon">
      <div class="card-head"><span>后续养成</span></div>
      <div class="soon-list">
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
  overflow: hidden;
  background: #fff;
  border: 2px solid var(--pink);
  border-radius: 50%;
}

.skill-hint {
  font-size: 9px;
  color: var(--blue-deep);
}

.skills {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 9px;
}

.skill-row {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 7px;
  background: linear-gradient(100deg, #fff8fb, #f5f8ff);
  border: 1px solid var(--line);
  border-radius: var(--r-sm);
}

.skill-row.locked {
  background: var(--panel-2);
}

.skill-copy {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.skill-name {
  font-size: 12px;
  font-weight: 700;
}

.skill-desc {
  overflow: hidden;
  color: var(--text-dim);
  font-size: 9px;
  line-height: 1.4;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.skill-level {
  flex-shrink: 0;
  padding: 2px 6px;
  font-size: 9px;
  font-weight: 700;
  color: var(--pink-deep);
  background: var(--pink-soft);
  border-radius: 999px;
}

.locked .skill-level {
  color: var(--text-dim);
  background: var(--panel-3);
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
  align-items: center;
  gap: 7px;
  min-height: 54px;
  padding: 7px;
  background: var(--panel-2);
  border: 1px solid var(--line);
  border-radius: var(--r-sm);
  text-align: left;
}

.empty-slot {
  width: 34px;
  height: 34px;
  flex-shrink: 0;
  display: grid;
  place-items: center;
  font-size: 13px;
  color: var(--text-dim);
  background: var(--panel-3);
  border: 1px dashed var(--line-strong);
  border-radius: 11px;
}

.slot-copy {
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
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

/* ── 强化预告与后续系统 ── */
.forge-preview {
  position: relative;
  min-height: 142px;
  display: flex;
  align-items: stretch;
  overflow: hidden;
  background:
    radial-gradient(circle at 78% 48%, rgb(126 214 241 / 25%), transparent 31%),
    linear-gradient(115deg, #fff7fb 4%, #f1f8ff 96%);
}

.forge-copy {
  position: relative;
  z-index: 2;
  width: 62%;
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 5px;
  padding: 14px 0 14px 14px;
}

.forge-tag {
  padding: 2px 7px;
  font-size: 9px;
  font-weight: 700;
  color: var(--pink-deep);
  background: rgb(255 255 255 / 82%);
  border-radius: 999px;
}

.forge-copy strong {
  font-size: 15px;
}

.forge-copy > span:not(.forge-tag) {
  font-size: 9px;
  line-height: 1.55;
  color: var(--text-mid);
}

.forge-feedback {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  margin-top: 2px;
}

.forge-feedback span {
  padding: 2px 6px;
  font-size: 8px;
  border-radius: 999px;
}

.forge-feedback .success {
  color: #238763;
  background: #e5f9f0;
}

.forge-feedback .failed {
  color: #a45e78;
  background: #fff0f5;
}

.forge-art-wrap {
  position: absolute;
  right: -14px;
  bottom: -14px;
  width: 162px;
  height: 162px;
}

.forge-art {
  width: 100%;
  height: 100%;
  animation: forge-breathe 2.8s ease-in-out infinite;
}

.spark {
  position: absolute;
  width: 5px;
  height: 5px;
  background: #fff;
  border: 1px solid #83daf2;
  transform: rotate(45deg);
  box-shadow: 0 0 7px #77dff8;
  animation: spark-pop 1.6s ease-in-out infinite;
}

.s1 {
  top: 38px;
  right: 29px;
}

.s2 {
  top: 62px;
  left: 34px;
  animation-delay: -0.55s;
}

.s3 {
  top: 23px;
  left: 73px;
  animation-delay: -1.1s;
}

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

@keyframes forge-breathe {
  0%,
  100% {
    transform: translateY(0) scale(1);
  }
  50% {
    transform: translateY(-3px) scale(1.015);
  }
}

@keyframes spark-pop {
  0%,
  100% {
    opacity: 0.25;
    transform: rotate(45deg) scale(0.65);
  }
  50% {
    opacity: 1;
    transform: rotate(45deg) scale(1.2);
  }
}

@media (prefers-reduced-motion: reduce) {
  .forge-art,
  .spark {
    animation: none;
  }
}
</style>
