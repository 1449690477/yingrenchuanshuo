import { describe, expect, it } from 'vitest';
import { abbr, comma, countdown, duration, pct, signed } from '../format';

describe('abbr', () => {
  it('按中文万、亿、兆、京缩写并去掉尾零', () => {
    expect(abbr(9999)).toBe('9999');
    expect(abbr(12_345)).toBe('1.23万');
    expect(abbr(100_000_000)).toBe('1亿');
    expect(abbr(5_600_000_000_000)).toBe('5.6兆');
    expect(abbr(10_000_000_000_000_000)).toBe('1京');
  });

  it('正确处理负数、小数和非有限值', () => {
    expect(abbr(-12_345)).toBe('-1.23万');
    expect(abbr(12.34)).toBe('12.3');
    expect(abbr(Number.POSITIVE_INFINITY)).toBe('—');
  });
});

describe('辅助格式', () => {
  it('千分位、百分比和带符号数字', () => {
    expect(comma(12_345.6)).toBe('12,346');
    expect(pct(0.1234)).toBe('12.3%');
    expect(signed(12_345)).toBe('+1.23万');
    expect(signed(-5)).toBe('-5');
    expect(signed(0)).toBe('0');
  });

  it('时长按最大两个单位显示', () => {
    expect(duration(59)).toBe('59秒');
    expect(duration(90)).toBe('1分30秒');
    expect(duration(3_700)).toBe('1小时1分');
    expect(duration(90_000)).toBe('1天1小时');
    expect(duration(-10)).toBe('0秒');
  });

  it('倒计时使用 mm:ss', () => {
    expect(countdown(0)).toBe('00:00');
    expect(countdown(90)).toBe('01:30');
    expect(countdown(3_600)).toBe('60:00');
  });
});
