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
}

export interface TrialBoardFilter {
  seasonId: string;
  weekIndex: number;
  bracketId: string;
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

// ─────────────────────────── 档案 ───────────────────────────

interface PublicProfileIdentity {
  displayName: string;
  bio: string | null;
  avatarUrl: string | null;
}

/**
 * 同步公开档案里的游戏进度字段。
 *
 * display_name 只在档案首次创建时写入默认值，之后绝不再碰。玩家自设昵称
 * 与当前游戏角色名是两套身份；如果每次同步战力都 upsert display_name，
 * 换职业或上传成绩就会把玩家刚改好的昵称覆盖掉。
 */
export async function upsertProfile(
  client: SupabaseClient,
  profile: {
    id: string;
    displayName: string;
    classId: ClassId;
    level: number;
    combatPower: number;
  },
): Promise<void> {
  const updatedAt = new Date().toISOString();
  const progress = {
    class_id: profile.classId,
    level: profile.level,
    combat_power: profile.combatPower,
    updated_at: updatedAt,
  };

  const { error: createError } = await client.from('profiles').upsert(
    {
      id: profile.id,
      display_name: profile.displayName.trim().slice(0, 20) || '无名旅人',
      ...progress,
    },
    {
      onConflict: 'id',
      // PostgreSQL 的 ON CONFLICT DO NOTHING：已有档案时不覆盖玩家自设身份。
      ignoreDuplicates: true,
    },
  );
  if (createError) {
    throw new NetRequestError(friendlyMessage(createError.message, '档案初始化失败'));
  }

  const { error: updateError } = await client
    .from('profiles')
    .update(progress)
    .eq('id', profile.id);
  if (updateError) {
    throw new NetRequestError(friendlyMessage(updateError.message, '档案同步失败'));
  }
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
    typeof body.total !== 'number'
  ) {
    throw new NetRequestError('服务端返回了无法识别的成绩，请稍后重试');
  }
  return {
    damage: Math.max(0, Math.round(body.damage)),
    rank: body.rank,
    total: body.total,
    verified: body.verified !== false,
    improved: body.improved === true,
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
  let query = client
    .from('trial_scores')
    .select('user_id, class_id, damage, created_at, profiles(display_name, bio, avatar_url)')
    .eq('season_id', filter.seasonId)
    .eq('week_index', filter.weekIndex)
    .eq('bracket_id', filter.bracketId)
    .eq('verified', true)
    .order('damage', { ascending: false })
    .order('created_at', { ascending: true })
    .limit(limit);
  if (filter.classId) query = query.eq('class_id', filter.classId);
  const { data, error } = await query;
  if (error) throw new NetRequestError(friendlyMessage(error.message, '榜单读取失败'));

  return (data ?? []).map((row, index) => {
    const r = row as {
      user_id: string;
      class_id: ClassId;
      damage: number;
      profiles:
        | { display_name: string; bio: string | null; avatar_url: string | null }
        | { display_name: string; bio: string | null; avatar_url: string | null }[]
        | null;
    };
    const profile = Array.isArray(r.profiles) ? r.profiles[0] : r.profiles;
    return {
      rank: index + 1,
      userId: r.user_id,
      displayName: profile?.display_name ?? '无名旅人',
      bio: profile?.bio ?? null,
      avatarUrl: profile?.avatar_url ?? null,
      classId: r.class_id,
      damage: Number(r.damage),
      isMe: r.user_id === myUserId,
      total: 0,
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
  const { data, error } = await client.rpc('trial_neighborhood', {
    p_season_id: filter.seasonId,
    p_week_index: filter.weekIndex,
    p_bracket_id: filter.bracketId,
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
  const { data, error } = await client
    .from('profiles')
    .select('id, display_name, bio, avatar_url, class_id, level, combat_power')
    .order('combat_power', { ascending: false })
    .order('updated_at', { ascending: true })
    // 多取一些再过滤：离谱行会被剔掉，直接按 limit 取会让榜变短
    .limit(limit * 2);
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
      isPlausibleCombatPower(row.combatPower, row.level, row.classId),
    )
    .slice(0, limit)
    .map((row, index) => ({ rank: index + 1, ...row }));
}

/** 我的战力名次：只数「比我高的人数 + 1」，不拉全表。 */
export async function fetchMyPowerRank(
  client: SupabaseClient,
  myCombatPower: number,
): Promise<number> {
  const { count, error } = await client
    .from('profiles')
    .select('id', { count: 'exact', head: true })
    .gt('combat_power', myCombatPower);
  if (error) throw new NetRequestError(friendlyMessage(error.message, '名次读取失败'));
  return (count ?? 0) + 1;
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
