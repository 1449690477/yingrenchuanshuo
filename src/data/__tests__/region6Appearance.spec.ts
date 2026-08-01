import { describe, expect, it } from 'vitest';
import { CLASS_IDS } from '@/core/types';
import { REGION_6_EQUIPMENT_APPEARANCES } from '../characterAppearance';
import { REGION_6_SET_SLOTS } from '../region6';

describe('R6 纸娃娃外观注册', () => {
  it('普通与幽影的身体、头部、武器均为四职业独立图层', () => {
    expect(Object.keys(REGION_6_EQUIPMENT_APPEARANCES)).toHaveLength(16);
    for (const family of ['r6', 'r6-set'] as const) {
      for (const slot of ['body', 'head', 'weapon'] as const) {
        const id = `${family}-${slot}`;
        const appearance = REGION_6_EQUIPMENT_APPEARANCES[id];
        expect(appearance).toMatchObject({ id, slot, renderMode: 'layer' });
        if (appearance?.renderMode !== 'layer') continue;
        for (const classId of CLASS_IDS) {
          const assetFamily = family === 'r6-set' ? 'r6-shadow' : family;
          const assetClassId = classId === 'kenshi' ? 'catkin' : classId;
          expect(appearance.assets[classId]).toBe(
            `assets/characters/modular/${assetClassId}/${assetFamily}-${slot}.png`,
          );
        }
      }
    }
  });

  it('小部位只占装备槽，不制造与角色身体冲突的假图层', () => {
    for (const slot of ['necklace', 'bracelet', 'ring', 'belt', 'shoes'] as const) {
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
