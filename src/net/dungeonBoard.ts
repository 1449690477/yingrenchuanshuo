/**
 * 秘境榜的网络层（docs/51 §4 榜 5，契约 docs/64）。
 *
 * 规则在 src/core/dungeonBoard.ts，白名单与展示元信息在
 * src/data/dungeonBoardRules.ts。与试炼榜、速度榜同规：
 * 所有失败都翻译成玩家能看懂的话，绝不阻塞游戏主流程。
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import type { ClassId } from '@/core/types';
import { friendlyMessage, NetRequestError } from './supabase';
import { fetchPublicProfileIdentities } from './leaderboard';

export interface DungeonSubmission {
  dungeonId: string;
  bestDurationMs: number;
  firstClearedAt: number;
}

export interface DungeonSubmitResult {
  bestDurationMs: number;
  firstClearedAt: number;
  /** 是否通过合理性判定；false = 移出展示但数据保留 */
  verified: boolean;
  /**
   * 本次是否真的改写了记录。
   *
   * false 是**常态**而不是失败：玩家每次打开榜单都会重报当前记录，
   * 没打得更快就什么都不该变。UI 不要拿它当错误提示。
   */
  improved: boolean;
}

export interface DungeonBoardRow {
  rank: number;
  userId: string;
  displayName: string;
  bio: string | null;
  avatarUrl: string | null;
  /** 职业只用于无头像时的占位立绘；秘境榜本身不分职业。 */
  classId: ClassId;
  /** 最快通关用时（毫秒），越小越靠前 */
  bestDurationMs: number;
  /** 首通时刻；用时并列时越早越靠前 */
  firstClearedAt: number;
  isMe: boolean;
}

/**
 * 上报某座秘境的最快通关。
 *
 * 载荷只有 `{ dungeonId, bestDurationMs, firstClearedAt }`：
 * 没有名次、没有 verified —— 那两个都由服务端产生。
 * 与试炼榜「提交里不能有伤害」同一条原则。
 */
export async function submitDungeonRecord(
  client: SupabaseClient,
  submission: DungeonSubmission,
): Promise<DungeonSubmitResult> {
  const { data, error } = await client.functions.invoke('submit-dungeon', {
    body: submission,
  });
  if (error) throw new NetRequestError(friendlyMessage(error.message, '秘境成绩上报失败'));

  const body = data as Partial<DungeonSubmitResult> & { error?: string };
  if (body?.error) throw new NetRequestError(body.error);
  return {
    bestDurationMs: Number(body?.bestDurationMs ?? submission.bestDurationMs),
    firstClearedAt: Number(body?.firstClearedAt ?? submission.firstClearedAt),
    verified: body?.verified === true,
    improved: body?.improved === true,
  };
}

/**
 * 拉某座秘境的速通榜（用时升序，并列看谁更早首通）。
 *
 * 只取 `verified` 的记录 —— 与试炼榜、速度榜同一处置口径：
 * 不可信成绩移出展示，但数据保留待审，不封号。
 */
export async function fetchDungeonBoard(
  client: SupabaseClient,
  dungeonId: string,
  myUserId: string | null,
  limit = 50,
): Promise<DungeonBoardRow[]> {
  const { data, error } = await client
    .from('dungeon_records')
    .select('user_id, best_duration_ms, first_cleared_at, profiles(display_name, class_id)')
    .eq('dungeon_id', dungeonId)
    .eq('verified', true)
    .order('best_duration_ms', { ascending: true })
    // 并列时按首通更早排在前面。少了这一句，同为 0.2 秒的一批玩家会按
    // 数据库返回顺序排 —— 那等于奖励谁的写入更靠前，而不是谁更早打到。
    .order('first_cleared_at', { ascending: true })
    .limit(limit);
  if (error) throw new NetRequestError(friendlyMessage(error.message, '秘境榜读取失败'));

  const rows = (data ?? []).map((row, index) => {
    const r = row as {
      user_id: string;
      best_duration_ms: number | string;
      first_cleared_at: string;
      profiles:
        | { display_name: string; class_id: ClassId }
        | { display_name: string; class_id: ClassId }[]
        | null;
    };
    const profile = Array.isArray(r.profiles) ? r.profiles[0] : r.profiles;
    return {
      rank: index + 1,
      userId: r.user_id,
      displayName: profile?.display_name ?? '无名旅人',
      classId: profile?.class_id ?? 'swordsman',
      bestDurationMs: Number(r.best_duration_ms),
      firstClearedAt: Date.parse(r.first_cleared_at),
      isMe: r.user_id === myUserId,
    };
  });

  // 头像与简介走与试炼榜同一个公开身份查询，保持展示一致
  const identities = await fetchPublicProfileIdentities(
    client,
    rows.map((row) => row.userId),
  );
  return rows.map((row) => {
    const identity = identities.get(row.userId);
    return {
      ...row,
      displayName: identity?.displayName ?? row.displayName,
      bio: identity?.bio ?? null,
      avatarUrl: identity?.avatarUrl ?? null,
    };
  });
}
