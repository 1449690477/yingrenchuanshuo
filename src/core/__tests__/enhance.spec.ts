import { describe, expect, it } from 'vitest';
import { attemptEnhance, enhanceRule, luckGainForRate } from '../enhance';
import { Rng } from '../rng';

/**
 * 固定本次随机判定的测试 RNG。
 *
 * Rng.chance() 最终读取 next()，因此覆写这一处既不改变生产接口，
 * 又能精确覆盖成功与失败分支。真实可复现性另用原版 seeded Rng 验证。
 */
class FixedRng extends Rng {
  calls = 0;

  constructor(private readonly roll: number) {
    super(1);
  }

  override next(): number {
    this.calls += 1;
    return this.roll;
  }
}

const alwaysSucceeds = () => new FixedRng(0);
const alwaysFails = () => new FixedRng(0.999_999);

describe('强化规则', () => {
  it.each([
    [1, 1, 'none'],
    [2, 1, 'none'],
    [3, 1, 'none'],
    [4, 1, 'none'],
    [5, 1, 'none'],
    [6, 0.85, 'none'],
    [7, 0.75, 'none'],
    [8, 0.65, 'none'],
    [9, 0.55, 'none'],
    [10, 0.45, 'downgrade'],
    [11, 0.38, 'downgrade'],
    [12, 0.3, 'downgrade'],
    [13, 0.22, 'break'],
    [14, 0.15, 'break'],
    [15, 0.08, 'break'],
  ] as const)('目标 +%i 的成功率与失败惩罚来自唯一规则表', (targetLevel, rate, failure) => {
    expect(enhanceRule(targetLevel)).toEqual({ targetLevel, rate, failure });
  });

  it.each([0, 16, -1, 1.5, Number.NaN, Number.POSITIVE_INFINITY])(
    '非法目标等级 %s 直接报错',
    (targetLevel) => {
      expect(() => enhanceRule(targetLevel)).toThrow();
    },
  );
});

describe('幸运值', () => {
  it.each([
    [1, 1],
    [0.85, 2],
    [0.75, 2],
    [0.65, 2],
    [0.55, 2],
    [0.45, 3],
    [0.38, 3],
    [0.3, 4],
    [0.22, 5],
    [0.15, 7],
    [0.08, 13],
  ])('成功率 %d 的失败幸运增量为 %i', (rate, gain) => {
    expect(luckGainForRate(rate)).toBe(gain);
  });

  it.each([0, -0.1, 1.01, Number.NaN, Number.POSITIVE_INFINITY])(
    '非法成功率 %s 直接报错',
    (rate) => {
      expect(() => luckGainForRate(rate)).toThrow();
    },
  );
});

describe('强化尝试', () => {
  it.each([1, 2, 3, 4, 5])('目标 +%i 即使随机值极高也必定成功', (targetLevel) => {
    expect(
      attemptEnhance({ level: targetLevel - 1, luck: 0, useProtection: false }, alwaysFails()),
    ).toEqual({
      outcome: 'success',
      previousLevel: targetLevel - 1,
      targetLevel,
      nextLevel: targetLevel,
      previousLuck: 0,
      nextLuck: 0,
      rate: 1,
      guaranteed: false,
      protectionConsumed: false,
    });
  });

  it.each([
    [6, 0.85, 2],
    [7, 0.75, 2],
    [8, 0.65, 2],
    [9, 0.55, 2],
  ])('目标 +%i 随机失败时保留当前等级并增加幸运值', (targetLevel, rate, luckGain) => {
    const previousLevel = targetLevel - 1;
    expect(
      attemptEnhance({ level: previousLevel, luck: 0, useProtection: false }, alwaysFails()),
    ).toEqual({
      outcome: 'failed',
      previousLevel,
      targetLevel,
      nextLevel: previousLevel,
      previousLuck: 0,
      nextLuck: luckGain,
      rate,
      guaranteed: false,
      protectionConsumed: false,
    });
  });

  it('随机值刚好等于成功率时判定为失败', () => {
    expect(
      attemptEnhance({ level: 5, luck: 0, useProtection: false }, new FixedRng(0.85)).outcome,
    ).toBe('failed');
  });

  it.each([
    [10, 0.45, 3],
    [11, 0.38, 3],
    [12, 0.3, 4],
  ])('目标 +%i 随机失败时从当前等级掉一级', (targetLevel, rate, luckGain) => {
    const previousLevel = targetLevel - 1;
    expect(
      attemptEnhance({ level: previousLevel, luck: 0, useProtection: false }, alwaysFails()),
    ).toEqual({
      outcome: 'downgraded',
      previousLevel,
      targetLevel,
      nextLevel: previousLevel - 1,
      previousLuck: 0,
      nextLuck: luckGain,
      rate,
      guaranteed: false,
      protectionConsumed: false,
    });
  });

  it.each([
    [13, 0.22],
    [14, 0.15],
    [15, 0.08],
  ])('目标 +%i 未使用保护符且随机失败时装备碎裂', (targetLevel, rate) => {
    const previousLevel = targetLevel - 1;
    expect(
      attemptEnhance({ level: previousLevel, luck: 0, useProtection: false }, alwaysFails()),
    ).toEqual({
      outcome: 'broken',
      previousLevel,
      targetLevel,
      nextLevel: null,
      previousLuck: 0,
      nextLuck: null,
      rate,
      guaranteed: false,
      protectionConsumed: false,
    });
  });

  it('掉级后仍返回本次目标等级桶的幸运增量，供调用方按目标等级保存', () => {
    expect(attemptEnhance({ level: 9, luck: 7, useProtection: false }, alwaysFails())).toEqual({
      outcome: 'downgraded',
      previousLevel: 9,
      targetLevel: 10,
      nextLevel: 8,
      previousLuck: 7,
      nextLuck: 10,
      rate: 0.45,
      guaranteed: false,
      protectionConsumed: false,
    });
  });

  it('保护符只在真正防住碎裂时消耗', () => {
    expect(attemptEnhance({ level: 12, luck: 0, useProtection: true }, alwaysFails())).toEqual({
      outcome: 'protected',
      previousLevel: 12,
      targetLevel: 13,
      nextLevel: 12,
      previousLuck: 0,
      nextLuck: 5,
      rate: 0.22,
      guaranteed: false,
      protectionConsumed: true,
    });

    expect(attemptEnhance({ level: 12, luck: 40, useProtection: true }, alwaysSucceeds())).toEqual({
      outcome: 'success',
      previousLevel: 12,
      targetLevel: 13,
      nextLevel: 13,
      previousLuck: 40,
      nextLuck: 0,
      rate: 0.22,
      guaranteed: false,
      protectionConsumed: false,
    });
  });

  it('相同输入与相同种子的结果完全一致', () => {
    const input = { level: 8, luck: 17, useProtection: false };
    expect(attemptEnhance(input, new Rng(31_337))).toEqual(attemptEnhance(input, new Rng(31_337)));
  });

  it('+15 连续失败 8 次后，第 9 次由满幸运值保底成功且不消耗保护符', () => {
    const rng = alwaysFails();
    let luck = 0;

    for (let attempt = 1; attempt <= 8; attempt += 1) {
      const result = attemptEnhance({ level: 14, luck, useProtection: true }, rng);
      expect(result.outcome).toBe('protected');
      expect(result.nextLevel).toBe(14);
      expect(result.protectionConsumed).toBe(true);
      expect(result.guaranteed).toBe(false);
      if (result.nextLuck === null) {
        throw new Error('保护符防碎后必须保留幸运值');
      }
      luck = result.nextLuck;
    }

    expect(luck).toBe(100);
    expect(attemptEnhance({ level: 14, luck, useProtection: true }, rng)).toEqual({
      outcome: 'success',
      previousLevel: 14,
      targetLevel: 15,
      nextLevel: 15,
      previousLuck: 100,
      nextLuck: 0,
      rate: 0.08,
      guaranteed: true,
      protectionConsumed: false,
    });
  });

  it.each([
    [{ level: 0, luck: 0, useProtection: false }, 0],
    [{ level: 5, luck: 0, useProtection: false }, 0],
    [{ level: 8, luck: 0, useProtection: false }, 0.999_999],
    [{ level: 9, luck: 0, useProtection: false }, 0.999_999],
    [{ level: 12, luck: 0, useProtection: false }, 0.999_999],
    [{ level: 12, luck: 0, useProtection: true }, 0.999_999],
    [{ level: 14, luck: 100, useProtection: true }, 0.999_999],
  ] as const)('每次合法强化尝试固定消耗一次随机数 %#', (input, roll) => {
    const rng = new FixedRng(roll);
    attemptEnhance(input, rng);
    expect(rng.calls).toBe(1);
  });

  it('满级、非法幸运值与低段误用保护符严格报错', () => {
    for (const level of [-1, 1.5, 15, Number.NaN, Number.POSITIVE_INFINITY]) {
      const rng = alwaysSucceeds();
      expect(() => attemptEnhance({ level, luck: 0, useProtection: false }, rng)).toThrow();
      expect(rng.calls).toBe(0);
    }

    for (const luck of [-1, 100.1, 101, Number.NaN, Number.POSITIVE_INFINITY]) {
      const rng = alwaysSucceeds();
      expect(() => attemptEnhance({ level: 8, luck, useProtection: false }, rng)).toThrow();
      expect(rng.calls).toBe(0);
    }

    const rng = alwaysSucceeds();
    expect(() => attemptEnhance({ level: 11, luck: 0, useProtection: true }, rng)).toThrow();
    expect(rng.calls).toBe(0);
  });
});
