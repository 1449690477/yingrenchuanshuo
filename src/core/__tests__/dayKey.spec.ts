import { describe, expect, it } from 'vitest';
import { businessDayKey } from '../dayKey';

describe('统一业务日切', () => {
  it('北京时间 04:00 才进入新的一天', () => {
    const beforeReset = Date.UTC(2026, 6, 28, 19, 59, 59);
    const atReset = Date.UTC(2026, 6, 28, 20, 0, 0);

    expect(businessDayKey(beforeReset)).toBe('2026-07-28');
    expect(businessDayKey(atReset)).toBe('2026-07-29');
  });

  it('允许系统显式复用不同日切小时', () => {
    const atBeijingMidnight = Date.UTC(2026, 6, 28, 16, 0, 0);
    expect(businessDayKey(atBeijingMidnight, 0)).toBe('2026-07-29');
    expect(businessDayKey(atBeijingMidnight, 4)).toBe('2026-07-28');
  });

  it('拒绝无效时间戳与日切小时，不掩盖调用错误', () => {
    expect(() => businessDayKey(Number.NaN)).toThrow('非负有限时间戳');
    expect(() => businessDayKey(-1)).toThrow('非负有限时间戳');
    expect(() => businessDayKey(Date.now(), 24)).toThrow('0~23 的整数');
    expect(() => businessDayKey(Date.now(), 3.5)).toThrow('0~23 的整数');
  });
});
