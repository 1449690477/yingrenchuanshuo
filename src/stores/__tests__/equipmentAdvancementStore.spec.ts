import 'fake-indexeddb/auto';
import { createPinia, setActivePinia } from 'pinia';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createInstance } from '@/core/equipment';
import { Rng } from '@/core/rng';
import type { EquipmentInstance } from '@/core/types';
import { requireEquipment } from '@/data/equipment';
import { createSave } from '@/save/schema';
import { clearSave, loadSave } from '@/save/storage';
import { useGameStore } from '../game';
import { useInventoryStore } from '../inventory';

const SOURCE_ID = 'eq_r1_weapon_rare';
const TARGET_ID = 'eq_r2_weapon_rare';

beforeEach(async () => {
  setActivePinia(createPinia());
  await clearSave();
});

afterEach(async () => {
  vi.restoreAllMocks();
  await clearSave();
});

function jsonClone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function advancementSave(location: 'bag' | 'equipped' = 'bag') {
  const save = createSave('升阶测试', 'swordsman', 0x63_34_12, Date.now());
  save.player.level = 120;
  save.player.gold = 10_000;
  save.bag.items = {
    honey_bee: 20,
    crystal_altar: 5,
    unrelated: 9,
  };

  const instance = createInstance(
    requireEquipment(SOURCE_ID),
    new Rng(20260729),
    'advancement-e1',
    save.player.classId,
  );
  instance.enhance = 6;
  instance.enhanceGainPermille.splice(0, 6, 80, 81, 82, 83, 94, 112);
  instance.enhanceLuck['7'] = 23;
  instance.reforgeResonance = 2;
  instance.locked = true;
  save.nextUid = 2;

  if (location === 'bag') save.bag.equipment.push(instance);
  else save.equipped.weapon = instance;
  return { save, instance };
}

function owned(game: ReturnType<typeof useGameStore>, uid: string): EquipmentInstance {
  const bagInstance = game.save?.bag.equipment.find((instance) => instance.uid === uid);
  if (bagInstance) return bagInstance;
  const equippedInstance = Object.values(game.save?.equipped ?? {}).find(
    (instance) => instance?.uid === uid,
  );
  if (!equippedInstance) throw new Error(`测试装备不存在：${uid}`);
  return equippedInstance;
}

describe('game store 装备跨区升阶事务', () => {
  it('背包装备精确扣费、原地换定义并持久化全部既有投入', async () => {
    const game = useGameStore();
    const inventory = useInventoryStore();
    const { save, instance } = advancementSave();
    const beforeRng = save.rngState;
    const beforeNextUid = save.nextUid;
    const investment = jsonClone(instance);
    game.loadFrom(save);

    expect(inventory.equipmentAdvancementOption(instance.uid)).toMatchObject({
      source: { id: SOURCE_ID },
      target: { id: TARGET_ID, level: 18 },
      requirement: {
        fineItemId: 'honey_bee',
        rareItemId: 'crystal_altar',
        fineCount: 15,
        rareCount: 3,
        goldPerTargetLevel: 200,
      },
    });

    const reactiveInstance = owned(game, instance.uid);
    const result = inventory.advanceEquipment(instance.uid, SOURCE_ID);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result).toMatchObject({
      sourceDefId: SOURCE_ID,
      targetDefId: TARGET_ID,
      cost: {
        gold: 3_600,
        items: { honey_bee: 15, crystal_altar: 3 },
      },
    });
    expect(result.equipment).toBe(reactiveInstance);
    expect(owned(game, instance.uid)).toBe(reactiveInstance);
    expect(jsonClone(reactiveInstance)).toEqual({ ...investment, defId: TARGET_ID });
    expect(game.save?.player.gold).toBe(6_400);
    expect(game.save?.bag.items).toEqual({
      honey_bee: 5,
      crystal_altar: 2,
      unrelated: 9,
    });
    expect(game.save?.rngState).toBe(beforeRng);
    expect(game.save?.nextUid).toBe(beforeNextUid);

    await game.persist();
    const persisted = await loadSave();
    expect(persisted?.bag.equipment[0]).toEqual({ ...investment, defId: TARGET_ID });
    expect(persisted?.player.gold).toBe(6_400);
    expect(persisted?.bag.items).toEqual({
      honey_bee: 5,
      crystal_altar: 2,
      unrelated: 9,
    });
    expect(persisted?.rngState).toBe(beforeRng);
    expect(persisted?.nextUid).toBe(beforeNextUid);
  });

  it('穿戴装备走同一事务且不替换响应式实例引用', () => {
    const game = useGameStore();
    const { save, instance } = advancementSave('equipped');
    game.loadFrom(save);
    const reactiveInstance = game.save!.equipped.weapon!;

    const result = game.advanceEquipment(instance.uid, SOURCE_ID);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(game.save?.equipped.weapon).toBe(reactiveInstance);
    expect(result.equipment).toBe(reactiveInstance);
    expect(reactiveInstance.defId).toBe(TARGET_ID);
    expect(game.save?.bag.equipment).toHaveLength(0);
  });

  it('旧弹层或双击只成功一次，第二次不会顺势再跨一个区域', () => {
    const game = useGameStore();
    const { save, instance } = advancementSave();
    game.loadFrom(save);

    expect(game.advanceEquipment(instance.uid, SOURCE_ID).ok).toBe(true);
    const afterFirst = jsonClone(game.save);
    const second = game.advanceEquipment(instance.uid, SOURCE_ID);

    expect(second).toEqual({
      ok: false,
      reason: 'source-changed',
      expectedSourceDefId: SOURCE_ID,
      currentSourceDefId: TARGET_ID,
    });
    expect(game.save).toEqual(afterFirst);
  });

  it('无存档、装备不存在与没有同品质路线都返回明确原因', () => {
    const game = useGameStore();
    expect(game.advanceEquipment('missing', SOURCE_ID)).toEqual({
      ok: false,
      reason: 'no-save',
    });

    const { save, instance } = advancementSave();
    game.loadFrom(save);
    expect(game.advanceEquipment('missing', SOURCE_ID)).toEqual({
      ok: false,
      reason: 'not-found',
    });

    instance.defId = 'eq_r1_weapon_common';
    expect(game.equipmentAdvancementOption(instance.uid)).toBeUndefined();
    expect(game.advanceEquipment(instance.uid, 'eq_r1_weapon_common')).toEqual({
      ok: false,
      reason: 'no-route',
    });
  });

  it('等级、金币、两档材料与待确认洗练不足时资产和装备完全不变', () => {
    const cases: ReadonlyArray<{
      mutate: (game: ReturnType<typeof useGameStore>, instance: EquipmentInstance) => void;
      expected: object;
    }> = [
      {
        mutate: (game) => {
          game.save!.player.level = 17;
        },
        expected: {
          ok: false,
          reason: 'level-locked',
          requiredLevel: 18,
          playerLevel: 17,
        },
      },
      {
        mutate: (game) => {
          game.save!.player.gold = 3_599;
        },
        expected: { ok: false, reason: 'insufficient-gold', required: 3_600, owned: 3_599 },
      },
      {
        mutate: (game) => {
          game.save!.bag.items.honey_bee = 14;
        },
        expected: {
          ok: false,
          reason: 'insufficient-item',
          itemId: 'honey_bee',
          required: 15,
          owned: 14,
        },
      },
      {
        mutate: (game) => {
          game.save!.bag.items.crystal_altar = 2;
        },
        expected: {
          ok: false,
          reason: 'insufficient-item',
          itemId: 'crystal_altar',
          required: 3,
          owned: 2,
        },
      },
      {
        mutate: (_game, instance) => {
          const current = instance.affixes[0];
          if (!current) throw new Error('测试装备必须拥有至少一条词条');
          instance.pendingAffixChange = {
            operation: 'temper',
            affixIndex: 0,
            candidate: { ...current },
          };
        },
        expected: { ok: false, reason: 'pending-affix-change' },
      },
    ];

    for (const testCase of cases) {
      setActivePinia(createPinia());
      const game = useGameStore();
      const { save, instance } = advancementSave();
      game.loadFrom(save);
      const reactiveInstance = owned(game, instance.uid);
      testCase.mutate(game, reactiveInstance);
      const before = jsonClone(game.save);

      expect(game.advanceEquipment(instance.uid, SOURCE_ID)).toEqual(testCase.expected);
      expect(game.save).toEqual(before);
    }
  });
});
