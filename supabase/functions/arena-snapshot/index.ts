/**
 * arena-snapshot —— 上传/刷新竞技场搭配快照（docs/52 §5.1 防守方是离线的）。
 *
 * 玩家进入竞技场的方式：上传当前搭配 → 服务端复算战力 →
 * 未入榜则排到榜尾，已入榜则刷新防守快照与战力。
 * 防守方的搭配以服务端保存的这份快照为准，伪造搭配在结构上不可能
 * （与 submit-trial 同一套可证明的硬校验，见该文件头注释）。
 *
 * 部署前必须先运行：npm run edge:build（生成 _core.ts）
 */

import { createClient } from '@supabase/supabase-js';
import { z } from 'zod';
import {
  ARENA_JOIN_HONOR,
  arenaTierFor,
  buildTrialCombatant,
  CLASS_IDS,
  equipmentInstanceSchema,
  getEquipment,
  SLOT_ORDER,
  trialEquipmentSnapshotIssue,
} from './_core.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const snapshotSchema = z
  .object({
    seasonId: z.string().min(1).max(16),
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
    if (userError || !user) return json({ error: '登录状态无效，请重新打开竞技场' }, 401);

    // ── 2. 载荷与取值（L2）──
    const body = await req.json();
    const parsed = snapshotSchema.safeParse(body);
    if (!parsed.success) return json({ error: '提交的搭配快照不合法' }, 400);
    const sub = parsed.data;

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

    // ── 3. 服务端复算战力 ──
    const build = buildTrialCombatant({
      name: sub.displayName,
      classId: sub.classId,
      level: sub.level,
      equipped: sub.equipped,
    });

    // ── 4. 档案与排名行（service role；客户端对 arena_ranks 无写权限）──
    const admin = createClient(supabaseUrl, serviceKey);
    // 与 submit-trial 同一口径：display_name 只在首次建档时写入，
    // 已有档案的玩家自设昵称绝不能被竞技场快照覆盖（codex-profile 约定）。
    const profileProgress = {
      class_id: sub.classId,
      level: sub.level,
      combat_power: build.combatPower,
      updated_at: new Date().toISOString(),
    };
    await admin.from('profiles').upsert(
      { id: user.id, display_name: sub.displayName, ...profileProgress },
      { onConflict: 'id', ignoreDuplicates: true },
    );
    await admin.from('profiles').update(profileProgress).eq('id', user.id);

    const snapshotJson = {
      classId: sub.classId,
      level: sub.level,
      displayName: sub.displayName,
      equipped: sub.equipped,
    };

    const { data: existing } = await admin
      .from('arena_ranks')
      .select('rank, tier, honor, win_streak')
      .eq('season_id', sub.seasonId)
      .eq('user_id', user.id)
      .maybeSingle();

    let rank: number;
    let honor: number;
    let winStreak: number;
    let joined = false;

    if (existing) {
      const { error } = await admin
        .from('arena_ranks')
        .update({
          build_snapshot: snapshotJson,
          combat_power: build.combatPower,
          updated_at: new Date().toISOString(),
        })
        .eq('season_id', sub.seasonId)
        .eq('user_id', user.id);
      if (error) throw new Error(`刷新防守快照失败：${error.message}`);
      rank = Number(existing.rank);
      honor = Number(existing.honor);
      winStreak = Number(existing.win_streak);
    } else {
      // 新入榜排到榜尾；并发入榜时名次可能撞车，唯一索引兜底，重试即可
      rank = 0;
      honor = ARENA_JOIN_HONOR;
      winStreak = 0;
      for (let attempt = 0; attempt < 3 && rank === 0; attempt++) {
        const { data: tail } = await admin
          .from('arena_ranks')
          .select('rank')
          .eq('season_id', sub.seasonId)
          .order('rank', { ascending: false })
          .limit(1)
          .maybeSingle();
        const newRank = Number(tail?.rank ?? 0) + 1;
        const { error } = await admin.from('arena_ranks').insert({
          user_id: user.id,
          season_id: sub.seasonId,
          rank: newRank,
          tier: 'qingying',
          honor: ARENA_JOIN_HONOR,
          win_streak: 0,
          build_snapshot: snapshotJson,
          combat_power: build.combatPower,
        });
        if (!error) {
          rank = newRank;
          joined = true;
        } else if (attempt === 2) {
          throw new Error(`进入竞技场失败：${error.message}`);
        }
      }
    }

    const { count: totalCount } = await admin
      .from('arena_ranks')
      .select('user_id', { count: 'exact', head: true })
      .eq('season_id', sub.seasonId);
    const total = Math.max(1, totalCount ?? 1);

    return json({
      rank,
      tier: arenaTierFor(rank, total).id,
      honor,
      winStreak,
      total,
      joined,
      joinHonor: joined ? ARENA_JOIN_HONOR : 0,
    });
  } catch (error) {
    return json({ error: `服务端处理失败：${(error as Error).message}` }, 500);
  }
});
