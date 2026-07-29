/**
 * 掉落计算。
 *
 * 权重制而非概率制 —— 见 docs/02-数据表规范.md。
 * 加新掉落物时不必重算所有概率，实际概率 = weight / 总weight。
 *
 * 保底（pity）：某条目累计 N 次未掉出则必掉。
 * 这是防止极端非酋玩家流失的关键设计，见 docs/12-装备体系.md。
 */

import type { ClassId, LootEntry, LootPityGroup, LootResult, LootTable } from './types';
import type { Rng } from './rng';

/**
 * 保底计数器。
 * 单品 key 为 `${tableId}:${itemId}`；组 key 为
 * `${tableId}:@pity-group:${groupId}`；value 为累计未掉次数。
 */
export type PityCounters = Record<string, number>;

const PITY_GROUP_KEY_PREFIX = '@pity-group:';

function pityKey(tableId: string, itemId: string): string {
  return `${tableId}:${itemId}`;
}

/** 品质组计数沿用既有字符串字典，无需改变存档结构。 */
export function pityGroupKey(tableId: string, groupId: string): string {
  return pityKey(tableId, `${PITY_GROUP_KEY_PREFIX}${groupId}`);
}

interface ResolvedPityGroup {
  config: LootPityGroup;
  entries: LootEntry[];
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
  const pityGroups = resolvePityGroups(table, entries, classId);

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

  // 品质组保底：一个组达到阈值时，只按组内条目的配置权重强制选一件。
  const forcedFromGroups: LootEntry[] = [];
  for (const group of pityGroups) {
    const k = pityGroupKey(table.id, group.config.id);
    if ((pity[k] ?? 0) < group.config.pityCount) continue;

    const picked = rng.weighted(group.entries, (entry) => entry.weight);
    forcedFromGroups.push(picked);
    pity[k] = 0;
  }

  for (const entry of forcedFromGroups) {
    add(entry.itemId, rng.int(entry.minCount, entry.maxCount));
  }

  // 正常掷骰
  const rolls = Math.max(0, table.rolls);
  const droppedThisRoll = new Set<string>([
    ...forced.map((entry) => entry.itemId),
    ...forcedFromGroups.map((entry) => entry.itemId),
  ]);

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

  // 任一组员在强制或正常掷骰中命中，都会按单品保底的既有语义清零整组。
  for (const group of pityGroups) {
    const k = pityGroupKey(table.id, group.config.id);
    if (group.entries.some((entry) => droppedThisRoll.has(entry.itemId))) {
      pity[k] = 0;
    } else {
      pity[k] = (pity[k] ?? 0) + 1;
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

function resolvePityGroups(
  table: LootTable,
  eligible: readonly LootEntry[],
  classId: ClassId | undefined,
): ResolvedPityGroup[] {
  const groups = table.pityGroups ?? [];
  if (groups.length === 0) return [];

  const entriesByItemId = new Map<string, LootEntry[]>();
  for (const entry of table.entries) {
    const matches = entriesByItemId.get(entry.itemId) ?? [];
    matches.push(entry);
    entriesByItemId.set(entry.itemId, matches);
  }

  const eligibleEntriesSet = new Set(eligible);
  const groupIds = new Set<string>();
  const groupByItemId = new Map<string, string>();
  const resolved: ResolvedPityGroup[] = [];

  for (const group of groups) {
    validatePityGroupHeader(table, group, groupIds);
    const seenItemIds = new Set<string>();
    const allCandidates: LootEntry[] = [];

    for (const itemId of group.itemIds) {
      if (seenItemIds.has(itemId)) {
        throw new Error(`[掉落表] ${table.id} 品质组保底 ${group.id} 重复引用候选 ${itemId}`);
      }
      seenItemIds.add(itemId);

      const matches = entriesByItemId.get(itemId) ?? [];
      if (matches.length === 0) {
        throw new Error(
          `[掉落表] ${table.id} 品质组保底 ${group.id} 引用了不存在的 entries 候选 ${itemId}`,
        );
      }
      if (matches.length > 1) {
        throw new Error(
          `[掉落表] ${table.id} 品质组保底 ${group.id} 的候选 ${itemId} 在 entries 中不唯一`,
        );
      }

      const previousGroupId = groupByItemId.get(itemId);
      if (previousGroupId !== undefined) {
        throw new Error(
          `[掉落表] ${table.id} 的候选 ${itemId} 同时属于品质组 ${previousGroupId} 与 ${group.id}`,
        );
      }
      groupByItemId.set(itemId, group.id);

      const entry = matches[0]!;
      validatePityGroupCandidate(table.id, group.id, entry);
      allCandidates.push(entry);
    }

    const activeCandidates = allCandidates.filter((entry) => eligibleEntriesSet.has(entry));
    if (activeCandidates.length === 1) {
      throw new Error(
        `[掉落表] ${table.id} 品质组保底 ${group.id} 对职业 ${classId ?? '通用'} 只有一个可用候选`,
      );
    }
    if (activeCandidates.length > 0) {
      resolved.push({ config: group, entries: activeCandidates });
    }
  }

  return resolved;
}

function validatePityGroupHeader(
  table: LootTable,
  group: LootPityGroup,
  groupIds: Set<string>,
): void {
  if (group.id.length === 0 || group.id !== group.id.trim()) {
    throw new Error(`[掉落表] ${table.id} 品质组保底 id 必须是非空且无首尾空格的字符串`);
  }
  if (groupIds.has(group.id)) {
    throw new Error(`[掉落表] ${table.id} 品质组保底 id 冲突：${group.id}`);
  }
  groupIds.add(group.id);

  if (!Number.isInteger(group.pityCount) || group.pityCount <= 0) {
    throw new Error(`[掉落表] ${table.id} 品质组保底 ${group.id} 的 pityCount 必须是正整数`);
  }
  if (group.itemIds.length < 2) {
    throw new Error(`[掉落表] ${table.id} 品质组保底 ${group.id} 至少需要两个候选`);
  }

  const reservedItemId = `${PITY_GROUP_KEY_PREFIX}${group.id}`;
  if (table.entries.some((entry) => entry.itemId === reservedItemId)) {
    throw new Error(
      `[掉落表] ${table.id} 品质组保底 ${group.id} 的计数 key 与物品 ${reservedItemId} 冲突`,
    );
  }
}

function validatePityGroupCandidate(tableId: string, groupId: string, entry: LootEntry): void {
  if (entry.pityCount !== undefined) {
    throw new Error(
      `[掉落表] ${tableId} 品质组保底 ${groupId} 的候选 ${entry.itemId} 不能同时配置单品 pityCount`,
    );
  }
  if (!Number.isFinite(entry.weight) || entry.weight <= 0) {
    throw new Error(
      `[掉落表] ${tableId} 品质组保底 ${groupId} 的候选 ${entry.itemId} 权重必须大于 0`,
    );
  }
  if (
    !Number.isInteger(entry.minCount) ||
    !Number.isInteger(entry.maxCount) ||
    entry.minCount <= 0 ||
    entry.maxCount < entry.minCount
  ) {
    throw new Error(
      `[掉落表] ${tableId} 品质组保底 ${groupId} 的候选 ${entry.itemId} 数量范围非法`,
    );
  }
}
