/**
 * 进度榜的网络层（docs/63 §五 · P4）。
 *
 * 规则在 src/core/progressBoard.ts；与服务端跑同一份实现
 * （docs/61 §2.2：同一份口径不许两处实现）。
 *
 * 上报载荷只有 { stageId, firstClearedAt } —— 没有序号、没有名次、
 * 没有 verified：序号服务端从白名单推导，名次服务端数出来，verified
 * 服务端用同源 evaluateChapterGate 判定，客户端无权自称任何一样。
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import {
  progressStageLabel,
  type ProgressBoardRow,
  type ProgressClaim,
} from '@/core/progressBoard';
import type { ClassId } from '@/core/types';
import { extractFunctionErrorMessage } from './leaderboard';
import { friendlyMessage, NetRequestError } from './supabase';

export interface ProgressSubmitResult {
  /** 榜上现在展示的最深处是否就是本次上报的这关（false = 另一设备报过更深） */
  updated: boolean;
  /** 只升不降之后账号实际的最深首通（可能深于本次提交） */
  deepestStageId: string;
  deepestStageIndex: number;
  firstClearedAt: number | null;
  /** L3 软旗标：false = 收下但不入榜 */
  verified: boolean;
  /** 我的名次（只在 verified 行内排；未入榜为 0） */
  rank: number;
  /** 榜上 verified 的账号数 */
  total: number;
}

/**
 * 上报当前最深首通。
 *
 * updated=false 不是失败：真实玩家的正常路径是「只在一台设备上玩」，
 * 走到那只可能是另一设备已报过更深，静默收下、不弹错误惊吓玩家。
 */
export async function submitProgressReport(
  client: SupabaseClient,
  claim: ProgressClaim,
): Promise<ProgressSubmitResult> {
  const { data, error } = await client.functions.invoke('submit-progress', {
    body: { stageId: claim.stageId, firstClearedAt: claim.firstClearedAt },
  });
  if (error) {
    const serverMessage = await extractFunctionErrorMessage(error);
    throw new NetRequestError(serverMessage ?? friendlyMessage(error.message, '进度上传失败'));
  }
  const body = data as Partial<ProgressSubmitResult> | null;
  if (
    !body ||
    typeof body.updated !== 'boolean' ||
    typeof body.deepestStageId !== 'string' ||
    typeof body.deepestStageIndex !== 'number'
  ) {
    throw new NetRequestError('服务端返回了无法识别的结果，请稍后重试');
  }
  return {
    updated: body.updated,
    deepestStageId: body.deepestStageId,
    deepestStageIndex: Math.max(0, Math.round(body.deepestStageIndex)),
    firstClearedAt: typeof body.firstClearedAt === 'number' ? body.firstClearedAt : null,
    verified: body.verified === true,
    rank: typeof body.rank === 'number' ? body.rank : 0,
    total: typeof body.total === 'number' ? body.total : 0,
  };
}

/**
 * 拉开荒同行榜（最深关卡降序，同关最早达成升序，无时刻排最后）。
 *
 * 只取 verified 行 —— 与服务端「未通过校验不入榜」同一个口径；
 * 名次只在 verified 行内排，这里是把它摆在一起对照。
 */
export async function fetchProgressBoard(
  client: SupabaseClient,
  myUserId: string | null,
  limit = 50,
): Promise<ProgressBoardRow[]> {
  const { data, error } = await client
    .from('progress_records')
    .select(
      'user_id, deepest_stage_id, deepest_stage_index, deepest_stage_at, profiles(display_name, avatar_url, class_id)',
    )
    .eq('verified', true)
    .order('deepest_stage_index', { ascending: false })
    .order('deepest_stage_at', { ascending: true, nullsFirst: false })
    .limit(limit);
  if (error) throw new NetRequestError(friendlyMessage(error.message, '进度榜读取失败'));

  return (data ?? []).map((row, index) => {
    const r = row as {
      user_id: string;
      deepest_stage_id: string;
      deepest_stage_index: number | string;
      deepest_stage_at: string | null;
      profiles:
        | { display_name: string | null; avatar_url: string | null; class_id: ClassId | null }
        | { display_name: string | null; avatar_url: string | null; class_id: ClassId | null }[]
        | null;
    };
    // PostgREST 多对一 embed 返回对象，但类型生成不可信 —— 两种形状都接住
    const profile = Array.isArray(r.profiles) ? (r.profiles[0] ?? null) : r.profiles;
    const { stageName, stageLevel } = progressStageLabel(r.deepest_stage_id);
    return {
      rank: index + 1,
      userId: r.user_id,
      displayName: profile?.display_name ?? '无名旅人',
      avatarUrl: profile?.avatar_url ?? null,
      classId: profile?.class_id ?? 'swordsman',
      stageName,
      stageLevel,
      deepestStageIndex: Number(r.deepest_stage_index),
      firstClearedAt: r.deepest_stage_at === null ? null : Date.parse(r.deepest_stage_at),
      isMe: r.user_id === myUserId,
    };
  });
}
