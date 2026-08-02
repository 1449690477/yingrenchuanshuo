import type { BoutiqueThemeId, ShopOffer } from '@/core/types';
import { BOUTIQUE_THEME_LIST, boutiqueEquipmentId, boutiqueOfferId } from './boutique';

export const SHOP_OFFERS: readonly ShopOffer[] = BOUTIQUE_THEME_LIST.flatMap((theme) =>
  theme.items.map((item, index) => ({
    id: boutiqueOfferId(theme.id, item.slot, item.classId),
    defId: boutiqueEquipmentId(theme.id, item.slot, item.classId),
    price: item.price,
    unlockLevel: theme.level,
    unlockStageId: theme.unlockStageId,
    category: item.category,
    featured: item.slot === 'weapon' || item.slot === 'body' || index === 3,
  })),
);

const SHOP_OFFER_MAP = Object.fromEntries(SHOP_OFFERS.map((offer) => [offer.id, offer])) as Record<
  string,
  ShopOffer
>;

export function getShopOffer(id: string): ShopOffer | undefined {
  return SHOP_OFFER_MAP[id];
}

export function requireShopOffer(id: string): ShopOffer {
  const offer = SHOP_OFFER_MAP[id];
  if (!offer) throw new Error(`[配置错误] 商店商品不存在：${id}`);
  return offer;
}

/**
 * 章节 BOSS 表中的同款直掉路径。
 *
 * 商店只是高价确定性保底；橙色以上装备仍能靠打怪获得，
 * 遵守「装备靠打不靠抽」的项目铁律。
 */
export const BOUTIQUE_BOSS_DROP_THEME: Readonly<Record<string, BoutiqueThemeId>> = {
  '2-1': 'berry-cream',
  '2-3': 'moon-sugar',
  '2-5': 'rose-night',
  '7-5': 'ice-snow',
};

export function boutiqueBossDropIds(chapterId: string): string[] {
  const themeId = BOUTIQUE_BOSS_DROP_THEME[chapterId];
  if (!themeId) return [];
  return SHOP_OFFERS.filter((offer) => offer.defId.includes(`eq_shop_${themeId}_`)).map(
    (offer) => offer.defId,
  );
}
