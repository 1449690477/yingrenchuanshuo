import { describe, expect, it } from 'vitest';
import { REGION_6_MONSTER_MOTIONS, REGION_6_STATUE_MONSTER_IDS } from '../region6';
import { REGION_6_MONSTER_VISUALS } from '../monsterVisuals';

describe('R6 怪物视觉原子注册表', () => {
  it('24 个稳定 ID 逐一对应独立运行时图与动作', () => {
    expect(Object.keys(REGION_6_MONSTER_VISUALS).sort()).toEqual(
      Object.keys(REGION_6_MONSTER_MOTIONS).sort(),
    );
    expect(Object.keys(REGION_6_MONSTER_VISUALS)).toHaveLength(24);
    for (const [id, motion] of Object.entries(REGION_6_MONSTER_MOTIONS)) {
      expect(REGION_6_MONSTER_VISUALS[id]).toEqual({
        asset: `assets/monsters/r6/${id}.webp`,
        motion,
        ...(REGION_6_STATUE_MONSTER_IDS.includes(id as never) ? { statueAwaken: true } : {}),
      });
    }
  });

  it('石像苏醒标记只属于规划中的石材怪物', () => {
    expect(
      Object.entries(REGION_6_MONSTER_VISUALS)
        .filter(([, visual]) => visual.statueAwaken)
        .map(([id]) => id),
    ).toEqual(REGION_6_STATUE_MONSTER_IDS);
  });
});
