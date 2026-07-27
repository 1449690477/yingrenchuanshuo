import { describe, expect, it } from 'vitest';
import { aggregateLootEntries, type LootDisplayEntry } from '../lootGrouping';

const entries: LootDisplayEntry[] = [
  {
    id: 4,
    itemId: 'eq_sword',
    name: '樱剑',
    count: 1,
    quality: 'rare',
    isEquipment: true,
    category: 'equipment',
  },
  {
    id: 3,
    itemId: 'petal',
    name: '樱花瓣',
    count: 2,
    quality: 'common',
    isEquipment: false,
    category: 'material',
  },
  {
    id: 2,
    itemId: 'eq_sword',
    name: '樱剑',
    count: 2,
    quality: 'rare',
    isEquipment: true,
    category: 'equipment',
  },
  {
    id: 1,
    itemId: 'petal',
    name: '樱花瓣',
    count: 5,
    quality: 'common',
    isEquipment: false,
    category: 'material',
  },
];

describe('最近掉落分类聚合', () => {
  it('按固定分类顺序聚合相同物品并保留最新记录', () => {
    const groups = aggregateLootEntries(entries);
    expect(groups.map((group) => group.category)).toEqual(['equipment', 'material']);
    expect(groups[0]).toMatchObject({ distinctCount: 1, totalCount: 3 });
    expect(groups[0]!.items[0]).toMatchObject({ itemId: 'eq_sword', count: 3, latestId: 4 });
    expect(groups[1]).toMatchObject({ distinctCount: 1, totalCount: 7 });
  });

  it('空流水不制造空分类兜底', () => {
    expect(aggregateLootEntries([])).toEqual([]);
  });
});
