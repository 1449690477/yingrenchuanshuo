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
  fetchTrialTop,
  submitTrialScore,
  trialEntryThreshold,
  trialNeighborhoodIsPreview,
  upsertProfile,
  type TrialBoardRow,
  fetchMyPowerRank,
  fetchPowerBoard,
  type TrialSubmission,
} from '../leaderboard';
import { TRIAL_FORMULA_VERSION } from '@/core/trialFormulaVersion';
import { combatPowerCeiling } from '@/core/combatPowerBound';
import { NetRequestError } from '../supabase';

/**
 * 战力测试用的两个数：**从上界推导，不写死**。
 *
 * 原来这里是 PLAUSIBLE_CP / 95_000 —— 只在当时那把尺下成立的魔法数。战力公式一重定价，
 * 它们要么变成「物理上不可能」（上界过滤把它们剔掉，测试红），要么需要有人
 * 重新挑一对数。2026-08-01 批3 合批时就撞上了：**整次合并唯一的冲突就是这两行**。
 *
 * 这几条测试要的性质是「真实可达且不越界」与「他比我高」，**不是某个具体数值**。
 * 从 combatPowerCeiling 推导之后，任何一把尺下都自动成立。
 */
const PLAUSIBLE_CP = Math.floor(combatPowerCeiling(78, 'swordsman') * 0.5);
/** 比我高一点、同样在上界内 —— 名次测试要的「排在我上面的人」。 */
const RIVAL_CP = Math.floor(combatPowerCeiling(78, 'swordsman') * 0.6);

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
        data: {
          damage: 142_000,
          rank: 313,
          total: 5211,
          verified: true,
          improved: true,
          formulaVersion: TRIAL_FORMULA_VERSION,
        },
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
      formulaVersion: TRIAL_FORMULA_VERSION,
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
      data: {
        damage: -50,
        rank: 1,
        total: 1,
        verified: true,
        improved: false,
        formulaVersion: TRIAL_FORMULA_VERSION,
      },
      error: null,
    }));
    const result = await submitTrialScore(client, submission);
    expect(result.damage).toBe(0);
  });

  it('调用的是 submit-trial 函数', async () => {
    const invoke = vi.fn(async () => ({
      data: {
        damage: 1,
        rank: 1,
        total: 1,
        verified: true,
        improved: false,
        formulaVersion: TRIAL_FORMULA_VERSION,
      },
      error: null,
    }));
    await submitTrialScore(stubClient(invoke), submission);
    expect(invoke).toHaveBeenCalledWith(
      'submit-trial',
      expect.objectContaining({ body: submission }),
    );
  });

  it('新页面连到旧 Edge 时不把成绩误标成已上传', async () => {
    const client = stubClient(async () => ({
      data: { damage: 1, rank: 1, total: 1, verified: true, improved: true },
      error: null,
    }));
    await expect(submitTrialScore(client, submission)).rejects.toThrow('无法识别');
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
      {
        seasonId: 's1',
        weekIndex: 29,
        bracketId: 'feiyue',
        formulaVersion: TRIAL_FORMULA_VERSION,
      },
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
      {
        seasonId: 's1',
        weekIndex: 29,
        bracketId: 'feiyue',
        formulaVersion: TRIAL_FORMULA_VERSION,
        classId: 'catkin',
      },
      'me-1',
    );

    expect(calls[0]!.params.p_class_id).toBe('catkin');
  });

  it('新客户端只调用显式版本 RPC，漏版本不会静默回退旧榜', async () => {
    const { client, calls } = rpcStubClient(() => []);
    await fetchTrialNeighborhood(
      client,
      {
        seasonId: 's1',
        weekIndex: 29,
        bracketId: 'feiyue',
        formulaVersion: TRIAL_FORMULA_VERSION,
      },
      'me-1',
    );
    expect(calls[0]).toEqual(
      expect.objectContaining({
        name: 'trial_neighborhood_versioned',
        params: expect.objectContaining({ p_formula_version: TRIAL_FORMULA_VERSION }),
      }),
    );
  });

  it('前 N 榜同样走显式版本 RPC', async () => {
    const { client, calls } = rpcStubClient(() => []);
    await fetchTrialTop(
      client,
      {
        seasonId: 's1',
        weekIndex: 29,
        bracketId: 'feiyue',
        formulaVersion: TRIAL_FORMULA_VERSION,
      },
      'me-1',
    );
    expect(calls[0]).toEqual(
      expect.objectContaining({
        name: 'trial_top_versioned',
        params: expect.objectContaining({ p_formula_version: TRIAL_FORMULA_VERSION }),
      }),
    );
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
 * 战力榜：版本握手与纵深防御。
 *
 * ── 这一组测试存在的理由（2026-08-02）──
 * 过滤曾经写成「客户端 bundle 里的 CP_FORMULA_VERSION == 行上的戳」，
 * 而等号两侧来自**两个独立部署的产物**。老测试两侧都写 CP_FORMULA_VERSION，
 * 于是**无论实现怎么写都是绿的** —— 这正是这个 bug 能发到线上的原因。
 *
 * 所以下面每一条 ★ 都刻意让「我的戳」与「服务端正在写的戳」**不相等**，
 * 并断言玩家仍然看得见自己。两边相等的那条留着，但它证明不了任何事。
 */
describe('fetchPowerBoard 在版本不一致时仍然让玩家看见自己', () => {
  interface FakeProfile {
    id: string;
    display_name: string;
    bio: string | null;
    avatar_url: string | null;
    class_id: string;
    level: number;
    combat_power: number;
    cp_formula_version: number;
    updated_at: string;
  }

  function profile(over: Partial<FakeProfile> & { id: string }): FakeProfile {
    return {
      display_name: over.id,
      bio: null,
      avatar_url: null,
      class_id: 'swordsman',
      level: 78,
      combat_power: PLAUSIBLE_CP,
      cp_formula_version: 2,
      updated_at: '2026-08-02T03:00:00.000Z',
      ...over,
    };
  }

  /**
   * power_board / power_rank_scan 的语义复刻（见 20260802010000 迁移）。
   *
   * 刻意**不复用任何生产代码**：这里要独立地表达「SQL 应该怎么答」，
   * 复用了就变成自己证明自己。规则只有一条 ——
   * **榜的版本取调用者自己那行的戳**，没有档案时取全表最新的那个。
   */
  function fakeDb(profiles: FakeProfile[]) {
    const calls: { name: string; args: Record<string, unknown> }[] = [];
    const rpc = (name: string, args: Record<string, unknown>) => {
      calls.push({ name, args });
      const meRow = profiles.find((p) => p.id === args.p_user_id) ?? null;
      const newest = profiles.length
        ? Math.max(...profiles.map((p) => p.cp_formula_version))
        : null;
      const ruler = meRow ? meRow.cp_formula_version : newest;

      if (name === 'power_board') {
        const board = profiles
          .filter((p) => p.cp_formula_version === ruler)
          .sort(
            (a, b) =>
              b.combat_power - a.combat_power || a.updated_at.localeCompare(b.updated_at),
          );
        const pending = profiles.filter((p) => p.cp_formula_version !== ruler).length;
        const limit = Math.min(Math.max(Number(args.p_limit ?? 50), 1), 200);
        return Promise.resolve({
          data: board.slice(0, limit).map((p) => ({
            id: p.id,
            display_name: p.display_name,
            bio: p.bio,
            avatar_url: p.avatar_url,
            class_id: p.class_id,
            level: p.level,
            combat_power: p.combat_power,
            formula_version: ruler,
            board_total: board.length,
            pending_recalc: pending,
            is_current: ruler === newest,
          })),
          error: null,
        });
      }
      if (name === 'power_rank_scan') {
        if (!meRow) return Promise.resolve({ data: [], error: null });
        const above = profiles.filter(
          (p) =>
            p.cp_formula_version === meRow.cp_formula_version &&
            p.combat_power > meRow.combat_power,
        );
        return Promise.resolve({
          data: above.length
            ? above.map((p) => ({
                level: p.level,
                class_id: p.class_id,
                combat_power: p.combat_power,
              }))
            : // 有档案、但没人比我高：一行全 null，把它与「查无档案」区分开
              [{ level: null, class_id: null, combat_power: null }],
          error: null,
        });
      }
      throw new Error(`未预期的 RPC：${name}`);
    };
    return { client: { rpc } as unknown as SupabaseClient, calls };
  }

  /**
   * 2026-08-02 03:38 线上那一刻：12 个 Edge 已部署（在写版本 3），
   * Pages CI 连红三次没上线（线上 bundle 仍是版本 2）。
   * 已经进过游戏的人被盖成 3，没进过的还停在 2。
   */
  const deploySkew = [
    profile({ id: 'me', cp_formula_version: 2 }),
    profile({ id: 'v2-friend', cp_formula_version: 2, combat_power: RIVAL_CP }),
    profile({ id: 'v3-early', cp_formula_version: 3, combat_power: RIVAL_CP }),
    profile({ id: 'v3-early2', cp_formula_version: 3 }),
  ];

  it('★ 我的戳比服务端正在写的旧：我仍然在榜上，而不是从榜上消失', async () => {
    const { client } = fakeDb(deploySkew);

    const board = await fetchPowerBoard(client, 'me');

    // 这一条就是事故本身：旧口径的玩家同步一次就从榜上消失了
    expect(board.rows.map((r) => r.userId)).toContain('me');
    expect(board.rows.find((r) => r.userId === 'me')!.isMe).toBe(true);
  });

  it('★ 旧戳玩家看到的榜里没有任何新戳的行 —— 两把尺不混排', async () => {
    const { client } = fakeDb(deploySkew);

    const board = await fetchPowerBoard(client, 'me');

    expect(board.rows.map((r) => r.userId).sort()).toEqual(['me', 'v2-friend']);
    expect(board.formulaVersion).toBe(2);
  });

  it('★ 而且如实告诉他这不是最新那把尺，并说明有几个人不在这张榜上', async () => {
    const { client } = fakeDb(deploySkew);

    const board = await fetchPowerBoard(client, 'me');

    expect(board.isCurrent).toBe(false);
    expect(board.pendingRecalc).toBe(2);
  });

  it('★ 反方向同样成立：我已被盖成新戳、大多数人还是旧戳，我也没消失', async () => {
    // 老实现在这个方向上是错的 —— 它按客户端常量筛，
    // 被服务端盖成新戳的人反而从旧客户端的榜上不见了。
    const { client } = fakeDb(deploySkew);

    const board = await fetchPowerBoard(client, 'v3-early');

    expect(board.rows.map((r) => r.userId).sort()).toEqual(['v3-early', 'v3-early2']);
    expect(board.formulaVersion).toBe(3);
    expect(board.isCurrent).toBe(true); // 3 就是最新那把尺
    expect(board.pendingRecalc).toBe(2);
  });

  it('★ 未登录时看最新那把尺的榜，而不是空榜', async () => {
    const { client } = fakeDb(deploySkew);

    const board = await fetchPowerBoard(client, null);

    expect(board.formulaVersion).toBe(3);
    expect(board.rows.map((r) => r.userId).sort()).toEqual(['v3-early', 'v3-early2']);
    expect(board.rows.every((r) => r.isMe === false)).toBe(true);
  });

  it('两边一致时与过去行为相同（注意：这一条无论实现怎么写都是绿的）', async () => {
    const { client } = fakeDb([
      profile({ id: 'me', cp_formula_version: 3 }),
      profile({ id: 'rival', cp_formula_version: 3, combat_power: RIVAL_CP }),
    ]);

    const board = await fetchPowerBoard(client, 'me');

    expect(board.rows.map((r) => r.userId)).toEqual(['rival', 'me']);
    expect(board.isCurrent).toBe(true);
    expect(board.pendingRecalc).toBe(0);
  });

  it('★ 客户端不再持有版本常量 —— 没有常量可对，就没有对不上的可能', () => {
    // 这是整个改动的结构性保证：只要 net 层重新 import 了这个常量，
    // 「两个部署产物各持一份、半截发版时对不上」这条路径就又回来了。
    const source = readFileSync(resolve(__dirname, '../leaderboard.ts'), 'utf8')
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/^\s*\/\/.*$/gm, '');

    expect(source).not.toMatch(/CP_FORMULA_VERSION/);
    expect(source).not.toMatch(/cpFormulaVersion/);
  });

  // ── 纵深防御：上界过滤（docs/65 §六之二 方向 B）──

  it('自填的天文数字被剔除，名次按剩下的重排', async () => {
    const { client } = fakeDb([
      profile({ id: 'forged', cp_formula_version: 3, combat_power: 999_999_999 }),
      profile({ id: 'honest', cp_formula_version: 3 }),
    ]);

    const board = await fetchPowerBoard(client, null);

    expect(board.rows.map((r) => r.userId)).toEqual(['honest']);
    expect(board.rows[0]!.rank).toBe(1);
  });

  it('真实玩家一个都不能少 —— 满配肝帝必须留在榜上', async () => {
    const { client } = fakeDb([profile({ id: 'honest', cp_formula_version: 3 })]);

    const board = await fetchPowerBoard(client, 'honest');

    expect(board.rows).toHaveLength(1);
    expect(board.rows[0]!.isMe).toBe(true);
  });

  it('等级伪造也拦得住：等级越界的行直接不进榜', async () => {
    const { client } = fakeDb([
      profile({ id: 'lvhack', cp_formula_version: 3, level: 999 }),
    ]);

    const board = await fetchPowerBoard(client, null);

    expect(board.rows).toHaveLength(0);
  });

  it('多取再过滤，避免剔除后榜变短', async () => {
    const { client, calls } = fakeDb([]);

    await fetchPowerBoard(client, null, 50);

    expect(calls[0]!.args.p_limit).toBe(100);
  });

  it('★ 迁移还没执行时榜依然能开 —— 退回直读 profiles', async () => {
    // RPC 不存在时 PostgREST 返回 PGRST202。若直接抛出，玩家看到的是
    // **整张榜打不开** —— 比任何一条误伤都严重（误伤是个别人看不见自己，
    // 这个是所有人都打不开）。所以宁可退回加版本戳之前的行为。
    const builder: Record<string, unknown> = {};
    Object.assign(builder, {
      select: () => builder,
      order: () => builder,
      limit: () =>
        Promise.resolve({
          data: [{ ...profile({ id: 'honest' }), cp_formula_version: undefined }],
          error: null,
        }),
    });
    const client = {
      rpc: () =>
        Promise.resolve({
          data: null,
          error: {
            code: 'PGRST202',
            message: 'Could not find the function public.power_board in the schema cache',
          },
        }),
      from: () => builder,
    } as unknown as SupabaseClient;

    const board = await fetchPowerBoard(client, null);

    expect(board.rows.map((r) => r.userId)).toEqual(['honest']);
    // 版本未知时不谎称「这是最新标尺」，也不吓唬玩家说有人在重算
    expect(board.formulaVersion).toBeNull();
    expect(board.pendingRecalc).toBe(0);
  });

  it('迁移执行后的正常错误仍然抛出，不会被降级路径吞掉', async () => {
    const client = {
      rpc: () =>
        Promise.resolve({ data: null, error: { code: '08006', message: 'connection failure' } }),
    } as unknown as SupabaseClient;

    await expect(fetchPowerBoard(client, null)).rejects.toThrow(NetRequestError);
  });

  // ── 名次与榜单必须数同一批人 ──

  it('没登录时不给名次，而不是给第 1 名', async () => {
    const { client } = fakeDb(deploySkew);
    expect(await fetchMyPowerRank(client, null)).toEqual({ kind: 'unranked' });
  });

  it('★ 查无档案与「我就是第一名」必须分得开 —— 前者不许编出第 1 名', async () => {
    const { client } = fakeDb(deploySkew);

    expect(await fetchMyPowerRank(client, 'nobody')).toEqual({ kind: 'unranked' });
    // 同一个桩里，真的第一名要拿到 rank 1（哨兵行就是为了这个区分而存在）
    expect(await fetchMyPowerRank(client, 'v2-friend')).toEqual({
      kind: 'ranked',
      rank: 1,
      exact: true,
    });
  });

  it('★ 名次只数与我同一把尺的人：新戳的高手不该把我挤下去', async () => {
    // v3-early 的战力比 me 高，但它是另一把尺量的，不该影响 me 的名次
    const { client } = fakeDb(deploySkew);

    expect(await fetchMyPowerRank(client, 'me')).toEqual({
      kind: 'ranked',
      rank: 2, // 只有同为 v2 的 v2-friend 在我之上
      exact: true,
    });
  });

  it('★ 排在我上面的伪造行不算进名次 —— 与列表用同一道上界过滤', async () => {
    const { client } = fakeDb([
      profile({ id: 'me', cp_formula_version: 3 }),
      profile({ id: 'rival', cp_formula_version: 3, combat_power: RIVAL_CP }),
      profile({ id: 'forged', cp_formula_version: 3, combat_power: 999_999_999 }),
    ]);

    // 两行都比我高，但伪造那行会被上界剔掉，所以是第 2 名不是第 3 名
    expect(await fetchMyPowerRank(client, 'me')).toEqual({
      kind: 'ranked',
      rank: 2,
      exact: true,
    });
  });
});

/**
 * power_board 迁移的 SQL 契约。
 *
 * 桩客户端复刻的是「SQL 应该怎么答」，测不出 SQL 实际怎么写。
 * 而本轮的全部意义就在于**版本从哪里来** —— 那句话只存在于 SQL 里。
 */
describe('power_board 迁移的 SQL 契约', () => {
  // 只断言代码：文件头注释里原样引用了被修掉的写法，
  // 不剥注释的话负向断言会打在文档上而不是实现上。
  const sql = readFileSync(
    resolve(__dirname, '../../../supabase/migrations/20260802010000_power_board_versioned_rpc.sql'),
    'utf8',
  )
    .split('\n')
    .filter((line) => !line.trimStart().startsWith('--'))
    .join('\n');

  it('★ 版本取自调用者自己那一行，而不是写死的常量', () => {
    expect(sql).toMatch(
      /select\s+p\.cp_formula_version\s+from\s+profiles\s+p\s+where\s+p\.id\s*=\s*p_user_id/i,
    );
    // 写死一个版本号，等于把「两个产物各持一份常量」换成「三个」，白改
    expect(sql).not.toMatch(/cp_formula_version\s*(=|<>)\s*\d/);
  });

  it('未登录时退回最新那把尺，而不是空榜', () => {
    expect(sql).toMatch(/coalesce\(/i);
    expect(sql).toMatch(/max\(p\.cp_formula_version\)/i);
  });

  it('★ limit 夹取写全 coalesce —— null 不能退化成「不限制」（070000:233 踩过）', () => {
    expect(sql).toMatch(/limit\s+least\(greatest\(coalesce\(p_limit,\s*50\),\s*1\),\s*200\)/i);
    expect(sql).toMatch(/limit\s+least\(greatest\(coalesce\(p_limit,\s*500\),\s*1\),\s*1000\)/i);
  });

  it('与 070000 的 versioned 函数同约定：security definer + search_path 钉 public', () => {
    const defs = sql.match(/language sql stable[^$]*/g) ?? [];
    expect(defs).toHaveLength(2);
    for (const def of defs) {
      expect(def).toMatch(/security\s+definer/i);
      expect(def).toMatch(/set\s+search_path\s*=\s*public/i);
    }
  });

  it('授权先 revoke 再按签名 grant，不把函数留给 public', () => {
    for (const fn of ['power_board', 'power_rank_scan']) {
      expect(sql).toMatch(
        new RegExp(`revoke all on function public\\.${fn}\\(uuid, int\\) from public`, 'i'),
      );
      expect(sql).toMatch(
        new RegExp(
          `grant execute on function public\\.${fn}\\(uuid, int\\) to anon, authenticated`,
          'i',
        ),
      );
    }
  });

  it('★ 有档案但无人在我之上时发哨兵行 —— 否则与「查无档案」分不开', () => {
    expect(sql).toMatch(/union all/i);
    expect(sql).toMatch(/where not exists\s*\(\s*select 1 from above\s*\)/i);
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
