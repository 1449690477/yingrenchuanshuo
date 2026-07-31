/**
 * submit-progress —— 进度榜的最深首通上报（docs/63 §五 · P4）。
 *
 * 与 submit-milestone 同一条根本约束：**服务端无法复算**。「你何时
 * 首通了这一关」是一段已经过去的历史，服务端手里没有任何东西能
 * 重建它。防线（claude 06:30 复核确认）：
 *
 *   L1 结构白名单   —— stageId ∈ ORDERED_STAGE_IDS；时刻窗口
 *                       [2026-01-01, 服务端时间+5min]。**序号永远服务端
 *                       从白名单推导**，客户端载荷里没有序号。
 *   L2 只升不降     —— RPC submit_progress_record 原子 upsert：
 *                       更深才覆盖；同深只许补时刻、只许 verified
 *                       false→true（给清装备被误标的合法玩家留恢复路）。
 *                       progress_records 对客户端只有 select。
 *   L3 verified     —— 软旗标不硬拒：同源 evaluateChapterGate 判定
 *                       （level 够 legacy-bypass 或 combat_power 过该章
 *                       门槛才 verified）；伪造进度要先把自己挂上战力榜，
 *                       成本不对称。
 *
 * 名次只在 verified 行内排：更深者在前，同深更早者在前，
 * 无时刻的排在有时刻之后（docs/62 §4.1：没有证据就不能主张更早）。
 *
 * 部署前必须先运行：npm run edge:build（生成 _core.ts）
 */

import { createClient } from '@supabase/supabase-js';
import { z } from 'zod';
import {
  evaluateProgressClaim,
  isProgressClaimWellFormed,
  progressStageIndex,
} from './_core.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const submissionSchema = z
  .object({
    stageId: z.string().min(1),
    // 老档没有时刻 → null；有时刻 → epoch ms 整数
    firstClearedAt: z.number().int().nullable(),
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

    // ── 2. 载荷结构 + L1 白名单（序号服务端推导，客户端无权自称）──
    const parsed = submissionSchema.safeParse(await req.json());
    if (!parsed.success) return json({ error: '提交的进度快照不合法' }, 400);
    const claim = parsed.data;
    const claimIndex = progressStageIndex(claim.stageId);
    if (claimIndex < 0 || !isProgressClaimWellFormed(claim, Date.now())) {
      return json({ error: '进度快照的数值超出合法范围' }, 400);
    }

    const admin = createClient(supabaseUrl, serviceKey);

    // ── 3. L3 可信度判定（读档案，与游戏内进入门槛同一份实现）──
    const { data: profile, error: profileError } = await admin
      .from('profiles')
      .select('level, combat_power')
      .eq('id', user.id)
      .maybeSingle();
    if (profileError) return json({ error: '档案读取失败，请稍后重试' }, 500);
    if (!profile) return json({ error: '请先同步榜单档案再上报进度' }, 400);

    const { verified } = evaluateProgressClaim(claim, {
      level: Number(profile.level),
      combatPower: Number(profile.combat_power),
    });

    // ── 4. L2 原子只升不降写入（service role；表对客户端无写策略）──
    const { data: stored, error: rpcError } = await admin.rpc('submit_progress_record', {
      p_user_id: user.id,
      p_stage_id: claim.stageId,
      p_stage_index: claimIndex,
      p_stage_at:
        claim.firstClearedAt === null ? null : new Date(claim.firstClearedAt).toISOString(),
      p_verified: verified,
    });
    if (rpcError || !stored) return json({ error: '进度同步失败，请稍后重试' }, 500);

    const finalRow = stored as {
      deepestStageId: string;
      deepestStageIndex: number;
      firstClearedAt: number | null;
      verified: boolean;
    };
    // updated 的语义：榜上现在展示的最深处是否就是本次上报的这一关。
    // false = 另一台设备报过更深的进度，榜上以更深的为准（不是失败）。
    const updated = finalRow.deepestStageId === claim.stageId;

    // ── 5. 名次（只在 verified 行内排；未通过校验不入榜）──
    let rank = 0;
    let total = 0;
    const board = () =>
      admin
        .from('progress_records')
        .select('user_id', { count: 'exact', head: true })
        .eq('verified', true);
    const { count: totalCount } = await board();
    total = totalCount ?? 0;
    if (finalRow.verified) {
      const { count: deeperCount } = await board().gt(
        'deepest_stage_index',
        finalRow.deepestStageIndex,
      );
      // 同深处：有时刻的排在无时刻之前；都有时刻则更早者在前
      let sameStageAhead = board()
        .eq('deepest_stage_index', finalRow.deepestStageIndex)
        .neq('user_id', user.id);
      sameStageAhead =
        finalRow.firstClearedAt === null
          ? sameStageAhead.not('deepest_stage_at', 'is', null)
          : sameStageAhead.lt(
              'deepest_stage_at',
              new Date(finalRow.firstClearedAt).toISOString(),
            );
      const { count: sameCount } = await sameStageAhead;
      rank = (deeperCount ?? 0) + (sameCount ?? 0) + 1;
    }

    return json({
      updated,
      deepestStageId: finalRow.deepestStageId,
      deepestStageIndex: finalRow.deepestStageIndex,
      firstClearedAt: finalRow.firstClearedAt,
      verified: finalRow.verified,
      rank,
      total,
    });
  } catch (_error) {
    return json({ error: '服务器开小差了，请稍后重试' }, 500);
  }
});
