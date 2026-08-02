<script setup lang="ts">
import { computed, ref } from 'vue';
import { ChevronDown } from '@lucide/vue';
import { visualSkillsFor, type VisualSkill } from '@/data/skills';
import SkillIcon from '@/components/SkillIcon.vue';
import { usePlayerStore } from '@/stores/player';
import type { SkillEffect } from '@/core/types';

const player = usePlayerStore();

const skills = computed(() => (player.player ? visualSkillsFor(player.player.classId) : []));

/** 按解锁等级排序，同等级主动技能优先 */
const sortedSkills = computed(() =>
  [...skills.value].sort((a, b) => {
    if (a.unlockLevel !== b.unlockLevel) return a.unlockLevel - b.unlockLevel;
    if (a.type !== b.type) return a.type === 'active' ? -1 : 1;
    return 0;
  }),
);

const playerLevel = computed(() => player.player?.level ?? 0);

/** 当前展开的技能 ID */
const expandedId = ref<string | null>(null);

function isUnlocked(skill: VisualSkill): boolean {
  return playerLevel.value >= skill.unlockLevel;
}

function toggleExpand(skill: VisualSkill): void {
  if (!isUnlocked(skill)) return;
  expandedId.value = expandedId.value === skill.id ? null : skill.id;
}

function isExpanded(skill: VisualSkill): boolean {
  return expandedId.value === skill.id;
}

function typeLabel(skill: VisualSkill): string {
  return skill.type === 'active' ? '主动' : '被动';
}

function elementLabel(skill: VisualSkill): string {
  const map: Record<string, string> = {
    fire: '炎',
    ice: '冰',
    thunder: '雷',
    none: '无',
  };
  return map[skill.element] ?? skill.element;
}

/** 单个效果的完整描述 */
function effectDetail(effect: SkillEffect): string {
  switch (effect.kind) {
    case 'damage': {
      const mult = (effect.multiplier.base * 100).toFixed(0);
      const hits = effect.hitWeights ? `${effect.hitWeights.length} 段` : '单段';
      const elem = effect.element ? elementLabel({ element: effect.element } as VisualSkill) : '';
      return `${hits} ${elem} ${mult}% 伤害`;
    }
    case 'heal':
      return `治疗 ${(effect.maxHpRatio.base * 100).toFixed(0)}% 最大生命`;
    case 'shield':
      return `护盾 ${(effect.maxHpRatio.base * 100).toFixed(0)}% 最大生命，持续 ${effect.durationSec}s`;
    case 'apply-status':
      return `附加「${effect.statusId}」${effect.stacks} 层（上限 ${effect.maxStacks}）`;
    case 'modifier':
      return '属性修正';
    case 'summon':
      return '召唤协战单位';
    case 'periodic-damage':
      return `持续伤害 ${effect.ticks} 跳，共 ${(effect.totalMultiplier.base * 100).toFixed(0)}%`;
    case 'trigger':
      return `触发：${effect.event}（${((effect.chance ?? 0) * 100).toFixed(0)}% 概率）`;
    case 'conditional':
      return '条件效果';
    case 'avoid-next-hit':
      return '闪避下一次攻击';
    case 'consume-status':
      return `消耗「${effect.statusId}」层数`;
    case 'control':
      return `控制效果`;
    case 'dispel':
      return '驱散效果';
    default:
      return '—';
  }
}

/** 技能完整效果列表 */
function fullEffects(skill: VisualSkill): string[] {
  return skill.effects.map(effectDetail);
}

/** 简述（收起时显示） */
function effectSummary(skill: VisualSkill): string {
  const effects = fullEffects(skill);
  return effects.length > 0 ? effects[0] : '—';
}


</script>

<template>
  <div class="skill-tree" role="list" aria-label="技能树">
    <div
      v-for="(skill, index) in sortedSkills"
      :key="skill.id"
      class="skill-node"
      :class="{
        locked: !isUnlocked(skill),
        expanded: isExpanded(skill),
      }"
      :style="{ '--node-delay': `${index * 30}ms` }"
      role="listitem"
    >
      <button
        type="button"
        class="skill-main"
        :disabled="!isUnlocked(skill)"
        :aria-expanded="isExpanded(skill)"
        :aria-label="`${skill.name}，${typeLabel(skill)}技能，${isUnlocked(skill) ? '已解锁' : `等级 ${skill.unlockLevel} 解锁`}`"
        @click="toggleExpand(skill)"
      >
        <SkillIcon :skill="skill" :locked="!isUnlocked(skill)" />
        <span class="skill-info">
          <span class="skill-head">
            <span class="skill-name">{{ skill.name }}</span>
            <span class="skill-tags">
              <span class="tag type">{{ typeLabel(skill) }}</span>
              <span class="tag element">{{ elementLabel(skill) }}</span>
              <span v-if="skill.type === 'active'" class="tag cd">{{ skill.cooldownSec }}s</span>
            </span>
          </span>
          <span class="skill-desc">{{ skill.desc }}</span>
          <span class="skill-effect">{{ effectSummary(skill) }}</span>
        </span>
        <span class="skill-status">
          <span v-if="isUnlocked(skill)" class="status unlocked">已解锁</span>
          <span v-else class="status locked">Lv{{ skill.unlockLevel }}</span>
          <ChevronDown
            v-if="isUnlocked(skill)"
            class="expand-icon"
            :class="{ rotated: isExpanded(skill) }"
            :size="14"
          />
        </span>
      </button>

      <!-- 展开的完整效果详情 -->
      <Transition name="expand">
        <div v-if="isExpanded(skill)" class="skill-detail">
          <div class="detail-section">
            <span class="detail-label">效果</span>
            <ul class="detail-list">
              <li v-for="(effect, i) in fullEffects(skill)" :key="i">{{ effect }}</li>
            </ul>
          </div>
          <div v-if="skill.type === 'active'" class="detail-section">
            <span class="detail-label">属性</span>
            <div class="detail-props">
              <span class="prop">冷却 {{ skill.cooldownSec }} 秒</span>
              <span class="prop">优先级 {{ skill.priority }}</span>
              <span v-if="skill.castWhen" class="prop">有条件释放</span>
            </div>
          </div>
        </div>
      </Transition>
    </div>
  </div>
</template>

<style scoped>
.skill-tree {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 9px;
}

/* 入场动画 */
.skill-node {
  animation: node-in 0.4s var(--ease-soft) both;
  animation-delay: var(--node-delay, 0ms);
}

@keyframes node-in {
  from {
    opacity: 0;
    transform: translateY(8px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.skill-main {
  display: flex;
  align-items: center;
  gap: 10px;
  width: 100%;
  padding: 10px 12px;
  background: linear-gradient(100deg, #fff8fb, #f5f8ff);
  border: 1px solid var(--line);
  border-radius: var(--r-sm);
  text-align: left;
  cursor: pointer;
  transition: all 0.2s ease;
}

.skill-node:not(.locked) .skill-main:hover {
  border-color: var(--pink);
  box-shadow: 0 2px 8px rgb(245 121 159 / 12%);
  transform: translateY(-1px);
}

.skill-node:not(.locked) .skill-main:active {
  transform: translateY(0);
}

.skill-node.locked .skill-main {
  background: var(--panel-2);
  opacity: 0.75;
  cursor: not-allowed;
}

.skill-node.expanded .skill-main {
  border-color: var(--pink);
  border-bottom-left-radius: 0;
  border-bottom-right-radius: 0;
  box-shadow: 0 2px 8px rgb(245 121 159 / 12%);
}

.skill-info {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.skill-head {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.skill-name {
  font-size: 13px;
  font-weight: 700;
}

.skill-tags {
  display: flex;
  gap: 4px;
}

.tag {
  padding: 2px 6px;
  font-size: 9px;
  font-weight: 600;
  border-radius: 999px;
}

.tag.type {
  color: var(--pink-deep);
  background: var(--pink-soft);
}

.tag.element {
  color: var(--blue-deep);
  background: var(--blue-soft);
}

.tag.cd {
  color: var(--text-mid);
  background: var(--panel-3);
}

.skill-desc {
  color: var(--text-dim);
  font-size: 10px;
  line-height: 1.5;
  overflow: hidden;
  text-overflow: ellipsis;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
}

.skill-effect {
  color: var(--text-mid);
  font-size: 9px;
  font-weight: 600;
}

.skill-status {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  gap: 4px;
}

.status {
  padding: 3px 8px;
  font-size: 9px;
  font-weight: 700;
  border-radius: 999px;
}

.status.unlocked {
  color: var(--green-deep);
  background: var(--green-soft);
}

.status.locked {
  color: var(--text-dim);
  background: var(--panel-3);
}

.expand-icon {
  color: var(--text-dim);
  transition: transform 0.2s ease;
}

.expand-icon.rotated {
  transform: rotate(180deg);
}

/* 展开详情 */
.skill-detail {
  padding: 10px 12px;
  background: var(--panel-1);
  border: 1px solid var(--pink);
  border-top: none;
  border-bottom-left-radius: var(--r-sm);
  border-bottom-right-radius: var(--r-sm);
}

.detail-section {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 6px 0;
}

.detail-section + .detail-section {
  border-top: 1px solid var(--line);
}

.detail-label {
  font-size: 9px;
  font-weight: 700;
  color: var(--text-dim);
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.detail-list {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 0;
  margin: 0;
  list-style: none;
}

.detail-list li {
  padding: 4px 8px;
  font-size: 10px;
  color: var(--text-mid);
  background: var(--panel-2);
  border-radius: 6px;
}

.detail-props {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}

.prop {
  padding: 3px 8px;
  font-size: 9px;
  font-weight: 600;
  color: var(--text-mid);
  background: var(--panel-3);
  border-radius: 999px;
}

/* 展开动画 */
.expand-enter-active,
.expand-leave-active {
  transition: all 0.25s var(--ease-soft);
  overflow: hidden;
}

.expand-enter-from,
.expand-leave-to {
  opacity: 0;
  max-height: 0;
  padding-top: 0;
  padding-bottom: 0;
}

.expand-enter-to,
.expand-leave-from {
  max-height: 300px;
}

/* 小屏适配（320px） */
@media (max-width: 360px) {
  .skill-main {
    padding: 8px 10px;
    gap: 8px;
  }

  .skill-name {
    font-size: 12px;
  }

  .skill-tags {
    gap: 3px;
  }

  .tag {
    padding: 1px 5px;
    font-size: 8px;
  }

  .skill-desc {
    font-size: 9px;
    -webkit-line-clamp: 1;
  }
}

/* 减弱动效 */
@media (prefers-reduced-motion: reduce) {
  .skill-node {
    animation: none;
  }

  .skill-main,
  .expand-icon {
    transition: none;
  }

  .expand-enter-active,
  .expand-leave-active {
    transition: none;
  }
}
</style>
