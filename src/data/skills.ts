/**
 * 技能配置表。
 *
 * 当前先落地魔女的 3 个代表技能视觉；完整 42 技能仍属于 M3-3，
 * 这里的字段已经遵循 docs/13，后续直接补表，不另起一套结构。
 */

import type { Skill } from '@/core/types';

export type SkillVisualKind = 'projectile' | 'ring' | 'lightning';

export interface VisualSkill extends Skill {
  effectAsset: string;
  visualKind: SkillVisualKind;
}

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

export function unlockedWitchVisualSkills(level: number): readonly VisualSkill[] {
  return WITCH_VISUAL_SKILLS.filter((skill) => skill.unlockLevel <= level);
}
