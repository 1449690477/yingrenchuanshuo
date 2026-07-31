/** 公会委托只读接口；结算始终由服务端复算的远征事件触发。 */
import type { SupabaseClient } from '@supabase/supabase-js';
import { NetRequestError } from './supabase';

export interface GuildCommissionEntry {
  id: string;
  name: string;
  description: string;
  contribution: number;
}

export interface GuildCommissionState {
  dayKey: string;
  commissions: GuildCommissionEntry[];
  progress: number;
  target: number;
  completed: boolean;
  participants: number;
  /** 当前成员今天已计入建设的阶梯；只作展示，不能由客户端写入。 */
  completedCommissionIds: string[];
}

function positiveInteger(value: unknown): number {
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed >= 0 ? parsed : 0;
}

function parseEntry(raw: unknown): GuildCommissionEntry | null {
  if (!raw || typeof raw !== 'object') return null;
  const row = raw as Record<string, unknown>;
  if (
    typeof row.id !== 'string' ||
    typeof row.name !== 'string' ||
    typeof row.description !== 'string'
  ) {
    return null;
  }
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    contribution: positiveInteger(row.contribution),
  };
}

/** 后端尚未部署时由调用方柔和降级，正常错误仍保持可诊断。 */
export async function fetchGuildCommissionState(
  client: SupabaseClient,
): Promise<GuildCommissionState | null> {
  const { data, error } = await client.rpc('guild_get_commission_state');
  if (error) throw new NetRequestError(`公会委托读取失败：${error.message}`);
  if (!data || typeof data !== 'object') return null;

  const row = data as Record<string, unknown>;
  const commissions = Array.isArray(row.commissions)
    ? row.commissions.map(parseEntry).filter((item): item is GuildCommissionEntry => item !== null)
    : [];
  if (typeof row.dayKey !== 'string' || commissions.length === 0) {
    throw new NetRequestError('公会委托读取失败：服务端返回了无法识别的状态');
  }
  return {
    dayKey: row.dayKey,
    commissions,
    progress: positiveInteger(row.progress),
    target: Math.max(1, positiveInteger(row.target)),
    completed: Boolean(row.completed),
    participants: positiveInteger(row.participants),
    completedCommissionIds: Array.isArray(row.completedCommissionIds)
      ? row.completedCommissionIds.filter((id): id is string => typeof id === 'string')
      : [],
  };
}
