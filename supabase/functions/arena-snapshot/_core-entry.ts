/**
 * arena-snapshot Edge Function 的共享 core 打包入口（见 submit-trial/_core-entry.ts）。
 */

export { buildTrialCombatant, trialPlausibilityCap } from '@/core/trial';
export { arenaTierFor } from '@/core/duel';
export { ARENA_JOIN_HONOR } from '@/data/arenaRules';
export { equipmentInstanceSchema } from '@/save/schema';
export { getEquipment } from '@/data/equipment';
export { SLOT_ORDER } from '@/data/constants';
export { CLASS_IDS } from '@/core/types';
export type { ClassId, EquipmentInstance } from '@/core/types';
