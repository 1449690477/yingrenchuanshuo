/**
 * 玩家默认技能栏的唯一生产构建入口。
 *
 * 试炼、竞技场、挂机、装备副本和服务端复算必须调用这里，不能分别猜一套
 * “当前解锁技能”。技能栏 UI 上线前的正式规则是：按职业默认技能顺序过滤已解锁项并取前 4，
 * 已解锁被动全部生效；召唤定义只注入其所属职业。
 */
import type { ClassId } from './types';
import { createSkillCombatKit, type SkillCombatKit } from './skillCombat';
import { resolveActiveSkillSlots, type DroppedSkillSlot } from './skillSlots';
import { skillsFor } from '@/data/skills';
import { ARENA_SUMMON_ATTACK_MULTIPLIERS, SUMMON_DEFINITIONS } from '@/data/summons';

export interface BuildPlayerSkillKitOptions {
  /** 套装等旧字段的技能伤害加成：0.18 表示 +18%。 */
  skillDamageBonusRatio?: number;
  /**
   * 玩家选定的主动技能栏（M3-5）。
   * `undefined` 表示**尚未做过选择**，回落到职业默认顺序；
   * `[]` 表示玩家**明确清空了栏位**。两者的区别见 `skillSlots.ts`。
   */
  selectedActiveSkillIds?: readonly string[] | null;
  /** 技能 id → 当前等级；缺失项按 1 级。 */
  skillLevels?: Readonly<Record<string, number>>;
  /**
   * 竞技场场景标志（A 案，docs/85 §八）：`true` 时召唤物改用
   * `ARENA_SUMMON_ATTACK_MULTIPLIERS` 的补偿倍率；PvE / 试炼 / 挂机 / 副本
   * 保持数据表原值。仅 `buildTrialCombatant` 的 `arena: true`（唯一来源为
   * `buildArenaDuelSide`）会传 `true`，不新增第二个场景传入点。
   */
  arena?: boolean;
}

export interface BuiltPlayerSkillKit {
  kit: SkillCombatKit;
  /**
   * 被丢弃的技能栏项与原因。
   *
   * **服务端应当把非空的这一项记进日志**：它是区分「玩家伪造」与「技能表改名导致
   * 存档里的旧 id 失效」的唯一线索，而这两者在结果上完全一样（都是少了个技能）。
   */
  dropped: readonly DroppedSkillSlot[];
}

/**
 * 构建玩家技能包 —— **战斗与服务端复算的唯一入口**。
 *
 * 技能栏的合法性判定不在这里做，统一交给 `resolveActiveSkillSlots`，
 * 因此客户端与服务端只要都走这个函数，就不可能出现「两边选出不同技能」的分歧。
 */
export function buildPlayerSkillKit(
  classId: ClassId,
  level: number,
  options: BuildPlayerSkillKitOptions = {},
): BuiltPlayerSkillKit {
  const skillDamageBonusRatio = options.skillDamageBonusRatio ?? 0;
  if (!Number.isFinite(skillDamageBonusRatio)) {
    throw new Error(`buildPlayerSkillKit: 技能伤害加成必须是有限数，收到 ${skillDamageBonusRatio}`);
  }
  const resolved = resolveActiveSkillSlots(classId, level, options.selectedActiveSkillIds);
  const classSummons = SUMMON_DEFINITIONS.filter((summon) => summon.ownerClass === classId);
  const summons = options.arena
    ? classSummons.map((summon) => {
        const arenaMultiplier = ARENA_SUMMON_ATTACK_MULTIPLIERS[summon.id];
        return arenaMultiplier === undefined
          ? summon
          : { ...summon, attackMultiplier: arenaMultiplier };
      })
    : classSummons;
  const kit = createSkillCombatKit(skillsFor(classId), level, {
    summons,
    skillDamageBonusRatio,
    selectedActiveSkillIds: resolved.selected,
    skillLevels: options.skillLevels,
  });
  return { kit, dropped: resolved.dropped };
}

/**
 * 默认技能栏（玩家尚未做过选择）。
 *
 * 保留这个名字是因为七个调用方都在用它，且 M3-5 的技能栏 UI 上线前它就是正式规则。
 * 内部走 `buildPlayerSkillKit`，所以**规则只有一份**，不会出现两条路径各自演化。
 */
export function buildDefaultPlayerSkillKit(
  classId: ClassId,
  level: number,
  skillDamageBonusRatio = 0,
  skillLevels?: Readonly<Record<string, number>>,
): SkillCombatKit {
  return buildPlayerSkillKit(classId, level, { skillDamageBonusRatio, skillLevels }).kit;
}
