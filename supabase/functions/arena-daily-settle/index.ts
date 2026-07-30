/**
 * arena-daily-settle —— 每日 04:00（北京时间）结算（docs/52 §九 / docs/53 §4.3）。
 *
 * 结算内容：
 *   1. 防线战报：昨天被挑战 N 次、守住 M 次 → +8/+3，日上限 200（§2.2）；
 *      「被人挑战」是战绩不是受害通知，无论输赢都是正数
 *   2. 段位奖励：按当前名次所在段位发每日荣誉 + 奖励箱（星辉匣/圣痕匣），
 *      箱子内容用「玩家 + 日切」种子确定性生成，逐点可复算
 *   3. 段位只升不降：arena_ranks.tier 存历史最高（§4.3，由存储过程保证）
 *
 * 奖励「直接进背包」（docs/40 红线：不领取就清空属惩罚项）：
 *   结算结果写进 arena_grants，荣誉同步加进 arena_ranks；
 *   客户端下次进竞技场时自动把物品同步进背包并标记 claimed，
 *   玩家哪天不上线也不会损失任何东西。
 *
 * 触发方式（部署后由老板配置一次，见 docs/52-联机排行榜部署指南.md）：
 *   Supabase pg_cron 每天 20:10 UTC（= 北京 04:10）以 service key 调用本函数。
 *   本函数只接受 service role key 调用，玩家无法触发。
 *
 * 部署前必须先运行：npm run edge:build（生成 _core.ts）
 */

import { createClient } from '@supabase/supabase-js';
import { z } from 'zod';
import {
  ARENA_BOXES,
  ARENA_DEFENSE_REWARD_BROKEN,
  ARENA_DEFENSE_REWARD_DAILY_CAP,
  ARENA_DEFENSE_REWARD_HELD,
  ARENA_TIERS,
  arenaDayKey,
  arenaTierFor,
  fnv1a32,
  Rng,
} from './_core.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const requestSchema = z
  .object({
    seasonId: z.string().min(1).max(16),
    /** 要结算的业务日；缺省 = 当前业务日的前一天（04:10 跑时即「昨天」） */
    dayKey: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  })
  .strict();

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

/** 箱子内容：确定性种子，同一玩家同一箱序任何端复算一致。 */
function rollBox(boxId: keyof typeof ARENA_BOXES, userId: string, dayKey: string, index: number) {
  const box = ARENA_BOXES[boxId];
  const rng = new Rng(fnv1a32(`${userId}|${dayKey}|settle|${boxId}|${index}`));
  const honor = rng.int(box.reward.honor.min, box.reward.honor.max);
  const items: Record<string, number> = {};
  for (const [itemId, amount] of Object.entries(box.reward.items)) {
    items[itemId] = Array.isArray(amount) ? rng.int(amount[0], amount[1]) : amount;
  }
  return { boxId, honor, items };
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    // ── 1. 只接受 service role（pg_cron 携带），玩家无法触发 ──
    const authHeader = req.headers.get('Authorization');
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    if (authHeader !== `Bearer ${serviceKey}`) {
      return json({ error: '本函数只接受服务端定时任务调用' }, 401);
    }

    const parsed = requestSchema.safeParse(await req.json());
    if (!parsed.success) return json({ error: '结算参数不合法' }, 400);
    const { seasonId } = parsed.data;
    const dayKey = parsed.data.dayKey ?? arenaDayKey(Date.now() - 1);

    const admin = createClient(supabaseUrl, serviceKey);

    // ── 2. 全榜按名次升序，逐玩家结算 ──
    const { data: rows, error: ranksError } = await admin
      .from('arena_ranks')
      .select('user_id, rank')
      .eq('season_id', seasonId)
      .order('rank', { ascending: true });
    if (ranksError) throw new Error(`读取排名失败：${ranksError.message}`);
    const players = rows ?? [];
    const total = Math.max(1, players.length);

    let settled = 0;
    let skipped = 0;
    for (const row of players) {
      const userId = row.user_id as string;
      const rank = Number(row.rank);
      const tier = arenaTierFor(rank, total);

      // 防线战报（昨天打我防线的全部挑战，复仇战同样计入防守经验）
      const { data: defenses } = await admin
        .from('arena_battles')
        .select('attacker_won')
        .eq('season_id', seasonId)
        .eq('defender_id', userId)
        .eq('day_key', dayKey);
      const challenged = (defenses ?? []).length;
      const held = (defenses ?? []).filter((b) => b.attacker_won === false).length;
      const broken = challenged - held;
      const defenseReward = Math.min(
        held * ARENA_DEFENSE_REWARD_HELD + broken * ARENA_DEFENSE_REWARD_BROKEN,
        ARENA_DEFENSE_REWARD_DAILY_CAP,
      );

      // 段位奖励箱（§4.2：星辉匣全段位，圣痕匣绯樱及以上）
      const boxes: ReturnType<typeof rollBox>[] = [];
      let boxIndex = 0;
      for (let i = 0; i < tier.dailyBoxes.starlight; i++) {
        boxes.push(rollBox('box_starlight', userId, dayKey, boxIndex++));
      }
      for (let i = 0; i < tier.dailyBoxes.sacred; i++) {
        boxes.push(rollBox('box_sacred', userId, dayKey, boxIndex++));
      }
      const boxHonor = boxes.reduce((sum, box) => sum + box.honor, 0);
      const honorDelta = tier.dailyHonor + defenseReward + boxHonor;

      const payload = {
        tier: tier.id,
        tierName: tier.name,
        rank,
        total,
        tierHonor: tier.dailyHonor,
        defense: { challenged, held, reward: defenseReward },
        boxes,
      };

      const { data: applied, error: applyError } = await admin.rpc('arena_apply_settle', {
        p_season_id: seasonId,
        p_user_id: userId,
        p_day_key: dayKey,
        p_tier: tier.id,
        p_honor_delta: honorDelta,
        p_payload: payload,
      });
      if (applyError) throw new Error(`结算落库失败（${userId}）：${applyError.message}`);
      if (applied === true) settled++;
      else skipped++;
    }

    return json({ dayKey, total: players.length, settled, skipped });
  } catch (error) {
    return json({ error: `每日结算失败：${(error as Error).message}` }, 500);
  }
});
