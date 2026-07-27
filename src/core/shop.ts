import type { ClassId, EquipmentDef, ShopOffer } from './types';

export type ShopBlockReason =
  'sold-out' | 'wrong-class' | 'level-locked' | 'stage-locked' | 'insufficient-gold';

export type ShopOfferAssessment =
  | { ok: true }
  | {
      ok: false;
      reason: ShopBlockReason;
    };

export interface ShopPurchaseContext {
  gold: number;
  playerLevel: number;
  classId: ClassId;
  clearedStageIds: readonly string[];
  purchasedOfferIds: readonly string[];
}

/** 纯判断：商店展示和真正购买共用同一套规则，避免按钮状态与结算不一致。 */
export function assessShopOffer(
  offer: ShopOffer,
  equipment: EquipmentDef,
  context: ShopPurchaseContext,
): ShopOfferAssessment {
  if (offer.defId !== equipment.id) {
    throw new Error(`[配置错误] 商品 ${offer.id} 引用了不匹配的装备 ${equipment.id}`);
  }
  if (context.purchasedOfferIds.includes(offer.id)) return { ok: false, reason: 'sold-out' };
  if (equipment.classId && equipment.classId !== context.classId) {
    return { ok: false, reason: 'wrong-class' };
  }
  if (context.playerLevel < offer.unlockLevel) return { ok: false, reason: 'level-locked' };
  if (!context.clearedStageIds.includes(offer.unlockStageId)) {
    return { ok: false, reason: 'stage-locked' };
  }
  if (context.gold < offer.price) return { ok: false, reason: 'insufficient-gold' };
  return { ok: true };
}
