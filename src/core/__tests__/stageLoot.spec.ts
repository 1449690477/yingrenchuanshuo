import { describe, expect, it } from 'vitest';
import type { Stage } from '../types';
import { countStageMonsterKills, mergeLootResults } from '../stageLoot';

const stage: Pick<Stage, 'id' | 'waves'> = {
  id: 'stage_loot_test',
  waves: [
    {
      monsters: [
        { id: 'slime', count: 2 },
        { id: 'bee', count: 1 },
      ],
    },
    { monsters: [{ id: 'elite', count: 1 }] },
    { monsters: [{ id: 'boss', count: 1 }] },
  ],
};

describe('关卡循环击杀分布', () => {
  it('完整一轮按波次和数量聚合普通怪、精英与 BOSS', () => {
    expect(countStageMonsterKills(stage, 0, 5)).toEqual({
      counts: {
        slime: 2,
        bee: 1,
        elite: 1,
        boss: 1,
      },
      nextCursor: 0,
    });
  });

  it('支持从循环中段开始并跨越多轮', () => {
    expect(countStageMonsterKills(stage, 2, 8)).toEqual({
      counts: {
        slime: 2,
        bee: 2,
        elite: 2,
        boss: 2,
      },
      nextCursor: 0,
    });
  });

  it('零击杀不产生记录，但会规范化旧存档的大游标', () => {
    expect(countStageMonsterKills(stage, 12, 0)).toEqual({
      counts: {},
      nextCursor: 2,
    });
  });

  it('大量离线击杀按完整循环乘算且总数不丢失', () => {
    const result = countStageMonsterKills(stage, 3, 1_000_003);

    expect(result).toEqual({
      counts: {
        slime: 400_001,
        bee: 200_000,
        elite: 200_001,
        boss: 200_001,
      },
      nextCursor: 1,
    });
    expect(Object.values(result.counts).reduce((sum, count) => sum + count, 0)).toBe(1_000_003);
  });

  it('不会修改关卡波次配置', () => {
    const before = structuredClone(stage);
    countStageMonsterKills(stage, 4, 12);
    expect(stage).toEqual(before);
  });

  it('拒绝非法游标、击杀数和空波次', () => {
    expect(() => countStageMonsterKills(stage, -1, 1)).toThrow('起始游标');
    expect(() => countStageMonsterKills(stage, 0.5, 1)).toThrow('起始游标');
    expect(() => countStageMonsterKills(stage, 0, -1)).toThrow('击杀数');
    expect(() => countStageMonsterKills(stage, 0, 1.5)).toThrow('击杀数');
    expect(() => countStageMonsterKills({ id: 'empty', waves: [] }, 0, 1)).toThrow(
      '关卡没有战斗波次',
    );
  });
});

describe('掉落结果合并', () => {
  it('合并同类项并保持首次出现顺序', () => {
    const normal = [
      { itemId: 'stone', count: 3 },
      { itemId: 'petal', count: 2 },
    ];
    const special = [
      { itemId: 'ore', count: 1 },
      { itemId: 'stone', count: 5 },
    ];

    expect(mergeLootResults(normal, special)).toEqual([
      { itemId: 'stone', count: 8 },
      { itemId: 'petal', count: 2 },
      { itemId: 'ore', count: 1 },
    ]);
    expect(normal[0]?.count).toBe(3);
    expect(special[1]?.count).toBe(5);
  });

  it('拒绝非正整数和溢出的掉落数量', () => {
    expect(() => mergeLootResults([{ itemId: 'ore', count: 0 }])).toThrow('正安全整数');
    expect(() =>
      mergeLootResults(
        [{ itemId: 'ore', count: Number.MAX_SAFE_INTEGER }],
        [{ itemId: 'ore', count: 1 }],
      ),
    ).toThrow('超出安全整数范围');
  });
});
