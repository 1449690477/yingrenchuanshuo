<script setup lang="ts">
import { computed, onUnmounted, ref } from 'vue';
import { abbr } from '@/core/format';
import type { EquipmentInstance, EquipSlot, Stats } from '@/core/types';
import { useInventoryStore } from '@/stores/inventory';
import { usePlayerStore } from '@/stores/player';
import { CLASS_INFO, SLOT_LABELS, STAT_LABELS } from '@/data/constants';
import { visualSkillsFor } from '@/data/skills';
import EquipDetail from '@/components/EquipDetail.vue';
import CharacterShowcase from '@/components/CharacterShowcase.vue';
import EnhancePanel from '@/components/EnhancePanel.vue';
import SkillIcon from '@/components/SkillIcon.vue';

const inventory = useInventoryStore();
const player = usePlayerStore();
const detail = ref<EquipmentInstance | null>(null);
const feedback = ref('');
let feedbackTimer = 0;

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

function announce(message: string): void {
  feedback.value = message;
  clearTimeout(feedbackTimer);
  feedbackTimer = window.setTimeout(() => (feedback.value = ''), 2_200);
}

function open(slot: EquipSlot): void {
  const instance = equipped.value?.[slot] ?? null;
  if (instance) {
    detail.value = instance;
    return;
  }
  announce(`${SLOT_LABELS[slot]}槽还是空的，可在背包中选择该部位装备。`);
}

function equipBest(): void {
  const count = inventory.equipBest();
  announce(count > 0 ? `已替换 ${count} 件更强装备，角色外观同步更新。` : '当前已是最优装备。');
}

onUnmounted(() => clearTimeout(feedbackTimer));
</script>

<template>
  <div v-if="player.player" class="growth">
    <CharacterShowcase
      :name="player.player.name"
      :class-id="player.player.classId"
      :level="player.player.level"
      :cp="player.cp"
      :equipped="equipped"
      @select-slot="open"
      @equip-best="equipBest"
    />

    <Transition name="feedback">
      <div v-if="feedback" class="growth-feedback" role="status" aria-live="polite">
        {{ feedback }}
      </div>
    </Transition>

    <EnhancePanel />

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
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding-bottom: 4px;
}

.growth-feedback {
  position: sticky;
  z-index: 20;
  top: 6px;
  align-self: center;
  max-width: calc(100% - 22px);
  margin: -4px 0 -2px;
  padding: 7px 12px;
  font-size: 10px;
  color: #fff;
  text-align: center;
  background: rgb(51 68 91 / 92%);
  border: 1px solid rgb(255 255 255 / 34%);
  border-radius: 999px;
  box-shadow: 0 5px 12px rgb(46 52 70 / 20%);
}

.feedback-enter-from,
.feedback-leave-to {
  opacity: 0;
  transform: translateY(-5px);
}

.feedback-enter-active,
.feedback-leave-active {
  transition: all 0.2s ease;
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
