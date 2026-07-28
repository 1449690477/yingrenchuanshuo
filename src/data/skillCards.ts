import type { ClassId, Element, SkillCondition, SkillEffect } from '@/core/types';
import { BASIC_ATTACK_EFFECTS } from './characterAppearance';
import {
  battleRhythmSkills,
  visualSkillsFor,
  type ActiveVisualSkill,
  type SkillVisualKind,
} from './skills';

export type SkillCardMode = 'basic' | 'auto' | 'conditional' | 'locked';
export type SkillCardKind = '基础' | '单体' | '范围' | '连击' | '持续' | '回复' | '召唤';

/**
 * 挂机战斗卡片的唯一静态契约。
 *
 * Vue 只消费这里的结果，不按职业写分支。新增职业时，只要补齐技能、
 * 视觉定义与基础攻击图，卡带会自动生成。
 */
export interface AutoBattleSkillCard {
  id: string;
  skillId: string | null;
  name: string;
  desc: string;
  iconAsset: string;
  effectAsset: string;
  element: Element;
  mode: SkillCardMode;
  kind: SkillCardKind;
  unlockLevel: number;
  cooldownSec: number | null;
  /**
   * 玩法配置中的优先级。当前只供详情说明和同帧视觉演出排序，
   * 不能当作 M3-4 的真实结算顺序。
   */
  priority: number | null;
  hitCount: number;
  conditionText: string | null;
  visualKind: SkillVisualKind | 'basic';
}

const MIN_VISIBLE_CARDS = 4;

export function autoBattleSkillCards(
  classId: ClassId,
  level: number,
): readonly AutoBattleSkillCard[] {
  const visualActives = visualSkillsFor(classId).filter(
    (skill): skill is ActiveVisualSkill => skill.type === 'active',
  );
  const rhythmIndex = new Map(
    battleRhythmSkills(classId, level).map((skill, index) => [skill.id, index]),
  );
  const unlocked = visualActives
    .filter((skill) => skill.unlockLevel <= level)
    .map((skill) => activeCard(skill, rhythmIndex.has(skill.id) ? 'auto' : 'conditional'));
  const lockedCount = Math.max(0, MIN_VISIBLE_CARDS - 1 - unlocked.length);
  const locked = visualActives
    .filter((skill) => skill.unlockLevel > level)
    .slice(0, Math.max(lockedCount, unlocked.length >= MIN_VISIBLE_CARDS ? 1 : 0))
    .map((skill) => activeCard(skill, 'locked'));

  return [basicCard(classId), ...unlocked, ...locked];
}

function basicCard(classId: ClassId): AutoBattleSkillCard {
  return {
    id: `basic-${classId}`,
    skillId: null,
    name: '基础行动',
    desc: '跟随当前攻速持续出手，是自动战斗演出的稳定节拍。',
    iconAsset: BASIC_ATTACK_EFFECTS[classId],
    effectAsset: BASIC_ATTACK_EFFECTS[classId],
    element: 'none',
    mode: 'basic',
    kind: '基础',
    unlockLevel: 1,
    cooldownSec: null,
    priority: null,
    hitCount: 1,
    conditionText: null,
    visualKind: 'basic',
  };
}

function activeCard(
  skill: ActiveVisualSkill,
  mode: Exclude<SkillCardMode, 'basic'>,
): AutoBattleSkillCard {
  return {
    id: skill.id,
    skillId: skill.id,
    name: skill.name,
    desc: skill.desc,
    iconAsset: skill.icon,
    effectAsset: skill.effectAsset,
    element: skill.element,
    mode,
    kind: skillCardKind(skill.effects),
    unlockLevel: skill.unlockLevel,
    cooldownSec: skill.cooldownSec,
    priority: skill.priority,
    hitCount: Math.max(1, skill.hitOffsetsMs.length),
    conditionText: conditionLabel(skill.castWhen, skill.effects),
    visualKind: skill.visualKind,
  };
}

function skillCardKind(effects: readonly SkillEffect[]): SkillCardKind {
  if (effects.some((effect) => effect.kind === 'heal')) return '回复';
  if (effects.some((effect) => effect.kind === 'summon')) return '召唤';
  if (effects.some((effect) => effect.kind === 'periodic-damage')) return '持续';
  const damage = effects.find(
    (effect): effect is Extract<SkillEffect, { kind: 'damage' }> => effect.kind === 'damage',
  );
  if (!damage) return '单体';
  if ((damage.hitWeights?.length ?? 0) > 1) return '连击';
  if (damage.target.kind === 'enemies' && damage.target.count !== 1) return '范围';
  return '单体';
}

function conditionLabel(
  castWhen: SkillCondition | undefined,
  effects: readonly SkillEffect[],
): string | null {
  if (castWhen) return readableCondition(castWhen);
  if (effects.some((effect) => effect.kind === 'heal')) return '根据生命状态待机';
  if (effects.some((effect) => effect.kind === 'summon')) return '根据召唤物状态待机';
  return null;
}

function readableCondition(condition: SkillCondition): string {
  switch (condition.kind) {
    case 'self-hp-at-most':
      return `生命低于 ${Math.round(condition.ratio * 100)}%`;
    case 'target-hp-at-most':
      return `目标生命低于 ${Math.round(condition.ratio * 100)}%`;
    case 'monster-type':
      return `面对${condition.types
        .map((type) => (type === 'boss' ? 'BOSS' : type === 'elite' ? '精英' : '普通怪'))
        .join('或')}`;
    case 'status-stacks-at-least':
      return `状态达到 ${condition.stacks} 层`;
    case 'has-status':
      return '目标带有指定状态';
  }
}
