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
}

function rpcError(raw: string, fallback: string): NetRequestError {
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
