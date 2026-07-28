import { describe, expect, it } from 'vitest';
import { baseEquipStats, instanceStats } from '@/core/equipment';
import type { EquipmentInstance } from '@/core/types';
import { AFFIX_POOL, ENHANCE_MAX, ENHANCE_PER_LEVEL } from '@/data/constants';
import { requireEquipment } from '@/data/equipment';
import { createSave, SAVE_VERSION, SaveValidationError } from '../schema';
import { migrate, MigrationError, migrations, SaveTooNewError } from '../migrations';

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

function legacyAffixValue(
  key: (typeof AFFIX_POOL)[number]['key'],
  level: number,
  multiplier: number,
): number {
  const entry = AFFIX_POOL.find((candidate) => candidate.key === key);
  if (!entry) throw new Error(`测试词条不存在：${key}`);
  const baseline = ((entry.min + entry.max) / 2) * (entry.scalesWithLevel ? level ** 1.3 : 1);
  return baseline * multiplier;
}

function v9Equipment(
  uid: string,
  defId: string,
  affixes: Record<string, unknown>[],
): Record<string, unknown> {
  return {
    uid,
    defId,
    enhance: 0,
    baseRollPermille: 1000,
    enhanceGainPermille: Array<number>(ENHANCE_MAX).fill(0),
    enhanceLuck: {},
    affixes,
    locked: false,
  };
}

function v9Save(): Record<string, unknown> {
  const current = createSave('v9 少女', 'witch', 32, 1_800_000_000_000);
  const ringDef = requireEquipment('eq_dungeon_crimson_shoes_1');
  const weaponDef = requireEquipment('eq_r2_weapon_epic');
  const ring = v9Equipment('e1', ringDef.id, [
    {
      key: 'atk',
      value: legacyAffixValue('atk', ringDef.level, 0.7),
      // v9 schema 曾允许这个无效字段；v10 应删除，不能显示成“攻击力·炎”。
      element: 'fire',
      // v9 不存在该字段；迁移必须按 value 反推，不能信任注入品阶。
      tier: 5,
    },
    { key: 'def', value: legacyAffixValue('def', ringDef.level, 0.92) },
    { key: 'critRate', value: legacyAffixValue('critRate', ringDef.level, 1) },
    { key: 'skillMul', value: legacyAffixValue('skillMul', ringDef.level, 1.25) },
  ]);
  ring.reforgeResonance = 19;
  ring.pendingAffixChange = {
    operation: 'reforge',
    affixIndex: 0,
    candidate: { key: 'hp', value: 999_999, tier: 5 },
  };

  return {
    ...current,
    version: 9,
    nextUid: 4,
    bag: {
      ...current.bag,
      equipment: [
        ring,
        // 旧白装没有随机词条；迁移只能补元数据，不能补发新词条。
        v9Equipment('e2', 'eq_r1_shoes_common', []),
      ],
    },
    equipped: {
      ...current.equipped,
      weapon: v9Equipment('e3', weaponDef.id, [
        {
          key: 'elemDmg',
          value: legacyAffixValue('elemDmg', weaponDef.level, 1.6),
          element: 'none',
        },
      ]),
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
      (once.affection as { characters: { witch: { points: number } } }).characters.witch.points,
    ).toBe(0);
    expect((once.settings as { haptics: boolean }).haptics).toBe(true);
  });

  it('v9 → v10 遍历背包与穿戴装备反推五档品阶，value 与战力结果保持不变', () => {
    const raw = v9Save();
    const rawBag = (raw.bag as { equipment: Record<string, unknown>[] }).equipment;
    const ringDef = requireEquipment(rawBag[0]!.defId as string);
    const beforeStats = instanceStats(ringDef, rawBag[0] as unknown as EquipmentInstance);
    const beforeValues = (rawBag[0]!.affixes as { value: number }[]).map((affix) => affix.value);
    const rngState = raw.rngState;

    const migrated = migrate(raw);
    const migratedRing = migrated.bag.equipment[0]!;
    const migratedWeapon = migrated.equipped.weapon!;

    expect(migrated.version).toBe(SAVE_VERSION);
    // 品阶只是按最近系数贴的标签；下一行的 value 与再下一行的战力才是不变量。
    // AFFIX_TIERS 系数重标定后标签整体上移一档，属预期。
    expect(migratedRing.affixes.map((affix) => affix.tier)).toEqual([2, 3, 4, 4]);
    expect(migratedRing.affixes[0]?.element).toBeUndefined();
    expect(migratedRing.affixes[3]?.key).toBe('skillMul');
    expect(migratedRing.affixes.map((affix) => affix.value)).toEqual(beforeValues);
    expect(instanceStats(ringDef, migratedRing)).toEqual(beforeStats);
    expect(migratedRing.reforgeResonance).toBe(0);
    expect(migratedRing.pendingAffixChange).toBeUndefined();
    expect(migrated.bag.equipment[1]).toMatchObject({
      uid: 'e2',
      affixes: [],
      reforgeResonance: 0,
    });
    expect(migratedWeapon.reforgeResonance).toBe(0);
    expect(migratedWeapon.affixes[0]?.tier).toBe(5);
    expect(['fire', 'ice', 'thunder']).toContain(migratedWeapon.affixes[0]?.element);
    expect(migrated.rngState).toBe(rngState);
  });

  it('v9 → v10 的旧属性元素映射只由 uid 与词条索引决定，重复迁移稳定', () => {
    const first = migrate(v9Save());
    const second = migrate(v9Save());

    expect(first.equipped.weapon?.affixes[0]?.element).toBe(
      second.equipped.weapon?.affixes[0]?.element,
    );
    expect(first.rngState).toBe(32);
    expect(second.rngState).toBe(32);
  });

  it('v9 → v10 迁移函数幂等，并忽略伪造的 tier、共鸣和待决候选', () => {
    const once = migrations[9]!(v9Save());
    const twice = migrations[9]!(once);
    const ring = (once.bag as { equipment: Record<string, unknown>[] }).equipment[0]!;
    const affixes = ring.affixes as { tier: number }[];

    expect(twice).toEqual(once);
    expect(affixes[0]?.tier).toBe(2);
    expect(ring.reforgeResonance).toBe(0);
    expect(ring.pendingAffixChange).toBeUndefined();
  });

  it('v9 → v10 遇到未知装备、未知词条或坏装备结构时明确报 MigrationError(9)', () => {
    const unknownDefinition = v9Save();
    (unknownDefinition.bag as { equipment: Record<string, unknown>[] }).equipment[0]!.defId =
      'eq_deleted';
    expect(() => migrate(unknownDefinition)).toThrow(MigrationError);
    expect(() => migrate(unknownDefinition)).toThrow(/v9 存档迁移到 v10/);

    const unknownAffix = v9Save();
    const unknownAffixes = (
      unknownAffix.bag as { equipment: { affixes: Record<string, unknown>[] }[] }
    ).equipment[0]!.affixes;
    unknownAffixes[0]!.key = 'deletedAffix';
    expect(() => migrate(unknownAffix)).toThrow(MigrationError);

    const malformed = v9Save();
    (malformed.bag as { equipment: Record<string, unknown>[] }).equipment[0]!.affixes = null;
    expect(() => migrate(malformed)).toThrow(MigrationError);
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
