/** 公会据点网络 IO：功勋余额、赛季进度与收藏领取都只由服务端返回。 */

import type { SupabaseClient } from '@supabase/supabase-js';
import { NetRequestError } from './supabase';

export interface GuildStrongholdProgress {
  progress: number;
  commissionDays: number;
  raidClears: number;
  donatedMerits: number;
  stageId: 'camp' | 'lantern' | 'garden' | 'citadel';
}

export interface GuildShopOfferState {
  id: 'sakura-pennant' | 'moon-lantern' | 'legend-crest';
  name: string;
  description: string;
  meritCost: number;
  locked: boolean;
  claimed: boolean;
}

export interface GuildStrongholdState {
  seasonId: string;
  meritBalance: number;
  stronghold: GuildStrongholdProgress;
  offers: GuildShopOfferState[];
}

const STAGE_IDS = new Set<GuildStrongholdProgress['stageId']>([
  'camp',
  'lantern',
  'garden',
  'citadel',
]);
const OFFER_IDS = new Set<GuildShopOfferState['id']>([
  'sakura-pennant',
  'moon-lantern',
  'legend-crest',
]);

function nonNegativeInteger(value: unknown): number {
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed >= 0 ? parsed : 0;
}

function parseOffer(raw: unknown): GuildShopOfferState | null {
  if (!raw || typeof raw !== 'object') return null;
  const row = raw as Record<string, unknown>;
  if (
    typeof row.id !== 'string' ||
    !OFFER_IDS.has(row.id as GuildShopOfferState['id']) ||
    typeof row.name !== 'string' ||
    typeof row.description !== 'string'
  ) {
    return null;
  }
  return {
    id: row.id as GuildShopOfferState['id'],
    name: row.name,
    description: row.description,
    meritCost: nonNegativeInteger(row.meritCost),
    locked: Boolean(row.locked),
    claimed: Boolean(row.claimed),
  };
}

function parseStrongholdState(data: unknown): GuildStrongholdState | null {
  if (!data || typeof data !== 'object') return null;
  const row = data as Record<string, unknown>;
  const stronghold = row.stronghold;
  if (!stronghold || typeof stronghold !== 'object' || typeof row.seasonId !== 'string') {
    throw new NetRequestError('赛季据点读取失败：服务端返回了无法识别的状态');
  }
  const progress = stronghold as Record<string, unknown>;
  const offers = Array.isArray(row.offers)
    ? row.offers.map(parseOffer).filter((item): item is GuildShopOfferState => item !== null)
    : [];
  if (
    !STAGE_IDS.has(progress.stageId as GuildStrongholdProgress['stageId']) ||
    offers.length !== 3
  ) {
    throw new NetRequestError('赛季据点读取失败：服务端返回了无法识别的状态');
  }
  return {
    seasonId: row.seasonId,
    meritBalance: nonNegativeInteger(row.meritBalance),
    stronghold: {
      progress: nonNegativeInteger(progress.progress),
      commissionDays: nonNegativeInteger(progress.commissionDays),
      raidClears: nonNegativeInteger(progress.raidClears),
      donatedMerits: nonNegativeInteger(progress.donatedMerits),
      stageId: progress.stageId as GuildStrongholdProgress['stageId'],
    },
    offers,
  };
}

/** 未部署新后端时由 store 隐藏面板；任何余额和进度都不从本地推断。 */
export async function fetchGuildStrongholdState(
  client: SupabaseClient,
  seasonId: string,
): Promise<GuildStrongholdState | null> {
  const { data, error } = await client.rpc('guild_get_stronghold_state', {
    p_season_id: seasonId,
  });
  if (error) throw new NetRequestError(`赛季据点读取失败：${error.message}`);
  return parseStrongholdState(data);
}

export async function donateGuildMerit(
  client: SupabaseClient,
  seasonId: string,
  requestId: string,
  amount: number,
): Promise<void> {
  const { error } = await client.rpc('guild_donate_merit', {
    p_season_id: seasonId,
    p_request_id: requestId,
    p_amount: amount,
  });
  if (error) throw new NetRequestError(`功勋捐献失败：${error.message}`);
}

export async function claimGuildShopOffer(
  client: SupabaseClient,
  seasonId: string,
  requestId: string,
  offerId: GuildShopOfferState['id'],
): Promise<void> {
  const { error } = await client.rpc('guild_claim_shop_offer', {
    p_season_id: seasonId,
    p_request_id: requestId,
    p_offer_id: offerId,
  });
  if (error) throw new NetRequestError(`公会收藏领取失败：${error.message}`);
}
