import { describe, expect, it } from 'vitest';
import {
  REGION6_ALL_ASSETS,
  REGION6_BATTLEFIELDS,
  REGION6_CLASSES,
  REGION6_COUNTS,
  REGION6_EQUIPMENT,
  REGION6_ITEMS,
  REGION6_MAPS,
  REGION6_MODULAR_LAYERS,
  REGION6_MONSTERS,
  REGION6_SET_EQUIPMENT,
  REGION6_SET_MODULAR_LAYERS,
} from '../../../scripts/region6-assets-manifest.mjs';
import {
  REGION_6,
  REGION_6_MATERIALS,
  REGION_6_MONSTER_MOTIONS,
  REGION_6_SET_SLOTS,
} from '../region6';

describe('区域 6 美术 manifest', () => {
  it('锁定 86 项独立运行时资源和两组 PWA 容量边界', () => {
    expect(REGION6_COUNTS).toEqual({
      maps: 6,
      battlefields: 5,
      monsters: 24,
      items: 5,
      equipment: 8,
      setEquipment: 8,
      modularLayers: 15,
      setModularLayers: 15,
      regionContentRuntime: 55,
      regionSetRuntime: 20,
      runtimeTotal: 86,
    });
    expect(REGION6_ALL_ASSETS).toHaveLength(86);
  });

  it('场景、怪物、材料与实际配置同源', () => {
    expect(REGION6_MAPS.map(({ id }) => id)).toEqual([
      'r6',
      ...REGION_6.chapters.map(({ id }) => `chapter-${id}`),
    ]);
    expect(REGION6_BATTLEFIELDS.map(({ id }) => id)).toEqual(
      REGION_6.chapters.map(({ id }) => `chapter-${id}`),
    );
    expect(REGION6_ITEMS.map(({ id }) => id)).toEqual(
      REGION_6_MATERIALS.map(({ id }) => id),
    );
    expect(REGION6_MONSTERS.map(({ id }) => id).sort()).toEqual(
      Object.keys(REGION_6_MONSTER_MOTIONS).sort(),
    );
    for (const monster of REGION6_MONSTERS) {
      expect(monster.motion).toBe(REGION_6_MONSTER_MOTIONS[monster.id]);
    }
  });

  it('普通装与幽影套都是完整八部位', () => {
    expect(REGION6_EQUIPMENT.map(({ slot }) => slot)).toEqual([
      ...REGION_6_SET_SLOTS,
    ]);
    expect(REGION6_SET_EQUIPMENT.map(({ slot }) => slot)).toEqual([
      ...REGION_6_SET_SLOTS,
    ]);
  });

  it('五职业均有普通和套装三层，且每个独立资产使用唯一来源键', () => {
    expect(REGION6_CLASSES).toEqual(['swordsman', 'witch', 'shaman', 'catkin', 'kenshi']);
    expect(REGION6_MODULAR_LAYERS).toHaveLength(15);
    expect(REGION6_SET_MODULAR_LAYERS).toHaveLength(15);
    const callIds = REGION6_ALL_ASSETS.map(({ callId }) => callId);
    expect(new Set(callIds)).toHaveLength(86);
    expect(
      callIds.every(
        (callId) =>
          /^exec-[a-f0-9-]+$/.test(callId) || /^contract-kenshi-r6-[a-z0-9-]+$/.test(callId),
      ),
    ).toBe(true);
  });
});
