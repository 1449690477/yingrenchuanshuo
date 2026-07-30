/**
 * submit-milestone —— 登顶速度榜的达成上报（docs/51 §4 榜 4）。
 *
 * 与 submit-trial 的根本差别：**服务端无法复算**。
 * 试炼伤害可以用同一份 core 逐点重跑，但「你何时到达 Lv60」是一段
 * 已经过去的历史，服务端手里没有任何东西能重建它。所以这里的防线只有三层：
 *
 *   L1 档位白名单        —— 客户端能声明任意 level，表外一律拒
 *   L2 用时硬下界        —— isPlausibleMilestone，与客户端同一份实现
 *   L3 当前等级交叉验证  —— 你的公开档案等级必须已达到该档位
 *
 * L3 是这里唯一「免费」的真实证据：profiles.level 由玩家自己的档案同步写入，
 * 虽然也能伪造，但伪造它会同时把自己挂到战力榜上被人看见，成本不对称。
 *
 * 不可变：主键 (user_id, milestone) + on conflict do nothing。
 * 里程碑是「第一次到达用了多久」的历史事实，不是可以刷新的成绩 ——
 * 重复提交永远不改写已有记录，**也就不存在「先报个慢的再报个快的」这条路**。
 *
 * 部署前必须先运行：npm run edge:build（生成 _core.ts）
 */

import { createClient } from '@supabase/supabase-js';
import { z } from 'zod';
import { isPlausibleMilestone, MILESTONE_LEVELS } from './_core.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const submissionSchema = z
  .object({
    level: z.number().int(),
    elapsedMs: z.number().int().positive(),
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
    if (!parsed.success) return json({ error: '提交的里程碑不合法' }, 400);
    const { level, elapsedMs } = parsed.data;

    // ── 3. L1 档位白名单 ──
    if (!(MILESTONE_LEVELS as readonly number[]).includes(level)) {
      return json({ error: '不存在这个里程碑档位' }, 400);
    }

    const admin = createClient(supabaseUrl, serviceKey);

    // ── 4. L3 当前等级交叉验证 ──
    // 没有档案的账号不能上报：档案是这个榜唯一的外部证据来源。
    const { data: profile, error: profileError } = await admin
      .from('profiles')
      .select('level')
      .eq('id', user.id)
      .maybeSingle();
    if (profileError) return json({ error: '读取档案失败，请稍后重试' }, 500);
    if (!profile) return json({ error: '请先同步榜单档案再上报里程碑' }, 400);
    if (Number(profile.level) < level) {
      // 声明达成了自己都还没到的等级 —— 直接拒绝而不是记为不可信，
      // 因为这不是「成绩可疑」，而是结构性矛盾。
      return json({ error: '当前等级尚未达到该里程碑' }, 400);
    }

    // ── 5. L2 用时硬下界（与客户端同一份 core 实现）──
    const verified = isPlausibleMilestone({ level, elapsedMs });

    // ── 6. 落库：首次写入生效，重复提交永不改写 ──
    const { error: insertError } = await admin
      .from('milestones')
      .insert({ user_id: user.id, milestone: level, elapsed_ms: elapsedMs, verified });

    if (insertError) {
      // 23505 = 唯一约束冲突：该档位已有记录。这是**正常路径**而不是失败 ——
      // 客户端可能在多设备或断网重试下重复提交，已有记录就是最终答案。
      if ((insertError as { code?: string }).code === '23505') {
        const { data: existing } = await admin
          .from('milestones')
          .select('elapsed_ms, verified')
          .eq('user_id', user.id)
          .eq('milestone', level)
          .maybeSingle();
        return json({
          level,
          elapsedMs: existing ? Number(existing.elapsed_ms) : elapsedMs,
          verified: existing ? existing.verified === true : verified,
          alreadyRecorded: true,
        });
      }
      return json({ error: '里程碑写入失败，请稍后重试' }, 500);
    }

    return json({ level, elapsedMs, verified, alreadyRecorded: false });
  } catch (_error) {
    return json({ error: '服务器开小差了，请稍后重试' }, 500);
  }
});
