import { describe, expect, it } from 'vitest';
import type { EquipmentSetDefinition } from '@/core/equipmentSets';
import type { EquipmentSetCraftingRecipe } from '@/core/equipmentSetCrafting';
import type { EquipmentDef, EquipSlot } from '@/core/types';
import type { ItemDef } from '../items';
import {
  createEquipmentSetCraftingRegistry,
  EQUIPMENT_SET_CRAFTING_RECIPES,
  getEquipmentSetCraftingRecipe,
  requireEquipmentSetCraftingRecipe,
  type EquipmentSetCraftingRegistryDependencies,
} from '../equipmentSetCrafting';

const SET_ID = 'set_region_crimson';
const TARGET_SLOTS = [
  'weapon',
  'head',
  'body',
  'necklace',
  'ring',
  'bracelet',
] as const satisfies readonly EquipSlot[];

function equipment(slot: EquipSlot): EquipmentDef {
  const common = {
    id: `eq_set_crimson_${slot}`,
    name: `绯焰·${slot}`,
    quality: 'legendary' as const,
    level: 50,
    setId: SET_ID,
    icon: `${slot}.png`,
    appearanceId: `r5-set-${slot}`,
  };
  return slot === 'weapon'
    ? { ...common, slot, element: 'fire' }
    : { ...common, slot };
}

const equipmentById = Object.fromEntries(
  TARGET_SLOTS.map((slot) => {
    const definition = equipment(slot);
    return [definition.id, definition];
  }),
) as Record<string, EquipmentDef>;

const fragment: ItemDef = {
  id: 'frag_crimson',
  name: '绯焰碎片',
  kind: 'fragment',
  tier: 'rare',
  desc: '测试碎片',
  icon: 'frag.png',
  sellPrice: 620,
};

const setDefinition: EquipmentSetDefinition = {
  id: SET_ID,
  name: '绯焰套',
  pieceSlots: TARGET_SLOTS,
  bonuses: [],
};

const recipe: EquipmentSetCraftingRecipe = {
  id: 'craft_set_crimson',
  setId: SET_ID,
  fragmentItemId: fragment.id,
  fragmentCount: 40,
  targetDefIds: Object.fromEntries(
    TARGET_SLOTS.map((slot) => [slot, `eq_set_crimson_${slot}`]),
  ),
};

function dependencies(
  overrides: Partial<EquipmentSetCraftingRegistryDependencies> = {},
): EquipmentSetCraftingRegistryDependencies {
  return {
    equipmentOf: (id) => equipmentById[id],
    itemOf: (id) => (id === fragment.id ? fragment : undefined),
    setOf: (id) => (id === setDefinition.id ? setDefinition : undefined),
    ...overrides,
  };
}

describe('套装通用碎片配方注册器', () => {
  it('严格注册 R5 的 frag_crimson×40 与固定六槽，并返回冻结副本', () => {
    const sourceSnapshot = structuredClone(recipe);
    const registry = createEquipmentSetCraftingRegistry([recipe], dependencies());
    const registered = registry[recipe.id];

    expect(registered).toEqual(recipe);
    expect(registered).not.toBe(recipe);
    expect(Object.keys(registered!.targetDefIds)).toEqual(TARGET_SLOTS);
    expect(registered).toMatchObject({
      setId: SET_ID,
      fragmentItemId: 'frag_crimson',
      fragmentCount: 40,
    });
    expect(Object.isFrozen(registry)).toBe(true);
    expect(Object.isFrozen(registered)).toBe(true);
    expect(Object.isFrozen(registered!.targetDefIds)).toBe(true);
    expect(recipe).toEqual(sourceSnapshot);
  });

  it('拒绝重复配方 ID 与同一套装的重复定义，防止后者静默覆盖前者', () => {
    expect(() =>
      createEquipmentSetCraftingRegistry([recipe, { ...recipe }], dependencies()),
    ).toThrow('配方 ID 重复');
    expect(() =>
      createEquipmentSetCraftingRegistry(
        [recipe, { ...recipe, id: 'craft_set_crimson_again' }],
        dependencies(),
      ),
    ).toThrow('重复定义套装');
  });

  it('拒绝不存在或非 fragment 的错误材料', () => {
    expect(() =>
      createEquipmentSetCraftingRegistry(
        [recipe],
        dependencies({ itemOf: () => undefined }),
      ),
    ).toThrow('不存在的碎片');
    expect(() =>
      createEquipmentSetCraftingRegistry(
        [recipe],
        dependencies({
          itemOf: () => ({ ...fragment, kind: 'material' }),
        }),
      ),
    ).toThrow('消耗必须是 fragment');
  });

  it('拒绝非法槽、重复目标、缺失目标、错部位与错套装装备', () => {
    expect(() =>
      createEquipmentSetCraftingRegistry(
        [
          {
            ...recipe,
            targetDefIds: {
              ...recipe.targetDefIds,
              cloak: 'eq_set_crimson_cloak',
            } as EquipmentSetCraftingRecipe['targetDefIds'],
          },
        ],
        dependencies(),
      ),
    ).toThrow('非法装备槽');

    expect(() =>
      createEquipmentSetCraftingRegistry(
        [
          {
            ...recipe,
            targetDefIds: {
              weapon: 'eq_set_crimson_weapon',
              head: 'eq_set_crimson_weapon',
            },
          },
        ],
        dependencies(),
      ),
    ).toThrow('重复引用目标装备');

    expect(() =>
      createEquipmentSetCraftingRegistry(
        [recipe],
        dependencies({ equipmentOf: () => undefined }),
      ),
    ).toThrow('目标装备不存在');

    expect(() =>
      createEquipmentSetCraftingRegistry(
        [recipe],
        dependencies({
          equipmentOf: (id) =>
            id === 'eq_set_crimson_weapon'
              ? { ...equipment('head'), id }
              : equipmentById[id],
        }),
      ),
    ).toThrow('weapon 目标实际是 head');

    expect(() =>
      createEquipmentSetCraftingRegistry(
        [recipe],
        dependencies({
          equipmentOf: (id) => {
            const definition = equipmentById[id];
            return definition ? { ...definition, setId: 'set_wrong' } : undefined;
          },
        }),
      ),
    ).toThrow('目标装备不属于套装');
  });

  it('拒绝缺失或错配的套装定义，以及空目标与非法数量', () => {
    expect(() =>
      createEquipmentSetCraftingRegistry(
        [recipe],
        dependencies({ setOf: () => undefined }),
      ),
    ).toThrow('不存在的套装');
    expect(() =>
      createEquipmentSetCraftingRegistry(
        [recipe],
        dependencies({
          setOf: () => ({ ...setDefinition, id: 'set_wrong' }),
        }),
      ),
    ).toThrow('套装查询结果错配');
    expect(() =>
      createEquipmentSetCraftingRegistry(
        [{ ...recipe, targetDefIds: {} }],
        dependencies(),
      ),
    ).toThrow('没有任何可合成部位');
    expect(() =>
      createEquipmentSetCraftingRegistry(
        [{ ...recipe, fragmentCount: 0 }],
        dependencies(),
      ),
    ).toThrow('碎片数量必须是正安全整数');
  });

  it('生产注册表接入真实 R5 六件目标，查询接口返回同一冻结配方', () => {
    const production = getEquipmentSetCraftingRecipe('craft_set_crimson');
    expect(production).toEqual({
      id: 'craft_set_crimson',
      setId: SET_ID,
      fragmentItemId: 'frag_crimson',
      fragmentCount: 40,
      targetDefIds: {
        weapon: 'eq_set_region_crimson_weapon',
        head: 'eq_set_region_crimson_head',
        body: 'eq_set_region_crimson_body',
        necklace: 'eq_set_region_crimson_necklace',
        ring: 'eq_set_region_crimson_ring',
        bracelet: 'eq_set_region_crimson_bracelet',
      },
    });
    expect(Object.keys(EQUIPMENT_SET_CRAFTING_RECIPES)).toEqual([
      'craft_set_crimson',
    ]);
    expect(requireEquipmentSetCraftingRecipe('craft_set_crimson')).toBe(production);
    expect(Object.isFrozen(production)).toBe(true);
  });
});
