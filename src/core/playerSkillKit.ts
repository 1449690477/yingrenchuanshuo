/**
 * 玩家默认技能栏的唯一生产构建入口。
 *
 * 试炼、竞技场、挂机、装备副本和服务端复算必须调用这里，不能分别猜一套
 * “当前解锁技能”。技能栏 UI 上线前的正式规则是：按职业默认技能顺序过滤已解锁项并取前 4，
 * 已解锁被动全部生效；召唤定义只注入其所属职业。
 */
import type { ClassId } from './types';
import { createSkillCombatKit, type SkillCombatKit } from './skillCombat';
import { DEFAULT_ACTIVE_SKILL_ORDER, skillsFor } from '@/data/skills';
import { SUMMON_DEFINITIONS } from '@/data/summons';

export function buildDefaultPlayerSkillKit(
  classId: ClassId,
  level: number,
  skillDamageBonusRatio = 0,
): SkillCombatKit {
  if (!Number.isFinite(skillDamageBonusRatio)) {
    throw new Error(
      `buildDefaultPlayerSkillKit: 技能伤害加成必须是有限数，收到 ${skillDamageBonusRatio}`,
    );
  }
  const skills = skillsFor(classId);
  const unlockedActiveIds = new Set(
    skills
      .filter((skill) => skill.type === 'active' && skill.unlockLevel <= level)
      .map((skill) => skill.id),
  );
  const selectedActiveSkillIds = DEFAULT_ACTIVE_SKILL_ORDER[classId]
    .filter((skillId) => unlockedActiveIds.has(skillId))
    .slice(0, 4);
  return createSkillCombatKit(skills, level, {
    summons: SUMMON_DEFINITIONS.filter((summon) => summon.ownerClass === classId),
    skillDamageBonusRatio,
    selectedActiveSkillIds,
  });
}
