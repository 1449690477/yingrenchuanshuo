import { describe, expect, it } from 'vitest';
import type { EquipmentInstance, EquipSlot } from '@/core/types';
import {
  resolveCharacterAppearance,
  type EquippedRecord,
} from '../characterAppearance';

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
    expect(appearance.signature).toBe(
      'body:r1-body|head:r2-head|weapon:r1-weapon',
    );
    expect(appearance.equippedCount).toBe(4);
    expect(appearance.visibleEquippedCount).toBe(3);
    expect(appearance.highestVisibleQuality).toBe('rare');
    expect(appearance.enhanceStage).toBe(2);
    expect(appearance.growthTier.id).toBe('moon');
    expect(appearance.ariaLabel).toContain('樱色连衣裙');
    expect(appearance.ariaLabel).toContain('稻草帽');
    expect(appearance.ariaLabel).toContain('樱枝短剑');
  });

  it('空装角色明确解析为训练底模，不静默引用旧立绘', () => {
    const appearance = resolveCharacterAppearance('shaman', 1, emptyEquipped());

    expect(appearance.layers).toEqual([]);
    expect(appearance.signature).toBe('base');
    expect(appearance.baseAsset).toBe(
      'assets/characters/modular/shaman/base.png',
    );
    expect(appearance.ariaLabel).toContain('基础训练装');
  });
});
