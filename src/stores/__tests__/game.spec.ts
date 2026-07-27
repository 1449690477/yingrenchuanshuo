import 'fake-indexeddb/auto';
import { createPinia, setActivePinia } from 'pinia';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createInstance } from '@/core/equipment';
import type { EquipmentInstance } from '@/core/types';
import { Rng } from '@/core/rng';
import { ENHANCE_MAX, ENHANCE_MATERIAL_IDS } from '@/data/constants';
import { requireEquipment } from '@/data/equipment';
import { SHOP_OFFERS } from '@/data/shop';
import { createSave } from '@/save/schema';
import { clearSave, loadSave } from '@/save/storage';
import { useGameStore } from '../game';
import { useInventoryStore } from '../inventory';
import { usePlayerStore } from '../player';
import { useStageStore } from '../stage';

beforeEach(async () => {
  setActivePinia(createPinia());
  await clearSave();
});

afterEach(async () => {
  await clearSave();
});

describe('game store persistence', () => {
  it('新建角色后立即写入 IndexedDB', async () => {
    const game = useGameStore();
    await game.startNewGame('小樱', 'swordsman');

    const loaded = await loadSave();
    expect(loaded?.player.name).toBe('小樱');
    expect(loaded?.player.classId).toBe('swordsman');
  });

  it('四个领域 store 读取同一份响应式存档', async () => {
    const game = useGameStore();
    game.loadFrom(createSave('领域测试', 'witch', 7, Date.now()));

    expect(usePlayerStore().player?.name).toBe('领域测试');
    expect(useInventoryStore().bag?.equipment).toEqual([]);
    expect(useStageStore().current.id).toBe(game.currentStage.id);
    await game.persist();
  });

  it('离线击杀会推进通关、累计统计并发放首通奖励', async () => {
    const game = useGameStore();
    const save = createSave('离线测试', 'swordsman', 11, Date.now() - 120_000);
    game.loadFrom(save);

    expect(game.save?.stats.totalKills).toBeGreaterThan(0);
    expect(game.save?.progress.clearedStageIds).toContain(game.currentStage.id);
    expect(game.save?.progress.stageKills[game.currentStage.id]).toBeGreaterThan(0);
    expect(game.save?.bag.items.stone_enhance).toBeGreaterThan(0);
    await game.persist();
  });
});

describe('equipment decisions', () => {
  it('装备比较使用角色整套属性，普通武器不会再被攻速 0 乘成零战力', async () => {
    const game = useGameStore();
    const save = createSave('装备测试', 'swordsman', 8, Date.now());
    save.player.level = 2;
    const definition = requireEquipment('eq_r1_weapon_common');
    const item = createInstance(definition, new Rng(1), 'e1');
    save.bag.equipment.push(item);
    game.loadFrom(save);

    const before = game.cp;
    expect(game.equipmentContributionCp(item)).toBeGreaterThan(0);
    expect(game.equipmentCandidateCp(item)).toBeGreaterThan(before);
    expect(game.equipBest()).toBe(1);
    expect(game.cp).toBeGreaterThan(before);
    await game.persist();
  });

  it('未达到需求等级不能穿戴，也不会被一键最优选中', async () => {
    const game = useGameStore();
    const save = createSave('等级测试', 'swordsman', 9, Date.now());
    const definition = requireEquipment('eq_r2_weapon_epic');
    const item = createInstance(definition, new Rng(2), 'e2');
    save.bag.equipment.push(item);
    game.loadFrom(save);

    expect(game.equip(item.uid)).toBe(false);
    expect(game.equipBest()).toBe(0);
    expect(game.save?.equipped.weapon).toBeNull();
    await game.persist();
  });

  it('职业专属武器不能被其他职业穿戴或一键选中', async () => {
    const game = useGameStore();
    const save = createSave('职业测试', 'swordsman', 10, Date.now());
    save.player.level = 20;
    const witchWeapon = requireEquipment('eq_shop_berry-cream_weapon_witch');
    const item = createInstance(witchWeapon, new Rng(3), 'e3');
    save.bag.equipment.push(item);
    game.loadFrom(save);

    expect(game.equip(item.uid)).toBe(false);
    expect(game.equipBest()).toBe(0);
    expect(game.save?.equipped.weapon).toBeNull();
    await game.persist();
  });
});

function enhancedInstance(
  enhance: number,
  overrides: Partial<EquipmentInstance> = {},
): EquipmentInstance {
  return {
    uid: 'e1',
    defId: 'eq_r1_weapon_common',
    enhance,
    baseRollPermille: 1000,
    enhanceGainPermille: Array.from({ length: ENHANCE_MAX }, (_, index) =>
      index < enhance ? 80 : 0,
    ),
    enhanceLuck: {},
    affixes: [],
    locked: false,
    ...overrides,
  };
}

function forgeSave(instance: EquipmentInstance, seed: number) {
  const save = createSave('强化测试', 'swordsman', seed, Date.now());
  save.player.level = 20;
  save.player.gold = 10_000_000;
  save.nextUid = 2;
  save.bag.items = {
    [ENHANCE_MATERIAL_IDS.stone]: 100_000,
    [ENHANCE_MATERIAL_IDS.ore]: 100_000,
    [ENHANCE_MATERIAL_IDS.lucky]: 100_000,
    [ENHANCE_MATERIAL_IDS.protection]: 10,
  };
  save.bag.equipment.push(instance);
  return save;
}

function seedForRoll(predicate: (roll: number) => boolean): number {
  for (let seed = 1; seed < 100_000; seed++) {
    if (predicate(new Rng(seed).next())) return seed;
  }
  throw new Error('测试未找到符合条件的种子');
}

describe('enhancement transaction', () => {
  it('满幸运成功只推进一格主 RNG，并固定首次成功的随机增幅', async () => {
    const seed = 91;
    const instance = enhancedInstance(5, { enhanceLuck: { '6': 100 } });
    const game = useGameStore();
    const save = forgeSave(instance, seed);
    save.bag.equipment = [];
    save.equipped.weapon = instance;
    game.loadFrom(save);
    const expectedRng = new Rng(seed);
    expectedRng.next();

    const result = game.enhanceEquipment(instance.uid, false);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.result).toMatchObject({
      outcome: 'success',
      targetLevel: 6,
      nextLevel: 6,
      guaranteed: true,
      protectionConsumed: false,
    });
    expect(result.gainRoll).not.toBeNull();
    expect(result.instance?.enhance).toBe(6);
    expect(result.instance?.enhanceGainPermille[5]).toBe(result.gainRoll?.permille);
    expect(result.instance?.enhanceLuck).not.toHaveProperty('6');
    expect(game.save?.rngState).toBe(expectedRng.getState());
    expect(result.cpDelta).toBeGreaterThan(0);
    await game.persist();
  });

  it('普通失败保级、增加当前目标幸运，并照常扣基础材料', async () => {
    const seed = seedForRoll((roll) => roll >= 0.85);
    const instance = enhancedInstance(5);
    const save = forgeSave(instance, seed);
    const beforeGold = save.player.gold;
    const beforeStone = save.bag.items[ENHANCE_MATERIAL_IDS.stone]!;
    const game = useGameStore();
    game.loadFrom(save);

    const result = game.enhanceEquipment(instance.uid, false);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.result.outcome).toBe('failed');
    expect(result.instance?.enhance).toBe(5);
    expect(result.instance?.enhanceLuck['6']).toBe(2);
    expect(game.save?.player.gold).toBe(beforeGold - result.cost.gold);
    expect(game.save?.bag.items[ENHANCE_MATERIAL_IDS.stone]).toBe(beforeStone - result.cost.stone);
    await game.persist();
  });

  it('冲 +10 失败会掉级，但保留已掷出的高位增幅供复升复用', async () => {
    const seed = seedForRoll((roll) => roll >= 0.45);
    const instance = enhancedInstance(9);
    const game = useGameStore();
    game.loadFrom(forgeSave(instance, seed));

    const result = game.enhanceEquipment(instance.uid, false);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.result.outcome).toBe('downgraded');
    expect(result.instance?.enhance).toBe(8);
    expect(result.instance?.enhanceGainPermille[8]).toBe(80);
    expect(result.instance?.enhanceLuck['10']).toBe(3);
    await game.persist();
  });

  it('保护符只在实际防住碎裂时消耗', async () => {
    const seed = seedForRoll((roll) => roll >= 0.22);
    const instance = enhancedInstance(12);
    const save = forgeSave(instance, seed);
    save.bag.items[ENHANCE_MATERIAL_IDS.protection] = 1;
    const game = useGameStore();
    game.loadFrom(save);

    const result = game.enhanceEquipment(instance.uid, true);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.result.outcome).toBe('protected');
    expect(result.result.protectionConsumed).toBe(true);
    expect(result.instance?.enhance).toBe(12);
    expect(result.instance?.enhanceLuck['13']).toBe(5);
    expect(game.save?.bag.items[ENHANCE_MATERIAL_IDS.protection]).toBeUndefined();
    await game.persist();
  });

  it('碎裂会从背包或穿戴槽删除整件装备及其全部幸运桶', async () => {
    const seed = seedForRoll((roll) => roll >= 0.22);

    for (const location of ['bag', 'equipped'] as const) {
      setActivePinia(createPinia());
      const instance = enhancedInstance(12, { enhanceLuck: { '13': 40, '14': 12 } });
      const save = forgeSave(instance, seed);
      if (location === 'equipped') {
        save.bag.equipment = [];
        save.equipped.weapon = instance;
      }
      const game = useGameStore();
      game.loadFrom(save);

      const result = game.enhanceEquipment(instance.uid, false);

      expect(result.ok).toBe(true);
      if (!result.ok) continue;
      expect(result.result.outcome).toBe('broken');
      expect(result.instance).toBeNull();
      expect(game.save?.bag.equipment).toHaveLength(0);
      expect(game.save?.equipped.weapon).toBeNull();
      await game.persist();
    }
  });

  it('幸运保底成功不要求也不消耗保护符', async () => {
    const instance = enhancedInstance(12, { enhanceLuck: { '13': 100 } });
    const save = forgeSave(instance, 12);
    delete save.bag.items[ENHANCE_MATERIAL_IDS.protection];
    const game = useGameStore();
    game.loadFrom(save);

    const quote = game.quoteEnhance(instance.uid, true);
    expect(quote.ok && quote.guaranteed).toBe(true);
    const result = game.enhanceEquipment(instance.uid, true);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.result.outcome).toBe('success');
    expect(result.result.protectionConsumed).toBe(false);
    expect(game.save?.bag.items[ENHANCE_MATERIAL_IDS.protection]).toBeUndefined();
    await game.persist();
  });

  it('掉级后复升已有增幅时不重掷该格', async () => {
    const gains: number[] = Array.from({ length: ENHANCE_MAX }, (_, index) => (index < 8 ? 80 : 0));
    gains[8] = 110;
    const instance = enhancedInstance(8, {
      enhanceGainPermille: gains,
      enhanceLuck: { '9': 100 },
    });
    const game = useGameStore();
    game.loadFrom(forgeSave(instance, 44));

    const result = game.enhanceEquipment(instance.uid, false);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.result.outcome).toBe('success');
    expect(result.gainRoll).toBeNull();
    expect(result.instance?.enhanceGainPermille[8]).toBe(110);
    await game.persist();
  });

  it.each([
    ['insufficient-gold', 'gold'],
    ['insufficient-stone', 'stone'],
    ['insufficient-ore', 'ore'],
    ['insufficient-lucky', 'lucky'],
    ['insufficient-protection', 'protection'],
  ] as const)('%s 时资产与 RNG 完全不变', async (reason, missing) => {
    const instance = enhancedInstance(12);
    const save = forgeSave(instance, 77);
    if (missing === 'gold') save.player.gold = 0;
    else delete save.bag.items[ENHANCE_MATERIAL_IDS[missing]];
    const game = useGameStore();
    game.loadFrom(save);
    const before = JSON.parse(JSON.stringify(game.save));

    const result = game.enhanceEquipment(instance.uid, missing === 'protection');

    expect(result).toEqual({ ok: false, reason });
    expect(game.save).toEqual(before);
    await game.persist();
  });
});

describe('boutique purchase transaction', () => {
  const offer = SHOP_OFFERS.find((entry) => entry.defId === 'eq_shop_berry-cream_body')!;

  function richSave() {
    const save = createSave('商店测试', 'witch', 88, Date.now());
    save.player.level = 20;
    save.player.gold = offer.price * 2;
    save.progress.clearedStageIds.push(offer.unlockStageId);
    return save;
  }

  it('成功购买只扣一次金币、只生成一件装备并持久化限购状态', async () => {
    const game = useGameStore();
    const save = richSave();
    const beforeUid = save.nextUid;
    game.loadFrom(save);

    const result = game.purchaseShopOffer(offer.id);
    expect(result.ok).toBe(true);
    expect(game.save?.player.gold).toBe(offer.price);
    expect(game.save?.bag.equipment).toHaveLength(1);
    expect(game.save?.bag.equipment[0]).toMatchObject({
      uid: `e${beforeUid}`,
      defId: offer.defId,
      affixes: [],
      locked: true,
    });
    expect(game.save?.nextUid).toBe(beforeUid + 1);
    expect(game.save?.shop.purchasedOfferIds).toEqual([offer.id]);

    const second = game.purchaseShopOffer(offer.id);
    expect(second).toEqual({ ok: false, reason: 'sold-out' });
    expect(game.save?.player.gold).toBe(offer.price);
    expect(game.save?.bag.equipment).toHaveLength(1);
    expect(game.save?.nextUid).toBe(beforeUid + 1);

    await game.persist();
    const loaded = await loadSave();
    expect(loaded?.shop.purchasedOfferIds).toEqual([offer.id]);
    expect(loaded?.bag.equipment[0]?.defId).toBe(offer.defId);
  });

  it('金币、等级或关卡不足时不修改任何资产字段', async () => {
    const game = useGameStore();
    const save = richSave();
    save.player.gold = offer.price - 1;
    game.loadFrom(save);
    const before = JSON.parse(JSON.stringify(game.save));

    expect(game.purchaseShopOffer(offer.id)).toEqual({
      ok: false,
      reason: 'insufficient-gold',
    });
    expect(game.save).toEqual(before);
    await game.persist();
  });
});
