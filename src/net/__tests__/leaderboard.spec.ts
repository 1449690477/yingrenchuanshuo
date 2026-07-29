/**
 * 排行榜网络层的契约测试（用桩客户端，不打真实网络）。
 *
 * 最重要的契约：提交载荷里不存在伤害字段 —— docs/51 验收第一条
 * 「客户端提交伤害数字必须不可能」。类型系统已经在编译期锁死，
 * 这里再在运行期显式断言一次，防止未来有人把 damage 塞进 body。
 */

import { describe, expect, it, vi } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import { submitTrialScore, upsertProfile, type TrialSubmission } from '../leaderboard';
import { NetRequestError } from '../supabase';

type InvokeStub = (
  name: string,
  opts: { body: unknown },
) => Promise<{ data: unknown; error: unknown }>;

function stubClient(invoke: InvokeStub): SupabaseClient {
  return { functions: { invoke } } as unknown as SupabaseClient;
}

const submission: TrialSubmission = {
  seasonId: 's1',
  weekIndex: 30,
  bracketId: 'feiyue',
  classId: 'swordsman',
  level: 45,
  displayName: '夜见',
  equipped: [null, null, null, null, null, null, null, null],
};

describe('submitTrialScore', () => {
  it('载荷只有搭配快照，没有任何伤害字段', async () => {
    let receivedBody: unknown;
    const client = stubClient(async (_name: string, opts: { body: unknown }) => {
      receivedBody = opts.body;
      return {
        data: { damage: 142_000, rank: 313, total: 5211, verified: true, improved: true },
        error: null,
      };
    });

    const result = await submitTrialScore(client, submission);

    const keys = Object.keys(receivedBody as Record<string, unknown>);
    expect(keys).not.toContain('damage');
    expect(keys).not.toContain('score');
    expect(keys).not.toContain('clientDamage');
    expect(result).toEqual({
      damage: 142_000,
      rank: 313,
      total: 5211,
      verified: true,
      improved: true,
    });
  });

  it('服务端报错时翻译成玩家能看懂的异常', async () => {
    const client = stubClient(async () => ({ data: null, error: new Error('Failed to fetch') }));
    await expect(submitTrialScore(client, submission)).rejects.toThrow(NetRequestError);
    await expect(submitTrialScore(client, submission)).rejects.toThrow('网络连接失败');
  });

  it('响应缺字段时拒绝猜测，直接报错', async () => {
    const client = stubClient(async () => ({ data: { damage: 1 }, error: null }));
    await expect(submitTrialScore(client, submission)).rejects.toThrow('无法识别');
  });

  it('成绩不为负数（防御服务端异常值）', async () => {
    const client = stubClient(async () => ({
      data: { damage: -50, rank: 1, total: 1, verified: true, improved: false },
      error: null,
    }));
    const result = await submitTrialScore(client, submission);
    expect(result.damage).toBe(0);
  });

  it('调用的是 submit-trial 函数', async () => {
    const invoke = vi.fn(async () => ({
      data: { damage: 1, rank: 1, total: 1, verified: true, improved: false },
      error: null,
    }));
    await submitTrialScore(stubClient(invoke), submission);
    expect(invoke).toHaveBeenCalledWith(
      'submit-trial',
      expect.objectContaining({ body: submission }),
    );
  });
});

describe('upsertProfile', () => {
  it('只在首次建档时使用角色名，已有档案同步不再覆盖玩家自设昵称', async () => {
    const eq = vi.fn(async (_column: string, _value: string) => ({ error: null }));
    const update = vi.fn((_patch: Record<string, unknown>) => ({ eq }));
    const upsert = vi.fn(async () => ({ error: null }));
    const client = {
      from: vi.fn(() => ({ upsert, update })),
    } as unknown as SupabaseClient;

    await upsertProfile(client, {
      id: 'user-1',
      displayName: '剑姬角色名',
      classId: 'swordsman',
      level: 45,
      combatPower: 123_456,
    });

    expect(upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'user-1',
        display_name: '剑姬角色名',
      }),
      { onConflict: 'id', ignoreDuplicates: true },
    );
    const progressPatch = update.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(progressPatch).toMatchObject({
      class_id: 'swordsman',
      level: 45,
      combat_power: 123_456,
    });
    expect(progressPatch).not.toHaveProperty('display_name');
    expect(eq).toHaveBeenCalledWith('id', 'user-1');
  });
});
