import { describe, expect, it } from 'vitest';
import {
  advanceBattleVisualCursor,
  battleMonsterIdAt,
  battleVitalsAtProgress,
  flattenBattleMonsterIds,
} from '../battleVisual';
import { combatPressure } from '../combat';
import { makeMonster, makePlayer } from '../progression';
import type { Combatant, Stage, Stats, Wave } from '../types';

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

describe('advanceBattleVisualCursor', () => {
  const stage = visualStage('stage_batch', [
    {
      monsters: [
        { id: 'a', count: 2 },
        { id: 'b', count: 1 },
      ],
    },
  ]);

  it('单次击杀把演出绑定被击杀怪，并推进到下一只', () => {
    expect(advanceBattleVisualCursor(stage, 1, 1)).toEqual({
      defeatedTargetId: 'a',
      nextCursor: 2,
    });
  });

  it('单 tick 多杀绑定最后倒下的目标，并正确跨轮循环', () => {
    expect(advanceBattleVisualCursor(stage, 2, 5)).toEqual({
      defeatedTargetId: 'a',
      nextCursor: 1,
    });
  });

  it('拒绝非法游标和击杀数', () => {
    expect(() => advanceBattleVisualCursor(stage, -1, 1)).toThrow('怪物游标');
    expect(() => advanceBattleVisualCursor(stage, 0, 0)).toThrow('击杀数');
    expect(() => advanceBattleVisualCursor(stage, 0, 1.5)).toThrow('击杀数');
  });
});

const stats = (overrides: Partial<Stats> = {}): Stats => ({
  atk: 1200,
  def: 500,
  hp: 20_000,
  acc: 180,
  eva: 30,
  critRate: 10,
  critDmg: 50,
  spd: 1.2,
  ...overrides,
});

function visualPlayer(): Combatant {
  return makePlayer('小樱', 30, stats());
}

function visualMonster(id: string, level: number, type: 'normal' | 'boss'): Combatant {
  return makeMonster({
    id,
    name: id,
    level,
    type,
    element: 'none',
    lootTableId: 'loot_test',
    sprite: '',
  });
}

describe('battleVitalsAtProgress', () => {
  it('进度 0 / 0.5 / 1 分别显示满血、半血和怪物归零', () => {
    const player = visualPlayer();
    const monster = visualMonster('normal', 20, 'normal');

    const start = battleVitalsAtProgress(player, monster, 0);
    const middle = battleVitalsAtProgress(player, monster, 0.5);
    const end = battleVitalsAtProgress(player, monster, 1);
    const fullFightIncoming = combatPressure(player, monster).damagePerFight;

    expect(start).toEqual({
      player: { currentHp: player.stats.hp, maxHp: player.stats.hp },
      monster: { currentHp: monster.stats.hp, maxHp: monster.stats.hp },
    });
    expect(middle.monster.currentHp).toBe(Math.ceil(monster.stats.hp / 2));
    expect(middle.player.currentHp).toBeLessThan(start.player.currentHp);
    expect(end.monster.currentHp).toBe(0);
    expect(end.player.currentHp).toBe(Math.max(0, Math.ceil(player.stats.hp - fullFightIncoming)));
  });

  it('八件套技能共鸣缩短真实 TTK 后，血条复用同一倍率并显示更少承伤', () => {
    const player = visualPlayer();
    const monster = makePlayer(
      '套装回归目标',
      30,
      stats({ atk: 800, def: 0, hp: 12_000, eva: 0, critRate: 0, spd: 1 }),
    );
    const baseMultiplier = 1;
    const eightPieceSkillBonus = 0.18;

    const withoutSet = battleVitalsAtProgress(player, monster, 1, baseMultiplier);
    const withSet = battleVitalsAtProgress(
      player,
      monster,
      1,
      baseMultiplier + eightPieceSkillBonus,
    );

    expect(withSet.player.currentHp).toBeGreaterThan(withoutSet.player.currentHp);
    expect(withSet.monster).toEqual(withoutSet.monster);
  });

  it('遭遇推进时玩家生命单调不增且始终位于合法范围', () => {
    const player = visualPlayer();
    player.stats.hp = 20_000.75;
    player.currentHp = player.stats.hp;
    const monster = visualMonster('normal', 24, 'normal');
    const values = [0, 0.25, 0.5, 0.75, 1].map(
      (progress) => battleVitalsAtProgress(player, monster, progress).player.currentHp,
    );

    expect(values.every((value) => value >= 0 && value <= player.stats.hp)).toBe(true);
    expect(values).toEqual([...values].sort((a, b) => b - a));
  });

  it('普通怪与 BOSS 各用自身最大生命，切回原目标不会串血', () => {
    const player = visualPlayer();
    const normal = visualMonster('normal', 20, 'normal');
    const boss = visualMonster('boss', 20, 'boss');

    const normalBefore = battleVitalsAtProgress(player, normal, 0.5);
    const bossVitals = battleVitalsAtProgress(player, boss, 0.5);
    const normalAfter = battleVitalsAtProgress(player, normal, 0.5);

    expect(bossVitals.monster.maxHp).not.toBe(normalBefore.monster.maxHp);
    expect(bossVitals.monster.currentHp).toBe(Math.ceil(bossVitals.monster.maxHp / 2));
    expect(normalAfter).toEqual(normalBefore);
  });

  it('不修改传入的战斗单位', () => {
    const player = visualPlayer();
    const monster = visualMonster('normal', 20, 'normal');
    const beforePlayer = structuredClone(player);
    const beforeMonster = structuredClone(monster);

    battleVitalsAtProgress(player, monster, 0.75, 1.4);

    expect(player).toEqual(beforePlayer);
    expect(monster).toEqual(beforeMonster);
  });

  it.each([Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY, -0.01, 1.01])(
    '拒绝非法进度 %s',
    (progress) => {
      expect(() =>
        battleVitalsAtProgress(visualPlayer(), visualMonster('normal', 20, 'normal'), progress),
      ).toThrow('遭遇进度');
    },
  );

  it('拒绝非法生命和技能倍率，不用 UI 兜底掩盖配置错误', () => {
    const player = visualPlayer();
    const monster = visualMonster('normal', 20, 'normal');
    player.stats.hp = 0;
    expect(() => battleVitalsAtProgress(player, monster, 0)).toThrow('玩家最大生命');

    const validPlayer = visualPlayer();
    expect(() => battleVitalsAtProgress(validPlayer, monster, 0, 0)).toThrow('技能倍率');
  });
});

describe('展示用生命值必须是整数', () => {
  it('浮点上限不会漏到血条上 —— 满血时不该显示 1355 / 1355.1', () => {
    const player = makePlayer('小樱', 30, { ...stats(), hp: 1355.1 });
    const monster = visualMonster('normal', 20, 'normal');
    monster.stats.hp = 60.4;
    const vitals = battleVitalsAtProgress(player, monster, 0);
    expect(Number.isInteger(vitals.player.maxHp)).toBe(true);
    expect(Number.isInteger(vitals.monster.maxHp)).toBe(true);
    // progress 为 0 时玩家应当是满血，两个数字必须完全相同
    expect(vitals.player.currentHp).toBe(vitals.player.maxHp);
  });

  it('四个读数全部是整数，任意进度都不出现小数', () => {
    const player = makePlayer('小樱', 30, { ...stats(), hp: 987.65 });
    const monster = visualMonster('normal', 22, 'normal');
    monster.stats.hp = 333.33;
    for (const progress of [0, 0.17, 0.5, 0.83, 1]) {
      const v = battleVitalsAtProgress(player, monster, progress);
      for (const n of [v.player.currentHp, v.player.maxHp, v.monster.currentHp, v.monster.maxHp]) {
        expect(Number.isInteger(n)).toBe(true);
      }
    }
  });

  it('极小的上限至少保留 1，血条不会除以零', () => {
    const player = makePlayer('小樱', 30, { ...stats(), hp: 0.4 });
    const monster = visualMonster('normal', 5, 'normal');
    monster.stats.hp = 0.2;
    const v = battleVitalsAtProgress(player, monster, 0.5);
    expect(v.player.maxHp).toBeGreaterThanOrEqual(1);
    expect(v.monster.maxHp).toBeGreaterThanOrEqual(1);
  });
});
