import { describe, expect, it } from 'vitest';
import type { EquipmentDef, EquipmentInstance } from '../types';
import {
  equipmentAdvancementCost,
  planEquipmentAdvancement,
  type EquipmentAdvancementRequirement,
} from '../equipmentAdvancement';

const source: EquipmentDef = {
  id: 'eq_r2_weapon_rare',
  name: '旧武器',
  slot: 'weapon',
  quality: 'rare',
  level: 18,
  icon: 'old.png',
  appearanceId: 'r2-weapon',
  element: 'fire',
};

const target: EquipmentDef = {
  ...source,
  id: 'eq_r3_weapon_rare',
  name: '新武器',
  level: 28,
  icon: 'new.png',
  appearanceId: 'r3-weapon',
};

const requirement: EquipmentAdvancementRequirement = {
  fineItemId: 'silk_spider',
  rareItemId: 'egg_broodmother',
  fineCount: 15,
  rareCount: 3,
  goldPerTargetLevel: 200,
};

function instance(overrides: Partial<EquipmentInstance> = {}): EquipmentInstance {
  return {
    uid: 'eq-1',
    defId: source.id,
    enhance: 11,
    baseRollPermille: 1088,
    enhanceGainPermille: [32, 36, 40, 44, 48, 52, 56, 60, 64, 68, 72, 0, 0, 0, 0],
    enhanceLuck: { '12': 630 },
    affixes: [
      { key: 'atk', value: 18, tier: 4 },
      { key: 'critRate', value: 2.4, tier: 3 },
    ],
    reforgeResonance: 17,
    locked: true,
    ...overrides,
  };
}

describe('装备跨区升阶纯函数', () => {
  it('精确扣费且除 defId 外完整保留玩家投入，不修改输入', () => {
    const originalInstance = instance();
    const originalWallet = {
      gold: 10_000,
      items: {
        silk_spider: 21,
        egg_broodmother: 5,
        unrelated: 9,
      },
    };
    const instanceSnapshot = structuredClone(originalInstance);
    const walletSnapshot = structuredClone(originalWallet);

    const result = planEquipmentAdvancement({
      instance: originalInstance,
      sourceDefinition: source,
      targetDefinition: target,
      playerLevel: 40,
      wallet: originalWallet,
      requirement,
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.cost).toEqual({
      gold: 5_600,
      items: { silk_spider: 15, egg_broodmother: 3 },
    });
    expect(result.wallet).toEqual({
      gold: 4_400,
      items: { silk_spider: 6, egg_broodmother: 2, unrelated: 9 },
    });
    expect(result.equipment).toEqual({ ...instanceSnapshot, defId: target.id });
    expect(result.equipment).not.toBe(originalInstance);
    expect(result.equipment.affixes).not.toBe(originalInstance.affixes);
    expect(result.equipment.enhanceGainPermille).not.toBe(
      originalInstance.enhanceGainPermille,
    );
    expect(originalInstance).toEqual(instanceSnapshot);
    expect(originalWallet).toEqual(walletSnapshot);
  });

  it('材料刚好够用时删除零数量键，保持钱包规范形态', () => {
    const result = planEquipmentAdvancement({
      instance: instance(),
      sourceDefinition: source,
      targetDefinition: target,
      playerLevel: target.level,
      wallet: {
        gold: 5_600,
        items: { silk_spider: 15, egg_broodmother: 3, unrelated: 9 },
      },
      requirement,
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.wallet).toEqual({ gold: 0, items: { unrelated: 9 } });
  });

  it('未确认洗练候选硬锁，绝不自动采用、保留或清空', () => {
    const pendingInstance = instance({
      pendingAffixChange: {
        operation: 'reforge',
        affixIndex: 0,
        candidate: { key: 'hp', value: 30, tier: 4 },
      },
    });
    expect(
      planEquipmentAdvancement({
        instance: pendingInstance,
        sourceDefinition: source,
        targetDefinition: target,
        playerLevel: 40,
        wallet: {
          gold: 10_000,
          items: { silk_spider: 99, egg_broodmother: 99 },
        },
        requirement,
      }),
    ).toEqual({ ok: false, reason: 'pending-affix-change' });
    expect(pendingInstance.defId).toBe(source.id);
    expect(pendingInstance.pendingAffixChange).toBeDefined();
  });

  it('锁定只防分解，不阻止养成并原样保留', () => {
    const result = planEquipmentAdvancement({
      instance: instance({ locked: true }),
      sourceDefinition: source,
      targetDefinition: target,
      playerLevel: 40,
      wallet: {
        gold: 10_000,
        items: { silk_spider: 15, egg_broodmother: 3 },
      },
      requirement,
    });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.equipment.locked).toBe(true);
  });

  it('等级、金币、fine 与 rare 不足分别返回明确原因且输入不变', () => {
    const baseInput = {
      instance: instance(),
      sourceDefinition: source,
      targetDefinition: target,
      playerLevel: 40,
      wallet: {
        gold: 10_000,
        items: { silk_spider: 15, egg_broodmother: 3 },
      },
      requirement,
    };

    expect(
      planEquipmentAdvancement({ ...baseInput, playerLevel: 27 }),
    ).toEqual({
      ok: false,
      reason: 'level-locked',
      requiredLevel: 28,
      playerLevel: 27,
    });
    expect(
      planEquipmentAdvancement({
        ...baseInput,
        wallet: { ...baseInput.wallet, gold: 5_599 },
      }),
    ).toEqual({
      ok: false,
      reason: 'insufficient-gold',
      required: 5_600,
      owned: 5_599,
    });
    expect(
      planEquipmentAdvancement({
        ...baseInput,
        wallet: {
          gold: 10_000,
          items: { silk_spider: 14, egg_broodmother: 3 },
        },
      }),
    ).toEqual({
      ok: false,
      reason: 'insufficient-item',
      itemId: 'silk_spider',
      required: 15,
      owned: 14,
    });
    expect(
      planEquipmentAdvancement({
        ...baseInput,
        wallet: {
          gold: 10_000,
          items: { silk_spider: 15, egg_broodmother: 2 },
        },
      }),
    ).toEqual({
      ok: false,
      reason: 'insufficient-item',
      itemId: 'egg_broodmother',
      required: 3,
      owned: 2,
    });
    expect(baseInput.instance.defId).toBe(source.id);
    expect(baseInput.wallet.gold).toBe(10_000);
  });

  it('拒绝实例错配、同定义、非法等级、降级、换部位、换品质与特殊模板', () => {
    const call = (
      sourceDefinition: EquipmentDef,
      targetDefinition: EquipmentDef,
      inst = instance(),
    ) =>
      planEquipmentAdvancement({
        instance: inst,
        sourceDefinition,
        targetDefinition,
        playerLevel: 99,
        wallet: {
          gold: 99_999,
          items: { silk_spider: 99, egg_broodmother: 99 },
        },
        requirement,
      });

    expect(() => call(source, target, instance({ defId: 'wrong' }))).toThrow(
      '实例与来源定义不一致',
    );
    expect(() => call(source, { ...target, id: source.id })).toThrow(
      '来源与目标不能是同一装备',
    );
    expect(() => call({ ...source, level: 0 }, target)).toThrow(
      '来源装备等级必须是正安全整数',
    );
    expect(() => call(source, { ...target, level: Number.NaN })).toThrow(
      '目标装备等级必须是正安全整数',
    );
    expect(() => call(source, { ...target, level: source.level })).toThrow(
      '目标等级必须高于来源',
    );
    const wrongSlotTarget: EquipmentDef = {
      id: target.id,
      name: target.name,
      slot: 'head',
      quality: target.quality,
      level: target.level,
      icon: target.icon,
      appearanceId: target.appearanceId,
    };
    expect(() => call(source, wrongSlotTarget)).toThrow('不得改变部位');
    expect(() => call(source, { ...target, quality: 'epic' })).toThrow(
      '不得偷偷改变品质',
    );
    expect(() => call(source, { ...target, classId: 'witch' })).toThrow(
      '不得改变职业限制',
    );
    expect(() => call(source, { ...target, fixedTemplate: true })).toThrow(
      '不能走区域升阶',
    );
    expect(() => call(source, { ...target, extraAffixSlots: 1 })).toThrow(
      '额外词条槽',
    );
  });

  it('成本规则拒绝空材料、同材料与非法数量', () => {
    expect(equipmentAdvancementCost(target, requirement)).toEqual({
      gold: 5_600,
      items: { silk_spider: 15, egg_broodmother: 3 },
    });
    expect(() =>
      equipmentAdvancementCost(target, { ...requirement, fineItemId: '' }),
    ).toThrow('材料 ID 不能为空');
    expect(() =>
      equipmentAdvancementCost(target, {
        ...requirement,
        rareItemId: requirement.fineItemId,
      }),
    ).toThrow('必须不同');
    expect(() =>
      equipmentAdvancementCost(target, { ...requirement, rareCount: 0 }),
    ).toThrow('必须是正安全整数');

    expect(() =>
      planEquipmentAdvancement({
        instance: instance({
          pendingAffixChange: {
            operation: 'reforge',
            affixIndex: 0,
            candidate: { key: 'hp', value: 30, tier: 4 },
          },
        }),
        sourceDefinition: source,
        targetDefinition: target,
        playerLevel: 1,
        wallet: { gold: 0, items: {} },
        requirement: { ...requirement, rareCount: 0 },
      }),
    ).toThrow('必须是正安全整数');
  });
});
