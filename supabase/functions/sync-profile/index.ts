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
  buildCheatEvidenceRow,
  buildProfileProgress,
  buildTrialCombatant,
  CLASS_IDS,
  combatPowerCeiling,
  equipmentInstanceSchema,
  getEquipment,
  isPlausibleCombatPower,
  STRUCTURAL_MAX_LEVEL,
  judgeCheatEvidence,
  SLOT_ORDER,
  trialEquipmentSnapshotIssue,
} from './_core.ts';
import type { CheatEvidenceInput } from './_core.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// 载荷里**没有 combatPower** —— 那正是本函数的全部意义。
const submissionSchema = z
  .object({
    classId: z.enum(CLASS_IDS),
    // 结构上的荒谬值仍然直接拒（负数、超过 120），但**超出内容可达上限的等级
    // 不在这里拒** —— 见下面 effectiveLevel 那一段：拒绝会把线上已经存在的
    // 两行 level=100 档案永久锁死，钳制不会。
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
 * 记录一条作弊证据（docs/78）。
 *
 * 分级判定全在 core 的 judgeCheatEvidence 里，这里只负责 IO。
 * **写证据永远不能影响拒绝本身**：拒绝已经发生了，证据落库失败最多丢一条遥测，
 * 绝不能因此把一个已经判定非法的提交放行，也不能把异常抛给玩家。
 */
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

    // 公开的那一刻，把该玩家的历史成绩从所有正常榜单移出（只移出展示，不删数据）。
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

    // ── 2. 载荷结构 ──
    const parsed = submissionSchema.safeParse(await req.json());
    if (!parsed.success) return json({ error: '提交的搭配快照不合法' }, 400);
    const sub = parsed.data;

    // ── 2.5 等级钳制到内容可达上限（2026-08-01，小榜报、小督定形态）──
    // level 是战力上界与试炼伤害上界的**自变量**，而它完全由客户端上报、
    // 此前只有 max(120) 的范围校验 —— 而玩家实际能到的最高等级是 81
    // （210 关最高 Lv78 + 软上限余量）。**中间 39 级空档**：谁都可以报 Lv120，
    // 把自己的上界抬到内容顶之上；小督实测该空档足以让试炼判据整个失效
    // （Lv120 → 王冠段段顶上界 2,234,856 > Boss 满血 1,489,904，怎么伪造都在界内）。
    //
    // ★ 为什么是钳制不是拒绝 —— 这一条是小督 09:14 纠正我的，他对：
    // 我第一版写的是 z.max(STRUCTURAL_MAX_LEVEL)，也就是直接 400。
    // 但线上**已经存在**两行 level=100 的档案（07-30 客户端还能直写时留下的），
    // 拒绝会让它们**每次同步都被打回，确定性地、永远同步不上去** ——
    // 那正是今晚反复批评的那种坏法：用一条防作弊的线把账号锁死。
    // 钳制则：真人（≤81）完全无感；伪造者报多高都只按 81 结算，上界抬不起来；
    // **那两行坏数据还会在下一次同步时被自动改写成 81 + 正确战力，自愈。**
    //
    // 钳制不会误伤任何合法装备：实查最高装备定义等级 = 81 = 本上限，
    // 所以「装备等级 ≤ 角色等级」这条校验在钳制后依然对真人成立。
    const effectiveLevel = Math.min(sub.level, STRUCTURAL_MAX_LEVEL);

    // ★ 留痕（小榜 09:15 提的，成立）：钳制是静默的，不留痕就等于
    // **我们永远不知道有没有人在用这个口子**，也无法区分「一次客户端 bug」
    // 与「有人在反复试探上界」。这里只打日志、不记作弊证据 ——
    // 报一个超限等级可能只是旧客户端或坏存档，够不上「证明」那一档
    // （cheat_evidence 的 claimField 也还没有 player_level 这一项，
    //  要不要加归 docs/78 的持有者定，我不擅自扩它的枚举）。
    if (sub.level > STRUCTURAL_MAX_LEVEL) {
      console.warn(
        `[sync-profile] 等级越过内容上限，已钳制：user=${user.id} 上报=${sub.level} 结算=${effectiveLevel}`,
      );
    }

    // ── 3. 装备硬校验（与 submit-trial 逐条相同）──
    // 档案同步比试炼成绩「轻」，但校验不能轻：这条路径产出的战力会直接
    // 参与排名，若放宽校验，伪造搭配就成了新的刷榜入口。
    for (let i = 0; i < SLOT_ORDER.length; i++) {
      const inst = sub.equipped[i];
      if (!inst) continue;
      const def = getEquipment(inst.defId);
      if (!def) return json({ error: '装备定义不存在' }, 400);
      if (def.slot !== SLOT_ORDER[i]) return json({ error: '装备槽位不符' }, 400);
      const snapshotIssue = trialEquipmentSnapshotIssue(inst, sub.classId, effectiveLevel);
      if (snapshotIssue) {
        const issueMessages: Record<typeof snapshotIssue, string> = {
          'unknown-equipment': '装备定义不存在',
          'equipment-level': '装备等级超过角色等级',
          'equipment-class': '装备职业限制不符',
          'affix-value': '装备词条数值不符合生成公式',
        };
        // 证据（docs/78）：只有两个数来自**同一次提交内部**的判据才够格自动公开。
        // 「装备等级 > 角色等级」正是这种：Lv5 穿 Lv100 在任何版本都不可能，
        // 不会像「定义不存在 / 词条不符公式」那样被版本漂移伪造出来。
        if (snapshotIssue === 'equipment-level') {
          await recordCheatEvidence(createClient(supabaseUrl, serviceKey), user.id, {
            source: 'sync-profile',
            claimField: 'equipment_level',
            claimedValue: def.level,
            boundValue: effectiveLevel,
            boundKind: 'upper',
            priorEvidenceCount: 0,
          });
        }
        return json({ error: issueMessages[snapshotIssue] }, 400);
      }
    }

    // ── 4. 服务端复算战力（与客户端、与 submit-trial 同一份 core）──
    const build = buildTrialCombatant({
      name: sub.displayName,
      classId: sub.classId,
      level: effectiveLevel,
      equipped: sub.equipped,
    });
    const combatPower = Math.round(build.combatPower);

    // 自查一次：正常情况下永远成立（战力就是从这套装备算出来的）。
    // 不成立说明 core 的口径改动让某个真实搭配越过了展示层上界 ——
    // 此时宁可少写一次战力，也不要让榜单收下一个会被前端过滤掉的值，
    // 那种「写进去了但榜上看不见」的状态最难排查。
    if (!isPlausibleCombatPower(combatPower, effectiveLevel, sub.classId)) {
      // 走到这里有两种可能，证据分级会自动把它们分开（docs/78 §2.3）：
      //   ① core 口径改动让某个真实搭配越过了展示层上界 —— 超额小，只记录不公开；
      //   ② 逐件都合法、合起来却物理上不可能的伪造快照 —— 超额大，够格公开。
      await recordCheatEvidence(createClient(supabaseUrl, serviceKey), user.id, {
        source: 'sync-profile',
        claimField: 'combat_power',
        claimedValue: combatPower,
        boundValue: combatPowerCeiling(effectiveLevel, sub.classId),
        boundKind: 'upper',
        priorEvidenceCount: 0,
      });
      return json({ error: '战力核算异常，请稍后重试' }, 500);
    }

    // ── 5. 落库（service role）──
    const admin = createClient(supabaseUrl, serviceKey);
    // 战力与公式版本戳同批写入（见 core/profileProgress.ts）。
    // 这里原本是手写的字面量对象 —— 而正是「每个函数各写各的」这个形状，
    // 让另外四个写入点漏掉了戳。现在四个函数与本函数走同一个构造点。
    const progress = buildProfileProgress({
      classId: sub.classId,
      level: effectiveLevel,
      combatPower,
    });

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

    return json({ combatPower, level: effectiveLevel, classId: sub.classId });
  } catch (_error) {
    return json({ error: '服务器开小差了，请稍后重试' }, 500);
  }
});
