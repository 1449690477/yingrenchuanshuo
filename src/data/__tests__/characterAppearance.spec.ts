import { describe, expect, it } from 'vitest';
import type { EquipmentInstance, EquipSlot } from '@/core/types';
import { ENHANCE_MAX } from '@/data/constants';
import {
  REGION_34_EQUIPMENT_APPEARANCES,
  requireEquipmentAppearance,
  resolveCharacterAppearance,
  type EquippedRecord,
} from '../characterAppearance';
import { AFFECTION_EQUIPMENT_LIST } from '../affectionEquipment';
import { ARENA_EQUIPMENT_LIST } from '../arenaEquipment';

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
    reforgeResonance: 0,
    locked: false,
  };
}

describe('角色换装外观解析', () => {
  it('樱酱的区域整身图替换底模，头饰与武器仍按层叠加且不影响其他职业', () => {
    const regionalBodies = [
      'r1-body',
      'r2-body',
      'r3-body',
      'r4-body',
      'r5-body',
      'r5-set-body',
      'r6-body',
      'r6-set-body',
      'r7-body',
      'r7-set-body',
    ];
    for (const id of regionalBodies) {
      const appearance = requireEquipmentAppearance(id);
      expect(appearance.renderMode).toBe('layer');
      if (appearance.renderMode !== 'layer') continue;
      expect(appearance.replacementClasses).toEqual(['kenshi']);
    }

    const equipped = emptyEquipped();
    equipped.body = instance('eq_r1_body_rare');
    equipped.head = instance('eq_r1_head_common');
    equipped.weapon = instance('eq_r1_weapon_common');

    const kenshi = resolveCharacterAppearance('kenshi', 20, equipped);
    expect(kenshi.baseAsset).toBe('assets/characters/modular/kenshi/r1-body.png');
    expect(kenshi.layers.map(({ slot }) => slot)).toEqual(['head', 'weapon']);
    expect(kenshi.signature).toBe('body:r1-body|head:r1-head|weapon:r1-weapon');

    const witch = resolveCharacterAppearance('witch', 20, equipped);
    expect(witch.baseAsset).toBe('assets/characters/modular/witch/base.png');
    expect(witch.layers.map(({ slot }) => slot)).toEqual(['body', 'head', 'weapon']);
  });

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
    expect(appearance.ariaLabel).toContain('花羽魔杖');
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

  it('喵喵基础、两区装备和珍品换装都解析到独立 catkin 图层', () => {
    const equipped = emptyEquipped();
    equipped.weapon = instance('eq_shop_berry-cream_weapon_catkin');
    equipped.body = instance('eq_shop_berry-cream_body');
    equipped.head = instance('eq_r2_head_fine');

    const appearance = resolveCharacterAppearance('catkin', 30, equipped);

    expect(appearance.baseAsset).toBe('assets/characters/modular/catkin/base.png');
    expect(appearance.layers.map((layer) => layer.asset)).toEqual([
      'assets/characters/modular/shop/berry-cream/catkin-body.png',
      'assets/characters/modular/catkin/r2-head.png',
      'assets/characters/modular/shop/berry-cream/catkin-weapon.png',
    ]);
    expect(appearance.activeBoutiqueTheme).toBe('berry-cream');
    expect(appearance.boutiqueEffectAsset).toBe(
      'assets/effects/boutique/berry-cream-catkin.png',
    );
  });

  it('樱酱底模、区域装、精品与副本均只解析 kenshi 专属资产', () => {
    const equipped = emptyEquipped();
    equipped.weapon = instance('eq_shop_berry-cream_weapon_kenshi');
    equipped.body = instance('eq_dungeon_azure_body_kenshi');
    equipped.head = instance('eq_r2_head_fine');

    const appearance = resolveCharacterAppearance('kenshi', 30, equipped);

    expect(appearance.baseAsset).toBe(
      'assets/characters/modular/dungeon/azure/kenshi-body.png',
    );
    expect(appearance.layers.map((layer) => layer.asset)).toEqual([
      'assets/characters/modular/kenshi/r2-head.png',
      'assets/characters/modular/shop/berry-cream/kenshi-weapon.png',
    ]);
    expect(appearance.boutiqueEffectAsset).toBe(
      'assets/effects/boutique/berry-cream-kenshi.png',
    );
    expect(
      [appearance.baseAsset, ...appearance.layers.map((layer) => layer.asset)].every(
        (asset) => !asset.includes('catkin'),
      ),
    ).toBe(true);
  });

  it('樱酱四件圣痕与十件心虹装备单穿时都真实改变对应部位', () => {
    const definitions = [
      ...ARENA_EQUIPMENT_LIST.filter((definition) => definition.classId === 'kenshi'),
      ...AFFECTION_EQUIPMENT_LIST.filter((entry) => entry.classId === 'kenshi').map(
        (entry) => entry.definition,
      ),
    ];

    expect(definitions).toHaveLength(14);
    for (const definition of definitions) {
      const equipped = emptyEquipped();
      equipped[definition.slot] = instance(definition.id);
      const appearance = resolveCharacterAppearance('kenshi', 60, equipped);

      expect(appearance.equippedCount, definition.id).toBe(1);
      expect(appearance.visibleEquippedCount, definition.id).toBe(1);
      if (definition.slot === 'body') {
        expect(appearance.layers, definition.id).toHaveLength(0);
        expect(appearance.baseAsset, definition.id).toContain(
          `/kenshi/${definition.icon.split('/').at(-1)}`,
        );
      } else {
        expect(appearance.layers, definition.id).toHaveLength(1);
        expect(appearance.layers[0]?.slot, definition.id).toBe(definition.slot);
        expect(appearance.layers[0]?.asset, definition.id).toContain(
          `/kenshi/${definition.icon.split('/').at(-1)}`,
        );
      }
    }
  });

  it('纸箱键帽套使用喵喵专属整身替换并只叠加同画布双爪', () => {
    const equipped = emptyEquipped();
    equipped.body = instance('eq_shop_cardboard-cat_body_catkin');
    equipped.weapon = instance('eq_shop_cardboard-cat_weapon_catkin');

    const appearance = resolveCharacterAppearance('catkin', 30, equipped);

    expect(appearance.baseAsset).toBe(
      'assets/characters/modular/shop/cardboard-cat/catkin-body.png',
    );
    expect(appearance.layers.map((layer) => layer.asset)).toEqual([
      'assets/characters/modular/shop/cardboard-cat/catkin-weapon.png',
    ]);
    expect(appearance.activeBoutiqueTheme).toBe('cardboard-cat');
    expect(appearance.boutiqueEffectAsset).toBe(
      'assets/effects/boutique/cardboard-cat-catkin.png',
    );
    expect(appearance.ariaLabel).toContain('纸箱键帽机动工装');
    expect(appearance.ariaLabel).toContain('键帽疾打晶爪');
  });

  it('装备副本礼服使用整人替换，头冠与武器继续独立叠加且不冒充商店主题', () => {
    const equipped = emptyEquipped();
    equipped.body = instance('eq_dungeon_azure_body_witch');
    equipped.head = instance('eq_dungeon_azure_head_1');
    equipped.weapon = instance('eq_dungeon_azure_weapon_witch');

    const appearance = resolveCharacterAppearance('witch', 20, equipped);

    expect(appearance.baseAsset).toBe(
      'assets/characters/modular/dungeon/azure/witch-body.png',
    );
    expect(appearance.layers.map((layer) => layer.asset)).toEqual([
      'assets/characters/modular/dungeon/azure/witch-head.png',
      'assets/characters/modular/dungeon/azure/witch-weapon.png',
    ]);
    expect(appearance.visibleEquippedCount).toBe(3);
    expect(appearance.activeDungeonTier).toBe('azure');
    expect(appearance.activeBoutiqueTheme).toBeNull();
    expect(appearance.boutiqueEffectAsset).toBeNull();
    expect(appearance.signature).toContain('body:dungeon-azure-body');
    expect(appearance.signature).toContain('dungeon:azure');
    expect(appearance.ariaLabel).toContain('晴蓝茶会共鸣外观');
  });

  it('仅穿戴副本首饰也会触发档位粒子，但不会伪造可见纸娃娃层', () => {
    const equipped = emptyEquipped();
    equipped.ring = instance('eq_dungeon_crimson_ring_1');

    const appearance = resolveCharacterAppearance('catkin', 78, equipped);

    expect(appearance.layers).toEqual([]);
    expect(appearance.baseAsset).toBe('assets/characters/modular/catkin/base.png');
    expect(appearance.visibleEquippedCount).toBe(0);
    expect(appearance.activeDungeonTier).toBe('crimson');
    expect(appearance.ariaLabel).toContain('绯樱典藏共鸣外观');
  });

  it('装备可见鞋层时换用无靴底模，避免初始靴与新鞋双穿', () => {
    const equipped = emptyEquipped();
    equipped.shoes = instance('eq_shop_rose-night_shoes');

    const appearance = resolveCharacterAppearance('shaman', 20, equipped);

    expect(appearance.baseAsset).toBe('assets/characters/modular/shaman/base-noshoes.png');
    expect(appearance.layers.map((layer) => layer.slot)).toEqual(['shoes']);
  });

  it('整身替换优先于无靴底模：副本礼服不被商店鞋换掉底模', () => {
    const equipped = emptyEquipped();
    equipped.body = instance('eq_dungeon_azure_body_witch');
    equipped.shoes = instance('eq_shop_rose-night_shoes');

    const appearance = resolveCharacterAppearance('witch', 20, equipped);

    expect(appearance.baseAsset).toBe('assets/characters/modular/dungeon/azure/witch-body.png');
  });

  it('精品店帽饰声明提到脸层之上，副本鞋不再叠加到人物身上', () => {
    const equipped = emptyEquipped();
    equipped.head = instance('eq_shop_rose-night_head');
    equipped.shoes = instance('eq_dungeon_azure_shoes_1');

    const appearance = resolveCharacterAppearance('catkin', 20, equipped);

    expect(appearance.layers).toHaveLength(1);
    expect(appearance.layers[0]?.slot).toBe('head');
    expect(appearance.layers[0]?.aboveFace).toBe(true);
    expect(appearance.visibleEquippedCount).toBe(1);
    expect(appearance.equippedCount).toBe(2);
  });

  it('区域 3/4 的八个部位都显式登记，三个可见槽为五职业独立图层', () => {    for (const regionId of ['r3', 'r4']) {
      for (const slot of ['body', 'head', 'weapon'] as const) {
        const appearance = REGION_34_EQUIPMENT_APPEARANCES[`${regionId}-${slot}`];
        expect(appearance).toBeDefined();
        if (!appearance) continue;
        expect(appearance.renderMode).toBe('layer');
        if (appearance.renderMode !== 'layer') continue;
        expect(appearance.slot).toBe(slot);
        expect(appearance.replacementClasses).toEqual(
          slot === 'body' ? ['kenshi'] : undefined,
        );
        expect(Object.keys(appearance.assets).sort()).toEqual([
          'catkin',
          'kenshi',
          'shaman',
          'swordsman',
          'witch',
        ]);
        expect(new Set(Object.values(appearance.assets)).size).toBe(5);
        for (const [classId, asset] of Object.entries(appearance.assets)) {
          expect(asset).toBe(
            `assets/characters/modular/${classId}/${regionId}-${slot}.png`,
          );
        }
      }
      for (const slot of ['necklace', 'bracelet', 'ring', 'belt', 'shoes'] as const) {
        expect(REGION_34_EQUIPMENT_APPEARANCES[`${regionId}-${slot}`]).toEqual({
          id: `${regionId}-${slot}`,
          slot,
          renderMode: 'slot-only',
        });
      }
    }
  });
});
