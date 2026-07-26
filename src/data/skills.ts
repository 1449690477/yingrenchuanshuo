/**
 * 技能配置表。
 *
 * 当前先落地各职业的代表技能视觉；完整 42 技能仍属于 M3-3，
 * 这里的字段已经遵循 docs/13，后续直接补表，不另起一套结构。
 */

import type { ClassId, Skill } from '@/core/types';

export type SkillVisualKind =
  'projectile' | 'ring' | 'lightning' | 'slash' | 'arc' | 'flame' | 'heal' | 'poison' | 'summon';

export interface VisualSkill extends Skill {
  effectAsset: string;
  visualKind: SkillVisualKind;
}

export const SWORDSMAN_VISUAL_SKILLS: readonly VisualSkill[] = [
  {
    id: 'skill_swordsman_attack',
    name: '攻杀剑术',
    class: 'swordsman',
    type: 'active',
    element: 'none',
    unlockLevel: 4,
    baseMultiplier: 1.6,
    perLevelMultiplier: 0.06,
    cooldown: 4,
    targets: 1,
    priority: 10,
    icon: 'assets/effects/swordsman-attack.png',
    effectAsset: 'assets/effects/swordsman-attack.png',
    visualKind: 'slash',
    desc: '冰蓝与樱粉剑光交错，利落斩向单个敌人。',
  },
  {
    id: 'skill_swordsman_halfmoon',
    name: '半月弯刀',
    class: 'swordsman',
    type: 'active',
    element: 'none',
    unlockLevel: 19,
    baseMultiplier: 1.3,
    perLevelMultiplier: 0.06,
    cooldown: 7,
    targets: 0,
    priority: 20,
    icon: 'assets/effects/swordsman-halfmoon.png',
    effectAsset: 'assets/effects/swordsman-halfmoon.png',
    visualKind: 'arc',
    desc: '月牙剑气横扫敌群，身后留下一串樱花光屑。',
  },
  {
    id: 'skill_swordsman_flame',
    name: '烈火剑法',
    class: 'swordsman',
    type: 'active',
    element: 'fire',
    unlockLevel: 35,
    baseMultiplier: 2.4,
    perLevelMultiplier: 0.06,
    cooldown: 8,
    targets: 1,
    priority: 30,
    icon: 'assets/effects/swordsman-flame.png',
    effectAsset: 'assets/effects/swordsman-flame.png',
    visualKind: 'flame',
    desc: '樱焰缠上剑锋，斩落时迸开灼热花火。',
  },
];

export const WITCH_VISUAL_SKILLS: readonly VisualSkill[] = [
  {
    id: 'skill_witch_fireball',
    name: '火球术',
    class: 'witch',
    type: 'active',
    element: 'fire',
    unlockLevel: 1,
    baseMultiplier: 1.5,
    perLevelMultiplier: 0.06,
    cooldown: 3,
    targets: 1,
    priority: 10,
    icon: 'assets/effects/witch-fireball.png',
    effectAsset: 'assets/effects/witch-fireball.png',
    visualKind: 'projectile',
    desc: '樱焰凝成花心火球，命中时迸开星屑。',
  },
  {
    id: 'skill_witch_fire_ring',
    name: '抗拒火环',
    class: 'witch',
    type: 'active',
    element: 'fire',
    unlockLevel: 13,
    baseMultiplier: 1.2,
    perLevelMultiplier: 0.06,
    cooldown: 8,
    targets: 0,
    priority: 20,
    icon: 'assets/effects/witch-fire-ring.png',
    effectAsset: 'assets/effects/witch-fire-ring.png',
    visualKind: 'ring',
    desc: '六瓣樱焰旋成火环，弹开身边的敌人。',
  },
  {
    id: 'skill_witch_hell_lightning',
    name: '地狱雷光',
    class: 'witch',
    type: 'active',
    element: 'thunder',
    unlockLevel: 29,
    baseMultiplier: 2.6,
    perLevelMultiplier: 0.06,
    cooldown: 9,
    targets: 0,
    priority: 30,
    icon: 'assets/effects/witch-lightning.png',
    effectAsset: 'assets/effects/witch-lightning.png',
    visualKind: 'lightning',
    desc: '星月雷光在敌群中央绽开，造成范围伤害。',
  },
];

export const SHAMAN_VISUAL_SKILLS: readonly VisualSkill[] = [
  {
    id: 'skill_shaman_heal',
    name: '治愈术',
    class: 'shaman',
    type: 'active',
    element: 'none',
    unlockLevel: 1,
    baseMultiplier: 0,
    perLevelMultiplier: 0.06,
    cooldown: 10,
    targets: 1,
    priority: 10,
    icon: 'assets/effects/shaman-heal.png',
    effectAsset: 'assets/effects/shaman-heal.png',
    visualKind: 'heal',
    desc: '水晶莲心绽开柔光，为少女回复元气。',
  },
  {
    id: 'skill_shaman_poison',
    name: '施毒术',
    class: 'shaman',
    type: 'active',
    element: 'none',
    unlockLevel: 10,
    baseMultiplier: 0.6,
    perLevelMultiplier: 0.06,
    cooldown: 6,
    targets: 1,
    priority: 20,
    icon: 'assets/effects/shaman-poison.png',
    effectAsset: 'assets/effects/shaman-poison.png',
    visualKind: 'poison',
    desc: '紫雾与荆棘缠住目标，持续侵蚀敌人的生命。',
  },
  {
    id: 'skill_shaman_skeleton',
    name: '召唤骷髅',
    class: 'shaman',
    type: 'active',
    element: 'none',
    unlockLevel: 20,
    baseMultiplier: 0,
    perLevelMultiplier: 0.06,
    cooldown: 30,
    targets: 1,
    priority: 30,
    icon: 'assets/effects/shaman-skeleton.png',
    effectAsset: 'assets/effects/shaman-skeleton.png',
    visualKind: 'summon',
    desc: '灵铃唤醒圆眼骷髅，替主人守在战场前方。',
  },
];

const VISUAL_SKILLS_BY_CLASS: Readonly<Record<ClassId, readonly VisualSkill[]>> = {
  swordsman: SWORDSMAN_VISUAL_SKILLS,
  witch: WITCH_VISUAL_SKILLS,
  shaman: SHAMAN_VISUAL_SKILLS,
};

export function visualSkillsFor(classId: ClassId): readonly VisualSkill[] {
  return VISUAL_SKILLS_BY_CLASS[classId];
}

export function unlockedVisualSkills(classId: ClassId, level: number): readonly VisualSkill[] {
  return visualSkillsFor(classId).filter((skill) => skill.unlockLevel <= level);
}
