/**
 * arena-shop-buy —— 荣誉商店兑换圣痕装备（docs/53 §4.1）。
 *
 * 边界：
 *   - 服务端管荣誉：校验余额、原子扣减、写入奖励记录（arena_grants kind='shop'），
 *     伪造余额在结构上不可能（客户端对 arena_ranks 无写权限）
 *   - 客户端管背包：装备实例由客户端用服务端下发的种子、以同一份 core 代码
 *     确定性生成后进背包 —— 与试炼/对决同一信任模型
 *     （本地存档玩家本可自改，服务端兜底在战力上限与对决复算，不在背包）
 *   - 只能买当前职业的圣痕装备：装备有职业限制，买错职业是废件，
 *     让玩家能为错误操作后悔不属于本设计（docs/40）
 *
 * 圣痕碎片兑换不走这里：碎片是客户端背包材料，40 换 1 在本地完成
 * （与绯焰套碎片合成同一模式，见 equipmentSetCrafting）。
 *
 * 部署前必须先运行：npm run edge:build（生成 _core.ts）
 */

import { createClient } from '@supabase/supabase-js';
import { z } from 'zod';
import { ARENA_EQUIPMENT_LIST, ARENA_SHOP_ENTRIES, CLASS_IDS } from './_core.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const requestSchema = z
  .object({
    seasonId: z.string().min(1).max(16),
    entryId: z.string().min(1).max(64),
    classId: z.enum(CLASS_IDS),
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
    if (userError || !user) return json({ error: '登录状态无效，请重新打开竞技场' }, 401);

    const parsed = requestSchema.safeParse(await req.json());
    if (!parsed.success) return json({ error: '兑换请求不合法' }, 400);
    const sub = parsed.data;

    // ── 2. 货架与装备映射 ──
    const entry = ARENA_SHOP_ENTRIES.find((candidate) => candidate.id === sub.entryId);
    if (!entry) return json({ error: '货架不存在' }, 400);
    if (entry.classId !== sub.classId) {
      return json({ error: '这是其他职业的圣痕装备，买回去也穿不上' }, 400);
    }
    const definition = ARENA_EQUIPMENT_LIST.find(
      (candidate) => candidate.classId === entry.classId && candidate.slot === entry.slot,
    );
    if (!definition) throw new Error(`货架 ${entry.id} 没有对应的圣痕装备定义`);

    // ── 3. 原子扣荣誉 + 写入奖励记录（单事务存储过程）──
    const admin = createClient(supabaseUrl, serviceKey);
    const { data: applied, error: buyError } = await admin.rpc('arena_apply_shop_buy', {
      p_season_id: sub.seasonId,
      p_user_id: user.id,
      p_price: entry.price,
      p_payload: {
        entryId: entry.id,
        defId: definition.id,
        seed: crypto.getRandomValues(new Uint32Array(1))[0],
      },
    });
    if (buyError) {
      const msg = buyError.message ?? '';
      if (msg.includes('honor') || msg.includes('check')) {
        return json({ error: '荣誉印记不足' }, 400);
      }
      throw new Error(`兑换结算失败：${msg}`);
    }
    if (applied !== true) return json({ error: '荣誉印记不足' }, 400);

    const { data: row } = await admin
      .from('arena_ranks')
      .select('honor')
      .eq('season_id', sub.seasonId)
      .eq('user_id', user.id)
      .single();

    return json({ ok: true, honor: Number(row?.honor ?? 0) });
  } catch (error) {
    return json({ error: `兑换失败：${(error as Error).message}` }, 500);
  }
});
