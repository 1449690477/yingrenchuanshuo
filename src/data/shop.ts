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
  // '7-5': 'ice-snow',
  //   ↑ 2026-08-03 随冰雪套下架一并停掉，重新上架时**必须连同这一行一起恢复**。
  //
  //   只把货架从 BOUTIQUE_SHELF_LIST 摘掉是不够的：本表是 boutiqueBossDropIds()
  //   的唯一来源，而它被 lootTables 整包塞进章节 BOSS 掉落。留着这一行，
  //   玩家照样能从 7-5 BOSS 拿到同一批描图外观，**只是不能买了而已**，
  //   下架就形同虚设。
  //
  //   ★ 停的是「继续获得」，不是「已经拥有」：装备定义、已掉落的实例、
  //   已购买记录全部原样保留，已持有的玩家照常穿戴与提交成绩。
};

export function boutiqueBossDropIds(chapterId: string): string[] {
  const themeId = BOUTIQUE_BOSS_DROP_THEME[chapterId];
  if (!themeId) return [];
  return SHOP_OFFERS.filter((offer) => offer.defId.includes(`eq_shop_${themeId}_`)).map(
    (offer) => offer.defId,
  );
}
