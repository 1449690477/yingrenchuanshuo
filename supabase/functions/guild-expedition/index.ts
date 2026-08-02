/**
 * guild-expedition —— 公会共享首领状态与挑战。
 * 客户端只提交角色搭配，伤害和贡献只由服务端共享 core 复算。
 */

import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { z } from 'zod';
import {
  buildProfileProgress,
  buildTrialCombatant,
  CLASS_IDS,
  equipmentInstanceSchema,
  getEquipment,
  GUILD_DAILY_SUBMISSIONS,
  GUILD_WEEK_CLEAR_REPUTATION,
  GUILD_WEEKLY_TARGET_PER_MEMBER,
  guildCompletedCommissions,
  guildContributionPoints,
  guildDayKey,
  guildExpeditionBoss,
  guildRunSeed,
  guildWeekKey,
  runTrial,
  SLOT_ORDER,
  TRIAL_SEASON_ID,
  trialBracketFor,
  trialEquipmentSnapshotIssue,
  trialWeekIndex,
} from './_core.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const stateSchema = z
  .object({
    action: z.literal('state'),
    seasonId: z.string().min(1).max(16),
    level: z.number().int().min(1).max(120),
  })
  .strict();

const challengeSchema = z
  .object({
    action: z.literal('challenge'),
    requestId: z.string().uuid(),
    seasonId: z.string().min(1).max(16),
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

const requestSchema = z.discriminatedUnion('action', [stateSchema, challengeSchema]);

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

async function initState(admin: SupabaseClient, userId: string, seasonId: string, now: number) {
  const weekIndex = trialWeekIndex(now);
  const weekKey = guildWeekKey(seasonId, now);
  const { data, error } = await admin.rpc('guild_init_expedition', {
    p_user_id: userId,
    p_season_id: seasonId,
    p_week_index: weekIndex,
    p_week_key: weekKey,
    p_target_per_member: GUILD_WEEKLY_TARGET_PER_MEMBER,
  });
  if (error) throw new Error(error.message);
  return { data, weekIndex, weekKey };
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
    if (userError || !user) return json({ error: '登录状态无效，请重新打开公会' }, 401);

    const parsed = requestSchema.safeParse(await req.json());
    if (!parsed.success) return json({ error: '远征请求不合法' }, 400);
    const body = parsed.data;
    if (body.seasonId !== TRIAL_SEASON_ID) {
      return json({ error: '远征赛季已经更新，请刷新页面后重试' }, 409);
    }
    const admin = createClient(supabaseUrl, serviceKey);
    const now = Date.now();
    const initialized = await initState(admin, user.id, TRIAL_SEASON_ID, now);
    const bracket = trialBracketFor(body.level);
    const boss = guildExpeditionBoss(TRIAL_SEASON_ID, initialized.weekIndex, bracket.id);
    const dayKey = guildDayKey(now);
    const guildId = String(initialized.data.guildId);
    const { data: today } = await admin
      .from('guild_contributions')
      .select('attempts, best_points')
      .eq('guild_id', guildId)
      .eq('week_key', initialized.weekKey)
      .eq('day_key', dayKey)
      .eq('user_id', user.id)
      .maybeSingle();

    const baseState = {
      ...initialized.data,
      boss: {
        name: boss.name,
        element: boss.combatant.element,
        tiltId: boss.tilt.id,
        tiltName: boss.tilt.name,
        hint: boss.tilt.hint,
        bracketId: bracket.id,
        bracketName: bracket.name,
      },
      today: {
        attemptsUsed: Number(today?.attempts ?? 0),
        attemptsMax: GUILD_DAILY_SUBMISSIONS,
        bestPoints: Number(today?.best_points ?? 0),
      },
    };
    if (body.action === 'state') return json(baseState);

    // 次数上限由原子 RPC 判断；函数层不能预拒绝，否则第三次请求超时后无法用同一 requestId 幂等重试。
    for (let index = 0; index < SLOT_ORDER.length; index++) {
      const instance = body.equipped[index];
      if (!instance) continue;
      const definition = getEquipment(instance.defId);
      if (!definition || definition.slot !== SLOT_ORDER[index]) {
        return json({ error: '装备槽位或定义不合法' }, 400);
      }
      if (trialEquipmentSnapshotIssue(instance, body.classId, body.level)) {
        return json({ error: '装备等级、职业或词条不符合生成规则' }, 400);
      }
    }

    const build = buildTrialCombatant({
      selectedActiveSkillIds: sub.selectedActiveSkillIds,
      name: body.displayName,
      classId: body.classId,
      level: body.level,
      equipped: body.equipped,
    });
    const requestBuildHash = `${body.classId}:${body.level}:${build.buildHash}`;
    const { data: previousRequest, error: previousRequestError } = await admin
      .from('guild_submission_requests')
      .select('build_hash, submission_index')
      .eq('request_id', body.requestId)
      .eq('user_id', user.id)
      .maybeSingle();
    if (previousRequestError) throw new Error(previousRequestError.message);
    if (previousRequest && previousRequest.build_hash !== requestBuildHash) {
      return json({ error: '同一远征请求不能更换角色搭配，请重新发起挑战' }, 409);
    }
    const submissionIndex = Number(
      previousRequest?.submission_index ?? Number(today?.attempts ?? 0) + 1,
    );
    const seed = guildRunSeed(
      TRIAL_SEASON_ID,
      initialized.weekIndex,
      user.id,
      dayKey,
      submissionIndex,
      requestBuildHash,
    );
    const battle = runTrial(build, boss.combatant, seed);
    const points = guildContributionPoints(battle.damage, battle.bossHpMax);

    const { data: applied, error: applyError } = await admin.rpc('guild_apply_contribution', {
      p_user_id: user.id,
      p_week_key: initialized.weekKey,
      p_day_key: dayKey,
      p_request_id: body.requestId,
      p_points: points,
      p_build_hash: requestBuildHash,
      p_max_submissions: GUILD_DAILY_SUBMISSIONS,
      p_clear_reputation: GUILD_WEEK_CLEAR_REPUTATION,
    });
    if (applyError) return json({ error: applyError.message }, 409);

    // 功勋金额不由 Edge 或客户端传值；数据库从本次已落库的远征增量自行换算。
    const { error: meritError } = await admin.rpc('guild_award_merit', {
      p_user_id: user.id,
      p_request_id: body.requestId,
    });
    if (meritError) {
      throw new Error(`公会功勋结算失败：${meritError.message}`);
    }

    // 委托只接受本函数刚刚复算出的 points；同一 request 可以依次解锁多个档位。
    // 新函数必须在迁移之后部署；此处抛错会让客户端保留 requestId 幂等补账。
    for (const commission of guildCompletedCommissions(points)) {
      const { error: commissionError } = await admin.rpc('guild_apply_commission', {
        p_user_id: user.id,
        p_day_key: dayKey,
        p_commission_id: commission.id,
        p_request_id: body.requestId,
        p_points: points,
      });
      if (commissionError) {
        throw new Error(`公会委托结算失败：${commissionError.message}`);
      }
    }

    // 只读取已完成的日建设账，按业务日和赛季做一次来源去重。
    const { error: strongholdError } = await admin.rpc('guild_apply_commission_stronghold', {
      p_user_id: user.id,
      p_day_key: dayKey,
      p_season_id: TRIAL_SEASON_ID,
    });
    if (strongholdError) {
      throw new Error(`公会据点结算失败：${strongholdError.message}`);
    }

    // 战力与公式版本戳同批写入（见 core/profileProgress.ts）：
    // 只改数不改戳会留下「合法的戳 + 错尺的数」，那种行筛得过、显示正常、没人看得出错。
    await admin
      .from('profiles')
      .update(
        buildProfileProgress({
          classId: body.classId,
          level: body.level,
          combatPower: build.combatPower,
        }),
      )
      .eq('id', user.id);

    const refreshed = await initState(admin, user.id, TRIAL_SEASON_ID, now);
    return json({
      ...baseState,
      ...refreshed.data,
      today: {
        attemptsUsed: Number(applied.attemptsUsed),
        attemptsMax: GUILD_DAILY_SUBMISSIONS,
        bestPoints: Number(applied.bestPoints),
      },
      result: {
        ...applied,
        damage: battle.damage,
        damageTaken: battle.damageTaken,
        survived: battle.survived,
        durationSec: battle.durationSec,
        combatPower: build.combatPower,
      },
    });
  } catch (error) {
    return json({ error: `公会远征暂时无法连接：${(error as Error).message}` }, 500);
  }
});
