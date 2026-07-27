import 'fake-indexeddb/auto';
import { createPinia, setActivePinia } from 'pinia';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createInstance } from '@/core/equipment';
import { Rng } from '@/core/rng';
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
