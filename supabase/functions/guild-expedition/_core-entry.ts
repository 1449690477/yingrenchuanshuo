export {
  guildContributionPoints,
  guildDayKey,
  guildExpeditionBoss,
  guildRunSeed,
  guildWeekKey,
} from '@/core/guildExpedition';
export { guildCompletedCommissions } from '@/core/guildCommissions';
export {
  buildTrialCombatant,
  runTrial,
  trialBracketFor,
  trialEquipmentSnapshotIssue,
  trialWeekIndex,
} from '@/core/trial';
export {
  GUILD_DAILY_SUBMISSIONS,
  GUILD_WEEK_CLEAR_REPUTATION,
  GUILD_WEEKLY_TARGET_PER_MEMBER,
} from '@/data/guildRules';
export { TRIAL_SEASON_ID } from '@/data/trialRules';
export { equipmentInstanceSchema } from '@/save/schema';
export { getEquipment } from '@/data/equipment';
export { SLOT_ORDER } from '@/data/constants';
export { CLASS_IDS } from '@/core/types';
export { skillLevelRecordIssues } from '@/core/skillUpgrade';
export type { ClassId, EquipmentInstance } from '@/core/types';

// 档案进度行的唯一构造点：战力与它的公式版本戳同批产出。
// 四个函数曾各自手写这个对象、只有 sync-profile 记得带戳 ——
// 漏戳会留下「合法的戳 + 错尺的数」，筛得过、显示正常、没人看得出错。
export { buildProfileProgress } from '../../../src/core/profileProgress';
