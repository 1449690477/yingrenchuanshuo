/** 公会网络 IO：只负责 RPC/Edge Function 请求与响应整形，不包含规则计算。 */

import type { SupabaseClient } from '@supabase/supabase-js';
import type { ClassId, EquipmentInstance } from '@/core/types';
import { NetRequestError } from './supabase';
import { extractFunctionErrorMessage } from './leaderboard';

export interface GuildSummary {
  id: string;
  name: string;
  notice: string;
  reputation: number;
  expeditionClears: number;
  memberCount: number;
  memberLimit: number;
  /** 仅「我的公会」状态返回；广场与详情不暴露。 */
  inviteCode?: string;
}

/** 任意公会的公开详情：名片、公开名册与最近一周远征进度。 */
export interface GuildDetail {
  guild: GuildSummary & { leaderName: string; createdAt: string };
  members: GuildMember[];
  expedition: { weekKey: string; progress: number; target: number; completed: boolean } | null;
}

export interface GuildMember {
  userId: string;
  displayName: string;
  classId: ClassId;
  level: number;
  combatPower: number;
  role: 'leader' | 'member';
  joinedAt: string;
}

export interface GuildMembershipState {
  guild: GuildSummary & { leaderId: string };
  myRole: 'leader' | 'member';
  members: GuildMember[];
}

export interface GuildExpeditionState {
  guildId: string;
  expedition: {
    seasonId: string;
    weekIndex: number;
    weekKey: string;
    memberSnapshot: number;
    target: number;
    progress: number;
    completed: boolean;
    completedAt: string | null;
  };
  leaders: { userId: string; displayName: string; bestPoints: number }[];
  boss: {
    name: string;
    element: string;
    tiltId: string;
    tiltName: string;
    hint: string;
    bracketId: string;
    bracketName: string;
  };
  today: { attemptsUsed: number; attemptsMax: number; bestPoints: number };
  result?: GuildExpeditionResult;
}

export interface GuildExpeditionResult {
  points: number;
  improvedBy: number;
  bestPoints: number;
  attemptsUsed: number;
  progress: number;
  target: number;
  completed: boolean;
  justCompleted: boolean;
  damage: number;
  damageTaken: number;
  survived: boolean;
  durationSec: number;
  combatPower: number;
}

export interface GuildChallengePayload {
  requestId: string;
  seasonId: string;
  classId: ClassId;
  level: number;
  displayName: string;
  equipped: (EquipmentInstance | null)[];
  /**
   * 玩家编排的主动技能栏（M3-5）。**可选**：`undefined` = 从没编排过 ⇒
   * 服务端回落职业默认顺序，与技能栏上线前逐字一致。
   * 合法性由服务端走 core/skillSlots.ts 逐项过滤，客户端不预先筛。
   */
  selectedActiveSkillIds?: readonly string[];
  /** 玩家已持久化的技能等级；老客户端不发时全部按 1 级。 */
  skillLevels?: Readonly<Record<string, number>>;
}

function rpcError(raw: string, fallback: string): NetRequestError {
  // 后端尚未部署新函数时，把 PostgREST 的schema缓存报错翻成人话
  if (/PGRST202|schema cache|Could not find the function/i.test(raw)) {
    const err = new NetRequestError(`${fallback}：该功能尚未开通，请等待后端更新`);
    (err as NetRequestError & { missingFunction?: boolean }).missingFunction = true;
    return err;
  }
  return new NetRequestError(raw ? `${fallback}：${raw}` : fallback);
}

export async function fetchGuildList(client: SupabaseClient): Promise<GuildSummary[]> {
  const { data, error } = await client.rpc('guild_list', { p_limit: 30 });
  if (error) throw rpcError(error.message, '公会列表读取失败');
  return (data ?? []).map((row: Record<string, unknown>) => ({
    id: String(row.id),
    name: String(row.name ?? '未命名公会'),
    notice: String(row.notice ?? ''),
    reputation: Number(row.reputation ?? 0),
    expeditionClears: Number(row.expedition_clears ?? 0),
    memberCount: Number(row.member_count ?? 0),
    memberLimit: Number(row.member_limit ?? 20),
  }));
}

export async function fetchMyGuild(client: SupabaseClient): Promise<GuildMembershipState | null> {
  const { data, error } = await client.rpc('guild_get_my_state');
  if (error) throw rpcError(error.message, '公会状态读取失败');
  return (data as GuildMembershipState | null) ?? null;
}

export async function createGuild(client: SupabaseClient, name: string): Promise<void> {
  const { error } = await client.rpc('guild_create', { p_name: name });
  if (error) throw rpcError(error.message, '公会创建失败');
}

export async function joinGuild(client: SupabaseClient, guildId: string): Promise<void> {
  const { error } = await client.rpc('guild_join', { p_guild_id: guildId });
  if (error) throw rpcError(error.message, '加入公会失败');
}

export async function fetchGuildDetail(
  client: SupabaseClient,
  guildId: string,
): Promise<GuildDetail> {
  const { data, error } = await client.rpc('guild_get_detail', { p_guild_id: guildId });
  if (error) throw rpcError(error.message, '公会详情读取失败');
  const detail = data as GuildDetail | null;
  if (!detail?.guild) throw rpcError('', '公会详情读取失败');
  return detail;
}

export async function joinGuildByCode(
  client: SupabaseClient,
  code: string,
): Promise<{ id: string; name: string }> {
  const { data, error } = await client.rpc('guild_join_by_code', { p_code: code });
  if (error) throw rpcError(error.message, '邀请码加入失败');
  const joined = data as { id?: string; name?: string } | null;
  if (!joined?.id) throw rpcError('', '邀请码加入失败');
  return { id: String(joined.id), name: String(joined.name ?? '公会') };
}

/** 后端尚未部署新 RPC 时的识别：优先看 rpcError 打的标记，兜底匹配原始报文。 */
export function isMissingGuildFunctionError(error: unknown): boolean {
  if ((error as { missingFunction?: boolean } | null)?.missingFunction) return true;
  const message = error instanceof Error ? error.message : String(error ?? '');
  return /PGRST202|schema cache|Could not find the function|find the function/i.test(message);
}

export async function leaveGuild(client: SupabaseClient): Promise<void> {
  const { error } = await client.rpc('guild_leave');
  if (error) throw rpcError(error.message, '退出公会失败');
}

export async function updateGuildNotice(client: SupabaseClient, notice: string): Promise<void> {
  const { error } = await client.rpc('guild_update_notice', { p_notice: notice });
  if (error) throw rpcError(error.message, '公告更新失败');
}

export async function removeGuildMember(client: SupabaseClient, userId: string): Promise<void> {
  const { error } = await client.rpc('guild_remove_member', { p_user_id: userId });
  if (error) throw rpcError(error.message, '移除成员失败');
}

export async function fetchGuildExpedition(
  client: SupabaseClient,
  seasonId: string,
  level: number,
): Promise<GuildExpeditionState> {
  return invokeExpedition(client, { action: 'state', seasonId, level });
}

export async function submitGuildExpedition(
  client: SupabaseClient,
  payload: GuildChallengePayload,
): Promise<GuildExpeditionState> {
  return invokeExpedition(client, { action: 'challenge', ...payload });
}

async function invokeExpedition(
  client: SupabaseClient,
  body: Record<string, unknown>,
): Promise<GuildExpeditionState> {
  const { data, error } = await client.functions.invoke('guild-expedition', { body });
  if (error) {
    const message = await extractFunctionErrorMessage(error);
    throw new NetRequestError(message ?? `公会远征连接失败：${(error as Error).message}`);
  }
  const state = data as GuildExpeditionState | null;
  if (!state?.expedition || !state.boss || !state.today) {
    throw new NetRequestError('服务端返回了无法识别的公会远征状态');
  }
  return state;
}
