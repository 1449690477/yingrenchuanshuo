import { describe, expect, it } from 'vitest';
import type { Affix, EquipmentDef, EquipmentInstance } from '../types';
import {
  affixChangeCost,
  bindMaterialCost,
  planAffixChange,
  resonanceAfterRoll,
  resolvePendingAffixChange,
  type ReforgeWallet,
} from '../reforge';

const regionMaterials = {
  commonIds: ['petal_sakura', 'grass_soft'],
  fineId: 'bell_wood',
} as const;

function definition(overrides: Partial<EquipmentDef> = {}): EquipmentDef {
  return {
    id: 'test_epic',
    name: '测试史诗',
    slot: 'weapon',
    quality: 'epic',
    level: 20,
    element: 'fire',
    icon: 'assets/test.png',
    appearanceId: 'test',
    ...overrides,
  };
}

function affix(key: Affix['key'], tier: Affix['tier'], value: number): Affix {
  return { key, tier, value };
}

function instance(overrides: Partial<EquipmentInstance> = {}): EquipmentInstance {
  return {
    uid: 'e100',
    defId: 'test_epic',
    enhance: 0,
    baseRollPermille: 1000,
    enhanceGainPermille: Array(15).fill(0),
    enhanceLuck: {},
    affixes: [
      affix('atk', 3, 30),
      affix('critRate', 4, 2.2),
      affix('hp', 2, 160),
      affix('swd_guard', 3, 42),
    ],
    reforgeResonance: 0,
    locked: false,
    ...overrides,
  };
}

function mythicDefinition(): EquipmentDef {
  return definition({ id: 'test_mythic', name: '测试神话', quality: 'mythic' });
}

function mythicInstance(overrides: Partial<EquipmentInstance> = {}): EquipmentInstance {
  return instance({
    defId: 'test_mythic',
    // 神话职业槽已由 2 降为 1（见 constants.ts 说明），
    // 所以夹具是 4 条通用 + 1 条职业，索引 4 才是职业槽。
    affixes: [
      affix('atk', 3, 30),
      affix('def', 3, 25),
      affix('hp', 3, 180),
      affix('critRate', 3, 1.75),
      affix('swd_guard', 3, 42),
    ],
    ...overrides,
  });
}

function wallet(overrides: Partial<ReforgeWallet> = {}): ReforgeWallet {
  return {
    gold: 100_000,
    items: {
      stone_reforge: 100,
      sand_crystal: 100,
      charm_bind: 100,
      sigil_swordsman: 10,
      crystal_resonance: 10,
      petal_sakura: 100,
      grass_soft: 100,
      bell_wood: 100,
    },
    ...overrides,
  };
}

describe('洗练消耗', () => {
  it('锁定成本按 1/2/4/8 指数增长', () => {
    expect([0, 1, 2, 3, 4, 5].map(bindMaterialCost)).toEqual([0, 1, 2, 4, 8, 16]);
  });

  it('重铸同时消耗专用材料与当前区域 common/fine', () => {
    expect(
      affixChangeCost('reforge', 20, 4, 3, 'swordsman', regionMaterials),
    ).toEqual({
      gold: 1000,
      items: {
        stone_reforge: 5,
        petal_sakura: 10,
        grass_soft: 10,
        bell_wood: 2,
        charm_bind: 4,
      },
    });
  });

  it('淬炼、铭刻与同调使用策划公式', () => {
    expect(affixChangeCost('temper', 20, 4, 2, 'swordsman', regionMaterials)).toEqual({
      gold: 1600,
      items: { sand_crystal: 9, charm_bind: 2 },
    });
    expect(affixChangeCost('inscribe', 20, 2, 0, 'swordsman', regionMaterials)).toEqual({
      gold: 1000,
      items: {
        stone_reforge: 5,
        petal_sakura: 10,
        grass_soft: 10,
        bell_wood: 2,
        sigil_swordsman: 1,
      },
    });
    expect(affixChangeCost('resonate', 20, 4, 0, 'swordsman', regionMaterials)).toEqual({
      gold: 6000,
      items: { crystal_resonance: 4 },
    });
  });
});

describe('共鸣保底', () => {
  it('低阶累积、高阶清零且最多 20', () => {
    expect(resonanceAfterRoll(0, 1)).toBe(2);
    expect(resonanceAfterRoll(19, 1)).toBe(20);
    expect(resonanceAfterRoll(7, 2)).toBe(8);
    expect(resonanceAfterRoll(7, 3)).toBe(7);
    expect(resonanceAfterRoll(20, 4)).toBe(0);
    expect(resonanceAfterRoll(20, 5)).toBe(0);
  });
});

describe('洗练候选事务', () => {
  it('重铸只从未锁词条抽一条，先扣资产并持久化候选但不覆盖原词条', () => {
    const sourceInstance = instance();
    const sourceWallet = wallet();
    const beforeInstance = structuredClone(sourceInstance);
    const beforeWallet = structuredClone(sourceWallet);
    const result = planAffixChange({
      instance: sourceInstance,
      definition: definition(),
      operation: 'reforge',
      classId: 'swordsman',
      lockedIndices: [0, 2, 3],
      regionMaterials,
      wallet: sourceWallet,
      rngState: 20260728,
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.targetIndex).toBe(1);
    expect(result.candidate.key).not.toBe('critRate');
    expect(result.instance.affixes).toEqual(beforeInstance.affixes);
    expect(result.instance.pendingAffixChange).toEqual({
      operation: 'reforge',
      affixIndex: 1,
      candidate: result.candidate,
    });
    expect(result.wallet.gold).toBe(beforeWallet.gold - 1000);
    expect(result.wallet.items.charm_bind).toBe(96);
    expect(sourceInstance).toEqual(beforeInstance);
    expect(sourceWallet).toEqual(beforeWallet);
  });

  it('采用会替换目标，保留原样只清候选', () => {
    const planned = planAffixChange({
      instance: instance(),
      definition: definition(),
      operation: 'reforge',
      classId: 'swordsman',
      lockedIndices: [0, 2, 3],
      regionMaterials,
      wallet: wallet(),
      rngState: 88,
    });
    expect(planned.ok).toBe(true);
    if (!planned.ok) return;

    const kept = resolvePendingAffixChange(planned.instance, 'keep');
    expect(kept.adopted).toBe(false);
    expect(kept.instance.affixes[1]).toEqual(planned.previous);
    expect(kept.instance.pendingAffixChange).toBeUndefined();

    const adopted = resolvePendingAffixChange(planned.instance, 'adopt');
    expect(adopted.adopted).toBe(true);
    expect(adopted.instance.affixes[1]).toEqual(planned.candidate);
    expect(adopted.instance.pendingAffixChange).toBeUndefined();
  });

  it('共鸣满 20 后随机洗练必出 T4+ 并清零', () => {
    const result = planAffixChange({
      instance: instance({ reforgeResonance: 20 }),
      definition: definition(),
      operation: 'temper',
      classId: 'swordsman',
      lockedIndices: [1, 2, 3],
      regionMaterials,
      wallet: wallet(),
      rngState: 9,
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.pityTriggered).toBe(true);
    expect(result.candidate.tier).toBeGreaterThanOrEqual(4);
    expect(result.resonanceAfter).toBe(0);
  });

  it('淬炼保留词条类型和属性系别', () => {
    const elemental = { key: 'elemDmg', tier: 2, value: 5.4, element: 'ice' } as const;
    const result = planAffixChange({
      instance: instance({
        affixes: [elemental, affix('atk', 2, 10), affix('hp', 2, 80), affix('swd_guard', 2, 20)],
      }),
      definition: definition(),
      operation: 'temper',
      classId: 'swordsman',
      lockedIndices: [1, 2, 3],
      regionMaterials,
      wallet: wallet(),
      rngState: 4,
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.candidate.key).toBe('elemDmg');
    expect(result.candidate.element).toBe('ice');
  });

  it('铭刻候选必定来自当前职业池', () => {
    const result = planAffixChange({
      instance: instance(),
      definition: definition(),
      operation: 'inscribe',
      classId: 'witch',
      lockedIndices: [1, 2, 3],
      regionMaterials,
      wallet: wallet({ items: { ...wallet().items, sigil_witch: 1 } }),
      rngState: 41,
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(['wit_power', 'wit_elem']).toContain(result.candidate.key);
  });




  it('重铸命中职业槽必给职业词条，命中通用槽必给通用词条', () => {
    // 神话只有 1 个职业槽（索引 4）。槽位性质决定候选来源，不会串池。
    const professionKeys = new Set(['swd_guard', 'swd_heavy']);
    let hitProfessionSlot = 0;
    let hitCommonSlot = 0;
    for (let rngState = 1; rngState <= 40; rngState++) {
      const result = planAffixChange({
        instance: mythicInstance(),
        definition: mythicDefinition(),
        operation: 'reforge',
        classId: 'swordsman',
        regionMaterials,
        wallet: wallet(),
        rngState,
      });
      expect(result.ok).toBe(true);
      if (!result.ok) continue;
      if (result.targetIndex === 4) {
        hitProfessionSlot++;
        expect(professionKeys.has(result.candidate.key)).toBe(true);
      } else {
        hitCommonSlot++;
        expect(professionKeys.has(result.candidate.key)).toBe(false);
      }
    }
    expect(hitProfessionSlot).toBeGreaterThan(0);
    expect(hitCommonSlot).toBeGreaterThan(0);
  });

  it('铭刻把职业槽换成另一条可用的职业词条', () => {
    const result = planAffixChange({
      instance: mythicInstance(),
      definition: mythicDefinition(),
      operation: 'inscribe',
      classId: 'swordsman',
      regionMaterials,
      wallet: wallet({ items: { ...wallet().items, sigil_swordsman: 1 } }),
      rngState: 20260728,
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.targetIndex).toBe(4);
    expect(result.candidate.key).toBe('swd_heavy');
  });

  it('五槽全锁才是 all-affixes-locked，且不扣费、不推进 RNG', () => {
    const sourceInstance = mythicInstance();
    const sourceWallet = wallet();
    const allLocked = planAffixChange({
      instance: sourceInstance,
      definition: mythicDefinition(),
      operation: 'reforge',
      classId: 'swordsman',
      lockedIndices: [0, 1, 2, 3, 4],
      regionMaterials,
      wallet: sourceWallet,
      rngState: 77,
    });

    expect(allLocked).toEqual({ ok: false, reason: 'all-affixes-locked' });
    expect(sourceInstance).toEqual(mythicInstance());
    expect(sourceWallet).toEqual(wallet());
  });

  it('同调由玩家选定一条升一阶，不推进 RNG 和霉运值', () => {
    const result = planAffixChange({
      instance: instance({ reforgeResonance: 11 }),
      definition: definition(),
      operation: 'resonate',
      classId: 'swordsman',
      targetIndex: 1,
      regionMaterials,
      wallet: wallet(),
      rngState: 12345,
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.candidate.key).toBe('critRate');
    expect(result.candidate.tier).toBe(5);
    expect(result.nextRngState).toBe(12345);
    expect(result.resonanceAfter).toBe(11);
  });

  it('旧档技能倍率只能重铸或铭刻换掉，淬炼与同调不扣费也不推进 RNG', () => {
    const legacy = instance({
      affixes: [
        affix('skillMul', 3, 2.5),
        affix('atk', 3, 30),
        affix('swd_guard', 3, 42),
      ],
    });
    const sourceWallet = wallet();

    for (const operation of ['reforge', 'inscribe'] as const) {
      const result = planAffixChange({
        instance: legacy,
        definition: definition(),
        operation,
        classId: 'swordsman',
        lockedIndices: [1, 2],
        regionMaterials,
        wallet: sourceWallet,
        rngState: 20260728,
      });
      expect(result.ok, operation).toBe(true);
      if (!result.ok) continue;
      expect(result.targetIndex).toBe(0);
      expect(result.candidate.key).not.toBe('skillMul');
    }

    const temper = planAffixChange({
      instance: legacy,
      definition: definition(),
      operation: 'temper',
      classId: 'swordsman',
      lockedIndices: [1, 2],
      regionMaterials,
      wallet: sourceWallet,
      rngState: 20260728,
    });
    const resonate = planAffixChange({
      instance: legacy,
      definition: definition(),
      operation: 'resonate',
      classId: 'swordsman',
      targetIndex: 0,
      regionMaterials,
      wallet: sourceWallet,
      rngState: 20260728,
    });

    expect(temper).toEqual({ ok: false, reason: 'deferred-affix' });
    expect(resonate).toEqual({ ok: false, reason: 'deferred-affix' });
    expect(legacy.affixes[0]).toEqual(affix('skillMul', 3, 2.5));
    expect(sourceWallet).toEqual(wallet());
  });

  it('资产不足、全部锁定或已有候选时不产生第二个结果', () => {
    const insufficient = planAffixChange({
      instance: instance(),
      definition: definition(),
      operation: 'reforge',
      classId: 'swordsman',
      regionMaterials,
      wallet: wallet({ gold: 0 }),
      rngState: 7,
    });
    expect(insufficient).toMatchObject({ ok: false, reason: 'insufficient-gold' });

    const allLocked = planAffixChange({
      instance: instance(),
      definition: definition(),
      operation: 'temper',
      classId: 'swordsman',
      lockedIndices: [0, 1, 2, 3],
      regionMaterials,
      wallet: wallet(),
      rngState: 7,
    });
    expect(allLocked).toEqual({ ok: false, reason: 'all-affixes-locked' });

    const pending = planAffixChange({
      instance: instance({
        pendingAffixChange: {
          operation: 'temper',
          affixIndex: 0,
          candidate: affix('atk', 4, 40),
        },
      }),
      definition: definition(),
      operation: 'temper',
      classId: 'swordsman',
      regionMaterials,
      wallet: wallet(),
      rngState: 7,
    });
    expect(pending).toEqual({ ok: false, reason: 'pending-result' });
  });
});
