import { describe, expect, it } from 'vitest';
import { CLASS_IDS } from '@/core/types';
import { REGION_6_EQUIPMENT_APPEARANCES } from '../characterAppearance';
import { REGION_6_SET_SLOTS } from '../region6';

describe('R6 纸娃娃外观注册', () => {
  it('普通与幽影的身体、头部、武器均为五职业独立图层', () => {
    expect(Object.keys(REGION_6_EQUIPMENT_APPEARANCES)).toHaveLength(16);
    for (const family of ['r6', 'r6-set'] as const) {
      for (const slot of ['body', 'head', 'weapon'] as const) {
        const id = `${family}-${slot}`;
        const appearance = REGION_6_EQUIPMENT_APPEARANCES[id];
        expect(appearance).toMatchObject({ id, slot, renderMode: 'layer' });
        if (appearance?.renderMode !== 'layer') continue;
        expect(appearance.replacementClasses).toEqual(
          slot === 'body' ? ['kenshi'] : undefined,
        );
        for (const classId of CLASS_IDS) {
          const assetFamily = family === 'r6-set' ? 'r6-shadow' : family;
          expect(appearance.assets[classId]).toBe(
            `assets/characters/modular/${classId}/${assetFamily}-${slot}.png`,
          );
        }
      }
    }
  });

  it('普通鞋有五职业贴脚层，其余小部位只占装备槽', () => {
    const shoes = REGION_6_EQUIPMENT_APPEARANCES['r6-shoes'];
    expect(shoes).toMatchObject({ id: 'r6-shoes', slot: 'shoes', renderMode: 'layer' });
    if (shoes?.renderMode === 'layer') {
      for (const classId of CLASS_IDS) {
        expect(shoes.assets[classId]).toBe(
          `assets/characters/modular/${classId}/r6-shoes.png`,
        );
        expect(shoes.transforms[classId]).toEqual({ scale: 1, x: 0, y: 0 });
      }
    }
    for (const slot of ['necklace', 'bracelet', 'ring', 'belt'] as const) {
      expect(REGION_6_EQUIPMENT_APPEARANCES[`r6-${slot}`]).toEqual({
        id: `r6-${slot}`,
        slot,
        renderMode: 'slot-only',
      });
    }
    for (const slot of REGION_6_SET_SLOTS.filter(
      (candidate) => !['body', 'head', 'weapon'].includes(candidate),
    )) {
      expect(REGION_6_EQUIPMENT_APPEARANCES[`r6-set-${slot}`]).toEqual({
        id: `r6-set-${slot}`,
        slot,
        renderMode: 'slot-only',
      });
    }
  });
});
