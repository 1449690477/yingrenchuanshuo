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
 * 不是一个裸数字：「查无档案」是一个真实状态，而裸数字表达不了它 ——
 * 只能返回一个编出来的第 1 名，那就是骗人。
 *
 * 曾经还有第三态 staleFormula（我的战力是旧尺量的、与榜不可比）。
 * 它现在**不可能发生**：榜按我自己那行的戳取，我永远和我可比的人同榜。
 * 「我这张榜是不是最新标尺」是榜的属性，不是名次的属性 —— 见 PowerBoard.isCurrent。
 */
export type MyPowerRank =
  | { kind: 'ranked'; rank: number; exact: boolean }
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
 *
 * ── 为什么这里没有 CP_FORMULA_VERSION（2026-08-02 收尾）──
 * 过滤曾经写成「客户端常量 == 行上的戳」，而**等号两侧来自两个独立部署的
 * 产物**：客户端 bundle 一份，Edge Function bundle 一份。半截发版时它们
 * 必然对不上 —— 2026-08-02 03:38 实测到这个窗口（Edge 已是 3，线上 bundle
 * 仍是 2），玩家同步一次就被盖成 3，于是从旧客户端的榜上**消失**。
 *
 * 现在版本由**服务端**在 power_board 里按「调用者自己那行的戳」决定，
 * 客户端不再持有这个常量 ——**没有常量可对，就没有对不上的可能**。
 * 顺带地：玩家永远在自己那把尺的榜上，从形状上不可能再从榜上消失。
 * 见 supabase/migrations/20260802010000_power_board_versioned_rpc.sql。
 *
 * ⚠ 不要为了「省一次请求」把版本常量加回来。它是这个 bug 的全部成因。
 */
export interface PowerBoard {
  rows: PowerBoardRow[];
  /** 这张榜是按哪一版公式量的；降级路径下未知（null）。 */
  formulaVersion: number | null;
  /** 它是不是最新那把尺。false = 我看的是旧标尺榜，界面必须如实说。 */
  isCurrent: boolean;
  /** 不在这张榜上（戳与我不同）的档案数 —— 用来解释「榜为什么比平时短」。 */
  pendingRecalc: number;
  /**
   * 降级态：RPC 不在（迁移还没应用），这张榜是**不筛版本直读**出来的。
   *
   * ⚠ 它意味着新旧两把尺的战力正在同一个字段上排序，**名次是失真的**。
   * 必须让界面说出来：降级本身可以接受（比整张榜打不开好），
   * 但把失真的名次当成正常名次展示不可以 —— 那是这个仓库反复拒绝的「榜假」。
   * 而且它**看起来完全正常**，不说就没有任何人会发现。
   */
  degraded: boolean;
}

/** 榜单行在客户端还要过一道上界过滤，所以多取一些再截断。 */
const POWER_OVERFETCH = 2;

export async function fetchPowerBoard(
  client: SupabaseClient,
  myUserId: string | null,
  limit = 50,
): Promise<PowerBoard> {
  const { data, error } = await client.rpc('power_board', {
    p_user_id: myUserId,
    p_limit: limit * POWER_OVERFETCH,
  });
  // 迁移还没执行：退回直读 profiles，也就是**加版本戳之前的行为**。
  // 顺序做错时榜依然能开（同 isMissingFunction 的注释），只是过渡期混排；
  // 混排会被 ops:check 红着提醒，不会被忘掉。
  if (isMissingFunction(error)) return fetchPowerBoardUnversioned(client, myUserId, limit);
  if (error) throw new NetRequestError(friendlyMessage(error.message, '战力榜读取失败'));

  const raw = (data ?? []) as {
    id: string;
    display_name: string;
    bio: string | null;
    avatar_url: string | null;
    class_id: ClassId;
    level: number;
    combat_power: number;
    formula_version: number;
    board_total: number;
    pending_recalc: number;
    is_current: boolean;
  }[];
  const meta = raw[0];
  return {
    rows: rankPowerRows(
      raw.map((r) => ({
        userId: r.id,
        displayName: r.display_name,
        bio: r.bio,
        avatarUrl: r.avatar_url,
        classId: r.class_id,
        level: Number(r.level),
        combatPower: Number(r.combat_power),
        isMe: r.id === myUserId,
      })),
      limit,
    ),
    // 榜空时没有元信息可读 —— 那也意味着没有「旧标尺」可说，按当前处理。
    formulaVersion: meta ? Number(meta.formula_version) : null,
    isCurrent: meta ? meta.is_current !== false : true,
    pendingRecalc: meta ? Number(meta.pending_recalc) : 0,
    degraded: false,
  };
}

/**
 * 降级路径：RPC 还没建出来时直读 profiles，不带任何版本过滤。
 *
 * ── 为什么要有它，而不是靠「记得先执行迁移」──
 * 新客户端调一个不存在的函数时 PostgREST 返回 PGRST202、**整张战力榜打不开**，
 * 那比任何一条误伤都严重：误伤是个别玩家看不见自己，这个是所有人都打不开榜。
 * 小榜 2026-08-01 08:47 定的原则 —— **与其防止犯错，不如取消后果**。
 */
async function fetchPowerBoardUnversioned(
  client: SupabaseClient,
  myUserId: string | null,
  limit: number,
): Promise<PowerBoard> {
  const { data, error } = await client
    .from('profiles')
    .select('id, display_name, bio, avatar_url, class_id, level, combat_power')
    .order('combat_power', { ascending: false })
    .order('updated_at', { ascending: true })
    .limit(limit * POWER_OVERFETCH);
  if (error) throw new NetRequestError(friendlyMessage(error.message, '战力榜读取失败'));

  const rows = (data ?? []).map((row) => {
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
  });
  // 版本未知：不谎称「这是最新标尺」，也不吓唬玩家说有人在重算。
  // 但 degraded 必须为真 —— 这批行是新旧两把尺混在一起排的，名次失真，
  // 而它看起来完全正常。榜可以降级，名次不可以假装准确。
  return {
    rows: rankPowerRows(rows, limit),
    formulaVersion: null,
    isCurrent: true,
    pendingRecalc: 0,
    degraded: true,
  };
}

/**
 * 套上界过滤再编名次。
 *
 * 纵深防御（docs/65 §六之二 方向 B）：profiles 的写策略曾经是 for all，
 * 已登录玩家可以直接 PATCH 自己那一行的 combat_power。方向 A 已把写权限收进
 * Edge Function，但**万一将来某个新写入点又把权限放开**，这一层保证物理上
 * 不可能的数字进不了展示。上界从「该等级该职业真正能穿到的最强一套」推出来。
 *
 * ⚠ 这道过滤**只对同一把尺量出来的行成立** —— 上界是用当前权重算的。
 * power_board 保证一次调用只返回一个版本的行，两者是一对的。
 */
function rankPowerRows(rows: Omit<PowerBoardRow, 'rank'>[], limit: number): PowerBoardRow[] {
  return rows
    .filter((row) => isPlausibleCombatPower(row.combatPower, row.level, row.classId))
    .slice(0, limit)
    .map((row, index) => ({ rank: index + 1, ...row }));
}

/**
 * 这个 RPC 还没建出来吗？
 *
 * PGRST202 是 PostgREST 的「schema cache 里找不到这个函数」。也匹配文案，
 * 因为 supabase-js 在不同传输层下不一定把 code 透出来。
 *
 * ⚠ **只认这一句原文，不要放宽成 /does not exist/ 或函数名**。
 * 我第一版写的是 `/power_board|power_rank_scan|does not exist|schema cache/`，
 * 那是错的：「表不存在」「列不存在」「permission denied for function power_board」
 * 全都会命中，于是**一个真错误被悄悄降级成不筛版本的混排** —— 而榜看起来
 * 完全正常，没有任何人会发现。判据放宽一寸，失败就长得跟成功一样。
 *
 * 判错方向也不对称：漏判（该降级没降级）是玩家看到一次「战力榜读取失败」，
 * 刷新即可；误判（不该降级却降级）是**所有人长期看着一张错榜**。宁可漏判。
 */
function isMissingFunction(error: { code?: string; message?: string } | null): boolean {
  if (!error) return false;
  if (error.code === 'PGRST202') return true;
  return /could not find the function/i.test(error.message ?? '');
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
 * 我的战力名次 —— **必须与 fetchPowerBoard 数同一批人**。
 *
 * ── 原先是错的 ──
 * 旧实现是 `count(*) where combat_power > 我的`：服务端数、不带任何过滤，
 * 而榜单列表在客户端按上界过滤过。两个数字口径不同，会当面互相打脸：
 * 玩家看到「你第 37 名」，但榜上只列了 12 个人。这不是显示瑕疵，
 * 是两个数字互相证明对方是错的。（小榜 2026-08-01 报，多谢）
 *
 * ── 现在的口径 ──
 * 与 fetchPowerBoard 逐条对齐：服务端按**我自己那行的戳**筛出同尺的人，
 * 客户端再套同一道上界过滤。比较基准用服务端存的战力，不是本地算的那个数 ——
 * 榜是按存的值排的，拿本地值去比会得出一个与榜对不上的名次。
 */
export async function fetchMyPowerRank(
  client: SupabaseClient,
  myUserId: string | null,
): Promise<MyPowerRank> {
  if (!myUserId) return { kind: 'unranked' };

  const { data, error } = await client.rpc('power_rank_scan', {
    p_user_id: myUserId,
    p_limit: RANK_SCAN_CAP,
  });
  if (isMissingFunction(error)) return { kind: 'unranked' };
  if (error) throw new NetRequestError(friendlyMessage(error.message, '名次读取失败'));

  const rows = (data ?? []) as { level: number | null; class_id: ClassId | null; combat_power: number | null }[];
  // 空表 = 查无档案。不能当成「没人比我高」而给出第 1 名 —— 那是编的。
  // 有档案且无人在我之上时，RPC 会发一行全 null 出来把两者区分开。
  if (rows.length === 0) return { kind: 'unranked' };

  const above = rows.filter(
    (r) =>
      r.class_id !== null &&
      r.level !== null &&
      r.combat_power !== null &&
      isPlausibleCombatPower(Number(r.combat_power), Number(r.level), r.class_id),
  ).length;
  // 扫到上限说明上面还有没数完的人，此时这个名次是下界而不是准确值。
  return { kind: 'ranked', rank: above + 1, exact: rows.length < RANK_SCAN_CAP };
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
