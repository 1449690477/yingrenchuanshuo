/**
 * submit-affection —— 羁绊榜的心意上报（docs/63 §三 · P2）。
 *
 * 与 submit-milestone 同一条根本约束：**服务端无法复算**。
 * 「你陪了她多少次」是一段已经过去的历史，服务端手里没有任何东西能
 * 重建它。防线（与速度榜同构）：
 *
 *   L1 结构白名单   —— 点数 / 次数 / 幕数的取值范围（存档 schema 同值）
 *   L2 合理性下界   —— isPlausibleAffectionClaim，与客户端同一份实现：
 *                       互动有 4 次/角色/日硬上限，账龄决定次数上限，
 *                       心意 ≤ min(次数, 日限×账龄) × 单次上限 + 幕数 × 60
 *   L3 只升不降     —— 好感在游戏内只增不减，
 *                       affection_total 用「更小的提交不改写」天然挡洗白
 *
 * 红线（docs/63 §三）：单角色明细**用完即弃，不落库** ——
 * 谁给谁刷了多少好感是私事，数据库里只存四角色之和。
 *
 * 部署前必须先运行：npm run edge:build（生成 _core.ts）
 */

import { createClient } from '@supabase/supabase-js';
import { z } from 'zod';
import {
  affectionTotalPoints,
  CLASS_IDS,
  isAffectionClaimWellFormed,
  isPlausibleAffectionClaim,
} from './_core.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const characterSchema = z
  .object({
    points: z.number().int().min(0),
    totalInteractions: z.number().int().min(0),
    storyCount: z.number().int().min(0),
  })
  .strict();

const submissionSchema = z
  .object({
    // zod v4 的 z.record(z.enum) 是穷举键（缺键即拒），
    // 这里要的是「缺的角色允许不报」—— 用 partialRecord（线上探针抓获）。
    characters: z.partialRecord(z.enum(CLASS_IDS), characterSchema),
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

    // ── 2. 载荷结构（L1）──
    const parsed = submissionSchema.safeParse(await req.json());
    if (!parsed.success) return json({ error: '提交的心意快照不合法' }, 400);
    const claims = CLASS_IDS.map((classId) => parsed.data.characters[classId]).filter(
      (entry): entry is z.infer<typeof characterSchema> => entry !== undefined,
    );
    if (claims.length === 0) return json({ error: '至少要有一个角色的心意快照' }, 400);
    for (const claim of claims) {
      if (!isAffectionClaimWellFormed(claim)) {
        return json({ error: '心意快照的数值超出合法范围' }, 400);
      }
    }

    // ── 3. 合理性下界（L2，与客户端同一份 core 实现）──
    // 账龄参与：互动有日硬上限，注册 N 天的账号次数不可能超过 4N。
    const accountAgeMs = Date.now() - new Date(user.created_at).getTime();
    for (const claim of claims) {
      if (!isPlausibleAffectionClaim(claim, accountAgeMs)) {
        // 不合理不写库，但不是「失败」——真实玩家数学上不可能触到下界，
        // 走到这里只可能是改过的存档；200 + updated:false 让正常重试
        // 语义保持干净，也不给造假者任何报错信息去试边界。
        return json({ updated: false, affectionTotal: null, rank: 0, total: 0 });
      }
    }

    // ── 4. 只升不降写入（L3；service role，profiles 对客户端无写权限）──
    const admin = createClient(supabaseUrl, serviceKey);
    const nextTotal = affectionTotalPoints(claims);
    const { error: updateError } = await admin
      .from('profiles')
      .update({ affection_total: nextTotal, updated_at: new Date().toISOString() })
      .eq('id', user.id)
      .lt('affection_total', nextTotal);
    if (updateError) return json({ error: '心意同步失败，请稍后重试' }, 500);

    // 生效值：本次只升不降之后账号的实际总分（可能高于本次提交——
    // 另一设备已经报过更高的）。
    const { data: profile, error: profileError } = await admin
      .from('profiles')
      .select('affection_total')
      .eq('id', user.id)
      .maybeSingle();
    if (profileError) return json({ error: '心意读取失败，请稍后重试' }, 500);
    const affectionTotal = profile ? Number(profile.affection_total) : 0;

    // ── 5. 名次（只在有总分的账号内排；0 分账号不入榜）──
    let rank = 0;
    let total = 0;
    if (affectionTotal > 0) {
      const board = () =>
        admin
          .from('profiles')
          .select('id', { count: 'exact', head: true })
          .gt('affection_total', 0);
      const { count: totalCount } = await board();
      const { count: betterCount } = await board().gt('affection_total', affectionTotal);
      rank = (betterCount ?? 0) + 1;
      total = totalCount ?? 0;
    }

    return json({ updated: true, affectionTotal, rank, total });
  } catch (_error) {
    return json({ error: '服务器开小差了，请稍后重试' }, 500);
  }
});
