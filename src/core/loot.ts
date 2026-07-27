/**
 * 掉落计算。
 *
 * 权重制而非概率制 —— 见 docs/02-数据表规范.md。
 * 加新掉落物时不必重算所有概率，实际概率 = weight / 总weight。
 *
 * 保底（pity）：某条目累计 N 次未掉出则必掉。
 * 这是防止极端非酋玩家流失的关键设计，见 docs/12-装备体系.md。
 */

import type { ClassId, LootEntry, LootResult, LootTable } from './types';
import type { Rng } from './rng';

/** 保底计数器。key 为 `${tableId}:${itemId}`，value 为累计未掉次数。 */
export type PityCounters = Record<string, number>;

function pityKey(tableId: string, itemId: string): string {
  return `${tableId}:${itemId}`;
}

/**
 * 掷一次掉落表。
 *
 * @param table    掉落表
 * @param rng      随机源
 * @param pity     保底计数器，会被就地修改
 * @returns        本次掉落的物品列表（已合并同类项）
 */
export function rollLoot(
  table: LootTable,
  rng: Rng,
  pity: PityCounters = {},
  classId?: ClassId,
): LootResult[] {
  const acc = new Map<string, number>();
  const entries = eligibleEntries(table.entries, classId, table.id);
  const guaranteed = eligibleEntries(table.guaranteed ?? [], classId, table.id);

  const add = (itemId: string, count: number) => {
    acc.set(itemId, (acc.get(itemId) ?? 0) + count);
  };

  // 必掉项
  for (const e of guaranteed) {
    add(e.itemId, rng.int(e.minCount, e.maxCount));
  }

  if (entries.length === 0) {
    return toResults(acc);
  }

  // 保底检查：任何一条达到 pityCount，直接强制掉出
  const forced: LootEntry[] = [];
  for (const e of entries) {
    if (e.pityCount === undefined) continue;
    const k = pityKey(table.id, e.itemId);
    if ((pity[k] ?? 0) >= e.pityCount) {
      forced.push(e);
      pity[k] = 0;
    }
  }

  for (const e of forced) {
    add(e.itemId, rng.int(e.minCount, e.maxCount));
  }

  // 正常掷骰
  const rolls = Math.max(0, table.rolls);
  const droppedThisRoll = new Set<string>(forced.map((e) => e.itemId));

  for (let i = 0; i < rolls; i++) {
    const picked = rng.weighted(entries, (e) => e.weight);
    add(picked.itemId, rng.int(picked.minCount, picked.maxCount));
    droppedThisRoll.add(picked.itemId);
  }

  // 更新保底计数：这次没掉出来的带 pity 的条目 +1
  for (const e of entries) {
    if (e.pityCount === undefined) continue;
    const k = pityKey(table.id, e.itemId);
    if (!droppedThisRoll.has(e.itemId)) {
      pity[k] = (pity[k] ?? 0) + 1;
    } else {
      pity[k] = 0;
    }
  }

  return toResults(acc);
}

function toResults(acc: Map<string, number>): LootResult[] {
  const out: LootResult[] = [];
  for (const [itemId, count] of acc) {
    if (count > 0) out.push({ itemId, count });
  }
  return out;
}

/**
 * 掉落期望值（不掷骰）。
 * 用于扫荡结算和产出估算 —— 扫荡代表 30 分钟收益，
 * 逐次掷骰既慢又会因方差让玩家觉得「扫荡不如挂机」。
 */
export function expectedLoot(
  table: LootTable,
  killCount: number,
  classId?: ClassId,
): LootResult[] {
  const acc = new Map<string, number>();
  const entries = eligibleEntries(table.entries, classId, table.id);
  const guaranteed = eligibleEntries(table.guaranteed ?? [], classId, table.id);

  for (const e of guaranteed) {
    const avg = (e.minCount + e.maxCount) / 2;
    acc.set(e.itemId, (acc.get(e.itemId) ?? 0) + avg * killCount);
  }

  const total = entries.reduce((s, e) => s + e.weight, 0);
  if (total > 0) {
    for (const e of entries) {
      const p = e.weight / total;
      const avg = (e.minCount + e.maxCount) / 2;
      const expected = p * avg * table.rolls * killCount;
      acc.set(e.itemId, (acc.get(e.itemId) ?? 0) + expected);
    }
  }

  const out: LootResult[] = [];
  for (const [itemId, count] of acc) {
    const floored = Math.floor(count);
    if (floored > 0) out.push({ itemId, count: floored });
  }
  return out;
}

/** 某条目的实际掉落概率，用于 UI 显示 */
export function dropChance(table: LootTable, itemId: string, classId?: ClassId): number {
  const entries = eligibleEntries(table.entries, classId, table.id);
  const total = entries.reduce((s, e) => s + e.weight, 0);
  if (total <= 0) return 0;
  const entry = entries.find((e) => e.itemId === itemId);
  if (!entry) return 0;
  const perRoll = entry.weight / total;
  // 至少掉一次的概率
  return 1 - Math.pow(1 - perRoll, Math.max(1, table.rolls));
}

function eligibleEntries(
  entries: readonly LootEntry[],
  classId: ClassId | undefined,
  tableId: string,
): readonly LootEntry[] {
  const hasClassRestriction = entries.some((entry) => entry.classId !== undefined);
  if (hasClassRestriction && classId === undefined) {
    throw new Error(`[掉落表] ${tableId} 含职业专属掉落，结算时必须提供 classId`);
  }
  return entries.filter((entry) => entry.classId === undefined || entry.classId === classId);
}
