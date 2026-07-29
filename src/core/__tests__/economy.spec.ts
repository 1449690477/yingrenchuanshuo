import { describe, expect, it } from 'vitest';
import { decomposeGold } from '../economy';
import type { EquipmentDef, EquipmentInstance, Quality } from '../types';
import { ENHANCE_MAX } from '@/data/constants';
import { EQUIPMENT } from '@/data/equipment';
import { SHOP_OFFERS } from '@/data/shop';

function equipment(quality: Quality): EquipmentDef {
  return {
    id: `eq_${quality}`,
    name: '测试装备',
    slot: 'weapon',
    element: 'none',
    quality,
    level: 20,
    icon: '',
    appearanceId: 'test',
  };
}

function instance(defId: string, enhance = 0): EquipmentInstance {
  return {
    uid: 'e1',
    defId,
    enhance,
    baseRollPermille: 1000,
    enhanceGainPermille: Array.from({ length: ENHANCE_MAX }, (_, index) =>
      index < enhance ? 80 : 0,
    ),
    enhanceLuck: {},
    affixes: [],
    reforgeResonance: 0,
    locked: false,
  };
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
