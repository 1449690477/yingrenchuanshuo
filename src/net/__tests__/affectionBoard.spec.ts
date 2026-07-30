/**
 * 羁绊榜网络层的契约测试（桩客户端，不打真实网络）。
 *
 * 最重要的契约：**载荷里没有总分与名次**。
 * 客户端发的是各角色快照 { points, totalInteractions, storyCount }，
 * 「我的总分、第几名」只能由服务端产生 —— 与试炼榜「提交里不能有伤害」
 * 同一条原则（docs/63 §三）。
 */

import { describe, expect, it } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import { fetchAffectionBoard, submitAffectionReport } from '../affectionBoard';
import { NetRequestError } from '../supabase';

function invokeStub(
  handler: (name: string, opts: { body: unknown }) => { data: unknown; error: unknown },
) {
  const calls: { name: string; body: unknown }[] = [];
  const client = {
    functions: {
      invoke: async (name: string, opts: { body: unknown }) => {
        calls.push({ name, body: opts.body });
        return handler(name, opts);
      },
    },
  } as unknown as SupabaseClient;
  return { client, calls };
}

const HONEST = {
  swordsman: { points: 100, totalInteractions: 10, storyCount: 1 },
  witch: { points: 60, totalInteractions: 6, storyCount: 1 },
};

describe('submitAffectionReport', () => {
  it('载荷只有 characters 快照，没有总分 / 名次 / updated', async () => {
    const { client, calls } = invokeStub(() => ({
      data: { updated: true, affectionTotal: 160, rank: 3, total: 12 },
      error: null,
    }));

    const result = await submitAffectionReport(client, HONEST);

    expect(calls[0]!.name).toBe('submit-affection');
    const body = calls[0]!.body as Record<string, unknown>;
    expect(Object.keys(body)).toEqual(['characters']);
    const characters = body.characters as Record<string, Record<string, number>>;
    expect(Object.keys(characters.swordsman!).sort()).toEqual([
      'points',
      'storyCount',
      'totalInteractions',
    ]);
    expect(result).toEqual({ updated: true, affectionTotal: 160, rank: 3, total: 12 });
  });

  it('触下界时如实返回 updated:false，不当成失败抛错', async () => {
    // 服务端对不合理快照静默拒绝（200 + updated:false），不给造假者边界信息。
    const { client } = invokeStub(() => ({
      data: { updated: false, affectionTotal: null, rank: 0, total: 0 },
      error: null,
    }));

    const result = await submitAffectionReport(client, {
      swordsman: { points: 99999, totalInteractions: 1, storyCount: 0 },
    });

    expect(result.updated).toBe(false);
    expect(result.affectionTotal).toBeNull();
    expect(result.rank).toBe(0);
  });

  it('只升不降后服务端给的是账号实际总分，不是本次提交值', async () => {
    const { client } = invokeStub(() => ({
      data: { updated: true, affectionTotal: 320, rank: 1, total: 5 },
      error: null,
    }));

    const result = await submitAffectionReport(client, HONEST);

    expect(result.affectionTotal).toBe(320);
  });

  it('服务端 4xx 的中文原因透出来，而不是笼统的 non-2xx', async () => {
    const { client } = invokeStub(() => ({
      data: null,
      error: {
        message: 'Edge Function returned a non-2xx status code',
        context: new Response(JSON.stringify({ error: '提交的心意快照不合法' }), { status: 400 }),
      },
    }));

    await expect(submitAffectionReport(client, HONEST)).rejects.toThrow('提交的心意快照不合法');
  });

  it('网络失败翻译成人话', async () => {
    const { client } = invokeStub(() => ({ data: null, error: new Error('Failed to fetch') }));

    await expect(submitAffectionReport(client, HONEST)).rejects.toThrow(NetRequestError);
    await expect(submitAffectionReport(client, HONEST)).rejects.toThrow('网络连接失败');
  });

  it('返回体缺 updated 字段时按无法识别处理', async () => {
    const { client } = invokeStub(() => ({ data: { rank: 1 }, error: null }));

    await expect(submitAffectionReport(client, HONEST)).rejects.toThrow('无法识别');
  });
});

describe('fetchAffectionBoard', () => {
  interface QueryLog {
    filters: [string, unknown][];
    orders: { column: string; ascending: boolean }[];
    limit?: number;
  }

  function boardStub(rows: unknown[]) {
    const log: QueryLog = { filters: [], orders: [] };
    const builder: Record<string, unknown> = {};
    Object.assign(builder, {
      select: () => builder,
      gt: (column: string, value: unknown) => {
        log.filters.push([column, value]);
        return builder;
      },
      order: (column: string, opts: { ascending: boolean }) => {
        log.orders.push({ column, ascending: opts.ascending });
        return builder;
      },
      limit: (n: number) => {
        log.limit = n;
        return Promise.resolve({ data: rows, error: null });
      },
    });
    const client = { from: () => builder } as unknown as SupabaseClient;
    return { client, log };
  }

  it('只取有心意的账号（>0），按总分降序、同分先达者在前', async () => {
    const { client, log } = boardStub([]);

    await fetchAffectionBoard(client, 'me-1');

    expect(log.filters).toEqual([['affection_total', 0]]);
    expect(log.orders).toEqual([
      { column: 'affection_total', ascending: false },
      { column: 'updated_at', ascending: true },
    ]);
  });

  it('名次按返回顺序生成，isMe 只认自己', async () => {
    const { client } = boardStub([
      { id: 'a', display_name: '甲', avatar_url: null, class_id: 'witch', affection_total: 900 },
      { id: 'me-1', display_name: '我', avatar_url: 'x', class_id: 'catkin', affection_total: 500 },
    ]);

    const rows = await fetchAffectionBoard(client, 'me-1');

    expect(rows.map((r) => r.rank)).toEqual([1, 2]);
    expect(rows.map((r) => r.isMe)).toEqual([false, true]);
    expect(rows[1]!.affectionTotal).toBe(500);
    expect(rows[1]!.avatarUrl).toBe('x');
  });

  it('总分是数字，即便数据库把 bigint 给成字符串', async () => {
    const { client } = boardStub([
      { id: 'a', display_name: '甲', avatar_url: null, class_id: 'witch', affection_total: '12345' },
    ]);

    const rows = await fetchAffectionBoard(client, null);

    expect(rows[0]!.affectionTotal).toBe(12345);
    expect(typeof rows[0]!.affectionTotal).toBe('number');
  });
});
