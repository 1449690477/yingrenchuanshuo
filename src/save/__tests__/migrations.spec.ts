import { describe, expect, it } from 'vitest';
import { baseEquipStats, instanceStats } from '@/core/equipment';
import { ENHANCE_MAX, ENHANCE_PER_LEVEL } from '@/data/constants';
import { requireEquipment } from '@/data/equipment';
import { createSave, SAVE_VERSION, SaveValidationError } from '../schema';
import { migrate, migrations, SaveTooNewError } from '../migrations';

function v0Save(): Record<string, unknown> {
  const current = createSave('旧档少女', 'witch', 42, 1_800_000_000_000);
  const { reduceMotion: _removed, ...legacySettings } = current.settings;
  return {
    ...current,
    version: 0,
    settings: legacySettings,
  };
}

function v1Save(): Record<string, unknown> {
  const current = createSave('v1 少女', 'swordsman', 24, 1_800_000_000_000);
  const { stageKills: _removed, ...legacyProgress } = current.progress;
  return {
    ...current,
    version: 1,
    progress: legacyProgress,
  };
}

function v2Save(): Record<string, unknown> {
  const current = createSave('v2 少女', 'witch', 25, 1_800_000_000_000);
  const { shop: _removed, ...legacy } = current;
  return {
    ...legacy,
    version: 2,
  };
}

function legacyInstance(uid: string, defId: string, enhance: number) {
  return {
    uid,
    defId,
    enhance,
    affixes: [{ key: 'atk', value: 7 }],
    locked: true,
  };
}

function v3Save(): Record<string, unknown> {
  const current = createSave('v3 少女', 'witch', 26, 1_800_000_000_000);
  return {
    ...current,
    version: 3,
    nextUid: 3,
    bag: {
      ...current.bag,
      equipment: [legacyInstance('e1', 'eq_r1_ring_common', 5)],
    },
    equipped: {
      ...current.equipped,
      weapon: legacyInstance('e2', 'eq_r1_weapon_common', 9),
    },
  };
}

describe('save migrations', () => {
  it('v0 依次迁移到当前版本且不丢旧数据', () => {
    const migrated = migrate(v0Save());

    expect(migrated.version).toBe(SAVE_VERSION);
    expect(migrated.settings.reduceMotion).toBe(false);
    expect(migrated.player.name).toBe('旧档少女');
    expect(migrated.seed).toBe(42);
    expect(migrated.progress.stageKills).toEqual({});
  });

  it('v1 → v2 添加逐关击杀进度', () => {
    const migrated = migrate(v1Save());

    expect(migrated.version).toBe(SAVE_VERSION);
    expect(migrated.progress.stageKills).toEqual({});
    expect(migrated.shop.purchasedOfferIds).toEqual([]);
    expect(migrated.player.name).toBe('v1 少女');
  });

  it('v2 → v3 添加珍品商店限购记录且不丢旧资产', () => {
    const raw = v2Save();
    const legacyPlayer = raw.player as { gold: number };
    legacyPlayer.gold = 7_654_321;
    const migrated = migrate(raw);

    expect(migrated.version).toBe(SAVE_VERSION);
    expect(migrated.shop.purchasedOfferIds).toEqual([]);
    expect(migrated.player.gold).toBe(7_654_321);
    expect(migrated.player.name).toBe('v2 少女');
  });

  it('v3 → v4 为全部装备补齐胚子、逐级强化增幅和幸运桶，旧 CP 不变', () => {
    const migrated = migrate(v3Save());
    const bagInstance = migrated.bag.equipment[0]!;
    const equippedInstance = migrated.equipped.weapon!;
    const legacyGain = ENHANCE_PER_LEVEL * 1000;

    expect(migrated.version).toBe(4);
    expect(bagInstance).toMatchObject({
      uid: 'e1',
      baseRollPermille: 1000,
      enhanceLuck: {},
      locked: true,
    });
    expect(bagInstance.enhanceGainPermille).toEqual([
      ...Array<number>(5).fill(legacyGain),
      ...Array<number>(ENHANCE_MAX - 5).fill(0),
    ]);
    expect(equippedInstance.enhanceGainPermille.slice(0, 9)).toEqual(
      Array<number>(9).fill(legacyGain),
    );

    const definition = requireEquipment(equippedInstance.defId);
    const expectedOldAtk =
      baseEquipStats(definition).atk * (1 + ENHANCE_PER_LEVEL * equippedInstance.enhance) + 7;
    expect(instanceStats(definition, equippedInstance).atk).toBeCloseTo(expectedOldAtk, 8);
  });

  it('v3 → v4 迁移函数重复执行结果一致，并忽略伪造的新版字段', () => {
    const forged = v3Save();
    const forgedBag = (forged.bag as { equipment: Record<string, unknown>[] }).equipment;
    forgedBag[0]!.baseRollPermille = 1200;
    forgedBag[0]!.enhanceGainPermille = Array<number>(ENHANCE_MAX).fill(125);
    forgedBag[0]!.enhanceLuck = { '6': 100 };

    const once = migrations[3]!(forged);
    const twice = migrations[3]!(once);
    expect(twice).toEqual(once);

    const migrated = (once.bag as { equipment: Record<string, unknown>[] }).equipment[0]!;
    expect(migrated.baseRollPermille).toBe(1000);
    expect(migrated.enhanceGainPermille).toEqual([
      ...Array<number>(5).fill(ENHANCE_PER_LEVEL * 1000),
      ...Array<number>(ENHANCE_MAX - 5).fill(0),
    ]);
    expect(migrated.enhanceLuck).toEqual({});
  });

  it('当前版本迁移不会重写已经存在的随机结果', () => {
    const once = migrations[3]!(v3Save());
    const bag = (once.bag as { equipment: Record<string, unknown>[] }).equipment;
    bag[0]!.baseRollPermille = 1177;
    bag[0]!.enhanceGainPermille = [80, 81, 82, 83, 110, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
    bag[0]!.enhanceLuck = { '6': 17 };

    expect(migrate(once)).toEqual(once);
  });

  it('当前版本不迁移，只做严格结构校验', () => {
    const current = createSave('当前档', 'shaman', 3, 1_800_000_000_000);
    expect(migrate(current as unknown as Record<string, unknown>)).toEqual(current);

    const broken = structuredClone(current);
    delete (broken.player as Partial<typeof broken.player>).gold;
    expect(() => migrate(broken as unknown as Record<string, unknown>)).toThrow(
      SaveValidationError,
    );
  });

  it('高版本存档不能静默降级', () => {
    const future = {
      ...(createSave('未来档', 'swordsman', 8, 1_800_000_000_000) as unknown as Record<
        string,
        unknown
      >),
      version: SAVE_VERSION + 1,
    };
    expect(() => migrate(future)).toThrow(SaveTooNewError);
  });
});
