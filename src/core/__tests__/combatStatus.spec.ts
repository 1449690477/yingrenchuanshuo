import { describe, expect, it } from 'vitest';
import {
  advancePeriodicDamage,
  applyPeriodicDamage,
  createPeriodicDamageState,
  periodicStatusStacks,
  type PeriodicDamageApplication,
} from '../combatStatus';

const BLEED: PeriodicDamageApplication = {
  statusId: 'bleed',
  triggerId: 'bloodmoon',
  source: 'player',
  element: 'none',
  damagePerTick: 80,
  stacks: 1,
  maxStacks: 1,
  durationMs: 4_000,
  tickIntervalMs: 1_000,
  refresh: 'duration',
};

describe('持续伤害状态时钟', () => {
  it('四秒流血严格在 1/2/3/4 秒各结算一次，之后原子移除', () => {
    const applied = applyPeriodicDamage(createPeriodicDamageState(), BLEED, 100);
    const before = advancePeriodicDamage(applied, 1_099);
    expect(before.ticks).toHaveLength(0);

    const finished = advancePeriodicDamage(before.state, 4_100);
    expect(finished.ticks.map((tick) => tick.elapsedMs)).toEqual([1_100, 2_100, 3_100, 4_100]);
    expect(finished.ticks.every((tick) => tick.damage === 80)).toBe(true);
    expect(finished.state.effects).toHaveLength(0);
  });

  it('刷新持续时间保留下一跳节奏，高频触发不会无限延迟首跳', () => {
    const first = applyPeriodicDamage(createPeriodicDamageState(), BLEED, 100);
    const refreshed = applyPeriodicDamage(first, { ...BLEED, damagePerTick: 90 }, 900);
    const advanced = advancePeriodicDamage(refreshed, 1_100);

    expect(advanced.ticks).toMatchObject([
      {
        elapsedMs: 1_100,
        damage: 90,
        stacks: 1,
      },
    ]);
    expect(advanced.state.effects[0]?.expiresAtMs).toBe(4_900);
  });

  it('可叠层状态按上限放大每跳伤害，且同 ID 配置冲突直接报错', () => {
    const poison = {
      ...BLEED,
      statusId: 'poison',
      triggerId: 'skill-poison',
      damagePerTick: 60,
      maxStacks: 3,
    };
    let state = createPeriodicDamageState();
    state = applyPeriodicDamage(state, poison, 0);
    state = applyPeriodicDamage(state, poison, 200);
    state = applyPeriodicDamage(state, poison, 400);
    state = applyPeriodicDamage(state, poison, 600);

    expect(periodicStatusStacks(state)).toEqual({ poison: 3 });
    expect(advancePeriodicDamage(state, 1_000).ticks[0]?.damage).toBe(180);
    expect(() =>
      applyPeriodicDamage(state, { ...poison, tickIntervalMs: 500 }, 800),
    ).toThrow('规则不一致');
  });

  it('拒绝半个 tick 的持续时间与非法时间，避免浮点边界兜底', () => {
    expect(() =>
      applyPeriodicDamage(
        createPeriodicDamageState(),
        { ...BLEED, durationMs: 4_500 },
        0,
      ),
    ).toThrow('完整 tick');
    expect(() => advancePeriodicDamage(createPeriodicDamageState(), 0.1)).toThrow(
      '整数毫秒',
    );
  });
});
