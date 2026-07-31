/**
 * submit-trial Edge Function 的共享 core 打包入口。
 *
 * 本文件是 scripts/build-edge-function.mjs 的 esbuild 入口：
 * 把「服务端复算」需要的同一份 src/core 实现打成一个自包含文件
 * _core.ts（生成物，不进 git），index.ts 再以 Deno 方式 import 它。
 *
 * 只导出函数真正用到的符号，摇树优化会剪掉其余部分。
 */

export {
  buildTrialCombatant,
  canonicalBuildHash,
  decideTrialScoreWrite,
  runTrial,
  trialBracketFor,
  trialEquipmentSnapshotIssue,
  trialScoreSeed,
  trialWeekIndex,
  weeklyTrialBoss,
  type TrialBuild,
  type TrialScoreWriteDecision,
  type TrialRunResult,
} from '@/core/trial';
export { equipmentInstanceSchema } from '@/save/schema';
export { getEquipment } from '@/data/equipment';
export { TRIAL_SEASON_ID } from '@/data/trialRules';
export { SLOT_ORDER } from '@/data/constants';
export { CLASS_IDS } from '@/core/types';
export type { ClassId, EquipmentInstance } from '@/core/types';

// 试炼伤害物理上界（docs/78 §六）。**必须用权威等级（profiles.level）判**，
// 不能用本次提交自报的等级 —— 那正是 2026-07-30 被伪造的那个值。
export { isPlausibleTrialDamage, trialDamageCeiling } from '@/core/trialBound';

// 作弊证据分级与行构造（与 sync-profile 同一套闸门与措辞）
export {
  buildCheatEvidenceRow,
  judgeCheatEvidence,
  type CheatEvidenceInput,
} from '@/core/cheatEvidence';
