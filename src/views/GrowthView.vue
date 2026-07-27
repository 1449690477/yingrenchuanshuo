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
import SkillIcon from '@/components/SkillIcon.vue';
import SystemArtwork from '@/components/SystemArtwork.vue';

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
