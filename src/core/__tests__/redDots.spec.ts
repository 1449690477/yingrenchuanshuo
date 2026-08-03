import { describe, expect, it } from 'vitest';
import { redDotState } from '../redDots';

const zero = {
  pendingEncounters: 0,
  pendingAffixCount: 0,
  dungeonAttemptsRemaining: 0,
  pendingMilestones: 0,
  affectionRemaining: 0,
};

describe('redDotState', () => {
  it('全零时全部红点关闭', () => {
    expect(redDotState(zero)).toEqual({
      idle: false, bag: false, growth: false, dungeon: false, rank: false, more: false,
    });
  });

  it('奇遇待处理 > 0 时挂机红点亮', () => {
    expect(redDotState({ ...zero, pendingEncounters: 2 }).idle).toBe(true);
  });

  it('待确认洗炼 > 0 时背包红点亮', () => {
    expect(redDotState({ ...zero, pendingAffixCount: 1 }).bag).toBe(true);
  });

  it('副本剩余次数 > 0 时副本红点亮', () => {
    expect(redDotState({ ...zero, dungeonAttemptsRemaining: 3 }).dungeon).toBe(true);
  });

  it('未上报里程碑 > 0 时排行红点亮', () => {
    expect(redDotState({ ...zero, pendingMilestones: 1 }).rank).toBe(true);
  });

  it('好感可互动 > 0 时更多红点亮', () => {
    expect(redDotState({ ...zero, affectionRemaining: 4 }).more).toBe(true);
  });

  it('growth 第一版固定关闭（等 M3-5 升级 UI）', () => {
    expect(redDotState({ ...zero, affectionRemaining: 4 }).growth).toBe(false);
  });

  it('同时多个红点独立亮灯', () => {
    const s = redDotState({ ...zero, pendingEncounters: 1, pendingAffixCount: 2, dungeonAttemptsRemaining: 1 });
    expect(s).toMatchObject({ idle: true, bag: true, dungeon: true, rank: false, more: false });
  });
});
