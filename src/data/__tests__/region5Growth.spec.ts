import { describe, expect, it } from 'vitest';
import {
  REGION_5_LEGENDARY_LEVEL,
  REGION_5_RHYTHM_LEVEL,
  REGION_5_SET_TARGET,
  region5GrowthSnapshot,
} from '../region5Growth';
import { REGION_5_FRAGMENT_COST, region5SetEquipmentId } from '../region5';

describe('M5-9 熔岩神殿可见成长轨', () => {
  it('所有里程碑都从权威表推导，不另抄品质或技能阈值', () => {
    expect(REGION_5_RHYTHM_LEVEL).toBe(45);
    expect(REGION_5_LEGENDARY_LEVEL).toBe(52);
    expect(REGION_5_SET_TARGET).toBe(240);

    const snapshot = region5GrowthSnapshot({
      playerLevel: 44,
      currentFragments: 0,
      discoveredDefIds: [],
    });
    expect(snapshot.rhythm).toMatchObject({ before: 1.7, after: 2, unlocked: false });
    expect(snapshot.nextHint).toContain('再升 1 级');
  });

  it('用永久图鉴的唯一部位加当前碎片计算收集进度，分解后不倒退', () => {
    const weapon = region5SetEquipmentId('weapon');
    const head = region5SetEquipmentId('head');
    const snapshot = region5GrowthSnapshot({
      playerLevel: 52,
      currentFragments: 17,
      discoveredDefIds: [weapon, weapon, head],
    });

    expect(snapshot.rhythm.unlocked).toBe(true);
    expect(snapshot.legendary.unlocked).toBe(true);
    expect(snapshot.set.collectedPieces).toBe(2);
    expect(snapshot.set.effectiveProgress).toBe(REGION_5_FRAGMENT_COST * 2 + 17);
    expect(snapshot.set.ratio).toBeCloseTo(97 / 240, 8);
    expect(snapshot.nextHint).toContain('再收集 4 个不同部位');
  });

  it('碎片显示最多封顶目标值，但不会伪造套装已收齐', () => {
    const snapshot = region5GrowthSnapshot({
      playerLevel: 52,
      currentFragments: 999,
      discoveredDefIds: [region5SetEquipmentId('weapon')],
    });
    expect(snapshot.set.effectiveProgress).toBe(REGION_5_SET_TARGET);
    expect(snapshot.set.ratio).toBe(1);
    expect(snapshot.set.complete).toBe(false);
    expect(snapshot.nextHint).toContain('再收集 5 个不同部位');
  });

  it('拒绝损坏的负数或非整数存档投影，不用兜底掩盖错误', () => {
    expect(() =>
      region5GrowthSnapshot({ playerLevel: 50.5, currentFragments: 0, discoveredDefIds: [] }),
    ).toThrow('玩家等级');
    expect(() =>
      region5GrowthSnapshot({ playerLevel: 50, currentFragments: -1, discoveredDefIds: [] }),
    ).toThrow('绯焰碎片');
  });
});
