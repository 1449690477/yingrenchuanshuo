import 'fake-indexeddb/auto';
import { createPinia, setActivePinia } from 'pinia';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createInstance, rollAffixValue } from '@/core/equipment';
import { Rng } from '@/core/rng';
import type { EquipmentInstance } from '@/core/types';
import { AFFIX_POOL, BAG_CAPACITY } from '@/data/constants';
import { requireEquipment } from '@/data/equipment';
import { clearSave, loadSave, saveSave } from '@/save/storage';
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

beforeEach(async () => {
  setActivePinia(createPinia());
  await clearSave();
});

afterEach(async () => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  await clearSave();
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

    const result = game.startAffixChange(instance.uid, 'reforge');

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

  it('采用与保留都必须先展示候选，且不会发生二次扣费', () => {
    const game = useGameStore();
    const { save, instance } = reforgeSave();
    game.loadFrom(save);

    const planned = game.startAffixChange(instance.uid, 'temper');
    expect(planned.ok).toBe(true);
    if (!planned.ok) return;
    const assetsAfterRoll = {
      gold: game.save!.player.gold,
      items: jsonClone(game.save!.bag.items),
    };

    const kept = game.resolveAffixChange(instance.uid, 'keep');
    expect(kept.ok).toBe(true);
    if (!kept.ok) return;
    expect(kept.adopted).toBe(false);
    expect(owned(game, instance.uid).affixes[planned.targetIndex]).toEqual(planned.previous);
    expect(owned(game, instance.uid).pendingAffixChange).toBeUndefined();
    expect(game.save?.player.gold).toBe(assetsAfterRoll.gold);
    expect(game.save?.bag.items).toEqual(assetsAfterRoll.items);

    const second = game.startAffixChange(instance.uid, 'temper');
    expect(second.ok).toBe(true);
    if (!second.ok) return;
    const adopted = game.resolveAffixChange(instance.uid, 'adopt');
    expect(adopted.ok).toBe(true);
    if (!adopted.ok) return;
    expect(adopted.adopted).toBe(true);
    expect(owned(game, instance.uid).affixes[second.targetIndex]).toEqual(second.candidate);
    expect(owned(game, instance.uid).pendingAffixChange).toBeUndefined();
  });

  it('等级不足、资产不足和全部锁定都不修改任何存档资产', () => {
    const game = useGameStore();
    const { save, instance } = reforgeSave(11);
    game.loadFrom(save);
    const beforeLevelBlock = jsonClone(game.save);

    expect(game.startAffixChange(instance.uid, 'reforge')).toEqual({
      ok: false,
      reason: 'level-locked',
    });
    expect(game.save).toEqual(beforeLevelBlock);

    game.save!.player.level = 20;
    game.save!.player.gold = 0;
    const beforeAssetBlock = jsonClone(game.save);
    expect(game.startAffixChange(instance.uid, 'reforge')).toMatchObject({
      ok: false,
      reason: 'insufficient-gold',
    });
    expect(game.save).toEqual(beforeAssetBlock);

    game.save!.player.gold = 100_000;
    const beforeLocks = jsonClone(game.save);
    expect(game.startAffixChange(instance.uid, 'temper', [0])).toEqual({
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

    const planned = game.startAffixChange(instance.uid, 'resonate', [], 0);
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
    expect(reloadedGame.resolveAffixChange(instance.uid, 'adopt')).toMatchObject({
      ok: true,
      adopted: true,
      candidate: planned.candidate,
    });
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

    vi.stubGlobal('requestAnimationFrame', vi.fn(() => 1));
    vi.stubGlobal('cancelAnimationFrame', vi.fn());
    const game = useGameStore();

    await game.init();
    game.stopLoop();

    expect(game.save?.bag.equipment).toHaveLength(BAG_CAPACITY);
    expect(game.save?.bag.equipment.some((instance) => instance.uid === paidPending.uid)).toBe(true);
    expect(game.save?.bag.equipment.some((instance) => instance.uid === 'e2')).toBe(false);
    expect(game.autoDecomposed?.count).toBe(1);
  });
});
