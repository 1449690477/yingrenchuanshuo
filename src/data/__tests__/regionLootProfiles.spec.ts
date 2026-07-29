import { describe, expect, it } from 'vitest';
import {
  LEGACY_REGION_LOOT_PROFILE,
  REGION_5_LOOT_PROFILE,
  regionLootProfile,
} from '../regionLootProfiles';

describe('按区域的掉落品质矩阵', () => {
  it('区域 1～4 保持现行矩阵，不提前开放传说', () => {
    for (const regionId of ['r1', 'r2', 'r3', 'r4']) {
      expect(regionLootProfile(regionId)).toBe(LEGACY_REGION_LOOT_PROFILE);
      expect(regionLootProfile(regionId).qualityWeights.boss.legendary).toBeUndefined();
    }
  });

  it('R5 严格按普通 rare、精英 rare/epic、BOSS epic/legendary 开放', () => {
    expect(regionLootProfile('r5')).toBe(REGION_5_LOOT_PROFILE);
    expect(Object.keys(REGION_5_LOOT_PROFILE.qualityWeights.normal)).toEqual(['rare']);
    expect(Object.keys(REGION_5_LOOT_PROFILE.qualityWeights.elite)).toEqual([
      'rare',
      'epic',
    ]);
    expect(Object.keys(REGION_5_LOOT_PROFILE.qualityWeights.boss)).toEqual([
      'epic',
      'legendary',
    ]);
    expect(REGION_5_LOOT_PROFILE.bossQualityPity).toEqual({
      quality: 'legendary',
      groupId: 'r5-legendary',
      pityCount: 240,
    });
  });

  it('R5 传说权重为正但低于史诗，峰值不会刷屏', () => {
    const boss = REGION_5_LOOT_PROFILE.qualityWeights.boss;
    expect(boss.legendary).toBeGreaterThan(0);
    expect(boss.legendary).toBeLessThan(boss.epic ?? 0);
  });
});
