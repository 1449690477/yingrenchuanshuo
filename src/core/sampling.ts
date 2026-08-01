/**
 * 从固定顺序的总样本流中均匀抽取系统样本。
 *
 * 返回的下标严格递增并覆盖样本流末端；同一个 total/count 永远得到同一结果，
 * 适合数值门禁在保留完整词条分布的同时抽取成本更高的真实战斗子样本。
 */
export function stratifiedSampleIndices(total: number, count: number): readonly number[] {
  if (!Number.isSafeInteger(total) || total < 1) {
    throw new Error(`stratifiedSampleIndices: total 必须是正安全整数，收到 ${total}`);
  }
  if (!Number.isSafeInteger(count) || count < 1 || count > total) {
    throw new Error(`stratifiedSampleIndices: count 必须位于 1..${total}，收到 ${count}`);
  }

  const indices: number[] = [];
  for (let index = 0; index < total; index++) {
    if (
      Math.floor(((index + 1) * count) / total) !==
      Math.floor((index * count) / total)
    ) {
      indices.push(index);
    }
  }
  if (indices.length !== count) {
    throw new Error(`stratifiedSampleIndices: 预期 ${count} 个下标，实际 ${indices.length}`);
  }
  return indices;
}
