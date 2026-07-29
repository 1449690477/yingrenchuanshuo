import { describe, expect, it } from 'vitest';
import { CLASS_IDS } from '@/core/types';
import { AFFIX_TIERS } from '../constants';
import { ITEMS } from '../items';
import {
  CLASS_SIGIL_IDS,
  RANDOM_AFFIX_CHANGE_OPERATIONS,
  REFORGE_MATERIAL_IDS,
  REFORGE_RESONANCE_MAX,
  REFORGE_RULES,
  REGION_REFORGE_MATERIALS,
  requireRegionReforgeMaterials,
} from '../reforgeRules';
import { REGIONS } from '../regions';

describe('洗练配置完整性', () => {
  it('五档品阶严格采用策划权重与系数', () => {
    // 系数经覆盖全部品质与 Lv120 的 npm run sim 重标定：期望 0.7982。
    // 旧的 0.80/0.92/1.00/1.18/1.42 会让新掉落整体偏强、全 T5 成长空间不足。
    expect(AFFIX_TIERS).toEqual([
      { tier: 1, name: '粗糙', weight: 40, multiplier: 0.62 },
      { tier: 2, name: '普通', weight: 27, multiplier: 0.76 },
      { tier: 3, name: '优良', weight: 18, multiplier: 0.88 },
      { tier: 4, name: '卓越', weight: 11, multiplier: 1.1 },
      { tier: 5, name: '极品', weight: 4, multiplier: 1.64 },
    ]);
  });

  it('四职业徽记和三种公共洗练材料都指向正式物品', () => {
    for (const classId of CLASS_IDS) {
      expect(ITEMS[CLASS_SIGIL_IDS[classId]], `${classId} 徽记不存在`).toBeDefined();
    }
    for (const itemId of Object.values(REFORGE_MATERIAL_IDS)) {
      expect(ITEMS[itemId], `${itemId} 不存在`).toBeDefined();
    }
  });

  it('每个已接入运行时的区域都有两个 common 与一个 fine 消耗端', () => {
    for (const region of REGIONS) {
      const materials = requireRegionReforgeMaterials(region.id);
      expect(new Set([...materials.commonIds, materials.fineId]).size).toBe(3);
      for (const itemId of materials.commonIds) {
        expect(ITEMS[itemId], `${region.id}/${itemId} 不存在`).toMatchObject({
          kind: 'material',
          tier: 'common',
        });
      }
      expect(ITEMS[materials.fineId], `${region.id}/${materials.fineId} 不存在`).toMatchObject({
        kind: 'material',
        tier: 'fine',
      });
    }
    expect(() => requireRegionReforgeMaterials('r999')).toThrow('缺少洗练材料配置');
  });

  it('操作、共鸣与消耗公式只有一份可信配置', () => {
    expect(RANDOM_AFFIX_CHANGE_OPERATIONS).toEqual(['reforge', 'temper', 'inscribe']);
    expect(REFORGE_RESONANCE_MAX).toBe(20);
    expect(REFORGE_RULES).toMatchObject({
      reforge: {
        goldPerLevel: 50,
        materialEveryLevels: 5,
        materialBase: 1,
        regionCommonEach: 10,
        regionFine: 2,
      },
      temper: { goldPerLevel: 80, materialEveryLevels: 4 },
      bind: { exponentOffset: 1 },
      resonate: { goldPerLevel: 300 },
      resonanceGain: { 1: 3, 2: 2, 3: 1, 4: -20, 5: -20 },
    });
    expect(Object.keys(REGION_REFORGE_MATERIALS)).toEqual(['r1', 'r2', 'r3', 'r4', 'r5', 'r6']);
  });
});
