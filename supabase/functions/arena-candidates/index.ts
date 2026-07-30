/**
 * arena-candidates —— 今日候选对手（docs/52 §3.2 三选一，不是全服列表）。
 *
 * 为什么候选由服务端挑选而不是客户端拉表：
 *   - arena_ranks 只对本人可读，客户端根本扫不到全表（防捏软柿子）
 *   - 候选名次窗口由「玩家 + 日切」种子决定，同一天同一批，公平且可复现
 *   - 预估胜率在服务端用同一份 core 算好再下发 ——
 *     「70% 赢小的还是 35% 赢大的」是本设计的乐趣核心（§3.2）
 *
 * 部署前必须先运行：npm run edge:build（生成 _core.ts）
 */

import { createClient } from '@supabase/supabase-js';
import { z } from 'zod';
import {
  ARENA_DAILY_CHALLENGES,
  ARENA_OPPONENT_CANDIDATES,
  ARENA_OPPONENT_MAX_ABOVE,
  ARENA_REVENGE_WINDOW_HOURS,
  arenaCandidateRanks,
  arenaCandidateSeed,
  arenaDayKey,
  arenaTierFor,
  buildArenaDuelSide,
  CLASS_IDS,
  equipmentInstanceSchema,
  estimateDuelWinChance,
  type DuelSide,
} from './_core.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const requestSchema = z.object({ seasonId: z.string().min(1).max(16) }).strict();

/** 排名行里存的防守快照（arena-snapshot 写入的格式）。 */
const storedSnapshotSchema = z
  .object({
    classId: z.enum(CLASS_IDS),
    level: z.number().int().min(1).max(120),
    displayName: z.string().min(1).max(20),
    equipped: z.array(equipmentInstanceSchema.nullable()).length(8),
  })
  .strict();

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

function duelSideFromSnapshot(
  snap: z.infer<typeof storedSnapshotSchema>,
  role: 'attacker' | 'defender',
): DuelSide {
  // buildArenaDuelSide：圣痕套效果只在竞技场内生效（docs/53 §六），
  // 防守方 4 件额外减伤也在同一入口结算 —— 胜率预估与挑战复算口径逐点一致
  return buildArenaDuelSide(
    {
      name: snap.displayName,
      classId: snap.classId,
      level: snap.level,
      equipped: snap.equipped,
    },
    role,
  );
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
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
    if (!parsed.success) return json({ error: '请求不合法' }, 400);
    const { seasonId } = parsed.data;

    const admin = createClient(supabaseUrl, serviceKey);
    const { data: myRow } = await admin
      .from('arena_ranks')
      .select('rank, honor, win_streak, build_snapshot, combat_power')
      .eq('season_id', seasonId)
      .eq('user_id', user.id)
      .maybeSingle();
    if (!myRow) return json({ error: '尚未进入竞技场，请先上传搭配' }, 400);

    const mySnap = storedSnapshotSchema.safeParse(myRow.build_snapshot);
    if (!mySnap.success) return json({ error: '请重新上传你的搭配快照' }, 400);
    const mySide = duelSideFromSnapshot(mySnap.data, 'attacker');

    const dayKey = arenaDayKey(Date.now());
    const { data: todayBattles } = await admin
      .from('arena_battles')
      .select('defender_id')
      .eq('attacker_id', user.id)
      .eq('day_key', dayKey)
      .eq('is_revenge', false);
    const attemptsToday = (todayBattles ?? []).length;
    const challengedToday = new Set((todayBattles ?? []).map((b) => b.defender_id as string));

    // ── 反击机会（§六）：24 小时内有人攻破我的防线 → 针对该对手 ×1 ──
    // 零成本：不消耗每日次数、不需要押注、赢了同样顶替排名、不碰连胜。
    // 措辞红线：这是「反击机会」，不是「你被人打败了」。
    const windowStart = new Date(Date.now() - ARENA_REVENGE_WINDOW_HOURS * 3_600_000).toISOString();
    const [{ data: beatenBattles }, { data: myRevenges }] = await Promise.all([
      admin
        .from('arena_battles')
        .select('attacker_id, created_at')
        .eq('defender_id', user.id)
        .eq('attacker_won', true)
        .eq('is_revenge', false)
        .gt('created_at', windowStart)
        .order('created_at', { ascending: false }),
      admin
        .from('arena_battles')
        .select('defender_id, created_at')
        .eq('attacker_id', user.id)
        .eq('is_revenge', true)
        .gt('created_at', windowStart),
    ]);
    // 每个对手取最近一次被攻破时刻；已被反击消耗（反击时间晚于被攻破时刻）的剔除
    const beatenLatest = new Map<string, string>();
    for (const b of beatenBattles ?? []) {
      const id = b.attacker_id as string;
      if (!beatenLatest.has(id)) beatenLatest.set(id, b.created_at as string);
    }
    const consumed = new Set<string>();
    for (const r of myRevenges ?? []) {
      const beatenAt = beatenLatest.get(r.defender_id as string);
      if (beatenAt && (r.created_at as string) > beatenAt) consumed.add(r.defender_id as string);
    }
    const revengeIds = [...beatenLatest.keys()].filter((id) => !consumed.has(id));

    let revenge: unknown[] = [];
    if (revengeIds.length > 0) {
      const { data: rows } = await admin
        .from('arena_ranks')
        .select('user_id, rank, combat_power, build_snapshot, profiles(display_name, class_id)')
        .eq('season_id', seasonId)
        .in('user_id', revengeIds);
      for (const row of rows ?? []) {
        const snap = storedSnapshotSchema.safeParse(row.build_snapshot);
        if (!snap.success) continue;
        const profile = Array.isArray(row.profiles) ? row.profiles[0] : row.profiles;
        const winRate = estimateDuelWinChance(mySide, duelSideFromSnapshot(snap.data, 'defender'));
        const beatenAt = beatenLatest.get(row.user_id as string)!;
        revenge.push({
          userId: row.user_id,
          rank: Number(row.rank),
          displayName: profile?.display_name ?? '无名旅人',
          classId: profile?.class_id ?? snap.data.classId,
          combatPower: Number(row.combat_power),
          winRate: Math.round(winRate * 100) / 100,
          beatenAt,
          expiresAt: new Date(
            new Date(beatenAt).getTime() + ARENA_REVENGE_WINDOW_HOURS * 3_600_000,
          ).toISOString(),
        });
      }
    }

    // 候选名次窗口（全 15 名洗牌），跳过今日已挑战的，补足 3 个
    const window = arenaCandidateRanks(
      Number(myRow.rank),
      arenaCandidateSeed(user.id, dayKey),
      ARENA_OPPONENT_MAX_ABOVE,
    );

    let candidates: unknown[] = [];
    if (window.length > 0) {
      const { data: rows } = await admin
        .from('arena_ranks')
        .select('user_id, rank, combat_power, build_snapshot, profiles(display_name, class_id)')
        .eq('season_id', seasonId)
        .in('rank', window);

      const byRank = new Map<number, NonNullable<typeof rows>[number]>();
      for (const row of rows ?? []) byRank.set(Number(row.rank), row);

      for (const rank of window) {
        if (candidates.length >= ARENA_OPPONENT_CANDIDATES) break;
        const row = byRank.get(rank);
        if (!row || challengedToday.has(row.user_id as string)) continue;
        const snap = storedSnapshotSchema.safeParse(row.build_snapshot);
        if (!snap.success) continue;
        const profile = Array.isArray(row.profiles) ? row.profiles[0] : row.profiles;
        const winRate = estimateDuelWinChance(mySide, duelSideFromSnapshot(snap.data, 'defender'));
        candidates.push({
          userId: row.user_id,
          rank,
          displayName: profile?.display_name ?? '无名旅人',
          classId: profile?.class_id ?? snap.data.classId,
          combatPower: Number(row.combat_power),
          winRate: Math.round(winRate * 100) / 100,
        });
      }
    }

    const { count: totalCount } = await admin
      .from('arena_ranks')
      .select('user_id', { count: 'exact', head: true })
      .eq('season_id', seasonId);
    const total = Math.max(1, totalCount ?? 1);

    return json({
      me: {
        rank: Number(myRow.rank),
        tier: arenaTierFor(Number(myRow.rank), total).id,
        honor: Number(myRow.honor),
        winStreak: Number(myRow.win_streak),
        attemptsLeft: Math.max(0, ARENA_DAILY_CHALLENGES - attemptsToday),
        attemptsMax: ARENA_DAILY_CHALLENGES,
      },
      total,
      candidates,
      revenge,
    });
  } catch (error) {
    return json({ error: `服务端处理失败：${(error as Error).message}` }, 500);
  }
});
