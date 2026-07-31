/**
 * submit-dungeon —— 秘境榜的最快通关上报（docs/51 §4 榜 5，契约 docs/64）。
 *
 * 与 submit-milestone 一样，**服务端无法复算**：一场副本战斗要重跑，
 * 得有玩家当时的完整搭配、RNG 状态与技能倍率，那份快照存档里没有。
 * 所以防线是四层，全部结构性、不依赖统计：
 *
 *   L1 层白名单       —— 该层必须存在，且档位已解封（未解封＝没人打得到）
 *   L2 用时格律与上下界 —— 战斗按 0.1 秒一帧推进，用时必是 100 的整数倍，
 *                         且 ≥ 两帧、≤ 两波超时上限
 *   L3 深度链         —— 要报第 d 层，服务端自己的表里必须已有第 d−1 层的
 *                         可信记录；客户端存档里的 depth 字段一概不看
 *   L4 首通时刻区间   —— 它是并列时的排序依据，所以也必须有下界
 *
 * **为什么下界不用「典型用时 × 余量」**：秘境没有等级上限（docs/66 之后
 * 连等级下限也没有了，门槛完全交给深度链），满级玩家碾压低档低层一帧一波
 * 是合法玩法。统计型下界会把这批合法成绩整批误判 —— 详见 docs/64 §零。
 *
 * 与 submit-milestone 的另一处差别：里程碑是一次性历史事实（重复提交
 * 永不改写），秘境最快用时**是可以刷新的成绩**，所以走「读取已有记录 →
 * core 合并 → 只在真的变好时才写」。合并规则在 src/core/dungeonBoard.ts
 * 的 mergeDungeonRecord，客户端与服务端同一份。
 *
 * 部署前必须先运行：npm run edge:build（生成 _core.ts）
 */

import { createClient } from '@supabase/supabase-js';
import { z } from 'zod';
import {
  dungeonBoardEntry,
  isBoardableDungeon,
  isPlausibleDungeonClaim,
  meetsDungeonDepthChain,
  mergeDungeonRecord,
} from './_core.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const submissionSchema = z
  .object({
    dungeonId: z.string().min(1).max(64),
    bestDurationMs: z.number().int().positive(),
    firstClearedAt: z.number().int().positive(),
  })
  .strict();

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    // ── 1. 身份 ──
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) return json({ error: '缺少登录凭证' }, 401);

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const {
      data: { user },
      error: userError,
    } = await userClient.auth.getUser();
    if (userError || !user) return json({ error: '登录状态无效，请重新打开排行榜' }, 401);

    // ── 2. 载荷结构 ──
    const parsed = submissionSchema.safeParse(await req.json());
    if (!parsed.success) return json({ error: '提交的秘境成绩不合法' }, 400);
    const { dungeonId, bestDurationMs, firstClearedAt } = parsed.data;

    // ── 3. L1 副本白名单（含未解封档位）──
    // 结构性矛盾直接拒收，不记为不可信：这座副本此刻根本进不去。
    if (!isBoardableDungeon(dungeonId)) {
      return json({ error: '这座秘境尚未开放，或者不存在' }, 400);
    }

    const admin = createClient(supabaseUrl, serviceKey);
    const entry = dungeonBoardEntry(dungeonId)!;

    // ── 3.5 档案前置 ──
    //
    // dungeon_records.user_id 外键指向 profiles，没有档案的账号插不进去。
    // 不显式检查的话，玩家会收到「写入失败，请稍后重试」——一句既没解释
    // 原因、重试一万次也不会好的话。**线上端到端探针就是撞在这里**：
    // 一个从未同步过档案的账号，连第 1 层都交不上去。
    // 与 submit-milestone 同一条口径：档案是榜单的展示与外部证据来源，
    // 缺它是前置条件不满足，不是「稍后重试」。
    const { data: profile, error: profileError } = await admin
      .from('profiles')
      .select('id')
      .eq('id', user.id)
      .maybeSingle();
    if (profileError) return json({ error: '读取档案失败，请稍后重试' }, 500);
    if (!profile) return json({ error: '请先同步榜单档案再上报秘境成绩' }, 400);

    // ── 4. L3 深度链（取代旧的等级门槛）──
    //
    // 旧版查的是 profiles.level >= 副本 unlockLevel。docs/66 删掉了等级门槛，
    // 那条判定会**退化成恒真** —— 失效了还不会变红的安全判定最危险。
    //
    // 现在查的是**服务端自己的成绩表**：同档已经站稳的最高层。
    // 客户端存档里那个 depth 字段一概不看 —— 它是被判断的人自己的声明。
    // 想报第 5 层，就得先把 1~4 层一层层交上来，每一层都过一遍格律与上下界。
    const { data: chainRows, error: chainError } = await admin
      .from('dungeon_records')
      .select('depth')
      .eq('user_id', user.id)
      .eq('tier_id', entry.tierId)
      .eq('verified', true)
      .order('depth', { ascending: false })
      .limit(1);
    if (chainError) return json({ error: '读取秘境进度失败，请稍后重试' }, 500);

    const clearedDepth = chainRows?.[0] ? Number(chainRows[0].depth) : 0;
    if (!meetsDungeonDepthChain(dungeonId, clearedDepth)) {
      // 结构性矛盾而不是「成绩可疑」：这一层他还没走到，直接拒收。
      // 换设备的玩家把本地阶梯按深度升序补交即可，链会一层层建起来。
      return json(
        { error: '还没有上一层的记录，请先按顺序上报较浅的层', clearedDepth },
        400,
      );
    }

    // ── 5. L2 + L4 合理性（与客户端同一份 core 实现）──
    const now = Date.now();
    const verified = isPlausibleDungeonClaim({ dungeonId, bestDurationMs, firstClearedAt }, now);

    // ── 6. 落库：读已有记录 → core 合并 → 只在变好时写 ──
    const readRow = async () => {
      const { data, error } = await admin
        .from('dungeon_records')
        .select('best_duration_ms, first_cleared_at, verified')
        .eq('user_id', user.id)
        .eq('dungeon_id', dungeonId)
        .maybeSingle();
      if (error) throw new Error('read-failed');
      return data
        ? {
            bestDurationMs: Number(data.best_duration_ms),
            firstClearedAt: Date.parse(String(data.first_cleared_at)),
            verified: data.verified === true,
          }
        : null;
    };

    const incoming = { bestDurationMs, firstClearedAt, verified };
    let current = await readRow();

    if (!current) {
      const { error: insertError } = await admin.from('dungeon_records').insert({
        user_id: user.id,
        dungeon_id: dungeonId,
        // 档位与层数从权威条目表反查，不取客户端载荷 —— 载荷里根本没有这两个字段
        tier_id: entry.tierId,
        depth: entry.depth,
        best_duration_ms: bestDurationMs,
        first_cleared_at: new Date(firstClearedAt).toISOString(),
        verified,
      });
      if (!insertError) return json({ ...incoming, improved: true, claimVerified: verified });

      // 23505 = 并发下另一次提交刚刚先落了库。这是**正常路径**而不是失败：
      // 重新读回那一行，再走同一套合并规则，本次成绩不会丢。
      if ((insertError as { code?: string }).code !== '23505') {
        return json({ error: '秘境成绩写入失败，请稍后重试' }, 500);
      }
      current = await readRow();
      if (!current) return json({ error: '秘境成绩写入失败，请稍后重试' }, 500);
    }

    const merged = mergeDungeonRecord(current, incoming);
    if (!merged.changed) {
      // 没有变好就不写库 —— 玩家每次进榜单都会重报一次当前记录，
      // 这条路径是常态，不是失败。
      //
      // claimVerified 把两种「没变化」分开：**没打得更快** 与
      // **这次的成绩没通过合理性判定**。两者对玩家的含义完全不同，
      // 而只看 improved 的话它们长得一模一样 —— 一个真实玩家若因为
      // 口径漂移被持续判为不可信，会永远收到「没变化」而无从察觉。
      return json({ ...merged.row, improved: false, claimVerified: verified });
    }

    const { error: updateError } = await admin
      .from('dungeon_records')
      .update({
        best_duration_ms: merged.row.bestDurationMs,
        first_cleared_at: new Date(merged.row.firstClearedAt).toISOString(),
        verified: merged.row.verified,
        updated_at: new Date(now).toISOString(),
      })
      .eq('user_id', user.id)
      .eq('dungeon_id', dungeonId);
    if (updateError) return json({ error: '秘境成绩写入失败，请稍后重试' }, 500);

    return json({ ...merged.row, improved: true, claimVerified: verified });
  } catch (_error) {
    return json({ error: '服务器开小差了，请稍后重试' }, 500);
  }
});
