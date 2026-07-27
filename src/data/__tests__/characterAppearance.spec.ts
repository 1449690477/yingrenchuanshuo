import { describe, expect, it } from 'vitest';
import type { EquipmentInstance, EquipSlot } from '@/core/types';
import { ENHANCE_MAX } from '@/data/constants';
import { resolveCharacterAppearance, type EquippedRecord } from '../characterAppearance';

const emptyEquipped = (): EquippedRecord => ({
  weapon: null,
  head: null,
  body: null,
  necklace: null,
  bracelet: null,
  ring: null,
  belt: null,
  shoes: null,
});

function instance(defId: string, enhance = 0): EquipmentInstance {
  return {
    uid: `test-${defId}`,
    defId,
    enhance,
    baseRollPermille: 1000,
    enhanceGainPermille: Array.from({ length: ENHANCE_MAX }, (_, index) =>
      index < enhance ? 80 : 0,
    ),
    enhanceLuck: {},
    affixes: [],
    locked: false,
  };
}

describe('角色换装外观解析', () => {
  it('混穿两区装备时三个主要部位独立解析并按稳定层级排序', () => {
    const equipped = emptyEquipped();
    equipped.weapon = instance('eq_r1_weapon_common', 10);
    equipped.head = instance('eq_r2_head_fine');
    equipped.body = instance('eq_r1_body_rare');
    equipped.necklace = instance('eq_r2_necklace_fine');

    const appearance = resolveCharacterAppearance('witch', 20, equipped);

    expect(appearance.layers.map((layer) => layer.slot)).toEqual([
      'body',
      'head',
      'weapon',
    ] satisfies EquipSlot[]);
    expect(appearance.signature).toBe('body:r1-body|head:r2-head|weapon:r1-weapon');
    expect(appearance.equippedCount).toBe(4);
    expect(appearance.visibleEquippedCount).toBe(3);
    expect(appearance.highestVisibleQuality).toBe('rare');
    expect(appearance.forgeStage).toBe('radiant');
    expect(appearance.weaponForgeStage).toBe('radiant');
    expect(appearance.growthTier.id).toBe('moon');
    expect(appearance.ariaLabel).toContain('樱色连衣裙');
    expect(appearance.ariaLabel).toContain('稻草帽');
    expect(appearance.ariaLabel).toContain('樱枝短剑');
  });

  it('仅穿戴 +15 的槽位首饰时不触发全身或武器锻造视觉', () => {
    const equipped = emptyEquipped();
    equipped.necklace = instance('eq_r1_necklace_common', 15);

    const appearance = resolveCharacterAppearance('witch', 20, equipped);

    expect(appearance.layers).toEqual([]);
    expect(appearance.equippedCount).toBe(1);
    expect(appearance.visibleEquippedCount).toBe(0);
    expect(appearance.forgeStage).toBe('original');
    expect(appearance.weaponForgeStage).toBe('original');
  });

  it('+12 服装触发全身星铸视觉，但不会给未装备的武器增加光效', () => {
    const equipped = emptyEquipped();
    equipped.body = instance('eq_r1_body_rare', 12);

    const appearance = resolveCharacterAppearance('witch', 20, equipped);

    expect(appearance.forgeStage).toBe('starforged');
    expect(appearance.weaponForgeStage).toBe('original');
    expect(appearance.layers).toHaveLength(1);
    expect(appearance.layers[0]?.forgeStage).toBe('starforged');
  });

  it('+9 武器进入辉耀阶段，并同步驱动武器专属锻造视觉', () => {
    const equipped = emptyEquipped();
    equipped.weapon = instance('eq_r1_weapon_common', 9);

    const appearance = resolveCharacterAppearance('witch', 20, equipped);

    expect(appearance.forgeStage).toBe('radiant');
    expect(appearance.weaponForgeStage).toBe('radiant');
    expect(appearance.layers).toHaveLength(1);
    expect(appearance.layers[0]?.forgeStage).toBe('radiant');
  });

  it('空装角色明确解析为训练底模，不静默引用旧立绘', () => {
    const appearance = resolveCharacterAppearance('shaman', 1, emptyEquipped());

    expect(appearance.layers).toEqual([]);
    expect(appearance.signature).toBe('base');
    expect(appearance.baseAsset).toBe('assets/characters/modular/shaman/base.png');
    expect(appearance.ariaLabel).toContain('基础训练装');
  });
});
