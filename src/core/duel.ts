/**
 * 竞技场对决结算（PvP）。
 *
 * 设计口径见 docs/54-竞技场对战设计.md §五：
 *   - 双方满血开打，按 spd 决定行动顺序与行动频率 —— 直接复用 simulateFight
 *     的 tick 循环，不另起一套战斗规则
 *   - 上限 30 回合（ARENA_MAX_ROUNDS）；到达上限按剩余生命百分比判胜，
 *     百分比也相同判防守方胜 —— 挑战者需要明确击败对手
 *   - 客户端不提交胜负：服务端取双方快照、用同一份代码复算（§5.3）
 *   - 返回逐回合日志，客户端播成战斗动画（§5.4，战报必须能回放）
 *
 * 「回合」的实现口径：行动慢的一侧打满 ARENA_MAX_ROUNDS 次行动所需的时间窗。
 * 窗内快的一侧按 spd 比例自然获得更多行动 —— 这样攻速 Builds 的价值
 * 与主线战斗完全一致，不存在第二套规则。
 *
 * 先手不固定属于挑战者：simulateFight 每个 tick 内 player 侧先行动，
 * 同战力镜像局固定先手会带来约 67% 的系统偏向。因此每场对决用种子
 * 掷一次硬币决定谁占 player 位 —— 先手优势保留在对局内，
 * 但不固定偏向攻守任何一方（sim 门禁：同战力胜率 45%~55%）。
 *
 * 本文件是纯函数（AGENTS.md 铁律 1/3/4）：不读时间、不写存储、禁用 Math.random。
 */

import { simulateFight, type CombatTimelineEvent } from './combat';
import type { SkillCombatKit } from './skillCombat';
import { Rng } from './rng';
import { businessDayKey } from './dayKey';
import { buildTrialCombatant, fnv1a32, type TrialBuildInput } from './trial';
import type {
  OnCritPeriodicDamageTrigger,
  OnHitElementalDamageTrigger,
  OnLethalRecoveryTrigger,
} from './equipmentSets';
import type { Combatant, Element } from './types';
import { arenaSetPieceCount, ARENA_EQUIPMENT_SET } from '@/data/arenaEquipment';
import {
  ARENA_MAX_ROUNDS,
  ARENA_OPPONENT_MAX_ABOVE,
  ARENA_OPPONENT_MIN_ABOVE,
  ARENA_RANK_DIFF_BANDS,
  ARENA_RESET_HOUR_CST,
  ARENA_SET_DEFENDER_DR_BONUS,
  ARENA_STREAK_BANDS,
  ARENA_TIERS,
  ARENA_WIN_CHANCE_SIMULATIONS,
  type ArenaTier,
} from '@/data/arenaRules';

// ─────────────────────────── 对决双方 ───────────────────────────

/**
 * 对决一侧的完整输入。
 *
 * 与 trial.ts 的 TrialBuild 结构兼容：buildTrialCombatant 的产物可直接传入。
 * 双方都不含好感加成（快照由服务端复算，好感进度只在客户端，见 trial.ts）。
 */
export interface DuelSide {
  combatant: Combatant;
  skillMultiplier: number;
  /** M3-4 真实技能栏；存在时优先于旧平均倍率。 */
  skillKit?: SkillCombatKit;
  onHitTriggers?: readonly OnHitElementalDamageTrigger[];
  onLethalTriggers?: readonly OnLethalRecoveryTrigger[];
  onCritTriggers?: readonly OnCritPeriodicDamageTrigger[];
}

export type DuelRole = 'attacker' | 'defender';

/** 由搭配快照构建对决一侧；圣痕套效果只在这条管线生效（docs/53 §六）。 */
export interface ArenaDuelSide extends DuelSide {
  combatPower: number;
  buildHash: string;
  /** 激活的圣痕套件数（0~4，UI 展示用） */
  arenaSetPieces: number;
}

/**
 * 对决侧构建（服务端复算与胜率预估共用同一入口，保证口径逐点一致）：
 *   - 圣痕套 2/4 件效果经由 buildTrialCombatant 的 arena 模式全量结算；
 *   - 防守方集齐 4 件时额外 +5% 减伤（docs/53 §1.3：套装是排名的护城河，
 *     只加防守不加进攻，不影响挑战者进攻时的强度平衡）。
 */
export function buildArenaDuelSide(input: TrialBuildInput, role: DuelRole): ArenaDuelSide {
  const build = buildTrialCombatant({ ...input, arena: true });
  const pieces = arenaSetPieceCount(input.equipped);
  const baseBonuses = build.combatant.combatBonuses ?? {
    damageReduction: 0,
    lifesteal: 0,
    elementDamage: { fire: 0, ice: 0, thunder: 0 },
  };
  const combatant: Combatant = {
    ...build.combatant,
    combatBonuses: { ...baseBonuses, elementDamage: { ...baseBonuses.elementDamage } },
  };
  if (role === 'defender' && pieces >= 4) {
    combatant.combatBonuses!.damageReduction += ARENA_SET_DEFENDER_DR_BONUS;
  }
  return {
    combatant,
    skillMultiplier: build.skillMultiplier,
    ...(build.skillKit ? { skillKit: build.skillKit } : {}),
    onHitTriggers: build.onHitTriggers,
    onLethalTriggers: build.onLethalTriggers,
    onCritTriggers: build.onCritTriggers,
    combatPower: build.combatPower,
    buildHash: build.buildHash,
    arenaSetPieces: pieces,
  };
}

/** 圣痕套定义的转发（UI 展示套装进度时不必再从 data 层多引一条）。 */
export { ARENA_EQUIPMENT_SET };

export type DuelEndReason =
  /** 一方被打空血 */
  | 'knockout'
  /** 到达回合上限，按剩余生命百分比判定 */
  | 'hp-percent';

/** 战报单条事件（供回放动画消费；写入 arena_battles.battle_log）。 */
export interface DuelLogEvent {
  sequence: number;
  source: DuelRole;
  target: DuelRole;
  kind:
    | 'direct-damage'
    | 'on-hit-elemental-damage'
    | 'periodic-damage'
    | 'lethal-recovery'
    | 'on-crit-recovery';
  damage: number;
  healing?: number;
  hit: boolean;
  crit: boolean;
  element?: Element;
  triggerId?: string;
  statusId?: string;
  stacks?: number;
}

export interface DuelResult {
  winner: DuelRole;
  reason: DuelEndReason;
  durationSec: number;
  /** 双方各自完成的直接行动次数（on-hit 追加段不计） */
  attackerActions: number;
  defenderActions: number;
  /** 结束时双方剩余生命百分比（0~1） */
  attackerHpRemainPct: number;
  defenderHpRemainPct: number;
  attackerDamage: number;
  defenderDamage: number;
  log: readonly DuelLogEvent[];
}

function assertDuelSide(side: DuelSide, label: string): void {
  const { stats } = side.combatant;
  if (!Number.isFinite(stats.hp) || stats.hp <= 0) {
    throw new Error(`[对决] ${label} 生命必须为正，收到 ${stats.hp}`);
  }
  if (!Number.isFinite(side.skillMultiplier) || side.skillMultiplier <= 0) {
    throw new Error(`[对决] ${label} 技能倍率必须为正，收到 ${side.skillMultiplier}`);
  }
}

/**
 * 跑一场对决。纯函数：同双方、同一种子必然得到同一结果。
 * 不会修改入参（内部先拷贝，simulateFight 会改写 currentHp）。
 *
 * 先手由种子掷硬币分配：simulateFight 的 player 侧在每个 tick 先行动，
 * 固定让挑战者占 player 位会让镜像局胜率系统性偏向 ~67%。
 */
export function simulateDuel(attacker: DuelSide, defender: DuelSide, rng: Rng): DuelResult {
  assertDuelSide(attacker, '挑战者');
  assertDuelSide(defender, '防守方');
  return simulateDuelWithFirst(attacker, defender, rng, rng.chance(0.5));
}

/**
 * 指定先手方的对决实现。
 *
 * 与 simulateDuel 分离是为了胜率预估能做分层抽样（奇偶交替先手，
 * 消除先手份额的采样噪声）；服务端复算永远走 simulateDuel，
 * 同一种子的硬币结果与战斗流逐点一致，两条路径不会混用。
 */
export function simulateDuelWithFirst(
  attacker: DuelSide,
  defender: DuelSide,
  rng: Rng,
  attackerFirst: boolean,
): DuelResult {
  assertDuelSide(attacker, '挑战者');
  assertDuelSide(defender, '防守方');

  const first = attackerFirst ? attacker : defender;
  const second = attackerFirst ? defender : attacker;

  const p: Combatant = {
    ...first.combatant,
    stats: { ...first.combatant.stats },
    currentHp: first.combatant.stats.hp,
  };
  const m: Combatant = {
    ...second.combatant,
    stats: { ...second.combatant.stats },
    currentHp: second.combatant.stats.hp,
  };

  const slowSpd = Math.max(0.01, Math.min(p.stats.spd, m.stats.spd));
  const maxSeconds = ARENA_MAX_ROUNDS / slowSpd;

  const result = simulateFight(p, m, rng, {
    maxSeconds,
    playerSkillMultiplier: first.skillMultiplier,
    monsterSkillMultiplier: second.skillMultiplier,
    playerSkillKit: first.skillKit,
    monsterSkillKit: second.skillKit,
    playerOnHitTriggers: first.onHitTriggers,
    monsterOnHitTriggers: second.onHitTriggers,
    playerOnLethalTriggers: first.onLethalTriggers,
    monsterOnLethalTriggers: second.onLethalTriggers,
    playerOnCritTriggers: first.onCritTriggers,
    monsterOnCritTriggers: second.onCritTriggers,
  });

  const pPct = Math.max(0, p.currentHp) / result.playerMaxHp;
  const mPct = Math.max(0, m.currentHp) / result.monsterMaxHp;
  const attackerPct = attackerFirst ? pPct : mPct;
  const defenderPct = attackerFirst ? mPct : pPct;

  let winner: DuelRole;
  let reason: DuelEndReason;
  if (m.currentHp <= 0 && p.currentHp > 0) {
    winner = attackerFirst ? 'attacker' : 'defender';
    reason = 'knockout';
  } else if (p.currentHp <= 0) {
    winner = attackerFirst ? 'defender' : 'attacker';
    reason = 'knockout';
  } else {
    // 回合上限：百分比高者胜；并列判防守方胜（docs/52 §5.2）
    winner = attackerPct > defenderPct ? 'attacker' : 'defender';
    reason = 'hp-percent';
  }

  let attackerActions = 0;
  let defenderActions = 0;
  const log: DuelLogEvent[] = result.events.map((ev) => {
    const source: DuelRole =
      (ev.source === 'player') === attackerFirst ? 'attacker' : 'defender';
    const target: DuelRole =
      (ev.target === 'player') === attackerFirst ? 'attacker' : 'defender';
    if (ev.event.kind === 'direct-damage') {
      if (ev.event.skillId === undefined || ev.event.hitIndex === 1) {
        if (source === 'attacker') attackerActions++;
        else defenderActions++;
      }
      return {
        sequence: ev.sequence,
        source,
        target,
        kind: ev.event.kind,
        damage: ev.event.damage,
        hit: ev.event.hit,
        crit: ev.event.crit,
        element: ev.event.element,
      };
    }
    if (ev.event.kind === 'on-hit-elemental-damage') {
      return {
        sequence: ev.sequence,
        source,
        target,
        kind: ev.event.kind,
        damage: ev.event.damage,
        hit: true,
        crit: false,
        element: ev.event.element,
        triggerId: ev.event.triggerId,
      };
    }
    if (ev.event.kind === 'periodic-damage') {
      return {
        sequence: ev.sequence,
        source,
        target,
        kind: ev.event.kind,
        damage: ev.event.damage,
        hit: true,
        crit: false,
        element: ev.event.element,
        triggerId: ev.event.triggerId,
        statusId: ev.event.statusId,
        stacks: ev.event.stacks,
      };
    }
    return {
      sequence: ev.sequence,
      source,
      target,
      kind: ev.event.kind,
      damage: ev.event.damage,
      healing: ev.event.healing,
      hit: true,
      crit: false,
      triggerId: ev.event.triggerId,
    };
  });

  return {
    winner,
    reason,
    durationSec: result.duration,
    attackerActions,
    defenderActions,
    attackerHpRemainPct: attackerPct,
    defenderHpRemainPct: defenderPct,
    attackerDamage: Math.max(0, Math.round(attackerFirst ? result.damageDealt : result.damageTaken)),
    defenderDamage: Math.max(0, Math.round(attackerFirst ? result.damageTaken : result.damageDealt)),
    log,
  };
}

// ─────────────────────────── 种子与日切 ───────────────────────────

/**
 * 对决种子（docs/52 §5.3）：hash(attackerId, defenderId, dayKey, attemptIndex)。
 * 服务端与客户端用同一公式，重放验真逐点一致。
 */
export function duelSeed(
  attackerId: string,
  defenderId: string,
  dayKey: string,
  attemptIndex: number,
): number {
  return fnv1a32(`${attackerId}|${defenderId}|${dayKey}|${attemptIndex}`);
}

/** 竞技场业务日期（北京时间 04:00 日切，与全游戏同一套口径）。 */
export function arenaDayKey(now: number): string {
  return businessDayKey(now, ARENA_RESET_HOUR_CST);
}

// ─────────────────────────── 胜率预估 ───────────────────────────

/**
 * 预估挑战者胜率（docs/52 §3.2：候选卡必须显示预估胜率，
 * 它把「赌」变成「决策」）。
 *
 * 确定性蒙特卡洛 + 分层抽样：
 *   - 种子盐由双方 Build 的摘要哈希决定 —— 同两个 Build 在任何端、任何时间
 *     估出的胜率逐点一致，且不同对阵不会共用同一条相关种子流
 *   - 每个种子各打两场（双方轮流先手）—— 先手份额严格 50%，
 *     镜像局的两场互为角色交换的同一战斗，估计天然落在 50% 附近
 */
export function estimateDuelWinChance(
  attacker: DuelSide,
  defender: DuelSide,
  simulations = ARENA_WIN_CHANCE_SIMULATIONS,
): number {
  if (!Number.isInteger(simulations) || simulations <= 0) {
    throw new Error(`[对决] 胜率预估次数必须是正整数，收到 ${simulations}`);
  }
  const salt = fnv1a32(`${duelSideDigest(attacker)}#${duelSideDigest(defender)}`);
  const pairs = Math.ceil(simulations / 2);
  let wins = 0;
  let total = 0;
  for (let k = 0; k < pairs && total < simulations; k++) {
    const seed = (salt + Math.imul(k + 1, 0x9e3779b9)) >>> 0;
    for (const attackerFirst of [true, false] as const) {
      if (total >= simulations) break;
      const rng = new Rng(seed);
      if (simulateDuelWithFirst(attacker, defender, rng, attackerFirst).winner === 'attacker') {
        wins++;
      }
      total++;
    }
  }
  return wins / total;
}

/** 对决侧的稳定摘要：只取影响战斗结果的字段，用于胜率预估的种子盐。 */
function duelSideDigest(side: DuelSide): string {
  const s = side.combatant.stats;
  const triggers = (side.onHitTriggers ?? [])
    .map((t) => `${t.id}:${t.chance}:${t.atkMultiplier}:${t.element}`)
    .join(',');
  const lethalTriggers = (side.onLethalTriggers ?? [])
    .map((t) => `${t.id}:${t.healRatio}:${t.activationsPerFight}`)
    .join(',');
  const critTriggers = (side.onCritTriggers ?? [])
    .map(
      (t) =>
        `${t.id}:${t.healMaxHpRatio}:${t.statusId}:${t.atkMultiplierPerTick}:${t.ticks}:${t.durationSec}:${t.maxStacks}:${t.refresh}:${t.element ?? ''}`,
    )
    .join(',');
  return [
    s.hp,
    s.atk,
    s.def,
    s.spd,
    s.acc,
    s.eva,
    s.critRate,
    s.critDmg,
    side.skillMultiplier,
    side.combatant.element,
    JSON.stringify(side.combatant.combatBonuses ?? null),
    triggers,
    lethalTriggers,
    critTriggers,
  ].join('|');
}

// ─────────────────────────── 候选对手 ───────────────────────────

/**
 * 候选对手种子：同一玩家同一天看到同一批候选（docs/52 §3.2）。
 * 排名会随别人顶替而动，候选按「名次窗口」选取，服务端在拉取时
 * 把名次映射到当前占据该名次的玩家。
 */
export function arenaCandidateSeed(userId: string, dayKey: string): number {
  return fnv1a32(`cand|${userId}|${dayKey}`);
}

/**
 * 候选名次窗口：自己上方 1~15 名内无放回随机抽 count 个（Fisher-Yates
 * 部分洗牌，完全由种子决定）。默认抽满整个窗口，由调用方按需取前几个
 * （服务端要过滤掉今日已挑战过的对手后再补足 3 个）。
 *
 * 只能挑战排名在自己上方的人（docs/52 §七）——第 1 名没有候选，
 * 返回空数组是正常状态，不是错误。
 */
export function arenaCandidateRanks(
  myRank: number,
  seed: number,
  count = ARENA_OPPONENT_MAX_ABOVE,
): number[] {
  if (!Number.isInteger(myRank) || myRank <= 0) {
    throw new Error(`[对决] 排名必须是正整数，收到 ${myRank}`);
  }
  if (!Number.isInteger(count) || count <= 0) {
    throw new Error(`[对决] 候选数量必须是正整数，收到 ${count}`);
  }
  const lo = Math.max(1, myRank - ARENA_OPPONENT_MAX_ABOVE);
  const hi = myRank - ARENA_OPPONENT_MIN_ABOVE;
  if (hi < lo) return [];

  const pool: number[] = [];
  for (let r = lo; r <= hi; r++) pool.push(r);
  const rng = new Rng(seed);
  const n = Math.min(count, pool.length);
  for (let i = 0; i < n; i++) {
    const j = i + rng.int(0, pool.length - 1 - i);
    [pool[i], pool[j]] = [pool[j]!, pool[i]!];
  }
  return pool.slice(0, n);
}

// ─────────────────────────── 押注与荣誉结算 ───────────────────────────

/** 排名差倍率：对手排名比自己高 diff 名；超出配置区间返回 1。 */
export function arenaRankDiffMultiplier(diff: number): number {
  const band = ARENA_RANK_DIFF_BANDS.find((b) => diff >= b.minDiff && diff <= b.maxDiff);
  return band?.multiplier ?? 1;
}

/**
 * 连胜倍率：取满足条件的最高档；不足 2 连胜为 1。
 * 连胜在失败时归零、跨日保留（docs/52 §4.2）。
 */
export function arenaStreakMultiplier(streak: number): number {
  const band = ARENA_STREAK_BANDS.find((b) => streak >= b.streak);
  return band?.multiplier ?? 1;
}

/**
 * 挑战胜利获得的荣誉（不含退还的押注本身）：
 *   获得荣誉 = 押注 × 排名差倍率 × 连胜倍率
 * 连胜按「赢下这场之后」的新连胜计 —— 第二场连胜即享 1.2 倍。
 * 单次上限即 50 × 2.2 × 2.0 = 220（docs/52 §4.2 上限校验）。
 */
export function arenaVictoryHonor(stake: number, rankDiff: number, newStreak: number): number {
  if (!Number.isFinite(stake) || stake <= 0) {
    throw new Error(`[对决] 押注必须为正，收到 ${stake}`);
  }
  return Math.round(stake * arenaRankDiffMultiplier(rankDiff) * arenaStreakMultiplier(newStreak));
}

// ─────────────────────────── 段位 ───────────────────────────

/**
 * 按当前排名与参战总人数判定段位。
 * 段位赛季内只升不降 —— 本函数给出的是「当下所在段」，
 * 「只升不降」由存档/服务端取历史最高实现（docs/52 §4.3）。
 */
export function arenaTierFor(rank: number, totalPlayers: number): ArenaTier {
  if (!Number.isInteger(rank) || rank <= 0) {
    throw new Error(`[对决] 排名必须是正整数，收到 ${rank}`);
  }
  const total = Math.max(1, totalPlayers);
  for (const tier of ARENA_TIERS) {
    if (tier.topRank !== null && rank <= tier.topRank) return tier;
    if (tier.topPercent !== null && rank / total <= tier.topPercent) return tier;
  }
  return ARENA_TIERS[ARENA_TIERS.length - 1]!;
}

/** 供测试与 UI 引用的战报事件来源映射（simulateFight 的 player/monster → attacker/defender）。 */
export function duelRoleOfTimelineSource(source: CombatTimelineEvent['source']): DuelRole {
  return source === 'player' ? 'attacker' : 'defender';
}
