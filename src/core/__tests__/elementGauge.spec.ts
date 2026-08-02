/**
 * 元素印记纯函数测试（docs/83 批 2）。
 *
 * 覆盖 G1~G5、三元素共鸣形态、ICD、衰减、组合推演；
 * 并做反向证伪：去掉触发门 / ICD 会让对应测试红（docs/83 §5.3 验收）。
 */

import { describe, expect, it } from 'vitest';
import {
  applyHit,
  applyHitToGauge,
  emptyGauge,
  emptyReactionIcds,
  GAUGE_DECAY_MS,
  GAUGE_MAX_STACKS,
  hasGauge,
  RESONANCE_EFFECTS,
  REACTION_ICD_MS,
  resolveReaction,
  tickGauge,
  type ElementGauge,
} from '../elementGauge';

const T0 = 1_000_000;

describe('G1 命中积层', () => {
  it('空印记初始为 none / 0 层', () => {
    const g = emptyGauge();
    expect(g.element).toBe('none');
    expect(g.stacks).toBe(0);
    expect(hasGauge(g)).toBe(false);
  });

  it('none 攻击不产生印记', () => {
    const g = emptyGauge();
    expect(applyHitToGauge(g, 'none', false, T0)).toBe(g);
  });

  it('同元素命中逐层累加，上限封顶', () => {
    let g = emptyGauge();
    g = applyHitToGauge(g, 'fire', false, T0);
    g = applyHitToGauge(g, 'fire', false, T0 + 1);
    g = applyHitToGauge(g, 'fire', false, T0 + 2);
    g = applyHitToGauge(g, 'fire', false, T0 + 3);
    expect(g.element).toBe('fire');
    expect(g.stacks).toBe(GAUGE_MAX_STACKS);
  });

  it('异元素命中切换元素并重置为 1', () => {
    let g = applyHitToGauge(emptyGauge(), 'fire', false, T0);
    g = applyHitToGauge(g, 'fire', false, T0 + 1);
    g = applyHitToGauge(g, 'ice', false, T0 + 2);
    expect(g.element).toBe('ice');
    expect(g.stacks).toBe(1);
  });
});

describe('G2 克制额外积层', () => {
  it('克制命中每次 +2（基础 1 + 克制 1）', () => {
    let g = emptyGauge();
    g = applyHitToGauge(g, 'fire', true, T0);
    expect(g.stacks).toBe(2);
    g = applyHitToGauge(g, 'fire', true, T0 + 1);
    expect(g.stacks).toBe(GAUGE_MAX_STACKS);
  });

  it('被克（非克制）不享受额外层', () => {
    let g = emptyGauge();
    g = applyHitToGauge(g, 'fire', false, T0);
    g = applyHitToGauge(g, 'fire', false, T0 + 1);
    expect(g.stacks).toBe(2);
  });
});

describe('G3 自然衰减', () => {
  it('超过窗口归零，窗口内保持不变', () => {
    let g = applyHitToGauge(emptyGauge(), 'fire', false, T0);
    g = applyHitToGauge(g, 'fire', false, T0 + 1);
    expect(tickGauge(g, T0 + 1_000)).toBe(g);
    expect(tickGauge(g, T0 + GAUGE_DECAY_MS + 1)).toEqual(emptyGauge());
  });

  it('命中续期：窗口内再次命中后从新时刻重新计时', () => {
    let g = applyHitToGauge(emptyGauge(), 'fire', false, T0);
    g = applyHitToGauge(g, 'fire', false, T0 + GAUGE_DECAY_MS - 1);
    // 续期后窗口重新计时：再过 2ms 不衰减，再过满一个窗口才衰减
    expect(tickGauge(g, T0 + GAUGE_DECAY_MS + 1)).toBe(g);
    expect(tickGauge(g, T0 + GAUGE_DECAY_MS - 1 + GAUGE_DECAY_MS + 1)).toEqual(emptyGauge());
  });
});

describe('G4 + G5 共鸣触发与内置冷却', () => {
  it('满 3 层 + 同元素命中 + ICD 就绪 → 触发共鸣并清空印记', () => {
    let g = applyHitToGauge(emptyGauge(), 'fire', false, T0);
    g = applyHitToGauge(g, 'fire', false, T0 + 1);
    g = applyHitToGauge(g, 'fire', false, T0 + 2);
    expect(g.stacks).toBe(3);
    const result = resolveReaction(g, 'fire', emptyReactionIcds(), T0 + 3);
    expect(result.triggered).toBe(true);
    expect(result.effect).toEqual(RESONANCE_EFFECTS.fire);
    expect(result.nextGauge).toEqual(emptyGauge());
    expect(result.nextIcds.fire).toBe(T0 + 3 + REACTION_ICD_MS);
  });

  it('未满 3 层不触发（反向证伪：去掉 G4 触发门 → 本测试红）', () => {
    let g = applyHitToGauge(emptyGauge(), 'ice', false, T0);
    g = applyHitToGauge(g, 'ice', false, T0 + 1);
    expect(resolveReaction(g, 'ice', emptyReactionIcds(), T0 + 2).triggered).toBe(false);
  });

  it('ICD 内不触发，ICD 结束后恢复（反向证伪：去掉 ICD → 本测试红）', () => {
    let g = applyHitToGauge(emptyGauge(), 'thunder', false, T0);
    g = applyHitToGauge(g, 'thunder', false, T0 + 1);
    g = applyHitToGauge(g, 'thunder', false, T0 + 2);
    const first = resolveReaction(g, 'thunder', emptyReactionIcds(), T0 + 3);
    expect(first.triggered).toBe(true);
    const icds = first.nextIcds;
    // ICD 窗口内：重新叠满也不触发
    let g2 = applyHitToGauge(emptyGauge(), 'thunder', false, T0 + 4);
    g2 = applyHitToGauge(g2, 'thunder', false, T0 + 5);
    g2 = applyHitToGauge(g2, 'thunder', false, T0 + 6);
    expect(resolveReaction(g2, 'thunder', icds, T0 + 6).triggered).toBe(false);
    // ICD 结束后恢复
    const after = resolveReaction(g2, 'thunder', icds, icds.thunder + 1);
    expect(after.triggered).toBe(true);
  });

  it('异元素命中不触发（共鸣只认当前印记元素）', () => {
    let g = applyHitToGauge(emptyGauge(), 'fire', false, T0);
    g = applyHitToGauge(g, 'fire', false, T0 + 1);
    g = applyHitToGauge(g, 'fire', false, T0 + 2);
    expect(resolveReaction(g, 'ice', emptyReactionIcds(), T0 + 3).triggered).toBe(false);
  });
});

describe('共鸣形态（docs/83 P3 能量形态分化）', () => {
  it('炎→灼烧、冰→冻结、雷→麻痹，且都走追加元素伤害段', () => {
    expect(RESONANCE_EFFECTS.fire).toEqual({
      element: 'fire',
      damageKind: 'elemental-append',
      applyStatus: 'burn',
    });
    expect(RESONANCE_EFFECTS.ice).toEqual({
      element: 'ice',
      damageKind: 'elemental-append',
      applyStatus: 'freeze',
    });
    expect(RESONANCE_EFFECTS.thunder).toEqual({
      element: 'thunder',
      damageKind: 'elemental-append',
      applyStatus: 'slow',
    });
  });
});

describe('组合推演 applyHit（G1→G4 顺序）', () => {
  it('克制连击两次即共鸣（首击 2 层、次击满层触发），清空并进入 ICD', () => {
    const gauge = emptyGauge();
    const icds = emptyReactionIcds();
    const first = applyHit(gauge, icds, 'fire', true, T0);
    expect(first.gauge.stacks).toBe(2);
    const second = applyHit(first.gauge, first.icds, 'fire', true, T0 + 1);
    expect(second.reaction).toEqual(RESONANCE_EFFECTS.fire);
    expect(second.gauge).toEqual(emptyGauge());
    expect(second.icds.fire).toBe(T0 + 1 + REACTION_ICD_MS);
  });

  it('中性连击三击触发（首击 1 层、二击 2 层、三击满层触发）', () => {
    let gauge = emptyGauge();
    const icds = emptyReactionIcds();
    gauge = applyHit(gauge, icds, 'ice', false, T0).gauge;
    gauge = applyHit(gauge, icds, 'ice', false, T0 + 1).gauge;
    const third = applyHit(gauge, icds, 'ice', false, T0 + 2);
    expect(third.reaction).toEqual(RESONANCE_EFFECTS.ice);
  });

  it('不修改入参（纯函数）', () => {
    const gauge: ElementGauge = { element: 'fire', stacks: 3, lastHitAt: T0 };
    const icds = emptyReactionIcds();
    const snapshot = JSON.stringify({ gauge, icds });
    applyHit(gauge, icds, 'fire', false, T0 + 1);
    expect(JSON.stringify({ gauge, icds })).toBe(snapshot);
  });
});
