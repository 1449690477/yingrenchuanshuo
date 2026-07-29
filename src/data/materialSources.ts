import type { MonsterType } from '@/core/types';
import { REGION_34_MATERIALS } from './region34';
import { REGION_5_MATERIALS } from './region5';

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

/**
 * 所有区域稀有材料的真实 BOSS 保底。
 *
 * 前两区的材料早于独立区域规格表存在，因此在这里补登记；区域 3/4 则直接读取
 * 同源规格，避免写了 `pityCount` 却没有进入运行时。新增区域的 rare 材料如果
 * 没有登记，掉落表生成会直接报错，不能让 UI 继续显示一条假的保底承诺。
 */
export const REGION_MATERIAL_PITY_COUNT_BY_ID: Readonly<Record<string, number>> =
  Object.freeze({
    core_barrier: 12,
    crystal_altar: 12,
    ...Object.fromEntries(
      REGION_34_MATERIALS.flatMap((material) =>
        material.tier === 'rare' && material.pityCount !== undefined
          ? [[material.id, material.pityCount] as const]
          : [],
      ),
    ),
    ...Object.fromEntries(
      REGION_5_MATERIALS.flatMap((material) =>
        material.kind === 'material' &&
        material.tier === 'rare' &&
        material.pityCount !== undefined
          ? [[material.id, material.pityCount] as const]
          : [],
      ),
    ),
  });

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

/** rare 区域材料必须有正整数保底；缺配置时在启动生成掉落表阶段硬失败。 */
export function requireRegionMaterialPityCount(materialId: string): number {
  const pityCount = REGION_MATERIAL_PITY_COUNT_BY_ID[materialId];
  if (!Number.isInteger(pityCount) || (pityCount ?? 0) <= 0) {
    throw new Error(`[配置错误] 稀有区域材料缺少 BOSS 保底：${materialId}`);
  }
  return pityCount;
}
