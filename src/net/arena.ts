/**
 * 竞技场网络 IO（docs/52 §7/§8）。
 *
 * 与 net/leaderboard.ts 同一条边界：这一层只做「把请求发出去、把响应
 * 摆平成类型」，不含任何游戏规则 —— 规则在 src/core/duel.ts，
 * 缓存在 src/stores/arena.ts。
 *
 * 最重要的边界（docs/52 §5.3）：客户端只提交「挑战谁、押多少、搭配快照」，
 * **不提交胜负**。胜负由 Edge Function 用同一份 core 代码复算出来，
 * 伪造战斗结果在结构上不可能。
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import type { DuelLogEvent } from '@/core/duel';
import type { ClassId, EquipmentInstance } from '@/core/types';
import { NetRequestError } from './supabase';
import { extractFunctionErrorMessage } from './leaderboard';

// ─────────────────────────── 类型 ───────────────────────────

/** 竞技场搭配快照（上传防守搭配与挑战时携带的是同一份）。 */
export interface ArenaSnapshotPayload {
  seasonId: string;
  classId: ClassId;
  level: number;
  displayName: string;
  /** 8 槽位穿戴快照，顺序与 SLOT_ORDER 一致 */
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

export interface ArenaMeState {
  rank: number;
  tier: string;
  honor: number;
  winStreak: number;
  total: number;
}

export interface ArenaSnapshotResult extends ArenaMeState {
  /** 是否本次新入榜（首次进入竞技场） */
  joined: boolean;
  /** 入場补给（仅 joined 时 > 0） */
  joinHonor: number;
}

export interface ArenaCandidate {
  userId: string;
  rank: number;
  displayName: string;
  classId: ClassId;
  combatPower: number;
  /** 服务端复算的预估胜率（0~1）；把「赌」变成「决策」 */
  winRate: number;
}

export interface ArenaBoardState extends ArenaMeState {
  attemptsLeft: number;
  attemptsMax: number;
}

/** 反击机会（docs/52 §六）：24 小时内攻破过我防线的对手，可零成本反击一次。 */
export interface ArenaRevengeEntry {
  userId: string;
  rank: number;
  displayName: string;
  classId: ClassId;
  combatPower: number;
  /** 服务端复算的预估胜率（0~1） */
  winRate: number;
  /** 对方攻破我防线的时间（ISO） */
  beatenAt: string;
  /** 反击机会过期时间（ISO） */
  expiresAt: string;
}

export interface ArenaCandidatesResult {
  me: ArenaBoardState;
  candidates: ArenaCandidate[];
  revenge: ArenaRevengeEntry[];
}

export interface ArenaBattleReplay {
  durationSec: number;
  attackerHpRemainPct: number;
  defenderHpRemainPct: number;
  attackerDamage: number;
  defenderDamage: number;
  log: DuelLogEvent[];
}

export interface ArenaChallengeResult {
  won: boolean;
  reason: 'knockout' | 'hp-percent';
  /** 荣誉净变化：赢 = +奖励；输 = −押注 */
  honorDelta: number;
  honor: number;
  rankBefore: number;
  rankAfter: number;
  winStreak: number;
  tier: string;
  attemptsLeft: number;
  battle: ArenaBattleReplay;
}

// ─────────────────────────── 防守快照 ───────────────────────────

/** 上传/刷新竞技场搭配快照；未入榜会自动排到榜尾并发入场补给。 */
export async function uploadArenaSnapshot(
  client: SupabaseClient,
  payload: ArenaSnapshotPayload,
): Promise<ArenaSnapshotResult> {
  const { data, error } = await client.functions.invoke('arena-snapshot', { body: payload });
  if (error) await throwInvokeError(error, '搭配上传失败');
  const body = data as Partial<ArenaSnapshotResult> | null;
  if (!body || typeof body.rank !== 'number' || typeof body.honor !== 'number') {
    throw new NetRequestError('服务端返回了无法识别的竞技场状态，请稍后重试');
  }
  return {
    rank: body.rank,
    tier: typeof body.tier === 'string' ? body.tier : 'qingying',
    honor: body.honor,
    winStreak: Number(body.winStreak ?? 0),
    total: Number(body.total ?? 1),
    joined: body.joined === true,
    joinHonor: Number(body.joinHonor ?? 0),
  };
}

// ─────────────────────────── 候选对手 ───────────────────────────

/** 拉取今日候选（服务端挑选的 3 个上方对手 + 我的竞技场状态）。 */
export async function fetchArenaCandidates(
  client: SupabaseClient,
  seasonId: string,
): Promise<ArenaCandidatesResult> {
  const { data, error } = await client.functions.invoke('arena-candidates', {
    body: { seasonId },
  });
  if (error) await throwInvokeError(error, '候选读取失败');
  const body = data as Partial<ArenaCandidatesResult> | null;
  if (!body || !body.me || typeof body.me.rank !== 'number' || !Array.isArray(body.candidates)) {
    throw new NetRequestError('服务端返回了无法识别的候选列表，请稍后重试');
  }
  return {
    me: {
      rank: body.me.rank,
      tier: typeof body.me.tier === 'string' ? body.me.tier : 'qingying',
      honor: Number(body.me.honor ?? 0),
      winStreak: Number(body.me.winStreak ?? 0),
      total: Number(body.me.total ?? 1),
      attemptsLeft: Number(body.me.attemptsLeft ?? 0),
      attemptsMax: Number(body.me.attemptsMax ?? 5),
    },
    candidates: body.candidates.map((c) => ({
      userId: String(c.userId),
      rank: Number(c.rank),
      displayName: String(c.displayName ?? '无名旅人'),
      classId: c.classId as ClassId,
      combatPower: Number(c.combatPower ?? 0),
      winRate: Number(c.winRate ?? 0),
    })),
    // 反击机会列表（可能缺省/为空）：24h 内攻破过我防线且未被消耗的对手
    revenge: Array.isArray(body.revenge)
      ? body.revenge.map((r) => ({
          userId: String(r.userId),
          rank: Number(r.rank),
          displayName: String(r.displayName ?? '无名旅人'),
          classId: r.classId as ClassId,
          combatPower: Number(r.combatPower ?? 0),
          winRate: Number(r.winRate ?? 0),
          beatenAt: String(r.beatenAt ?? ''),
          expiresAt: String(r.expiresAt ?? ''),
        }))
      : [],
  };
}

// ─────────────────────────── 发起挑战 ───────────────────────────

/** 发起挑战：只提交「挑战谁、押多少、当前搭配」，胜负由服务端复算返回。 */
export async function submitArenaChallenge(
  client: SupabaseClient,
  payload: ArenaSnapshotPayload & { defenderId: string; stake: number; isRevenge?: boolean },
): Promise<ArenaChallengeResult> {
  const { data, error } = await client.functions.invoke('arena-challenge', { body: payload });
  if (error) await throwInvokeError(error, '挑战发起失败');
  const body = data as Partial<ArenaChallengeResult> | null;
  if (
    !body ||
    typeof body.won !== 'boolean' ||
    typeof body.honor !== 'number' ||
    typeof body.rankAfter !== 'number' ||
    !body.battle ||
    !Array.isArray(body.battle.log)
  ) {
    throw new NetRequestError('服务端返回了无法识别的战果，请稍后重试');
  }
  return {
    won: body.won,
    reason: body.reason === 'hp-percent' ? 'hp-percent' : 'knockout',
    honorDelta: Number(body.honorDelta ?? 0),
    honor: body.honor,
    rankBefore: Number(body.rankBefore ?? body.rankAfter),
    rankAfter: body.rankAfter,
    winStreak: Number(body.winStreak ?? 0),
    tier: typeof body.tier === 'string' ? body.tier : 'qingying',
    attemptsLeft: Number(body.attemptsLeft ?? 0),
    battle: {
      durationSec: Number(body.battle.durationSec ?? 0),
      attackerHpRemainPct: Number(body.battle.attackerHpRemainPct ?? 0),
      defenderHpRemainPct: Number(body.battle.defenderHpRemainPct ?? 0),
      attackerDamage: Number(body.battle.attackerDamage ?? 0),
      defenderDamage: Number(body.battle.defenderDamage ?? 0),
      log: body.battle.log,
    },
  };
}

// ─────────────────────────── 奖励同步（每日结算 / 商店兑换） ───────────────────────────

/** 每日结算奖励箱的实际内容（服务端种子生成，客户端照单入库）。 */
export interface ArenaGrantBox {
  boxId: 'box_starlight' | 'box_sacred';
  honor: number;
  items: Record<string, number>;
}

/** settle 奖励的载荷：防线战报 + 段位奖励（UI 战报条的数据源）。 */
export interface ArenaSettlePayload {
  tier: string;
  tierName: string;
  rank: number;
  total: number;
  tierHonor: number;
  defense: { challenged: number; held: number; reward: number };
  boxes: ArenaGrantBox[];
}

/** shop 奖励的载荷：客户端用 seed 以同一份 core 确定性生成装备实例。 */
export interface ArenaShopGrantPayload {
  entryId: string;
  defId: string;
  seed: number;
}

export interface ArenaGrant {
  id: string;
  kind: 'settle' | 'shop';
  dayKey: string;
  payload: ArenaSettlePayload | ArenaShopGrantPayload;
  createdAt: string;
}

/** 拉取待同步进背包的奖励（结算与商店兑换；服务端持久等待，永不清空）。 */
export async function fetchPendingArenaGrants(client: SupabaseClient): Promise<ArenaGrant[]> {
  const { data, error } = await client
    .from('arena_grants')
    .select('id, kind, day_key, payload, created_at')
    .is('claimed_at', null)
    .order('created_at', { ascending: true });
  if (error) await throwInvokeError(error, '奖励同步失败');
  return (data ?? []).map((row) => ({
    id: String(row.id),
    kind: row.kind === 'shop' ? 'shop' : 'settle',
    dayKey: String(row.day_key),
    payload: row.payload as ArenaGrant['payload'],
    createdAt: String(row.created_at),
  }));
}

/** 标记奖励已同步进背包（只能标自己、只能标一次，RLS 保证）。 */
export async function markArenaGrantClaimed(
  client: SupabaseClient,
  grantId: string,
): Promise<void> {
  const { error } = await client
    .from('arena_grants')
    .update({ claimed_at: new Date().toISOString() })
    .eq('id', grantId)
    .is('claimed_at', null);
  if (error) await throwInvokeError(error, '奖励确认失败');
}

/** 荣誉商店兑换：服务端原子扣荣誉并写入奖励记录，返回扣后余额。 */
export async function buyArenaShopEntry(
  client: SupabaseClient,
  payload: { seasonId: string; entryId: string; classId: ClassId },
): Promise<{ honor: number }> {
  const { data, error } = await client.functions.invoke('arena-shop-buy', { body: payload });
  if (error) await throwInvokeError(error, '兑换失败');
  const body = data as { honor?: number } | null;
  if (!body || typeof body.honor !== 'number') {
    throw new NetRequestError('服务端返回了无法识别的兑换结果，请稍后重试');
  }
  return { honor: body.honor };
}

// ─────────────────────────── 内部 ───────────────────────────

/** 把服务端英文错误翻译成人话；原样透出会吓到玩家。 */
function friendlyMessage(raw: string, fallback: string): string {
  const text = raw.toLowerCase();
  if (text.includes('failed to fetch') || text.includes('network')) {
    return '网络连接失败，请检查网络后重试';
  }
  if (text.includes('jwt') || text.includes('auth')) {
    return '登录状态已过期，请重新打开竞技场';
  }
  // Edge Function 的业务错误（次数用完、荣誉不足等）原文是中文，直接透出
  return `${fallback}：${raw}`;
}

/**
 * 优先透出服务端 { error } 里的中文业务原因；没有正文时走兜底翻译。
 *
 * 注意 supabase-js 的 error.message 只有 "Edge Function returned a non-2xx
 * status code"，正文在 FunctionsHttpError.context（Response）里——
 * 用正则匹配 message 永远匹配不到，必须读 context。
 */
async function throwInvokeError(error: unknown, fallback: string): Promise<never> {
  const serverMessage = await extractFunctionErrorMessage(error);
  throw new NetRequestError(serverMessage ?? friendlyMessage((error as Error).message, fallback));
}
