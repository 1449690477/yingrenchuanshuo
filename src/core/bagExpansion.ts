/**
 * M6-7 · 背包扩容核心逻辑（铁律 1：纯函数，零 UI / store 依赖）。
 *
 * 职责：由 data 层经济参数推导扩容档位表、查询当前容量的下一档、
 * 判定金币是否可负担。随机零依赖（铁律 4），任何档位结果可复现。
 */
import {
  BAG_BASE_CAPACITY,
  BAG_CAPACITY_STEP,
  BAG_EXPANSION_BASE_COST,
  BAG_EXPANSION_COST_GROWTH,
  BAG_MAX_CAPACITY,
} from '@/data/bagExpansion';

/** 一档扩容的完整定义。 */
export interface BagExpansionTier {
  /** 扩容次数序号（1 起）。 */
  index: number;
  /** 扩容后的容量。 */
  capacity: number;
  /** 本次扩容价格（金币）。 */
  goldCost: number;
}

/** 价格取整到千位（与游戏内金币数字体感对齐）。 */
function roundToThousands(value: number): number {
  return Math.round(value / 1000) * 1000;
}

/** 全部扩容档位（300 → 350 → … → 800，共 10 档；纯推导，可复现）。 */
export function bagExpansionTiers(): readonly BagExpansionTier[] {
  const tiers: BagExpansionTier[] = [];
  let capacity = BAG_BASE_CAPACITY;
  let index = 1;
  while (capacity + BAG_CAPACITY_STEP <= BAG_MAX_CAPACITY) {
    capacity += BAG_CAPACITY_STEP;
    const goldCost = roundToThousands(
      BAG_EXPANSION_BASE_COST * BAG_EXPANSION_COST_GROWTH ** (index - 1),
    );
    tiers.push({ index, capacity, goldCost });
    index += 1;
  }
  return tiers;
}

/** 当前容量下已完成的扩容次数（0 = 未扩容过）。 */
export function expansionCountForCapacity(capacity: number): number {
  if (capacity <= BAG_BASE_CAPACITY) return 0;
  return Math.min(
    bagExpansionTiers().length,
    Math.max(0, Math.floor((capacity - BAG_BASE_CAPACITY) / BAG_CAPACITY_STEP)),
  );
}

/** 当前容量对应的下一档扩容；已封顶返回 null。 */
export function nextBagExpansion(capacity: number): BagExpansionTier | null {
  return bagExpansionTiers()[expansionCountForCapacity(capacity)] ?? null;
}

/** 当前金币是否足够购买下一档扩容（已封顶返回 false）。 */
export function canAffordBagExpansion(capacity: number, gold: number): boolean {
  const next = nextBagExpansion(capacity);
  return next !== null && gold >= next.goldCost;
}

/** 扩容封顶容量（store/UI 展示用，单一事实源）。 */
export const BAG_EXPANSION_MAX_CAPACITY = BAG_MAX_CAPACITY;
