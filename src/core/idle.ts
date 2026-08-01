/**
 * 挂机产出与离线结算。
 * 定义见 docs/10-数值与战斗.md 第三节。
 *
 * 关键设计：离线用「时间戳差值」一次性结算，绝不用 setInterval 累加。
 * 手机浏览器切后台会节流定时器，累加出来的时间是错的。
 */

import type {
  ClassId,
  Combatant,
  IdleYield,
  LootResult,
  LootTable,
  MonsterType,
} from './types';
import type { Rng } from './rng';
import { combatEfficiency, estimateDps } from './combat';
import type { OnHitElementalDamageTrigger } from './equipmentSets';
import type { SkillCombatKit } from './skillCombat';
import { expectedLoot, rollLoot, type PityCounters } from './loot';
import {
  DEFAULT_MAX_KILLS_PER_SEC,
  OFFLINE_CAP_SECONDS,
  OFFLINE_EFFICIENCY,
  STAMINA_RECOVER_SECONDS,
  SWEEP_EQUIV_SECONDS,
} from '@/data/constants';

export interface IdleContext {
  /** 用于过滤职业专属掉落；含专属条目的表结算时不可缺省。 */
  classId?: ClassId;
  player: Combatant;
  /** 关卡的代表性怪物（当前由 store 取第一波第一只怪） */
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
  /** M3-4 真实技能栏；存在时完全替代 skillMultiplier。 */
  skillKit?: SkillCombatKit;
  monsterType?: MonsterType;
  /** 每个直接真实命中独立判定的追加伤害；与前台逐击模拟共用定义。 */
  onHitTriggers?: readonly OnHitElementalDamageTrigger[];
}

/**
 * 每秒击杀数。
 *
 * 上限的意义：防止高战玩家回头在低级图无限刷。
 * 没有这个上限，Lv90 玩家去打 Lv10 的图会得到荒谬的产出。
 */
export function killsPerSecond(ctx: IdleContext): number {
  const dps = estimateDps(
    ctx.player,
    ctx.monster,
    ctx.skillMultiplier ?? 1.0,
    ctx.onHitTriggers,
    ctx.skillKit,
    ctx.monsterType,
  );
  if (dps <= 0 || ctx.monster.stats.hp <= 0) return 0;

  const raw = dps / ctx.monster.stats.hp;
  const efficiency = idleCombatEfficiency(ctx);
  const cap = ctx.maxKillsPerSec ?? DEFAULT_MAX_KILLS_PER_SEC;
  return Math.min(raw * efficiency, cap);
}

/** 当前挂机上下文的承伤效率；供结算与 UI 读取同一个纯函数结果。 */
export function idleCombatEfficiency(ctx: IdleContext): number {
  return combatEfficiency(ctx.player, ctx.monster, ctx.skillMultiplier ?? 1.0, {
    playerOnHitTriggers: ctx.onHitTriggers,
    playerSkillKit: ctx.skillKit,
    playerTargetType: ctx.monsterType,
  });
}

/**
 * 掉落结算方式。
 *
 * 'roll'     —— 逐只真掷骰子。**实时挂机必须用这个。**
 * 'expected' —— 用期望值一次算出。用于离线与扫荡。
 *
 * ⚠ 为什么不能全用 expected：期望值算完要向下取整，
 * 实时挂机一次只结算 1~2 只怪，期望值往往是 0.49 之类的小数，
 * floor 之后全变成 0 —— 玩家挂机半天背包一个东西都没有（真出过这个 bug）。
 *
 * 反过来，离线 8 小时可能是几万只怪，逐只掷骰既慢又没必要，
 * 而且方差会让玩家觉得「这次离线运气好差」，用期望值更稳。
 */
export type LootMode = 'roll' | 'expected';

export interface SettleOptions {
  efficiency?: number;
  mode?: LootMode;
  /** mode 为 'roll' 时必须提供 */
  rng?: Rng;
  /** 保底计数器，会被就地修改 */
  pity?: PityCounters;
}

/**
 * 结算一段时长的挂机产出。
 *
 * @param seconds 实际挂机秒数（调用方负责已做上限截断）
 */
export function settleIdle(ctx: IdleContext, seconds: number, opts: SettleOptions = {}): IdleYield {
  const efficiency = opts.efficiency ?? 1.0;
  if (seconds <= 0) {
    return { exp: 0, gold: 0, kills: 0, loot: [] };
  }

  const kps = killsPerSecond(ctx);
  const kills = Math.floor(kps * seconds * efficiency);
  if (kills <= 0) return { exp: 0, gold: 0, kills: 0, loot: [] };

  if (opts.mode === 'roll' && !opts.rng) {
    throw new Error('settleIdle: roll 模式必须提供 seeded RNG');
  }
  const useRoll = opts.mode === 'roll';

  let loot: LootResult[];
  if (useRoll) {
    const acc = new Map<string, number>();
    for (let i = 0; i < kills; i++) {
      for (const d of rollLoot(ctx.lootTable, opts.rng!, opts.pity, ctx.classId)) {
        acc.set(d.itemId, (acc.get(d.itemId) ?? 0) + d.count);
      }
    }
    loot = [...acc].map(([itemId, count]) => ({ itemId, count }));
  } else {
    loot = expectedLoot(ctx.lootTable, kills, ctx.classId);
  }

  return {
    kills,
    exp: Math.floor(kills * ctx.expPerKill),
    gold: Math.floor(kills * ctx.goldPerKill),
    loot,
  };
}

/**
 * 逐帧挂机累积。
 *
 * 为什么必须有这个：一帧只有零点几秒，而击杀速度可能是 0.58 只/秒，
 * 直接 `settleIdle(ctx, 0.5)` 得到 `floor(0.29) = 0` —— 每帧都归零，
 * 玩家永远拿不到任何产出。必须把不足一只的部分跨帧攒起来。
 *
 * @param carrySec 上次剩下的零头秒数，首次传 0
 * @returns 本次应结算的产出，以及要带到下一帧的零头
 */
export function accumulateIdle(
  ctx: IdleContext,
  dtSec: number,
  carrySec: number,
  opts: SettleOptions = {},
): { yield: IdleYield; carrySec: number } {
  const empty: IdleYield = { exp: 0, gold: 0, kills: 0, loot: [] };
  const total = Math.max(0, carrySec) + Math.max(0, dtSec);

  const kps = killsPerSecond(ctx);
  if (kps <= 0) return { yield: empty, carrySec: total };

  // 攒够一只怪的时间才结算
  const secondsPerKill = 1 / kps;
  if (total < secondsPerKill) return { yield: empty, carrySec: total };

  const y = settleIdle(ctx, total, opts);
  // 扣掉已结算击杀所对应的时间，余数留给下一帧
  const consumed = y.kills * secondsPerKill;

  return { yield: y, carrySec: Math.max(0, total - consumed) };
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
    yield: settleIdle(ctx, seconds, { efficiency: OFFLINE_EFFICIENCY, mode: 'expected' }),
  };
}

/** 一次扫荡的产出，等同 30 分钟挂机 */
export function settleSweep(ctx: IdleContext, times = 1): IdleYield {
  return settleIdle(ctx, SWEEP_EQUIV_SECONDS * times, { mode: 'expected' });
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

/**
 * 消耗体力并维护恢复时钟。
 *
 * 从满体力开始消费时，第一点恢复必须从“消费发生的此刻”计时；不能沿用满体力
 * 期间的旧时间戳，否则重开页面时会把消费前已经过去的时间重复结算，表现为刚花掉
 * 的体力瞬间回满。部分体力继续消费时则保留原时间戳，避免吃掉玩家已等待的余数。
 */
export function spendStamina(
  current: number,
  max: number,
  lastRecoverAt: number,
  cost: number,
  now: number,
): { stamina: number; nextRecoverAt: number } {
  if (!Number.isSafeInteger(current) || current < 0) {
    throw new Error(`spendStamina: 当前体力必须是非负安全整数，收到 ${current}`);
  }
  if (!Number.isSafeInteger(max) || max <= 0) {
    throw new Error(`spendStamina: 体力上限必须是正安全整数，收到 ${max}`);
  }
  if (!Number.isSafeInteger(cost) || cost < 0) {
    throw new Error(`spendStamina: 消耗必须是非负安全整数，收到 ${cost}`);
  }
  if (!Number.isFinite(lastRecoverAt) || !Number.isFinite(now)) {
    throw new Error('spendStamina: 恢复时间必须是有限数');
  }
  if (cost > current) {
    throw new Error(`spendStamina: 体力不足，当前 ${current}，需要 ${cost}`);
  }

  return {
    stamina: current - cost,
    nextRecoverAt: current >= max && cost > 0 ? now : lastRecoverAt,
  };
}
