/**
 * 封神榜（外挂榜）读取（docs/78）。
 *
 * 只读 `cheater_board` 视图 —— 原始的 `cheat_evidence` 表客户端读不到，
 * 里面有尚未公开的待复核项，公示之前不该外泄。
 *
 * 视图本身已经过滤了：只有三道闸门全开（published）且未被人工洗白（cleared_at is null）
 * 的证据才会出现。客户端不做任何二次判定 —— 判定权在服务端，这里只负责展示。
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import { NetRequestError, friendlyMessage } from './supabase';

export interface CheaterBoardRow {
  rank: number;
  userId: string;
  displayName: string;
  /** core 统一生成的展示文案，如「战力 999,999,999，物理上限 47,210 · 超 21,178 倍」 */
  summary: string;
  /** 累计已公开的铁证条数 */
  evidenceCount: number;
  detectedAt: string;
  isMe: boolean;
}

/**
 * 拉封神榜。按最近发现时间倒序 —— 新鲜的作弊比陈年的更值得围观。
 */
export async function fetchCheaterBoard(
  client: SupabaseClient,
  myUserId: string | null,
  limit = 50,
): Promise<CheaterBoardRow[]> {
  const { data, error } = await client
    .from('cheater_board')
    .select('user_id, display_name, summary, evidence_count, detected_at')
    .order('detected_at', { ascending: false })
    .limit(limit);
  if (error) throw new NetRequestError(friendlyMessage(error.message, '封神榜读取失败'));

  return (data ?? []).map((row, index) => {
    const r = row as {
      user_id: string;
      display_name: string;
      summary: string;
      evidence_count: number | string;
      detected_at: string;
    };
    return {
      rank: index + 1,
      userId: r.user_id,
      displayName: r.display_name,
      summary: r.summary,
      evidenceCount: Number(r.evidence_count),
      detectedAt: r.detected_at,
      isMe: myUserId !== null && r.user_id === myUserId,
    };
  });
}
