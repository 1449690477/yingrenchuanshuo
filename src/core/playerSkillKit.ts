/**
 * 玩家默认技能栏的唯一生产构建入口。
 *
 * 试炼、竞技场、挂机、装备副本和服务端复算必须调用这里，不能分别猜一套
 * “当前解锁技能”。技能栏 UI 上线前的正式规则是：已解锁主动按优先级取前 4，
 * 已解锁被动全部生效；召唤定义只注入其所属职业。
 */
import type { ClassId } from './types';
import { createSkillCombatKit, type SkillCombatKit } from './skillCombat';
import { skillsFor } from '@/data/skills';
import { SUMMON_DEFINITIONS } from '@/data/summons';

export function buildDefaultPlayerSkillKit(
  classId: ClassId,
  level: number,
  skillDamageBonusRatio = 0,
): SkillCombatKit {
  if (!Number.isFinite(skillDamageBonusRatio)) {
    throw new Error(`buildDefaultPlayerSkillKit: 技能伤害加成必须是有限数，收到 ${skillDamageBonusRatio}`);
  }
  return createSkillCombatKit(skillsFor(classId), level, {
    summons: SUMMON_DEFINITIONS.filter((summon) => summon.ownerClass === classId),
    skillDamageBonusRatio,
  });
}
