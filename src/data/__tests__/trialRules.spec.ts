/**
 * 周常试炼配置表（trialRules）的约束测试。
 *
 * 数据表本身没有逻辑，但填写规则必须守住：分段必须无缝覆盖 1~120、
 * 倾向名字必须覆盖全部可选元素、余量必须大于 1（否则 Boss 可能被打完，
 * 榜单指标就从「伤害」退化成「剩余时间」，见 docs/51 §3.3）。
 */

import { describe, expect, it } from 'vitest';
import {
  TRIAL_BOSS_ELEMENTS,
  TRIAL_BOSS_HP_HEADROOM,
  TRIAL_BRACKETS,
  TRIAL_DURATION_SEC,
  TRIAL_TILTS,
} from '../trialRules';

describe('TRIAL_BRACKETS / 等级分段', () => {
  it('无缝覆盖 1~120', () => {
    const sorted = [...TRIAL_BRACKETS].sort((a, b) => a.minLevel - b.minLevel);
    expect(sorted[0]!.minLevel).toBe(1);
    expect(sorted[sorted.length - 1]!.maxLevel).toBe(120);
    for (let i = 1; i < sorted.length; i++) {
      expect(sorted[i]!.minLevel).toBe(sorted[i - 1]!.maxLevel + 1);
    }
  });

  it('Boss 基准等级落在分段内', () => {
    for (const b of TRIAL_BRACKETS) {
      expect(b.bossLevel).toBeGreaterThanOrEqual(b.minLevel);
      expect(b.bossLevel).toBeLessThanOrEqual(b.maxLevel);
    }
  });

  it('分段 id 唯一', () => {
    expect(new Set(TRIAL_BRACKETS.map((b) => b.id)).size).toBe(TRIAL_BRACKETS.length);
  });
});

describe('TRIAL_TILTS / 每周词条倾向', () => {
  it('id 唯一且每种倾向都给出全部可选元素的 Boss 名', () => {
    expect(new Set(TRIAL_TILTS.map((t) => t.id)).size).toBe(TRIAL_TILTS.length);
    for (const tilt of TRIAL_TILTS) {
      for (const element of TRIAL_BOSS_ELEMENTS) {
        expect(tilt.names[element].length).toBeGreaterThan(0);
      }
    }
  });

  it('每种倾向都有给玩家看的解法提示', () => {
    for (const tilt of TRIAL_TILTS) {
      expect(tilt.hint.length).toBeGreaterThan(4);
    }
  });
});

describe('试炼数值护栏', () => {
  it('血量余量必须大于 1，保证 60 秒打不完', () => {
    expect(TRIAL_BOSS_HP_HEADROOM).toBeGreaterThan(1);
  });

  it('试炼时长是 60 秒（方案 §3.1 的硬口径）', () => {
    expect(TRIAL_DURATION_SEC).toBe(60);
  });
});
