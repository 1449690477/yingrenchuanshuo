export type LootDisplayCategory = 'equipment' | 'material' | 'consumable' | 'fragment' | 'currency';

export interface LootDisplayEntry {
  id: number;
  itemId: string;
  name: string;
  count: number;
  quality: string;
  isEquipment: boolean;
  category: LootDisplayCategory;
}

export interface AggregatedLootItem {
  itemId: string;
  name: string;
  count: number;
  quality: string;
  isEquipment: boolean;
  latestId: number;
}

export interface LootCategoryGroup {
  category: LootDisplayCategory;
  distinctCount: number;
  totalCount: number;
  items: AggregatedLootItem[];
}

export const LOOT_CATEGORY_ORDER: readonly LootDisplayCategory[] = [
  'equipment',
  'material',
  'consumable',
  'fragment',
  'currency',
];

/** 最近掉落只在展示层聚合；原始时间序列仍供战场掉落动画使用。 */
export function aggregateLootEntries(entries: readonly LootDisplayEntry[]): LootCategoryGroup[] {
  const byCategory = new Map<LootDisplayCategory, Map<string, AggregatedLootItem>>();

  for (const entry of entries) {
    let items = byCategory.get(entry.category);
    if (!items) {
      items = new Map();
      byCategory.set(entry.category, items);
    }
    const current = items.get(entry.itemId);
    if (current) {
      current.count += entry.count;
      current.latestId = Math.max(current.latestId, entry.id);
    } else {
      items.set(entry.itemId, {
        itemId: entry.itemId,
        name: entry.name,
        count: entry.count,
        quality: entry.quality,
        isEquipment: entry.isEquipment,
        latestId: entry.id,
      });
    }
  }

  return LOOT_CATEGORY_ORDER.flatMap((category) => {
    const items = [...(byCategory.get(category)?.values() ?? [])].sort(
      (a, b) => b.latestId - a.latestId,
    );
    if (items.length === 0) return [];
    return [
      {
        category,
        distinctCount: items.length,
        totalCount: items.reduce((sum, item) => sum + item.count, 0),
        items,
      },
    ];
  });
}
