import 'fake-indexeddb/auto';
import { createPinia, setActivePinia } from 'pinia';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createInstance, rollAffixValue } from '@/core/equipment';
import { Rng } from '@/core/rng';
import type { EquipmentInstance } from '@/core/types';
import { AFFIX_POOL, BAG_CAPACITY } from '@/data/constants';
import { requireEquipment } from '@/data/equipment';
import * as saveStorage from '@/save/storage';
import {
  clearSave,
  createSaveStorageClient,
  loadSave,
  saveSave,
  SaveWriteError,
} from '@/save/storage';
import { createSave } from '@/save/schema';
import { useGameStore } from '../game';

const REFORGE_ITEMS = {
  stone_reforge: 100,
  sand_crystal: 100,
  charm_bind: 100,
  crystal_resonance: 100,
  sigil_swordsman: 100,
  petal_sakura: 100,
  grass_soft: 100,
  bell_wood: 100,
};

async function synchronizeAndClear(): Promise<void> {
  try {
    await loadSave();
  } catch {
    // 读取失败仍会同步 revision，测试清理可以继续走 CAS 清档。
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

function reforgeSave(level = 20) {
  const save = createSave('洗练测试', 'swordsman', 0x4a3b2c1d, Date.now());
  save.player.level = level;
  save.player.gold = 100_000;
  save.bag.items = { ...REFORGE_ITEMS };
  const instance = createInstance(
    requireEquipment('eq_r1_weapon_common'),
    new Rng(20260728),
    'reforge-e1',
    save.player.classId,
  );
  save.bag.equipment.push(instance);
  save.nextUid = 2;
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

function jsonClone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function equipmentLevelOf(instance: EquipmentInstance): number {
  return requireEquipment(instance.defId).level;
}

function markPending(instance: EquipmentInstance): void {
  const current = instance.affixes[0];
  if (!current) throw new Error('测试装备必须至少有一条可洗练词条');
  instance.pendingAffixChange = {
    operation: 'temper',
    affixIndex: 0,
    candidate: {
      ...current,
      // 用真实品阶区间的中值，而不是「原值 +1」——
      // 后者只是碰巧落在旧系数的合法带里，AFFIX_TIERS 一重标定就会被存档校验拒绝。
      // 用生产代码本身生成候选数值，构造即合法：
      // 原本写死的「原值 +1」只是碰巧落在旧系数的合法带里，
      // AFFIX_TIERS 一重标定就会被存档校验拒绝。
      value: rollAffixValue(
        AFFIX_POOL.find((entry) => entry.key === current.key)!,
        equipmentLevelOf(instance),
        5,
        new Rng(20260728),
      ),
      tier: 5,
    },
  };
}

describe('game store 洗练事务', () => {
  it('先扣费并持久化候选，原词条在玩家选择前保持不变', async () => {
    const game = useGameStore();
    const { save, instance } = reforgeSave();
    const originalAffixes = structuredClone(instance.affixes);
    game.loadFrom(save);

    const result = await game.startAffixChange(instance.uid, 'reforge');

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(game.save?.player.gold).toBe(99_900);
    expect(game.save?.bag.items.stone_reforge).toBe(98);
    expect(game.save?.bag.items.petal_sakura).toBe(90);
    expect(game.save?.bag.items.grass_soft).toBe(90);
    expect(game.save?.bag.items.bell_wood).toBe(98);
    expect(owned(game, instance.uid).affixes).toEqual(originalAffixes);
    expect(owned(game, instance.uid).pendingAffixChange).toEqual({
      operation: 'reforge',
      affixIndex: result.targetIndex,
      candidate: result.candidate,
    });

    await game.persist();
    const persisted = await loadSave();
    expect(
      persisted?.bag.equipment.find((equipment) => equipment.uid === instance.uid)
        ?.pendingAffixChange,
    ).toEqual(owned(game, instance.uid).pendingAffixChange);
  });

  it('采用与保留都必须先展示候选，且不会发生二次扣费', async () => {
    const game = useGameStore();
    const { save, instance } = reforgeSave();
    game.loadFrom(save);

    const planned = await game.startAffixChange(instance.uid, 'temper');
    expect(planned.ok).toBe(true);
    if (!planned.ok) return;
    const assetsAfterRoll = {
      gold: game.save!.player.gold,
      items: jsonClone(game.save!.bag.items),
    };

    const kept = await game.resolveAffixChange(instance.uid, 'keep');
    expect(kept.ok).toBe(true);
    if (!kept.ok) return;
    expect(kept.adopted).toBe(false);
    expect(owned(game, instance.uid).affixes[planned.targetIndex]).toEqual(planned.previous);
    expect(owned(game, instance.uid).pendingAffixChange).toBeUndefined();
    expect(game.save?.player.gold).toBe(assetsAfterRoll.gold);
    expect(game.save?.bag.items).toEqual(assetsAfterRoll.items);

    const second = await game.startAffixChange(instance.uid, 'temper');
    expect(second.ok).toBe(true);
    if (!second.ok) return;
    const adopted = await game.resolveAffixChange(instance.uid, 'adopt');
    expect(adopted.ok).toBe(true);
    if (!adopted.ok) return;
    expect(adopted.adopted).toBe(true);
    expect(owned(game, instance.uid).affixes[second.targetIndex]).toEqual(second.candidate);
    expect(owned(game, instance.uid).pendingAffixChange).toBeUndefined();
  });

  it('等级不足、资产不足和全部锁定都不修改任何存档资产', async () => {
    const game = useGameStore();
    const { save, instance } = reforgeSave(11);
    game.loadFrom(save);
    const beforeLevelBlock = jsonClone(game.save);

    expect(await game.startAffixChange(instance.uid, 'reforge')).toEqual({
      ok: false,
      reason: 'level-locked',
    });
    expect(game.save).toEqual(beforeLevelBlock);

    game.save!.player.level = 20;
    game.save!.player.gold = 0;
    const beforeAssetBlock = jsonClone(game.save);
    expect(await game.startAffixChange(instance.uid, 'reforge')).toMatchObject({
      ok: false,
      reason: 'insufficient-gold',
    });
    expect(game.save).toEqual(beforeAssetBlock);

    game.save!.player.gold = 100_000;
    const beforeLocks = jsonClone(game.save);
    expect(await game.startAffixChange(instance.uid, 'temper', [0])).toEqual({
      ok: false,
      reason: 'all-affixes-locked',
    });
    expect(game.save).toEqual(beforeLocks);
  });

  it('穿戴中的装备也沿用同一事务，刷新后仍能处理待决结果', async () => {
    const game = useGameStore();
    const { save, instance } = reforgeSave();
    instance.affixes[0]!.tier = 4;
    save.bag.equipment = [];
    save.equipped.weapon = instance;
    game.loadFrom(save);

    const planned = await game.startAffixChange(instance.uid, 'resonate', [], 0);
    expect(planned.ok).toBe(true);
    if (!planned.ok) return;
    await game.persist();

    setActivePinia(createPinia());
    const reloadedGame = useGameStore();
    const persisted = await loadSave();
    if (!persisted) throw new Error('测试存档没有写入');
    reloadedGame.loadFrom(persisted);

    expect(owned(reloadedGame, instance.uid).pendingAffixChange?.candidate).toEqual(
      planned.candidate,
    );
    expect(await reloadedGame.resolveAffixChange(instance.uid, 'adopt')).toMatchObject({
      ok: true,
      adopted: true,
      candidate: planned.candidate,
    });
  });

  it('候选写盘失败时精确回滚费用、RNG、共鸣与 pending，不得先向 UI 报成功', async () => {
    const game = useGameStore();
    const { save, instance } = reforgeSave();
    game.loadFrom(save);
    await game.persist();
    const before = jsonClone(game.save);
    const durableBefore = await loadSave();
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    vi.spyOn(saveStorage, 'saveSave').mockRejectedValueOnce(
      new SaveWriteError(new Error('quota exceeded')),
    );

    const failed = await game.startAffixChange(instance.uid, 'reforge');

    expect(failed).toEqual({ ok: false, reason: 'persistence-failed' });
    expect(game.save).toEqual(before);
    expect(owned(game, instance.uid).pendingAffixChange).toBeUndefined();
    expect(game.saveError).toContain('IndexedDB 写入失败');
    expect(await loadSave()).toEqual(durableBefore);

    // 回滚不只恢复可见资产，也必须恢复私有 RNG；重试仍应得到确定性候选。
    const retried = await game.startAffixChange(instance.uid, 'reforge');
    expect(retried.ok).toBe(true);
    if (!retried.ok) return;

    setActivePinia(createPinia());
    const control = useGameStore();
    control.loadFrom(jsonClone(before!));
    const expected = await control.startAffixChange(instance.uid, 'reforge');
    expect(expected.ok).toBe(true);
    if (!expected.ok) return;
    expect({
      targetIndex: retried.targetIndex,
      candidate: retried.candidate,
      nextRngState: retried.nextRngState,
    }).toEqual({
      targetIndex: expected.targetIndex,
      candidate: expected.candidate,
      nextRngState: expected.nextRngState,
    });
  });

  it('另一标签先写入后，洗练 CAS 冲突会回滚并停机，绝不拿旧整档覆盖新主槽', async () => {
    let nextRafId = 0;
    const requestFrame = vi.fn(() => ++nextRafId);
    vi.stubGlobal('document', { visibilityState: 'visible' });
    vi.stubGlobal('requestAnimationFrame', requestFrame);
    vi.stubGlobal('cancelAnimationFrame', vi.fn());
    vi.spyOn(console, 'error').mockImplementation(() => undefined);

    const game = useGameStore();
    const { save, instance } = reforgeSave();
    game.loadFrom(save);
    await game.persist();

    const otherTab = createSaveStorageClient();
    const otherSnapshot = await otherTab.loadSave();
    if (!otherSnapshot) throw new Error('跨标签测试缺少初始存档');
    otherSnapshot.player.gold += 777;
    await otherTab.saveSave(otherSnapshot);

    const beforeAffix = jsonClone(game.save);
    game.startLoop();
    requestFrame.mockClear();
    const result = await game.startAffixChange(instance.uid, 'reforge');

    expect(result).toEqual({ ok: false, reason: 'persistence-conflict' });
    expect(game.save).toEqual(beforeAffix);
    expect(owned(game, instance.uid).pendingAffixChange).toBeUndefined();
    expect(game.loadError).toContain('另一页面已经更新');
    expect(requestFrame).not.toHaveBeenCalled();

    // 冲突后的普通自动保存必须硬停，不能盲重试旧快照。
    game.save!.player.gold = 1;
    await game.persist();
    expect((await otherTab.loadSave())?.player.gold).toBe(otherSnapshot.player.gold);
  });

  it('旧标签发起清档也会 CAS 冲突、恢复内存并停机，不能删除另一标签的新档', async () => {
    let nextRafId = 0;
    const requestFrame = vi.fn(() => ++nextRafId);
    vi.stubGlobal('document', { visibilityState: 'visible' });
    vi.stubGlobal('requestAnimationFrame', requestFrame);
    vi.stubGlobal('cancelAnimationFrame', vi.fn());
    vi.spyOn(console, 'error').mockImplementation(() => undefined);

    const game = useGameStore();
    const { save } = reforgeSave();
    game.loadFrom(save);
    await game.persist();

    const otherTab = createSaveStorageClient();
    const authoritative = await otherTab.loadSave();
    if (!authoritative) throw new Error('跨标签清档测试缺少初始存档');
    authoritative.player.gold += 4_321;
    await otherTab.saveSave(authoritative);

    const staleMemory = jsonClone(game.save);
    game.startLoop();
    requestFrame.mockClear();

    expect(await game.resetGame()).toBe(false);
    expect(game.save).toEqual(staleMemory);
    expect(game.loadError).toContain('另一页面已经更新');
    expect(requestFrame).not.toHaveBeenCalled();
    expect((await otherTab.loadSave())?.player.gold).toBe(authoritative.player.gold);
  });

  it('洗练正在写盘时拒绝重开角色，不能让清档与迟到事务交错', async () => {
    const game = useGameStore();
    const { save, instance } = reforgeSave();
    game.loadFrom(save);
    await game.persist();

    let finishWrite: (() => void) | undefined;
    vi.spyOn(saveStorage, 'saveSave').mockReturnValueOnce(
      new Promise<void>((resolve) => {
        finishWrite = resolve;
      }),
    );

    const action = game.startAffixChange(instance.uid, 'reforge');
    expect(await game.resetGame()).toBe(false);
    expect(game.save).not.toBeNull();
    expect(game.saveError).toContain('付费养成结果正在安全写入');

    finishWrite!();
    expect((await action).ok).toBe(true);
  });

  it('清档等待期间隔离旧存档、后台恢复和导入，墓碑后不会排入迟到快照', async () => {
    let nextRafId = 0;
    const requestFrame = vi.fn(() => ++nextRafId);
    vi.stubGlobal('document', { visibilityState: 'visible' });
    vi.stubGlobal('requestAnimationFrame', requestFrame);
    vi.stubGlobal('cancelAnimationFrame', vi.fn());

    const game = useGameStore();
    const { save } = reforgeSave();
    game.loadFrom(save);
    await game.persist();
    game.startLoop();
    requestFrame.mockClear();

    let releaseClear: (() => void) | undefined;
    const clearGate = new Promise<void>((resolve) => {
      releaseClear = resolve;
    });
    const realClear = saveStorage.clearSave;
    vi.spyOn(saveStorage, 'clearSave').mockImplementationOnce(async () => {
      await clearGate;
      await realClear();
    });

    const resetting = game.resetGame();
    expect(game.save).toBeNull();

    // pagehide/pageshow、导入、新建与普通保存都发生在 clear 已入队之后；
    // 它们必须全部被事务门禁挡住，不能把旧档或替代档排到墓碑后。
    game.pauseForBackground();
    game.resumeFromBackground();
    game.loadFrom(createSave('迟到导入', 'witch', 99, Date.now()));
    await game.startNewGame('迟到新建', 'catkin');
    await game.persist();
    expect(game.save).toBeNull();
    expect(requestFrame).not.toHaveBeenCalled();

    releaseClear!();
    expect(await resetting).toBe(true);
    expect(await loadSave()).toBeNull();
    expect(requestFrame).not.toHaveBeenCalled();

    await game.startNewGame('清档后的新角色', 'witch');
    expect((await loadSave())?.player.name).toBe('清档后的新角色');
    expect(requestFrame).toHaveBeenCalledTimes(1);
    game.stopLoop();
  });

  it('init 等待读档时发生 pagehide，后台不得预挂 rAF，回前台只恢复一条循环', async () => {
    let now = Date.UTC(2026, 6, 29, 8);
    let nextRafId = 0;
    const requestFrame = vi.fn(() => ++nextRafId);
    vi.spyOn(Date, 'now').mockImplementation(() => now);
    vi.stubGlobal('document', { visibilityState: 'visible' });
    vi.stubGlobal('requestAnimationFrame', requestFrame);
    vi.stubGlobal('cancelAnimationFrame', vi.fn());

    let finishLoad: ((data: ReturnType<typeof createSave>) => void) | undefined;
    vi.spyOn(saveStorage, 'loadSave').mockReturnValueOnce(
      new Promise((resolve) => {
        finishLoad = resolve;
      }),
    );

    const game = useGameStore();
    const initializing = game.init();
    // pagehide 不保证 visibility 同步变 hidden，因此这里刻意保持 visible。
    game.pauseForBackground();
    finishLoad!(createSave('后台读档', 'swordsman', 123, now));
    await initializing;

    expect(game.loaded).toBe(true);
    expect(requestFrame).not.toHaveBeenCalled();

    now += 60_000;
    game.resumeFromBackground();
    expect(requestFrame).toHaveBeenCalledTimes(1);
    expect(game.save!.stats.totalKills).toBeGreaterThan(0);
    game.stopLoop();
  });

  it('visibility hidden 与 pagehide 重复暂停不会后移离线起点', async () => {
    let now = Date.UTC(2026, 6, 29, 8);
    vi.spyOn(Date, 'now').mockImplementation(() => now);
    vi.stubGlobal('document', { visibilityState: 'visible' });
    vi.stubGlobal('requestAnimationFrame', vi.fn(() => 1));
    vi.stubGlobal('cancelAnimationFrame', vi.fn());

    const game = useGameStore();
    const { save } = reforgeSave();
    game.loadFrom(save);
    await game.persist();

    game.pauseForBackground();
    const firstPauseAt = game.save!.lastActiveAt;
    now += 60_000;
    game.pauseForBackground();

    expect(game.save!.lastActiveAt).toBe(firstPauseAt);
  });

  it('写盘期间 hidden→visible 只延后结算，失败回滚后才统一恢复离线收益与循环', async () => {
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
    const { save, instance } = reforgeSave();
    game.loadFrom(save);
    await game.persist();
    const beforeTransaction = jsonClone(game.save);
    game.startLoop();

    let rejectWrite: ((reason?: unknown) => void) | undefined;
    const deferredWrite = new Promise<void>((_resolve, reject) => {
      rejectWrite = reject;
    });
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    vi.spyOn(saveStorage, 'saveSave').mockReturnValueOnce(deferredWrite);

    const action = game.startAffixChange(instance.uid, 'reforge');
    requestFrame.mockClear();
    visibilityState = 'hidden';
    game.pauseForBackground();
    const pausedState = jsonClone(game.save);
    const pausedProgress = {
      battleProgress: game.battleProgress,
      totalKills: game.save!.stats.totalKills,
      stageKills: game.currentStageKills,
    };

    now += 60_000;
    visibilityState = 'visible';
    game.resumeFromBackground();

    // persistStrict 尚未 reject：不能先结算离线，也不能重新挂 rAF。
    expect(requestFrame).not.toHaveBeenCalled();
    expect(game.save).toEqual(pausedState);
    expect({
      battleProgress: game.battleProgress,
      totalKills: game.save!.stats.totalKills,
      stageKills: game.currentStageKills,
    }).toEqual(pausedProgress);

    rejectWrite!(new SaveWriteError(new Error('deferred transaction rejected')));
    expect(await action).toEqual({ ok: false, reason: 'persistence-failed' });

    // 回滚已先完成，随后只恢复事务前存在的那一条实时循环。
    expect(requestFrame).toHaveBeenCalledTimes(1);
    expect(owned(game, instance.uid).pendingAffixChange).toBeUndefined();
    game.stopLoop();

    // 用“完全没发起洗练、只正常离线 60 秒”的同种子控制组校验整份状态，
    // 防止只回滚 gold/items/RNG，却让击杀、关卡等落在另一条时间线上。
    setActivePinia(createPinia());
    const control = useGameStore();
    control.loadFrom(jsonClone(beforeTransaction!));
    expect(game.save).toEqual(control.save);
    expect(game.offlineResult).toEqual(control.offlineResult);
    expect(game.save!.stats.totalKills).toBeGreaterThan(beforeTransaction!.stats.totalKills);
  });

  it('写盘期间 hidden→visible→hidden 不会覆盖尚未结算的原离线起点', async () => {
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
    const { save, instance } = reforgeSave();
    game.loadFrom(save);
    await game.persist();
    game.startLoop();

    let rejectWrite: ((reason?: unknown) => void) | undefined;
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    vi.spyOn(saveStorage, 'saveSave').mockReturnValueOnce(
      new Promise<void>((_resolve, reject) => {
        rejectWrite = reject;
      }),
    );

    const action = game.startAffixChange(instance.uid, 'reforge');
    requestFrame.mockClear();
    visibilityState = 'hidden';
    game.pauseForBackground();
    const originalOfflineStart = game.save!.lastActiveAt;

    now += 60_000;
    visibilityState = 'visible';
    game.resumeFromBackground();
    now += 10_000;
    visibilityState = 'hidden';
    game.pauseForBackground();

    expect(game.save!.lastActiveAt).toBe(originalOfflineStart);
    expect(requestFrame).not.toHaveBeenCalled();

    rejectWrite!(new SaveWriteError(new Error('multi-cycle transaction rejected')));
    expect(await action).toEqual({ ok: false, reason: 'persistence-failed' });
    expect(requestFrame).not.toHaveBeenCalled();

    now += 50_000;
    visibilityState = 'visible';
    game.resumeFromBackground();
    expect(game.save!.stats.totalKills).toBeGreaterThan(0);
    expect(requestFrame).toHaveBeenCalledTimes(1);
    game.stopLoop();
  });

  it('pagehide 即使 visibility 仍为 visible，写盘 finally 也不能擅自重启循环', async () => {
    let nextRafId = 0;
    const requestFrame = vi.fn(() => ++nextRafId);
    vi.stubGlobal('document', { visibilityState: 'visible' });
    vi.stubGlobal('requestAnimationFrame', requestFrame);
    vi.stubGlobal('cancelAnimationFrame', vi.fn());

    const game = useGameStore();
    const { save, instance } = reforgeSave();
    game.loadFrom(save);
    await game.persist();
    const beforeTransaction = jsonClone(game.save);
    game.startLoop();

    let rejectWrite: ((reason?: unknown) => void) | undefined;
    const deferredWrite = new Promise<void>((_resolve, reject) => {
      rejectWrite = reject;
    });
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    vi.spyOn(saveStorage, 'saveSave').mockReturnValueOnce(deferredWrite);

    const action = game.startAffixChange(instance.uid, 'reforge');
    requestFrame.mockClear();
    // pagehide 事件会走这个入口，但浏览器不保证同步改 visibilityState。
    game.pauseForBackground();
    const expectedAfterRollback = {
      ...beforeTransaction!,
      lastActiveAt: game.save!.lastActiveAt,
    };
    rejectWrite!(new SaveWriteError(new Error('pagehide transaction rejected')));

    expect(await action).toEqual({ ok: false, reason: 'persistence-failed' });
    expect(requestFrame).not.toHaveBeenCalled();
    expect(game.save).toEqual(expectedAfterRollback);

    game.resumeFromBackground();
    expect(requestFrame).toHaveBeenCalledTimes(1);
    game.stopLoop();
  });

  it('采用结果写盘失败时恢复原词条与待决候选，战力提示也不能提前触发', async () => {
    const game = useGameStore();
    const { save, instance } = reforgeSave();
    game.loadFrom(save);
    const planned = await game.startAffixChange(instance.uid, 'reforge');
    expect(planned.ok).toBe(true);
    if (!planned.ok) return;
    const beforeResolve = jsonClone(game.save);
    const durableBefore = await loadSave();
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    vi.spyOn(saveStorage, 'saveSave').mockRejectedValueOnce(
      new SaveWriteError(new Error('transaction aborted')),
    );

    const failed = await game.resolveAffixChange(instance.uid, 'adopt');

    expect(failed).toEqual({ ok: false, reason: 'persistence-failed' });
    expect(game.save).toEqual(beforeResolve);
    expect(owned(game, instance.uid).pendingAffixChange).toEqual(
      beforeResolve!.bag.equipment[0]!.pendingAffixChange,
    );
    expect(game.cpDelta).toBeNull();
    expect(await loadSave()).toEqual(durableBefore);
  });

  it('存档结构或配置错误在恢复事务现场后继续抛出，不能伪装成写盘失败', async () => {
    const game = useGameStore();
    const { save, instance } = reforgeSave();
    game.loadFrom(save);
    await game.persist();
    const before = jsonClone(game.save);
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    vi.spyOn(saveStorage, 'saveSave').mockRejectedValueOnce(new Error('schema invariant broken'));

    await expect(game.startAffixChange(instance.uid, 'reforge')).rejects.toThrow(
      'schema invariant broken',
    );
    expect(game.save).toEqual(before);
    expect(owned(game, instance.uid).pendingAffixChange).toBeUndefined();
  });
});

describe('待确认洗练候选的付费硬锁', () => {
  it('主动分解命中任意待确认装备时整批明确拒绝，不能部分分解', () => {
    const game = useGameStore();
    const { save, instance: pending } = reforgeSave();
    const normal = createInstance(
      requireEquipment('eq_r1_weapon_common'),
      new Rng(20260729),
      'normal-e2',
      save.player.classId,
    );
    markPending(pending);
    save.bag.equipment.push(normal);
    game.loadFrom(save);
    const before = jsonClone(game.save);

    const result = game.decompose([pending.uid, normal.uid]);

    expect(result).toEqual({
      count: 0,
      gold: 0,
      reason: 'pending-affix-result',
      blockedUids: [pending.uid],
    });
    expect(game.save).toEqual(before);
  });

  it('单次、单件一键与全身一键强化都在 +13 碎裂判定前拒绝', () => {
    const game = useGameStore();
    const { save, instance } = reforgeSave();
    instance.enhance = 12;
    instance.enhanceGainPermille.fill(0);
    instance.enhanceGainPermille.fill(80, 0, 12);
    markPending(instance);
    save.bag.equipment = [];
    save.equipped.weapon = instance;
    game.loadFrom(save);
    const before = jsonClone(game.save);

    expect(game.quoteEnhance(instance.uid, false)).toEqual({
      ok: false,
      reason: 'pending-affix-result',
    });
    expect(game.enhanceEquipment(instance.uid, false)).toEqual({
      ok: false,
      reason: 'pending-affix-result',
    });
    expect(game.autoEnhanceEquipment(instance.uid, 13)).toEqual({
      ok: false,
      reason: 'pending-affix-result',
    });
    expect(game.autoEnhanceAllEquipped(13)).toEqual({
      ok: false,
      reason: 'pending-affix-result',
    });
    expect(game.save).toEqual(before);
  });

  it('init 裁剪满背包时保留最低战力的待确认装备，改删普通装备', async () => {
    const save = createSave('满背包硬锁测试', 'swordsman', 0x5a4b3c2d, Date.now());
    const definition = requireEquipment('eq_r1_weapon_common');
    save.bag.equipment = Array.from({ length: BAG_CAPACITY + 1 }, (_, index) => {
      const instance = createInstance(
        definition,
        new Rng(index + 1),
        `e${index + 1}`,
        save.player.classId,
      );
      instance.locked = false;
      instance.baseRollPermille = 1000;
      instance.affixes = [{ key: 'atk', value: index + 1, tier: 1 }];
      return instance;
    });
    const paidPending = save.bag.equipment[0]!;
    markPending(paidPending);
    save.nextUid = BAG_CAPACITY + 2;
    save.lastActiveAt = Date.now() + 60_000;
    await saveSave(save);

    vi.stubGlobal(
      'requestAnimationFrame',
      vi.fn(() => 1),
    );
    vi.stubGlobal('cancelAnimationFrame', vi.fn());
    const game = useGameStore();

    await game.init();
    game.stopLoop();

    expect(game.save?.bag.equipment).toHaveLength(BAG_CAPACITY);
    expect(game.save?.bag.equipment.some((instance) => instance.uid === paidPending.uid)).toBe(
      true,
    );
    expect(game.save?.bag.equipment.some((instance) => instance.uid === 'e2')).toBe(false);
    expect(game.autoDecomposed?.count).toBe(1);
  });
});
