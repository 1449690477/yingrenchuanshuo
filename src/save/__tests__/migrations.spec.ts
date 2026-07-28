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

function v4Save(): Record<string, unknown> {
  const current = createSave('v4 少女', 'shaman', 27, 1_800_000_000_000);
  const { encounters: _removed, ...legacy } = current;
  return { ...legacy, version: 4 };
}

function v5Save(): Record<string, unknown> {
  const current = createSave('v5 少女', 'witch', 28, 1_800_000_000_000);
  return { ...current, version: 5 };
}

function v6Save(): Record<string, unknown> {
  const current = createSave('v6 少女', 'catkin', 29, 1_800_000_000_000);
  const { equipmentDungeon: _removed, ...legacy } = current;
  return { ...legacy, version: 6 };
}

function v7Save(): Record<string, unknown> {
  const current = createSave('v7 少女', 'witch', 30, 1_800_000_000_000);
  const { characters: _removed, ...legacyEncounters } = current.encounters;
  legacyEncounters.pending.push({
    uid: 'enc_7',
    encounterId: 'enc_r1_petalsmith',
    regionId: 'r1',
  });
  return { ...current, version: 7, encounters: legacyEncounters };
}

function v8Save(): Record<string, unknown> {
  const current = createSave('v8 少女', 'shaman', 31, 1_800_000_000_000);
  const { affection: _removedAffection, ...legacy } = current;
  const { haptics: _removedHaptics, ...legacySettings } = legacy.settings;
  return {
    ...legacy,
    version: 8,
    settings: legacySettings,
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

    expect(migrated.version).toBe(SAVE_VERSION);
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

    const migrated = migrate(once);
    expect(migrated.bag.equipment[0]?.baseRollPermille).toBe(1177);
    expect(migrated.bag.equipment[0]?.enhanceGainPermille).toEqual([
      80, 81, 82, 83, 110, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
    ]);
    expect(migrated.bag.equipment[0]?.enhanceLuck).toEqual({ '6': 17 });
  });

  it('v4 → v5 添加空奇遇状态且不丢强化装备与旧资产', () => {
    const raw = v4Save();
    const legacyPlayer = raw.player as { gold: number };
    legacyPlayer.gold = 8_765_432;
    const migrated = migrate(raw);

    expect(migrated.encounters).toEqual({
      progressSec: 0,
      generatedCount: 0,
      resolvedCount: 0,
      pending: [],
      characters: {},
    });
    expect(migrated.player.gold).toBe(8_765_432);
    expect(migrated.player.name).toBe('v4 少女');
  });

  it('v5 → v6 扩展职业值域且不改写旧职业与资产', () => {
    const raw = v5Save();
    const legacyPlayer = raw.player as { gold: number };
    legacyPlayer.gold = 9_876_543;
    const migrated = migrate(raw);

    expect(migrated.version).toBe(SAVE_VERSION);
    expect(migrated.player.classId).toBe('witch');
    expect(migrated.player.gold).toBe(9_876_543);
    expect(migrated.player.name).toBe('v5 少女');
  });

  it('v6 → v7 新增装备副本日次数与永久记录，不改写旧资产', () => {
    const raw = v6Save();
    const legacyPlayer = raw.player as { gold: number };
    legacyPlayer.gold = 12_345_678;

    const migrated = migrate(raw);

    expect(migrated.version).toBe(SAVE_VERSION);
    expect(migrated.player.classId).toBe('catkin');
    expect(migrated.player.gold).toBe(12_345_678);
    expect(migrated.equipmentDungeon).toEqual({
      dayKey: '2027-01-15',
      clearsToday: 0,
      totalClears: 0,
      records: {},
    });
  });

  it('v7 → v8 新增空角色进度并原样保留待处理奇遇', () => {
    const raw = v7Save();
    const migrated = migrate(raw);

    expect(migrated.version).toBe(SAVE_VERSION);
    expect(migrated.encounters.characters).toEqual({});
    expect(migrated.encounters.pending).toEqual([
      { uid: 'enc_7', encounterId: 'enc_r1_petalsmith', regionId: 'r1' },
    ]);
    expect(migrated.player.name).toBe('v7 少女');
  });

  it('v8 → v9 新增四角色好感、保底、剧情记录与触觉开关', () => {
    const raw = v8Save();
    const migrated = migrate(raw);

    expect(migrated.version).toBe(SAVE_VERSION);
    expect(migrated.settings.haptics).toBe(true);
    expect(Object.keys(migrated.affection.characters).sort()).toEqual([
      'catkin',
      'shaman',
      'swordsman',
      'witch',
    ]);
    expect(migrated.affection.characters.shaman).toMatchObject({
      points: 0,
      mood: 'calm',
      dayKey: '2027-01-15',
      interactionsToday: 0,
      totalInteractions: 0,
      gearPity: 0,
      discoveredGearIds: [],
      completedStoryIds: [],
      choiceHistory: {},
    });
    expect(migrated.player.name).toBe('v8 少女');
  });

  it('v8 → v9 使用旧档时间初始化业务日，并忽略伪造的新版好感字段', () => {
    const raw = v8Save();
    raw.affection = {
      characters: {
        witch: { points: 99_999 },
      },
    };
    const settings = raw.settings as Record<string, unknown>;
    settings.haptics = false;

    const once = migrations[8]!(raw);
    const twice = migrations[8]!(once);
    expect(twice).toEqual(once);
    expect(
      ((once.affection as { characters: { witch: { points: number } } }).characters.witch)
        .points,
    ).toBe(0);
    expect((once.settings as { haptics: boolean }).haptics).toBe(true);
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
