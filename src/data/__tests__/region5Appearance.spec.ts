import { describe, expect, it } from 'vitest';
import { CLASS_IDS } from '@/core/types';
import { REGION_5_EQUIPMENT_APPEARANCES } from '../characterAppearance';
import { REGION_5_SET_SLOTS } from '../region5';

describe('R5 纸娃娃外观注册', () => {
  it('普通八部位和绯焰六件套全部显式登记', () => {
    expect(Object.keys(REGION_5_EQUIPMENT_APPEARANCES)).toHaveLength(14);

    for (const family of ['r5', 'r5-set'] as const) {
      for (const slot of ['body', 'head', 'weapon'] as const) {
        const id = `${family}-${slot}`;
        const appearance = REGION_5_EQUIPMENT_APPEARANCES[id];
        expect(appearance).toBeDefined();
        expect(appearance).toMatchObject({
          id,
          slot,
          renderMode: 'layer',
        });
        if (appearance?.renderMode !== 'layer') continue;
        expect(appearance.replacementClasses).toEqual(
          slot === 'body' ? ['kenshi'] : undefined,
        );
        expect(Object.keys(appearance.assets).sort()).toEqual([...CLASS_IDS].sort());
        for (const classId of CLASS_IDS) {
          const assetFamily = family === 'r5-set' ? 'r5-crimson' : family;
          expect(appearance.assets[classId]).toBe(
            `assets/characters/modular/${classId}/${assetFamily}-${slot}.png`,
          );
          expect(appearance.transforms[classId]).toEqual({
            scale: 1,
            x: 0,
            y: 0,
          });
        }
      }
    }
  });

  it('普通鞋有五职业贴脚层，其余小部位只占装备槽', () => {
    const shoes = REGION_5_EQUIPMENT_APPEARANCES['r5-shoes'];
    expect(shoes).toMatchObject({ id: 'r5-shoes', slot: 'shoes', renderMode: 'layer' });
    if (shoes?.renderMode === 'layer') {
      for (const classId of CLASS_IDS) {
        expect(shoes.assets[classId]).toBe(
          `assets/characters/modular/${classId}/r5-shoes.png`,
        );
        expect(shoes.transforms[classId]).toEqual({ scale: 1, x: 0, y: 0 });
      }
    }
    for (const slot of ['necklace', 'bracelet', 'ring', 'belt'] as const) {
      expect(REGION_5_EQUIPMENT_APPEARANCES[`r5-${slot}`]).toEqual({
        id: `r5-${slot}`,
        slot,
        renderMode: 'slot-only',
      });
    }
    for (const slot of REGION_5_SET_SLOTS.filter(
      (candidate) => !['body', 'head', 'weapon'].includes(candidate),
    )) {
      expect(REGION_5_EQUIPMENT_APPEARANCES[`r5-set-${slot}`]).toEqual({
        id: `r5-set-${slot}`,
        slot,
        renderMode: 'slot-only',
      });
    }
  });
});
