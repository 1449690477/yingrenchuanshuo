import { describe, expect, it } from 'vitest';
import { REGION_7_MONSTER_MOTIONS } from '../region7';
import { REGION_7_MONSTER_VISUALS } from '../monsterVisuals';

describe('R7 怪物视觉原子注册表', () => {
  it('24 个稳定 ID 逐一对应独立运行时图与动作', () => {
    expect(Object.keys(REGION_7_MONSTER_VISUALS).sort()).toEqual(
      Object.keys(REGION_7_MONSTER_MOTIONS).sort(),
    );
    expect(Object.keys(REGION_7_MONSTER_VISUALS)).toHaveLength(24);
    for (const [id, motion] of Object.entries(REGION_7_MONSTER_MOTIONS)) {
      expect(REGION_7_MONSTER_VISUALS[id]).toEqual({
        asset: `assets/monsters/r7/${id}.webp`,
        motion,
      });
    }
  });

  it('血月怪物不继承幽影石像的苏醒身份', () => {
    expect(Object.values(REGION_7_MONSTER_VISUALS).some((visual) => visual.statueAwaken)).toBe(
      false,
    );
  });
});
