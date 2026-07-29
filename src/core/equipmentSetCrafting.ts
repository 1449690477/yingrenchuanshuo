/**
 * 套装通用碎片自选合成的纯计算层。
 *
 * 配方由 data 层传入；本文件只校验目标、扣除碎片，并用本地 seeded RNG
 * 生成一件完整装备实例。输入钱包、配方与 RNG 状态均不会被原地修改。
 */

import {
  createFixedInstance,
  createInstance,
  hasFullyFixedAffixes,
} from './equipment';
import { Rng } from './rng';
import type {
  ClassId,
  EquipmentDef,
  EquipmentInstance,
  EquipSlot,
} from './types';

const EQUIPMENT_SET_CRAFTING_SLOTS = new Set<string>([
  'weapon',
  'head',
  'body',
  'necklace',
  'bracelet',
  'ring',
  'belt',
  'shoes',
]);

export interface EquipmentSetCraftingRecipe {
  id: string;
  setId: string;
  fragmentItemId: string;
  fragmentCount: number;
  targetDefIds: Readonly<Partial<Record<EquipSlot, string>>>;
}

export interface EquipmentSetCraftingWallet {
  items: Readonly<Record<string, number>>;
}

export interface EquipmentSetCraftingCost {
  itemId: string;
  count: number;
}

export type EquipmentSetCraftingFailure =
  | {
      ok: false;
      reason: 'unsupported-slot';
      recipeId: string;
      targetSlot: EquipSlot;
    }
  | {
      ok: false;
      reason: 'insufficient-fragment';
      itemId: string;
      required: number;
      owned: number;
    };

export interface EquipmentSetCraftingSuccess {
  ok: true;
  recipeId: string;
  setId: string;
  targetSlot: EquipSlot;
  targetDefId: string;
  equipment: EquipmentInstance;
  wallet: EquipmentSetCraftingWallet;
  cost: EquipmentSetCraftingCost;
  nextRngState: number;
}

export type EquipmentSetCraftingResult =
  | EquipmentSetCraftingFailure
  | EquipmentSetCraftingSuccess;

function assertNonEmpty(value: string, label: string): void {
  if (value.trim().length === 0) {
    throw new Error(`[配置错误] ${label}不能为空`);
  }
}

function assertPositiveSafeInteger(value: number, label: string): void {
  if (!Number.isSafeInteger(value) || value <= 0) {
    throw new Error(`[配置错误] ${label}必须是正安全整数，收到 ${value}`);
  }
}

function assertNonNegativeSafeInteger(value: number, label: string): void {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new Error(`${label}必须是非负安全整数，收到 ${value}`);
  }
}

function assertRngState(value: number): void {
  if (!Number.isInteger(value) || value < 0 || value > 0xffff_ffff) {
    throw new Error(`RNG 状态必须是 uint32，收到 ${value}`);
  }
}

/**
 * 防御性校验通用配方结构。
 *
 * data 注册器还会继续校验物品类型、套装定义和所有目标装备；这里保留结构校验，
 * 避免测试注入或未来调用方绕过注册器后把错误配方送进玩家事务。
 */
function assertRecipeShape(recipe: EquipmentSetCraftingRecipe): void {
  assertNonEmpty(recipe.id, '套装合成配方 ID');
  assertNonEmpty(recipe.setId, `配方 ${recipe.id} 的套装 ID`);
  assertNonEmpty(recipe.fragmentItemId, `配方 ${recipe.id} 的碎片 ID`);
  assertPositiveSafeInteger(recipe.fragmentCount, `配方 ${recipe.id} 的碎片数量`);

  const entries = Object.entries(recipe.targetDefIds);
  if (entries.length === 0) {
    throw new Error(`[配置错误] 配方 ${recipe.id} 没有任何可合成部位`);
  }

  const seenDefinitions = new Set<string>();
  for (const [slot, targetDefId] of entries) {
    if (!EQUIPMENT_SET_CRAFTING_SLOTS.has(slot)) {
      throw new Error(`[配置错误] 配方 ${recipe.id} 含非法装备槽：${slot}`);
    }
    if (typeof targetDefId !== 'string') {
      throw new Error(`[配置错误] 配方 ${recipe.id} 的 ${slot} 目标定义必须是字符串`);
    }
    assertNonEmpty(targetDefId, `配方 ${recipe.id} 的 ${slot} 目标定义`);
    if (seenDefinitions.has(targetDefId)) {
      throw new Error(`[配置错误] 配方 ${recipe.id} 重复引用目标装备：${targetDefId}`);
    }
    seenDefinitions.add(targetDefId);
  }
}

function assertTargetDefinition(
  recipe: EquipmentSetCraftingRecipe,
  targetSlot: EquipSlot,
  targetDefId: string,
  targetDefinition: EquipmentDef,
): void {
  if (targetDefinition.id !== targetDefId) {
    throw new Error(
      `[配置错误] 配方 ${recipe.id} 的目标定义错配：${targetDefId} !== ${targetDefinition.id}`,
    );
  }
  if (targetDefinition.slot !== targetSlot) {
    throw new Error(
      `[配置错误] 配方 ${recipe.id} 不得把 ${targetSlot} 合成为 ${targetDefinition.slot}`,
    );
  }
  if (targetDefinition.setId !== recipe.setId) {
    throw new Error(
      `[配置错误] 配方 ${recipe.id} 目标装备不属于套装 ${recipe.setId}：${targetDefinition.id}`,
    );
  }
}

/**
 * 规划一次通用碎片自选合成。
 *
 * 固定模板沿用 `createFixedInstance`，不推进 RNG；其余装备沿用标准掉装实例
 * 管线生成胚子与随机词条，并返回推进后的 RNG 状态供 Store 一次提交。
 */
export function planEquipmentSetCrafting(input: {
  recipe: EquipmentSetCraftingRecipe;
  targetSlot: EquipSlot;
  targetDefinition: EquipmentDef;
  classId: ClassId;
  uid: string;
  wallet: EquipmentSetCraftingWallet;
  rngState: number;
}): EquipmentSetCraftingResult {
  const {
    recipe,
    targetSlot,
    targetDefinition,
    classId,
    uid,
    wallet,
    rngState,
  } = input;

  assertRecipeShape(recipe);
  assertNonEmpty(uid, '合成装备 UID');
  assertRngState(rngState);
  for (const [itemId, count] of Object.entries(wallet.items)) {
    assertNonEmpty(itemId, '钱包物品 ID');
    assertNonNegativeSafeInteger(count, `钱包物品 ${itemId} 数量`);
  }

  const targetDefId = recipe.targetDefIds[targetSlot];
  if (!targetDefId) {
    return {
      ok: false,
      reason: 'unsupported-slot',
      recipeId: recipe.id,
      targetSlot,
    };
  }
  assertTargetDefinition(recipe, targetSlot, targetDefId, targetDefinition);

  const owned = wallet.items[recipe.fragmentItemId] ?? 0;
  if (owned < recipe.fragmentCount) {
    return {
      ok: false,
      reason: 'insufficient-fragment',
      itemId: recipe.fragmentItemId,
      required: recipe.fragmentCount,
      owned,
    };
  }

  const nextItems = { ...wallet.items };
  const remaining = owned - recipe.fragmentCount;
  if (remaining === 0) delete nextItems[recipe.fragmentItemId];
  else nextItems[recipe.fragmentItemId] = remaining;

  const rng = new Rng(rngState);
  const equipment = hasFullyFixedAffixes(targetDefinition)
    ? createFixedInstance(targetDefinition, uid, true)
    : createInstance(targetDefinition, rng, uid, classId);

  return {
    ok: true,
    recipeId: recipe.id,
    setId: recipe.setId,
    targetSlot,
    targetDefId,
    equipment,
    wallet: { items: nextItems },
    cost: {
      itemId: recipe.fragmentItemId,
      count: recipe.fragmentCount,
    },
    nextRngState: rng.getState(),
  };
}
