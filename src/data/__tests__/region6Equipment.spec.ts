import { describe, expect, it } from 'vitest';
import { SLOT_ORDER } from '../constants';
import { EQUIPMENT, equipIdsOf } from '../equipment';
import { ITEMS } from '../items';
import {
  REGION_6_FRAGMENT_ID,
  REGION_6_MATERIALS,
  REGION_6_SET_ID,
  REGION_6_SET_LEVEL,
  REGION_6_SET_NAMES,
  REGION_6_SET_QUALITY,
  REGION_6_SET_SLOTS,
  region6SetEquipmentId,
} from '../region6';

describe('R6 物品与装备原子定义', () => {
  it('五种物品与规格同源', () => {
    for (const spec of REGION_6_MATERIALS) {
      expect(ITEMS[spec.id]).toEqual({
        id: spec.id,
        name: spec.name,
        kind: spec.kind,
        tier: spec.tier,
        desc: spec.desc,
        icon: `assets/items/${spec.id}.png`,
        sellPrice: spec.sellPrice,
      });
    }
    expect(ITEMS[REGION_6_FRAGMENT_ID]?.kind).toBe('fragment');
  });

  it('普通装备为八部位乘三品质，武器统一为冰属性', () => {
    const qualities = ['rare', 'epic', 'legendary'] as const;
    expect(Object.values(EQUIPMENT).filter((item) => item.id.startsWith('eq_r6_'))).toHaveLength(24);
    for (const slot of SLOT_ORDER) {
      const variants = qualities.map((quality) => EQUIPMENT[`eq_r6_${slot}_${quality}`]!);
      expect(variants.map((item) => item.level)).toEqual([58, 60, 62]);
      for (const definition of variants) {
        expect(definition.icon).toBe(`assets/equipment/r6/${slot}.png`);
        expect(definition.appearanceId).toBe(`r6-${slot}`);
        if (slot === 'weapon') expect(definition.element).toBe('ice');
        else expect(Object.hasOwn(definition, 'element')).toBe(false);
      }
    }
    expect(equipIdsOf('r6', 'legendary')).toHaveLength(8);
  });

  it('幽影套完整覆盖八槽并使用独立外观族', () => {
    expect(REGION_6_SET_SLOTS).toEqual(SLOT_ORDER);
    for (const slot of REGION_6_SET_SLOTS) {
      const id = region6SetEquipmentId(slot);
      expect(EQUIPMENT[id]).toMatchObject({
        id,
        name: REGION_6_SET_NAMES[slot],
        slot,
        quality: REGION_6_SET_QUALITY,
        level: REGION_6_SET_LEVEL,
        setId: REGION_6_SET_ID,
        icon: `assets/equipment/sets/r6-shadow/${slot}.png`,
        appearanceId: `r6-set-${slot}`,
      });
    }
  });
});
