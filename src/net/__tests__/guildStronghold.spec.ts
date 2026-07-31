import { describe, expect, it } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import {
  claimGuildShopOffer,
  donateGuildMerit,
  fetchGuildStrongholdState,
} from '../guildStronghold';

const validState = {
  seasonId: 's1',
  meritBalance: 5,
  stronghold: {
    progress: 12,
    commissionDays: 1,
    raidClears: 1,
    donatedMerits: 0,
    stageId: 'lantern',
  },
  offers: [
    {
      id: 'sakura-pennant',
      name: '旗印',
      description: '收藏',
      meritCost: 8,
      locked: false,
      claimed: false,
    },
    {
      id: 'moon-lantern',
      name: '月灯',
      description: '收藏',
      meritCost: 18,
      locked: false,
      claimed: false,
    },
    {
      id: 'legend-crest',
      name: '纹章',
      description: '收藏',
      meritCost: 36,
      locked: true,
      claimed: false,
    },
  ],
};

function rpcClient(onCall?: (name: string, args: Record<string, unknown>) => void): SupabaseClient {
  return {
    rpc: async (name: string, args: Record<string, unknown>) => {
      onCall?.(name, args);
      return { data: name === 'guild_get_stronghold_state' ? validState : null, error: null };
    },
  } as unknown as SupabaseClient;
}

describe('guild stronghold network contract', () => {
  it('reads only the server-owned seasonal snapshot', async () => {
    await expect(fetchGuildStrongholdState(rpcClient(), 's1')).resolves.toEqual(validState);
  });

  it('uses idempotent request ids for every server wallet spend', async () => {
    const calls: Array<{ name: string; args: Record<string, unknown> }> = [];
    const client = rpcClient((name, args) => calls.push({ name, args }));
    await donateGuildMerit(client, 's1', 'request-a', 5);
    await claimGuildShopOffer(client, 's1', 'request-b', 'moon-lantern');

    expect(calls).toEqual([
      {
        name: 'guild_donate_merit',
        args: { p_season_id: 's1', p_request_id: 'request-a', p_amount: 5 },
      },
      {
        name: 'guild_claim_shop_offer',
        args: { p_season_id: 's1', p_request_id: 'request-b', p_offer_id: 'moon-lantern' },
      },
    ]);
  });

  it('rejects an incomplete server response rather than inventing a local wallet', async () => {
    const client = {
      rpc: async () => ({ data: { ...validState, offers: [] }, error: null }),
    } as unknown as SupabaseClient;
    await expect(fetchGuildStrongholdState(client, 's1')).rejects.toThrow('无法识别');
  });
});
