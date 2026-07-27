import { describe, expect, it } from 'vitest';
import { assessShopOffer, type ShopPurchaseContext } from '../shop';
import type { EquipmentDef, ShopOffer } from '../types';

const offer: ShopOffer = {
  id: 'offer_test',
  defId: 'eq_test',
  price: 1000,
  unlockLevel: 12,
  unlockStageId: 'stage_2-1_6',
  category: 'weapon',
  featured: true,
};

const equipment: EquipmentDef = {
  id: 'eq_test',
  name: '测试法杖',
  slot: 'weapon',
  quality: 'epic',
  level: 12,
  icon: '',
  appearanceId: 'test',
  classId: 'witch',
};

const context: ShopPurchaseContext = {
  gold: 1000,
  playerLevel: 12,
  classId: 'witch',
  clearedStageIds: ['stage_2-1_6'],
  purchasedOfferIds: [],
};

describe('商店购买资格', () => {
  it('全部条件满足时允许购买', () => {
    expect(assessShopOffer(offer, equipment, context)).toEqual({ ok: true });
  });

  it.each([
    [{ ...context, purchasedOfferIds: ['offer_test'] }, 'sold-out'],
    [{ ...context, classId: 'swordsman' as const }, 'wrong-class'],
    [{ ...context, playerLevel: 11 }, 'level-locked'],
    [{ ...context, clearedStageIds: [] }, 'stage-locked'],
    [{ ...context, gold: 999 }, 'insufficient-gold'],
  ])('阻断条件返回明确原因', (nextContext, reason) => {
    expect(assessShopOffer(offer, equipment, nextContext)).toEqual({ ok: false, reason });
  });

  it('商品与装备引用不匹配时直接报配置错误', () => {
    expect(() => assessShopOffer({ ...offer, defId: 'eq_other' }, equipment, context)).toThrow(
      '不匹配',
    );
  });
});
