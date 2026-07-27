import { describe, expect, it } from 'vitest';
import {
  advanceAttackPulse,
  battleMonsterIdAt,
  flattenBattleMonsterIds,
} from '../battleVisual';
import type { Stage, Wave } from '../types';

function visualStage(id: string, waves: Wave[]): Pick<Stage, 'id' | 'waves'> {
  return { id, waves };
}

describe('flattenBattleMonsterIds', () => {
  it('按普通怪的波次、配置顺序与数量展开', () => {
    const stage = visualStage('stage_normal', [
      {
        monsters: [
          { id: 'slime', count: 2 },
          { id: 'rabbit', count: 1 },
        ],
      },
      { monsters: [{ id: 'spirit', count: 2 }] },
    ]);

    expect(flattenBattleMonsterIds(stage)).toEqual([
      'slime',
      'slime',
      'rabbit',
      'spirit',
      'spirit',
    ]);
  });

  it('精英怪保持在所属波次的正确位置', () => {
    const stage = visualStage('stage_elite', [
      { monsters: [{ id: 'normal', count: 2 }] },
      { monsters: [{ id: 'elite_guard', count: 1 }] },
    ]);

    expect(flattenBattleMonsterIds(stage)).toEqual(['normal', 'normal', 'elite_guard']);
  });

  it('BOSS 保持在全部前置波次之后', () => {
    const stage = visualStage('stage_boss', [
      { monsters: [{ id: 'normal_a', count: 1 }] },
      { monsters: [{ id: 'elite_guard', count: 1 }] },
      { monsters: [{ id: 'boss_queen', count: 1 }] },
    ]);

    expect(flattenBattleMonsterIds(stage)).toEqual(['normal_a', 'elite_guard', 'boss_queen']);
  });

  it('拒绝没有波次或含空波次的非法配置', () => {
    expect(() => flattenBattleMonsterIds(visualStage('stage_no_waves', []))).toThrow(
      '关卡没有战斗波次',
    );
    expect(() =>
      flattenBattleMonsterIds(visualStage('stage_empty_wave', [{ monsters: [] }])),
    ).toThrow('关卡存在空波次');
  });
});

describe('battleMonsterIdAt', () => {
  const stage = visualStage('stage_loop', [
    {
      monsters: [
        { id: 'a', count: 2 },
        { id: 'b', count: 1 },
      ],
    },
  ]);

  it('游标超过队列末尾后从头循环', () => {
    expect(battleMonsterIdAt(stage, 0)).toBe('a');
    expect(battleMonsterIdAt(stage, 1)).toBe('a');
    expect(battleMonsterIdAt(stage, 2)).toBe('b');
    expect(battleMonsterIdAt(stage, 3)).toBe('a');
    expect(battleMonsterIdAt(stage, 5)).toBe('b');
  });

  it('拒绝负数或非整数游标', () => {
    expect(() => battleMonsterIdAt(stage, -1)).toThrow('怪物游标必须是非负整数');
    expect(() => battleMonsterIdAt(stage, 0.5)).toThrow('怪物游标必须是非负整数');
  });
});

describe('advanceAttackPulse', () => {
  it('按攻速跨帧累计，并在到达出手时间时触发', () => {
    const first = advanceAttackPulse(0.4, 0, 1);
    expect(first).toEqual({ hits: 0, carrySec: 0.4 });

    const second = advanceAttackPulse(0.6, first.carrySec, 1);
    expect(second.hits).toBe(1);
    expect(second.carrySec).toBeCloseTo(0);
  });

  it('掉帧时合并返回多次攻击并保留余量', () => {
    const result = advanceAttackPulse(1.25, 0, 2);
    expect(result.hits).toBe(2);
    expect(result.carrySec).toBeCloseTo(0.25);
  });

  it('拒绝负时间和无效攻速', () => {
    expect(() => advanceAttackPulse(-0.1, 0, 1)).toThrow('帧时长');
    expect(() => advanceAttackPulse(0.1, 0, 0)).toThrow('攻速');
  });
});
