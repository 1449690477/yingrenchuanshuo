/**
 * 套装烙印（docs/58）：把普通装备烙上副本套装归属的纯计算层。
 *
 * 烙印只写入 imprintSetId。绝不：提升品质、重置胚子、改动词条、
 * 直接制造毕业装（codex 四不原则）。品质/浮动/词条/强化原样保留 ——
 * 玩家此前的洗练与强化投入 100% 保值。
 *
 * 本模块不读存档不掷骰，材料扣减由 store 在原子提交里做。
 */

import type { EquipmentDef, EquipmentInstance } from './types';
import {
  IMPRINT_CORE_ALT_CRYSTALS,
  IMPRINT_CORE_ID,
  IMPRINT_CRYSTAL_COST,
  IMPRINT_CRYSTAL_IDS,
  IMPRINT_GOLD_PER_LEVEL,
  IMPRINT_SET_TIER,
  isImprintableSetId,
} from '@/data/imprintRules';

export type ImprintBlockReason =
  | 'set-not-imprintable'
  | 'set-locked'
  | 'def-set-conflict'
  | 'fixed-template'
  | 'pending-affix'
  | 'already-imprinted-same'
  | 'materials'
  | 'gold';

export interface ImprintCost {
  crystalId: string;
  crystals: number;
  coreId: string;
  cores: number;
  gold: number;
}

export interface ImprintWallet {
  gold: number;
  /** 背包物品持有量查询（不存在的 id 返回 0） */
  itemCount: (itemId: string) => number;
}

export type ImprintPlan =
  | { ok: true; cost: ImprintCost; nextInstance: EquipmentInstance }
  | { ok: false; reason: ImprintBlockReason; cost: ImprintCost | null };

/** 烙印成本（docs/58 §3.2）。useCore 走「1 核 + 2 晶」的坏运气兜底路径。 */
export function imprintCostOf(
  definition: EquipmentDef,
  setId: string,
  useCore: boolean,
): ImprintCost | null {
  if (!isImprintableSetId(setId)) return null;
  const tier = IMPRINT_SET_TIER[setId];
  return {
    crystalId: IMPRINT_CRYSTAL_IDS[tier],
    crystals: useCore ? IMPRINT_CORE_ALT_CRYSTALS : IMPRINT_CRYSTAL_COST,
    coreId: IMPRINT_CORE_ID,
    cores: useCore ? 1 : 0,
    gold: definition.level * IMPRINT_GOLD_PER_LEVEL,
  };
}

/**
 * 烙印计划：全部校验 + 成本核算 + 生成结果实例（不修改入参）。
 *
 * @param setUnlocked 该套装是否已解锁（首通对应档任意入口）——
 *   解锁状态存于装备副本 records，由调用方推导后传入，保持本层纯净。
 */
export function planImprint(
  definition: EquipmentDef,
  instance: EquipmentInstance,
  setId: string,
  setUnlocked: boolean,
  wallet: ImprintWallet,
  useCore: boolean,
): ImprintPlan {
  const cost = imprintCostOf(definition, setId, useCore);
  if (!cost) return { ok: false, reason: 'set-not-imprintable', cost: null };
  if (!setUnlocked) return { ok: false, reason: 'set-locked', cost };

  // 定义级套装身份不可覆盖：绯焰/圣痕/副本旧整装是「这件装备是谁」，
  // 烙印只能加在没有身份的普通装备上
  if (definition.setId) return { ok: false, reason: 'def-set-conflict', cost };
  if (definition.fixedTemplate) return { ok: false, reason: 'fixed-template', cost };
  if (instance.pendingAffixChange) return { ok: false, reason: 'pending-affix', cost };
  // 重烙成别的套装允许（覆盖、全价）；烙成当前同款是纯浪费，拦下
  if (instance.imprintSetId === setId) {
    return { ok: false, reason: 'already-imprinted-same', cost };
  }

  if (
    wallet.itemCount(cost.crystalId) < cost.crystals ||
    (cost.cores > 0 && wallet.itemCount(cost.coreId) < cost.cores)
  ) {
    return { ok: false, reason: 'materials', cost };
  }
  if (wallet.gold < cost.gold) return { ok: false, reason: 'gold', cost };

  return {
    ok: true,
    cost,
    nextInstance: { ...instance, imprintSetId: setId },
  };
}
