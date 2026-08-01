import { describe, expect, it } from 'vitest';
import { stratifiedSampleIndices } from '../sampling';

describe('stratifiedSampleIndices', () => {
  it('词条战斗门禁从 2000 流中恰取 128 个，并均匀覆盖到末端', () => {
    const indices = stratifiedSampleIndices(2_000, 128);
    const gaps = indices.slice(1).map((index, position) => index - indices[position]!);

    expect(indices).toHaveLength(128);
    expect(new Set(indices).size).toBe(128);
    expect(indices.at(-1)).toBe(1_999);
    expect(Math.max(...gaps)).toBeLessThanOrEqual(16);
  });

  it('拒绝非法样本配置', () => {
    expect(() => stratifiedSampleIndices(0, 1)).toThrow();
    expect(() => stratifiedSampleIndices(10, 0)).toThrow();
    expect(() => stratifiedSampleIndices(10, 11)).toThrow();
  });
});
