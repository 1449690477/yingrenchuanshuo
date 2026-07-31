/** 公会赛季据点纯规则：无网络、无存档、无 UI 副作用。 */

import {
  GUILD_DONATION_AMOUNTS,
  GUILD_MERIT_MAX_PER_CONTRIBUTION,
  GUILD_MERIT_PER_CONTRIBUTION_STEP,
  GUILD_STRONGHOLD_STAGES,
  type GuildStrongholdStage,
} from '@/data/guildStronghold';

/** 只按本次「超过今日最佳」的服务端确认增量换算功勋，重复挑战不会产出。 */
export function guildMeritForContribution(improvedBy: number): number {
  if (!Number.isSafeInteger(improvedBy) || improvedBy < 0 || improvedBy > 1_000) {
    throw new Error(`[公会据点] 新增贡献必须是 0～1000 的安全整数，收到 ${improvedBy}`);
  }
  if (improvedBy === 0) return 0;
  return Math.min(
    GUILD_MERIT_MAX_PER_CONTRIBUTION,
    Math.ceil(improvedBy / GUILD_MERIT_PER_CONTRIBUTION_STEP),
  );
}

export function guildStrongholdStage(progress: number): GuildStrongholdStage {
  if (!Number.isSafeInteger(progress) || progress < 0) {
    throw new Error(`[公会据点] 赛季进度必须是非负安全整数，收到 ${progress}`);
  }
  let stage = GUILD_STRONGHOLD_STAGES[0];
  for (const candidate of GUILD_STRONGHOLD_STAGES) {
    if (progress >= candidate.minProgress) stage = candidate;
  }
  return stage;
}

export function isGuildDonationAmount(amount: number): boolean {
  return Number.isSafeInteger(amount) && GUILD_DONATION_AMOUNTS.includes(amount as 1 | 5 | 10);
}
