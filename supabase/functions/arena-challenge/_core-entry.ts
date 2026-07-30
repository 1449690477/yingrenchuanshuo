/**
 * arena-challenge Edge Function 的共享 core 打包入口（见 submit-trial/_core-entry.ts）。
 */

export { buildTrialCombatant, trialPlausibilityCap } from '@/core/trial';
export {
  arenaDayKey,
  arenaTierFor,
  arenaVictoryHonor,
  buildArenaDuelSide,
  duelSeed,
  simulateDuel,
  type DuelLogEvent,
  type DuelResult,
  type DuelSide,
} from '@/core/duel';
export {
  ARENA_DAILY_CHALLENGES,
  ARENA_REVENGE_WINDOW_HOURS,
  ARENA_SAME_OPPONENT_DAILY_LIMIT,
  ARENA_STAKES,
} from '@/data/arenaRules';
export { Rng } from '@/core/rng';
export { equipmentInstanceSchema } from '@/save/schema';
export { getEquipment } from '@/data/equipment';
export { SLOT_ORDER } from '@/data/constants';
export { CLASS_IDS } from '@/core/types';
export type { ClassId, EquipmentInstance } from '@/core/types';
