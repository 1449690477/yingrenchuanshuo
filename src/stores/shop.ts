import { computed } from 'vue';
import { defineStore } from 'pinia';
import type { EquipmentInstance } from '@/core/types';
import { createFixedPreviewInstance } from '@/core/equipment';
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

  /**
   * 列表与详情的展示用实例。
   *
   * 必须用 createFixedPreviewInstance 而不是 createFixedInstance：
   * 后者对「声明了额外可洗槽」的定义要求传 rng，而珍品全都有额外槽 ——
   * 混用会让整个商店在渲染时抛错（2026-07-30 线上事故）。
   * 预览也刻意不掷额外槽词条，避免展示值与实际购买结果不一致。
   */
  function previewInstance(defId: string): EquipmentInstance {
    return createFixedPreviewInstance(requireEquipment(defId), `shop-preview-${defId}`);
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
