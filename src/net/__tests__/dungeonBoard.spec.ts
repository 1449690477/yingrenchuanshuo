/**
 * 秘境榜网络层的契约测试（桩客户端，不打真实网络）。
 *
 * 两条最重要的契约：
 *   1. **载荷里不存在 verified 与 rank** —— 客户端连「我是否入榜、第几名」
 *      都无权自称（与试炼榜、速度榜同一条原则）
 *   2. **并列时按首通时刻升序** —— 满级玩家打低档副本会成批撞在 0.2 秒
 *      的下界上，少了这条排序，同分的人按数据库返回顺序排，
 *      等于奖励谁的写入更靠前
 */

import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import { fetchDungeonBoard, submitDungeonRecord } from '../dungeonBoard';
import { NetRequestError } from '../supabase';

function invokeStub(handler: () => { data: unknown; error: unknown }) {
  const calls: { name: string; body: unknown }[] = [];
  const client = {
    functions: {
      invoke: async (name: string, opts: { body: unknown }) => {
        calls.push({ name, body: opts.body });
        return handler();
      },
    },
  } as unknown as SupabaseClient;
  return { client, calls };
}

const submission = {
  dungeonId: 'equipment_weapon_auric_d1',
  bestDurationMs: 37_100,
  firstClearedAt: Date.parse('2026-07-28T10:00:00+08:00'),
};

describe('submitDungeonRecord', () => {
  it('载荷只有三个字段，没有 verified / rank / improved', async () => {
    const { client, calls } = invokeStub(() => ({
      data: { ...submission, verified: true, improved: true },
      error: null,
    }));

    const result = await submitDungeonRecord(client, submission);

    expect(calls[0]!.name).toBe('submit-dungeon');
    const keys = Object.keys(calls[0]!.body as Record<string, unknown>);
    expect(keys.sort()).toEqual(['bestDurationMs', 'dungeonId', 'firstClearedAt']);
    expect(keys).not.toContain('verified');
    expect(keys).not.toContain('rank');
    expect(keys).not.toContain('improved');
    expect(result.verified).toBe(true);
    expect(result.improved).toBe(true);
  });

  it('verified 缺省时按 false 处理，不许「没说就算通过」', async () => {
    const { client } = invokeStub(() => ({ data: { bestDurationMs: 200 }, error: null }));

    const result = await submitDungeonRecord(client, submission);

    expect(result.verified).toBe(false);
  });

  it('没打得更快时 improved=false，仍是成功路径而不是异常', async () => {
    // 玩家每次打开榜单都会重报当前记录，这条路径是常态。
    const { client } = invokeStub(() => ({
      data: { bestDurationMs: 30_000, firstClearedAt: 1, verified: true, improved: false },
      error: null,
    }));

    const result = await submitDungeonRecord(client, submission);

    expect(result.improved).toBe(false);
    // 用时以服务端已有记录为准，不是我这次报的那个
    expect(result.bestDurationMs).toBe(30_000);
  });

  it('claimVerified 把「没打得更快」与「这条没被采信」分开', async () => {
    // 线上探针实测：报一个破格律的用时，improved=false、verified=true
    //（库里那行还是老的可信记录）——只看这两个字段，玩家无从知道
    // 自己刚交的那条被判了不可信。claimVerified 就是这条信息。
    const { client } = invokeStub(() => ({
      data: { bestDurationMs: 31_000, firstClearedAt: 1, verified: true, improved: false, claimVerified: false },
      error: null,
    }));

    const result = await submitDungeonRecord(client, submission);

    expect(result.improved).toBe(false);
    expect(result.verified).toBe(true); // 库里那行是可信的
    expect(result.claimVerified).toBe(false); // 但我刚交的这条不是
  });

  it('claimVerified 缺省按 false，不许「没说就算通过」', async () => {
    const { client } = invokeStub(() => ({ data: { bestDurationMs: 200 }, error: null }));
    expect((await submitDungeonRecord(client, submission)).claimVerified).toBe(false);
  });

  it('服务端业务错误翻译成玩家能看懂的异常', async () => {
    const { client } = invokeStub(() => ({
      data: { error: '这座秘境尚未开放，或者不存在' },
      error: null,
    }));

    await expect(submitDungeonRecord(client, submission)).rejects.toThrow(NetRequestError);
    await expect(submitDungeonRecord(client, submission)).rejects.toThrow('尚未开放');
  });

  it('网络失败翻译成人话', async () => {
    const { client } = invokeStub(() => ({ data: null, error: new Error('Failed to fetch') }));

    await expect(submitDungeonRecord(client, submission)).rejects.toThrow('网络连接失败');
  });
});

describe('fetchDungeonBoard', () => {
  interface QueryLog {
    filters: [string, unknown][];
    orders: { column: string; ascending: boolean }[];
    limit?: number;
  }

  function boardStub(rows: unknown[]) {
    const log: QueryLog = { filters: [], orders: [] };
    const builder: Record<string, unknown> = {};
    const chain = () => builder;
    Object.assign(builder, {
      select: chain,
      eq: (column: string, value: unknown) => {
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
      in: async () => ({ data: [], error: null }),
    });
    const client = { from: () => builder } as unknown as SupabaseClient;
    return { client, log };
  }

  it('只取该副本且 verified 的记录，用时升序、并列看首通更早', async () => {
    const { client, log } = boardStub([]);

    await fetchDungeonBoard(client, 'equipment_weapon_auric_d1', 'me-1');

    expect(log.filters).toEqual([
      ['dungeon_id', 'equipment_weapon_auric_d1'],
      ['verified', true],
    ]);
    expect(log.orders).toEqual([
      { column: 'best_duration_ms', ascending: true },
      { column: 'first_cleared_at', ascending: true },
    ]);
  });

  it('名次按返回顺序生成，isMe 只认自己，首通时刻解析成毫秒', async () => {
    const { client } = boardStub([
      {
        user_id: 'a',
        best_duration_ms: 200,
        first_cleared_at: '2026-07-20T02:00:00+00:00',
        profiles: { display_name: '甲', class_id: 'witch' },
      },
      {
        user_id: 'me-1',
        best_duration_ms: 200,
        first_cleared_at: '2026-07-26T02:00:00+00:00',
        profiles: { display_name: '我', class_id: 'catkin' },
      },
    ]);

    const rows = await fetchDungeonBoard(client, 'equipment_weapon_azure_d1', 'me-1');

    expect(rows.map((r) => r.rank)).toEqual([1, 2]);
    expect(rows.map((r) => r.isMe)).toEqual([false, true]);
    expect(rows[0]!.firstClearedAt).toBe(Date.parse('2026-07-20T02:00:00+00:00'));
  });

  it('缺档案时给兜底名与兜底职业，不渲染成空白行', async () => {
    const { client } = boardStub([
      {
        user_id: 'ghost',
        best_duration_ms: 200,
        first_cleared_at: '2026-07-20T02:00:00+00:00',
        profiles: null,
      },
    ]);

    const rows = await fetchDungeonBoard(client, 'equipment_weapon_azure_d1', null);

    expect(rows[0]!.displayName).toBe('无名旅人');
    expect(rows[0]!.classId).toBe('swordsman');
  });

  it('PostgREST 把联表结果给成数组时也能取到档案', async () => {
    const { client } = boardStub([
      {
        user_id: 'a',
        best_duration_ms: '37100',
        first_cleared_at: '2026-07-20T02:00:00+00:00',
        profiles: [{ display_name: '甲', class_id: 'witch' }],
      },
    ]);

    const rows = await fetchDungeonBoard(client, 'equipment_weapon_auric_d1', null);

    expect(rows[0]!.displayName).toBe('甲');
    // 数据库把整数给成字符串时也要变回数字，否则 UI 排序会按字典序
    expect(rows[0]!.bestDurationMs).toBe(37_100);
    expect(typeof rows[0]!.bestDurationMs).toBe('number');
  });
});

/**
 * SQL 与 Edge Function 的契约（直接读文件断言）。
 *
 * 为什么要有这一组：桩客户端测不出 SQL 的毛病，而邻域榜那次三个 bug
 * 全在 SQL 里（docs/61 §2.2）。这里锁的是「客户端不能直写成绩表」
 * 与「服务端不许另抄一份判定」这两条不能回归的红线。
 */
describe('秘境榜 Supabase 契约', () => {
  const migration = readFileSync(
    new URL('../../../supabase/migrations/20260731000000_dungeon_board.sql', import.meta.url),
    'utf8',
  );
  const edge = readFileSync(
    new URL('../../../supabase/functions/submit-dungeon/index.ts', import.meta.url),
    'utf8',
  );

  it('成绩表开了 RLS、只读、并额外 revoke 掉客户端写权限', () => {
    expect(migration).toContain('alter table public.dungeon_records enable row level security');
    expect(migration).toContain(
      'create policy "dungeon records readable" on public.dungeon_records for select using (true)',
    );
    expect(migration).toContain(
      'revoke insert, update, delete on public.dungeon_records from anon, authenticated',
    );
    // 负向断言：任何 for insert / for update 的策略都不许出现
    expect(migration).not.toMatch(/create policy[^;]*on public\.dungeon_records\s+for (insert|update|delete)/i);
  });

  it('榜单索引带上并列时的第二排序键，否则同分行的顺序是随机的', () => {
    expect(migration).toContain(
      '(dungeon_id, best_duration_ms asc, first_cleared_at asc)',
    );
  });

  it('没有档案时给的是「先同步档案」而不是「稍后重试」', () => {
    // 线上探针实测过这条：dungeon_records 的外键指向 profiles，
    // 没档案的账号插入直接失败。若只回「写入失败，请稍后重试」，
    // 玩家会重试到天亮也好不了 —— 前置条件不满足必须说清是哪一条。
    expect(edge).toContain('请先同步榜单档案再上报秘境成绩');
    expect(edge).toContain(".from('profiles')");
  });

  it('深度链查的是服务端自己的表，不是客户端上报的存档字段', () => {
    // 这条是本榜反作弊的地基：证据必须由服务端一层层收下来。
    // 若有人把它改成读载荷里的 depth，等于把「你有资格打这层吗」的判断权
    // 交回给被判断的人 —— 那时这条断言会红。
    expect(edge).toContain(".from('dungeon_records')");
    expect(edge).toContain(".eq('tier_id', entry.tierId)");
    expect(edge).toContain(".eq('verified', true)");
    // 载荷 schema 里不许出现 depth / tierId：它们由服务端反查权威表得出，
    // 客户端连「我在第几层」都不该有发言权
    const schemaBlock = edge.slice(
      edge.indexOf('const submissionSchema'),
      edge.indexOf('.strict()'),
    );
    expect(schemaBlock).toContain('dungeonId');
    expect(schemaBlock).not.toContain('depth');
    expect(schemaBlock).not.toContain('tier');
  });

  it('服务端判定只从打包的 _core 来，不在 index.ts 里另写一套', () => {
    expect(edge).toContain("from './_core.ts'");
    expect(edge).toContain('isPlausibleDungeonClaim');
    expect(edge).toContain('meetsDungeonDepthChain');
    expect(edge).toContain('mergeDungeonRecord');
    // 负向断言：出现硬编码的下界数字，就说明有人在服务端抄了第二份口径
    expect(edge).not.toMatch(/durationMs\s*[<>]=?\s*\d/);
    expect(edge).not.toMatch(/%\s*100\s*[!=]==?/);
  });
});
