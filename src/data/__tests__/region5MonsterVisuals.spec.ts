import { describe, expect, it } from 'vitest';
import { REGION_5_MONSTER_MOTIONS } from '../region5';
import { REGION_5_MONSTER_VISUALS } from '../monsterVisuals';

describe('R5 怪物视觉原子注册表', () => {
  it('24 个稳定 ID 与动作身份逐一对应到独立运行时图', () => {
    expect(Object.keys(REGION_5_MONSTER_VISUALS).sort()).toEqual(
      Object.keys(REGION_5_MONSTER_MOTIONS).sort(),
    );
    expect(Object.keys(REGION_5_MONSTER_VISUALS)).toHaveLength(24);

    for (const [id, motion] of Object.entries(REGION_5_MONSTER_MOTIONS)) {
      expect(REGION_5_MONSTER_VISUALS[id]).toEqual({
        asset: `assets/monsters/r5/${id}.webp`,
        motion,
      });
    }
  });

  it('每只怪物使用自己的文件，不允许同名换色素材复用', () => {
    const assets = Object.values(REGION_5_MONSTER_VISUALS).map(
      (visual) => visual.asset,
    );
    expect(new Set(assets).size).toBe(24);
  });
});
