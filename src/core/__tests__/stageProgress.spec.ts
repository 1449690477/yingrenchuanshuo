import { describe, expect, it } from 'vitest';
import { advanceStageKillProgress } from '../stageProgress';

describe('关卡击杀进度', () => {
  it('普通关首通前累积，首通后保持满进度', () => {
    expect(advanceStageKillProgress(4, 3, 10, false, false)).toEqual({
      progress: 7,
      clearedNow: false,
      bossKills: 0,
    });
    expect(advanceStageKillProgress(7, 5, 10, false, false)).toEqual({
      progress: 10,
      clearedNow: true,
      bossKills: 0,
    });
    expect(advanceStageKillProgress(10, 50, 10, true, false)).toEqual({
      progress: 10,
      clearedNow: false,
      bossKills: 0,
    });
  });

  it('BOSS 只在完整波次结束时计数，并保留下一轮余数', () => {
    expect(advanceStageKillProgress(8, 5, 10, false, true)).toEqual({
      progress: 3,
      clearedNow: true,
      bossKills: 1,
    });
    expect(advanceStageKillProgress(3, 28, 10, true, true)).toEqual({
      progress: 1,
      clearedNow: false,
      bossKills: 3,
    });
  });

  it('兼容旧存档中已通关 BOSS 关保存为满进度的状态', () => {
    expect(advanceStageKillProgress(10, 10, 10, true, true)).toEqual({
      progress: 0,
      clearedNow: false,
      bossKills: 1,
    });
  });

  it('拒绝负数、小数和未通关越界状态', () => {
    expect(() => advanceStageKillProgress(-1, 1, 10, false, true)).toThrow();
    expect(() => advanceStageKillProgress(0, 0.5, 10, false, true)).toThrow();
    expect(() => advanceStageKillProgress(0, 1, 0, false, true)).toThrow();
    expect(() => advanceStageKillProgress(10, 1, 10, false, true)).toThrow();
  });
});
