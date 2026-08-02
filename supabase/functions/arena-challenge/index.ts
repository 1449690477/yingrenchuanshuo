/**
 * arena-challenge —— 发起挑战（docs/52 §三 核心循环、§五 对决结算）。
 *
 * 反作弊边界（与 submit-trial 同一套）：
 *   客户端只提交「我要挑战谁、押多少、我当前的搭配快照」——
 *   胜负由服务端取双方快照、用同一份 src/core 复算出来（§5.3），
 *   伪造战斗结果在结构上不可能。
 *
 * 结算全部在 arena_apply_battle 存储过程的单事务里完成：
 *   赢 → 荣誉 += 押注 × 排名差倍率 × 连胜倍率，顶替排名（区间下移）
 *   输 → 荣誉 -= 押注，连胜归零，排名不动
 *
 * 部署前必须先运行：npm run edge:build（生成 _core.ts）
 */

import { createClient } from '@supabase/supabase-js';
import { z } from 'zod';
import {
  ARENA_DAILY_CHALLENGES,
  ARENA_REVENGE_WINDOW_HOURS,
  ARENA_SAME_OPPONENT_DAILY_LIMIT,
  ARENA_STAKES,
  arenaDayKey,
  arenaTierFor,
  arenaVictoryHonor,
  buildArenaDuelSide,
  buildProfileProgress,
  CLASS_IDS,
  duelSeed,
  equipmentInstanceSchema,
  getEquipment,
  Rng,
  simulateDuel,
  SLOT_ORDER,
  trialEquipmentSnapshotIssue,
  type DuelSide,
} from './_core.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const challengeSchema = z
  .object({
    seasonId: z.string().min(1).max(16),
    defenderId: z.string().uuid(),
    /** 普通挑战押注档位；复仇（isRevenge）不需要押注，必须传 0（§六） */
    stake: z.number().int().min(0),
    isRevenge: z.boolean().optional(),
    classId: z.enum(CLASS_IDS),
    level: z.number().int().min(1).max(120),
    displayName: z.string().min(1).max(20),
    equipped: z.array(equipmentInstanceSchema.nullable()).length(8),
    /**
     * 挑战方选定的主动技能栏（M3-5）。**可选**：老客户端不发，回落职业默认顺序。
     * 内容合法性交给 core 的 resolveActiveSkillSlots 逐项过滤，不在 schema 里拒绝。
     */
    selectedActiveSkillIds: z.array(z.string().min(1).max(64)).max(32).optional(),
  })
  .strict()
  .superRefine((v, ctx) => {
    if (v.isRevenge) {
      if (v.stake !== 0) ctx.addIssue({ code: 'custom', message: '复仇不需要押注' });
    } else if (!(ARENA_STAKES as readonly number[]).includes(v.stake)) {
      ctx.addIssue({ code: 'custom', message: '非法押注档位' });
    }
  });

const storedSnapshotSchema = z
  .object({
    classId: z.enum(CLASS_IDS),
    level: z.number().int().min(1).max(120),
    displayName: z.string().min(1).max(20),
    equipped: z.array(equipmentInstanceSchema.nullable()).length(8),
    /**
     * 玩家选定的主动技能栏（M3-5）。**可选**：老客户端不发，回落职业默认顺序。
     * 内容合法性不在 schema 里判，交给 core 的 resolveActiveSkillSlots 逐项过滤 ——
     * 在这里拒绝会让「技能表改名后存档存着旧 id」的玩家每次都被打回。
     */
    selectedActiveSkillIds: z.array(z.string().min(1).max(64)).max(32).optional(),
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
    const parsed = challengeSchema.safeParse(await req.json());
    if (!parsed.success) return json({ error: '挑战请求不合法' }, 400);
    const sub = parsed.data;
    if (sub.defenderId === user.id) return json({ error: '不能挑战自己' }, 400);

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

    const myBuild = buildArenaDuelSide(
      {
        name: sub.displayName,
        classId: sub.classId,
        level: sub.level,
        equipped: sub.equipped,
        selectedActiveSkillIds: sub.selectedActiveSkillIds,
      },
      'attacker',
    );

    // ── 3. 规则校验（次数 / 荣誉 / 排名方向 / 同对手限制）──
    const admin = createClient(supabaseUrl, serviceKey);
    const dayKey = arenaDayKey(Date.now());

    const [{ data: myRow }, { data: defRow }] = await Promise.all([
      admin
        .from('arena_ranks')
        .select('rank, honor, win_streak')
        .eq('season_id', sub.seasonId)
        .eq('user_id', user.id)
        .maybeSingle(),
      admin
        .from('arena_ranks')
        .select('rank, build_snapshot')
        .eq('season_id', sub.seasonId)
        .eq('user_id', sub.defenderId)
        .maybeSingle(),
    ]);
    if (!myRow) return json({ error: '尚未进入竞技场，请先上传搭配' }, 400);
    if (!defRow) return json({ error: '对手已不在排名中，请刷新候选' }, 409);
    if (Number(defRow.rank) >= Number(myRow.rank)) {
      return json({ error: '只能挑战排名在自己上方的对手' }, 400);
    }

    const isRevenge = sub.isRevenge === true;
    if (!isRevenge && Number(myRow.honor) < sub.stake) {
      return json({ error: '荣誉印记不足' }, 400);
    }

    const { data: todayBattles } = await admin
      .from('arena_battles')
      .select('defender_id')
      .eq('attacker_id', user.id)
      .eq('day_key', dayKey)
      .eq('is_revenge', false);
    const attemptsToday = (todayBattles ?? []).length;

    if (isRevenge) {
      // 复仇窗口（§六）：24 小时内对方攻破过我的防线，且该次机会未被消耗
      const windowStart = new Date(
        Date.now() - ARENA_REVENGE_WINDOW_HOURS * 3_600_000,
      ).toISOString();
      const [{ data: beaten }, { data: revenged }] = await Promise.all([
        admin
          .from('arena_battles')
          .select('created_at')
          .eq('defender_id', user.id)
          .eq('attacker_id', sub.defenderId)
          .eq('attacker_won', true)
          .eq('is_revenge', false)
          .gt('created_at', windowStart)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle(),
        admin
          .from('arena_battles')
          .select('created_at')
          .eq('attacker_id', user.id)
          .eq('defender_id', sub.defenderId)
          .eq('is_revenge', true)
          .gt('created_at', windowStart)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle(),
      ]);
      const beatenAt = beaten?.created_at as string | undefined;
      const revengedAt = revenged?.created_at as string | undefined;
      if (!beatenAt || (revengedAt && revengedAt > beatenAt)) {
        return json({ error: '反击机会不存在或已过期' }, 400);
      }
    } else {
      if (attemptsToday >= ARENA_DAILY_CHALLENGES) {
        return json({ error: '今日挑战次数已用完，明天见' }, 400);
      }
      const sameOpponent = (todayBattles ?? []).filter(
        (b) => b.defender_id === sub.defenderId,
      ).length;
      if (sameOpponent >= ARENA_SAME_OPPONENT_DAILY_LIMIT) {
        return json({ error: '今天已经挑战过这位对手了' }, 400);
      }
    }

    const defSnap = storedSnapshotSchema.safeParse(defRow.build_snapshot);
    if (!defSnap.success) return json({ error: '对手搭配数据异常，请刷新候选' }, 409);
    for (let i = 0; i < SLOT_ORDER.length; i++) {
      const inst = defSnap.data.equipped[i];
      if (!inst) continue;
      const def = getEquipment(inst.defId);
      if (
        !def ||
        def.slot !== SLOT_ORDER[i] ||
        trialEquipmentSnapshotIssue(inst, defSnap.data.classId, defSnap.data.level)
      ) {
        return json({ error: '对手搭配数据异常，请刷新候选' }, 409);
      }
    }
    const defBuild = buildArenaDuelSide(
      {
        name: defSnap.data.displayName,
        classId: defSnap.data.classId,
        level: defSnap.data.level,
        equipped: defSnap.data.equipped,
        // 防守方是离线的，只能用他上传快照时选定的技能栏重建（arena-snapshot 已存进快照）。
        // 老快照没有这个字段 ⇒ undefined ⇒ 回落默认顺序，与本次改动前逐字一致。
        selectedActiveSkillIds: defSnap.data.selectedActiveSkillIds,
      },
      'defender',
    );

    // ── 4. 服务端复算对决（§5.3：客户端不提交胜负）──
    // 普通挑战按当日序号生成种子；复仇用独立序号空间（1001+），避免与同日普通挑战种子碰撞
    let attemptIndex = attemptsToday + 1;
    if (isRevenge) {
      const { data: todayRevenges } = await admin
        .from('arena_battles')
        .select('id')
        .eq('attacker_id', user.id)
        .eq('day_key', dayKey)
        .eq('is_revenge', true);
      attemptIndex = 1000 + (todayRevenges ?? []).length + 1;
    }
    const seed = duelSeed(user.id, sub.defenderId, dayKey, attemptIndex);
    const attacker: DuelSide = {
      combatant: myBuild.combatant,
      skillMultiplier: myBuild.skillMultiplier,
      onHitTriggers: myBuild.onHitTriggers,
    };
    const defender: DuelSide = {
      combatant: defBuild.combatant,
      skillMultiplier: defBuild.skillMultiplier,
      onHitTriggers: defBuild.onHitTriggers,
    };
    const result = simulateDuel(attacker, defender, new Rng(seed));
    const won = result.winner === 'attacker';

    // ── 5. 结算（单事务：押注 / 荣誉 / 顶替 / 战报）──
    // 先刷新我的防守快照（挑战时携带的就是当前搭配，顺手保持防守同步）
    await admin
      .from('arena_ranks')
      .update({
        build_snapshot: {
          classId: sub.classId,
          level: sub.level,
          displayName: sub.displayName,
          equipped: sub.equipped,
        },
        combat_power: myBuild.combatPower,
        updated_at: new Date().toISOString(),
      })
      .eq('season_id', sub.seasonId)
      .eq('user_id', user.id);
    // 与 submit-trial 同一口径：display_name 只在首次建档时写入，后续不覆盖自设昵称。
    // 战力与公式版本戳同批写入（见 core/profileProgress.ts）：
    // 只改数不改戳会留下「合法的戳 + 错尺的数」，那种行筛得过、显示正常、没人看得出错。
    const profileProgress = buildProfileProgress({
      classId: sub.classId,
      level: sub.level,
      combatPower: myBuild.combatPower,
    });
    await admin.from('profiles').upsert(
      { id: user.id, display_name: sub.displayName, ...profileProgress },
      { onConflict: 'id', ignoreDuplicates: true },
    );
    await admin.from('profiles').update(profileProgress).eq('id', user.id);

    const rankDiff = Number(myRow.rank) - Number(defRow.rank);
    const newStreak = won ? Number(myRow.win_streak) + 1 : 0;
    // 荣誉净变化：赢 = +奖励（押注本身退还，收支相抵）；输 = −押注
    // 复仇反击零成本：无押注无奖励，荣誉不变（§六）
    const honorDelta = isRevenge ? 0 : won ? arenaVictoryHonor(sub.stake, rankDiff, newStreak) : -sub.stake;

    const { data: applied, error: applyError } = await admin.rpc('arena_apply_battle', {
      p_season_id: sub.seasonId,
      p_attacker_id: user.id,
      p_defender_id: sub.defenderId,
      p_day_key: dayKey,
      p_attempt_index: attemptIndex,
      p_stake: sub.stake,
      p_attacker_won: won,
      p_honor_delta: honorDelta,
      p_battle_log: result.log,
      p_is_revenge: isRevenge,
    });
    if (applyError) {
      const msg = applyError.message ?? '';
      if (msg.includes('must be below')) return json({ error: '排名已变动，请刷新候选' }, 409);
      if (msg.includes('duplicate')) return json({ error: '请求重复，请刷新状态' }, 409);
      throw new Error(`结算失败：${msg}`);
    }
    const settled = Array.isArray(applied) ? applied[0] : applied;

    const { count: totalCount } = await admin
      .from('arena_ranks')
      .select('user_id', { count: 'exact', head: true })
      .eq('season_id', sub.seasonId);
    const total = Math.max(1, totalCount ?? 1);
    const rankAfter = Number(settled?.attacker_rank_after ?? myRow.rank);

    return json({
      won,
      reason: result.reason,
      honorDelta,
      honor: Number(settled?.attacker_honor ?? 0),
      rankBefore: Number(settled?.attacker_rank_before ?? myRow.rank),
      rankAfter,
      winStreak: Number(settled?.attacker_win_streak ?? 0),
      tier: arenaTierFor(rankAfter, total).id,
      // 复仇不占每日次数：attemptsLeft 按普通挑战已用次数计算
      attemptsLeft: Math.max(0, ARENA_DAILY_CHALLENGES - (isRevenge ? attemptsToday : attemptIndex)),
      battle: {
        durationSec: result.durationSec,
        attackerHpRemainPct: result.attackerHpRemainPct,
        defenderHpRemainPct: result.defenderHpRemainPct,
        attackerDamage: result.attackerDamage,
        defenderDamage: result.defenderDamage,
        log: result.log,
      },
    });
  } catch (error) {
    return json({ error: `服务端复算失败：${(error as Error).message}` }, 500);
  }
});
