import 'fake-indexeddb/auto';
import { createPinia, setActivePinia } from 'pinia';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createInstance } from '@/core/equipment';
import { Rng } from '@/core/rng';
import type { EquipmentInstance } from '@/core/types';
import { requireEquipment } from '@/data/equipment';
import { createSave } from '@/save/schema';
import * as saveStorage from '@/save/storage';
import { clearSave, createSaveStorageClient, loadSave, SaveWriteError } from '@/save/storage';
import { useGameStore } from '../game';
import { useInventoryStore } from '../inventory';

const SOURCE_ID = 'eq_r1_weapon_rare';
const TARGET_ID = 'eq_r2_weapon_rare';

async function synchronizeAndClear(): Promise<void> {
  try {
    await loadSave();
  } catch {
    // 即使前一用例制造了冲突，先读取也会同步默认客户端 revision，随后可安全清档。
  }
  await clearSave();
}

beforeEach(async () => {
  setActivePinia(createPinia());
  await synchronizeAndClear();
});

afterEach(async () => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  await synchronizeAndClear();
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
  it('页面交接可按 UID 重新取得背包或穿戴中的当前实例', () => {
    const game = useGameStore();
    const inventory = useInventoryStore();
    const bagCase = advancementSave('bag');
    game.loadFrom(bagCase.save);
    expect(inventory.ownedEquipment(bagCase.instance.uid)).toBe(game.save?.bag.equipment[0]);

    const equippedCase = advancementSave('equipped');
    game.loadFrom(equippedCase.save);
    expect(inventory.ownedEquipment(equippedCase.instance.uid)).toBe(game.save?.equipped.weapon);
    expect(inventory.ownedEquipment('missing-uid')).toBeNull();
  });

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
    const result = await inventory.advanceEquipment(instance.uid, SOURCE_ID);

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

  it('穿戴装备走同一事务且不替换响应式实例引用', async () => {
    const game = useGameStore();
    const { save, instance } = advancementSave('equipped');
    game.loadFrom(save);
    const reactiveInstance = game.save!.equipped.weapon!;

    const result = await game.advanceEquipment(instance.uid, SOURCE_ID);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(game.save?.equipped.weapon).toBe(reactiveInstance);
    expect(result.equipment).toBe(reactiveInstance);
    expect(reactiveInstance.defId).toBe(TARGET_ID);
    expect(game.save?.bag.equipment).toHaveLength(0);
  });

  it('旧弹层在首笔落盘后不会顺势再跨一个区域', async () => {
    const game = useGameStore();
    const { save, instance } = advancementSave();
    game.loadFrom(save);

    expect((await game.advanceEquipment(instance.uid, SOURCE_ID)).ok).toBe(true);
    const afterFirst = jsonClone(game.save);
    const second = await game.advanceEquipment(instance.uid, SOURCE_ID);

    expect(second).toEqual({
      ok: false,
      reason: 'source-changed',
      expectedSourceDefId: SOURCE_ID,
      currentSourceDefId: TARGET_ID,
    });
    expect(game.save).toEqual(afterFirst);
  });

  it('首笔尚未落盘时拒绝第二次升阶与洗练，成功后旧来源才变为 source-changed', async () => {
    const game = useGameStore();
    const { save, instance } = advancementSave();
    game.loadFrom(save);
    await game.persist();

    let finishWrite: (() => void) | undefined;
    vi.spyOn(saveStorage, 'saveSave').mockReturnValueOnce(
      new Promise<void>((resolve) => {
        finishWrite = resolve;
      }),
    );

    const first = game.advanceEquipment(instance.uid, SOURCE_ID);
    expect(await game.advanceEquipment(instance.uid, SOURCE_ID)).toEqual({
      ok: false,
      reason: 'persistence-pending',
    });
    expect(await game.startAffixChange(instance.uid, 'reforge')).toEqual({
      ok: false,
      reason: 'persistence-pending',
    });

    finishWrite!();
    expect((await first).ok).toBe(true);
    expect(await game.advanceEquipment(instance.uid, SOURCE_ID)).toEqual({
      ok: false,
      reason: 'source-changed',
      expectedSourceDefId: SOURCE_ID,
      currentSourceDefId: TARGET_ID,
    });
  });

  it('写盘失败时精确恢复金币、材料、定义、RNG 与战力提示，磁盘也保持旧快照', async () => {
    const game = useGameStore();
    const { save, instance } = advancementSave();
    game.loadFrom(save);
    await game.persist();
    const reactiveInstance = owned(game, instance.uid);
    const before = jsonClone(game.save);
    const durableBefore = await loadSave();
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    vi.spyOn(saveStorage, 'saveSave').mockRejectedValueOnce(
      new SaveWriteError(new Error('quota exceeded')),
    );

    const result = await game.advanceEquipment(instance.uid, SOURCE_ID);

    expect(result).toEqual({ ok: false, reason: 'persistence-failed' });
    expect(game.save).toEqual(before);
    expect(owned(game, instance.uid)).toBe(reactiveInstance);
    expect(reactiveInstance.defId).toBe(SOURCE_ID);
    expect(game.cpDelta).toBeNull();
    expect(game.saveError).toContain('IndexedDB 写入失败');
    expect(await loadSave()).toEqual(durableBefore);
  });

  it('另一标签先写入时 CAS 冲突会回滚并停机，绝不覆盖权威新档', async () => {
    let nextRafId = 0;
    const requestFrame = vi.fn(() => ++nextRafId);
    vi.stubGlobal('document', { visibilityState: 'visible' });
    vi.stubGlobal('requestAnimationFrame', requestFrame);
    vi.stubGlobal('cancelAnimationFrame', vi.fn());
    vi.spyOn(console, 'error').mockImplementation(() => undefined);

    const game = useGameStore();
    const { save, instance } = advancementSave();
    game.loadFrom(save);
    await game.persist();

    const otherTab = createSaveStorageClient();
    const authoritative = await otherTab.loadSave();
    if (!authoritative) throw new Error('跨标签测试缺少初始存档');
    authoritative.player.gold += 777;
    await otherTab.saveSave(authoritative);

    const before = jsonClone(game.save);
    game.startLoop();
    requestFrame.mockClear();
    const result = await game.advanceEquipment(instance.uid, SOURCE_ID);

    expect(result).toEqual({ ok: false, reason: 'persistence-conflict' });
    expect(game.save).toEqual(before);
    expect(owned(game, instance.uid).defId).toBe(SOURCE_ID);
    expect(game.cpDelta).toBeNull();
    expect(game.loadError).toContain('另一页面已经更新');
    expect(requestFrame).not.toHaveBeenCalled();
    expect((await otherTab.loadSave())?.player.gold).toBe(authoritative.player.gold);
  });

  it('写盘期间 hidden→visible 不提前结算或重启，提交后至多恢复一条循环', async () => {
    let now = Date.UTC(2026, 6, 29, 8);
    let visibilityState: DocumentVisibilityState = 'visible';
    let nextRafId = 0;
    const requestFrame = vi.fn(() => ++nextRafId);
    vi.spyOn(Date, 'now').mockImplementation(() => now);
    vi.stubGlobal('document', {
      get visibilityState() {
        return visibilityState;
      },
    });
    vi.stubGlobal('requestAnimationFrame', requestFrame);
    vi.stubGlobal('cancelAnimationFrame', vi.fn());

    const game = useGameStore();
    const { save, instance } = advancementSave();
    game.loadFrom(save);
    await game.persist();
    game.startLoop();

    let finishWrite: (() => void) | undefined;
    vi.spyOn(saveStorage, 'saveSave').mockReturnValueOnce(
      new Promise<void>((resolve) => {
        finishWrite = resolve;
      }),
    );

    const action = game.advanceEquipment(instance.uid, SOURCE_ID);
    requestFrame.mockClear();
    visibilityState = 'hidden';
    game.pauseForBackground();
    const killsBeforeResume = game.save!.stats.totalKills;

    now += 60_000;
    visibilityState = 'visible';
    game.resumeFromBackground();
    expect(requestFrame).not.toHaveBeenCalled();
    expect(game.save!.stats.totalKills).toBe(killsBeforeResume);

    finishWrite!();
    expect((await action).ok).toBe(true);
    expect(requestFrame).toHaveBeenCalledTimes(1);
    expect(game.save!.stats.totalKills).toBeGreaterThan(killsBeforeResume);
    game.stopLoop();
  });

  it('非存储异常先恢复完整现场再继续抛出，不能伪装成浏览器写盘失败', async () => {
    const game = useGameStore();
    const { save, instance } = advancementSave();
    game.loadFrom(save);
    await game.persist();
    const before = jsonClone(game.save);
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    vi.spyOn(saveStorage, 'saveSave').mockRejectedValueOnce(new Error('schema invariant broken'));

    await expect(game.advanceEquipment(instance.uid, SOURCE_ID)).rejects.toThrow(
      'schema invariant broken',
    );
    expect(game.save).toEqual(before);
    expect(owned(game, instance.uid).defId).toBe(SOURCE_ID);
    expect(game.cpDelta).toBeNull();
  });

  it('无存档、装备不存在与没有同品质路线都返回明确原因', async () => {
    const game = useGameStore();
    expect(await game.advanceEquipment('missing', SOURCE_ID)).toEqual({
      ok: false,
      reason: 'no-save',
    });

    const { save, instance } = advancementSave();
    game.loadFrom(save);
    expect(await game.advanceEquipment('missing', SOURCE_ID)).toEqual({
      ok: false,
      reason: 'not-found',
    });

    instance.defId = 'eq_r1_weapon_common';
    expect(game.equipmentAdvancementOption(instance.uid)).toBeUndefined();
    expect(await game.advanceEquipment(instance.uid, 'eq_r1_weapon_common')).toEqual({
      ok: false,
      reason: 'no-route',
    });
  });

  it('等级、金币、两档材料与待确认洗练不足时资产和装备完全不变', async () => {
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

      expect(await game.advanceEquipment(instance.uid, SOURCE_ID)).toEqual(testCase.expected);
      expect(game.save).toEqual(before);
    }
  });
});
