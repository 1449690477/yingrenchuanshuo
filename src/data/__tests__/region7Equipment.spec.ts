import { describe, expect, it } from 'vitest';
import { SLOT_ORDER } from '../constants';
import { EQUIPMENT, equipIdsOf } from '../equipment';
import { ITEMS } from '../items';
import {
  REGION_7_FRAGMENT_ID,
  REGION_7_MATERIALS,
  REGION_7_SET_ID,
  REGION_7_SET_LEVEL,
  REGION_7_SET_NAMES,
  REGION_7_SET_QUALITY,
  REGION_7_SET_SLOTS,
  region7SetEquipmentId,
} from '../region7';

describe('R7 物品与装备原子定义', () => {
  it('五种物品与规格同源', () => {
    for (const spec of REGION_7_MATERIALS) {
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
    expect(ITEMS[REGION_7_FRAGMENT_ID]?.kind).toBe('fragment');
  });

  it('普通装备为八部位乘两品质，武器统一为雷属性', () => {
    const qualities = ['epic', 'legendary'] as const;
    expect(Object.values(EQUIPMENT).filter((item) => item.id.startsWith('eq_r7_'))).toHaveLength(16);
    for (const slot of SLOT_ORDER) {
      const variants = qualities.map((quality) => EQUIPMENT[`eq_r7_${slot}_${quality}`]!);
      expect(variants.map((item) => item.level)).toEqual([73, 75]);
      for (const definition of variants) {
        expect(definition.icon).toBe(`assets/equipment/r7/${slot}.png`);
        expect(definition.appearanceId).toBe(`r7-${slot}`);
        if (slot === 'weapon') expect(definition.element).toBe('thunder');
        else expect(Object.hasOwn(definition, 'element')).toBe(false);
      }
    }
    expect(equipIdsOf('r7', 'legendary')).toHaveLength(8);
  });

  it('血月套完整覆盖八槽并使用独立外观族', () => {
    expect(REGION_7_SET_SLOTS).toEqual(SLOT_ORDER);
    for (const slot of REGION_7_SET_SLOTS) {
      const id = region7SetEquipmentId(slot);
      expect(EQUIPMENT[id]).toMatchObject({
        id,
        name: REGION_7_SET_NAMES[slot],
        slot,
        quality: REGION_7_SET_QUALITY,
        level: REGION_7_SET_LEVEL,
        setId: REGION_7_SET_ID,
        icon: `assets/equipment/sets/r7-bloodmoon/${slot}.png`,
        appearanceId: `r7-set-${slot}`,
      });
    }
  });
});
