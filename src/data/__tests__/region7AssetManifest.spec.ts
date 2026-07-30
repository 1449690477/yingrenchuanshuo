import { describe, expect, it } from 'vitest';
import {
  REGION7_ALL_ASSETS,
  REGION7_BADGE,
  REGION7_BATTLEFIELDS,
  REGION7_CLASSES,
  REGION7_COUNTS,
  REGION7_EQUIPMENT,
  REGION7_ITEMS,
  REGION7_MAPS,
  REGION7_MODULAR_LAYERS,
  REGION7_MONSTERS,
  REGION7_SET_EQUIPMENT,
  REGION7_SET_MODULAR_LAYERS,
} from '../../../scripts/region7-assets-manifest.mjs';
import {
  REGION_7,
  REGION_7_MATERIALS,
  REGION_7_MONSTER_MOTIONS,
  REGION_7_SET_SLOTS,
} from '../region7';

describe('区域 7 美术 manifest', () => {
  it('锁定 81 项独立运行时资源和两组 PWA 容量边界', () => {
    expect(REGION7_COUNTS).toEqual({
      maps: 6,
      battlefields: 5,
      monsters: 24,
      items: 5,
      equipment: 8,
      setEquipment: 8,
      badges: 1,
      modularLayers: 12,
      setModularLayers: 12,
      regionContentRuntime: 55,
      regionSetRuntime: 21,
      runtimeTotal: 81,
    });
    expect(REGION7_ALL_ASSETS).toHaveLength(81);
  });

  it('场景、怪物、材料与实际配置同源', () => {
    expect(REGION7_MAPS.map(({ id }) => id)).toEqual([
      'r7',
      ...REGION_7.chapters.map(({ id }) => `chapter-${id}`),
    ]);
    expect(REGION7_BATTLEFIELDS.map(({ id }) => id)).toEqual(
      REGION_7.chapters.map(({ id }) => `chapter-${id}`),
    );
    expect(REGION7_ITEMS.map(({ id }) => id)).toEqual(
      REGION_7_MATERIALS.map(({ id }) => id),
    );
    expect(REGION7_MONSTERS.map(({ id }) => id).sort()).toEqual(
      Object.keys(REGION_7_MONSTER_MOTIONS).sort(),
    );
    for (const monster of REGION7_MONSTERS) {
      expect(monster.motion).toBe(REGION_7_MONSTER_MOTIONS[monster.id]);
    }
  });

  it('普通装与血月套都是完整八部位，并单独登记收集徽记', () => {
    expect(REGION7_EQUIPMENT.map(({ slot }) => slot)).toEqual([
      ...REGION_7_SET_SLOTS,
    ]);
    expect(REGION7_SET_EQUIPMENT.map(({ slot }) => slot)).toEqual([
      ...REGION_7_SET_SLOTS,
    ]);
    expect(REGION7_BADGE.id).toBe('r7-bloodmoon-badge');
  });

  it('四职业均有普通和套装三层，且每个独立资产使用唯一调用', () => {
    expect(REGION7_CLASSES).toEqual(['swordsman', 'witch', 'shaman', 'catkin']);
    expect(REGION7_MODULAR_LAYERS).toHaveLength(12);
    expect(REGION7_SET_MODULAR_LAYERS).toHaveLength(12);
    const callIds = REGION7_ALL_ASSETS.map(({ callId }) => callId);
    expect(new Set(callIds)).toHaveLength(81);
    expect(callIds.every((callId) => /^call_[A-Za-z0-9]+$/.test(callId))).toBe(true);
    expect(
      REGION7_MONSTERS.find(({ id }) => id === 'mon_7-4_elite')?.subjectCount,
    ).toBe(3);
  });
});
