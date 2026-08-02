import { describe, expect, it } from 'vitest';
import { skillsFor } from '@/data/skills';
import { SKILL_BOOK_ITEM_ID, SKILL_UPGRADE_RULES } from '@/data/skillUpgradeRules';
import {
  assessSkillUpgrade,
  planSkillUpgrade,
  skillLevelCap,
  skillLevelOf,
  skillLevelRecordIssues,
  skillUpgradeCost,
} from '../skillUpgrade';

const skill = skillsFor('swordsman').find((entry) => entry.unlockLevel === 4)!;

describe('技能升级', () => {
  it('等级上限始终至少为 1，并按角色等级的一半向下取整', () => {
    expect(skillLevelCap(1)).toBe(1);
    expect(skillLevelCap(69)).toBe(34);
    expect(skillLevelCap(120)).toBe(60);
  });

  it('未持久化的技能为 1 级，成本随目标等级按配置成长', () => {
    expect(skillLevelOf({}, skill.id)).toBe(1);
    expect(skillUpgradeCost(1, SKILL_UPGRADE_RULES)).toEqual({
      gold: 610,
      bookItemId: SKILL_BOOK_ITEM_ID,
      books: 1,
    });
    expect(skillUpgradeCost(10, SKILL_UPGRADE_RULES).books).toBe(2);
    expect(skillUpgradeCost(59, SKILL_UPGRADE_RULES)).toEqual({
      gold: 232_830,
      bookItemId: SKILL_BOOK_ITEM_ID,
      books: 6,
    });
  });

  it('未解锁、到上限、缺书、缺金币按固定优先级给出原因', () => {
    const wallet = { gold: 1_000_000, items: { [SKILL_BOOK_ITEM_ID]: 99 } };
    expect(assessSkillUpgrade(skill, 3, {}, wallet, SKILL_UPGRADE_RULES).reason).toBe(
      'skill-locked',
    );
    expect(
      assessSkillUpgrade(skill, 4, { [skill.id]: 2 }, wallet, SKILL_UPGRADE_RULES).reason,
    ).toBe('level-cap');
    expect(
      assessSkillUpgrade(skill, 20, {}, { gold: 1_000_000, items: {} }, SKILL_UPGRADE_RULES).reason,
    ).toBe('insufficient-books');
    expect(
      assessSkillUpgrade(
        skill,
        20,
        {},
        { gold: 0, items: { [SKILL_BOOK_ITEM_ID]: 99 } },
        SKILL_UPGRADE_RULES,
      ).reason,
    ).toBe('insufficient-gold');
  });

  it('成功计划同时升级技能并精确扣除两类资产，且不修改输入', () => {
    const levels = { [skill.id]: 9 };
    const wallet = { gold: 100_000, items: { [SKILL_BOOK_ITEM_ID]: 5, petal_sakura: 3 } };
    const plan = planSkillUpgrade(skill, 40, levels, wallet, SKILL_UPGRADE_RULES);
    expect(plan).not.toBeNull();
    expect(plan!.assessment.targetLevel).toBe(10);
    expect(plan!.skillLevels[skill.id]).toBe(10);
    expect(plan!.wallet.gold).toBe(wallet.gold - plan!.assessment.cost.gold);
    expect(plan!.wallet.items).toEqual({ [SKILL_BOOK_ITEM_ID]: 4, petal_sakura: 3 });
    expect(levels[skill.id]).toBe(9);
    expect(wallet.items[SKILL_BOOK_ITEM_ID]).toBe(5);
  });

  it('被阻挡时不生成可误提交的资产状态', () => {
    expect(planSkillUpgrade(skill, 20, {}, { gold: 0, items: {} }, SKILL_UPGRADE_RULES)).toBeNull();
  });

  it('存档与联机共用等级快照上限，不把当前技能总数写死成协议', () => {
    expect(skillLevelRecordIssues({ known: 20 }, 40)).toEqual([]);
    expect(skillLevelRecordIssues({ impossible: 21 }, 40)[0]).toMatchObject({
      skillId: 'impossible',
    });
    const oversized = Object.fromEntries(
      Array.from({ length: 257 }, (_, index) => [`retired_${index}`, 1]),
    );
    expect(skillLevelRecordIssues(oversized, 40)[0]).toMatchObject({ skillId: null });
  });
});
