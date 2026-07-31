import { describe, expect, it } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import { fetchGuildCommissionState } from '../guildCommissions';
import { NetRequestError } from '../supabase';

function rpcClient(result: { data: unknown; error: unknown }): SupabaseClient {
  return { rpc: async () => result } as unknown as SupabaseClient;
}

const validState = {
  dayKey: '2026-08-01',
  commissions: [
    {
      id: 'expedition-entry',
      name: '远征集结',
      description: '完成一次公会远征',
      contribution: 80,
    },
  ],
  progress: 80,
  target: 1800,
  completed: false,
  participants: 1,
  completedCommissionIds: ['expedition-entry'],
};

describe('fetchGuildCommissionState', () => {
  it('只读取服务端状态，不携带玩家资产或可写贡献参数', async () => {
    const state = await fetchGuildCommissionState(rpcClient({ data: validState, error: null }));
    expect(state).toEqual(validState);
  });

  it('没有委托状态时保持空值，供旧后端柔和降级', async () => {
    await expect(
      fetchGuildCommissionState(rpcClient({ data: null, error: null })),
    ).resolves.toBeNull();
  });

  it('拒绝缺少委托卡片的畸形响应，避免 UI 猜测奖励或进度', async () => {
    await expect(
      fetchGuildCommissionState(
        rpcClient({ data: { ...validState, commissions: [], target: 0 }, error: null }),
      ),
    ).rejects.toThrow('无法识别');
  });

  it('服务端拒绝请求时保留诊断信息', async () => {
    await expect(
      fetchGuildCommissionState(rpcClient({ data: null, error: new Error('permission denied') })),
    ).rejects.toThrow(NetRequestError);
    await expect(
      fetchGuildCommissionState(rpcClient({ data: null, error: new Error('permission denied') })),
    ).rejects.toThrow('permission denied');
  });
});
