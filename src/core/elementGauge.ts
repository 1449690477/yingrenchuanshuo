/**
 * 元素印记（Element Gauge）—— docs/83 批 2 纯函数层。
 *
 * 目标：把属性克制从「开战前换一次装」的静态乘区，升级为战斗中可积累、
 * 可触发、可感知的互动层（老板红线：不改 1.25/0.85/1.00 基数、不改主伤害
 * 公式、不加存档字段、不加新元素）。
 *
 * 本文件只做三件事：定义状态、推演规则、产出「共鸣效果」描述。
 * **不接入任何战斗循环**（批 3 接线）——纯函数、零 UI、零副作用。
 * 时间单位由调用方统一（毫秒或 tick 均可，本文件只做差值比较）。
 *
 * 规则速览（docs/83 §5.1）：
 *   G1 命中积层：同元素 +1（上限 3）；异元素切换并重置 1；none 不产生印记
 *   G2 克制额外：克制命中的同元素命中额外 +1 层
 *   G3 自然衰减：5 秒未续则归零（只影响印记，不影响既有伤害）
 *   G4 反应触发：满 3 层时下一次同元素命中触发「元素共鸣」，清空印记
 *   G5 内置冷却：每目标每元素共鸣 ICD = 2.5 秒（防高频白嫖）
 */

import type { Element } from './types';

/** 可共鸣元素（排除 'none'） */
export type ReactiveElement = 'fire' | 'ice' | 'thunder';

/** 印记状态（每目标一份，战斗期运行时，不落存档） */
export interface ElementGauge {
  /** 当前印记元素；'none' 表示无印记 */
  element: Element;
  /** 层数 0~3；无印记时为 0 */
  stacks: number;
  /** 最近一次命中/重置的战斗时钟刻度 */
  lastHitAt: number;
}

/** 每元素共鸣内置冷却（下次可触发时刻）；'none' 无冷却 */
export type ReactionIcds = Readonly<Record<ReactiveElement, number>>;

/** 共鸣效果描述（批 3 接线时翻译成实际伤害段 + 状态挂载） */
export type ResonanceEffect = {
  element: ReactiveElement;
  /** 追加伤害段走既有追加元素伤害段（formula.ts），不暴击，受克制与同系词条约束 */
  damageKind: 'elemental-append';
  /** 挂载的既有状态（docs/83 P3 能量形态分化） */
  applyStatus: 'burn' | 'freeze' | 'slow';
};

// ── 可调旋钮（docs/83 批 2 评审结论 Q1/Q2）──────────────────────────────

/** 印记上限（Q2：3 层） */
export const GAUGE_MAX_STACKS = 3;
/** 印记自然衰减窗口（G3：5 秒） */
export const GAUGE_DECAY_MS = 5_000;
/** 共鸣内置冷却（Q2：2.5 秒；主旋钮，批 3 用 sim 校准） */
export const REACTION_ICD_MS = 2_500;
/** 共鸣追加伤害相对主链单次伤害的上限（Q1：≤15%，批 3 接线后实测校准） */
export const REACTION_DAMAGE_RATIO_MAX = 0.15;

/**
 * 稳态共鸣对挂机 DPS 的期望占比（docs/83 批 3 接线用，挂机本地模式）。
 *
 * 推导：共鸣频率 = 1 / max(攒满层所需秒数, ICD)；每次共鸣 = 主链单次伤害
 * 的 ≤REACTION_DAMAGE_RATIO_MAX（Q1 档位）；主 DPS = 命中率 × 单次伤害。
 * 于是占比 = 0.15 / (周期 × 命中率)。
 *   - 中性（3 击攒满）：hitRate=1 → 0.15/3 = 5%
 *   - 克制（2 击攒满）：hitRate=1 → 0.15/2.5 = 6%（ICD 兜底）
 *   - 高攻速被 ICD 卡频：占比自然回落（喵喵 hitRate=1.25 → ≈4.8%）
 * 批 3 接线后以 sim 读数校准（Q1 验收：共鸣贡献 ≤5% 目标、TTK 门禁不破）。
 */
export function expectedReactionDpsShare(
  hitRatePerSecond: number,
  isCounter: boolean,
): number {
  if (!Number.isFinite(hitRatePerSecond) || hitRatePerSecond <= 0) return 0;
  const hitsToTrigger = isCounter ? 2 : 3;
  const icdSeconds = REACTION_ICD_MS / 1000;
  const period = Math.max(hitsToTrigger / hitRatePerSecond, icdSeconds);
  return REACTION_DAMAGE_RATIO_MAX / (period * hitRatePerSecond);
}

/** 三元素共鸣形态（docs/83 §5.1：炎=灼烧、冰=冻结、雷=麻痹） */
export const RESONANCE_EFFECTS: Readonly<Record<ReactiveElement, ResonanceEffect>> = {
  fire: { element: 'fire', damageKind: 'elemental-append', applyStatus: 'burn' },
  ice: { element: 'ice', damageKind: 'elemental-append', applyStatus: 'freeze' },
  thunder: { element: 'thunder', damageKind: 'elemental-append', applyStatus: 'slow' },
};

/** 空印记 */
export function emptyGauge(): ElementGauge {
  return { element: 'none', stacks: 0, lastHitAt: 0 };
}

/** 空冷却表（全部立即可触发） */
export function emptyReactionIcds(): ReactionIcds {
  return { fire: 0, ice: 0, thunder: 0 };
}

/** 印记是否非空 */
export function hasGauge(gauge: ElementGauge): boolean {
  return gauge.element !== 'none' && gauge.stacks > 0;
}

/**
 * G1 + G2：一次命中后的印记推演（纯函数，不修改入参）。
 * - none 攻击不产生印记；
 * - 异元素命中 → 切换元素并重置为 1；
 *   （克制加成同样作用于建立元素的首击：克制玩家 2 击即满层，中性玩家 3 击）
 * - 同元素命中 → +1 层（上限 GAUGE_MAX_STACKS）；
 * - 克制命中（isCounterHit）→ 同元素额外 +1 层（鼓励「对了属性再输出」）。
 */
export function applyHitToGauge(
  gauge: ElementGauge,
  hitElement: Element,
  isCounterHit: boolean,
  now: number,
): ElementGauge {
  if (hitElement === 'none') return gauge;
  if (gauge.element !== hitElement) {
    return { element: hitElement, stacks: isCounterHit ? 2 : 1, lastHitAt: now };
  }
  const gain = isCounterHit ? 2 : 1;
  return {
    element: hitElement,
    stacks: Math.min(GAUGE_MAX_STACKS, gauge.stacks + gain),
    lastHitAt: now,
  };
}

/**
 * G3：自然衰减。距上次命中超过 GAUGE_DECAY_MS 则归零；
 * 衰减只影响印记层数，不影响既有伤害。
 */
export function tickGauge(gauge: ElementGauge, now: number): ElementGauge {
  if (gauge.element === 'none') return gauge;
  if (now - gauge.lastHitAt >= GAUGE_DECAY_MS) return emptyGauge();
  return gauge;
}

/**
 * G4 + G5：满层 + 同元素命中 + ICD 就绪 → 触发共鸣。
 * 触发后清空印记并写入该元素的新冷却时刻。
 * 不满足任一条件则原样返回（不触发、不改状态）。
 */
export function resolveReaction(
  gauge: ElementGauge,
  hitElement: Element,
  icds: ReactionIcds,
  now: number,
): {
  triggered: boolean;
  effect: ResonanceEffect | null;
  nextGauge: ElementGauge;
  nextIcds: ReactionIcds;
} {
  if (hitElement === 'none') {
    return { triggered: false, effect: null, nextGauge: gauge, nextIcds: icds };
  }
  if (gauge.element !== hitElement || gauge.stacks < GAUGE_MAX_STACKS) {
    return { triggered: false, effect: null, nextGauge: gauge, nextIcds: icds };
  }
  const reactive = hitElement as ReactiveElement;
  if (now < icds[reactive]) {
    return { triggered: false, effect: null, nextGauge: gauge, nextIcds: icds };
  }
  return {
    triggered: true,
    effect: RESONANCE_EFFECTS[reactive],
    nextGauge: emptyGauge(),
    nextIcds: { ...icds, [reactive]: now + REACTION_ICD_MS },
  };
}

/**
 * 便捷组合：一次完整命中的推演（G1→G4 顺序执行）。
 * 供批 3 接线使用；批 2 单测直接覆盖各分步函数。
 */
export function applyHit(
  gauge: ElementGauge,
  icds: ReactionIcds,
  hitElement: Element,
  isCounterHit: boolean,
  now: number,
): { gauge: ElementGauge; icds: ReactionIcds; reaction: ResonanceEffect | null } {
  const next = applyHitToGauge(gauge, hitElement, isCounterHit, now);
  const result = resolveReaction(next, hitElement, icds, now);
  return { gauge: result.nextGauge, icds: result.nextIcds, reaction: result.effect };
}
