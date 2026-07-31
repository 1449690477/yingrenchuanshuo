/**
 * 进度榜网络层的契约测试（桩客户端，不打真实网络）。
 *
 * 最重要的契约：**载荷里没有序号、名次与 verified**。
 * 客户端发的是 { stageId, firstClearedAt }，「第几关的序号、第几名、
 * 可不可信」只能由服务端产生 —— 与试炼榜「提交里不能有伤害」同一条
 * 原则（docs/63 §五）。
 */

import { describe, expect, it } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import { fetchProgressBoard, submitProgressReport } from '../progressBoard';
import { NetRequestError } from '../supabase';
import { ORDERED_STAGE_IDS } from '@/data/stages';

const FIRST = ORDERED_STAGE_IDS[0]!;

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

const CLAIM = { stageId: FIRST, firstClearedAt: 1_780_000_000_000 };

describe('submitProgressReport', () => {
  it('载荷只有 stageId 与 firstClearedAt，没有序号 / 名次 / verified', async () => {
    const { client, calls } = invokeStub(() => ({
      data: {
        updated: true,
        deepestStageId: FIRST,
        deepestStageIndex: 0,
        firstClearedAt: 1_780_000_000_000,
        verified: true,
        rank: 1,
        total: 3,
      },
      error: null,
    }));

    const result = await submitProgressReport(client, CLAIM);

    expect(calls[0]!.name).toBe('submit-progress');
    expect(Object.keys(calls[0]!.body as Record<string, unknown>).sort()).toEqual([
      'firstClearedAt',
      'stageId',
    ]);
    expect(result).toEqual({
      updated: true,
      deepestStageId: FIRST,
      deepestStageIndex: 0,
      firstClearedAt: 1_780_000_000_000,
      verified: true,
      rank: 1,
      total: 3,
    });
  });

  it('另一设备报过更深时如实返回 updated:false，不当成失败抛错', async () => {
    const deeper = ORDERED_STAGE_IDS[7]!;
    const { client } = invokeStub(() => ({
      data: {
        updated: false,
        deepestStageId: deeper,
        deepestStageIndex: 7,
        firstClearedAt: null,
        verified: true,
        rank: 2,
        total: 9,
      },
      error: null,
    }));

    const result = await submitProgressReport(client, CLAIM);

    expect(result.updated).toBe(false);
    expect(result.deepestStageId).toBe(deeper);
    expect(result.rank).toBe(2);
  });

  it('未通过校验的回执 verified:false 如实映射（软旗标不是错误）', async () => {
    const { client } = invokeStub(() => ({
      data: {
        updated: true,
        deepestStageId: FIRST,
        deepestStageIndex: 0,
        firstClearedAt: null,
        verified: false,
        rank: 0,
        total: 5,
      },
      error: null,
    }));

    const result = await submitProgressReport(client, { stageId: FIRST, firstClearedAt: null });

    expect(result.verified).toBe(false);
    expect(result.rank).toBe(0);
    expect(result.firstClearedAt).toBeNull();
  });

  it('服务端 4xx 的中文原因透出来，而不是笼统的 non-2xx', async () => {
    const { client } = invokeStub(() => ({
      data: null,
      error: {
        message: 'Edge Function returned a non-2xx status code',
        context: new Response(JSON.stringify({ error: '进度快照的数值超出合法范围' }), {
          status: 400,
        }),
      },
    }));

    await expect(submitProgressReport(client, CLAIM)).rejects.toThrow(
      '进度快照的数值超出合法范围',
    );
  });

  it('网络失败翻译成人话', async () => {
    const { client } = invokeStub(() => ({ data: null, error: new Error('Failed to fetch') }));

    await expect(submitProgressReport(client, CLAIM)).rejects.toThrow(NetRequestError);
    await expect(submitProgressReport(client, CLAIM)).rejects.toThrow('网络连接失败');
  });

  it('返回体缺关键字段时按无法识别处理', async () => {
    const { client } = invokeStub(() => ({ data: { rank: 1 }, error: null }));

    await expect(submitProgressReport(client, CLAIM)).rejects.toThrow('无法识别');
  });
});

describe('fetchProgressBoard', () => {
  interface QueryLog {
    filters: [string, unknown][];
    orders: { column: string; ascending: boolean; nullsFirst?: boolean }[];
    limit?: number;
  }

  function boardStub(rows: unknown[]) {
    const log: QueryLog = { filters: [], orders: [] };
    const builder: Record<string, unknown> = {};
    Object.assign(builder, {
      select: () => builder,
      eq: (column: string, value: unknown) => {
        log.filters.push([column, value]);
        return builder;
      },
      order: (column: string, opts: { ascending: boolean; nullsFirst?: boolean }) => {
        log.orders.push({ column, ascending: opts.ascending, nullsFirst: opts.nullsFirst });
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

  it('只取 verified 行，最深降序、同深最早升序、无时刻排最后', async () => {
    const { client, log } = boardStub([]);

    await fetchProgressBoard(client, 'me-1');

    expect(log.filters).toEqual([['verified', true]]);
    expect(log.orders).toEqual([
      { column: 'deepest_stage_index', ascending: false, nullsFirst: undefined },
      { column: 'deepest_stage_at', ascending: true, nullsFirst: false },
    ]);
  });

  it('行映射：名次按返回顺序，isMe 只认自己，时刻从 ISO 转 epoch ms', async () => {
    const { client } = boardStub([
      {
        user_id: 'a',
        deepest_stage_id: ORDERED_STAGE_IDS[9],
        deepest_stage_index: 9,
        deepest_stage_at: '2026-06-01T04:00:00.000Z',
        profiles: { display_name: '先行者', avatar_url: 'x', class_id: 'witch' },
      },
      {
        user_id: 'me-1',
        deepest_stage_id: ORDERED_STAGE_IDS[9],
        deepest_stage_index: 9,
        deepest_stage_at: null,
        profiles: { display_name: '我', avatar_url: null, class_id: 'swordsman' },
      },
    ]);

    const rows = await fetchProgressBoard(client, 'me-1');

    expect(rows.map((r) => r.rank)).toEqual([1, 2]);
    expect(rows.map((r) => r.isMe)).toEqual([false, true]);
    expect(rows[0]!.firstClearedAt).toBe(Date.parse('2026-06-01T04:00:00.000Z'));
    expect(rows[1]!.firstClearedAt).toBeNull();
    expect(rows[0]!.stageName).toBeTruthy();
  });

  it('档案缺失的行给占位名与默认立绘职业，不炸榜', async () => {
    const { client } = boardStub([
      {
        user_id: 'ghost',
        deepest_stage_id: FIRST,
        deepest_stage_index: 0,
        deepest_stage_at: null,
        profiles: null,
      },
    ]);

    const rows = await fetchProgressBoard(client, null);

    expect(rows[0]!.displayName).toBe('无名旅人');
    expect(rows[0]!.classId).toBe('swordsman');
    expect(rows[0]!.avatarUrl).toBeNull();
  });

  it('PostgREST embed 给数组形状也接得住', async () => {
    const { client } = boardStub([
      {
        user_id: 'a',
        deepest_stage_id: FIRST,
        deepest_stage_index: 0,
        deepest_stage_at: null,
        profiles: [{ display_name: '数组形', avatar_url: null, class_id: 'catkin' }],
      },
    ]);

    const rows = await fetchProgressBoard(client, null);

    expect(rows[0]!.displayName).toBe('数组形');
    expect(rows[0]!.classId).toBe('catkin');
  });
});
