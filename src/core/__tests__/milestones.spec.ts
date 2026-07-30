/**
 * 登顶速度榜纯逻辑测试（docs/51 §4 榜 4）。
 *
 * 重点守两件事：
 *   1. 一次跨多档不能漏记（离线收益与区域解锁都会连升数级）
 *   2. 合理性下界要留足余量，别把真实玩家判成作弊
 */

import { describe, expect, it } from 'vitest';
import {
  formatElapsed,
  isPlausibleMilestone,
  milestoneElapsedMs,
  newlyReachedMilestones,
} from '../milestones';
import {
  MILESTONE_LEVELS,
  MILESTONE_MIN_ELAPSED_MS,
  MILESTONE_TYPICAL_DAYS,
  isMilestoneLevel,
} from '@/data/milestoneRules';

const DAY_MS = 86_400_000;

describe('newlyReachedMilestones', () => {
  it('正常升一级跨过档位时记录该档', () => {
    expect(newlyReachedMilestones(19, 20, [])).toEqual([20]);
  });

  it('等级正好等于档位算达成，再升一级不重复触发', () => {
    expect(newlyReachedMilestones(20, 21, [20])).toEqual([]);
    // 即便没记录过，从 20 升到 21 也不该再触发 20（20 > prevLevel 不成立）
    expect(newlyReachedMilestones(20, 21, [])).toEqual([]);
  });

  it('一次跨多档时全部返回，不只给最高的那个', () => {
    // 区域解锁后囤积经验一次性释放：Lv15 直接冲到 Lv62
    expect(newlyReachedMilestones(15, 62, [])).toEqual([20, 40, 60]);
  });

  it('已记录的档位不会重复产生', () => {
    expect(newlyReachedMilestones(15, 62, [20, 40])).toEqual([60]);
  });

  it('等级没涨（或倒退）时什么都不记录', () => {
    expect(newlyReachedMilestones(30, 30, [])).toEqual([]);
    expect(newlyReachedMilestones(30, 25, [])).toEqual([]);
  });

  it('返回顺序按档位升序，便于直接落库', () => {
    const result = newlyReachedMilestones(1, 99, []);
    expect(result).toEqual([...result].sort((a, b) => a - b));
  });
});

describe('milestoneElapsedMs', () => {
  it('用时是达成时刻减建号时刻', () => {
    expect(milestoneElapsedMs(1_000_000, 1_000_000 + 5 * DAY_MS)).toBe(5 * DAY_MS);
  });

  it('时钟回拨或改档导致差值 ≤ 0 时夹到 1ms，而不是抛错', () => {
    // 数据库有 elapsed_ms > 0 约束；让一次正常升级崩在存档写入上更糟。
    expect(milestoneElapsedMs(2_000_000, 1_000_000)).toBe(1);
    expect(milestoneElapsedMs(1_000_000, 1_000_000)).toBe(1);
  });

  it('夹出来的 1ms 随后会被合理性判定拒绝，不会静默入榜', () => {
    const elapsedMs = milestoneElapsedMs(2_000_000, 1_000_000);
    expect(isPlausibleMilestone({ level: 20, elapsedMs })).toBe(false);
  });
});

describe('isPlausibleMilestone', () => {
  it('达到下界的成绩通过', () => {
    for (const level of MILESTONE_LEVELS) {
      expect(isPlausibleMilestone({ level, elapsedMs: MILESTONE_MIN_ELAPSED_MS[level] })).toBe(
        true,
      );
    }
  });

  it('低于下界的成绩不通过', () => {
    for (const level of MILESTONE_LEVELS) {
      expect(isPlausibleMilestone({ level, elapsedMs: MILESTONE_MIN_ELAPSED_MS[level] - 1 })).toBe(
        false,
      );
    }
  });

  it('白名单之外的档位一律不通过（客户端能声明任意 level）', () => {
    expect(isPlausibleMilestone({ level: 21, elapsedMs: 999 * DAY_MS })).toBe(false);
    expect(isPlausibleMilestone({ level: 0, elapsedMs: 999 * DAY_MS })).toBe(false);
    expect(isPlausibleMilestone({ level: 999, elapsedMs: 999 * DAY_MS })).toBe(false);
  });

  it('非有限数与非正数不通过', () => {
    expect(isPlausibleMilestone({ level: 20, elapsedMs: Number.NaN })).toBe(false);
    expect(isPlausibleMilestone({ level: 20, elapsedMs: Number.POSITIVE_INFINITY })).toBe(false);
    expect(isPlausibleMilestone({ level: 20, elapsedMs: 0 })).toBe(false);
    expect(isPlausibleMilestone({ level: 20, elapsedMs: -1 })).toBe(false);
  });

  it('拒绝荒谬声明：Lv60 用 1 小时', () => {
    expect(isPlausibleMilestone({ level: 60, elapsedMs: 3_600_000 })).toBe(false);
  });
});

describe('合理性下界的余量（防止把真实玩家判成作弊）', () => {
  it('每个档位都给 sim 典型玩家留出至少 4 倍余量', () => {
    // 下界的职责是拒绝「Lv60 用 1 小时」，不是裁决 2 倍的差距。
    // 满强化肝帝相对典型玩家大约快 2 倍，4 倍余量才安全。
    for (const level of MILESTONE_LEVELS) {
      const typicalMs = MILESTONE_TYPICAL_DAYS[level] * DAY_MS;
      const floorMs = MILESTONE_MIN_ELAPSED_MS[level];
      expect(typicalMs / floorMs).toBeGreaterThanOrEqual(4);
    }
  });

  it('典型玩家的用时一定通过合理性判定', () => {
    for (const level of MILESTONE_LEVELS) {
      const elapsedMs = Math.round(MILESTONE_TYPICAL_DAYS[level] * DAY_MS);
      expect(isPlausibleMilestone({ level, elapsedMs })).toBe(true);
    }
  });

  it('每个档位都必须登记下界与典型用时，加档位时不许漏配', () => {
    for (const level of MILESTONE_LEVELS) {
      expect(MILESTONE_MIN_ELAPSED_MS[level]).toBeGreaterThan(0);
      expect(MILESTONE_TYPICAL_DAYS[level]).toBeGreaterThan(0);
    }
  });

  it('档位严格升序，且用时下界随档位单调递增', () => {
    const levels = [...MILESTONE_LEVELS];
    expect(levels).toEqual([...levels].sort((a, b) => a - b));
    for (let i = 1; i < levels.length; i++) {
      expect(MILESTONE_MIN_ELAPSED_MS[levels[i]]).toBeGreaterThan(
        MILESTONE_MIN_ELAPSED_MS[levels[i - 1]],
      );
    }
  });

  it('档位都在当前内容可达范围内，否则榜单一上线就是空的', () => {
    // 内容顶 Lv65 / 软上限 68（docs/56）。超出的档位没人能达成。
    for (const level of MILESTONE_LEVELS) {
      expect(level).toBeLessThanOrEqual(68);
    }
  });

  it('isMilestoneLevel 与档位表一致', () => {
    for (const level of MILESTONE_LEVELS) expect(isMilestoneLevel(level)).toBe(true);
    expect(isMilestoneLevel(41)).toBe(false);
  });
});

describe('formatElapsed', () => {
  it('天为主单位，带小时', () => {
    expect(formatElapsed(3 * DAY_MS + 4 * 3_600_000)).toBe('3 天 4 小时');
  });

  it('整天不显示 0 小时', () => {
    expect(formatElapsed(3 * DAY_MS)).toBe('3 天');
  });

  it('不足一天显示小时与分', () => {
    expect(formatElapsed(5 * 3_600_000 + 30 * 60_000)).toBe('5 小时 30 分');
    expect(formatElapsed(5 * 3_600_000)).toBe('5 小时');
  });

  it('不足一小时只显示分', () => {
    expect(formatElapsed(42 * 60_000)).toBe('42 分');
  });

  it('负数不产生负号（夹到 0 分）', () => {
    expect(formatElapsed(-1)).toBe('0 分');
  });
});
