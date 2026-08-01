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
  buildCheatEvidenceRow,
  buildProfileProgress,
  buildTrialCombatant,
  CLASS_IDS,
  decideTrialScoreWrite,
  equipmentInstanceSchema,
  getEquipment,
  isPlausibleTrialDamage,
  judgeCheatEvidence,
  runTrial,
  SLOT_ORDER,
  TRIAL_SEASON_ID,
  trialBracketDamageCeiling,
  trialBracketFor,
  trialEquipmentSnapshotIssue,
  trialScoreSeed,
  trialWeekIndex,
  weeklyTrialBoss,
} from './_core.ts';
import type { CheatEvidenceInput } from './_core.ts';

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

/**
 * 记录一条作弊证据（docs/78）。与 sync-profile 里那份同构：
 * 分级判定全在 core 的 judgeCheatEvidence，这里只负责 IO，
 * 且**写证据永远不能影响判定本身** —— 落库失败最多丢一条遥测。
 */
/**
 * 档案新鲜到可以拿它的等级当「点名依据」吗？
 *
 * 判据的上界由 profiles.level 算出，而档案同步与成绩提交是两次独立请求 ——
 * 中间玩家可能已经升了级。档案越旧、上界越低，**正常玩家越像作弊**。
 * 所以只有档案是刚刚同步过的，才允许据此自动公开点名；否则只记录待复核。
 *
 * 窗口取 10 分钟：提交成绩前客户端会先同步档案，正常路径下两者相隔数秒；
 * 10 分钟足够覆盖网络重试与时钟偏差，又远短于「玩家能升一整段」的时间。
 * 取不到时间戳一律当作不新鲜 —— 拿不准时选择不点名。
 */
const PROFILE_FRESH_WINDOW_MS = 10 * 60 * 1000;

function profileIsFresh(updatedAt: unknown): boolean {
  if (typeof updatedAt !== 'string') return false;
  const t = Date.parse(updatedAt);
  if (!Number.isFinite(t)) return false;
  const age = Date.now() - t;
  // 未来时间戳同样可疑（时钟偏差或写入异常），一并当作不新鲜。
  return age >= 0 && age <= PROFILE_FRESH_WINDOW_MS;
}

async function recordCheatEvidence(
  admin: ReturnType<typeof createClient>,
  userId: string,
  evidence: CheatEvidenceInput,
): Promise<void> {
  try {
    const { count } = await admin
      .from('cheat_evidence')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('published', true)
      .is('cleared_at', null);

    const verdict = judgeCheatEvidence({ ...evidence, priorEvidenceCount: count ?? 0 });
    if (!verdict.isProven) return;

    await admin.from('cheat_evidence').insert(
      buildCheatEvidenceRow({
        userId,
        evidence,
        verdict,
        bundleVersion: Deno.env.get('CORE_BUNDLE_VERSION') ?? 'unknown',
      }),
    );
    if (verdict.shouldPublish) {
      await admin.rpc('demote_cheater_board_rows', { p_user_id: userId });
    }
  } catch (_error) {
    // 静默：证据是附加产物，不参与业务判定。
  }
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
    //
    // ★ 但有一条**可证明**的：上面每一步都建立在客户端自报的 sub.level 上
    //   —— 分段 Boss、角色组建、装备越级校验三者同源，于是它们互相自洽，
    //   报 Lv81 + 一套 Lv81 装备处处都过。2026-07-30 线上就这样被绕过：
    //   真实档案 Lv13/战力1593 的账号提交出 1,489,904 伤害，
    //   而 Lv13 所在分段的 Boss 总血量只有 97,404。
    //
    //   判据必须换一把**不受本次提交影响**的尺子：profiles.level ——
    //   它由 sync-profile 从真实存档写入。用它算「这个玩家在他真实等级上
    //   最多能打出多少」，超了就是物理不可能（docs/78 §六）。
    const admin = createClient(supabaseUrl, serviceKey);
    const { data: authoritative } = await admin
      .from('profiles')
      .select('level, class_id, updated_at')
      .eq('id', user.id)
      .maybeSingle();

    let verified = true;
    // 没有档案 = 首次提交，没有可比对的权威值，此时放行（下次同步后即可比对）。
    if (authoritative && typeof authoritative.level === 'number') {
      const authLevel = authoritative.level;
      if (!isPlausibleTrialDamage(damage, authLevel, sub.classId, serverWeek)) {
        verified = false;
        await recordCheatEvidence(admin, user.id, {
          source: 'submit-trial',
          claimField: 'trial_damage',
          claimedValue: damage,
          // 与 isPlausibleTrialDamage 用的是同一把尺（段顶），否则榜上写的上界
          // 会不是真正判它的那个数 —— 今晚反复出现的「验的对象不是用的对象」。
          boundValue: trialBracketDamageCeiling(authLevel, sub.classId, serverWeek),
          boundKind: 'upper',
          priorEvidenceCount: 0,
          // ★ 档案陈旧时只记录、不点名。档案里的等级偏旧 → 上界偏低 →
          // 正常玩家看起来像越界，而倍率越高越像铁证 —— 那正是循环论证。
          boundTrustworthy: profileIsFresh(authoritative.updated_at),
        });
      }
    }

    // ── 5. 写入（service role；成绩表对客户端无写权限）──
    // 战力与公式版本戳同批写入（见 core/profileProgress.ts）：
    // 只改数不改戳会留下「合法的戳 + 错尺的数」，那种行筛得过、显示正常、没人看得出错。
    const profileProgress = buildProfileProgress({
      classId: sub.classId,
      level: sub.level,
      combatPower: build.combatPower,
    });
    // ★ 判为不可信时**绝不把自报进度写进档案** —— 档案是下一次判定的尺子，
    //   让伪造值写进去等于亲手把尺子弄弯（2026-07-30 那次绕过的关键一环：
    //   伪造的 Lv81 先写进 profiles，后续判定便再也无从比对）。
    //   成绩本身照常入库（verified=false，移出展示但保留待审）。
    const shouldWriteProfile = verified;
    if (shouldWriteProfile) {
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
    }

    if (shouldWriteProfile) {
      const { error: updateProfileError } = await admin
        .from('profiles')
        .update(profileProgress)
        .eq('id', user.id);
      if (updateProfileError) return json({ error: '档案同步失败' }, 500);
    }

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
