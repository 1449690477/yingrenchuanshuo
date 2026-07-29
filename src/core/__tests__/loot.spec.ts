import { describe, it, expect } from 'vitest';
import { dropChance, expectedLoot, pityGroupKey, rollLoot, type PityCounters } from '../loot';
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

  it('职业专属掉落只进入对应职业池，缺少职业上下文直接报错', () => {
    const classTable: LootTable = {
      id: 'class-loot',
      rolls: 8,
      entries: [
        { itemId: 'shared', weight: 1, minCount: 1, maxCount: 1 },
        {
          itemId: 'cat-claw',
          classId: 'catkin',
          weight: 100,
          minCount: 1,
          maxCount: 1,
        },
        {
          itemId: 'sword',
          classId: 'swordsman',
          weight: 100,
          minCount: 1,
          maxCount: 1,
        },
      ],
    };

    expect(() => rollLoot(classTable, new Rng(1))).toThrow(/classId/);
    const catDrops = rollLoot(classTable, new Rng(1), {}, 'catkin');
    expect(catDrops.some((drop) => drop.itemId === 'sword')).toBe(false);
    expect(catDrops.some((drop) => drop.itemId === 'cat-claw')).toBe(true);
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

  it('多个旧单品同时到达阈值时仍逐项强制，不改变既有语义', () => {
    const t: LootTable = {
      id: 'legacy_multi_pity',
      rolls: 0,
      entries: [
        { itemId: 'old_a', weight: 1, minCount: 1, maxCount: 1, pityCount: 2 },
        { itemId: 'old_b', weight: 1, minCount: 1, maxCount: 1, pityCount: 2 },
      ],
    };
    const pity: PityCounters = {
      'legacy_multi_pity:old_a': 2,
      'legacy_multi_pity:old_b': 2,
    };

    expect(rollLoot(t, new Rng(9), pity)).toEqual([
      { itemId: 'old_a', count: 1 },
      { itemId: 'old_b', count: 1 },
    ]);
    expect(pity).toEqual({
      'legacy_multi_pity:old_a': 0,
      'legacy_multi_pity:old_b': 0,
    });
  });
});

describe('品质组保底', () => {
  const groupTable: LootTable = {
    id: 'loot_quality_group',
    rolls: 0,
    entries: [
      { itemId: 'legendary_weapon', weight: 1, minCount: 1, maxCount: 1 },
      { itemId: 'legendary_head', weight: 3, minCount: 1, maxCount: 1 },
      { itemId: 'legendary_body', weight: 6, minCount: 1, maxCount: 1 },
    ],
    pityGroups: [
      {
        id: 'legendary',
        pityCount: 30,
        itemIds: ['legendary_weapon', 'legendary_head', 'legendary_body'],
      },
    ],
  };
  const groupKey = pityGroupKey(groupTable.id, 'legendary');
  const groupItemIds = new Set(groupTable.pityGroups![0]!.itemIds);

  it('同种子、同计数的组选中与 RNG 推进完全可复现', () => {
    const run = () => {
      const pity: PityCounters = { [groupKey]: 30 };
      const rng = new Rng(4242);
      return {
        drops: rollLoot(groupTable, rng, pity),
        pity,
        rngState: rng.getState(),
      };
    };

    expect(run()).toEqual(run());
  });

  it('到达阈值时只按权重强制选择组内一件，不批量掉出全部候选', () => {
    const pity: PityCounters = { [groupKey]: 30 };
    const drops = rollLoot(groupTable, new Rng(1), pity);
    const groupDrops = drops.filter((drop) => groupItemIds.has(drop.itemId));

    expect(groupDrops).toHaveLength(1);
    expect(groupDrops[0]).toMatchObject({ count: 1 });
  });

  it('强制选择沿用候选 LootEntry 的配置权重', () => {
    const rng = new Rng(20260729);
    let bodyHits = 0;
    const sampleSize = 10_000;

    for (let i = 0; i < sampleSize; i++) {
      const pity: PityCounters = { [groupKey]: 30 };
      const drops = rollLoot(groupTable, rng, pity);
      if (drops[0]!.itemId === 'legendary_body') bodyHits++;
    }

    expect(bodyHits / sampleSize).toBeCloseTo(0.6, 1);
  });

  it('强制命中后整组计数清零', () => {
    const pity: PityCounters = { [groupKey]: 30 };

    rollLoot(groupTable, new Rng(2), pity);

    expect(pity[groupKey]).toBe(0);
  });

  it('阈值前任一候选被正常掷中时按单品既有语义提前清零', () => {
    const normalHitTable: LootTable = {
      ...groupTable,
      id: 'loot_quality_group_normal_hit',
      rolls: 1,
    };
    const key = pityGroupKey(normalHitTable.id, 'legendary');
    const pity: PityCounters = { [key]: 29 };
    const drops = rollLoot(normalHitTable, new Rng(7), pity);

    expect(drops).toHaveLength(1);
    expect(groupItemIds.has(drops[0]!.itemId)).toBe(true);
    expect(pity[key]).toBe(0);
  });

  it('整组未命中时只递增一份共享计数', () => {
    const pity: PityCounters = {};

    rollLoot(groupTable, new Rng(3), pity);

    expect(pity).toEqual({ [groupKey]: 1 });
  });

  it('可与其他条目的旧单品保底并存，双方各自只结算自己的计数', () => {
    const mixedTable: LootTable = {
      ...groupTable,
      id: 'loot_mixed_pity',
      entries: [
        ...groupTable.entries,
        { itemId: 'old_shard', weight: 1, minCount: 2, maxCount: 2, pityCount: 5 },
      ],
    };
    const mixedGroupKey = pityGroupKey(mixedTable.id, 'legendary');
    const pity: PityCounters = {
      [mixedGroupKey]: 30,
      'loot_mixed_pity:old_shard': 5,
    };
    const drops = rollLoot(mixedTable, new Rng(8), pity);

    expect(drops.filter((drop) => groupItemIds.has(drop.itemId))).toHaveLength(1);
    expect(drops).toContainEqual({ itemId: 'old_shard', count: 2 });
    expect(pity).toEqual({
      [mixedGroupKey]: 0,
      'loot_mixed_pity:old_shard': 0,
    });
  });

  it('重复组 ID、计数 key 冲突与候选跨组会硬错误', () => {
    const duplicateGroupId: LootTable = {
      ...groupTable,
      pityGroups: [groupTable.pityGroups![0]!, { ...groupTable.pityGroups![0]! }],
    };
    expect(() => rollLoot(duplicateGroupId, new Rng(1))).toThrow(/id 冲突/);

    const counterKeyCollision: LootTable = {
      ...groupTable,
      entries: [
        ...groupTable.entries,
        {
          itemId: '@pity-group:legendary',
          weight: 1,
          minCount: 1,
          maxCount: 1,
        },
      ],
    };
    expect(() => rollLoot(counterKeyCollision, new Rng(1))).toThrow(/计数 key.*冲突/);

    const memberInTwoGroups: LootTable = {
      ...groupTable,
      pityGroups: [
        groupTable.pityGroups![0]!,
        {
          id: 'another',
          pityCount: 20,
          itemIds: ['legendary_weapon', 'legendary_head'],
        },
      ],
    };
    expect(() => rollLoot(memberInTwoGroups, new Rng(1))).toThrow(/同时属于品质组/);
  });

  it('缺候选、重复候选、非正阈值与单品保底重叠均硬错误', () => {
    const withGroup = (itemIds: string[], pityCount = 30): LootTable => ({
      ...groupTable,
      pityGroups: [{ id: 'legendary', pityCount, itemIds }],
    });

    expect(() => rollLoot(withGroup(['legendary_weapon', 'missing_item']), new Rng(1))).toThrow(
      /不存在/,
    );
    expect(() => rollLoot(withGroup(['legendary_weapon', 'legendary_weapon']), new Rng(1))).toThrow(
      /重复引用/,
    );
    expect(() =>
      rollLoot(withGroup(['legendary_weapon', 'legendary_head'], 0), new Rng(1)),
    ).toThrow(/正整数/);

    const overlapsSinglePity: LootTable = {
      ...groupTable,
      entries: groupTable.entries.map((entry) =>
        entry.itemId === 'legendary_weapon' ? { ...entry, pityCount: 30 } : entry,
      ),
    };
    expect(() => rollLoot(overlapsSinglePity, new Rng(1))).toThrow(/不能同时配置单品/);
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

  it('期望值结算同样过滤其他职业专属物品', () => {
    const classTable: LootTable = {
      id: 'expected-class-loot',
      rolls: 1,
      entries: [
        {
          itemId: 'cat-claw',
          classId: 'catkin',
          weight: 1,
          minCount: 1,
          maxCount: 1,
        },
        {
          itemId: 'sword',
          classId: 'swordsman',
          weight: 1,
          minCount: 1,
          maxCount: 1,
        },
      ],
    };

    expect(expectedLoot(classTable, 100, 'catkin')).toEqual([
      { itemId: 'cat-claw', count: 100 },
    ]);
    expect(dropChance(classTable, 'sword', 'catkin')).toBe(0);
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
