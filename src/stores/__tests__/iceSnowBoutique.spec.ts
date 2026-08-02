import 'fake-indexeddb/auto';
import { createPinia, setActivePinia } from 'pinia';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { CLASS_IDS, type ClassId, type EquipmentInstance } from '@/core/types';
import { SLOT_ORDER } from '@/data/constants';
import { requireEquipment } from '@/data/equipment';
import { ITEMS } from '@/data/items';
import { SHOP_OFFERS } from '@/data/shop';
import { createSave } from '@/save/schema';
import { clearSave, loadSave } from '@/save/storage';
import { useGameStore } from '../game';

async function synchronizeAndClear(): Promise<void> {
  try {
    await loadSave();
  } catch {
    // 只为同步当前测试客户端的 revision，随后仍走正式 CAS 清档。
  }
  await clearSave();
}

beforeEach(async () => {
  setActivePinia(createPinia());
  await synchronizeAndClear();
});

afterEach(async () => {
  await synchronizeAndClear();
});

function iceSave(classId: ClassId) {
  const save = createSave('冰雪华年验收', classId, 0x20260802, Date.now());
  save.player.level = 78;
  save.player.gold = 3_000_000_000;
  save.progress.currentStageId = 'stage_7-5_6';
  save.progress.clearedStageIds = ['stage_7-5_6'];
  save.bag.items = Object.fromEntries(Object.keys(ITEMS).map((id) => [id, 100_000]));
  return save;
}

function classIceOffers(classId: ClassId) {
  return SHOP_OFFERS.filter((offer) => {
    if (!offer.id.startsWith('offer_ice-snow_')) return false;
    const definition = requireEquipment(offer.defId);
    return !definition.classId || definition.classId === classId;
  });
}

function purchaseFullSet(classId: ClassId) {
  const game = useGameStore();
  game.loadFrom(iceSave(classId));
  const instances: EquipmentInstance[] = [];
  for (const offer of classIceOffers(classId)) {
    const result = game.purchaseShopOffer(offer.id);
    expect(result.ok, `${classId}:${offer.id}`).toBe(true);
    if (result.ok) instances.push(result.instance);
  }
  return { game, instances };
}

describe('冰雪华年完整装备系统接入', () => {
  it.each(CLASS_IDS)('%s 购买八件后进入背包、锁定、图鉴、穿戴与预设链', async (classId) => {
    const { game, instances } = purchaseFullSet(classId);
    const defIds = instances.map((instance) => instance.defId);

    expect(instances).toHaveLength(8);
    expect(game.save!.player.gold).toBe(1_850_000_000);
    expect(game.save!.shop.purchasedOfferIds).toHaveLength(8);
    expect(game.save!.equipmentCodex.discoveredDefIds).toEqual(defIds);
    for (const instance of instances) {
      expect(instance.locked, instance.defId).toBe(true);
      expect(instance.affixes, instance.defId).toHaveLength(3);
    }
    expect(game.equipBest()).toBe(8);
    expect(SLOT_ORDER.every((slot) => game.save!.equipped[slot] !== null)).toBe(true);

    expect(game.captureEquipmentPreset('preset-1')).toMatchObject({ ok: true });
    for (const slot of SLOT_ORDER) expect(game.unequip(slot), slot).toBe(true);
    expect(game.applyEquipmentPreset('preset-1')).toMatchObject({ ok: true, changedSlots: 8 });

    await game.persist();
    const persisted = await loadSave();
    expect(persisted?.equipmentCodex.discoveredDefIds).toEqual(defIds);
    expect(persisted?.shop.purchasedOfferIds).toHaveLength(8);
    expect(persisted?.equipmentPresets.presets).toHaveLength(1);
    expect(SLOT_ORDER.every((slot) => persisted?.equipped[slot] !== null)).toBe(true);
  });

  it('同一实例可强化、洗练和手动锁定，固定 T5 身份词条不会被洗掉', async () => {
    const game = useGameStore();
    game.loadFrom(iceSave('swordsman'));
    const offer = classIceOffers('swordsman').find(
      (candidate) => requireEquipment(candidate.defId).slot === 'weapon',
    )!;
    const purchase = game.purchaseShopOffer(offer.id);
    expect(purchase.ok).toBe(true);
    if (!purchase.ok) return;
    const instance = purchase.instance;
    const definition = requireEquipment(instance.defId);
    const fixedBefore = structuredClone(definition.fixedAffixes);

    game.toggleLock(instance.uid);
    expect(instance.locked).toBe(false);
    game.toggleLock(instance.uid);
    expect(instance.locked).toBe(true);

    expect(game.quoteEnhance(instance.uid, false)).toMatchObject({ ok: true });
    expect(game.enhanceEquipment(instance.uid, false)).toMatchObject({ ok: true });
    expect(game.save!.bag.equipment[0]?.enhance).toBe(1);

    const planned = await game.startAffixChange(instance.uid, 'reforge');
    expect(planned.ok).toBe(true);
    expect(requireEquipment(instance.defId).fixedAffixes).toEqual(fixedBefore);
    expect(game.save!.bag.equipment[0]?.pendingAffixChange).toBeDefined();
    expect(await game.resolveAffixChange(instance.uid, 'adopt')).toMatchObject({ ok: true });
    expect(requireEquipment(instance.defId).fixedAffixes).toEqual(fixedBefore);
    expect(game.equipmentAdvancementOption(instance.uid)).toBeUndefined();
  });

  it('解锁、金币不足与售罄都走正式商店判据，不会先扣款再失败', () => {
    const offer = classIceOffers('swordsman')[0]!;
    const game = useGameStore();
    const locked = iceSave('swordsman');
    locked.progress.clearedStageIds = [];
    locked.progress.currentStageId = 'stage_1-1_1';
    game.loadFrom(locked);
    expect(game.purchaseShopOffer(offer.id)).toEqual({ ok: false, reason: 'stage-locked' });

    const poor = iceSave('swordsman');
    poor.player.gold = offer.price - 1;
    game.loadFrom(poor);
    expect(game.purchaseShopOffer(offer.id)).toEqual({ ok: false, reason: 'insufficient-gold' });
    expect(game.save!.player.gold).toBe(offer.price - 1);

    game.save!.player.gold = offer.price;
    expect(game.purchaseShopOffer(offer.id)).toMatchObject({ ok: true });
    expect(game.save!.player.gold).toBe(0);
    expect(game.purchaseShopOffer(offer.id)).toEqual({ ok: false, reason: 'sold-out' });
  });

  it('默认锁定会阻止分解；手动解锁后回收低于原价 1% 且永久图鉴不熄灭', () => {
    const game = useGameStore();
    game.loadFrom(iceSave('swordsman'));
    const offer = classIceOffers('swordsman')[0]!;
    const purchase = game.purchaseShopOffer(offer.id);
    expect(purchase.ok).toBe(true);
    if (!purchase.ok) return;

    expect(game.decompose([purchase.instance.uid])).toEqual({ count: 0, gold: 0 });
    expect(game.save!.bag.equipment.some((item) => item.uid === purchase.instance.uid)).toBe(true);

    game.toggleLock(purchase.instance.uid);
    const result = game.decompose([purchase.instance.uid]);
    expect(result.count).toBe(1);
    expect(result.gold).toBeLessThan(offer.price * 0.01);
    expect(game.save!.bag.equipment.some((item) => item.uid === purchase.instance.uid)).toBe(false);
    expect(game.save!.equipmentCodex.discoveredDefIds).toContain(purchase.instance.defId);
  });
});
