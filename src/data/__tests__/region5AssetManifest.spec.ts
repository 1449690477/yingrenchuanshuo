import { describe, expect, it } from 'vitest';
import {
  REGION5_BATTLEFIELDS,
  REGION5_CLASSES,
  REGION5_COUNTS,
  REGION5_EQUIPMENT,
  REGION5_ITEMS,
  REGION5_MAPS,
  REGION5_MODULAR_LAYERS,
  REGION5_MONSTERS,
  REGION5_SET_EQUIPMENT,
  REGION5_SET_MODULAR_LAYERS,
  REGION5_SET_SLOTS,
} from '../../../scripts/region5-assets-manifest.mjs';
import {
  REGION_5,
  REGION_5_MATERIALS,
  REGION_5_MONSTER_MOTIONS,
  REGION_5_SET_SLOTS,
} from '../region5';

describe('区域 5 美术 manifest', () => {
  it('精确锁定 84 项运行时资产与 PWA 两组容量边界', () => {
    expect(REGION5_COUNTS).toEqual({
      maps: 6,
      battlefields: 5,
      monsters: 24,
      items: 5,
      equipment: 8,
      setEquipment: 6,
      modularLayers: 15,
      setModularLayers: 15,
      regionContentRuntime: 55,
      regionSetRuntime: 18,
      runtimeTotal: 84,
    });
    expect(
      REGION5_COUNTS.maps +
        REGION5_COUNTS.battlefields +
        REGION5_COUNTS.monsters +
        REGION5_COUNTS.items +
        REGION5_COUNTS.equipment +
        REGION5_COUNTS.setEquipment +
        REGION5_COUNTS.modularLayers +
        REGION5_COUNTS.setModularLayers,
    ).toBe(84);
  });

  it('场景、怪物、材料与运行时内容清单同源', () => {
    expect(REGION5_MAPS.map((asset) => asset.id)).toEqual([
      'r5',
      ...REGION_5.chapters.map((chapter) => `chapter-${chapter.id}`),
    ]);
    expect(REGION5_BATTLEFIELDS.map((asset) => asset.id)).toEqual(
      REGION_5.chapters.map((chapter) => `chapter-${chapter.id}`),
    );
    expect(REGION5_ITEMS.map((asset) => asset.id)).toEqual(
      REGION_5_MATERIALS.map((material) => material.id),
    );
    expect(REGION5_MONSTERS.map((monster) => monster.id).sort()).toEqual(
      Object.keys(REGION_5_MONSTER_MOTIONS).sort(),
    );
    for (const monster of REGION5_MONSTERS) {
      expect(monster.motion).toBe(REGION_5_MONSTER_MOTIONS[monster.id]);
    }
  });

  it('普通装备八槽，绯焰只画六个固定槽', () => {
    expect(REGION5_EQUIPMENT.map((asset) => asset.slot)).toHaveLength(8);
    expect(REGION5_SET_EQUIPMENT.map((asset) => asset.slot)).toEqual(REGION5_SET_SLOTS);
    expect(REGION5_SET_SLOTS).toEqual([...REGION_5_SET_SLOTS]);
    expect(REGION5_SET_SLOTS).not.toContain('belt');
    expect(REGION5_SET_SLOTS).not.toContain('shoes');
  });

  it('五职业各有普通与套装三可见层，稳定键不得重复', () => {
    expect(REGION5_CLASSES).toEqual(['swordsman', 'witch', 'shaman', 'catkin', 'kenshi']);
    expect(REGION5_MODULAR_LAYERS).toHaveLength(15);
    expect(REGION5_SET_MODULAR_LAYERS).toHaveLength(15);
    const keys = [
      ...REGION5_MAPS.map(({ id }) => `map:${id}`),
      ...REGION5_BATTLEFIELDS.map(({ id }) => `battlefield:${id}`),
      ...REGION5_MONSTERS.map(({ id }) => `monster:${id}`),
      ...REGION5_ITEMS.map(({ id }) => `item:${id}`),
      ...REGION5_EQUIPMENT.map(({ id }) => `equipment:${id}`),
      ...REGION5_SET_EQUIPMENT.map(({ id }) => `set-equipment:${id}`),
      ...REGION5_MODULAR_LAYERS.map(({ id }) => `layer:${id}`),
      ...REGION5_SET_MODULAR_LAYERS.map(({ id }) => `set-layer:${id}`),
    ];
    expect(keys).toHaveLength(84);
    expect(new Set(keys)).toHaveLength(84);
  });
});
