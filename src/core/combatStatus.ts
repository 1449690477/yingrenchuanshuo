import type { Element } from './types';

export type PeriodicStatusRefresh = 'duration' | 'replace' | 'add-duration';
export type CombatSide = 'player' | 'monster';

export interface PeriodicDamageApplication {
  statusId: string;
  triggerId: string;
  source: CombatSide;
  element: Element;
  damagePerTick: number;
  stacks: number;
  maxStacks: number;
  durationMs: number;
  tickIntervalMs: number;
  refresh: PeriodicStatusRefresh;
}

export interface ActivePeriodicDamage extends PeriodicDamageApplication {
  nextTickAtMs: number;
  expiresAtMs: number;
}

export interface PeriodicDamageState {
  effects: readonly ActivePeriodicDamage[];
}

export interface PeriodicDamageTick {
  statusId: string;
  triggerId: string;
  source: CombatSide;
  element: Element;
  damage: number;
  stacks: number;
  elapsedMs: number;
}

export interface PeriodicDamageAdvance {
  state: PeriodicDamageState;
  ticks: readonly PeriodicDamageTick[];
}

export function createPeriodicDamageState(): PeriodicDamageState {
  return { effects: [] };
}

/**
 * 施加或刷新一个持续伤害状态。
 *
 * 同 ID 状态只保留一条权威时钟；叠层改变单次 tick 伤害，刷新持续时间时保留
 * 已经运行中的 tick 节奏，避免高频暴击把“下一秒流血”无限向后推迟。
 */
export function applyPeriodicDamage(
  state: PeriodicDamageState,
  application: PeriodicDamageApplication,
  elapsedMs: number,
): PeriodicDamageState {
  assertElapsedMs(elapsedMs);
  assertPeriodicApplication(application);
  const active = state.effects.filter((effect) => effect.expiresAtMs >= elapsedMs);
  const index = active.findIndex((effect) => effect.statusId === application.statusId);
  if (index < 0) {
    return {
      effects: [
        ...active,
        {
          ...application,
          stacks: Math.min(application.stacks, application.maxStacks),
          nextTickAtMs: elapsedMs + application.tickIntervalMs,
          expiresAtMs: elapsedMs + application.durationMs,
        },
      ],
    };
  }

  const previous = active[index]!;
  assertCompatiblePeriodicApplication(previous, application);
  let next: ActivePeriodicDamage;
  if (application.refresh === 'replace') {
    next = {
      ...application,
      stacks: Math.min(application.stacks, application.maxStacks),
      nextTickAtMs: elapsedMs + application.tickIntervalMs,
      expiresAtMs: elapsedMs + application.durationMs,
    };
  } else {
    next = {
      ...previous,
      triggerId: application.triggerId,
      source: application.source,
      damagePerTick: application.damagePerTick,
      stacks: Math.min(previous.stacks + application.stacks, application.maxStacks),
      expiresAtMs:
        application.refresh === 'add-duration'
          ? previous.expiresAtMs + application.durationMs
          : elapsedMs + application.durationMs,
    };
  }

  return {
    effects: active.map((effect, effectIndex) => (effectIndex === index ? next : effect)),
  };
}

/**
 * 推进到指定战斗时点并产出所有到期 tick。
 *
 * 事件先按毫秒、再按状态登记顺序排序；不读取系统时间，也不做任何伤害副作用。
 */
export function advancePeriodicDamage(
  state: PeriodicDamageState,
  elapsedMs: number,
): PeriodicDamageAdvance {
  assertElapsedMs(elapsedMs);
  const ticks: Array<PeriodicDamageTick & { effectIndex: number }> = [];
  const effects: ActivePeriodicDamage[] = [];

  for (const [effectIndex, effect] of state.effects.entries()) {
    assertActivePeriodicDamage(effect);
    let nextTickAtMs = effect.nextTickAtMs;
    while (nextTickAtMs <= elapsedMs && nextTickAtMs <= effect.expiresAtMs) {
      ticks.push({
        statusId: effect.statusId,
        triggerId: effect.triggerId,
        source: effect.source,
        element: effect.element,
        damage: effect.damagePerTick * effect.stacks,
        stacks: effect.stacks,
        elapsedMs: nextTickAtMs,
        effectIndex,
      });
      nextTickAtMs += effect.tickIntervalMs;
    }
    if (nextTickAtMs <= effect.expiresAtMs || elapsedMs < effect.expiresAtMs) {
      effects.push({ ...effect, nextTickAtMs });
    }
  }

  ticks.sort(
    (left, right) => left.elapsedMs - right.elapsedMs || left.effectIndex - right.effectIndex,
  );
  return {
    state: { effects },
    ticks: ticks.map(({ effectIndex: _effectIndex, ...tick }) => tick),
  };
}

export function periodicStatusStacks(
  state: PeriodicDamageState,
): Readonly<Record<string, number>> {
  return Object.fromEntries(state.effects.map((effect) => [effect.statusId, effect.stacks]));
}

function assertElapsedMs(elapsedMs: number): void {
  if (!Number.isSafeInteger(elapsedMs) || elapsedMs < 0) {
    throw new Error(`持续伤害时点必须是非负安全整数毫秒：${elapsedMs}`);
  }
}

function assertPeriodicApplication(application: PeriodicDamageApplication): void {
  if (!application.statusId.trim() || !application.triggerId.trim()) {
    throw new Error('持续伤害必须提供稳定 statusId 与 triggerId');
  }
  if (!Number.isFinite(application.damagePerTick) || application.damagePerTick < 0) {
    throw new Error(`持续伤害单跳数值必须是非负有限数：${application.statusId}`);
  }
  if (!Number.isSafeInteger(application.stacks) || application.stacks <= 0) {
    throw new Error(`持续伤害施加层数必须是正整数：${application.statusId}`);
  }
  if (!Number.isSafeInteger(application.maxStacks) || application.maxStacks <= 0) {
    throw new Error(`持续伤害层数上限必须是正整数：${application.statusId}`);
  }
  if (application.stacks > application.maxStacks) {
    throw new Error(`持续伤害施加层数不能超过上限：${application.statusId}`);
  }
  if (!Number.isSafeInteger(application.durationMs) || application.durationMs <= 0) {
    throw new Error(`持续伤害持续时间必须是正整数毫秒：${application.statusId}`);
  }
  if (!Number.isSafeInteger(application.tickIntervalMs) || application.tickIntervalMs <= 0) {
    throw new Error(`持续伤害间隔必须是正整数毫秒：${application.statusId}`);
  }
  if (application.durationMs % application.tickIntervalMs !== 0) {
    throw new Error(`持续伤害持续时间必须由完整 tick 组成：${application.statusId}`);
  }
}

function assertActivePeriodicDamage(effect: ActivePeriodicDamage): void {
  assertPeriodicApplication(effect);
  if (!Number.isSafeInteger(effect.nextTickAtMs) || !Number.isSafeInteger(effect.expiresAtMs)) {
    throw new Error(`持续伤害运行时点非法：${effect.statusId}`);
  }
}

function assertCompatiblePeriodicApplication(
  previous: ActivePeriodicDamage,
  application: PeriodicDamageApplication,
): void {
  if (
    previous.source !== application.source ||
    previous.element !== application.element ||
    previous.maxStacks !== application.maxStacks ||
    previous.durationMs !== application.durationMs ||
    previous.tickIntervalMs !== application.tickIntervalMs ||
    previous.refresh !== application.refresh
  ) {
    throw new Error(`同一持续伤害 ID 的规则不一致：${application.statusId}`);
  }
}
