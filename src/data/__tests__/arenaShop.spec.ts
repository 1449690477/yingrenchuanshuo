/**
 * 荣誉商店与奖励箱数据验收（docs/53 §四）。
 *
 * 锁定：定价表、全员可得的全套总价、碎片兑换非独占、
 * 奖励箱引用的物品 id 必须真实存在于物品总表。
 */

import { describe, expect, it } from 'vitest';
import { CLASS_IDS } from '@/core/types';
import { ITEMS } from '@/data/items';
import { ARENA_TIERS } from '@/data/arenaRules';
import {
  ARENA_BOXES,
  ARENA_FRAGMENT_EXCHANGE_COST,
  ARENA_SHOP_ENTRIES,
  ARENA_SHOP_PRICES,
  arenaShopEntryPrice,
} from '../arenaShop';

const ARENA_SHOP_CLASS_IDS = CLASS_IDS;

describe('荣誉商店货架', () => {
  it('20 个货架：5 职业 × 4 部位，定价与 docs/53 §4.1 一致', () => {
    expect(ARENA_SHOP_ENTRIES).toHaveLength(20);
    expect(ARENA_SHOP_PRICES).toEqual({ weapon: 1500, head: 1200, body: 1200, ring: 900 });
    for (const entry of ARENA_SHOP_ENTRIES) {
      expect(entry.price).toBe(ARENA_SHOP_PRICES[entry.slot]);
      expect(arenaShopEntryPrice(entry.id)).toBe(entry.price);
    }
  });

  it('每职业全套 4800：人人可得，只是快慢有别', () => {
    for (const classId of ARENA_SHOP_CLASS_IDS) {
      const total = ARENA_SHOP_ENTRIES.filter((e) => e.classId === classId).reduce(
        (sum, e) => sum + e.price,
        0,
      );
      expect(total).toBe(4800);
    }
    expect(ARENA_SHOP_ENTRIES.filter((entry) => entry.classId === 'kenshi')).toHaveLength(4);
  });

  it('货架 id 唯一且格式稳定', () => {
    const ids = new Set(ARENA_SHOP_ENTRIES.map((e) => e.id));
    expect(ids.size).toBe(20);
    expect(arenaShopEntryPrice('arena_swordsman_weapon')).toBe(1500);
    expect(() => arenaShopEntryPrice('arena_nobody_ring')).toThrow();
  });
});

describe('圣痕碎片兑换', () => {
  it('40 枚换一件：快车道但不是独占路（荣誉直购人人可走）', () => {
    expect(ARENA_FRAGMENT_EXCHANGE_COST).toBe(40);
    expect(ITEMS.frag_stigma?.kind).toBe('fragment');
  });
});

describe('奖励箱', () => {
  it('两箱内容与 docs/53 §4.2 一致，引用物品真实存在', () => {
    expect(ARENA_BOXES.box_starlight.reward.honor).toEqual({ min: 30, max: 80 });
    expect(ARENA_BOXES.box_sacred.reward.honor).toEqual({ min: 120, max: 200 });

    for (const box of Object.values(ARENA_BOXES)) {
      expect(box.reward.honor.min).toBeGreaterThan(0);
      expect(box.reward.honor.max).toBeGreaterThanOrEqual(box.reward.honor.min);
      for (const [itemId, amount] of Object.entries(box.reward.items)) {
        expect(ITEMS[itemId], `箱子 ${box.id} 引用了不存在的物品 ${itemId}`).toBeDefined();
        const [lo, hi] = Array.isArray(amount) ? amount : [amount, amount];
        expect(lo).toBeGreaterThan(0);
        expect(hi).toBeGreaterThanOrEqual(lo);
      }
    }
    // 圣痕匣必须产圣痕碎片，星辉匣不能产（高段位快车道只从圣痕匣来）
    expect(ARENA_BOXES.box_sacred.reward.items.frag_stigma).toBeDefined();
    expect(ARENA_BOXES.box_starlight.reward.items.frag_stigma).toBeUndefined();
  });

  it('段位每日奖励箱引用的箱 id 都存在', () => {
    for (const tier of ARENA_TIERS) {
      expect(tier.dailyHonor).toBeGreaterThan(0);
      for (const [boxKey, count] of Object.entries(tier.dailyBoxes)) {
        const boxId = `box_${boxKey}` as keyof typeof ARENA_BOXES;
        expect(ARENA_BOXES[boxId], `段位 ${tier.id} 引用了不存在的箱子 ${boxId}`).toBeDefined();
        expect(count).toBeGreaterThanOrEqual(0);
      }
    }
    // 圣痕匣只发给绯樱及以上（docs/53 §4.2）
    for (const tier of ARENA_TIERS) {
      if (tier.id === 'yingguan' || tier.id === 'feiying') {
        expect(tier.dailyBoxes.sacred).toBeGreaterThan(0);
      } else {
        expect(tier.dailyBoxes.sacred).toBe(0);
      }
    }
  });
});
