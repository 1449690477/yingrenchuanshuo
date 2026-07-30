/**
 * 商店 store 测试。
 *
 * 存在的理由是一次线上事故：2026-07-30 给珍品加「额外可洗词条槽」后，
 * `previewInstance` 仍按老签名调用 `createFixedInstance`（不传 rng / classId），
 * 于是新加的守卫对**每一个**珍品都抛错 —— 而预览是渲染商店列表时调用的，
 * 结果整个商店打不开，玩家「所有东西都买不了」。
 *
 * 教训：给创建函数加严格守卫时，必须同时检查所有调用点，
 * 尤其是「预览 / 展示」这类不产生真实实例的路径 —— 它们本来就不该被守卫拦。
 * 这组测试遍历真实的 SHOP_OFFERS，任何一个条目预览抛错就红。
 */

import 'fake-indexeddb/auto';
import { createPinia, setActivePinia } from 'pinia';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { SHOP_OFFERS } from '@/data/shop';
import { requireEquipment } from '@/data/equipment';
import { createSave } from '@/save/schema';
import { clearSave } from '@/save/storage';
import { useGameStore } from '../game';
import { useShopStore } from '../shop';

const NOW = 1_800_000_000_000;

beforeEach(async () => {
  setActivePinia(createPinia());
  await clearSave();
});

afterEach(async () => {
  await clearSave();
});

function bootShop(classId: 'swordsman' | 'witch' | 'shaman' | 'catkin') {
  const game = useGameStore();
  game.loadFrom(createSave('商店', classId, 77, NOW));
  return useShopStore();
}

describe('商店预览不能抛错（线上事故回归测试）', () => {
  it('每个职业的商店列表都能构建出来', () => {
    for (const classId of ['swordsman', 'witch', 'shaman', 'catkin'] as const) {
      setActivePinia(createPinia());
      const shop = bootShop(classId);
      expect(() => shop.offers).not.toThrow();
      expect(shop.offers.length).toBeGreaterThan(0);
    }
  });

  it('每一个真实商店条目都能生成预览实例', () => {
    const shop = bootShop('swordsman');
    for (const offer of SHOP_OFFERS) {
      expect(
        () => shop.previewInstance(offer.defId),
        `商店条目 ${offer.id}（${offer.defId}）预览抛错`,
      ).not.toThrow();
    }
  });

  it('有额外可洗槽的珍品也能预览 —— 正是当初炸掉商店的那一类', () => {
    const withExtra = SHOP_OFFERS.filter(
      (offer) => (requireEquipment(offer.defId).extraAffixSlots ?? 0) > 0,
    );
    // 紫 +1 / 黄 +1 / 红 +2，所以这个集合不该是空的；空了说明额外槽配置丢了
    expect(withExtra.length).toBeGreaterThan(0);

    const shop = bootShop('swordsman');
    for (const offer of withExtra) {
      expect(() => shop.previewInstance(offer.defId)).not.toThrow();
    }
  });

  it('预览不伪造额外槽词条：只呈现固定词条，避免与实际购买结果不一致', () => {
    const shop = bootShop('swordsman');
    const offer = SHOP_OFFERS.find((o) => (requireEquipment(o.defId).extraAffixSlots ?? 0) > 0);
    expect(offer).toBeDefined();

    const preview = shop.previewInstance(offer!.defId);

    // 额外槽是购买时才掷的。预览若掷一份出来，玩家看到 +50 却买到 +30，
    // 那是欺骗（docs/40 红线），所以预览的 affixes 必须是空的。
    expect(preview.affixes).toEqual([]);
  });
});
