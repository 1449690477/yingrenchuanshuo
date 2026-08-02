<script setup lang="ts">
import { computed, ref } from 'vue';
import { ChevronDown, Coins } from '@lucide/vue';
import { skillsFor } from '@/data/skills';
import SkillIcon from '@/components/SkillIcon.vue';
import ItemIcon from '@/components/ItemIcon.vue';
import { usePlayerStore } from '@/stores/player';
import { levelScalarAt } from '@/core/skills';
import type {
  LevelScalar,
  Skill,
  SkillCondition,
  SkillEffect,
  SkillStatModifier,
} from '@/core/types';
import type { SkillUpgradeAssessment, SkillUpgradeBlockReason } from '@/core/skillUpgrade';
import { requireItem } from '@/data/items';
import { SKILL_BOOK_ITEM_ID } from '@/data/skillUpgradeRules';

const player = usePlayerStore();

const skills = computed(() => (player.player ? skillsFor(player.player.classId) : []));
const skillBook = requireItem(SKILL_BOOK_ITEM_ID);
const ownedBooks = computed(() =>
  player.player ? (player.assessSkillUpgrade(skills.value[0]?.id ?? '')?.ownedBooks ?? 0) : 0,
);

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

function isUnlocked(skill: Skill): boolean {
  return playerLevel.value >= skill.unlockLevel;
}

function toggleExpand(skill: Skill): void {
  if (!isUnlocked(skill)) return;
  expandedId.value = expandedId.value === skill.id ? null : skill.id;
}

function isExpanded(skill: Skill): boolean {
  return expandedId.value === skill.id;
}

function typeLabel(skill: Skill): string {
  return skill.type === 'active' ? '主动' : '被动';
}

function elementLabel(skill: Pick<Skill, 'element'>): string {
  const map: Record<string, string> = {
    fire: '炎',
    ice: '冰',
    thunder: '雷',
    none: '无',
  };
  return map[skill.element] ?? skill.element;
}

function currentSkillLevel(skill: Skill): number {
  return player.skillLevels[skill.id] ?? 1;
}

function assessment(skill: Skill): SkillUpgradeAssessment | null {
  return player.assessSkillUpgrade(skill.id);
}

function scalarText(
  scalar: LevelScalar,
  level: number,
  percentage = true,
  signed = false,
): string {
  const value = levelScalarAt(scalar, level);
  const displayed = percentage ? value * 100 : value;
  const precision = Number.isInteger(displayed) ? 0 : 1;
  return `${signed && displayed > 0 ? '+' : ''}${displayed.toFixed(precision)}${percentage ? '%' : ''}`;
}

function scalarChange(
  scalar: LevelScalar,
  level: number,
  percentage = true,
  showNext = true,
  signed = false,
): string {
  const current = scalarText(scalar, level, percentage, signed);
  if (!showNext) return current;
  const next = scalarText(scalar, level + 1, percentage, signed);
  return current === next ? current : `${current} → ${next}`;
}

const STAT_LABELS: Record<SkillStatModifier['stat'], string> = {
  atk: '攻击',
  def: '防御',
  hp: '生命',
  acc: '命中',
  eva: '闪避',
  spd: '攻速',
  armorPenetration: '破甲',
  damageDone: '伤害',
  damageTaken: '承伤',
  damageTakenFromSource: '来源承伤',
  dotDamage: '持续伤害',
  critRate: '暴击率',
  critDmg: '暴击伤害',
  hitChance: '命中率',
  dodgeChance: '闪避率',
  defenseIgnore: '无视防御',
  lifesteal: '吸血',
};

function modifierDetail(modifier: SkillStatModifier, level: number, showNext: boolean): string {
  const label = STAT_LABELS[modifier.stat];
  if (modifier.unit === 'flat') {
    return `${label} ${scalarChange(modifier.amount, level, false, showNext, true)}`;
  }
  if (modifier.unit === 'ratio') {
    return `${label} ${scalarChange(modifier.ratio, level, true, showNext, true)}`;
  }
  return `${label} ${scalarChange(modifier.points, level, false, showNext, true)} 个百分点`;
}

const TRIGGER_LABELS: Record<Extract<SkillEffect, { kind: 'trigger' }>['event'], string> = {
  'after-skill-resolved': '技能结算后',
  'on-hit': '命中时',
  'on-crit': '暴击时',
  'on-dodge': '闪避时',
  'on-damage-taken': '受击时',
  'on-low-hp': '低生命时',
};

const CONTROL_LABELS: Record<Extract<SkillEffect, { kind: 'control' }>['control'], string> = {
  stun: '眩晕',
  freeze: '冻结',
  slow: '减速',
  knockback: '击退',
};

function conditionText(condition: SkillCondition): string {
  switch (condition.kind) {
    case 'self-hp-at-most':
      return `自身生命不高于 ${Math.round(condition.ratio * 100)}%`;
    case 'target-hp-at-most':
      return `目标生命不高于 ${Math.round(condition.ratio * 100)}%`;
    case 'monster-type':
      return `目标类型为 ${condition.types.join('/')}`;
    case 'status-stacks-at-least':
      return `${condition.target === 'self' ? '自身' : '目标'}「${condition.statusId}」至少 ${condition.stacks} 层`;
    case 'has-status':
      return `${condition.target === 'self' ? '自身' : '目标'}带有「${condition.statusId}」`;
  }
}

function nestedEffects(
  effects: readonly SkillEffect[],
  level: number,
  showNext: boolean,
): string {
  return effects.map((nested) => effectDetail(nested, level, showNext)).join('；');
}

/** 单个效果的完整描述；展开后直接展示当前级 → 下一级。 */
function effectDetail(effect: SkillEffect, level: number, showNext: boolean): string {
  switch (effect.kind) {
    case 'damage': {
      const hits = effect.hitWeights ? `${effect.hitWeights.length} 段` : '单段';
      const elem = effect.element ? elementLabel({ element: effect.element }) : '';
      return `${hits} ${elem} ${scalarChange(effect.multiplier, level, true, showNext)} 伤害`;
    }
    case 'heal':
      return `治疗 ${scalarChange(effect.maxHpRatio, level, true, showNext)} 最大生命`;
    case 'shield':
      return `护盾 ${scalarChange(effect.maxHpRatio, level, true, showNext)} 最大生命，持续 ${effect.durationSec}s`;
    case 'apply-status':
      return `附加「${effect.statusId}」${effect.stacks} 层（上限 ${effect.maxStacks}）${effect.modifiers?.length ? `：${effect.modifiers.map((modifier) => modifierDetail(modifier, level, showNext)).join('、')}` : ''}`;
    case 'modifier':
      return modifierDetail(effect.modifier, level, showNext);
    case 'summon':
      return `召唤协战单位，持续 ${effect.durationSec}s`;
    case 'periodic-damage':
      return `持续伤害 ${effect.ticks} 跳，共 ${scalarChange(effect.totalMultiplier, level, true, showNext)}`;
    case 'trigger':
      return `${TRIGGER_LABELS[effect.event]}${effect.chance === undefined ? '必定' : `${Math.round(effect.chance * 100)}%`}触发：${nestedEffects(effect.effects, level, showNext)}`;
    case 'conditional':
      return `${conditionText(effect.when)}：${nestedEffects(effect.effects, level, showNext)}`;
    case 'avoid-next-hit':
      return `${effect.durationSec}s 内闪避接下来 ${effect.count} 次攻击`;
    case 'consume-status':
      return `消耗「${effect.statusId}」层数`;
    case 'control':
      return `${CONTROL_LABELS[effect.control]} ${effect.durationSec}s${effect.chance < 1 ? `（${Math.round(effect.chance * 100)}%）` : ''}`;
    case 'dispel':
      return `驱散${effect.count === 'all' ? '全部' : `${effect.count} 个`}${effect.polarity === 'buff' ? '增益' : '减益'}`;
    case 'reflect-trigger-damage':
      return `反射 ${scalarChange(effect.damageRatio, level, true, showNext)} 本次伤害`;
    default:
      return '—';
  }
}

/** 技能完整效果列表 */
function fullEffects(skill: Skill, includeNext = true): string[] {
  const level = currentSkillLevel(skill);
  const showNext = includeNext && level < (assessment(skill)?.levelCap ?? level);
  return skill.effects.map((effect) => effectDetail(effect, level, showNext));
}

/** 简述（收起时显示） */
function effectSummary(skill: Skill): string {
  const effects = fullEffects(skill, false);
  return effects.length > 0 ? effects[0] : '—';
}

const notice = ref('');

const BLOCK_LABELS: Record<SkillUpgradeBlockReason, string> = {
  'skill-locked': '尚未解锁',
  'level-cap': '已达当前上限',
  'insufficient-books': '技能书不足',
  'insufficient-gold': '金币不足',
};

function upgradeLabel(skill: Skill): string {
  const quote = assessment(skill);
  if (!quote) return '暂不可升级';
  return quote.reason ? BLOCK_LABELS[quote.reason] : `升级到 Lv${quote.targetLevel}`;
}

function upgrade(skill: Skill): void {
  const result = player.upgradeSkill(skill.id);
  if (!result.ok) {
    notice.value = result.assessment ? BLOCK_LABELS[result.assessment.reason!] : '升级未完成';
    return;
  }
  notice.value = `${skill.name} 已提升到 Lv${result.assessment.targetLevel}`;
}
</script>

<template>
  <div class="skill-tree-shell">
    <div class="tree-summary">
      <span class="summary-copy">技能上限为角色等级的一半，升级会同步影响真实战斗与联机复算。</span>
      <span class="book-stock" :aria-label="`拥有技能研习书 ${ownedBooks} 本`">
        <ItemIcon :item="skillBook" size="sm" />
        {{ ownedBooks }} 本
      </span>
    </div>
    <p v-if="notice" class="upgrade-notice" aria-live="polite">{{ notice }}</p>
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
            <span v-if="isUnlocked(skill)" class="status unlocked">
              Lv{{ currentSkillLevel(skill) }}/{{ assessment(skill)?.levelCap ?? 1 }}
            </span>
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
            <div v-if="assessment(skill)" class="upgrade-section">
              <div
                v-if="assessment(skill)!.reason !== 'level-cap'"
                class="upgrade-cost"
                aria-label="升级消耗"
              >
                <span
                  class="cost-item"
                  :class="{ short: assessment(skill)!.ownedBooks < assessment(skill)!.cost.books }"
                >
                  <ItemIcon :item="skillBook" size="sm" />
                  {{ assessment(skill)!.cost.books }} / {{ assessment(skill)!.ownedBooks }}
                </span>
                <span
                  class="cost-item"
                  :class="{ short: assessment(skill)!.ownedGold < assessment(skill)!.cost.gold }"
                >
                  <Coins :size="15" aria-hidden="true" />
                  {{ assessment(skill)!.cost.gold.toLocaleString('zh-CN') }}
                </span>
              </div>
              <span v-else class="cap-hint">提升角色等级后可继续研习</span>
              <button
                type="button"
                class="upgrade-button"
                :disabled="assessment(skill)!.reason !== null"
                :aria-label="`${skill.name}，${upgradeLabel(skill)}`"
                @click="upgrade(skill)"
              >
                {{ upgradeLabel(skill) }}
              </button>
            </div>
          </div>
        </Transition>
      </div>
    </div>
  </div>
</template>

<style scoped>
.skill-tree-shell {
  min-width: 0;
}

.tree-summary {
  display: flex;
  align-items: center;
  gap: 10px;
  margin: 9px 9px 0;
  padding: 9px 10px;
  color: var(--text-mid);
  background: linear-gradient(105deg, rgba(255, 232, 242, 0.72), rgba(229, 241, 255, 0.82));
  border: 1px solid var(--line);
  border-radius: 10px;
}

.summary-copy {
  flex: 1;
  min-width: 0;
  font-size: 10px;
  line-height: 1.5;
}

.book-stock {
  display: inline-flex;
  flex: none;
  align-items: center;
  gap: 4px;
  padding: 4px 7px;
  color: var(--pink-deep);
  font-size: 10px;
  font-weight: 800;
  white-space: nowrap;
  background: rgb(255 255 255 / 72%);
  border-radius: 999px;
}

.upgrade-notice {
  margin: 7px 9px 0;
  padding: 7px 10px;
  color: var(--green-deep);
  font-size: 10px;
  font-weight: 700;
  background: var(--green-soft);
  border-radius: 9px;
}

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

.upgrade-section {
  display: flex;
  align-items: center;
  gap: 10px;
  padding-top: 10px;
  margin-top: 6px;
  border-top: 1px solid var(--line);
}

.upgrade-cost {
  display: flex;
  flex: 1;
  flex-wrap: wrap;
  gap: 5px;
  min-width: 0;
}

.cap-hint {
  flex: 1;
  min-width: 0;
  color: var(--text-dim);
  font-size: 10px;
  line-height: 1.5;
}

.cost-item {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  min-height: 28px;
  padding: 3px 7px;
  color: var(--text-mid);
  font-size: 10px;
  font-weight: 700;
  background: var(--panel-2);
  border-radius: 8px;
}

.cost-item.short {
  color: var(--red, #c64b68);
  background: rgba(255, 112, 143, 0.1);
}

.upgrade-button {
  flex: none;
  min-width: 112px;
  min-height: 44px;
  padding: 8px 12px;
  color: white;
  font-size: 11px;
  font-weight: 800;
  background: linear-gradient(110deg, var(--pink-deep), var(--blue-deep));
  border: 0;
  border-radius: 11px;
  box-shadow: 0 5px 13px rgb(245 121 159 / 20%);
  cursor: pointer;
}

.upgrade-button:disabled {
  color: var(--text-dim);
  background: var(--panel-3);
  box-shadow: none;
  cursor: not-allowed;
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
  .tree-summary,
  .upgrade-section {
    align-items: stretch;
    flex-direction: column;
  }

  .book-stock {
    align-self: flex-start;
  }

  .upgrade-button {
    width: 100%;
  }

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
