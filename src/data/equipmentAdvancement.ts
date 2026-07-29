/**
 * 区域装备跨区升阶的数据规则。
 *
 * 核心层只负责原子计算；这里负责回答“哪件装备能升到哪里、消耗哪一区材料”。
 * 只允许显式登记的相邻区域路线，珍品、心虹、副本和套装装备不会被字符串
 * 猜测误纳入。
 */

import type { EquipmentDef, EquipSlot, Quality } from '@/core/types';
import type { EquipmentAdvancementRequirement } from '@/core/equipmentAdvancement';
import { getEquipment } from './equipment';
import { requireItem } from './items';

export interface EquipmentAdvancementRoute {
  sourceRegionId: string;
  targetRegionId: string;
  fineItemId: string;
  rareItemId: string;
}

export interface EquipmentAdvancementOption {
  source: EquipmentDef;
  target: EquipmentDef;
  requirement: EquipmentAdvancementRequirement;
  route: EquipmentAdvancementRoute;
}

export const EQUIPMENT_ADVANCEMENT_FINE_COUNT = 15;
export const EQUIPMENT_ADVANCEMENT_RARE_COUNT = 3;
export const EQUIPMENT_ADVANCEMENT_GOLD_PER_TARGET_LEVEL = 200;

export const EQUIPMENT_ADVANCEMENT_ROUTES: readonly EquipmentAdvancementRoute[] = [
  {
    sourceRegionId: 'r1',
    targetRegionId: 'r2',
    fineItemId: 'honey_bee',
    rareItemId: 'crystal_altar',
  },
  {
    sourceRegionId: 'r2',
    targetRegionId: 'r3',
    fineItemId: 'silk_spider',
    rareItemId: 'egg_broodmother',
  },
  {
    sourceRegionId: 'r3',
    targetRegionId: 'r4',
    fineItemId: 'rubbing_epitaph',
    rareItemId: 'tear_eternal',
  },
  {
    sourceRegionId: 'r4',
    targetRegionId: 'r5',
    fineItemId: 'ember_ritual',
    rareItemId: 'core_moltenheart',
  },
  {
    sourceRegionId: 'r5',
    targetRegionId: 'r6',
    fineItemId: 'wisp_shadow',
    rareItemId: 'stone_void',
  },
];

interface RegionalEquipmentIdentity {
  regionId: string;
  slot: EquipSlot;
  quality: Quality;
}

const REGIONAL_EQUIPMENT_ID =
  /^eq_(r\d+)_(weapon|head|body|necklace|bracelet|ring|belt|shoes)_(common|fine|rare|epic|legendary|mythic|prismatic|divine)$/;

function regionalEquipmentIdentity(definition: EquipmentDef): RegionalEquipmentIdentity | null {
  const match = definition.id.match(REGIONAL_EQUIPMENT_ID);
  if (!match) return null;
  const [, regionId, slot, quality] = match;
  if (!regionId || !slot || !quality) return null;
  return {
    regionId,
    slot: slot as EquipSlot,
    quality: quality as Quality,
  };
}

function requirementForRoute(
  route: EquipmentAdvancementRoute,
): EquipmentAdvancementRequirement {
  const fine = requireItem(route.fineItemId);
  const rare = requireItem(route.rareItemId);
  if (fine.kind !== 'material') {
    throw new Error(
      `[配置错误] 升阶 fine 消耗必须是材料：${route.fineItemId} 是 ${fine.kind}`,
    );
  }
  if (rare.kind !== 'material') {
    throw new Error(
      `[配置错误] 升阶 rare 消耗必须是材料：${route.rareItemId} 是 ${rare.kind}`,
    );
  }
  if (fine.tier !== 'fine') {
    throw new Error(
      `[配置错误] 升阶 fine 材料档位错误：${route.fineItemId} 是 ${fine.tier}`,
    );
  }
  if (rare.tier !== 'rare') {
    throw new Error(
      `[配置错误] 升阶 rare 材料档位错误：${route.rareItemId} 是 ${rare.tier}`,
    );
  }
  return {
    fineItemId: route.fineItemId,
    rareItemId: route.rareItemId,
    fineCount: EQUIPMENT_ADVANCEMENT_FINE_COUNT,
    rareCount: EQUIPMENT_ADVANCEMENT_RARE_COUNT,
    goldPerTargetLevel: EQUIPMENT_ADVANCEMENT_GOLD_PER_TARGET_LEVEL,
  };
}

/**
 * 返回来源装备的唯一下一阶；不存在同品质目标时明确返回 undefined。
 *
 * 例如 r1 common 在 r2 没有 common 定义，因此不能偷偷升成 fine。
 */
export function equipmentAdvancementOption(
  sourceDefinition: EquipmentDef,
): EquipmentAdvancementOption | undefined {
  const identity = regionalEquipmentIdentity(sourceDefinition);
  if (!identity) return undefined;

  const route = EQUIPMENT_ADVANCEMENT_ROUTES.find(
    (candidate) => candidate.sourceRegionId === identity.regionId,
  );
  if (!route) return undefined;

  const targetId = `eq_${route.targetRegionId}_${identity.slot}_${identity.quality}`;
  const target = getEquipment(targetId);
  // 相邻区域没有同品质定义是合法的“不可升阶”，不是换品质的理由。
  if (!target) return undefined;

  if (
    target.slot !== sourceDefinition.slot ||
    target.quality !== sourceDefinition.quality ||
    target.level <= sourceDefinition.level
  ) {
    throw new Error(
      `[配置错误] 升阶目标不满足同部位、同品质、升等级：${sourceDefinition.id} → ${target.id}`,
    );
  }

  return {
    source: sourceDefinition,
    target,
    requirement: requirementForRoute(route),
    route,
  };
}
