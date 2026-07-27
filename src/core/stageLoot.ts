import type { LootResult, Stage } from './types';
import { flattenBattleMonsterIds } from './battleVisual';

type StageWaves = Pick<Stage, 'id' | 'waves'>;

export interface StageMonsterKillDistribution {
  /** 本批击杀按怪物 id 聚合后的数量。 */
  counts: Record<string, number>;
  /** 结算完成后下一只怪物在循环序列中的游标。 */
  nextCursor: number;
}

/**
 * 统计一批挂机击杀实际命中了关卡循环中的哪些怪物。
 *
 * 关卡波次只展开一次；完整循环按乘法累计，余数最多再遍历一轮。
 * 因此即使离线结算数万只怪，复杂度也只与单轮波次长度有关。
 */
export function countStageMonsterKills(
  stage: StageWaves,
  startCursor: number,
  kills: number,
): StageMonsterKillDistribution {
  if (!Number.isSafeInteger(startCursor) || startCursor < 0) {
    throw new Error(`[关卡掉落错误] 起始游标必须是非负安全整数：${startCursor}`);
  }
  if (!Number.isSafeInteger(kills) || kills < 0) {
    throw new Error(`[关卡掉落错误] 击杀数必须是非负安全整数：${kills}`);
  }

  const sequence = flattenBattleMonsterIds(stage);
  const sequenceLength = sequence.length;
  const normalizedCursor = startCursor % sequenceLength;
  if (kills === 0) {
    return { counts: {}, nextCursor: normalizedCursor };
  }

  const counts: Record<string, number> = {};
  const fullCycles = Math.floor(kills / sequenceLength);
  const remainder = kills % sequenceLength;

  if (fullCycles > 0) {
    for (const monsterId of sequence) {
      counts[monsterId] = (counts[monsterId] ?? 0) + fullCycles;
    }
  }

  for (let offset = 0; offset < remainder; offset++) {
    const monsterId = sequence[(normalizedCursor + offset) % sequenceLength]!;
    counts[monsterId] = (counts[monsterId] ?? 0) + 1;
  }

  return {
    counts,
    nextCursor: (normalizedCursor + remainder) % sequenceLength,
  };
}

/** 合并多组掉落，保持每个物品首次出现的稳定顺序。 */
export function mergeLootResults(...groups: readonly (readonly LootResult[])[]): LootResult[] {
  const counts = new Map<string, number>();
  for (const group of groups) {
    for (const drop of group) {
      if (!Number.isSafeInteger(drop.count) || drop.count <= 0) {
        throw new Error(`[掉落合并错误] ${drop.itemId} 数量必须是正安全整数：${drop.count}`);
      }
      const next = (counts.get(drop.itemId) ?? 0) + drop.count;
      if (!Number.isSafeInteger(next)) {
        throw new Error(`[掉落合并错误] ${drop.itemId} 合并后超出安全整数范围`);
      }
      counts.set(drop.itemId, next);
    }
  }
  return [...counts].map(([itemId, count]) => ({ itemId, count }));
}
