import { describe, expect, it } from 'vitest';
import { CLASS_IDS } from '@/core/types';
import {
  basicBattleAction,
  CLASS_BATTLE_MOTIONS,
  latestSourceBeat,
  MONSTER_MOTION_TIMINGS,
  monsterActionFor,
  shouldPlayMonsterSpawn,
} from '../battleMotions';
import { MONSTERS } from '../monsters';
import { MONSTER_VISUALS, requireMonsterVisual } from '../monsterVisuals';

describe('职业挂机动作序列', () => {
  it('四职业都有三个稳定轮换且不完全相同的普攻姿势', () => {
    const signatures = CLASS_IDS.map((classId) => {
      const sequence = CLASS_BATTLE_MOTIONS[classId].basicSequence;
      expect(sequence).toHaveLength(3);
      expect(new Set(sequence).size).toBe(3);
      expect(sequence).not.toContain('counter');
      return sequence.join('|');
    });

    expect(new Set(signatures).size).toBe(CLASS_IDS.length);
  });

  it('按拍子序号循环，结果可复现', () => {
    expect([1, 2, 3, 4].map((seq) => basicBattleAction('swordsman', seq))).toEqual([
      'attack',
      'dash',
      'spin',
      'attack',
    ]);
    expect(basicBattleAction('catkin', 17)).toBe(basicBattleAction('catkin', 17));
  });

  it.each([0, -1, 1.5, Number.NaN])('非法拍子序号 %s 直接报错', (seq) => {
    expect(() => basicBattleAction('witch', seq)).toThrow(/正整数/);
  });

  it('延迟到达的旧技能命中不会让人物动作倒退', () => {
    const latest = latestSourceBeat(
      [
        { seq: 201, sourceSeq: 2, action: 'new' },
        { seq: 102, sourceSeq: 1, action: 'old-delayed-hit' },
      ],
      2,
    );
    expect(latest?.action).toBe('new');
    expect(latestSourceBeat([{ seq: 102, sourceSeq: 1, action: 'old-delayed-hit' }], 2)).toBeNull();
  });
});

describe('怪物动作模组', () => {
  it('当前全部怪物都有正式贴图和显式动作类型', () => {
    expect(Object.keys(MONSTER_VISUALS).sort()).toEqual(Object.keys(MONSTERS).sort());

    for (const monster of Object.values(MONSTERS)) {
      const visual = requireMonsterVisual(monster.id);
      expect(visual.asset).toBe(monster.sprite);
      const timing = MONSTER_MOTION_TIMINGS[visual.motion];
      expect(timing).toBeDefined();
      expect(timing.impactMs).toBeGreaterThan(0);
      expect(timing.impactMs).toBeLessThan(timing.attackMs);
    }
  });

  it('精英和 BOSS 使用有重量感的 guard / royal 模组', () => {
    for (const monster of Object.values(MONSTERS)) {
      if (monster.type === 'elite') {
        expect(['guard', 'royal']).toContain(requireMonsterVisual(monster.id).motion);
      }
      if (monster.type === 'boss') {
        expect(requireMonsterVisual(monster.id).motion).toBe('royal');
      }
    }
  });

  it('缺失视觉配置时直接报错，不用文字占位掩盖资源问题', () => {
    expect(() => requireMonsterVisual('mon_missing')).toThrow(/未登记视觉资源/);
  });

  it('击倒优先于攻击和受击，尸体不会继续反击', () => {
    expect(monsterActionFor({ defeated: true, attacking: true, hit: true })).toBe('defeat');
    expect(monsterActionFor({ defeated: false, attacking: true, hit: true })).toBe('attack');
    expect(monsterActionFor({ defeated: false, attacking: false, hit: true })).toBe('hit');
    expect(monsterActionFor({ defeated: false, attacking: false, hit: false })).toBe('idle');
  });

  it('击倒定格期间不把旧目标误当成新怪入场', () => {
    expect(
      shouldPlayMonsterSpawn(
        { monsterId: 'new-species', pulseId: 8 },
        { monsterId: 'old-species', pulseId: 0 },
      ),
    ).toBe(false);
    expect(
      shouldPlayMonsterSpawn(
        { monsterId: 'new-species', pulseId: 0 },
        { monsterId: 'old-species', pulseId: 8 },
      ),
    ).toBe(true);
    expect(
      shouldPlayMonsterSpawn(
        { monsterId: 'new-species', pulseId: 0 },
        { monsterId: 'old-species', pulseId: 0 },
      ),
    ).toBe(true);
  });
});
