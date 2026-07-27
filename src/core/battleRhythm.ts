/**
 * 战斗节奏状态机 —— 驱动挂机画面的持续演出。
 *
 * ## 为什么需要它
 *
 * 挂机的真实结算（core/idle.ts）是按「每秒击杀数」的期望值推进的，
 * 一次击杀之间可能隔好几秒。如果画面只在击杀时才动，
 * 玩家看到的就是「角色杵在原地不动，只有血条在掉」——
 * 这正是最初版本的问题。
 *
 * 本模块按玩家攻速与技能冷却，**独立于击杀**地产生一串「拍子」（beat），
 * 让角色持续挥砍、怪物持续受击、技能按冷却轮转释放。
 *
 * ## 铁律：它只管画面，不管数值
 *
 * 这里产生的伤害数字**纯粹是展示用的**，不参与经验、金币、掉落、
 * 关卡进度或任何存档状态。真实结算永远在 core/idle.ts。
 * 之所以还是要算一个数字出来，是因为飘字得有内容；
 * 它取自与真实战斗相同的属性，所以看起来是自洽的。
 *
 * 这样拆开的好处：改演出永远不会改坏数值，改数值也不会让演出错乱。
 */

import type { Rng } from './rng';

export type BeatKind = 'player-attack' | 'player-skill' | 'monster-attack';

export interface BattleBeat {
  /** 自增序号。UI 拿它当动画 key，保证每拍都能重新触发。 */
  seq: number;
  kind: BeatKind;
  /** 是否暴击。仅玩家出手的拍子可能为 true。 */
  crit: boolean;
  /** 展示用伤害数字（非真实结算值） */
  damage: number;
  /** 'player-skill' 专有：技能在已解锁列表中的下标 */
  skillIndex: number | null;
}

export interface RhythmState {
  seq: number;
  /** 距离下一次玩家普攻的剩余秒数 */
  playerCd: number;
  /** 距离下一次怪物攻击的剩余秒数 */
  monsterCd: number;
  /** 各技能的剩余冷却秒数，长度与已解锁技能数一致 */
  skillCds: number[];
}

export interface RhythmParams {
  /** 玩家普攻间隔（秒），通常是 1 / 攻速 */
  playerInterval: number;
  /** 怪物攻击间隔（秒） */
  monsterInterval: number;
  /** 各技能冷却（秒），顺序与 skillCds 对应 */
  skillCooldowns: readonly number[];
  /** 暴击率，0~1 */
  critRate: number;
  /** 玩家一次普攻的展示伤害基准 */
  playerHit: number;
  /** 怪物一次攻击的展示伤害基准 */
  monsterHit: number;
}

/**
 * 单次推进最多产生多少拍。
 *
 * 手机切后台再回来，dt 可能是几十秒甚至几分钟。
 * 不设上限的话会一口气吐出上千拍，把渲染打爆。
 * 超出的部分直接丢弃 —— 反正玩家没在看。
 */
const MAX_BEATS_PER_ADVANCE = 12;

/** 时间步进的下限，避免 0 或负的间隔造成死循环 */
const MIN_INTERVAL = 0.05;

export function createRhythmState(skillCount: number): RhythmState {
  if (!Number.isSafeInteger(skillCount) || skillCount < 0) {
    throw new Error(`[战斗节奏] 技能数量必须是非负整数：${skillCount}`);
  }
  return {
    seq: 0,
    playerCd: 0,
    monsterCd: 0,
    // 技能一开始就错峰，避免所有技能在同一拍同时炸开
    skillCds: Array.from({ length: skillCount }, (_, i) => i * 0.7),
  };
}

/** 技能数量变化时（升级解锁了新技能）重建冷却数组，保留已有进度 */
export function resizeSkillCds(state: RhythmState, skillCount: number): RhythmState {
  if (state.skillCds.length === skillCount) return state;
  const next = Array.from(
    { length: skillCount },
    (_, i) => state.skillCds[i] ?? i * 0.7,
  );
  return { ...state, skillCds: next };
}

export interface RhythmAdvance {
  state: RhythmState;
  beats: BattleBeat[];
  /** 因超过单次上限而被丢弃的拍数，用于调试 */
  dropped: number;
}

/**
 * 推进节奏，产生这段时间内应该发生的拍子。
 *
 * @param dt 距上次推进的秒数
 * @param rng 用于暴击与伤害浮动；传入可复现的 Rng 便于测试
 */
export function advanceRhythm(
  state: RhythmState,
  dt: number,
  params: RhythmParams,
  rng: Rng,
): RhythmAdvance {
  validateRhythmInputs(state, params);
  if (!Number.isFinite(dt) || dt <= 0) {
    return { state, beats: [], dropped: 0 };
  }

  const playerInterval = params.playerInterval;
  const monsterInterval = params.monsterInterval;

  let seq = state.seq;
  let playerCd = state.playerCd - dt;
  let monsterCd = state.monsterCd - dt;
  const skillCds = state.skillCds.map((cd) => cd - dt);

  const beats: BattleBeat[] = [];
  let dropped = 0;

  const push = (beat: Omit<BattleBeat, 'seq'>): void => {
    if (beats.length >= MAX_BEATS_PER_ADVANCE) {
      dropped++;
      return;
    }
    beats.push({ ...beat, seq: ++seq });
  };

  // ── 玩家普攻 ──
  let guard = 0;
  while (playerCd <= 0 && guard++ < 200) {
    const crit = rng.chance(params.critRate);
    push({
      kind: 'player-attack',
      crit,
      damage: rollDamage(params.playerHit, crit, rng),
      skillIndex: null,
    });
    playerCd += playerInterval;
  }

  // ── 技能 ──
  for (let i = 0; i < skillCds.length; i++) {
    const cooldown = params.skillCooldowns[i]!;
    let g = 0;
    while (skillCds[i]! <= 0 && g++ < 50) {
      const crit = rng.chance(params.critRate);
      push({
        kind: 'player-skill',
        crit,
        // 技能伤害比普攻高，视觉上要能区分出来
        damage: rollDamage(params.playerHit * 2.4, crit, rng),
        skillIndex: i,
      });
      skillCds[i] = skillCds[i]! + cooldown;
    }
  }

  // ── 怪物反击 ──
  guard = 0;
  while (monsterCd <= 0 && guard++ < 200) {
    push({
      kind: 'monster-attack',
      crit: false,
      damage: rollDamage(params.monsterHit, false, rng),
      skillIndex: null,
    });
    monsterCd += monsterInterval;
  }

  // 拍子按种类分组产生，这里按序号排一下，让 UI 拿到的是时间顺序
  beats.sort((a, b) => a.seq - b.seq);

  return {
    state: { seq, playerCd, monsterCd, skillCds },
    beats,
    dropped,
  };
}

function rollDamage(base: number, crit: boolean, rng: Rng): number {
  if (!Number.isFinite(base) || base <= 0) return 0;
  const variance = rng.float(0.9, 1.12);
  const critMul = crit ? 1.8 : 1;
  return Math.max(1, Math.round(base * variance * critMul));
}

function validateRhythmInputs(state: RhythmState, params: RhythmParams): void {
  if (params.skillCooldowns.length !== state.skillCds.length) {
    throw new Error(
      `[战斗节奏] 技能冷却数量 ${params.skillCooldowns.length} 与状态数量 ${state.skillCds.length} 不一致`,
    );
  }
  if (state.skillCds.some((cooldown) => !Number.isFinite(cooldown))) {
    throw new Error('[战斗节奏] 状态中的技能冷却必须全部是有限数');
  }
  for (const [label, interval] of [
    ['玩家攻击间隔', params.playerInterval],
    ['怪物攻击间隔', params.monsterInterval],
  ] as const) {
    if (!Number.isFinite(interval) || interval < MIN_INTERVAL) {
      throw new Error(`[战斗节奏] ${label}必须是 >= ${MIN_INTERVAL} 秒的有限数`);
    }
  }
  if (
    params.skillCooldowns.some(
      (cooldown) => !Number.isFinite(cooldown) || cooldown < MIN_INTERVAL,
    )
  ) {
    throw new Error(`[战斗节奏] 技能冷却必须全部是 >= ${MIN_INTERVAL} 秒的有限数`);
  }
  if (!Number.isFinite(params.critRate) || params.critRate < 0 || params.critRate > 1) {
    throw new Error('[战斗节奏] 暴击率必须在 0~1');
  }
  if (!Number.isFinite(params.playerHit) || params.playerHit <= 0) {
    throw new Error('[战斗节奏] 玩家展示伤害必须是正有限数');
  }
  if (!Number.isFinite(params.monsterHit) || params.monsterHit <= 0) {
    throw new Error('[战斗节奏] 怪物展示伤害必须是正有限数');
  }
}
