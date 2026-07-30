import { describe, expect, it } from 'vitest';
import type { MonsterType } from '@/core/types';
import {
  monsterTypeForRegionMaterialTier,
  REGION_MATERIAL_PITY_COUNT_BY_ID,
  REGION_MATERIAL_TIER_BY_MONSTER_TYPE,
  regionMaterialIdsForMonsterType,
  requireRegionMaterialPityCount,
  type RegionMaterialTier,
} from '../materialSources';

const TIERS: Readonly<Record<string, RegionMaterialTier>> = {
  leaf: 'common',
  moss: 'common',
  silk: 'fine',
  core: 'rare',
};

describe('区域材料来源分层', () => {
  it('普通 / 精英 / BOSS 与 common / fine / rare 一一对应', () => {
    expect(REGION_MATERIAL_TIER_BY_MONSTER_TYPE).toEqual({
      normal: 'common',
      elite: 'fine',
      boss: 'rare',
    });
    expect(monsterTypeForRegionMaterialTier('common')).toBe('normal');
    expect(monsterTypeForRegionMaterialTier('fine')).toBe('elite');
    expect(monsterTypeForRegionMaterialTier('rare')).toBe('boss');
  });

  it.each([
    ['normal', ['leaf', 'moss']],
    ['elite', ['silk']],
    ['boss', ['core']],
  ] satisfies readonly [MonsterType, readonly string[]][])(
    '%s 表只取自己的材料档位',
    (monsterType, expected) => {
      expect(
        regionMaterialIdsForMonsterType(
          ['leaf', 'moss', 'silk', 'core'],
          monsterType,
          (id) => TIERS[id],
        ),
      ).toEqual(expected);
    },
  );

  it('章节引用未知材料时直接报错，不生成看似可用的空或全量掉落表', () => {
    expect(() =>
      regionMaterialIdsForMonsterType(['leaf', 'missing'], 'normal', (id) => TIERS[id]),
    ).toThrow('章节材料未登记区域材料档位：missing');
  });

  it('七个区域的 rare 材料都有同一口径的真实 BOSS 保底', () => {
    expect(REGION_MATERIAL_PITY_COUNT_BY_ID).toEqual({
      core_barrier: 12,
      crystal_altar: 12,
      egg_broodmother: 12,
      tear_eternal: 12,
      core_moltenheart: 12,
      stone_void: 12,
      eye_bloodmoon: 12,
    });
    for (const materialId of Object.keys(REGION_MATERIAL_PITY_COUNT_BY_ID)) {
      expect(requireRegionMaterialPityCount(materialId)).toBe(12);
    }
  });

  it('rare 材料没有登记保底时直接报错，不让 UI 产生假承诺', () => {
    expect(() => requireRegionMaterialPityCount('missing_rare')).toThrow(
      '稀有区域材料缺少 BOSS 保底：missing_rare',
    );
  });
});
