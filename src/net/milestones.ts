/**
 * 登顶速度榜的网络层（docs/51 §4 榜 4）。
 *
 * 规则在 src/core/milestones.ts，档位与下界在 src/data/milestoneRules.ts。
 * 与试炼榜同规：所有失败都翻译成玩家能看懂的话，绝不阻塞游戏主流程。
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import type { ClassId } from '@/core/types';
import { friendlyMessage, NetRequestError } from './supabase';
import { fetchPublicProfileIdentities } from './leaderboard';

export interface MilestoneSubmission {
  level: number;
  elapsedMs: number;
}

export interface MilestoneSubmitResult {
  level: number;
  elapsedMs: number;
  /** 是否通过合理性下界；false = 移出展示但数据保留 */
  verified: boolean;
  /** 该档位此前已有记录（多设备或断网重试的正常路径，不是失败） */
  alreadyRecorded: boolean;
}

export interface MilestoneBoardRow {
  rank: number;
  userId: string;
  displayName: string;
  bio: string | null;
  avatarUrl: string | null;
  /** 职业只用于无头像时的占位立绘；速度榜本身不分职业。 */
  classId: ClassId;
  /** 用时（毫秒），越小越靠前 */
  elapsedMs: number;
  isMe: boolean;
}

/**
 * 上报一个已达成的档位。
 *
 * 载荷只有 `{ level, elapsedMs }`：没有名次、没有 verified —— 那两个都由
 * 服务端产生。客户端连「我是否入榜」都无权自称。
 */
export async function submitMilestone(
  client: SupabaseClient,
  submission: MilestoneSubmission,
): Promise<MilestoneSubmitResult> {
  const { data, error } = await client.functions.invoke('submit-milestone', {
    body: submission,
  });
  if (error) throw new NetRequestError(friendlyMessage(error.message, '里程碑上报失败'));

  const body = data as Partial<MilestoneSubmitResult> & { error?: string };
  if (body?.error) throw new NetRequestError(body.error);
  return {
    level: Number(body?.level ?? submission.level),
    elapsedMs: Number(body?.elapsedMs ?? submission.elapsedMs),
    verified: body?.verified === true,
    alreadyRecorded: body?.alreadyRecorded === true,
  };
}

/**
 * 拉某个档位的速度榜（用时升序）。
 *
 * 只取 `verified` 的记录 —— 与试炼榜同一处置口径：
 * 不可信成绩移出展示，但数据保留待审，不封号。
 */
export async function fetchMilestoneBoard(
  client: SupabaseClient,
  level: number,
  myUserId: string | null,
  limit = 50,
): Promise<MilestoneBoardRow[]> {
  const { data, error } = await client
    .from('milestones')
    .select('user_id, elapsed_ms, profiles(display_name, class_id)')
    .eq('milestone', level)
    .eq('verified', true)
    .order('elapsed_ms', { ascending: true })
    .limit(limit);
  if (error) throw new NetRequestError(friendlyMessage(error.message, '速度榜读取失败'));

  const rows = (data ?? []).map((row, index) => {
    const r = row as {
      user_id: string;
      elapsed_ms: number | string;
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
      elapsedMs: Number(r.elapsed_ms),
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
