import { describe, expect, it } from 'vitest';
import { SLOT_ORDER } from '../constants';
import { EQUIPMENT, equipIdsOf } from '../equipment';
import { ITEMS } from '../items';
import {
  REGION_5_FRAGMENT_ID,
  REGION_5_MATERIALS,
  REGION_5_SET_ID,
  REGION_5_SET_LEVEL,
  REGION_5_SET_NAMES,
  REGION_5_SET_QUALITY,
  REGION_5_SET_SLOTS,
  region5SetEquipmentId,
} from '../region5';

describe('R5 物品与装备原子定义', () => {
  it('五种物品与规格同源，绯焰碎片不会退化成普通材料', () => {
    for (const spec of REGION_5_MATERIALS) {
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
    expect(ITEMS[REGION_5_FRAGMENT_ID]?.kind).toBe('fragment');
  });

  it('普通装备恰好为八部位 × 稀有/史诗/传说，武器统一为炎属性', () => {
    const qualities = ['rare', 'epic', 'legendary'] as const;
    const definitions = Object.values(EQUIPMENT).filter((definition) =>
      definition.id.startsWith('eq_r5_'),
    );
    expect(definitions).toHaveLength(24);

    for (const slot of SLOT_ORDER) {
      const variants = qualities.map((quality) => {
        const definition = EQUIPMENT[`eq_r5_${slot}_${quality}`];
        expect(definition, `${slot}/${quality}`).toBeDefined();
        expect(definition?.slot).toBe(slot);
        expect(definition?.quality).toBe(quality);
        expect(definition?.icon).toBe(`assets/equipment/r5/${slot}.png`);
        expect(definition?.appearanceId).toBe(`r5-${slot}`);
        if (slot === 'weapon') {
          expect(definition?.element).toBe('fire');
        } else {
          expect(Object.hasOwn(definition!, 'element')).toBe(false);
        }
        return definition!;
      });
      expect(variants.map((definition) => definition.level)).toEqual([48, 50, 52]);
    }

    expect(equipIdsOf('r5', 'legendary')).toHaveLength(8);
    expect(equipIdsOf('r5', 'legendary').every((id) => id.startsWith('eq_r5_'))).toBe(true);
  });

  it('绯焰套严格只有六个锁定部位且不混入普通掉落候选', () => {
    expect(REGION_5_SET_SLOTS).toHaveLength(6);
    for (const slot of REGION_5_SET_SLOTS) {
      const id = region5SetEquipmentId(slot);
      const definition = EQUIPMENT[id];
      expect(definition).toBeDefined();
      expect(definition).toMatchObject({
        id,
        name: REGION_5_SET_NAMES[slot],
        slot,
        quality: REGION_5_SET_QUALITY,
        level: REGION_5_SET_LEVEL,
        setId: REGION_5_SET_ID,
        icon: `assets/equipment/sets/r5-crimson/${slot}.png`,
        appearanceId: `r5-set-${slot}`,
      });
      if (slot === 'weapon') {
        expect(definition?.element).toBe('fire');
      } else {
        expect(Object.hasOwn(definition!, 'element')).toBe(false);
      }
      expect(equipIdsOf('r5', 'legendary')).not.toContain(id);
    }

    const setIds = Object.keys(EQUIPMENT).filter((id) =>
      id.startsWith('eq_set_region_crimson_'),
    );
    expect(setIds.sort()).toEqual(REGION_5_SET_SLOTS.map(region5SetEquipmentId).sort());
  });
});
