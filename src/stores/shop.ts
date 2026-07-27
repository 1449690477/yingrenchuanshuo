import { computed } from 'vue';
import { defineStore } from 'pinia';
import type { EquipmentInstance } from '@/core/types';
import { createFixedInstance } from '@/core/equipment';
import { BOUTIQUE_THEMES } from '@/data/boutique';
import { requireEquipment } from '@/data/equipment';
import { SHOP_OFFERS } from '@/data/shop';
import { useGameStore } from './game';

export const useShopStore = defineStore('shop', () => {
  const game = useGameStore();

  const offers = computed(() => {
    const classId = game.player?.classId;
    return SHOP_OFFERS.filter((offer) => {
      const def = requireEquipment(offer.defId);
      return !def.classId || def.classId === classId;
    }).map((offer) => {
      const def = requireEquipment(offer.defId);
      const theme = def.boutiqueTheme ? BOUTIQUE_THEMES[def.boutiqueTheme] : null;
      if (!theme) throw new Error(`[配置错误] 珍品装备 ${def.id} 缺少系列配置`);
      return {
        offer,
        def,
        theme,
        assessment: game.assessShopOfferById(offer.id),
      };
    });
  });

  const gold = computed(() => game.player?.gold ?? 0);
  const purchasedCount = computed(() => game.save?.shop.purchasedOfferIds.length ?? 0);

  function previewInstance(defId: string): EquipmentInstance {
    return createFixedInstance(requireEquipment(defId), `shop-preview-${defId}`, true);
  }

  return {
    offers,
    gold,
    purchasedCount,
    previewInstance,
    purchase: game.purchaseShopOffer,
    assessment: game.assessShopOfferById,
  };
});
