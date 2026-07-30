/**
 * arena-daily-settle Edge Function 的共享 core 打包入口（见 submit-trial/_core-entry.ts）。
 */

export { arenaDayKey, arenaTierFor } from '@/core/duel';
export { fnv1a32 } from '@/core/trial';
export { Rng } from '@/core/rng';
export {
  ARENA_DEFENSE_REWARD_BROKEN,
  ARENA_DEFENSE_REWARD_DAILY_CAP,
  ARENA_DEFENSE_REWARD_HELD,
  ARENA_RESET_HOUR_CST,
  ARENA_TIERS,
} from '@/data/arenaRules';
export { ARENA_BOXES } from '@/data/arenaShop';
