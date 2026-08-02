import type { SkillUpgradeRules } from '@/core/skillUpgrade';

/** 全职业共用的技能研习书；章节 BOSS 每次击败固定产出 1 本。 */
export const SKILL_BOOK_ITEM_ID = 'book_skill';

/**
 * M3-5 技能升级成本。
 *
 * 目标等级 2 时为 610 金币、1 本；目标等级 60 时为 232,830 金币、6 本。
 * 前期能尽快感受到成长，后期则形成稳定金币与 BOSS 产物消耗口。
 */
export const SKILL_UPGRADE_RULES = {
  bookItemId: SKILL_BOOK_ITEM_ID,
  goldBase: 180,
  goldExponent: 1.75,
  goldRoundTo: 10,
  bookStepLevels: 10,
} as const satisfies SkillUpgradeRules;
