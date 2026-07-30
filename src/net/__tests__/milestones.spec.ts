/**
 * 登顶速度榜网络层的契约测试（桩客户端，不打真实网络）。
 *
 * 最重要的契约：**载荷里不存在 verified 与 rank**。
 * 客户端连「我是否入榜、第几名」都无权自称 —— 与试炼榜「提交里不能有伤害」
 * 同一条原则（docs/51 验收）。
 */

import { describe, expect, it } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import { fetchMilestoneBoard, submitMilestone } from '../milestones';
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

describe('submitMilestone', () => {
  it('载荷只有 level 与 elapsedMs，没有 verified / rank', async () => {
    const { client, calls } = invokeStub(() => ({
      data: { level: 40, elapsedMs: 700_000_000, verified: true, alreadyRecorded: false },
      error: null,
    }));

    const result = await submitMilestone(client, { level: 40, elapsedMs: 700_000_000 });

    const keys = Object.keys(calls[0]!.body as Record<string, unknown>);
    expect(keys.sort()).toEqual(['elapsedMs', 'level']);
    expect(keys).not.toContain('verified');
    expect(keys).not.toContain('rank');
    expect(result).toEqual({
      level: 40,
      elapsedMs: 700_000_000,
      verified: true,
      alreadyRecorded: false,
    });
  });

  it('verified 缺省时按 false 处理，不许「没说就算通过」', async () => {
    const { client } = invokeStub(() => ({ data: { level: 20, elapsedMs: 99 }, error: null }));

    const result = await submitMilestone(client, { level: 20, elapsedMs: 99 });

    expect(result.verified).toBe(false);
  });

  it('服务端已有记录时按成功返回，并带上 alreadyRecorded', async () => {
    // 多设备或断网重试下重复提交是正常路径，不该报错给玩家看。
    const { client } = invokeStub(() => ({
      data: { level: 60, elapsedMs: 1_000_000, verified: true, alreadyRecorded: true },
      error: null,
    }));

    const result = await submitMilestone(client, { level: 60, elapsedMs: 2_000_000 });

    expect(result.alreadyRecorded).toBe(true);
    // 用时以服务端已有记录为准，不是我这次报的那个
    expect(result.elapsedMs).toBe(1_000_000);
  });

  it('服务端业务错误翻译成玩家能看懂的异常', async () => {
    const { client } = invokeStub(() => ({
      data: { error: '当前等级尚未达到该里程碑' },
      error: null,
    }));

    await expect(submitMilestone(client, { level: 60, elapsedMs: 999 })).rejects.toThrow(
      NetRequestError,
    );
    await expect(submitMilestone(client, { level: 60, elapsedMs: 999 })).rejects.toThrow(
      '当前等级尚未达到该里程碑',
    );
  });

  it('网络失败翻译成人话', async () => {
    const { client } = invokeStub(() => ({ data: null, error: new Error('Failed to fetch') }));

    await expect(submitMilestone(client, { level: 20, elapsedMs: 999 })).rejects.toThrow(
      '网络连接失败',
    );
  });
});

describe('fetchMilestoneBoard', () => {
  interface QueryLog {
    filters: [string, unknown][];
    order?: { column: string; ascending: boolean };
    limit?: number;
  }

  function boardStub(rows: unknown[]) {
    const log: QueryLog = { filters: [] };
    const builder: Record<string, unknown> = {};
    // 链式查询桩：每一环都返回自己，最后 await 时给出 rows
    const chain = () => builder;
    Object.assign(builder, {
      select: chain,
      eq: (column: string, value: unknown) => {
        log.filters.push([column, value]);
        return builder;
      },
      order: (column: string, opts: { ascending: boolean }) => {
        log.order = { column, ascending: opts.ascending };
        return builder;
      },
      limit: (n: number) => {
        log.limit = n;
        return Promise.resolve({ data: rows, error: null });
      },
      // 补身份信息的那次查询走 in()
      in: async () => ({ data: [], error: null }),
    });
    const client = { from: () => builder } as unknown as SupabaseClient;
    return { client, log };
  }

  it('只取该档位且 verified 的记录，按用时升序', async () => {
    const { client, log } = boardStub([]);

    await fetchMilestoneBoard(client, 40, 'me-1');

    expect(log.filters).toEqual([
      ['milestone', 40],
      ['verified', true],
    ]);
    expect(log.order).toEqual({ column: 'elapsed_ms', ascending: true });
  });

  it('名次按返回顺序生成，isMe 只认自己', async () => {
    const { client } = boardStub([
      { user_id: 'a', elapsed_ms: 100, profiles: { display_name: '甲', class_id: 'witch' } },
      { user_id: 'me-1', elapsed_ms: 200, profiles: { display_name: '我', class_id: 'catkin' } },
      { user_id: 'c', elapsed_ms: 300, profiles: { display_name: '丙', class_id: 'shaman' } },
    ]);

    const rows = await fetchMilestoneBoard(client, 40, 'me-1');

    expect(rows.map((r) => r.rank)).toEqual([1, 2, 3]);
    expect(rows.map((r) => r.isMe)).toEqual([false, true, false]);
    expect(rows[1]!.displayName).toBe('我');
    expect(rows[1]!.classId).toBe('catkin');
  });

  it('缺档案时给兜底名与兜底职业，不渲染成空白行', async () => {
    const { client } = boardStub([{ user_id: 'ghost', elapsed_ms: 100, profiles: null }]);

    const rows = await fetchMilestoneBoard(client, 20, null);

    expect(rows[0]!.displayName).toBe('无名旅人');
    expect(rows[0]!.classId).toBe('swordsman');
    expect(rows[0]!.isMe).toBe(false);
  });

  it('PostgREST 把联表结果给成数组时也能取到档案', async () => {
    // 同一条查询在不同 PostgREST 版本下可能返回对象或单元素数组。
    const { client } = boardStub([
      { user_id: 'a', elapsed_ms: 100, profiles: [{ display_name: '甲', class_id: 'witch' }] },
    ]);

    const rows = await fetchMilestoneBoard(client, 20, null);

    expect(rows[0]!.displayName).toBe('甲');
    expect(rows[0]!.classId).toBe('witch');
  });

  it('用时是数字，即便数据库把 bigint 给成字符串', async () => {
    const { client } = boardStub([
      {
        user_id: 'a',
        elapsed_ms: '123456789',
        profiles: { display_name: '甲', class_id: 'witch' },
      },
    ]);

    const rows = await fetchMilestoneBoard(client, 20, null);

    expect(rows[0]!.elapsedMs).toBe(123_456_789);
    expect(typeof rows[0]!.elapsedMs).toBe('number');
  });
});
