/**
 * 挂机产出与离线结算。
 * 定义见 docs/10-数值与战斗.md 第三节。
 *
 * 关键设计：离线用「时间戳差值」一次性结算，绝不用 setInterval 累加。
 * 手机浏览器切后台会节流定时器，累加出来的时间是错的。
 */

import type { Combatant, IdleYield, LootTable } from './types';
import { estimateDps } from './combat';
import { expectedLoot } from './loot';
import {
  DEFAULT_MAX_KILLS_PER_SEC,
  OFFLINE_CAP_SECONDS,
  OFFLINE_EFFICIENCY,
  STAMINA_RECOVER_SECONDS,
  SWEEP_EQUIV_SECONDS,
} from '@/data/constants';

export interface IdleContext {
  player: Combatant;
  /** 关卡的代表性怪物（取该关平均水平的小怪） */
  monster: Combatant;
  /** 单只怪给的经验 */
  expPerKill: number;
  /** 单只怪给的金币 */
  goldPerKill: number;
  /** 关卡掉落表 */
  lootTable: LootTable;
  /** 关卡每秒击杀上限 */
  maxKillsPerSec?: number;
  /** 玩家平均技能倍率 */
  skillMultiplier?: number;
}

/**
 * 每秒击杀数。
 *
 * 上限的意义：防止高战玩家回头在低级图无限刷。
 * 没有这个上限，Lv90 玩家去打 Lv10 的图会得到荒谬的产出。
 */
export function killsPerSecond(ctx: IdleContext): number {
  const dps = estimateDps(ctx.player, ctx.monster, ctx.skillMultiplier ?? 1.0);
  if (dps <= 0 || ctx.monster.stats.hp <= 0) return 0;

  const raw = dps / ctx.monster.stats.hp;
  const cap = ctx.maxKillsPerSec ?? DEFAULT_MAX_KILLS_PER_SEC;
  return Math.min(raw, cap);
}

/**
 * 结算一段时长的挂机产出。
 *
 * @param seconds 实际挂机秒数（调用方负责已做上限截断）
 * @param efficiency 效率系数，在线为 1.0
 */
export function settleIdle(ctx: IdleContext, seconds: number, efficiency = 1.0): IdleYield {
  if (seconds <= 0) {
    return { exp: 0, gold: 0, kills: 0, loot: [] };
  }

  const kps = killsPerSecond(ctx);
  const kills = Math.floor(kps * seconds * efficiency);

  return {
    kills,
    exp: Math.floor(kills * ctx.expPerKill),
    gold: Math.floor(kills * ctx.goldPerKill),
    loot: expectedLoot(ctx.lootTable, kills),
  };
}

export interface OfflineSettlement {
  /** 实际计入的秒数（已截断） */
  seconds: number;
  /** 被上限砍掉的秒数，用于 UI 提示「你溢出了 X 小时」 */
  cappedSeconds: number;
  yield: IdleYield;
}

/**
 * 离线结算。
 *
 * @param lastActiveAt 上次活跃的时间戳（毫秒）
 * @param now          当前时间戳（毫秒）
 * @param capSeconds   离线上限，默认 8 小时
 */
export function settleOffline(
  ctx: IdleContext,
  lastActiveAt: number,
  now: number,
  capSeconds = OFFLINE_CAP_SECONDS,
): OfflineSettlement {
  // 系统时间回拨保护：now < lastActiveAt 时按 0 处理，不给负收益也不报错
  const elapsed = Math.max(0, Math.floor((now - lastActiveAt) / 1000));
  const seconds = Math.min(elapsed, capSeconds);
  const cappedSeconds = elapsed - seconds;

  return {
    seconds,
    cappedSeconds,
    yield: settleIdle(ctx, seconds, OFFLINE_EFFICIENCY),
  };
}

/** 一次扫荡的产出，等同 30 分钟挂机 */
export function settleSweep(ctx: IdleContext, times = 1): IdleYield {
  return settleIdle(ctx, SWEEP_EQUIV_SECONDS * times, 1.0);
}

/**
 * 体力恢复计算。
 * 同样用时间戳而非定时器。
 */
export function recoverStamina(
  current: number,
  max: number,
  lastRecoverAt: number,
  now: number,
): { stamina: number; nextRecoverAt: number } {
  if (current >= max) {
    // 已满则把计时基准推到当前，避免下次一口气回满
    return { stamina: current, nextRecoverAt: now };
  }

  const elapsed = Math.max(0, Math.floor((now - lastRecoverAt) / 1000));
  const gained = Math.floor(elapsed / STAMINA_RECOVER_SECONDS);
  if (gained <= 0) return { stamina: current, nextRecoverAt: lastRecoverAt };

  const stamina = Math.min(max, current + gained);
  // 余数保留，不浪费玩家已经等待的时间
  const consumed = gained * STAMINA_RECOVER_SECONDS * 1000;

  return {
    stamina,
    nextRecoverAt: stamina >= max ? now : lastRecoverAt + consumed,
  };
}
