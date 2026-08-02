import type { Skill } from './types';

export interface SkillUpgradeRules {
  bookItemId: string;
  /** 金币成本 = base × 目标等级 ^ exponent，再向上取到 roundTo 的整数倍。 */
  goldBase: number;
  goldExponent: number;
  goldRoundTo: number;
  /** 每跨过若干目标等级，单次所需技能书 +1。 */
  bookStepLevels: number;
}

export interface SkillUpgradeWallet {
  gold: number;
  items: Readonly<Record<string, number>>;
}

export interface SkillUpgradeCost {
  gold: number;
  bookItemId: string;
  books: number;
}

export type SkillUpgradeBlockReason =
  'skill-locked' | 'level-cap' | 'insufficient-books' | 'insufficient-gold';

export interface SkillUpgradeAssessment {
  skillId: string;
  currentLevel: number;
  targetLevel: number;
  levelCap: number;
  cost: SkillUpgradeCost;
  ownedGold: number;
  ownedBooks: number;
  reason: SkillUpgradeBlockReason | null;
}

export interface SkillUpgradePlan {
  assessment: SkillUpgradeAssessment;
  skillLevels: Record<string, number>;
  wallet: { gold: number; items: Record<string, number> };
}

/**
 * 联机请求与存档允许保留少量已经改名的旧技能 id，但拒绝异常膨胀的对象。
 * 这是载荷结构上限，不是当前技能数量；因此不会在新增职业时跟着内容表漂移。
 */
export const MAX_PERSISTED_SKILL_LEVELS = 256;

export interface SkillLevelRecordIssue {
  skillId: string | null;
  message: string;
}

/** 技能至少为 1 级；Lv1 角色不会得到“上限 0”这种无效状态。 */
export function skillLevelCap(playerLevel: number): number {
  if (!Number.isSafeInteger(playerLevel) || playerLevel < 1) {
    throw new Error(`skillLevelCap: 角色等级必须是 >= 1 的整数，收到 ${playerLevel}`);
  }
  return Math.max(1, Math.floor(playerLevel / 2));
}

/** 未持久化的技能按 1 级解释；存档只记录真正升过级的条目。 */
export function skillLevelOf(
  skillLevels: Readonly<Record<string, number>>,
  skillId: string,
): number {
  const level = skillLevels[skillId] ?? 1;
  if (!Number.isSafeInteger(level) || level < 1) {
    throw new Error(`skillLevelOf: ${skillId} 的技能等级非法：${level}`);
  }
  return level;
}

/** 存档与四个 Edge Function 共用的技能等级快照校验。 */
export function skillLevelRecordIssues(
  skillLevels: Readonly<Record<string, number>>,
  playerLevel: number,
): readonly SkillLevelRecordIssue[] {
  const entries = Object.entries(skillLevels);
  const issues: SkillLevelRecordIssue[] = [];
  if (entries.length > MAX_PERSISTED_SKILL_LEVELS) {
    issues.push({
      skillId: null,
      message: `技能等级条目不能超过 ${MAX_PERSISTED_SKILL_LEVELS} 个`,
    });
  }
  const cap = skillLevelCap(playerLevel);
  for (const [skillId, level] of entries) {
    if (!Number.isSafeInteger(level) || level < 1) {
      issues.push({ skillId, message: '技能等级必须是 >= 1 的整数' });
    } else if (level > cap) {
      issues.push({ skillId, message: `技能等级 ${level} 超过角色等级允许上限 ${cap}` });
    }
  }
  return issues;
}

export function skillUpgradeCost(currentLevel: number, rules: SkillUpgradeRules): SkillUpgradeCost {
  if (!Number.isSafeInteger(currentLevel) || currentLevel < 1) {
    throw new Error(`skillUpgradeCost: 当前技能等级必须是 >= 1 的整数，收到 ${currentLevel}`);
  }
  assertRules(rules);
  const targetLevel = currentLevel + 1;
  return {
    gold:
      Math.ceil((rules.goldBase * targetLevel ** rules.goldExponent) / rules.goldRoundTo) *
      rules.goldRoundTo,
    bookItemId: rules.bookItemId,
    books: Math.ceil(targetLevel / rules.bookStepLevels),
  };
}

/**
 * 技能升级的唯一判定点。只读输入、不消耗资产，UI 报价与 store 提交必须共用。
 */
export function assessSkillUpgrade(
  skill: Skill,
  playerLevel: number,
  skillLevels: Readonly<Record<string, number>>,
  wallet: SkillUpgradeWallet,
  rules: SkillUpgradeRules,
): SkillUpgradeAssessment {
  const currentLevel = skillLevelOf(skillLevels, skill.id);
  const levelCap = skillLevelCap(playerLevel);
  if (currentLevel > levelCap) {
    throw new Error(
      `assessSkillUpgrade: ${skill.id} 等级 ${currentLevel} 超过角色等级允许上限 ${levelCap}`,
    );
  }
  if (!Number.isSafeInteger(wallet.gold) || wallet.gold < 0) {
    throw new Error(`assessSkillUpgrade: 金币必须是非负整数，收到 ${wallet.gold}`);
  }

  const cost = skillUpgradeCost(currentLevel, rules);
  const ownedBooks = wallet.items[cost.bookItemId] ?? 0;
  if (!Number.isSafeInteger(ownedBooks) || ownedBooks < 0) {
    throw new Error(`assessSkillUpgrade: 技能书数量必须是非负整数，收到 ${ownedBooks}`);
  }

  let reason: SkillUpgradeBlockReason | null = null;
  if (playerLevel < skill.unlockLevel) reason = 'skill-locked';
  else if (currentLevel >= levelCap) reason = 'level-cap';
  else if (ownedBooks < cost.books) reason = 'insufficient-books';
  else if (wallet.gold < cost.gold) reason = 'insufficient-gold';

  return {
    skillId: skill.id,
    currentLevel,
    targetLevel: currentLevel + 1,
    levelCap,
    cost,
    ownedGold: wallet.gold,
    ownedBooks,
    reason,
  };
}

/**
 * 规划一次升级的完整资产变化。失败直接返回 null，调用方不得先扣材料再计算结果。
 */
export function planSkillUpgrade(
  skill: Skill,
  playerLevel: number,
  skillLevels: Readonly<Record<string, number>>,
  wallet: SkillUpgradeWallet,
  rules: SkillUpgradeRules,
): SkillUpgradePlan | null {
  const assessment = assessSkillUpgrade(skill, playerLevel, skillLevels, wallet, rules);
  if (assessment.reason) return null;

  return {
    assessment,
    skillLevels: { ...skillLevels, [skill.id]: assessment.targetLevel },
    wallet: {
      gold: wallet.gold - assessment.cost.gold,
      items: {
        ...wallet.items,
        [assessment.cost.bookItemId]: assessment.ownedBooks - assessment.cost.books,
      },
    },
  };
}

function assertRules(rules: SkillUpgradeRules): void {
  if (!rules.bookItemId) throw new Error('skillUpgradeCost: bookItemId 不能为空');
  for (const [name, value] of Object.entries({
    goldBase: rules.goldBase,
    goldExponent: rules.goldExponent,
    goldRoundTo: rules.goldRoundTo,
    bookStepLevels: rules.bookStepLevels,
  })) {
    if (!Number.isFinite(value) || value <= 0) {
      throw new Error(`skillUpgradeCost: ${name} 必须是正数，收到 ${value}`);
    }
  }
  if (!Number.isSafeInteger(rules.goldRoundTo) || !Number.isSafeInteger(rules.bookStepLevels)) {
    throw new Error('skillUpgradeCost: 取整档和技能书档位必须是正整数');
  }
}
