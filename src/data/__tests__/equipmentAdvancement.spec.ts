import { describe, expect, it } from 'vitest';
import { SLOT_ORDER } from '../constants';
import { EQUIPMENT, requireEquipment } from '../equipment';
import {
  EQUIPMENT_ADVANCEMENT_FINE_COUNT,
  EQUIPMENT_ADVANCEMENT_GOLD_PER_TARGET_LEVEL,
  EQUIPMENT_ADVANCEMENT_RARE_COUNT,
  EQUIPMENT_ADVANCEMENT_ROUTES,
  equipmentAdvancementOption,
} from '../equipmentAdvancement';
import { requireItem } from '../items';

describe('区域装备升阶数据规则', () => {
  it('三条路线只消耗目标区域的 fine、rare 与目标等级金币', () => {
    expect(EQUIPMENT_ADVANCEMENT_ROUTES).toEqual([
      {
        sourceRegionId: 'r1',
        targetRegionId: 'r2',
        fineItemId: 'honey_bee',
        rareItemId: 'crystal_altar',
      },
      {
        sourceRegionId: 'r2',
        targetRegionId: 'r3',
        fineItemId: 'silk_spider',
        rareItemId: 'egg_broodmother',
      },
      {
        sourceRegionId: 'r3',
        targetRegionId: 'r4',
        fineItemId: 'rubbing_epitaph',
        rareItemId: 'tear_eternal',
      },
    ]);
    expect(EQUIPMENT_ADVANCEMENT_FINE_COUNT).toBe(15);
    expect(EQUIPMENT_ADVANCEMENT_RARE_COUNT).toBe(3);
    expect(EQUIPMENT_ADVANCEMENT_GOLD_PER_TARGET_LEVEL).toBe(200);

    for (const route of EQUIPMENT_ADVANCEMENT_ROUTES) {
      expect(requireItem(route.fineItemId).kind, route.fineItemId).toBe('material');
      expect(requireItem(route.rareItemId).kind, route.rareItemId).toBe('material');
      expect(requireItem(route.fineItemId).tier, route.fineItemId).toBe('fine');
      expect(requireItem(route.rareItemId).tier, route.rareItemId).toBe('rare');
    }
  });

  it('所有存在的相邻同品质目标都保持部位与品质并提高等级', () => {
    const options = Object.values(EQUIPMENT)
      .map(equipmentAdvancementOption)
      .filter((option) => option !== undefined);
    expect(options).toHaveLength(48);

    for (const option of options) {
      expect(option.target.slot).toBe(option.source.slot);
      expect(option.target.quality).toBe(option.source.quality);
      expect(option.target.level).toBeGreaterThan(option.source.level);
      expect(option.requirement).toEqual({
        fineItemId: option.route.fineItemId,
        rareItemId: option.route.rareItemId,
        fineCount: 15,
        rareCount: 3,
        goldPerTargetLevel: 200,
      });
    }
  });

  it('每条有效品质路线覆盖八部位，不靠手写 40 个装备 ID', () => {
    const validPairs = [
      ['r1', 'r2', 'fine'],
      ['r1', 'r2', 'rare'],
      ['r2', 'r3', 'rare'],
      ['r2', 'r3', 'epic'],
      ['r3', 'r4', 'rare'],
      ['r3', 'r4', 'epic'],
    ] as const;

    for (const [sourceRegion, targetRegion, quality] of validPairs) {
      for (const slot of SLOT_ORDER) {
        const source = EQUIPMENT[`eq_${sourceRegion}_${slot}_${quality}`];
        const target = EQUIPMENT[`eq_${targetRegion}_${slot}_${quality}`];
        expect(source, `${sourceRegion}/${slot}/${quality} 来源定义`).toBeDefined();
        expect(target, `${targetRegion}/${slot}/${quality} 目标定义`).toBeDefined();
        expect(equipmentAdvancementOption(source!)?.target.id).toBe(target!.id);
      }
    }
  });

  it('没有同品质目标与非区域装备明确不可升阶', () => {
    expect(
      equipmentAdvancementOption(requireEquipment('eq_r1_weapon_common')),
    ).toBeUndefined();
    expect(
      equipmentAdvancementOption(requireEquipment('eq_r2_weapon_fine')),
    ).toBeUndefined();
    expect(
      equipmentAdvancementOption(requireEquipment('eq_r4_weapon_rare')),
    ).toBeUndefined();

    const nonRegional = Object.values(EQUIPMENT).find(
      (definition) => !definition.id.startsWith('eq_r'),
    );
    expect(nonRegional).toBeDefined();
    expect(equipmentAdvancementOption(nonRegional!)).toBeUndefined();
  });
});
