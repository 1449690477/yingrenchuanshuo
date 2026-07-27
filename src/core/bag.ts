/**
 * 背包容量管理。
 *
 * 为什么必须有：挂机产出是无限的，背包不设上限的话装备会无限堆积。
 * 实测玩家一天就能堆到 1.5 万件，后果是：
 *   - 存档体积爆炸，IndexedDB 读写越来越慢
 *   - 任何遍历背包的计算（战力评分、一键穿戴）都被拖垮
 *   - 界面渲染直接卡死
 *
 * 策略：超出容量时自动分解**最不值钱的**装备，但有三条硬性保护：
 *   1. 锁定的装备永不分解
 *   2. 史诗（epic）及以上永不自动分解 —— 玩家辛苦刷的东西不能悄悄没了
 *   3. 每个部位至少保留战力最高的一件，避免把唯一的可穿装备清掉
 *
 * 保护条件太强时宁可让背包超出上限，也不能删玩家的好东西。
 */

import type { EquipmentInstance, EquipSlot, Quality } from './types';

/**
 * 自动分解会碰的品质。
 *
 * ⚠ 必须包含稀有（蓝装）。
 * 最初只放了白/绿，结果玩家背包里堆的全是蓝色「秘银·XX」，
 * 保护规则把它们全挡下来，1.5 万件一件没删，卡死照旧。
 * 蓝装在中后期就是消耗品，堆几千件毫无意义。
 *
 * 史诗（紫）及以上永不自动分解 —— 那是玩家真正在追的东西。
 */
const AUTO_DECOMPOSE_QUALITIES: ReadonlySet<Quality> = new Set<Quality>([
  'common',
  'fine',
  'rare',
]);

export interface TrimContext {
  /** 装备的战力评分，越高越值钱 */
  valueOf: (inst: EquipmentInstance) => number;
  /** 装备所属槽位 */
  slotOf: (inst: EquipmentInstance) => EquipSlot | undefined;
  /** 装备品质 */
  qualityOf: (inst: EquipmentInstance) => Quality | undefined;
}

export interface TrimResult {
  /** 保留下来的装备 */
  kept: EquipmentInstance[];
  /** 被自动分解掉的装备 */
  removed: EquipmentInstance[];
}

/**
 * 把背包裁剪到容量以内。
 *
 * @param equipment 背包里的全部装备
 * @param capacity  容量上限
 */
export function trimBag(
  equipment: readonly EquipmentInstance[],
  capacity: number,
  ctx: TrimContext,
): TrimResult {
  if (capacity <= 0 || equipment.length <= capacity) {
    return { kept: [...equipment], removed: [] };
  }

  // ⚠ 战力必须先一次性算好缓存起来。
  // 早先在排序比较器里直接调 ctx.valueOf，1.5 万件会触发约 43 万次战力计算，
  // 直接把页面卡死 —— 和 BagView 当初踩的是同一个坑。
  const valueCache = new Map<string, number>();
  for (const inst of equipment) {
    valueCache.set(inst.uid, ctx.valueOf(inst));
  }
  const cachedValue = (inst: EquipmentInstance): number => valueCache.get(inst.uid) ?? 0;

  // 每个部位战力最高的那件，无论品质都要留住
  const bestPerSlot = new Map<EquipSlot, string>();
  const bestValue = new Map<EquipSlot, number>();
  for (const inst of equipment) {
    const slot = ctx.slotOf(inst);
    if (!slot) continue;
    const v = cachedValue(inst);
    if (!bestValue.has(slot) || v > bestValue.get(slot)!) {
      bestValue.set(slot, v);
      bestPerSlot.set(slot, inst.uid);
    }
  }

  const isProtected = (inst: EquipmentInstance): boolean => {
    if (inst.locked) return true;
    const q = ctx.qualityOf(inst);
    // 品质查不到时按受保护处理，宁可不删也不能误删
    if (!q || !AUTO_DECOMPOSE_QUALITIES.has(q)) return true;
    const slot = ctx.slotOf(inst);
    if (slot && bestPerSlot.get(slot) === inst.uid) return true;
    return false;
  };

  const protectedItems: EquipmentInstance[] = [];
  const candidates: EquipmentInstance[] = [];
  for (const inst of equipment) {
    (isProtected(inst) ? protectedItems : candidates).push(inst);
  }

  // 需要删掉多少件
  const overflow = equipment.length - capacity;
  if (overflow <= 0 || candidates.length === 0) {
    return { kept: [...equipment], removed: [] };
  }

  // 战力低的先删。用缓存值排序，绝不能在比较器里现算。
  candidates.sort((a, b) => cachedValue(a) - cachedValue(b));
  const removeCount = Math.min(overflow, candidates.length);
  const removed = candidates.slice(0, removeCount);
  const removedIds = new Set(removed.map((e) => e.uid));

  const kept = equipment.filter((e) => !removedIds.has(e.uid));
  return { kept, removed };
}

/** 背包是否已经超出容量 */
export function isOverCapacity(count: number, capacity: number): boolean {
  return capacity > 0 && count > capacity;
}
