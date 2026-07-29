import 'fake-indexeddb/auto';
import { createPinia, setActivePinia } from 'pinia';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createSave } from '@/save/schema';
import * as saveStorage from '@/save/storage';
import {
  clearSave,
  createSaveStorageClient,
  loadSave,
  SaveWriteError,
} from '@/save/storage';
import { useGameStore } from '../game';
import { useInventoryStore } from '../inventory';

const { TEST_RECIPE_ID, TEST_FRAGMENT_ID, TEST_TARGET_ID, testRecipe } = vi.hoisted(() => {
  const recipeId = 'craft_test_auric';
  const fragmentItemId = 'stone_enhance';
  const targetDefId = 'eq_dungeon_auric_weapon_swordsman';
  return {
    TEST_RECIPE_ID: recipeId,
    TEST_FRAGMENT_ID: fragmentItemId,
    TEST_TARGET_ID: targetDefId,
    testRecipe: {
      id: recipeId,
      setId: 'set_dungeon_auric',
      fragmentItemId,
      fragmentCount: 40,
      targetDefIds: {
        weapon: targetDefId,
      },
    },
  };
});

vi.mock('@/data/equipmentSetCrafting', async (importOriginal) => {
  const original = await importOriginal<typeof import('@/data/equipmentSetCrafting')>();
  return {
    ...original,
    getEquipmentSetCraftingRecipe: (recipeId: string) =>
      recipeId === TEST_RECIPE_ID ? testRecipe : undefined,
  };
});

async function synchronizeAndClear(): Promise<void> {
  try {
    await loadSave();
  } catch {
    // 冲突用例结束后先同步默认客户端 revision，随后才能安全清档。
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

function craftingSave(fragmentCount = 53) {
  const save = createSave('套装合成测试', 'swordsman', 0x50_20_26, Date.now());
  save.player.level = 120;
  save.bag.items = {
    [TEST_FRAGMENT_ID]: fragmentCount,
    unrelated: 7,
  };
  return save;
}

describe('game store 套装通用碎片自选合成事务', () => {
  it('精确扣除碎片、推进 UID/RNG、加入合法锁定装备并等待耐久落盘', async () => {
    const game = useGameStore();
    const inventory = useInventoryStore();
    const save = craftingSave();
    const beforeRng = save.rngState;
    game.loadFrom(save);
    await game.persist();

    const result = await inventory.craftEquipmentSetPiece(TEST_RECIPE_ID, 'weapon');

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result).toMatchObject({
      recipeId: TEST_RECIPE_ID,
      setId: 'set_dungeon_auric',
      targetSlot: 'weapon',
      targetDefId: TEST_TARGET_ID,
      cost: { itemId: TEST_FRAGMENT_ID, count: 40 },
      equipment: {
        uid: 'e1',
        defId: TEST_TARGET_ID,
        enhance: 0,
        locked: true,
      },
    });
    expect(result.equipment).toBe(game.save!.bag.equipment[0]);
    expect(game.save?.bag.items).toEqual({
      [TEST_FRAGMENT_ID]: 13,
      unrelated: 7,
    });
    expect(game.save?.nextUid).toBe(2);
    expect(game.save?.rngState).not.toBe(beforeRng);

    const persisted = await loadSave();
    expect(persisted?.bag.items).toEqual({
      [TEST_FRAGMENT_ID]: 13,
      unrelated: 7,
    });
    expect(persisted?.bag.equipment).toEqual(jsonClone(game.save?.bag.equipment));
    expect(persisted?.nextUid).toBe(2);
    expect(persisted?.rngState).toBe(game.save?.rngState);
  });

  it('无存档、未知配方、非法部位与碎片不足都明确失败且不改资产', async () => {
    const game = useGameStore();
    expect(await game.craftEquipmentSetPiece(TEST_RECIPE_ID, 'weapon')).toEqual({
      ok: false,
      reason: 'no-save',
    });

    game.loadFrom(craftingSave(39));
    const before = jsonClone(game.save);
    expect(await game.craftEquipmentSetPiece('missing-recipe', 'weapon')).toEqual({
      ok: false,
      reason: 'no-recipe',
    });
    expect(await game.craftEquipmentSetPiece(TEST_RECIPE_ID, 'belt')).toEqual({
      ok: false,
      reason: 'unsupported-slot',
      recipeId: TEST_RECIPE_ID,
      targetSlot: 'belt',
    });
    expect(await game.craftEquipmentSetPiece(TEST_RECIPE_ID, 'weapon')).toEqual({
      ok: false,
      reason: 'insufficient-fragment',
      itemId: TEST_FRAGMENT_ID,
      required: 40,
      owned: 39,
    });
    expect(game.save).toEqual(before);
  });

  it('写盘未决时与合成、洗练、升阶共用同一付费门禁', async () => {
    const game = useGameStore();
    game.loadFrom(craftingSave());
    await game.persist();

    let finishWrite: (() => void) | undefined;
    vi.spyOn(saveStorage, 'saveSave').mockReturnValueOnce(
      new Promise<void>((resolve) => {
        finishWrite = resolve;
      }),
    );

    const first = game.craftEquipmentSetPiece(TEST_RECIPE_ID, 'weapon');
    expect(game.save?.bag.equipment).toHaveLength(1);
    expect(await game.craftEquipmentSetPiece(TEST_RECIPE_ID, 'weapon')).toEqual({
      ok: false,
      reason: 'persistence-pending',
    });
    expect(await game.startAffixChange('e1', 'reforge')).toEqual({
      ok: false,
      reason: 'persistence-pending',
    });
    expect(await game.advanceEquipment('missing', 'eq_r1_weapon_rare')).toEqual({
      ok: false,
      reason: 'persistence-pending',
    });

    finishWrite!();
    expect((await first).ok).toBe(true);
  });

  it('IndexedDB 写失败精确回滚碎片、装备、UID、RNG 与战力提示', async () => {
    const game = useGameStore();
    game.loadFrom(craftingSave());
    await game.persist();
    const before = jsonClone(game.save);
    const durableBefore = await loadSave();
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    vi.spyOn(saveStorage, 'saveSave').mockRejectedValueOnce(
      new SaveWriteError(new Error('quota exceeded')),
    );

    const result = await game.craftEquipmentSetPiece(TEST_RECIPE_ID, 'weapon');

    expect(result).toEqual({ ok: false, reason: 'persistence-failed' });
    expect(game.save).toEqual(before);
    expect(game.cpDelta).toBeNull();
    expect(game.saveError).toContain('IndexedDB 写入失败');
    expect(await loadSave()).toEqual(durableBefore);
  });

  it('跨标签 CAS 冲突回滚完整现场并停止旧页，不能覆盖权威新档', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const game = useGameStore();
    game.loadFrom(craftingSave());
    await game.persist();

    const otherTab = createSaveStorageClient();
    const authoritative = await otherTab.loadSave();
    if (!authoritative) throw new Error('跨标签测试缺少初始存档');
    authoritative.player.gold += 777;
    await otherTab.saveSave(authoritative);

    const before = jsonClone(game.save);
    const result = await game.craftEquipmentSetPiece(TEST_RECIPE_ID, 'weapon');

    expect(result).toEqual({ ok: false, reason: 'persistence-conflict' });
    expect(game.save).toEqual(before);
    expect(game.cpDelta).toBeNull();
    expect(game.loadError).toContain('另一页面已经更新');
    expect((await otherTab.loadSave())?.player.gold).toBe(authoritative.player.gold);
    expect((await otherTab.loadSave())?.bag.equipment).toHaveLength(0);
  });

  it('写盘期间后台恢复不提前结算，事务结束后至多恢复一条循环', async () => {
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
    game.loadFrom(craftingSave());
    await game.persist();
    game.startLoop();

    let finishWrite: (() => void) | undefined;
    vi.spyOn(saveStorage, 'saveSave').mockReturnValueOnce(
      new Promise<void>((resolve) => {
        finishWrite = resolve;
      }),
    );

    const action = game.craftEquipmentSetPiece(TEST_RECIPE_ID, 'weapon');
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

  it('非存储异常先完整回滚再抛出，不能伪装成普通写盘失败', async () => {
    const game = useGameStore();
    game.loadFrom(craftingSave());
    await game.persist();
    const before = jsonClone(game.save);
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    vi.spyOn(saveStorage, 'saveSave').mockRejectedValueOnce(
      new Error('schema invariant broken'),
    );

    await expect(
      game.craftEquipmentSetPiece(TEST_RECIPE_ID, 'weapon'),
    ).rejects.toThrow('schema invariant broken');
    expect(game.save).toEqual(before);
    expect(game.cpDelta).toBeNull();
  });
});
