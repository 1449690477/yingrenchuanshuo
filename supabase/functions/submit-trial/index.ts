/**
 * submit-trial —— 周常试炼成绩提交（docs/51 §6.3 服务端复算）。
 *
 * 这是整套反作弊的核心，流程：
 *   1. 校验玩家身份（匿名登录 JWT）
 *   2. 客户端只提交【搭配快照】（职业/等级/八件装备实例），没有伤害数字
 *   3. 用与客户端完全相同的 src/core 代码（_core.ts，由
 *      scripts/build-edge-function.mjs 打包）重算这场 60 秒战斗
 *   4. 伤害由服务端产生，写入 trial_scores —— 客户端根本没有机会伪造它
 *
 * 务实分级（§6.3 威胁模型）：
 *   L1 服务端复算伤害            ✅ 本函数
 *   L2 装备结构/取值 schema 校验  ✅ equipmentInstanceSchema
 *   L3 等级/职业/词条公式硬校验   ✅ trialEquipmentSnapshotIssue
 *   L5 服务端权威存档            ❌ 后续阶段（伪造「合法但未获得的装备」挡不住）
 *
 * 部署前必须先运行：npm run edge:build（生成 _core.ts）
 */

import { createClient } from '@supabase/supabase-js';
import { z } from 'zod';
import {
  buildTrialCombatant,
  CLASS_IDS,
  decideTrialScoreWrite,
  equipmentInstanceSchema,
  getEquipment,
  runTrial,
  SLOT_ORDER,
  TRIAL_SEASON_ID,
  trialBracketFor,
  trialEquipmentSnapshotIssue,
  trialScoreSeed,
  trialWeekIndex,
  weeklyTrialBoss,
} from './_core.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const submissionSchema = z
  .object({
    // 这三个字段保留接收以兼容各版本客户端，但取值一律忽略——
    // 赛季 / 周次 / 分段由服务端权威决定（见下方注释）。
    seasonId: z.string().min(1).max(16),
    weekIndex: z.number().int().nonnegative(),
    bracketId: z.string().min(1),
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

    // ── 2. 载荷结构与取值（L2）──
    const body = await req.json();
    const parsed = submissionSchema.safeParse(body);
    if (!parsed.success) return json({ error: '提交的搭配快照不合法' }, 400);
    const sub = parsed.data;

    // 赛季 / 周次 / 分段一律以服务端为准，客户端自报值仅作参考、永不拒绝。
    //
    // 安全性论证（docs/51 §6.3）：伤害由服务端现算，种子只依赖
    // season + week + bracket + buildHash；周次与分段由服务端自己定，
    // 客户端无论报什么都无法穿越到已结算周次刷榜，也无法跨段偷奖励。
    // 之前「客户端报值 ≠ 服务端值 → 400」的两个校验是纯误伤源：
    // 设备时钟有偏差、或 PWA 旧缓存里分段口径不同的真实玩家会被挡在榜外。
    const serverWeek = trialWeekIndex(Date.now());
    const serverBracketId = trialBracketFor(sub.level).id;

    // 槽位、等级、职业与词条公式硬限制（schema 只保证单件基础结构）
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

    // ── 3. 服务端复算（与客户端同一份 core，逐点一致）──
    const build = buildTrialCombatant({
      name: sub.displayName,
      classId: sub.classId,
      level: sub.level,
      equipped: sub.equipped,
    });
    const boss = weeklyTrialBoss(TRIAL_SEASON_ID, serverWeek, serverBracketId);
    const seed = trialScoreSeed(TRIAL_SEASON_ID, serverWeek, serverBracketId, build.buildHash);
    const damage = runTrial(build, boss.combatant, seed).damage;

    // ── 4. 审核结论 ──
    // 走到这里的快照已通过全部可证明的硬校验，伤害也由服务端亲自复算。
    // 匿名账号创建时间不等于玩家存档年龄；平均战力也不等于合法上限。
    // 两者都不能作为拒绝真实成绩的证据。
    const verified = true;

    // ── 5. 写入（service role；成绩表对客户端无写权限）──
    const admin = createClient(supabaseUrl, serviceKey);
    const profileProgress = {
      class_id: sub.classId,
      level: sub.level,
      combat_power: build.combatPower,
      updated_at: new Date().toISOString(),
    };
    const { error: createProfileError } = await admin.from('profiles').upsert(
      {
        id: user.id,
        // 只在首次建档时使用角色名；已有档案的自设昵称绝不能被成绩上传覆盖。
        display_name: sub.displayName,
        ...profileProgress,
      },
      { onConflict: 'id', ignoreDuplicates: true },
    );
    if (createProfileError) return json({ error: '档案初始化失败' }, 500);

    const { error: updateProfileError } = await admin
      .from('profiles')
      .update(profileProgress)
      .eq('id', user.id);
    if (updateProfileError) return json({ error: '档案同步失败' }, 500);

    const { data: existing } = await admin
      .from('trial_scores')
      .select('id, damage, verified')
      .eq('user_id', user.id)
      .eq('season_id', TRIAL_SEASON_ID)
      .eq('week_index', serverWeek)
      .eq('bracket_id', serverBracketId)
      .maybeSingle();

    // 永不倒退：只保留每人每周每分段的最好成绩。
    // 同分重提可修复旧版错误阈值留下的 verified=false，不允许低分洗白高分。
    const decision = decideTrialScoreWrite(
      existing
        ? {
            damage: Number(existing.damage),
            verified: existing.verified === true,
          }
        : null,
      damage,
      verified,
    );
    if (decision.action === 'insert') {
      const { error: scoreError } = await admin.from('trial_scores').insert({
        user_id: user.id,
        season_id: TRIAL_SEASON_ID,
        week_index: serverWeek,
        bracket_id: serverBracketId,
        class_id: sub.classId,
        damage,
        build_hash: build.buildHash,
        verified,
      });
      if (scoreError) return json({ error: '成绩写入失败' }, 500);
    } else if (decision.action === 'replace') {
      const { error: scoreError } = await admin
        .from('trial_scores')
        .update({
          damage,
          build_hash: build.buildHash,
          verified,
          created_at: new Date().toISOString(),
        })
        .eq('id', existing.id);
      if (scoreError) return json({ error: '成绩更新失败' }, 500);
    } else if (decision.action === 'reverify') {
      const { error: scoreError } = await admin
        .from('trial_scores')
        .update({
          build_hash: build.buildHash,
          verified: true,
          created_at: new Date().toISOString(),
        })
        .eq('id', existing.id);
      if (scoreError) return json({ error: '成绩复核状态更新失败' }, 500);
    }

    // ── 6. 名次（同职业子榜内；未通过复核不入榜）──
    let rank = 0;
    let total = 0;
    if (decision.bestVerified) {
      const board = () =>
        admin
          .from('trial_scores')
          .select('id', { count: 'exact', head: true })
          .eq('season_id', TRIAL_SEASON_ID)
          .eq('week_index', serverWeek)
          .eq('bracket_id', serverBracketId)
          .eq('class_id', sub.classId)
          .eq('verified', true);
      const { count: totalCount } = await board();
      const { count: betterCount } = await board().gt('damage', decision.bestDamage);
      rank = (betterCount ?? 0) + 1;
      total = totalCount ?? 0;
    }

    return json({
      damage: decision.bestDamage,
      rank,
      total,
      verified: decision.bestVerified,
      improved: decision.improved,
    });
  } catch (error) {
    return json({ error: `服务端复算失败：${(error as Error).message}` }, 500);
  }
});
