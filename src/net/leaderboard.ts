/**
 * 排行榜网络 IO（docs/51 §7）。
 *
 * 这一层只做「把请求发出去、把响应摆平成类型」，不含任何游戏规则 ——
 * 规则在 src/core/trial.ts，缓存在 src/stores/leaderboard.ts。
 *
 * 最重要的边界（docs/51 §6.3）：客户端**只提交搭配快照，不提交伤害数字**。
 * 伤害由 Edge Function 用同一份 core 代码复算出来，伪造伤害在结构上不可能。
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import type { ClassId, EquipmentInstance } from '@/core/types';
import { NetRequestError, friendlyMessage } from './supabase';
import { isPlausibleCombatPower } from '@/core/combatPowerBound';
import { CP_FORMULA_VERSION } from '@/core/cpFormulaVersion';
import { TRIAL_FORMULA_VERSION } from '@/core/trialFormulaVersion';

// ─────────────────────────── 类型 ───────────────────────────

/** 提交试炼的载荷：只有搭配，没有伤害。 */
export interface TrialSubmission {
  seasonId: string;
  weekIndex: number;
  bracketId: string;
  classId: ClassId;
  level: number;
  displayName: string;
  /** 8 槽位穿戴快照，顺序与 SLOT_ORDER 一致 */
  equipped: (EquipmentInstance | null)[];
}

export interface TrialSubmitResult {
  /** 服务端复算出的 60 秒总伤害 */
  damage: number;
  rank: number;
  total: number;
  /** L3/L4 合理性检查是否通过；未通过只移出展示，不封号（docs/51 §6.3） */
  verified: boolean;
  /** 是否刷新了本周个人最好成绩 */
  improved: boolean;
  /** 服务端实际使用的试炼公式；也是客户端与 Edge 部署同步的握手。 */
  formulaVersion: number;
}

export interface TrialBoardFilter {
  seasonId: string;
  weekIndex: number;
  bracketId: string;
  /** 榜单公式版本必须显式选择，禁止新旧伤害静默混排。 */
  formulaVersion: number;
  /** 限定职业子榜；缺省为该分段的全服总榜（docs/51 §3.4） */
  classId?: ClassId;
}

export interface TrialBoardRow {
  rank: number;
  userId: string;
  displayName: string;
  bio: string | null;
  avatarUrl: string | null;
  classId: ClassId;
  damage: number;
  isMe: boolean;
  /** 榜单总人数；邻域行会携带，用于「上位 N%」段位 */
  total: number;
}

export interface PowerBoardRow {
  rank: number;
  userId: string;
  displayName: string;
  bio: string | null;
  avatarUrl: string | null;
  classId: ClassId;
  level: number;
  combatPower: number;
  isMe: boolean;
}

/**
 * 我的战力名次。
 *
 * 不是一个裸数字：过渡期存在「这个人的战力算不出名次」的真实状态
 * （他的战力是旧公式量的，与榜上的新值不可比），而裸数字表达不了它 ——
 * 只能返回一个编出来的名次，那就是骗人。
 */
export type MyPowerRank =
  | { kind: 'ranked'; rank: number; exact: boolean }
  /** 我的档案还是旧公式算的，与当前榜不可比；下次同步后自动恢复。 */
  | { kind: 'staleFormula' }
  /** 我还没有可用的档案（占位档 / 从未同步）。 */
  | { kind: 'unranked' };

// ─────────────────────────── 档案 ───────────────────────────

interface PublicProfileIdentity {
  displayName: string;
  bio: string | null;
  avatarUrl: string | null;
}

/**
 * 同步公开档案里的游戏进度字段（class_id / level / combat_power）。
 *
 * ── 2026-07-31 · 战力改由服务端现算（docs/65 §六之二 方向 A）──
 * 这里原本是客户端直写 profiles。但 profiles 的 RLS 策略是 for all，
 * 玩家可以自己 PATCH combat_power —— **战力榜的名次曾经是客户端自填的**。
 * 现在改成调 sync-profile：**载荷里根本没有战力这个字段**，
 * 服务端拿搭配快照用同一份 core 现算，与 submit-trial 逐点一致。
 *
 * display_name 只在档案首次创建时由服务端写入默认值，之后绝不再碰 ——
 * 玩家自设昵称与游戏角色名是两套身份，每次同步都覆盖会把玩家刚改好的
 * 昵称冲掉。昵称 / 简介 / 头像的编辑仍然走客户端直写（那些是玩家自治的
 * 展示字段，见 net/profile.ts）。
 */
export async function upsertProfile(
  client: SupabaseClient,
  profile: {
    displayName: string;
    classId: ClassId;
    level: number;
    /** 八槽位穿戴快照，顺序与 SLOT_ORDER 一致；战力由服务端据此现算 */
    equipped: readonly (EquipmentInstance | null)[];
  },
): Promise<void> {
  const { data, error } = await client.functions.invoke('sync-profile', {
    body: {
      displayName: profile.displayName.trim().slice(0, 20) || '无名旅人',
      classId: profile.classId,
      level: profile.level,
      equipped: profile.equipped,
    },
  });
  if (error) {
    const serverMessage = await extractFunctionErrorMessage(error);
    throw new NetRequestError(serverMessage ?? friendlyMessage(error.message, '档案同步失败'));
  }

  const body = data as { error?: string } | null;
  if (body?.error) throw new NetRequestError(body.error);
}

/**
 * RPC 的邻域榜返回固定列，头像字段在它建成后才加入档案。
 * 用榜单里的少量 user id 一次性补读身份，避免为每一行各发一个请求。
 */
export async function fetchPublicProfileIdentities(
  client: SupabaseClient,
  userIds: readonly string[],
): Promise<Map<string, PublicProfileIdentity>> {
  const uniqueIds = [...new Set(userIds)].filter(Boolean);
  if (uniqueIds.length === 0) return new Map();

  const { data, error } = await client
    .from('profiles')
    .select('id, display_name, bio, avatar_url')
    .in('id', uniqueIds);
  if (error) throw new NetRequestError(friendlyMessage(error.message, '玩家档案读取失败'));

  return new Map(
    (data ?? []).map((row) => {
      const profile = row as {
        id: string;
        display_name: string;
        bio: string | null;
        avatar_url: string | null;
      };
      return [
        profile.id,
        {
          displayName: profile.display_name,
          bio: profile.bio,
          avatarUrl: profile.avatar_url,
        },
      ];
    }),
  );
}

// ─────────────────────────── 试炼成绩 ───────────────────────────

/** 提交本周试炼：搭配快照发给 Edge Function，伤害由服务端复算返回。 */
export async function submitTrialScore(
  client: SupabaseClient,
  submission: TrialSubmission,
): Promise<TrialSubmitResult> {
  const { data, error } = await client.functions.invoke('submit-trial', {
    body: submission,
  });
  if (error) {
    const serverMessage = await extractFunctionErrorMessage(error);
    throw new NetRequestError(serverMessage ?? friendlyMessage(error.message, '成绩上传失败'));
  }
  const body = data as Partial<TrialSubmitResult> | null;
  if (
    !body ||
    typeof body.damage !== 'number' ||
    typeof body.rank !== 'number' ||
    typeof body.total !== 'number' ||
    typeof body.formulaVersion !== 'number'
  ) {
    throw new NetRequestError('服务端返回了无法识别的成绩，请稍后重试');
  }
  if (body.formulaVersion !== TRIAL_FORMULA_VERSION) {
    throw new NetRequestError('排行榜服务仍是旧版本，请刷新页面后重试');
  }
  return {
    damage: Math.max(0, Math.round(body.damage)),
    rank: body.rank,
    total: body.total,
    verified: body.verified !== false,
    improved: body.improved === true,
    formulaVersion: body.formulaVersion,
  };
}

// ─────────────────────────── 试炼榜单 ───────────────────────────

/** 拉取前 N 名（默认 100；它是「远景」，不是默认视图）。 */
export async function fetchTrialTop(
  client: SupabaseClient,
  filter: TrialBoardFilter,
  myUserId: string | null,
  limit = 100,
): Promise<TrialBoardRow[]> {
  const { data, error } = await client.rpc('trial_top_versioned', {
    p_season_id: filter.seasonId,
    p_week_index: filter.weekIndex,
    p_bracket_id: filter.bracketId,
    p_formula_version: filter.formulaVersion,
    p_class_id: filter.classId ?? null,
    p_user_id: myUserId,
    p_limit: limit,
  });
  if (error) throw new NetRequestError(friendlyMessage(error.message, '榜单读取失败'));

  return (data ?? []).map((row: unknown) => {
    const r = row as {
      rank: number;
      user_id: string;
      display_name: string;
      bio: string | null;
      avatar_url: string | null;
      class_id: ClassId;
      damage: number;
      total: number;
    };
    return {
      rank: Number(r.rank),
      userId: r.user_id,
      displayName: r.display_name ?? '无名旅人',
      bio: r.bio ?? null,
      avatarUrl: r.avatar_url ?? null,
      classId: r.class_id,
      damage: Number(r.damage),
      isMe: r.user_id === myUserId,
      total: Number(r.total),
    };
  });
}

/**
 * 邻域榜（docs/51 §5.1）：「你 ±5 名」是默认视图。
 *
 * 第 3000 名看到第 2998 名只领先他 2%，是够得着的目标；
 * 看到第 1 名领先他 40 倍，只会关掉。
 *
 * 本周没提交成绩时不会返回空表：RPC 会把锚点落到榜尾，让玩家看到
 * 「打到多少能挤进去」。此时所有行的 isMe 都是 false —— 调用方据此
 * 区分「我的邻域」与「榜尾预览」（见 trialNeighborhoodIsPreview）。
 */
export async function fetchTrialNeighborhood(
  client: SupabaseClient,
  filter: TrialBoardFilter,
  myUserId: string,
  radius = 5,
): Promise<TrialBoardRow[]> {
  const { data, error } = await client.rpc('trial_neighborhood_versioned', {
    p_season_id: filter.seasonId,
    p_week_index: filter.weekIndex,
    p_bracket_id: filter.bracketId,
    p_formula_version: filter.formulaVersion,
    // 必须显式给 null：supabase-js 会丢掉值为 undefined 的键，而 PostgREST
    // 按「参数名集合」找函数，少一个键就报 PGRST202 函数不存在。
    p_class_id: filter.classId ?? null,
    p_user_id: myUserId,
    p_radius: radius,
  });
  if (error) throw new NetRequestError(friendlyMessage(error.message, '邻域榜读取失败'));

  const rawRows: Omit<TrialBoardRow, 'bio' | 'avatarUrl'>[] = (data ?? []).map((row: unknown) => {
    const r = row as {
      rank: number;
      user_id: string;
      display_name: string;
      class_id: ClassId;
      damage: number;
      total: number;
      is_me: boolean;
    };
    return {
      rank: Number(r.rank),
      userId: r.user_id,
      displayName: r.display_name,
      classId: r.class_id,
      damage: Number(r.damage),
      isMe: r.is_me === true,
      total: Number(r.total),
    };
  });
  const identities = await fetchPublicProfileIdentities(
    client,
    rawRows.map((row) => row.userId),
  );
  return rawRows.map((row) => {
    const identity = identities.get(row.userId);
    return {
      ...row,
      displayName: identity?.displayName ?? row.displayName,
      bio: identity?.bio ?? null,
      avatarUrl: identity?.avatarUrl ?? null,
    };
  });
}

/**
 * 这批邻域行是「榜尾预览」而不是「我的邻域」吗？
 *
 * 非空且没有任何一行是我 → 我本周还没上榜，看到的是入榜门槛附近。
 * 空表是「本周还没有人上榜」，那是另一种状态，不算预览。
 */
export function trialNeighborhoodIsPreview(rows: readonly TrialBoardRow[]): boolean {
  return rows.length > 0 && !rows.some((row) => row.isMe);
}

/** 入榜门槛：榜尾预览里最末一行的伤害 —— 玩家要超过的那个数字。 */
export function trialEntryThreshold(rows: readonly TrialBoardRow[]): number | null {
  if (rows.length === 0) return null;
  return rows.reduce((last, row) => (row.rank > last.rank ? row : last), rows[0]).damage;
}

// ─────────────────────────── 战力榜（次级页签） ───────────────────────────

/**
 * 战力榜只作次级页签（docs/51 §4）：它是玩家期待看到的，
 * 但不是我们希望他追的 —— 战力 ≈ 挂机时长，先玩的人永远在前面。
 */
export async function fetchPowerTop(
  client: SupabaseClient,
  myUserId: string | null,
  limit = 50,
): Promise<PowerBoardRow[]> {
  // 只取当前公式版本的行（批3-3）。旧版本的战力是另一把尺量的，
  // 与新值放在同一个 combat_power 字段上排序就是名次失真 ——
  // 而榜看起来完全正常，没有任何人会发现。宁可榜短，不可榜假。
  //
  // 两条查询各写各的列串（而不是拼字符串）：supabase-js 靠字面量推导行类型，
  // 拼出来的列串会退化成 ParserError，把整行的类型安全丢掉。
  const withVersion = () =>
    client
      .from('profiles')
      .select('id, display_name, bio, avatar_url, class_id, level, combat_power')
      .eq('cp_formula_version', CP_FORMULA_VERSION)
      .order('combat_power', { ascending: false })
      .order('updated_at', { ascending: true })
      // 多取一些再过滤：离谱行会被剔掉，直接按 limit 取会让榜变短
      .limit(limit * 2);
  const withoutVersion = () =>
    client
      .from('profiles')
      .select('id, display_name, bio, avatar_url, class_id, level, combat_power')
      .order('combat_power', { ascending: false })
      .order('updated_at', { ascending: true })
      .limit(limit * 2);

  let { data, error } = await withVersion();
  // 迁移还没执行：退回不带版本筛的查询，也就是**今天的行为**。
  // 顺序做错时榜依然能开（见 isMissingVersionColumn 的注释）。
  if (isMissingVersionColumn(error)) ({ data, error } = await withoutVersion());
  if (error) throw new NetRequestError(friendlyMessage(error.message, '战力榜读取失败'));

  return (data ?? [])
    .map((row) => {
      const r = row as {
        id: string;
        display_name: string;
        bio: string | null;
        avatar_url: string | null;
        class_id: ClassId;
        level: number;
        combat_power: number;
      };
      return {
        userId: r.id,
        displayName: r.display_name,
        bio: r.bio,
        avatarUrl: r.avatar_url,
        classId: r.class_id,
        level: Number(r.level),
        combatPower: Number(r.combat_power),
        isMe: r.id === myUserId,
      };
    })
    .filter((row) =>
      // 纵深防御（docs/65 §六之二 方向 B）：profiles 的写策略是 for all，
      // 已登录玩家可以直接 PATCH 自己那一行的 combat_power。方向 A 会把写权限
      // 收到 Edge Function，但**在那之前、以及万一将来某个新写入点又把权限
      // 放开时**，这一层保证物理上不可能的数字进不了展示。
      // 上界从「该等级该职业真正能穿到的最强一套」推出来，不是拍的系数。
      //
      // ⚠ 这道过滤**只对当前公式版本的行成立** —— 上界是用当前权重算的，
      // 拿它去量旧公式的数字等于用错误的尺子判人。上面的 .eq 已经保证了
      // 到这里的行都是当前版本，两者是一对的：改动其一必须同时改另一个。
      isPlausibleCombatPower(row.combatPower, row.level, row.classId),
    )
    .slice(0, limit)
    .map((row, index) => ({ rank: index + 1, ...row }));
}

/**
 * 版本戳列还没建出来吗？
 *
 * ── 为什么要有这个判断，而不是靠「记得先执行迁移」──
 * 加列迁移必须先于读这一列的客户端发布，否则 PostgREST 返回 42703、
 * 整张战力榜打不开 —— 那比今晚讨论的任何一条误伤都严重：
 * 误伤是个别玩家看不见自己，这个是**所有人都打不开榜**。
 *
 * 小榜 2026-08-01 08:47 指出：我原本用「我承诺在迁移执行前不提交」来守它，
 * **那是纪律不是机制**，而今晚我们已经反复吃过「靠人记得」的亏。
 * 他建议换成量具（ops:check 已有第 5 项在守）。我这里再往前一步：
 * **与其防止犯错，不如取消后果** —— 列不在就退回不带版本筛的查询，
 * 也就是**今天的行为**。顺序做错时榜依然能开，只是过渡期混排；
 * 而混排会被 ops:check 第 5 项红着提醒，不会被忘掉。
 *
 * 42703 是 PostgreSQL 的 undefined_column。也匹配文案，因为
 * supabase-js 在不同传输层下不一定把 code 透出来。
 */
function isMissingVersionColumn(error: { code?: string; message?: string } | null): boolean {
  if (!error) return false;
  if (error.code === '42703') return true;
  return /cp_formula_version/i.test(error.message ?? '');
}

/**
 * 名次扫描上限。
 *
 * 名次必须与榜单口径一致（同一套过滤），而上界过滤跑在客户端、SQL 里数不出来，
 * 所以只能把「比我高的行」拉回来自己数。这个上限是保护网络与内存的：
 * 超过它就诚实地说「500+ 名」，而不是给一个数不准的精确数字。
 */
const RANK_SCAN_CAP = 500;

/**
 * 我的战力名次 —— **必须与 fetchPowerTop 数同一批人**。
 *
 * ── 原先是错的 ──
 * 旧实现是 `count(*) where combat_power > 我的`：服务端数、不带任何过滤，
 * 而榜单列表在客户端按上界过滤过。两个数字口径不同，会当面互相打脸：
 * 玩家看到「你第 37 名」，但榜上只列了 12 个人。这不是显示瑕疵，
 * 是两个数字互相证明对方是错的。（小榜 2026-08-01 报，多谢）
 *
 * ── 现在的口径 ──
 * 与 fetchPowerTop 逐条对齐：同样只数当前公式版本、同样套上界过滤。
 */
export async function fetchMyPowerRank(
  client: SupabaseClient,
  myUserId: string | null,
  myCombatPower: number,
): Promise<MyPowerRank> {
  if (!myUserId) return { kind: 'unranked' };

  // 先看我自己那行是哪把尺量的 —— 用本地算出的战力去和榜上的新值比大小，
  // 在过渡期是没有意义的（两个数不同量纲）。
  const { data: mine, error: mineError } = await client
    .from('profiles')
    .select('cp_formula_version')
    .eq('id', myUserId)
    .maybeSingle();
  // 迁移还没执行：整条版本判定退场，按「大家都是当前版本」数名次 ——
  // 也就是今天的行为（见 isMissingVersionColumn）。
  const versioned = !isMissingVersionColumn(mineError);
  if (versioned) {
    if (mineError) throw new NetRequestError(friendlyMessage(mineError.message, '名次读取失败'));
    if (!mine) return { kind: 'unranked' };
    if ((mine as { cp_formula_version: number }).cp_formula_version !== CP_FORMULA_VERSION) {
      return { kind: 'staleFormula' };
    }
  }

  const base = client.from('profiles').select('level, class_id, combat_power');
  const { data, error } = await (versioned ? base.eq('cp_formula_version', CP_FORMULA_VERSION) : base)
    .gt('combat_power', myCombatPower)
    .limit(RANK_SCAN_CAP);
  if (error) throw new NetRequestError(friendlyMessage(error.message, '名次读取失败'));

  const rows = (data ?? []) as { level: number; class_id: ClassId; combat_power: number }[];
  const aboveMe = rows.filter((r) =>
    isPlausibleCombatPower(Number(r.combat_power), Number(r.level), r.class_id),
  ).length;
  // 扫到上限说明上面还有没数完的人，此时这个名次是下界而不是准确值。
  return { kind: 'ranked', rank: aboveMe + 1, exact: rows.length < RANK_SCAN_CAP };
}

/**
 * 还有多少人的战力等着按新公式重算。
 *
 * 过渡期榜单会变短（旧公式的行不参与排名），榜上少了人却不说原因，
 * 玩家只会以为榜坏了。这个数是给界面写「另有 N 位玩家的战力正在重算」用的。
 */
export async function countStaleFormulaProfiles(client: SupabaseClient): Promise<number> {
  const { count, error } = await client
    .from('profiles')
    .select('id', { count: 'exact', head: true })
    .neq('cp_formula_version', CP_FORMULA_VERSION);
  // 迁移还没执行 = 没有任何一行「等着重算」，答 0 而不是把界面打红。
  if (isMissingVersionColumn(error)) return 0;
  if (error) throw new NetRequestError(friendlyMessage(error.message, '重算人数读取失败'));
  return count ?? 0;
}

// ─────────────────────────── 内部 ───────────────────────────

/** 把服务端英文错误翻译成人话；原样透出会吓到玩家。 */
/**
 * 读出 Edge Function 业务错误的正文（FunctionsHttpError.context 是 Response）。
 *
 * 服务端 4xx/5xx 的 { error } 是面向玩家的中文原因（如「装备词条数值不符合
 * 生成公式」）；supabase-js 的 error.message 只有一句笼统的
 * "Edge Function returned a non-2xx status code"，直接透出等于什么都没说。
 */
export async function extractFunctionErrorMessage(error: unknown): Promise<string | null> {
  const context = (error as { context?: unknown }).context;
  if (!(context instanceof Response)) return null;
  try {
    const body: unknown = await context.clone().json();
    if (body !== null && typeof body === 'object' && 'error' in body) {
      const message = (body as { error?: unknown }).error;
      if (typeof message === 'string' && message.length > 0 && message.length <= 100) {
        return message;
      }
    }
  } catch {
    // 网络层错误没有 JSON 正文，走兜底翻译
  }
  return null;
}
