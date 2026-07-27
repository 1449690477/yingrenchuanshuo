import { describe, expect, it } from 'vitest';
import { decomposeGold } from '../economy';
import type { ClassId, EquipmentDef, EquipmentInstance, EquipSlot, Quality } from '../types';
import { EQUIPMENT } from '@/data/equipment';
import { SHOP_OFFERS } from '@/data/shop';
import { BOUTIQUE_THEME_LIST } from '@/data/boutique';

function equipment(quality: Quality): EquipmentDef {
  return {
    id: `eq_${quality}`,
    name: '测试装备',
    slot: 'weapon',
    quality,
    level: 20,
    icon: '',
    appearanceId: 'test',
  };
}

function instance(defId: string, enhance = 0): EquipmentInstance {
  return { uid: 'e1', defId, enhance, affixes: [], locked: false };
}

describe('装备分解经济', () => {
  it('同等级品质越高、强化越高，分解金币越多', () => {
    const common = equipment('common');
    const mythic = equipment('mythic');
    expect(decomposeGold(mythic, instance(mythic.id))).toBeGreaterThan(
      decomposeGold(common, instance(common.id)),
    );
    expect(decomposeGold(common, instance(common.id, 5))).toBeGreaterThan(
      decomposeGold(common, instance(common.id)),
    );
  });

  it('实例与定义不匹配时直接暴露错误', () => {
    expect(() => decomposeGold(equipment('rare'), instance('eq_other'))).toThrow('不匹配');
  });

  it('全部商店珍品立即分解都远低于买入价，不存在套利', () => {
    for (const offer of SHOP_OFFERS) {
      const def = EQUIPMENT[offer.defId]!;
      const refund = decomposeGold(def, instance(def.id));
      expect(offer.price, offer.id).toBeGreaterThan(refund * 100);
    }
  });
});

describe('精品商店价格预算', () => {
  const classes: ClassId[] = ['swordsman', 'witch', 'shaman'];
  const expectedTotals = {
    'berry-cream': 2_510_000,
    'moon-sugar': 7_980_000,
    'rose-night': 20_000_000,
  } as const;

  function itemFor(themeIndex: number, slot: EquipSlot, classId: ClassId) {
    const theme = BOUTIQUE_THEME_LIST[themeIndex]!;
    return theme.items.find(
      (item) => item.slot === slot && (slot !== 'weapon' || item.classId === classId),
    )!;
  }

  it('三个职业看到的每档八件套总价一致并符合预算', () => {
    for (const theme of BOUTIQUE_THEME_LIST) {
      for (const classId of classes) {
        const visible = theme.items.filter((item) => !item.classId || item.classId === classId);
        expect(visible, `${theme.id}/${classId}`).toHaveLength(8);
        expect(visible.reduce((sum, item) => sum + item.price, 0)).toBe(
          expectedTotals[theme.id],
        );
      }
    }
  });

  it('武器和衣裙高于鞋、腰带、手镯，所有价格均为正整数', () => {
    const lowCostSlots: EquipSlot[] = ['shoes', 'belt', 'bracelet'];
    for (const theme of BOUTIQUE_THEME_LIST) {
      for (const item of theme.items) {
        expect(Number.isInteger(item.price), `${theme.id}/${item.name}`).toBe(true);
        expect(item.price, `${theme.id}/${item.name}`).toBeGreaterThan(0);
      }
      for (const classId of classes) {
        const weapon = theme.items.find(
          (item) => item.slot === 'weapon' && item.classId === classId,
        )!;
        const dress = theme.items.find((item) => item.slot === 'body')!;
        for (const slot of lowCostSlots) {
          const lowCostItem = theme.items.find((item) => item.slot === slot)!;
          expect(weapon.price, `${theme.id}/${classId}/weapon>${slot}`).toBeGreaterThan(
            lowCostItem.price,
          );
          expect(dress.price, `${theme.id}/${classId}/body>${slot}`).toBeGreaterThan(
            lowCostItem.price,
          );
        }
      }
    }
  });

  it('相同部位价格按莓霜、月糖、绯夜严格递增', () => {
    const slots: EquipSlot[] = [
      'weapon',
      'head',
      'body',
      'necklace',
      'bracelet',
      'ring',
      'belt',
      'shoes',
    ];
    for (const classId of classes) {
      for (const slot of slots) {
        const prices = BOUTIQUE_THEME_LIST.map((_, index) => itemFor(index, slot, classId).price);
        expect(prices[1], `${classId}/${slot}/moon>berry`).toBeGreaterThan(prices[0]!);
        expect(prices[2], `${classId}/${slot}/rose>moon`).toBeGreaterThan(prices[1]!);
      }
    }
  });
});
