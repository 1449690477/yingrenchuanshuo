/**
 * sync-profile —— 档案同步（docs/65 §六之二 方向 A）。
 *
 * 这个函数存在的唯一理由：**把 combat_power 的写入权从客户端收回来。**
 *
 * profiles 的 RLS 策略是 for all using (auth.uid() = id)，也就是任何已登录
 * 玩家都能直接 PATCH 自己那一行 —— 战力榜的名次此刻是客户端自填的。
 * 改法不是「再加一道校验」，而是让客户端**没有这个数可报**：
 * 载荷里只有搭配快照，战力由服务端用同一份 core 现算。
 *
 * 与 submit-trial 的关系：那个函数早就在用服务端复算的 build.combatPower
 * 写 profiles，可信路径本来就存在，只是仅在「玩家提交试炼成绩」时才走。
 * 本函数把同一条路径开放给日常的档案同步（打开排行榜、加入公会时）。
 * 两者共用同一套装备硬校验与同一个 buildTrialCombatant，
 * edge:build 的自检逐点比对两个打包产物对同一快照算出的战力。
 *
 * **玩家自设身份（昵称 / 简介 / 头像）不走这里**：那些是玩家自治的展示字段，
 * 继续由客户端直写（docs/65 §六之二 末尾的通用结论）。本函数只碰
 * class_id / level / combat_power 三个「参与排名」的字段。
 *
 * 部署前必须先运行：npm run edge:build（生成 _core.ts）
 */

import { createClient } from '@supabase/supabase-js';
import { z } from 'zod';
import {
  buildTrialCombatant,
  CLASS_IDS,
  equipmentInstanceSchema,
  getEquipment,
  isPlausibleCombatPower,
  SLOT_ORDER,
  trialEquipmentSnapshotIssue,
} from './_core.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// 载荷里**没有 combatPower** —— 那正是本函数的全部意义。
const submissionSchema = z
  .object({
    classId: z.enum(CLASS_IDS),
    level: z.number().int().min(1).max(120),
    displayName: z.string().min(1).max(20),
    /** 八槽位穿戴快照，顺序与 SLOT_ORDER 一致 */
    equipped: z.array(equipmentInstanceSchema.nullable()).length(8),
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
    if (!parsed.success) return json({ error: '提交的搭配快照不合法' }, 400);
    const sub = parsed.data;

    // ── 3. 装备硬校验（与 submit-trial 逐条相同）──
    // 档案同步比试炼成绩「轻」，但校验不能轻：这条路径产出的战力会直接
    // 参与排名，若放宽校验，伪造搭配就成了新的刷榜入口。
    for (let i = 0; i < SLOT_ORDER.length; i++) {
      const inst = sub.equipped[i];
      if (!inst) continue;
      const def = getEquipment(inst.defId);
      if (!def) return json({ error: '装备定义不存在' }, 400);
      if (def.slot !== SLOT_ORDER[i]) return json({ error: '装备槽位不符' }, 400);
      const snapshotIssue = trialEquipmentSnapshotIssue(inst, sub.classId, sub.level);
      if (snapshotIssue) {
        const issueMessages: Record<typeof snapshotIssue, string> = {
          'unknown-equipment': '装备定义不存在',
          'equipment-level': '装备等级超过角色等级',
          'equipment-class': '装备职业限制不符',
          'affix-value': '装备词条数值不符合生成公式',
        };
        return json({ error: issueMessages[snapshotIssue] }, 400);
      }
    }

    // ── 4. 服务端复算战力（与客户端、与 submit-trial 同一份 core）──
    const build = buildTrialCombatant({
      name: sub.displayName,
      classId: sub.classId,
      level: sub.level,
      equipped: sub.equipped,
    });
    const combatPower = Math.round(build.combatPower);

    // 自查一次：正常情况下永远成立（战力就是从这套装备算出来的）。
    // 不成立说明 core 的口径改动让某个真实搭配越过了展示层上界 ——
    // 此时宁可少写一次战力，也不要让榜单收下一个会被前端过滤掉的值，
    // 那种「写进去了但榜上看不见」的状态最难排查。
    if (!isPlausibleCombatPower(combatPower, sub.level, sub.classId)) {
      return json({ error: '战力核算异常，请稍后重试' }, 500);
    }

    // ── 5. 落库（service role）──
    const admin = createClient(supabaseUrl, serviceKey);
    const progress = {
      class_id: sub.classId,
      level: sub.level,
      combat_power: combatPower,
      updated_at: new Date().toISOString(),
    };

    // 首次建档才写昵称：已有档案的自设昵称绝不能被同步覆盖
    // （与 submit-trial 同一条口径）。
    const { error: createError } = await admin
      .from('profiles')
      .upsert(
        { id: user.id, display_name: sub.displayName, ...progress },
        { onConflict: 'id', ignoreDuplicates: true },
      );
    if (createError) return json({ error: '档案初始化失败' }, 500);

    const { error: updateError } = await admin
      .from('profiles')
      .update(progress)
      .eq('id', user.id);
    if (updateError) return json({ error: '档案同步失败' }, 500);

    return json({ combatPower, level: sub.level, classId: sub.classId });
  } catch (_error) {
    return json({ error: '服务器开小差了，请稍后重试' }, 500);
  }
});
