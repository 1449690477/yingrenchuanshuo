import { describe, expect, it } from 'vitest';
import { buildDefaultPlayerSkillKit, buildPlayerSkillKit } from '../playerSkillKit';
import { CLASS_IDS } from '../types';
import { DEFAULT_ACTIVE_SKILL_ORDER, skillsFor } from '@/data/skills';

describe('玩家默认技能栏生产入口', () => {
  it.each(CLASS_IDS)('%s 在各等级只装载已解锁的本职业技能', (classId) => {
    for (const level of [1, 30, 60, 90, 120]) {
      const kit = buildDefaultPlayerSkillKit(classId, level);
      expect(kit.active.length).toBeLessThanOrEqual(4);
      const unlockedActive = new Set(
        skillsFor(classId)
          .filter((skill) => skill.type === 'active' && skill.unlockLevel <= level)
          .map((skill) => skill.id),
      );
      expect(kit.active.map((entry) => entry.skill.id)).toEqual(
        DEFAULT_ACTIVE_SKILL_ORDER[classId]
          .filter((skillId) => unlockedActive.has(skillId))
          .slice(0, 4),
      );
      for (const entry of [...kit.active, ...kit.passives]) {
        expect(entry.skill.class).toBe(classId);
        expect(entry.skill.unlockLevel).toBeLessThanOrEqual(level);
      }
    }
  });

  it('灵巫低段有直伤循环，高等级不携带双治疗；喵喵和樱酱保留招牌循环', () => {
    // 2026-08-04 平衡修正（docs/85 P1）：灵巫默认栏改为召唤/输出优先，
    // 低段（Lv10）仍保 heal 兜底；高等级 = 骷髅/神兽/群毒/魂火，无治疗。
    expect(buildDefaultPlayerSkillKit('shaman', 10).active.map((entry) => entry.skill.id)).toEqual([
      'skill_shaman_soul_fire',
      'skill_shaman_poison',
      'skill_shaman_heal',
    ]);
    expect(buildDefaultPlayerSkillKit('shaman', 120).active.map((entry) => entry.skill.id)).toEqual(
      [
        'skill_shaman_skeleton',
        'skill_shaman_divine_beast',
        'skill_shaman_group_poison',
        'skill_shaman_soul_fire',
      ],
    );
    expect(buildDefaultPlayerSkillKit('catkin', 120).active.map((entry) => entry.skill.id)).toEqual(
      [
        'skill_catkin_hundred_claw',
        'skill_catkin_scratch_frenzy',
        'skill_catkin_box_ambush',
        'skill_catkin_moonshadow_step',
      ],
    );
    expect(buildDefaultPlayerSkillKit('catkin', 65).active.map((entry) => entry.skill.id)).toEqual([
      'skill_catkin_scratch_frenzy',
      'skill_catkin_box_ambush',
      'skill_catkin_nine_life_spin',
      'skill_catkin_tail_sweep',
    ]);
    expect(buildDefaultPlayerSkillKit('kenshi', 120).active.map((entry) => entry.skill.id)).toEqual(
      [
        'skill_kenshi_thousand_sakura',
        'skill_kenshi_iai_flash',
        'skill_kenshi_armor_break',
        'skill_kenshi_iai_draw',
      ],
    );
  });

  it('召唤定义只进入所属灵巫技能栏，其他职业没有隐式召唤', () => {
    expect(buildDefaultPlayerSkillKit('shaman', 120).summons?.map((summon) => summon.id)).toEqual([
      'summon_shaman_skeleton',
      'summon_shaman_divine_beast',
    ]);
    for (const classId of CLASS_IDS.filter((candidate) => candidate !== 'shaman')) {
      expect(buildDefaultPlayerSkillKit(classId, 120).summons).toEqual([]);
    }
  });

  it('A 案：竞技场标志切换召唤倍率为补偿值，PvE 默认保持数据表原值', () => {
    const pve = buildDefaultPlayerSkillKit('shaman', 120).summons ?? [];
    const arena = buildPlayerSkillKit('shaman', 120, { arena: true }).kit.summons ?? [];
    expect(pve.map((entry) => [entry.id, entry.attackMultiplier])).toEqual([
      ['summon_shaman_skeleton', 0.4],
      ['summon_shaman_divine_beast', 0.3],
    ]);
    expect(arena.map((entry) => [entry.id, entry.attackMultiplier])).toEqual([
      ['summon_shaman_skeleton', 0.46],
      ['summon_shaman_divine_beast', 0.62],
    ]);
    // 分叉只改倍率，不改技能栏结构与装载项
    expect(arena.map((entry) => entry.id)).toEqual(pve.map((entry) => entry.id));
  });

  it('套装技能增伤以小数口径原样进入同一技能栏', () => {
    expect(buildDefaultPlayerSkillKit('kenshi', 120, 0.18).skillDamageBonusRatio).toBe(0.18);
  });

  it('拒绝非有限的技能伤害加成，不用静默默认值掩盖上游错误', () => {
    expect(() => buildDefaultPlayerSkillKit('kenshi', 120, Number.NaN)).toThrow('有限数');
  });

  it('把持久化技能等级接进主动与被动技能包，未登记项仍为 1 级', () => {
    const skills = skillsFor('swordsman');
    const active = skills.find((skill) => skill.type === 'active' && skill.unlockLevel <= 60)!;
    const passive = skills.find((skill) => skill.type === 'passive' && skill.unlockLevel <= 60)!;
    const kit = buildPlayerSkillKit('swordsman', 60, {
      selectedActiveSkillIds: [active.id],
      skillLevels: { [active.id]: 7, [passive.id]: 5 },
    }).kit;

    expect(kit.active.find((entry) => entry.skill.id === active.id)?.level).toBe(7);
    expect(kit.passives.find((entry) => entry.skill.id === passive.id)?.level).toBe(5);
    expect([...kit.active, ...kit.passives].some((entry) => entry.level === 1)).toBe(true);
  });
});
