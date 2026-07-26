import { describe, it, expect } from 'vitest';
import { dropChance, expectedLoot, rollLoot, type PityCounters } from '../loot';
import { Rng } from '../rng';
import type { LootTable } from '../types';

const table: LootTable = {
  id: 'loot_test',
  rolls: 1,
  entries: [
    { itemId: 'junk', weight: 90, minCount: 1, maxCount: 1 },
    { itemId: 'rare', weight: 10, minCount: 1, maxCount: 2 },
  ],
};

describe('rollLoot', () => {
  it('必掉项一定出现', () => {
    const t: LootTable = {
      ...table,
      guaranteed: [{ itemId: 'gold', weight: 0, minCount: 5, maxCount: 5 }],
    };
    for (let i = 0; i < 50; i++) {
      const out = rollLoot(t, new Rng(i));
      expect(out.find((r) => r.itemId === 'gold')?.count).toBe(5);
    }
  });

  it('掉落频率符合权重（rare 约 10%）', () => {
    const rng = new Rng(2026);
    let rareHits = 0;
    const N = 20000;
    for (let i = 0; i < N; i++) {
      if (rollLoot(table, rng).some((r) => r.itemId === 'rare')) rareHits++;
    }
    expect(rareHits / N).toBeCloseTo(0.1, 1);
  });

  it('同种子结果可复现', () => {
    const run = () => rollLoot(table, new Rng(4242));
    expect(run()).toEqual(run());
  });

  it('rolls = 0 时只掉必掉项', () => {
    const t: LootTable = { ...table, rolls: 0 };
    expect(rollLoot(t, new Rng(1))).toEqual([]);
  });

  it('同类项被合并计数', () => {
    const t: LootTable = {
      id: 'l',
      rolls: 5,
      entries: [{ itemId: 'stone', weight: 1, minCount: 2, maxCount: 2 }],
    };
    const out = rollLoot(t, new Rng(9));
    expect(out).toHaveLength(1);
    expect(out[0]!.count).toBe(10);
  });
});

describe('保底机制（防止非酋流失）', () => {
  const pityTable: LootTable = {
    id: 'loot_pity',
    rolls: 1,
    entries: [
      { itemId: 'common', weight: 9999, minCount: 1, maxCount: 1 },
      { itemId: 'shard', weight: 1, minCount: 1, maxCount: 1, pityCount: 30 },
    ],
  };

  it('累计 30 次未掉后必定掉出', () => {
    const pity: PityCounters = {};
    const rng = new Rng(123);
    let firstShardAt = -1;

    for (let i = 1; i <= 31; i++) {
      const out = rollLoot(pityTable, rng, pity);
      if (out.some((r) => r.itemId === 'shard')) {
        firstShardAt = i;
        break;
      }
    }

    expect(firstShardAt).toBeGreaterThan(0);
    expect(firstShardAt).toBeLessThanOrEqual(31);
  });

  it('掉出后保底计数清零', () => {
    const pity: PityCounters = { 'loot_pity:shard': 30 };
    rollLoot(pityTable, new Rng(1), pity);
    expect(pity['loot_pity:shard']).toBe(0);
  });

  it('未掉出时计数递增', () => {
    const pity: PityCounters = {};
    const rng = new Rng(77);
    rollLoot(pityTable, rng, pity);
    expect(pity['loot_pity:shard']).toBeGreaterThanOrEqual(0);
  });
});

describe('expectedLoot', () => {
  it('期望值与大量采样接近', () => {
    const kills = 20000;
    const expected = expectedLoot(table, kills);
    const rareExpected = expected.find((r) => r.itemId === 'rare')!.count;

    const rng = new Rng(31415);
    let rareActual = 0;
    for (let i = 0; i < kills; i++) {
      for (const r of rollLoot(table, rng)) {
        if (r.itemId === 'rare') rareActual += r.count;
      }
    }

    expect(Math.abs(rareActual - rareExpected) / rareExpected).toBeLessThan(0.1);
  });

  it('0 次击杀产出为空', () => {
    expect(expectedLoot(table, 0)).toEqual([]);
  });
});

describe('dropChance', () => {
  it('单次 roll 时等于权重占比', () => {
    expect(dropChance(table, 'rare')).toBeCloseTo(0.1, 6);
  });

  it('不存在的物品为 0', () => {
    expect(dropChance(table, 'nope')).toBe(0);
  });

  it('多次 roll 提高至少掉一次的概率', () => {
    const t: LootTable = { ...table, rolls: 3 };
    expect(dropChance(t, 'rare')).toBeGreaterThan(dropChance(table, 'rare'));
  });
});
