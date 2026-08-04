import { describe, expect, it } from 'vitest';
import {
  buildTrialFormulaStamp,
  LEGACY_TRIAL_FORMULA_VERSION,
  TRIAL_FORMULA_VERSION,
} from '../trialFormulaVersion';

describe('试炼公式版本戳', () => {
  it('当前五职业真实技能引擎使用 v2', () => {
    expect(LEGACY_TRIAL_FORMULA_VERSION).toBe(1);
    expect(TRIAL_FORMULA_VERSION).toBe(4);
    expect(Number.isInteger(TRIAL_FORMULA_VERSION)).toBe(true);
    expect(TRIAL_FORMULA_VERSION).toBeGreaterThan(0);
  });

  it('由唯一构造点生成数据库字段', () => {
    expect(buildTrialFormulaStamp()).toEqual({ trial_formula_version: TRIAL_FORMULA_VERSION });
  });
});
