import { describe, expect, it } from 'vitest';
import { idleEfficiencyPresentation } from '../idleEfficiencyPresentation';

describe('挂机战斗效率三档提示', () => {
  it.each([
    [0.92, 'smooth', 92, ''],
    [0.71, 'strained', 71, '略吃力'],
    [0.38, 'pressured', 38, '建议换图或提升装备'],
  ] as const)('效率 %s 映射到 %s 档及对应文案', (efficiency, level, percent, detail) => {
    expect(idleEfficiencyPresentation(efficiency)).toEqual({ level, percent, detail });
  });

  it('90% 与 60% 严格落在文档定义的上档边界', () => {
    expect(idleEfficiencyPresentation(0.9).level).toBe('smooth');
    expect(idleEfficiencyPresentation(0.6).level).toBe('strained');
    expect(idleEfficiencyPresentation(0.599).level).toBe('pressured');
  });

  it.each([Number.NaN, Number.POSITIVE_INFINITY, -0.01, 1.01])(
    '非法效率 %s 直接报错，不由 UI 静默钳制',
    (efficiency) => {
      expect(() => idleEfficiencyPresentation(efficiency)).toThrow('战斗效率必须在 0~1');
    },
  );
});
