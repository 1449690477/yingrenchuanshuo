/**
 * 排行榜网络层的契约测试（用桩客户端，不打真实网络）。
 *
 * 最重要的契约：提交载荷里不存在伤害字段 —— docs/51 验收第一条
 * 「客户端提交伤害数字必须不可能」。类型系统已经在编译期锁死，
 * 这里再在运行期显式断言一次，防止未来有人把 damage 塞进 body。
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import {
  fetchTrialNeighborhood,
  submitTrialScore,
  trialEntryThreshold,
  trialNeighborhoodIsPreview,
  upsertProfile,
  type TrialBoardRow,
  fetchPowerTop,
  type TrialSubmission,
} from '../leaderboard';
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

  it('4xx 业务错误透出服务端中文原因，而不是笼统的 non-2xx', async () => {
    // 复刻真实排障场景：FunctionsHttpError.context 是带 { error } 正文的 Response
    const httpError = Object.assign(
      new Error('Edge Function returned a non-2xx status code'),
      {
        context: new Response(JSON.stringify({ error: '装备词条数值不符合生成公式' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        }),
      },
    );
    const client = stubClient(async () => ({ data: null, error: httpError }));
    await expect(submitTrialScore(client, submission)).rejects.toThrow(
      '装备词条数值不符合生成公式',
    );
  });

  it('业务错误正文缺失时仍走兜底翻译', async () => {
    const httpError = Object.assign(
      new Error('Edge Function returned a non-2xx status code'),
      { context: new Response('not json', { status: 502 }) },
    );
    const client = stubClient(async () => ({ data: null, error: httpError }));
    await expect(submitTrialScore(client, submission)).rejects.toThrow('成绩上传失败');
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
  /**
   * 2026-07-31 起档案同步走 sync-profile 函数（docs/65 §六之二 方向 A）。
   * 这条测试锁的是本轮的核心红线：**载荷里不能有战力**。
   * profiles 的 RLS 是 for all，客户端上报的战力等于自填名次；
   * 现在服务端拿搭配快照现算，客户端连报都无从报起。
   */
  it('载荷只有搭配快照，没有战力字段 —— 名次不能自填', async () => {
    const calls: { name: string; body: Record<string, unknown> }[] = [];
    const client = {
      functions: {
        invoke: async (name: string, opts: { body: unknown }) => {
          calls.push({ name, body: opts.body as Record<string, unknown> });
          return { data: { combatPower: 123_456, level: 45 }, error: null };
        },
      },
    } as unknown as SupabaseClient;

    await upsertProfile(client, {
      displayName: '剑姬角色名',
      classId: 'swordsman',
      level: 45,
      equipped: [null, null, null, null, null, null, null, null],
    });

    expect(calls[0]!.name).toBe('sync-profile');
    expect(Object.keys(calls[0]!.body).sort()).toEqual([
      'classId',
      'displayName',
      'equipped',
      'level',
    ]);
    expect(calls[0]!.body).not.toHaveProperty('combatPower');
    expect(calls[0]!.body).not.toHaveProperty('combat_power');
  });

  it('昵称超长会被裁到 20 字，空名给兜底名', async () => {
    const bodies: Record<string, unknown>[] = [];
    const client = {
      functions: {
        invoke: async (_name: string, opts: { body: unknown }) => {
          bodies.push(opts.body as Record<string, unknown>);
          return { data: {}, error: null };
        },
      },
    } as unknown as SupabaseClient;

    const equipped = [null, null, null, null, null, null, null, null];
    await upsertProfile(client, {
      displayName: '啊'.repeat(30),
      classId: 'witch',
      level: 1,
      equipped,
    });
    await upsertProfile(client, { displayName: '   ', classId: 'witch', level: 1, equipped });

    expect((bodies[0]!.displayName as string).length).toBe(20);
    expect(bodies[1]!.displayName).toBe('无名旅人');
  });

  it('服务端业务错误翻译成玩家能看懂的异常', async () => {
    const client = {
      functions: {
        invoke: async () => ({ data: { error: '装备词条数值不符合生成公式' }, error: null }),
      },
    } as unknown as SupabaseClient;

    await expect(
      upsertProfile(client, {
        displayName: '甲',
        classId: 'witch',
        level: 1,
        equipped: [null, null, null, null, null, null, null, null],
      }),
    ).rejects.toThrow('装备词条数值不符合生成公式');
  });

  it('档案同步的 4xx 正文会透出，不再只显示 non-2xx', async () => {
    const httpError = Object.assign(new Error('Edge Function returned a non-2xx status code'), {
      context: new Response(JSON.stringify({ error: '装备词条数值不符合生成公式' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      }),
    });
    const client = stubClient(async () => ({ data: null, error: httpError }));

    await expect(
      upsertProfile(client, {
        displayName: '甲',
        classId: 'witch',
        level: 69,
        equipped: [null, null, null, null, null, null, null, null],
      }),
    ).rejects.toThrow('装备词条数值不符合生成公式');
  });
});

// ─────────────────── 邻域榜（2026-07-30 线上 rows=0 修复） ───────────────────

/**
 * 背景：线上 trial_scores 有 8 行且全部 verified，但玩家看到的邻域榜是空的。
 * 用 anon key 直接打 RPC 定位到三处根因，都在 SQL 里：
 *   A 有成绩 + 指定职业   → rows=1   机制没问题
 *   B 有成绩 + 职业 null   → rows=0   `t.class_id = null` 恒假
 *   C 有 8 行 + 我没成绩   → rows=0   `from board b, me` 交叉连接被空集吃掉
 *   D 省略职业参数         → PGRST202 该参数无 SQL 默认值
 *
 * 桩客户端测不出 SQL 的毛病，所以这组测试分两层：
 * 客户端行为用桩断言，SQL 契约直接读迁移文件断言。
 */

function rpcStubClient(rpc: (name: string, params: Record<string, unknown>) => unknown) {
  const calls: { name: string; params: Record<string, unknown> }[] = [];
  const client = {
    rpc: async (name: string, params: Record<string, unknown>) => {
      calls.push({ name, params });
      return { data: rpc(name, params), error: null };
    },
    // 邻域榜拉完行还要补公开身份，这里返回空表示「没有覆盖信息」
    from: () => ({
      select: () => ({ in: async () => ({ data: [], error: null }) }),
    }),
  } as unknown as SupabaseClient;
  return { client, calls };
}

describe('fetchTrialNeighborhood 的 RPC 参数', () => {
  it('职业缺省时显式传 null，而不是让键消失（否则 PostgREST 报 PGRST202）', async () => {
    const { client, calls } = rpcStubClient(() => []);

    await fetchTrialNeighborhood(
      client,
      { seasonId: 's1', weekIndex: 29, bracketId: 'feiyue' },
      'me-1',
    );

    const params = calls[0]!.params;
    expect(Object.keys(params)).toContain('p_class_id');
    expect(params.p_class_id).toBeNull();
  });

  it('指定职业时原样传下去', async () => {
    const { client, calls } = rpcStubClient(() => []);

    await fetchTrialNeighborhood(
      client,
      { seasonId: 's1', weekIndex: 29, bracketId: 'feiyue', classId: 'catkin' },
      'me-1',
    );

    expect(calls[0]!.params.p_class_id).toBe('catkin');
  });
});

describe('trialNeighborhoodIsPreview / trialEntryThreshold', () => {
  const row = (rank: number, damage: number, isMe: boolean): TrialBoardRow => ({
    rank,
    userId: `u${rank}`,
    displayName: `玩家${rank}`,
    bio: null,
    avatarUrl: null,
    classId: 'catkin',
    damage,
    isMe,
    total: 8,
  });

  it('有我在里面 → 是我的邻域，不是预览', () => {
    const rows = [row(3, 900, false), row(4, 800, true), row(5, 700, false)];
    expect(trialNeighborhoodIsPreview(rows)).toBe(false);
    expect(trialEntryThreshold(rows)).toBe(700);
  });

  it('非空但没有我 → 榜尾预览，门槛取最末一行', () => {
    const rows = [row(6, 600, false), row(7, 500, false), row(8, 400, false)];
    expect(trialNeighborhoodIsPreview(rows)).toBe(true);
    expect(trialEntryThreshold(rows)).toBe(400);
  });

  it('空表是「本周没人上榜」，不算预览', () => {
    expect(trialNeighborhoodIsPreview([])).toBe(false);
    expect(trialEntryThreshold([])).toBeNull();
  });

  it('门槛按名次取最末行，不受传入顺序影响', () => {
    const rows = [row(8, 400, false), row(6, 600, false), row(7, 500, false)];
    expect(trialEntryThreshold(rows)).toBe(400);
  });
});

describe('trial_neighborhood 迁移的 SQL 契约', () => {
  // 只断言代码：文件头的注释里原样引用了修掉的那个错误写法，
  // 不剥注释的话负向断言会打在文档上而不是实现上。
  const sql = readFileSync(
    resolve(__dirname, '../../../supabase/migrations/20260730193000_trial_neighborhood_anchor.sql'),
    'utf8',
  )
    .split('\n')
    .filter((line) => !line.trimStart().startsWith('--'))
    .join('\n');

  it('职业参数可空：用 `p_class_id is null or ...` 而不是裸等号', () => {
    expect(sql).toMatch(/p_class_id\s+is\s+null\s+or\s+t\.class_id\s*=\s*p_class_id/i);
  });

  it('职业与用户参数都有 SQL 默认值，省略时不会报函数不存在', () => {
    expect(sql).toMatch(/p_class_id\s+text\s+default\s+null/i);
    expect(sql).toMatch(/p_user_id\s+uuid\s+default\s+null/i);
  });

  it('锚点回退到榜尾，且不再交叉连接可能为空的 me', () => {
    expect(sql).toMatch(/coalesce\(/i);
    expect(sql).toMatch(/select\s+max\(b\.r\)\s+from\s+board\s+b/i);
    // 原来的 `from board b, me` 是空集吞掉整张榜的根因，不许回归
    expect(sql).not.toMatch(/from\s+board\s+b\s*,\s*me\b/i);
    expect(sql).toMatch(/from\s+board\s+b\s*,\s*anchor\s+a/i);
  });

  it('保持 security invoker：verified=false 的成绩仍受 RLS 遮挡', () => {
    expect(sql).toMatch(/security\s+invoker/i);
    expect(sql).toMatch(/and\s+t\.verified/i);
  });

  it('签名未变，create or replace 能原地替换且授权不丢', () => {
    expect(sql).toMatch(/create\s+or\s+replace\s+function\s+public\.trial_neighborhood/i);
    expect(sql).toMatch(
      /grant\s+execute\s+on\s+function\s+public\.trial_neighborhood\(text,\s*int,\s*text,\s*text,\s*uuid,\s*int\)/i,
    );
  });
});

/**
 * 战力榜的纵深防御（docs/65 §六之二 方向 B）。
 *
 * profiles 的写策略是 for all —— 已登录玩家能直接 PATCH 自己那一行的
 * combat_power，也就是名次可以自填。方向 A 会把写权限收进 Edge Function；
 * 在那之前（以及万一将来某个新写入点又把权限放开时），
 * 展示层这道过滤保证物理上不可能的数字进不了榜。
 */
describe('fetchPowerTop 过滤掉物理上不可能的战力', () => {
  function powerStub(rows: unknown[]) {
    const log: { limit?: number } = {};
    const builder: Record<string, unknown> = {};
    Object.assign(builder, {
      select: () => builder,
      order: () => builder,
      limit: (n: number) => {
        log.limit = n;
        return Promise.resolve({ data: rows, error: null });
      },
    });
    const client = { from: () => builder } as unknown as SupabaseClient;
    return { client, log };
  }

  const honest = {
    id: 'honest',
    display_name: '老实人',
    bio: null,
    avatar_url: null,
    class_id: 'swordsman',
    level: 78,
    combat_power: 90_000,
  };
  const forged = { ...honest, id: 'forged', display_name: '自填哥', combat_power: 999_999_999 };

  it('自填的天文数字被剔除，名次按剩下的重排', async () => {
    // 伪造行排在第一（战力最高），过滤后不该占据任何名次
    const { client } = powerStub([forged, honest]);

    const rows = await fetchPowerTop(client, null);

    expect(rows.map((row) => row.userId)).toEqual(['honest']);
    expect(rows[0]!.rank).toBe(1);
  });

  it('真实玩家一个都不能少 —— 满配肝帝必须留在榜上', async () => {
    // 90000 已接近 Lv78 的结构上界，属于真实可达
    const { client } = powerStub([honest]);

    const rows = await fetchPowerTop(client, 'honest');

    expect(rows).toHaveLength(1);
    expect(rows[0]!.isMe).toBe(true);
  });

  it('多取再过滤，避免剔除后榜变短', async () => {
    const { client, log } = powerStub([]);

    await fetchPowerTop(client, null, 50);

    expect(log.limit).toBe(100);
  });

  it('等级伪造也拦得住：等级越界的行直接不进榜', async () => {
    const { client } = powerStub([{ ...honest, id: 'lvhack', level: 999, combat_power: 90_000 }]);

    const rows = await fetchPowerTop(client, null);

    expect(rows).toHaveLength(0);
  });
});

/**
 * sync-profile 与收权限迁移的契约（直接读文件断言）。
 *
 * 桩客户端测不出「服务端到底信不信客户端报的数」，也测不出 SQL 里
 * 那条列级授权有没有写对形状 —— 而这两件正是本轮的全部意义。
 */
describe('档案同步的服务端契约', () => {
  const edge = readFileSync(
    new URL('../../../supabase/functions/sync-profile/index.ts', import.meta.url),
    'utf8',
  );
  const grants = readFileSync(
    new URL('../../../supabase/migrations/20260731230000_profile_write_grants.sql', import.meta.url),
    'utf8',
  );

  it('函数载荷里没有战力字段，战力由服务端 buildTrialCombatant 现算', () => {
    const schemaBlock = edge.slice(
      edge.indexOf('const submissionSchema'),
      edge.indexOf('.strict()'),
    );
    expect(schemaBlock).toContain('equipped');
    expect(schemaBlock).not.toContain('combatPower');
    expect(schemaBlock).not.toContain('combat_power');
    expect(edge).toContain('buildTrialCombatant');
    expect(edge).toContain('build.combatPower');
  });

  it('装备硬校验与 submit-trial 同源，不因为「只是同步档案」而放宽', () => {
    expect(edge).toContain('trialEquipmentSnapshotIssue');
    expect(edge).toContain('装备槽位不符');
  });

  it('迁移先撤表级再按列重授 —— 列级 revoke 削不掉表级授权', () => {
    expect(grants).toContain('revoke insert, update on public.profiles from anon, authenticated');
    expect(grants).toMatch(/grant update \([^)]*display_name[^)]*\) on public\.profiles/);
    // 排名字段一个都不许出现在重新授权的名单里
    const grantBlock = grants.slice(grants.indexOf('grant insert'), grants.indexOf('alter table'));
    expect(grantBlock).not.toContain('combat_power');
    expect(grantBlock).not.toContain('class_id');
    expect(grantBlock).not.toMatch(/\blevel\b/);
  });

  it('收权限后建档要有默认值，否则第一次 insert 会失败', () => {
    for (const column of ['class_id', 'level', 'combat_power']) {
      expect(grants).toMatch(new RegExp(`alter column ${column} set default`));
    }
  });
});
