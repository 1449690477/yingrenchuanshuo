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
  it('六条路线只消耗目标区域的 fine、rare 与目标等级金币', () => {
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
      {
        sourceRegionId: 'r4',
        targetRegionId: 'r5',
        fineItemId: 'ember_ritual',
        rareItemId: 'core_moltenheart',
      },
      {
        sourceRegionId: 'r5',
        targetRegionId: 'r6',
        fineItemId: 'wisp_shadow',
        rareItemId: 'stone_void',
      },
      {
        sourceRegionId: 'r6',
        targetRegionId: 'r7',
        fineItemId: 'horn_demon',
        rareItemId: 'eye_bloodmoon',
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
    expect(options).toHaveLength(120);

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

  it('每条有效品质路线覆盖八部位，不靠手写 64 个装备 ID', () => {
    const validPairs = [
      ['r1', 'r2', 'fine'],
      ['r1', 'r2', 'rare'],
      ['r2', 'r3', 'fine'],
      ['r2', 'r3', 'rare'],
      ['r2', 'r3', 'epic'],
      ['r3', 'r4', 'fine'],
      ['r3', 'r4', 'rare'],
      ['r3', 'r4', 'epic'],
      ['r4', 'r5', 'rare'],
      ['r4', 'r5', 'epic'],
      ['r5', 'r6', 'rare'],
      ['r5', 'r6', 'epic'],
      ['r5', 'r6', 'legendary'],
      ['r6', 'r7', 'epic'],
      ['r6', 'r7', 'legendary'],
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

  it('相邻区域六段升阶路线按品质交集生成稳定数量', () => {
    const counts = Object.values(EQUIPMENT)
      .map(equipmentAdvancementOption)
      .filter((option) => option !== undefined)
      .reduce<Record<string, number>>((result, option) => {
        const routeId = `${option.route.sourceRegionId}->${option.route.targetRegionId}`;
        result[routeId] = (result[routeId] ?? 0) + 1;
        return result;
      }, {});

    expect(counts).toEqual({
      'r1->r2': 16,
      'r2->r3': 24,
      'r3->r4': 24,
      'r4->r5': 16,
      'r5->r6': 24,
      'r6->r7': 16,
    });
  });

  it('没有同品质目标与非区域装备明确不可升阶', () => {
    expect(
      equipmentAdvancementOption(requireEquipment('eq_r1_weapon_common')),
    ).toBeUndefined();
    expect(
      equipmentAdvancementOption(requireEquipment('eq_r4_weapon_fine')),
    ).toBeUndefined();
    expect(equipmentAdvancementOption(requireEquipment('eq_r5_weapon_rare'))?.target.id).toBe(
      'eq_r6_weapon_rare',
    );
    expect(equipmentAdvancementOption(requireEquipment('eq_r6_weapon_rare'))).toBeUndefined();
    expect(equipmentAdvancementOption(requireEquipment('eq_r6_weapon_epic'))?.target.id).toBe(
      'eq_r7_weapon_epic',
    );

    const nonRegional = Object.values(EQUIPMENT).find(
      (definition) => !definition.id.startsWith('eq_r'),
    );
    expect(nonRegional).toBeDefined();
    expect(equipmentAdvancementOption(nonRegional!)).toBeUndefined();
  });
});
