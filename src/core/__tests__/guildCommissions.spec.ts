import { describe, expect, it } from 'vitest';
import {
  GUILD_COMMISSION_BUILD_TARGET,
  GUILD_COMMISSION_DEFS,
  GUILD_COMMISSION_REPUTATION,
} from '@/data/guildCommissions';
import { guildCommissionDayKey, guildCompletedCommissions } from '../guildCommissions';

describe('guild commissions', () => {
  it('和远征共用北京时间 04:00 业务日切换', () => {
    // 2026-08-01 03:59 CST
    expect(guildCommissionDayKey(Date.UTC(2026, 6, 31, 19, 59))).toBe('2026-07-31');
    // 2026-08-01 04:00 CST
    expect(guildCommissionDayKey(Date.UTC(2026, 6, 31, 20, 0))).toBe('2026-08-01');
  });

  it('只在达到对应服务端评分时开放远征阶梯', () => {
    expect(guildCompletedCommissions(0)).toEqual([]);
    expect(guildCompletedCommissions(1).map((item) => item.id)).toEqual(['expedition-entry']);
    expect(guildCompletedCommissions(399).map((item) => item.id)).toEqual(['expedition-entry']);
    expect(guildCompletedCommissions(400).map((item) => item.id)).toEqual([
      'expedition-entry',
      'expedition-vanguard',
    ]);
    expect(guildCompletedCommissions(800).map((item) => item.id)).toEqual([
      'expedition-entry',
      'expedition-vanguard',
      'expedition-ace',
    ]);
  });

  it('展示配置不包含战力资产，且建设与声望是明确的固定值', () => {
    expect(GUILD_COMMISSION_DEFS.every((item) => item.contribution > 0)).toBe(true);
    expect(GUILD_COMMISSION_BUILD_TARGET).toBe(1_800);
    expect(GUILD_COMMISSION_REPUTATION).toBe(20);
  });

  it('拒绝不可能由远征评分产生的值', () => {
    expect(() => guildCompletedCommissions(-1)).toThrow('非负整数');
    expect(() => guildCompletedCommissions(1.5)).toThrow('非负整数');
  });
});
