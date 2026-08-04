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

/** 拍子的演出语义：伤害飘红字、治疗飘绿字、召唤走登场演出。 */
export type BeatEffect = 'damage' | 'heal' | 'summon';

export interface BattleBeat {
  /** 自增序号。UI 拿它当动画 key，保证每拍都能重新触发。 */
  seq: number;
  kind: BeatKind;
  /** 是否暴击。仅玩家伤害拍可能为 true。 */
  crit: boolean;
  /** 展示用数字（非真实结算值）：伤害拍是伤害、治疗拍是回复量、召唤拍恒为 0 */
  damage: number;
  /**
   * `player-skill` 专有：稳定技能 ID。
   *
   * 不能使用数组下标。职业升级、补技能或重新排序配置后，下标会变化，
   * 进而让表现层把旧冷却和拍子错认成另一张技能卡。
   */
  skillId: string | null;
  /** 演出语义；缺省按 'damage' 处理（兼容旧拍子消费方）。 */
  effect?: BeatEffect;
}

/** 视觉节奏生产器需要的最小技能配置。 */
export interface RhythmSkillSpec {
  skillId: string;
  cooldownSec: number;
  /**
   * 只决定同一帧内多个视觉技能同时就绪时的演出先后。
   * 它不是 M3-4 的真实战斗技能调度，也不参与挂机收益。
   */
  priority: number;
  /** 演出语义，缺省 'damage'。 */
  effect?: BeatEffect;
  /**
   * 释放门槛：剧场血量比例（battleVitalsAtProgress 的投影）不高于该值才演。
   * 与真实结算的 castWhen(self-hp-at-most) 同语义 —— 条件不满足时保持就绪、
   * 短暂重试，不空耗冷却。2026-08-04 起治疗/召唤进入挂机演出（此前被整类排除）。
   */
  castWhenSelfHpAtMost?: number;
  /** 释放门槛：目标（怪物）血量比例不高于该值才演。 */
  castWhenTargetHpAtMost?: number;
  /** 治疗拍展示回复量 = 该比例 × params.playerMaxHp。 */
  healMaxHpRatio?: number;
}

export interface RhythmState {
  seq: number;
  /** 距离下一次玩家普攻的剩余秒数 */
  playerCd: number;
  /** 距离下一次怪物攻击的剩余秒数 */
  monsterCd: number;
  /** 稳定技能 ID → 剩余冷却秒数。 */
  skillCds: Readonly<Record<string, number>>;
}

export interface RhythmActionSnapshot {
  cooldownSec: number;
  remainingSec: number;
  ratio: number;
  lastCastSeq: number | null;
}

export interface RhythmSkillSnapshot extends RhythmActionSnapshot {
  skillId: string;
}

/**
 * 给表现层消费的只读节奏快照。
 *
 * source 明示它是挂机视觉投影，避免 UI 把展示冷却误报成真实技能结算。
 */
export interface BattleRhythmSnapshot {
  source: 'visual-projection';
  /** 当前生产者上下文，Store 使用职业 ID；切职业时用于拒绝旧快照。 */
  contextId: string;
  epoch: number;
  seq: number;
  running: boolean;
  basic: RhythmActionSnapshot;
  skills: readonly RhythmSkillSnapshot[];
}

export interface RhythmSnapshotParams {
  contextId: string;
  epoch: number;
  running: boolean;
  playerCooldownSec: number;
  skills: readonly RhythmSkillSpec[];
  lastBasicCastSeq: number | null;
  lastCastBySkillId: Readonly<Record<string, number | null>>;
}

/**
 * BattleScene 消费拍子时使用的纯状态。
 *
 * 关卡切换会把节奏生产者的 seq 重新从 1 开始；空拍数组就是这个“新纪元”
 * 的显式边界。怪物入场期间产生的真实拍子暂存，入场结束后再消费，避免
 * 用假动作填空，也避免第一拍被静默吞掉。
 */
export interface BattleBeatGateState {
  /** 最近已观察到的生产者序号。 */
  cursor: number;
  /** 怪物入场期间已经产生、尚未交给表现层的真实拍子。 */
  pending: BattleBeat[];
}

export type BattleBeatGateMode = 'active' | 'spawn' | 'pulse';

export interface BattleBeatGateAdvance {
  state: BattleBeatGateState;
  /** 本次应交给表现层播放的真实拍子。 */
  consume: BattleBeat[];
  /** 生产者是否通过空数组开启了新的序号纪元。 */
  reset: boolean;
}

export function createBattleBeatGateState(): BattleBeatGateState {
  return { cursor: 0, pending: [] };
}

/**
 * 推进 BattleScene 的拍子门控。
 *
 * - `active`：立即消费未见过的拍子，并先补播入场期间暂存的真实拍；
 * - `spawn`：只暂存新拍，等待入场动画结束；
 * - `pulse`：击杀定格期间只推进游标，不允许旧目标的拍子打到新目标；
 * - 空数组：无条件归零游标。它是关卡 / 职业切换的生产者重置协议，
 *   不能受 watcher 执行顺序或当前入场状态影响。
 */
export function advanceBattleBeatGate(
  state: Readonly<BattleBeatGateState>,
  beats: readonly BattleBeat[],
  mode: BattleBeatGateMode,
): BattleBeatGateAdvance {
  if (!Number.isSafeInteger(state.cursor) || state.cursor < 0) {
    throw new Error(`[战斗拍门] 游标必须是非负安全整数：${state.cursor}`);
  }
  if (beats.length === 0) {
    return {
      state: createBattleBeatGateState(),
      consume: [],
      reset: true,
    };
  }

  const unseen = beats.filter((beat) => beat.seq > state.cursor);
  const cursor = unseen.reduce((highest, beat) => Math.max(highest, beat.seq), state.cursor);

  if (mode === 'pulse') {
    return {
      state: { cursor, pending: [] },
      consume: [],
      reset: false,
    };
  }
  if (mode === 'spawn') {
    return {
      state: { cursor, pending: [...state.pending, ...unseen] },
      consume: [],
      reset: false,
    };
  }
  return {
    state: { cursor, pending: [] },
    consume: [...state.pending, ...unseen],
    reset: false,
  };
}

export interface RhythmParams {
  /** 玩家普攻间隔（秒），通常是 1 / 攻速 */
  playerInterval: number;
  /** 怪物攻击间隔（秒） */
  monsterInterval: number;
  /** 本轮可进入可信攻击演出的技能。 */
  skills: readonly RhythmSkillSpec[];
  /** 暴击率，0~1 */
  critRate: number;
  /** 玩家一次普攻的展示伤害基准 */
  playerHit: number;
  /** 怪物一次攻击的展示伤害基准 */
  monsterHit: number;
  /** 剧场玩家血量比例（0~1），供 castWhenSelfHpAtMost 门控；缺省视为满血。 */
  selfHpRatio?: number;
  /** 剧场目标血量比例（0~1），供 castWhenTargetHpAtMost 门控；缺省视为满血。 */
  targetHpRatio?: number;
  /** 玩家展示生命上限，治疗拍用它换算回复量。 */
  playerMaxHp?: number;
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

/** 释放门槛未满足时的重试间隔（秒）：技能保持就绪，不烧冷却。 */
const GATE_RETRY_SEC = 1;

function skillGateOpen(skill: RhythmSkillSpec, params: RhythmParams): boolean {
  if (skill.castWhenSelfHpAtMost !== undefined) {
    if ((params.selfHpRatio ?? 1) > skill.castWhenSelfHpAtMost) return false;
  }
  if (skill.castWhenTargetHpAtMost !== undefined) {
    if ((params.targetHpRatio ?? 1) > skill.castWhenTargetHpAtMost) return false;
  }
  return true;
}

export function createRhythmState(skills: readonly RhythmSkillSpec[] = []): RhythmState {
  validateSkillSpecs(skills);
  return {
    seq: 0,
    playerCd: 0,
    monsterCd: 0,
    // 技能一开始就错峰，避免所有技能在同一拍同时炸开
    skillCds: Object.fromEntries(skills.map((skill, index) => [skill.skillId, index * 0.7])),
  };
}

/**
 * 升级解锁技能或切换职业时同步运行时冷却。
 *
 * 已存在技能按稳定 ID 保留进度；新增技能错峰入场；离开列表的技能立即移除，
 * 不用数组位置猜测身份。
 */
export function syncRhythmSkills(
  state: RhythmState,
  skills: readonly RhythmSkillSpec[],
): RhythmState {
  validateSkillSpecs(skills);
  const currentIds = Object.keys(state.skillCds);
  const nextIds = skills.map((skill) => skill.skillId);
  if (
    currentIds.length === nextIds.length &&
    nextIds.every((skillId) => Object.hasOwn(state.skillCds, skillId))
  ) {
    return state;
  }
  return {
    ...state,
    skillCds: Object.fromEntries(
      skills.map((skill, index) => [skill.skillId, state.skillCds[skill.skillId] ?? index * 0.7]),
    ),
  };
}

/** 把生产器的真实运行时冷却投影成 UI 可直接读取的不可变快照。 */
export function createBattleRhythmSnapshot(
  state: Readonly<RhythmState>,
  params: Readonly<RhythmSnapshotParams>,
): BattleRhythmSnapshot {
  validateSkillSpecs(params.skills);
  if (!params.contextId.trim()) {
    throw new Error('[战斗节奏] 快照上下文 ID 不能为空');
  }
  if (!Number.isSafeInteger(params.epoch) || params.epoch < 0) {
    throw new Error(`[战斗节奏] 纪元必须是非负安全整数：${params.epoch}`);
  }
  if (!Number.isFinite(params.playerCooldownSec) || params.playerCooldownSec < MIN_INTERVAL) {
    throw new Error(`[战斗节奏] 普攻冷却必须是 >= ${MIN_INTERVAL} 秒的有限数`);
  }

  const action = (
    remainingSec: number,
    cooldownSec: number,
    lastCastSeq: number | null,
  ): RhythmActionSnapshot => {
    if (
      lastCastSeq !== null &&
      (!Number.isSafeInteger(lastCastSeq) || lastCastSeq < 1 || lastCastSeq > state.seq)
    ) {
      throw new Error(`[战斗节奏] 最近施放序号非法：${String(lastCastSeq)}`);
    }
    const remaining = Math.min(cooldownSec, Math.max(0, remainingSec));
    return {
      cooldownSec,
      remainingSec: remaining,
      ratio: cooldownSec > 0 ? remaining / cooldownSec : 0,
      lastCastSeq,
    };
  };

  return {
    source: 'visual-projection',
    contextId: params.contextId,
    epoch: params.epoch,
    seq: state.seq,
    running: params.running,
    basic: action(state.playerCd, params.playerCooldownSec, params.lastBasicCastSeq),
    skills: params.skills.map((skill) => {
      const remaining = state.skillCds[skill.skillId];
      if (!Number.isFinite(remaining)) {
        throw new Error(`[战斗节奏] 快照缺少技能冷却：${skill.skillId}`);
      }
      return {
        skillId: skill.skillId,
        ...action(remaining, skill.cooldownSec, params.lastCastBySkillId[skill.skillId] ?? null),
      };
    }),
  };
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
  const skillCds: Record<string, number> = Object.fromEntries(
    params.skills.map((skill) => [skill.skillId, state.skillCds[skill.skillId]! - dt]),
  );

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
      skillId: null,
    });
    playerCd += playerInterval;
  }

  // ── 技能 ──
  const orderedSkills = [...params.skills].sort(
    (a, b) => b.priority - a.priority || a.skillId.localeCompare(b.skillId),
  );
  for (const skill of orderedSkills) {
    const cooldown = skill.cooldownSec;
    let g = 0;
    while (skillCds[skill.skillId]! <= 0 && g++ < 50) {
      if (!skillGateOpen(skill, params)) {
        // 条件未满足：保持就绪、稍后重试，不空耗冷却 —— 与真实结算的
        // 「主动条件不满足时必须跳过」同语义（core/skills.ts canCastSkill）。
        skillCds[skill.skillId] = GATE_RETRY_SEC;
        break;
      }
      const effect = skill.effect ?? 'damage';
      if (effect === 'heal') {
        const maxHp = params.playerMaxHp ?? 0;
        const base = maxHp > 0 ? maxHp * (skill.healMaxHpRatio ?? 0.1) : params.playerHit * 2.4;
        push({
          kind: 'player-skill',
          crit: false,
          damage: Math.max(1, Math.round(base)),
          skillId: skill.skillId,
          effect,
        });
      } else if (effect === 'summon') {
        push({ kind: 'player-skill', crit: false, damage: 0, skillId: skill.skillId, effect });
      } else {
        const crit = rng.chance(params.critRate);
        push({
          kind: 'player-skill',
          crit,
          // 技能伤害比普攻高，视觉上要能区分出来
          damage: rollDamage(params.playerHit * 2.4, crit, rng),
          skillId: skill.skillId,
          effect,
        });
      }
      skillCds[skill.skillId] = skillCds[skill.skillId]! + cooldown;
    }
  }

  // ── 怪物反击 ──
  guard = 0;
  while (monsterCd <= 0 && guard++ < 200) {
    push({
      kind: 'monster-attack',
      crit: false,
      damage: rollDamage(params.monsterHit, false, rng),
      skillId: null,
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
  validateSkillSpecs(params.skills);
  const stateSkillIds = Object.keys(state.skillCds);
  if (
    params.skills.length !== stateSkillIds.length ||
    params.skills.some((skill) => !Object.hasOwn(state.skillCds, skill.skillId))
  ) {
    throw new Error(
      `[战斗节奏] 技能配置与状态 ID 不一致：${params.skills
        .map((skill) => skill.skillId)
        .join(',')} / ${stateSkillIds.join(',')}`,
    );
  }
  if (Object.values(state.skillCds).some((cooldown) => !Number.isFinite(cooldown))) {
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

function validateSkillSpecs(skills: readonly RhythmSkillSpec[]): void {
  const seen = new Set<string>();
  for (const skill of skills) {
    if (!skill.skillId.trim()) {
      throw new Error('[战斗节奏] 技能 ID 不能为空');
    }
    if (seen.has(skill.skillId)) {
      throw new Error(`[战斗节奏] 技能 ID 重复：${skill.skillId}`);
    }
    seen.add(skill.skillId);
    if (!Number.isFinite(skill.cooldownSec) || skill.cooldownSec < MIN_INTERVAL) {
      throw new Error(`[战斗节奏] 技能冷却必须是 >= ${MIN_INTERVAL} 秒的有限数`);
    }
    if (!Number.isFinite(skill.priority)) {
      throw new Error(`[战斗节奏] 技能演出优先级必须是有限数：${skill.skillId}`);
    }
    for (const [label, ratio] of [
      ['释放门槛(自身血量)', skill.castWhenSelfHpAtMost],
      ['释放门槛(目标血量)', skill.castWhenTargetHpAtMost],
      ['治疗回复比例', skill.healMaxHpRatio],
    ] as const) {
      if (ratio !== undefined && (!Number.isFinite(ratio) || ratio <= 0 || ratio > 1)) {
        throw new Error(`[战斗节奏] ${label}必须在 (0,1] 区间：${skill.skillId}`);
      }
    }
  }
}
