/**
 * arena-snapshot Edge Function 的共享 core 打包入口（见 submit-trial/_core-entry.ts）。
 */

export { buildTrialCombatant, trialEquipmentSnapshotIssue } from '@/core/trial';
export { arenaTierFor } from '@/core/duel';
export { ARENA_JOIN_HONOR } from '@/data/arenaRules';
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
