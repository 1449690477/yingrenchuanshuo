import type { MonsterType } from '@/core/types';

export type RegionMaterialTier = 'common' | 'fine' | 'rare';

/**
 * 区域材料的档位与怪物来源是一对一规则。
 *
 * 玩家只需学一次：普通怪供日常材料、精英供进阶材料、BOSS 供目标材料。
 * 这里作为掉落生成器的唯一映射，禁止各区域自行写另一套判断。
 */
export const REGION_MATERIAL_TIER_BY_MONSTER_TYPE: Readonly<
  Record<MonsterType, RegionMaterialTier>
> = {
  normal: 'common',
  elite: 'fine',
  boss: 'rare',
};

export function monsterTypeForRegionMaterialTier(
  tier: RegionMaterialTier,
): MonsterType {
  const matched = (Object.entries(REGION_MATERIAL_TIER_BY_MONSTER_TYPE) as [
    MonsterType,
    RegionMaterialTier,
  ][]).find(([, candidate]) => candidate === tier);
  if (!matched) {
    throw new Error(`[配置错误] 区域材料档位没有怪物来源：${tier}`);
  }
  return matched[0];
}

/**
 * 从章节声明中筛出当前怪物类型真正能够掉落的区域材料。
 *
 * `tierOf` 必须严格返回章节材料的档位；未知物品或把 epic 等系统材料混入
 * 章节材料表都会直接报错，不能用全量掉落掩盖配置错误。
 */
export function regionMaterialIdsForMonsterType(
  materialIds: readonly string[],
  monsterType: MonsterType,
  tierOf: (materialId: string) => RegionMaterialTier | undefined,
): string[] {
  const expectedTier = REGION_MATERIAL_TIER_BY_MONSTER_TYPE[monsterType];
  return materialIds.filter((materialId) => {
    const tier = tierOf(materialId);
    if (!tier) {
      throw new Error(`[配置错误] 章节材料未登记区域材料档位：${materialId}`);
    }
    return tier === expectedTier;
  });
}
