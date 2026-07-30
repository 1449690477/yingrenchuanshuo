/**
 * arena-candidates Edge Function 的共享 core 打包入口（见 submit-trial/_core-entry.ts）。
 */

export { buildTrialCombatant } from '@/core/trial';
export {
  arenaCandidateRanks,
  arenaCandidateSeed,
  arenaDayKey,
  arenaTierFor,
  buildArenaDuelSide,
  estimateDuelWinChance,
  type DuelSide,
} from '@/core/duel';
export {
  ARENA_DAILY_CHALLENGES,
  ARENA_OPPONENT_CANDIDATES,
  ARENA_OPPONENT_MAX_ABOVE,
  ARENA_REVENGE_WINDOW_HOURS,
} from '@/data/arenaRules';
export { equipmentInstanceSchema } from '@/save/schema';
export { CLASS_IDS } from '@/core/types';
export type { ClassId, EquipmentInstance } from '@/core/types';
