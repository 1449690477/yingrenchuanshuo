import { describe, expect, it } from 'vitest';
import {
  BAG_BASE_CAPACITY,
  BAG_CAPACITY_STEP,
  BAG_EXPANSION_BASE_COST,
  BAG_EXPANSION_COST_GROWTH,
  BAG_MAX_CAPACITY,
} from '@/data/bagExpansion';
import {
  BAG_EXPANSION_MAX_CAPACITY,
  bagExpansionTiers,
  canAffordBagExpansion,
  expansionCountForCapacity,
  nextBagExpansion,
} from '../bagExpansion';

describe('背包扩容档位（bagExpansionTiers）', () => {
  it('档位表：300→350→…→800 共 10 档，每档 +50', () => {
    const tiers = bagExpansionTiers();
    expect(tiers).toHaveLength((BAG_MAX_CAPACITY - BAG_BASE_CAPACITY) / BAG_CAPACITY_STEP);
    expect(tiers[0]).toMatchObject({ index: 1, capacity: 350 });
    expect(tiers[tiers.length - 1]).toMatchObject({
      index: 10,
      capacity: BAG_MAX_CAPACITY,
    });
    for (let i = 1; i < tiers.length; i += 1) {
      expect(tiers[i].capacity - tiers[i - 1].capacity).toBe(BAG_CAPACITY_STEP);
      expect(tiers[i].index).toBe(tiers[i - 1].index + 1);
    }
  });

  it('价格按 ×1.2/档 递增并取整到千', () => {
    const tiers = bagExpansionTiers();
    const expected = [100_000, 120_000, 144_000, 173_000, 207_000, 249_000, 299_000, 358_000, 430_000, 516_000];
    expect(tiers.map((t) => t.goldCost)).toEqual(expected);
    // 首档价格 = 基础价
    expect(tiers[0].goldCost).toBe(BAG_EXPANSION_BASE_COST);
    // 增长率验证：末档 / 首档 ≈ 1.2^9
    expect(tiers[tiers.length - 1].goldCost).toBeCloseTo(
      BAG_EXPANSION_BASE_COST * BAG_EXPANSION_COST_GROWTH ** 9,
      -2,
    );
  });
});

describe('扩容查询（nextBagExpansion / expansionCountForCapacity）', () => {
  it('初始容量 300：下一档 350，价格 10 万', () => {
    const next = nextBagExpansion(BAG_BASE_CAPACITY);
    expect(next).not.toBeNull();
    expect(next!.capacity).toBe(350);
    expect(next!.goldCost).toBe(100_000);
    expect(expansionCountForCapacity(BAG_BASE_CAPACITY)).toBe(0);
  });

  it('中间容量 400：已扩容 2 次，下一档 450', () => {
    expect(expansionCountForCapacity(400)).toBe(2);
    const next = nextBagExpansion(400);
    expect(next!.capacity).toBe(450);
    expect(next!.index).toBe(3);
  });

  it('封顶 800：无下一档，不可再扩容', () => {
    expect(expansionCountForCapacity(BAG_MAX_CAPACITY)).toBe(10);
    expect(nextBagExpansion(BAG_MAX_CAPACITY)).toBeNull();
    expect(canAffordBagExpansion(BAG_MAX_CAPACITY, 999_999_999)).toBe(false);
  });

  it('异常容量（低于初始或高于封顶）安全收敛', () => {
    expect(expansionCountForCapacity(0)).toBe(0);
    expect(nextBagExpansion(0)!.capacity).toBe(350);
    expect(expansionCountForCapacity(9999)).toBe(10);
    expect(nextBagExpansion(9999)).toBeNull();
  });
});

describe('负担判定（canAffordBagExpansion）', () => {
  it('金币足够可买，不足不可买', () => {
    expect(canAffordBagExpansion(300, 100_000)).toBe(true);
    expect(canAffordBagExpansion(300, 99_999)).toBe(false);
    // 下一档 450 价 144k：400 容量 + 144k 可买
    expect(canAffordBagExpansion(400, 144_000)).toBe(true);
    expect(canAffordBagExpansion(400, 143_999)).toBe(false);
  });

  it('封顶后 false（不因金币多而误判）', () => {
    expect(canAffordBagExpansion(BAG_EXPANSION_MAX_CAPACITY, Number.MAX_SAFE_INTEGER)).toBe(
      false,
    );
  });
});
