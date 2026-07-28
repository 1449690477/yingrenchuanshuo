import type { AffectionRules } from '@/core/affection';

/**
 * 好感数值规则。
 *
 * 四职业使用完全相同的阈值与加护，玩家不必为了战力被迫攻略不喜欢的角色。
 * 互动掉落采用 3% 基础概率、连续 8 次后软保底、第 16 次硬保底。
 */
export const AFFECTION_RULES: AffectionRules = {
  dailyInteractionLimit: 4,
  resetHourCst: 4,
  maxPoints: 99_999,
  gearBaseChance: 0.03,
  gearSoftPityStart: 8,
  gearSoftPityStep: 0.05,
  gearHardPity: 16,
  tiers: [
    { id: 'first-meeting', label: '初见', minPoints: 0, combatBonusRatio: 0 },
    { id: 'familiar', label: '熟络', minPoints: 80, combatBonusRatio: 0.01 },
    { id: 'in-sync', label: '默契', minPoints: 240, combatBonusRatio: 0.02 },
    { id: 'heart-flutter', label: '心动', minPoints: 520, combatBonusRatio: 0.035 },
    { id: 'devoted', label: '倾心', minPoints: 900, combatBonusRatio: 0.05 },
    { id: 'vow', label: '誓约', minPoints: 1_400, combatBonusRatio: 0.07 },
  ],
};
