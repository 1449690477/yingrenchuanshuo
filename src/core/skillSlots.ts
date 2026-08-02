/**
 * 主动技能栏的**唯一判定点** —— 客户端与服务端共用同一份规则。
 *
 * ── 为什么必须共用 ──
 * M3-5 之后，上场哪四个技能由**玩家选**，而这个选择要跟着搭配快照一起送到服务端
 * （试炼成绩、战力、竞技场都要服务端复算）。一旦两边各写一套「什么算合法」，
 * 就会出现客户端按玩家选的打、服务端按另一套复算 —— **两边算出的伤害对不上**，
 * 而这个不一致会表现为「玩家成绩被判不可信」，不是报错。
 * 所以判定只能有一处，客户端与服务端都从这里过。
 *
 * ── ★ 为什么是「过滤」而不是「拒绝」 ──
 * 非法选择有两个来源，外观完全一样：
 *   ① 伪造：有人手改请求，塞进没解锁的技能；
 *   ② **数据漂移**：`data/skills.ts` 改名或删掉了某个技能，而玩家存档里还存着旧 id。
 *      这个项目的技能表正在高频改动，②比①常见得多。
 *
 * 如果非法就整单拒绝，②的玩家会**每次同步都被打回、确定性地永远上不去**，
 * 而他什么都没做错。这正是 2026-08-01 等级上限那次的教训：
 * 我第一版写的是超限直接 400，被指出会把线上两行 level=100 的历史档案永久锁死，
 * 改成钳制后真人无感、伪造者也拿不到好处、坏数据还会在下次同步时自愈。
 *
 * 这里同理：**逐个丢弃非法项，保留合法的**。
 * 伪造者的收益是零（非法项根本不进战斗），受害者是零（合法部分照常生效），
 * 而且丢弃原因会带出去，让调用方能把「伪造」和「数据漂移」分开记录。
 *
 * ── 不做的事 ──
 * **丢弃后不自动补默认技能填满栏位。** 补了的话，玩家会带着一个自己没选过的技能上场，
 * 而且**看不出来**；空栏位是能被 UI 显示、能被玩家自己修的。宁可少一个技能，
 * 也不要凭空给他一个。
 */

import { DEFAULT_ACTIVE_SKILL_ORDER, skillsFor } from '@/data/skills';
import type { ClassId } from './types';

/** 主动技能栏位数。被动技全自动生效，不占栏位。 */
export const ACTIVE_SKILL_SLOTS = 4;

/** 某个技能 id 没能进入技能栏的原因。 */
export type SkillSlotDropReason =
  /** 这个职业的技能表里没有该 id —— 多半是数据改名/删除，也可能是伪造 */
  | 'unknown-skill'
  /** 是被动技：被动全自动生效，不占主动栏位 */
  | 'not-active'
  /** 等级不够，尚未解锁 */
  | 'locked'
  /** 同一个技能被放进了多个栏位 */
  | 'duplicate'
  /** 超出栏位上限 */
  | 'overflow';

export interface DroppedSkillSlot {
  skillId: string;
  reason: SkillSlotDropReason;
}

export interface ResolvedSkillSlots {
  /** 实际上场的主动技能 id，顺序即玩家指定的栏位顺序 */
  readonly selected: readonly string[];
  /** 被丢弃的项与原因；空数组表示请求被原样接受 */
  readonly dropped: readonly DroppedSkillSlot[];
  /** 本次结果是否来自默认顺序（玩家尚未做过选择） */
  readonly usedDefault: boolean;
}

/** 该职业在该等级下所有可选的主动技能 id（供 UI 列表与测试使用）。 */
export function selectableActiveSkillIds(classId: ClassId, level: number): readonly string[] {
  return skillsFor(classId)
    .filter((skill) => skill.type === 'active' && skill.unlockLevel <= level)
    .map((skill) => skill.id);
}

/**
 * 把玩家的技能栏选择解析成**实际上场的技能**。
 *
 * @param requested 玩家的选择。
 *   · `undefined` / `null` = **尚未做过选择** ⇒ 回落到职业默认顺序。
 *     老存档迁移后就是这个状态，因此行为与 M3-5 上线前**逐字一致**。
 *   · `[]` = 玩家**明确清空了所有栏位** ⇒ 尊重它，本次不带任何主动技（只有普攻与被动）。
 *     这个区分是刻意的：把「没选过」和「选了空」当成同一件事，
 *     就没法在不改变老玩家行为的前提下让新玩家清栏。
 */
export function resolveActiveSkillSlots(
  classId: ClassId,
  level: number,
  requested?: readonly string[] | null,
): ResolvedSkillSlots {
  const skills = skillsFor(classId);
  const byId = new Map(skills.map((skill) => [skill.id, skill]));

  if (requested == null) {
    const selected = DEFAULT_ACTIVE_SKILL_ORDER[classId]
      .filter((skillId) => {
        const skill = byId.get(skillId);
        return skill?.type === 'active' && skill.unlockLevel <= level;
      })
      .slice(0, ACTIVE_SKILL_SLOTS);
    return { selected, dropped: [], usedDefault: true };
  }

  const selected: string[] = [];
  const dropped: DroppedSkillSlot[] = [];
  const seen = new Set<string>();

  for (const skillId of requested) {
    const skill = byId.get(skillId);
    if (!skill) {
      dropped.push({ skillId, reason: 'unknown-skill' });
      continue;
    }
    if (skill.type !== 'active') {
      dropped.push({ skillId, reason: 'not-active' });
      continue;
    }
    if (skill.unlockLevel > level) {
      dropped.push({ skillId, reason: 'locked' });
      continue;
    }
    if (seen.has(skillId)) {
      dropped.push({ skillId, reason: 'duplicate' });
      continue;
    }
    // 上限判定放在最后：只有「本来合法、但栏位已满」才算 overflow，
    // 否则一个非法 id 会把后面合法的挤掉，报出来的原因也会误导。
    if (selected.length >= ACTIVE_SKILL_SLOTS) {
      dropped.push({ skillId, reason: 'overflow' });
      continue;
    }
    seen.add(skillId);
    selected.push(skillId);
  }

  return { selected, dropped, usedDefault: false };
}
