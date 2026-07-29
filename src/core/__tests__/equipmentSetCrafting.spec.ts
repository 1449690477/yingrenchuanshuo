import { describe, expect, it } from 'vitest';
import type { EquipmentDef, EquipSlot, FixedAffix } from '../types';
import {
  planEquipmentSetCrafting,
  type EquipmentSetCraftingRecipe,
} from '../equipmentSetCrafting';

const SET_ID = 'set_region_crimson';
const FRAGMENT_ID = 'frag_crimson';
const TARGET_SLOTS = [
  'weapon',
  'head',
  'body',
  'necklace',
  'ring',
  'bracelet',
] as const satisfies readonly EquipSlot[];

function definition(slot: EquipSlot, overrides: Partial<EquipmentDef> = {}): EquipmentDef {
  const common = {
    id: `eq_set_crimson_${slot}`,
    name: `绯焰测试·${slot}`,
    quality: 'legendary' as const,
    level: 50,
    setId: SET_ID,
    icon: `assets/equipment/r5/set/${slot}.png`,
    appearanceId: `r5-set-${slot}`,
  };
  const base: EquipmentDef =
    slot === 'weapon'
      ? { ...common, slot, element: 'fire' }
      : { ...common, slot };
  return { ...base, ...overrides } as EquipmentDef;
}

const definitions = Object.fromEntries(
  TARGET_SLOTS.map((slot) => [slot, definition(slot)]),
) as Record<(typeof TARGET_SLOTS)[number], EquipmentDef>;

const recipe: EquipmentSetCraftingRecipe = {
  id: 'craft_set_crimson',
  setId: SET_ID,
  fragmentItemId: FRAGMENT_ID,
  fragmentCount: 40,
  targetDefIds: Object.fromEntries(
    TARGET_SLOTS.map((slot) => [slot, definitions[slot].id]),
  ),
};

describe('套装通用碎片自选合成纯函数', () => {
  it('按玩家指定部位精确扣除 40 个通用碎片，用 seeded RNG 生成合法实例且不改输入', () => {
    const input = {
      recipe,
      targetSlot: 'weapon' as const,
      targetDefinition: definitions.weapon,
      classId: 'catkin' as const,
      uid: 'e77',
      wallet: {
        items: {
          [FRAGMENT_ID]: 47,
          frag_shadow: 9,
        },
      },
      rngState: 0x50_20_26,
    };
    const snapshot = structuredClone(input);

    const result = planEquipmentSetCrafting(input);
    const replay = planEquipmentSetCrafting(structuredClone(input));

    expect(result.ok).toBe(true);
    expect(replay).toEqual(result);
    if (!result.ok) return;
    expect(result).toMatchObject({
      recipeId: recipe.id,
      setId: SET_ID,
      targetSlot: 'weapon',
      targetDefId: definitions.weapon.id,
      cost: { itemId: FRAGMENT_ID, count: 40 },
      wallet: {
        items: {
          [FRAGMENT_ID]: 7,
          frag_shadow: 9,
        },
      },
      equipment: {
        uid: 'e77',
        defId: definitions.weapon.id,
        enhance: 0,
        reforgeResonance: 0,
        locked: true,
      },
    });
    expect(result.equipment.baseRollPermille).toBeGreaterThanOrEqual(1000);
    expect(result.equipment.baseRollPermille).toBeLessThanOrEqual(1200);
    expect(result.equipment.affixes).toHaveLength(4);
    expect(result.nextRngState).not.toBe(input.rngState);
    expect(input).toEqual(snapshot);
    expect(result.wallet.items).not.toBe(input.wallet.items);
  });

  it('碎片刚好够用时删除零数量键，其他资产原样保留', () => {
    const result = planEquipmentSetCrafting({
      recipe,
      targetSlot: 'body',
      targetDefinition: definitions.body,
      classId: 'swordsman',
      uid: 'e3',
      wallet: {
        items: {
          [FRAGMENT_ID]: 40,
          unrelated: 3,
        },
      },
      rngState: 123,
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.wallet.items).toEqual({ unrelated: 3 });
    }
  });

  it('错误材料不能冒充通用碎片，不足时返回权威碎片 ID 与实际持有量', () => {
    expect(
      planEquipmentSetCrafting({
        recipe,
        targetSlot: 'head',
        targetDefinition: definitions.head,
        classId: 'witch',
        uid: 'e1',
        wallet: { items: { frag_shadow: 999 } },
        rngState: 1,
      }),
    ).toEqual({
      ok: false,
      reason: 'insufficient-fragment',
      itemId: FRAGMENT_ID,
      required: 40,
      owned: 0,
    });

    expect(
      planEquipmentSetCrafting({
        recipe,
        targetSlot: 'head',
        targetDefinition: definitions.head,
        classId: 'witch',
        uid: 'e1',
        wallet: { items: { [FRAGMENT_ID]: 39 } },
        rngState: 1,
      }),
    ).toEqual({
      ok: false,
      reason: 'insufficient-fragment',
      itemId: FRAGMENT_ID,
      required: 40,
      owned: 39,
    });
  });

  it('R5 配方只开放固定六槽，腰带与鞋不会被偷偷扩成八件套', () => {
    expect(Object.keys(recipe.targetDefIds)).toEqual(TARGET_SLOTS);
    for (const targetSlot of ['belt', 'shoes'] as const) {
      expect(
        planEquipmentSetCrafting({
          recipe,
          targetSlot,
          targetDefinition: definition(targetSlot),
          classId: 'shaman',
          uid: 'e1',
          wallet: { items: { [FRAGMENT_ID]: 999 } },
          rngState: 1,
        }),
      ).toEqual({
        ok: false,
        reason: 'unsupported-slot',
        recipeId: recipe.id,
        targetSlot,
      });
    }
  });

  it('拒绝非法槽、重复目标、目标定义错配、错部位和错套装', () => {
    const call = (
      inputRecipe: EquipmentSetCraftingRecipe,
      targetDefinition: EquipmentDef = definitions.weapon,
    ) =>
      planEquipmentSetCrafting({
        recipe: inputRecipe,
        targetSlot: 'weapon',
        targetDefinition,
        classId: 'catkin',
        uid: 'e1',
        wallet: { items: { [FRAGMENT_ID]: 99 } },
        rngState: 1,
      });

    expect(() =>
      call({
        ...recipe,
        targetDefIds: {
          ...recipe.targetDefIds,
          cloak: 'eq_set_crimson_cloak',
        } as EquipmentSetCraftingRecipe['targetDefIds'],
      }),
    ).toThrow('非法装备槽');
    expect(() =>
      call({
        ...recipe,
        targetDefIds: {
          weapon: definitions.weapon.id,
          head: definitions.weapon.id,
        },
      }),
    ).toThrow('重复引用目标装备');
    expect(() => call(recipe, { ...definitions.weapon, id: 'wrong' })).toThrow(
      '目标定义错配',
    );
    expect(() =>
      call(recipe, {
        ...definitions.head,
        id: definitions.weapon.id,
      }),
    ).toThrow('不得把 weapon 合成为 head');
    expect(() =>
      call(recipe, {
        ...definitions.weapon,
        setId: 'set_wrong',
      }),
    ).toThrow('不属于套装');
  });

  it('固定模板沿用确定实例管线，不消耗 RNG 且仍自动锁定', () => {
    const fixedAffixes: FixedAffix[] = [
      { key: 'atk', value: 50 },
      { key: 'def', value: 40 },
      { key: 'hp', value: 300 },
      { key: 'critRate', value: 4 },
    ];
    const fixed = definition('head', {
      fixedTemplate: true,
      fixedAffixes,
    });
    const result = planEquipmentSetCrafting({
      recipe,
      targetSlot: 'head',
      targetDefinition: fixed,
      classId: 'swordsman',
      uid: 'e9',
      wallet: { items: { [FRAGMENT_ID]: 40 } },
      rngState: 0xffff_fffe,
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.nextRngState).toBe(0xffff_fffe);
    expect(result.equipment).toMatchObject({
      uid: 'e9',
      defId: fixed.id,
      baseRollPermille: 1000,
      affixes: [],
      locked: true,
    });
  });

  it('配置与钱包非法时直接暴露主流程错误，不被碎片不足掩盖', () => {
    const baseInput = {
      recipe,
      targetSlot: 'weapon' as const,
      targetDefinition: definitions.weapon,
      classId: 'swordsman' as const,
      uid: 'e1',
      wallet: { items: {} },
      rngState: 1,
    };

    expect(() =>
      planEquipmentSetCrafting({
        ...baseInput,
        recipe: { ...recipe, fragmentCount: 0 },
      }),
    ).toThrow('碎片数量必须是正安全整数');
    expect(() =>
      planEquipmentSetCrafting({
        ...baseInput,
        recipe: { ...recipe, targetDefIds: {} },
      }),
    ).toThrow('没有任何可合成部位');
    expect(() =>
      planEquipmentSetCrafting({
        ...baseInput,
        wallet: { items: { [FRAGMENT_ID]: -1 } },
      }),
    ).toThrow('必须是非负安全整数');
    expect(() =>
      planEquipmentSetCrafting({
        ...baseInput,
        rngState: -1,
      }),
    ).toThrow('RNG 状态必须是 uint32');
  });
});
