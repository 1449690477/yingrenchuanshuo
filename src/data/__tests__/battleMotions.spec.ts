import { describe, expect, it } from 'vitest';
import { CLASS_IDS } from '@/core/types';
import {
  basicBattleAction,
  IMPACT_FEEDBACK,
  impactTierFor,
  requireImpactFeedback,
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

describe('impactTierFor', () => {
  it('玩家挨打永远是 light —— 挂机常态不能喧宾夺主', () => {
    expect(impactTierFor({ kind: 'monster-attack', crit: false })).toBe('light');
    // 即便怪物这一下被标成暴击，也不给玩家镜头反馈
    expect(impactTierFor({ kind: 'monster-attack', crit: true })).toBe('light');
  });

  it('普攻按是否暴击分成 light / critical', () => {
    expect(impactTierFor({ kind: 'player-attack', crit: false })).toBe('light');
    expect(impactTierFor({ kind: 'player-attack', crit: true })).toBe('critical');
  });

  it('技能按是否暴击分成 heavy / ultimate', () => {
    expect(impactTierFor({ kind: 'player-skill', crit: false })).toBe('heavy');
    expect(impactTierFor({ kind: 'player-skill', crit: true })).toBe('ultimate');
  });
});

describe('IMPACT_FEEDBACK', () => {
  it('普攻绝不震镜头 —— 挂机十分钟会晕', () => {
    expect(IMPACT_FEEDBACK.light.shakePx).toBe(0);
    expect(IMPACT_FEEDBACK.light.hitstopMs).toBe(0);
  });

  it('强度逐档递增，越稀有的一击反馈越强', () => {
    const tiers = ['light', 'heavy', 'critical', 'ultimate'] as const;
    for (let i = 1; i < tiers.length; i++) {
      const prev = IMPACT_FEEDBACK[tiers[i - 1]!];
      const cur = IMPACT_FEEDBACK[tiers[i]!];
      expect(cur.hitstopMs).toBeGreaterThanOrEqual(prev.hitstopMs);
      expect(cur.shakePx).toBeGreaterThanOrEqual(prev.shakePx);
      expect(cur.flashAlpha).toBeGreaterThanOrEqual(prev.flashAlpha);
      expect(cur.damageScale).toBeGreaterThanOrEqual(prev.damageScale);
    }
  });

  it('顿帧不能长到卡住挂机节奏', () => {
    for (const tier of Object.values(IMPACT_FEEDBACK)) {
      expect(tier.hitstopMs).toBeLessThanOrEqual(150);
      expect(tier.flashAlpha).toBeLessThanOrEqual(1);
    }
  });

  it('未登记的档位直接报错', () => {
    expect(() => requireImpactFeedback('nope' as never)).toThrow(/打击反馈/);
  });
});

describe('四职业受击性格', () => {
  it('每个职业都有各自的受击风格，不共用同一套', () => {
    const styles = CLASS_IDS.map((id) => CLASS_BATTLE_MOTIONS[id].reactStyle);
    expect(new Set(styles).size).toBe(CLASS_IDS.length);
  });

  it('越脆的职业硬直越久：魔女 > 剑姬', () => {
    expect(CLASS_BATTLE_MOTIONS.witch.reactMs).toBeGreaterThan(
      CLASS_BATTLE_MOTIONS.swordsman.reactMs,
    );
  });

  it('受击与胜利时长都在合理区间', () => {
    for (const id of CLASS_IDS) {
      const motion = CLASS_BATTLE_MOTIONS[id];
      expect(motion.reactMs).toBeGreaterThanOrEqual(200);
      expect(motion.reactMs).toBeLessThanOrEqual(500);
      expect(motion.victoryMs).toBeGreaterThanOrEqual(1000);
    }
  });
});
