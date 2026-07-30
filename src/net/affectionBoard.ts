/**
 * 羁绊榜的网络层（docs/63 §三 · P2）。
 *
 * 规则在 src/core/affectionBoard.ts，常量在 src/data/affectionBoardRules.ts。
 * 与速度榜同一条约束：服务端无法复算「你陪了她多少次」，上报的是
 * 客户端快照，防线是结构白名单 + 账龄下界 + 只升不降（都在服务端）。
 *
 * 红线（docs/63 §三）：网络上只流动四角色之和 —— 单角色明细发给
 * 服务端后用完即弃不落库，拉榜只读 affection_total 一个数。
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import type { AffectionBoardClaim } from '@/core/affectionBoard';
import type { ClassId } from '@/core/types';
import { extractFunctionErrorMessage } from './leaderboard';
import { friendlyMessage, NetRequestError } from './supabase';

/** 上报载荷：四角色快照的集合（缺的角色允许不报，键是职业 id）。 */
export type AffectionSubmission = Partial<Record<ClassId, AffectionBoardClaim>>;

export interface AffectionSubmitResult {
  /** 本次快照是否通过了合理性下界并写入（false = 服务端静默拒绝） */
  updated: boolean;
  /** 只升不降之后账号的实际总分；updated=false 时为 null */
  affectionTotal: number | null;
  /** 我的名次（只在有总分的账号内排；未入榜为 0） */
  rank: number;
  /** 榜上有总分的账号数 */
  total: number;
}

export interface AffectionBoardRow {
  rank: number;
  userId: string;
  displayName: string;
  avatarUrl: string | null;
  /** 只用于无头像时的占位立绘；羁绊榜本身不分职业。 */
  classId: ClassId;
  /** 四角色心意之和 —— 榜上唯一的数字，绝不拆单角色。 */
  affectionTotal: number;
  isMe: boolean;
}

/**
 * 上报当前心意快照。
 *
 * 载荷只有各角色的 { points, totalInteractions, storyCount }：
 * 没有总分、没有名次 —— 那些都由服务端产生，客户端无权自称。
 * updated=false 不是失败：真实玩家数学上不可能触到下界，走到那的
 * 只可能是改过的存档，静默拒绝、不给造假者任何边界信息。
 */
export async function submitAffectionReport(
  client: SupabaseClient,
  characters: AffectionSubmission,
): Promise<AffectionSubmitResult> {
  const { data, error } = await client.functions.invoke('submit-affection', {
    body: { characters },
  });
  if (error) {
    const serverMessage = await extractFunctionErrorMessage(error);
    throw new NetRequestError(serverMessage ?? friendlyMessage(error.message, '心意上传失败'));
  }
  const body = data as Partial<AffectionSubmitResult> | null;
  if (!body || typeof body.updated !== 'boolean') {
    throw new NetRequestError('服务端返回了无法识别的结果，请稍后重试');
  }
  return {
    updated: body.updated,
    affectionTotal:
      typeof body.affectionTotal === 'number' ? Math.max(0, Math.round(body.affectionTotal)) : null,
    rank: typeof body.rank === 'number' ? body.rank : 0,
    total: typeof body.total === 'number' ? body.total : 0,
  };
}

/**
 * 拉心意总榜（降序，同分先达者在前）。
 *
 * 只取 affection_total > 0 的账号：0 分是缺省值不是成绩，与
 * 服务端「0 分账号不入榜」同一个口径（docs/61 §2.2：同一份口径
 * 不许两处实现，这里是把它摆在一起对照）。
 */
export async function fetchAffectionBoard(
  client: SupabaseClient,
  myUserId: string | null,
  limit = 50,
): Promise<AffectionBoardRow[]> {
  const { data, error } = await client
    .from('profiles')
    .select('id, display_name, avatar_url, class_id, affection_total')
    .gt('affection_total', 0)
    .order('affection_total', { ascending: false })
    .order('updated_at', { ascending: true })
    .limit(limit);
  if (error) throw new NetRequestError(friendlyMessage(error.message, '羁绊榜读取失败'));

  return (data ?? []).map((row, index) => {
    const r = row as {
      id: string;
      display_name: string;
      avatar_url: string | null;
      class_id: ClassId;
      affection_total: number | string;
    };
    return {
      rank: index + 1,
      userId: r.id,
      displayName: r.display_name,
      avatarUrl: r.avatar_url,
      classId: r.class_id,
      affectionTotal: Number(r.affection_total),
      isMe: r.id === myUserId,
    };
  });
}
