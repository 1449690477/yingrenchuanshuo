/**
 * 套装通用碎片自选合成配方注册表。
 *
 * 配方必须与真实物品、套装和装备定义同时存在后才能注册；不能先放一条指向
 * 未落地 R5 装备的假配置。核心层只消费通过本注册器校验的通用契约。
 */

import type { EquipmentSetDefinition } from '@/core/equipmentSets';
import type { EquipmentSetCraftingRecipe } from '@/core/equipmentSetCrafting';
import type { EquipmentDef, EquipSlot } from '@/core/types';
import { getEquipment } from './equipment';
import { getEquipmentSet } from './equipmentSets';
import { getItem, type ItemDef } from './items';
import {
  REGION_5_FRAGMENT_COST,
  REGION_5_FRAGMENT_ID,
  REGION_5_SET_ID,
  REGION_5_SET_SLOTS,
  region5SetEquipmentId,
} from './region5';
import {
  REGION_6_FRAGMENT_COST,
  REGION_6_FRAGMENT_ID,
  REGION_6_SET_ID,
  REGION_6_SET_SLOTS,
  region6SetEquipmentId,
} from './region6';
import {
  REGION_7_FRAGMENT_COST,
  REGION_7_FRAGMENT_ID,
  REGION_7_SET_ID,
  REGION_7_SET_SLOTS,
  region7SetEquipmentId,
} from './region7';

const EQUIP_SLOTS = new Set<string>([
  'weapon',
  'head',
  'body',
  'necklace',
  'bracelet',
  'ring',
  'belt',
  'shoes',
]);

export interface EquipmentSetCraftingRegistryDependencies {
  equipmentOf: (defId: string) => EquipmentDef | undefined;
  itemOf: (itemId: string) => ItemDef | undefined;
  setOf: (setId: string) => EquipmentSetDefinition | undefined;
}

const DEFAULT_DEPENDENCIES: EquipmentSetCraftingRegistryDependencies = {
  equipmentOf: getEquipment,
  itemOf: getItem,
  setOf: getEquipmentSet,
};

function assertNonEmpty(value: string, label: string): void {
  if (value.trim().length === 0) {
    throw new Error(`[配置错误] ${label}不能为空`);
  }
}

function cloneAndValidateRecipe(
  recipe: EquipmentSetCraftingRecipe,
  dependencies: EquipmentSetCraftingRegistryDependencies,
): EquipmentSetCraftingRecipe {
  assertNonEmpty(recipe.id, '套装合成配方 ID');
  assertNonEmpty(recipe.setId, `配方 ${recipe.id} 的套装 ID`);
  assertNonEmpty(recipe.fragmentItemId, `配方 ${recipe.id} 的碎片 ID`);
  if (!Number.isSafeInteger(recipe.fragmentCount) || recipe.fragmentCount <= 0) {
    throw new Error(
      `[配置错误] 配方 ${recipe.id} 的碎片数量必须是正安全整数：${recipe.fragmentCount}`,
    );
  }

  const setDefinition = dependencies.setOf(recipe.setId);
  if (!setDefinition) {
    throw new Error(`[配置错误] 配方 ${recipe.id} 引用了不存在的套装：${recipe.setId}`);
  }
  if (setDefinition.id !== recipe.setId) {
    throw new Error(
      `[配置错误] 配方 ${recipe.id} 的套装查询结果错配：${recipe.setId} !== ${setDefinition.id}`,
    );
  }

  const fragment = dependencies.itemOf(recipe.fragmentItemId);
  if (!fragment) {
    throw new Error(
      `[配置错误] 配方 ${recipe.id} 引用了不存在的碎片：${recipe.fragmentItemId}`,
    );
  }
  if (fragment.kind !== 'fragment') {
    throw new Error(
      `[配置错误] 配方 ${recipe.id} 的消耗必须是 fragment：${fragment.id} 是 ${fragment.kind}`,
    );
  }

  const entries = Object.entries(recipe.targetDefIds);
  if (entries.length === 0) {
    throw new Error(`[配置错误] 配方 ${recipe.id} 没有任何可合成部位`);
  }

  const targetDefIds: Partial<Record<EquipSlot, string>> = {};
  const seenDefinitions = new Set<string>();
  for (const [rawSlot, targetDefId] of entries) {
    if (!EQUIP_SLOTS.has(rawSlot)) {
      throw new Error(`[配置错误] 配方 ${recipe.id} 含非法装备槽：${rawSlot}`);
    }
    if (typeof targetDefId !== 'string' || targetDefId.trim().length === 0) {
      throw new Error(`[配置错误] 配方 ${recipe.id} 的 ${rawSlot} 目标定义不能为空`);
    }
    if (seenDefinitions.has(targetDefId)) {
      throw new Error(`[配置错误] 配方 ${recipe.id} 重复引用目标装备：${targetDefId}`);
    }
    seenDefinitions.add(targetDefId);

    const slot = rawSlot as EquipSlot;
    const target = dependencies.equipmentOf(targetDefId);
    if (!target) {
      throw new Error(`[配置错误] 配方 ${recipe.id} 的目标装备不存在：${targetDefId}`);
    }
    if (target.slot !== slot) {
      throw new Error(
        `[配置错误] 配方 ${recipe.id} 的 ${slot} 目标实际是 ${target.slot}：${target.id}`,
      );
    }
    if (target.setId !== recipe.setId) {
      throw new Error(
        `[配置错误] 配方 ${recipe.id} 的目标装备不属于套装 ${recipe.setId}：${target.id}`,
      );
    }
    targetDefIds[slot] = targetDefId;
  }

  return Object.freeze({
    id: recipe.id,
    setId: recipe.setId,
    fragmentItemId: recipe.fragmentItemId,
    fragmentCount: recipe.fragmentCount,
    targetDefIds: Object.freeze(targetDefIds),
  });
}

/**
 * 创建只读注册表。
 *
 * 同一配方 ID 或同一套装出现两次都属于配置冲突，必须在启动/测试时直接失败，
 * 不能依赖对象展开的“后者覆盖前者”掩盖错误。
 */
export function createEquipmentSetCraftingRegistry(
  recipes: readonly EquipmentSetCraftingRecipe[],
  dependencies: EquipmentSetCraftingRegistryDependencies = DEFAULT_DEPENDENCIES,
): Readonly<Record<string, EquipmentSetCraftingRecipe>> {
  const registry: Record<string, EquipmentSetCraftingRecipe> = {};
  const seenSetIds = new Set<string>();

  for (const source of recipes) {
    if (Object.prototype.hasOwnProperty.call(registry, source.id)) {
      throw new Error(`[配置错误] 套装合成配方 ID 重复：${source.id}`);
    }
    if (seenSetIds.has(source.setId)) {
      throw new Error(`[配置错误] 套装合成重复定义套装：${source.setId}`);
    }
    const recipe = cloneAndValidateRecipe(source, dependencies);
    registry[recipe.id] = recipe;
    seenSetIds.add(recipe.setId);
  }

  return Object.freeze(registry);
}

const EQUIPMENT_SET_CRAFTING_RECIPE_LIST: readonly EquipmentSetCraftingRecipe[] = [
  {
    id: 'craft_set_crimson',
    setId: REGION_5_SET_ID,
    fragmentItemId: REGION_5_FRAGMENT_ID,
    fragmentCount: REGION_5_FRAGMENT_COST,
    targetDefIds: Object.fromEntries(
      REGION_5_SET_SLOTS.map((slot) => [slot, region5SetEquipmentId(slot)]),
    ),
  },
  {
    id: 'craft_set_shadow',
    setId: REGION_6_SET_ID,
    fragmentItemId: REGION_6_FRAGMENT_ID,
    fragmentCount: REGION_6_FRAGMENT_COST,
    targetDefIds: Object.fromEntries(
      REGION_6_SET_SLOTS.map((slot) => [slot, region6SetEquipmentId(slot)]),
    ),
  },
  {
    id: 'craft_set_bloodmoon',
    setId: REGION_7_SET_ID,
    fragmentItemId: REGION_7_FRAGMENT_ID,
    fragmentCount: REGION_7_FRAGMENT_COST,
    targetDefIds: Object.fromEntries(
      REGION_7_SET_SLOTS.map((slot) => [slot, region7SetEquipmentId(slot)]),
    ),
  },
];

export const EQUIPMENT_SET_CRAFTING_RECIPES = createEquipmentSetCraftingRegistry(
  EQUIPMENT_SET_CRAFTING_RECIPE_LIST,
);

export function getEquipmentSetCraftingRecipe(
  recipeId: string,
): EquipmentSetCraftingRecipe | undefined {
  return EQUIPMENT_SET_CRAFTING_RECIPES[recipeId];
}

export function requireEquipmentSetCraftingRecipe(
  recipeId: string,
): EquipmentSetCraftingRecipe {
  const recipe = getEquipmentSetCraftingRecipe(recipeId);
  if (!recipe) throw new Error(`[配置错误] 套装合成配方不存在：${recipeId}`);
  return recipe;
}
