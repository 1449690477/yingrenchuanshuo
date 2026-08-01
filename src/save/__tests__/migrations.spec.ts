import { describe, expect, it } from 'vitest';
import { affixValueRange, baseEquipStats, instanceStats } from '@/core/equipment';
import { promoteAffix } from '@/core/reforge';
import type { EquipmentInstance } from '@/core/types';
import { AFFIX_POOL, ENHANCE_MAX, ENHANCE_PER_LEVEL, SLOT_ORDER } from '@/data/constants';
import { requireEquipment } from '@/data/equipment';
import { ORDERED_STAGE_IDS } from '@/data/stages';
import { createSave, SAVE_VERSION, SaveValidationError } from '../schema';
import { migrate, MigrationError, migrations, SaveTooNewError } from '../migrations';
import { V10_EQUIPMENT_DEFINITION_IDS } from '../v10EquipmentDefinitions';

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

const V10_REBASED_VALUES = {
  swd_heavy: { old: 7.8, current: 23.1 },
  wit_power: { old: 32.7, current: 22.2 },
  wit_elem: { old: 7.3, current: 3.7 },
  cat_swift: { old: 0.033, current: 0.023 },
} as const;

type V10RebasedKey = keyof typeof V10_REBASED_VALUES;

function v10ProfessionAffix(
  key: V10RebasedKey,
  element?: 'fire' | 'ice' | 'thunder',
): Record<string, unknown> {
  return {
    key,
    value: V10_REBASED_VALUES[key].old,
    tier: 3,
    ...(element ? { element } : {}),
  };
}

function v10PendingEquipment(
  uid: string,
  targetKey: V10RebasedKey,
  candidateKey: V10RebasedKey,
): Record<string, unknown> {
  return {
    uid,
    defId: 'eq_r2_ring_epic',
    enhance: 0,
    baseRollPermille: 1000,
    enhanceGainPermille: Array<number>(ENHANCE_MAX).fill(0),
    enhanceLuck: {},
    affixes: [
      { key: 'atk', value: affixValueRange('atk', 20, 2).min, tier: 2 },
      {
        key: 'critRate',
        value: affixValueRange('critRate', 20, 2).min,
        tier: 2,
      },
      v10ProfessionAffix(targetKey, targetKey === 'wit_elem' ? 'fire' : undefined),
    ],
    reforgeResonance: 7,
    pendingAffixChange: {
      operation: 'reforge',
      affixIndex: 2,
      candidate: v10ProfessionAffix(candidateKey, candidateKey === 'wit_elem' ? 'ice' : undefined),
    },
    locked: false,
  };
}

function v10Equipment(
  uid: string,
  defId: string,
  affixes: Record<string, unknown>[],
  pendingAffixChange?: Record<string, unknown>,
): Record<string, unknown> {
  return {
    uid,
    defId,
    enhance: 0,
    baseRollPermille: 1000,
    enhanceGainPermille: Array<number>(ENHANCE_MAX).fill(0),
    enhanceLuck: {},
    affixes,
    reforgeResonance: 0,
    ...(pendingAffixChange ? { pendingAffixChange } : {}),
    locked: false,
  };
}

function v10Save(): Record<string, unknown> {
  const current = createSave('v10 少女', 'witch', 33, 1_800_000_000_000);
  current.player.gold = 1_234_567;
  current.rngState = 987_654_321;
  current.nextUid = 5;
  current.bag.items.crystal_temper = 77;
  current.bag.equipment.push(
    v10PendingEquipment('e1', 'swd_heavy', 'wit_power') as unknown as EquipmentInstance,
    v10PendingEquipment('e2', 'wit_power', 'wit_elem') as unknown as EquipmentInstance,
    v10PendingEquipment('e3', 'wit_elem', 'cat_swift') as unknown as EquipmentInstance,
  );
  current.equipped.ring = v10PendingEquipment(
    'e4',
    'cat_swift',
    'swd_heavy',
  ) as unknown as EquipmentInstance;
  return { ...current, version: 10 };
}

describe('save migrations', () => {
  it('从最老 v0 逐级执行到当前 v20，每一步只前进一个版本且迁移链无缺口', () => {
    let raw = v0Save();
    for (let from = 0; from < SAVE_VERSION; from += 1) {
      expect(raw.version, `进入 v${from} → v${from + 1} 前版本必须匹配`).toBe(from);
      const migration = migrations[from];
      expect(migration, `缺少 v${from} → v${from + 1} 迁移`).toBeTypeOf('function');
      raw = migration!(raw);
      expect(raw.version, `v${from} → v${from + 1} 必须只前进一级`).toBe(from + 1);
    }
    expect(migrate(raw)).toEqual(raw);
  });

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

  it('v3 → 当前补齐强化字段，并在后续 v11 迁移中应用 T5 系数重标', () => {
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
    // v3 发布结构已经接受并保存 value=7；v11 只应用 T5 1.54→1.64 比例，
    // 不能为了贴合后来新增的掷骰区间把历史资产夹到当前 max。
    const migratedAtk = 7.5;
    expect(equippedInstance.affixes[0]?.value).toBe(migratedAtk);
    const expectedCurrentAtk =
      baseEquipStats(definition).atk * (1 + ENHANCE_PER_LEVEL * equippedInstance.enhance) +
      migratedAtk;
    expect(instanceStats(definition, equippedInstance).atk).toBeCloseTo(expectedCurrentAtk, 8);
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
      depth: {},
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

  it('v8 → 当前版本补齐五角色好感、保底、剧情记录与触觉开关', () => {
    const raw = v8Save();
    const migrated = migrate(raw);

    expect(migrated.version).toBe(SAVE_VERSION);
    expect(migrated.settings.haptics).toBe(true);
    expect(Object.keys(migrated.affection.characters).sort()).toEqual([
      'catkin',
      'kenshi',
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

  it('v9 → v10 持久化的非掷骰网格旧值可继续迁到 v11，数值不被夹洗', () => {
    const persistedV10 = migrations[9]!(v9Save());
    const v10Ring = (persistedV10.bag as { equipment: Record<string, unknown>[] }).equipment[0]!;
    const v10SkillMul = (v10Ring.affixes as Record<string, unknown>[]).find(
      (affix) => affix.key === 'skillMul',
    );

    // 这是官方 v9→v10 迁移真实产物；发布版 v10 的 existing affix schema
    // 只校验 finite，不要求重新落到后来洗练使用的小数精度网格。
    expect(v10SkillMul).toEqual({ key: 'skillMul', value: 3.125, tier: 4 });

    const migrated = migrate(persistedV10);
    const migratedSkillMul = migrated.bag.equipment[0]?.affixes.find(
      (affix) => affix.key === 'skillMul',
    );
    expect(migratedSkillMul).toEqual({ key: 'skillMul', value: 3.125, tier: 4 });
  });

  it('v9 直升与先持久化 v10 再升 v11 都按发布版 1.54 推断旧 T5', () => {
    const rawV9 = v9Save();
    const ring = (rawV9.bag as { equipment: { affixes: Record<string, unknown>[] }[] })
      .equipment[0]!;
    const skillMul = ring.affixes.find((affix) => affix.key === 'skillMul')!;
    skillMul.value = 3.35;

    const persistedV10 = migrations[9]!(structuredClone(rawV9));
    const persistedSkillMul = (
      persistedV10.bag as { equipment: { affixes: Record<string, unknown>[] }[] }
    ).equipment[0]!.affixes.find((affix) => affix.key === 'skillMul');
    expect(persistedSkillMul).toEqual({ key: 'skillMul', value: 3.35, tier: 5 });

    const direct = migrate(structuredClone(rawV9));
    const throughPersistedV10 = migrate(persistedV10);
    const findSkillMul = (save: typeof direct) =>
      save.bag.equipment[0]?.affixes.find((affix) => affix.key === 'skillMul');
    expect(findSkillMul(direct)).toEqual({ key: 'skillMul', value: 3.6, tier: 5 });
    expect(findSkillMul(throughPersistedV10)).toEqual(findSkillMul(direct));
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

  it('v10 → v11 等比重标背包、穿戴与待决候选的四条职业词条，不改其他资产', () => {
    const raw = v10Save();
    const migrated = migrate(raw);
    const instances = [
      ...migrated.bag.equipment,
      ...Object.values(migrated.equipped).filter(
        (instance): instance is EquipmentInstance => instance !== null,
      ),
    ];

    expect(migrated.version).toBe(SAVE_VERSION);
    expect(migrated.player.gold).toBe(1_234_567);
    expect(migrated.rngState).toBe(987_654_321);
    expect(migrated.bag.items.crystal_temper).toBe(77);
    expect(instances).toHaveLength(4);

    for (const instance of instances) {
      const target = instance.affixes[2]!;
      const targetExpected = V10_REBASED_VALUES[target.key as V10RebasedKey].current;
      expect(target.value).toBe(targetExpected);
      expect(instance.affixes[0]).toEqual({
        key: 'atk',
        value: affixValueRange('atk', 20, 2).min,
        tier: 2,
      });
      expect(instance.affixes[1]).toEqual({
        key: 'critRate',
        value: affixValueRange('critRate', 20, 2).min,
        tier: 2,
      });
      expect(instance.reforgeResonance).toBe(7);

      const pending = instance.pendingAffixChange;
      expect(pending).toBeDefined();
      expect(pending).toMatchObject({ operation: 'reforge', affixIndex: 2 });
      const candidate = pending!.candidate;
      expect(candidate.value).toBe(V10_REBASED_VALUES[candidate.key as V10RebasedKey].current);
    }
  });

  it('v10 → v11 对普通 T5 追加全局品阶系数，对职业 T5 组合应用两层比例', () => {
    const raw = v10Save();
    const equipment = (raw.bag as { equipment: { affixes: Record<string, unknown>[] }[] })
      .equipment;
    const first = equipment[0]!;
    first.affixes[0] = { key: 'atk', value: 46, tier: 5 };
    first.affixes[1] = { key: 'critRate', value: 2.8, tier: 5 };
    first.affixes[2] = { key: 'swd_heavy', value: 14, tier: 5 };
    equipment[1]!.affixes[2] = { key: 'cat_swift', value: 0.06, tier: 5 };

    const migrated = migrate(raw);
    expect(migrated.bag.equipment[0]?.affixes[0]).toEqual({
      key: 'atk',
      value: 49,
      tier: 5,
    });
    expect(migrated.bag.equipment[0]?.affixes[1]).toEqual({
      key: 'critRate',
      value: 3,
      tier: 5,
    });
    expect(migrated.bag.equipment[0]?.affixes[2]).toEqual({
      key: 'swd_heavy',
      value: 44.2,
      tier: 5,
    });
    expect(migrated.bag.equipment[1]?.affixes[2]).toEqual({
      key: 'cat_swift',
      value: 0.044,
      tier: 5,
    });
  });

  it('v10 → v11 将职业 T5 同调候选归一到迁移后 target 的精确 promoteAffix 结果', () => {
    const raw = v10Save();
    const first = (raw.bag as { equipment: Record<string, unknown>[] }).equipment[0]!;
    first.affixes = [{ key: 'swd_heavy', value: 10, tier: 4 }];
    first.pendingAffixChange = {
      operation: 'resonate',
      affixIndex: 0,
      candidate: { key: 'swd_heavy', value: 14, tier: 5 },
    };

    const migrated = migrate(raw);
    const instance = migrated.bag.equipment[0]!;
    const target = instance.affixes[0]!;
    const candidate = instance.pendingAffixChange!.candidate;

    expect(target).toEqual({ key: 'swd_heavy', value: 29.7, tier: 4 });
    // 旧候选直接做组合缩放会得到 44.2；新共鸣公式从迁移后的 target
    // 精确复算为 44.3，必须以后者为准，否则存档严格校验会拒绝。
    expect(candidate).toEqual({ key: 'swd_heavy', value: 44.3, tier: 5 });
    expect(candidate).toEqual(promoteAffix(target));
  });

  it('v10 → v11 迁移函数幂等，并把旧 general-slot 铭刻候选重定向到预留槽', () => {
    const raw = v10Save();
    const bag = (raw.bag as { equipment: Record<string, unknown>[] }).equipment;
    bag[0]!.pendingAffixChange = {
      operation: 'inscribe',
      affixIndex: 0,
      candidate: v10ProfessionAffix('wit_power'),
    };

    const once = migrations[10]!(raw);
    const twice = migrations[10]!(once);
    expect(twice).toEqual(once);

    const parsed = migrate(raw);
    expect(parsed.bag.equipment[0]?.pendingAffixChange).toMatchObject({
      operation: 'inscribe',
      affixIndex: 2,
      candidate: {
        key: 'wit_power',
        value: V10_REBASED_VALUES.wit_power.current,
        tier: 3,
      },
    });
  });

  it('v10 → v11 无损交换通用区职业词条与预留槽通用词条，pending 跟随原目标', () => {
    const raw = v10Save();
    const first = (raw.bag as { equipment: Record<string, unknown>[] }).equipment[0]!;
    const target = {
      key: 'atk',
      value: affixValueRange('atk', 20, 2).min,
      tier: 2,
    };
    const candidate = {
      key: 'atk',
      value: affixValueRange('atk', 20, 4).max,
      tier: 4,
    };
    first.affixes = [
      v10ProfessionAffix('swd_heavy'),
      {
        key: 'critRate',
        value: affixValueRange('critRate', 20, 2).min,
        tier: 2,
      },
      target,
    ];
    first.pendingAffixChange = {
      operation: 'temper',
      affixIndex: 2,
      candidate,
    };

    const migrated = migrate(raw);
    const instance = migrated.bag.equipment[0]!;
    expect(instance.affixes.map((affix) => affix.key)).toEqual(['atk', 'critRate', 'swd_heavy']);
    expect(instance.affixes[0]).toEqual(target);
    expect(instance.affixes[2]?.value).toBe(V10_REBASED_VALUES.swd_heavy.current);
    expect(instance.pendingAffixChange).toEqual({
      operation: 'temper',
      affixIndex: 0,
      candidate,
    });
    expect(migrated.bag.items.sigil_swordsman).toBeUndefined();
  });

  it('v10 → v11 只保留百分位更高的职业词条，超额项映射通用词条并退对应徽记', () => {
    const raw = v10Save();
    const first = (raw.bag as { equipment: Record<string, unknown>[] }).equipment[0]!;
    const shamanLow = affixValueRange('sha_vitality', 20, 4).min;
    const oldCatHigh = 0.044;
    first.affixes = [
      { key: 'sha_vitality', value: shamanLow, tier: 4 },
      { key: 'atk', value: affixValueRange('atk', 20, 3).min, tier: 3 },
      { key: 'cat_swift', value: oldCatHigh, tier: 4 },
    ];
    delete first.pendingAffixChange;
    (raw.bag as { items: Record<string, number> }).items.sigil_shaman = 4;

    const migrated = migrate(raw);
    const instance = migrated.bag.equipment[0]!;
    expect(instance.affixes.map((affix) => affix.key)).toEqual(['hp', 'atk', 'cat_swift']);
    expect(instance.affixes[0]).toEqual({
      key: 'hp',
      value: affixValueRange('hp', 20, 4).min,
      tier: 4,
    });
    expect(instance.affixes[2]).toEqual({
      key: 'cat_swift',
      value: 0.03,
      tier: 4,
    });
    expect(migrated.bag.items.sigil_shaman).toBe(5);
    expect(migrated.bag.items.sigil_catkin).toBeUndefined();
    const repeated = migrations[10]!(migrated as unknown as Record<string, unknown>);
    expect(repeated).toEqual(migrated);
    expect((repeated.bag as { items: Record<string, number> }).items.sigil_shaman).toBe(5);
  });

  it('v10 → v11 已采用职业 target 转通用后，temper 候选同步到同 key 与百分位', () => {
    const raw = v10Save();
    const first = (raw.bag as { equipment: Record<string, unknown>[] }).equipment[0]!;
    first.affixes = [
      {
        key: 'sha_vitality',
        value: affixValueRange('sha_vitality', 20, 3).max,
        tier: 3,
      },
      { key: 'atk', value: affixValueRange('atk', 20, 3).min, tier: 3 },
      { key: 'cat_swift', value: 0.06, tier: 5 },
    ];
    first.pendingAffixChange = {
      operation: 'temper',
      affixIndex: 0,
      candidate: {
        key: 'sha_vitality',
        value: affixValueRange('sha_vitality', 20, 4).max,
        tier: 4,
      },
    };

    const migrated = migrate(raw);
    const instance = migrated.bag.equipment[0]!;
    expect(instance.affixes[0]).toEqual({
      key: 'hp',
      value: affixValueRange('hp', 20, 3).max,
      tier: 3,
    });
    expect(instance.pendingAffixChange).toEqual({
      operation: 'temper',
      affixIndex: 0,
      candidate: {
        key: 'hp',
        value: affixValueRange('hp', 20, 4).max,
        tier: 4,
      },
    });
  });

  it('v10 → v11 已采用职业 target 转通用后，resonate 候选精确重算', () => {
    const raw = v10Save();
    const first = (raw.bag as { equipment: Record<string, unknown>[] }).equipment[0]!;
    const oldTargetValue = affixValueRange('sha_vitality', 20, 4).max;
    const oldCandidateValue = Math.round(oldTargetValue * (1.54 / 1.1) * 10) / 10;
    first.affixes = [
      { key: 'sha_vitality', value: oldTargetValue, tier: 4 },
      { key: 'atk', value: affixValueRange('atk', 20, 3).min, tier: 3 },
      { key: 'cat_swift', value: 0.06, tier: 5 },
    ];
    first.pendingAffixChange = {
      operation: 'resonate',
      affixIndex: 0,
      candidate: {
        key: 'sha_vitality',
        value: oldCandidateValue,
        tier: 5,
      },
    };

    const migrated = migrate(raw);
    const instance = migrated.bag.equipment[0]!;
    expect(instance.affixes[0]?.key).toBe('hp');
    expect(instance.pendingAffixChange?.affixIndex).toBe(0);
    expect(instance.pendingAffixChange?.candidate).toEqual(promoteAffix(instance.affixes[0]!));
  });

  it('v10 → v11 把 rare 无职业槽的铭刻候选转为同百分位通用重铸并退徽记', () => {
    const raw = v10Save();
    const bag = raw.bag as { equipment: Record<string, unknown>[]; items: Record<string, number> };
    bag.equipment[0] = v10Equipment(
      'e1',
      'eq_r2_ring_rare',
      [
        { key: 'atk', value: affixValueRange('atk', 18, 2).min, tier: 2 },
        { key: 'critRate', value: affixValueRange('critRate', 18, 2).min, tier: 2 },
      ],
      {
        operation: 'inscribe',
        affixIndex: 0,
        candidate: {
          key: 'swd_guard',
          value: affixValueRange('swd_guard', 18, 3).max,
          tier: 3,
        },
      },
    );
    bag.items.sigil_swordsman = 2;

    const migrated = migrate(raw);
    const pending = migrated.bag.equipment[0]!.pendingAffixChange!;
    expect(pending.operation).toBe('reforge');
    expect(pending.affixIndex).toBe(0);
    expect(pending.candidate).toEqual({
      key: 'def',
      value: affixValueRange('def', 18, 3).max,
      tier: 3,
    });
    expect(migrated.bag.items.sigil_swordsman).toBe(3);
  });

  it('v10 → v11 reforge 目标从通用区换到职业槽时索引随目标，候选投影当前职业池', () => {
    const raw = v10Save();
    const first = (raw.bag as { equipment: Record<string, unknown>[] }).equipment[0]!;
    first.affixes = [
      v10ProfessionAffix('swd_heavy'),
      {
        key: 'critRate',
        value: affixValueRange('critRate', 20, 2).min,
        tier: 2,
      },
      { key: 'atk', value: affixValueRange('atk', 20, 2).min, tier: 2 },
    ];
    first.pendingAffixChange = {
      operation: 'reforge',
      affixIndex: 0,
      candidate: {
        key: 'hp',
        value: affixValueRange('hp', 20, 3).max,
        tier: 3,
      },
    };

    const migrated = migrate(raw);
    const pending = migrated.bag.equipment[0]!.pendingAffixChange!;
    expect(pending.affixIndex).toBe(2);
    expect(pending.candidate.key).toBe('wit_power');
    expect(pending.candidate.value).toBe(affixValueRange('wit_power', 20, 3).max);
  });

  it('v10 → v11 从最终槽位重算占用，已转换的旧职业 key 可成为迁移候选', () => {
    const raw = v10Save();
    (raw.player as { classId: string }).classId = 'swordsman';
    const first = (raw.bag as { equipment: Record<string, unknown>[] }).equipment[0]!;
    first.affixes = [
      {
        key: 'swd_guard',
        value: affixValueRange('swd_guard', 20, 4).max,
        tier: 4,
      },
      { key: 'swd_heavy', value: 7, tier: 2 },
      { key: 'atk', value: affixValueRange('atk', 20, 2).min, tier: 2 },
    ];
    first.pendingAffixChange = {
      operation: 'reforge',
      affixIndex: 0,
      candidate: {
        key: 'hp',
        value: affixValueRange('hp', 20, 3).max,
        tier: 3,
      },
    };

    const migrated = migrate(raw);
    const instance = migrated.bag.equipment[0]!;
    expect(instance.affixes.map((affix) => affix.key)).toEqual(['atk', 'critDmg', 'swd_guard']);
    expect(instance.pendingAffixChange).toEqual({
      operation: 'reforge',
      affixIndex: 2,
      candidate: {
        key: 'swd_heavy',
        value: affixValueRange('swd_heavy', 20, 3).max,
        tier: 3,
      },
    });
  });

  it('v10 → v11 先拒绝重复职业 key，不能归一化后补发职业徽记', () => {
    const raw = v10Save();
    (raw.player as { classId: string }).classId = 'swordsman';
    const bag = raw.bag as {
      equipment: Record<string, unknown>[];
      items: Record<string, number>;
    };
    bag.equipment[0]!.affixes = [
      { key: 'swd_heavy', value: 7.8, tier: 3 },
      { key: 'swd_heavy', value: 7.8, tier: 3 },
      { key: 'swd_heavy', value: 7.8, tier: 3 },
    ];
    delete bag.equipment[0]!.pendingAffixChange;
    const itemsBefore = structuredClone(bag.items);

    expect(() => migrations[10]!(raw)).toThrow(/与现有词条重复：swd_heavy/);
    expect(bag.items).toEqual(itemsBefore);
  });

  it('v10 装备定义白名单冻结发布时 235 个 ID，不反向接纳 v11 新增的 R3/R4 精良装', () => {
    expect(V10_EQUIPMENT_DEFINITION_IDS.size).toBe(235);
    for (const id of V10_EQUIPMENT_DEFINITION_IDS) {
      expect(requireEquipment(id).id).toBe(id);
    }

    for (const regionId of ['r3', 'r4'] as const) {
      for (const slot of SLOT_ORDER) {
        const raw = v10Save();
        const bag = raw.bag as { equipment: Record<string, unknown>[] };
        bag.equipment[0]!.defId = `eq_${regionId}_${slot}_fine`;
        expect(() => migrations[10]!(raw)).toThrow(/defId 不存在于发布版 v10/);
      }
    }

    const positive = v10Save();
    const bag = positive.bag as { equipment: Record<string, unknown>[] };
    bag.equipment = [
      v10Equipment('e1', 'eq_r3_weapon_rare', []),
      v10Equipment('e2', 'eq_r4_ring_epic', []),
    ];
    const migrated = migrate(positive);
    expect(migrated.bag.equipment.map((instance) => instance.defId)).toEqual([
      'eq_r3_weapon_rare',
      'eq_r4_ring_epic',
    ]);
  });

  it('v10 → v11 不会用转换过程洗掉旧词条未知字段、非有限值或非法候选值', () => {
    const unknownField = v10Save();
    const unknownAffix = (
      unknownField.bag as { equipment: { affixes: Record<string, unknown>[] }[] }
    ).equipment[0]!.affixes[2]!;
    unknownAffix.debugRoll = true;
    expect(() => migrations[10]!(unknownField)).toThrow(/debugRoll 不是 v10 允许字段/);

    const invalidAffix = v10Save();
    (
      invalidAffix.bag as { equipment: { affixes: Record<string, unknown>[] }[] }
    ).equipment[0]!.affixes[2]!.value = Number.POSITIVE_INFINITY;
    expect(() => migrations[10]!(invalidAffix)).toThrow(/affixes\.2\.value 必须是有限数字/);

    const invalidCandidate = v10Save();
    const pending = (
      invalidCandidate.bag as {
        equipment: {
          pendingAffixChange: { candidate: Record<string, unknown> };
        }[];
      }
    ).equipment[0]!.pendingAffixChange;
    pending.candidate.value = 999_999;
    expect(() => migrations[10]!(invalidCandidate)).toThrow(
      /candidate\.value 不符合 v10 等级、品阶或精度范围/,
    );
  });

  it('v10 → v11 reforge 目标从职业槽换到通用区时索引随目标，候选投影通用池', () => {
    const raw = v10Save();
    const first = (raw.bag as { equipment: Record<string, unknown>[] }).equipment[0]!;
    first.affixes = [
      v10ProfessionAffix('swd_heavy'),
      {
        key: 'critRate',
        value: affixValueRange('critRate', 20, 2).min,
        tier: 2,
      },
      { key: 'atk', value: affixValueRange('atk', 20, 2).min, tier: 2 },
    ];
    first.pendingAffixChange = {
      operation: 'reforge',
      affixIndex: 2,
      candidate: {
        key: 'swd_guard',
        value: affixValueRange('swd_guard', 20, 3).max,
        tier: 3,
      },
    };

    const migrated = migrate(raw);
    const pending = migrated.bag.equipment[0]!.pendingAffixChange!;
    expect(pending.affixIndex).toBe(0);
    expect(pending.candidate.key).toBe('def');
    expect(pending.candidate.value).toBe(affixValueRange('def', 20, 3).max);
  });

  it('v10 → v11 existing 按比例保值不夹洗，随机 pending 候选才投影到当前可生成边界', () => {
    const current = createSave('边界少女', 'witch', 35, 1_800_000_000_000);
    current.nextUid = 6;
    current.bag.equipment.push(
      v10Equipment('e1', 'eq_r2_ring_epic', [
        { key: 'swd_heavy', value: 5.5, tier: 1 },
      ]) as unknown as EquipmentInstance,
      v10Equipment('e2', 'eq_r2_ring_epic', [
        { key: 'wit_power', value: 23, tier: 1 },
      ]) as unknown as EquipmentInstance,
      v10Equipment('e3', 'eq_r2_ring_epic', [
        { key: 'sha_ward', value: 3.2, tier: 5 },
      ]) as unknown as EquipmentInstance,
      v10Equipment('e4', 'eq_r2_ring_epic', [
        { key: 'cat_swift', value: 0.062, tier: 5 },
      ]) as unknown as EquipmentInstance,
      v10Equipment('e5', 'eq_r2_ring_epic', [
        { key: 'def', value: 33, tier: 5 },
      ]) as unknown as EquipmentInstance,
    );
    current.bag.equipment[1]!.pendingAffixChange = {
      operation: 'temper',
      affixIndex: 0,
      candidate: { key: 'wit_power', value: 23, tier: 1 },
    };
    current.bag.equipment[4]!.pendingAffixChange = {
      operation: 'temper',
      affixIndex: 0,
      candidate: { key: 'def', value: 33, tier: 5 },
    };

    const migrated = migrate({
      ...(current as unknown as Record<string, unknown>),
      version: 10,
    });
    expect(migrated.bag.equipment.map((instance) => instance.affixes[0]?.value)).toEqual([
      16.3, 15.6, 3.4, 0.046, 35.1,
    ]);
    expect(migrated.bag.equipment[1]?.pendingAffixChange?.candidate.value).toBe(
      affixValueRange('wit_power', 20, 1).min,
    );
    expect(migrated.bag.equipment[4]?.pendingAffixChange?.candidate.value).toBe(
      affixValueRange('def', 20, 5).min,
    );
  });

  it('v10 → v11 将多个错槽穿戴按固定槽序无损移回背包，不覆盖已占目标槽', () => {
    const raw = v10Save();
    (raw.player as { classId: string }).classId = 'swordsman';
    raw.nextUid = 9;
    const equipped = raw.equipped as Record<string, Record<string, unknown> | null>;
    equipped.weapon = v10Equipment('e5', 'eq_r2_weapon_epic', []);
    equipped.head = v10Equipment('e8', 'eq_r2_necklace_epic', []);
    equipped.necklace = v10Equipment('e7', 'eq_r2_necklace_epic', []);
    equipped.ring = v10Equipment('e6', 'eq_r2_weapon_epic', [
      {
        key: 'swd_guard',
        value: affixValueRange('swd_guard', 20, 4).max,
        tier: 4,
      },
      { key: 'atk', value: affixValueRange('atk', 20, 2).min, tier: 2 },
      { key: 'swd_heavy', value: 7.8, tier: 3 },
    ]);

    const migrated = migrate(raw);
    expect(migrated.equipped.weapon?.uid).toBe('e5');
    expect(migrated.equipped.necklace?.uid).toBe('e7');
    expect(migrated.equipped.head).toBeNull();
    expect(migrated.equipped.ring).toBeNull();
    expect(migrated.bag.equipment.map((instance) => instance.uid)).toEqual([
      'e1',
      'e2',
      'e3',
      'e8',
      'e6',
    ]);
    expect(
      migrated.bag.equipment
        .find((instance) => instance.uid === 'e6')
        ?.affixes.map((affix) => affix.key),
    ).toEqual(['critDmg', 'atk', 'swd_guard']);
    expect(migrated.bag.items.sigil_swordsman).toBe(1);

    const allUids = [
      ...migrated.bag.equipment.map((instance) => instance.uid),
      ...Object.values(migrated.equipped).flatMap((instance) => (instance ? [instance.uid] : [])),
    ];
    expect(new Set(allUids).size).toBe(allUids.length);
  });

  it('v11 → v12 新增空试炼成绩簿，不改写任何旧资产', () => {
    const current = createSave('试炼前旧档', 'witch', 9, 1_800_000_000_000) as unknown as Record<
      string,
      unknown
    >;
    const raw = structuredClone(current);
    delete raw.trial;
    raw.version = 11;

    const migrated = migrate(raw);

    expect(migrated.version).toBe(SAVE_VERSION);
    expect(migrated.trial).toEqual({ bests: [] });
    expect(migrated.player).toEqual(current.player);
    expect(migrated.bag).toEqual(current.bag);
    expect(migrated.affection).toEqual(current.affection);
  });

  it('v13 → v14 新增空里程碑簿，且刻意不补记已越过的档位', () => {
    // 一个已经 Lv67 的老档：他确实早就跨过 Lv20/40/60，但存档里没有
    // 「何时跨过」的任何痕迹，从现状反推只能是编造 —— 所以必须留空。
    const current = createSave(
      '里程碑前旧档',
      'catkin',
      11,
      1_800_000_000_000,
    ) as unknown as Record<string, unknown>;
    (current.player as { level: number }).level = 67;
    const raw = structuredClone(current);
    delete raw.milestones;
    raw.version = 13;

    const migrated = migrate(raw);

    expect(migrated.version).toBe(SAVE_VERSION);
    expect(migrated.milestones).toEqual([]);
    // 等级已远超所有档位，仍然不许凭等级凭空补记
    expect(migrated.player.level).toBe(67);
    expect(migrated.trial).toEqual((current as { trial: unknown }).trial);
    expect(migrated.bag).toEqual((current as { bag: unknown }).bag);
  });

  it('v14 → v15 新增首通时刻表，同样不按当下补记老关卡', () => {
    // 一个推到第 90 关的老档：这 90 关确实通过了，但「哪天通的」无处可查。
    // 若按当下补记，所有老档会并列在同一时刻 —— 既不真实也毫无区分度。
    const current = createSave(
      '首通时刻前旧档',
      'swordsman',
      12,
      1_800_000_000_000,
    ) as unknown as Record<string, unknown>;
    const progress = current.progress as Record<string, unknown>;
    progress.clearedStageIds = ORDERED_STAGE_IDS.slice(0, 90);
    const raw = structuredClone(current);
    delete (raw.progress as Record<string, unknown>).stageFirstClearedAt;
    raw.version = 14;

    const migrated = migrate(raw);

    expect(migrated.version).toBe(SAVE_VERSION);
    expect(migrated.progress.stageFirstClearedAt).toEqual({});
    // 通关记录本身一个都不许丢
    expect(migrated.progress.clearedStageIds).toHaveLength(90);
    expect(migrated.milestones).toEqual([]);
  });

  it('v15 → v16 旧通关记录全部映射到 d1，且不伪造更高深度', () => {
    // 一个把苍蓝、绛紫两档都刷过的老档
    const current = createSave('深度前旧档', 'witch', 12, 1_800_000_000_000) as unknown as Record<
      string,
      unknown
    >;
    const dungeon = current.equipmentDungeon as Record<string, unknown>;
    dungeon.records = {
      equipment_weapon_azure: {
        clears: 3,
        firstClearedAt: 1_799_000_000_000,
        bestDurationMs: 18_200,
      },
      equipment_body_azure: {
        clears: 1,
        firstClearedAt: 1_799_500_000_000,
        bestDurationMs: 21_000,
      },
      equipment_ring_violet: {
        clears: 2,
        firstClearedAt: 1_799_800_000_000,
        bestDurationMs: 25_000,
      },
    };
    dungeon.totalClears = 6;
    dungeon.clearsToday = 0;
    const raw = structuredClone(current);
    delete (raw.equipmentDungeon as Record<string, unknown>).depth;
    raw.version = 15;

    const migrated = migrate(raw);

    expect(migrated.version).toBe(SAVE_VERSION);
    // 三条记录一条不丢，key 全部落到 _d1
    expect(Object.keys(migrated.equipmentDungeon.records).sort()).toEqual([
      'equipment_body_azure_d1',
      'equipment_ring_violet_d1',
      'equipment_weapon_azure_d1',
    ]);
    // 用时与首通时刻原样保留
    expect(migrated.equipmentDungeon.records.equipment_weapon_azure_d1).toEqual({
      clears: 3,
      firstClearedAt: 1_799_000_000_000,
      bestDurationMs: 18_200,
    });
    /*
     * ★ 只认「他确实通过了这一档」，深度一律是 1。
     *
     * 不按旧记录的通关次数或档位高低去推更深的层 —— 玩家的深度是打出来的，
     * 与 v15 不补记首通时刻同一条原则：没有证据就不能替玩家主张更多。
     */
    expect(migrated.equipmentDungeon.depth).toEqual({ azure: 1, violet: 1 });
    expect(migrated.equipmentDungeon.totalClears).toBe(6);
  });

  it('v16 → v17 回填当前持有的装备，背包与穿戴都不漏', () => {
    const current = createSave('图鉴前旧档', 'shaman', 7, 1_800_000_000_000) as unknown as Record<
      string,
      unknown
    >;
    const bag = current.bag as Record<string, unknown>;
    const equipped = current.equipped as Record<string, unknown>;
    const sample = (defId: string, uid: string) => ({
      uid,
      defId,
      enhance: 0,
      baseRollPermille: 1000,
      enhanceGainPermille: Array<number>(15).fill(0),
      enhanceLuck: {},
      affixes: [],
      reforgeResonance: 0,
      locked: false,
    });
    bag.equipment = [sample('eq_r1_weapon_common', 'e1'), sample('eq_r1_head_common', 'e2')];
    equipped.ring = sample('eq_r1_ring_common', 'e3');
    current.nextUid = 10; // nextUid 必须大于现有最大装备编号

    const raw = structuredClone(current);
    delete raw.equipmentCodex;
    raw.version = 16;

    const migrated = migrate(raw);

    expect(migrated.version).toBe(SAVE_VERSION);
    // 背包两件 + 身上一件，一件都不能漏
    expect([...migrated.equipmentCodex.discoveredDefIds].sort()).toEqual([
      'eq_r1_head_common',
      'eq_r1_ring_common',
      'eq_r1_weapon_common',
    ]);
  });

  it('v16 → v17 同一定义在背包与身上各一件时只记一次', () => {
    const current = createSave('去重档', 'catkin', 9, 1_800_000_000_000) as unknown as Record<
      string,
      unknown
    >;
    const sample = (uid: string) => ({
      uid,
      defId: 'eq_r1_weapon_common',
      enhance: 0,
      baseRollPermille: 1000,
      enhanceGainPermille: Array<number>(15).fill(0),
      enhanceLuck: {},
      affixes: [],
      reforgeResonance: 0,
      locked: false,
    });
    (current.bag as Record<string, unknown>).equipment = [sample('e1')];
    (current.equipped as Record<string, unknown>).weapon = sample('e2');
    current.nextUid = 10;

    const raw = structuredClone(current);
    delete raw.equipmentCodex;
    raw.version = 16;

    expect(migrate(raw).equipmentCodex.discoveredDefIds).toEqual(['eq_r1_weapon_common']);
  });

  it('v16 → v17 空背包空穿戴迁出空账本，不炸也不塞占位', () => {
    const raw = structuredClone(
      createSave('新号', 'swordsman', 1, 1_800_000_000_000) as unknown as Record<string, unknown>,
    );
    delete raw.equipmentCodex;
    raw.version = 16;

    expect(migrate(raw).equipmentCodex.discoveredDefIds).toEqual([]);
  });

  it('v17 → v18 新增空装备预设，不改写旧档资产和进度', () => {
    const current = createSave('预设前旧档', 'catkin', 18, 1_800_000_000_000) as unknown as Record<
      string,
      unknown
    >;
    (current.player as { gold: number }).gold = 98_765;
    const raw = structuredClone(current);
    delete raw.equipmentPresets;
    raw.version = 17;

    const migrated = migrate(raw);

    expect(migrated.version).toBe(SAVE_VERSION);
    expect(migrated.equipmentPresets).toEqual({ presets: [], autoSwitch: false });
    expect(migrated.player).toEqual(current.player);
    expect(migrated.bag).toEqual(current.bag);
    expect(migrated.progress).toEqual(current.progress);
    expect(migrated.equipmentCodex).toEqual(current.equipmentCodex);
  });

  it('v18 → v19 新增樱酱空好感进度，不改写四名旧角色与玩家资产', () => {
    const current = createSave('樱酱上线前旧档', 'catkin', 19, 1_800_000_000_000);
    current.player.gold = 54_321;
    current.affection.characters.catkin.points = 777;
    const raw = structuredClone(current) as unknown as Record<string, unknown>;
    delete (raw.affection as { characters: Record<string, unknown> }).characters.kenshi;
    raw.version = 18;

    const migrated = migrate(raw);

    expect(migrated.version).toBe(SAVE_VERSION);
    expect(migrated.player).toEqual(current.player);
    expect(migrated.bag).toEqual(current.bag);
    expect(migrated.progress).toEqual(current.progress);
    expect(migrated.affection.characters.catkin).toEqual(current.affection.characters.catkin);
    expect(migrated.affection.characters.kenshi).toEqual(current.affection.characters.kenshi);
  });

  it('v19 → v20 把历史试炼纪录标为公式 v1，不改伤害与提交事实', () => {
    const current = createSave('试炼换尺前旧档', 'kenshi', 20, 1_800_000_000_000);
    const historical = {
      seasonId: 's1',
      weekIndex: 30,
      bracketId: 'feiying',
      classId: 'kenshi',
      damage: 1_489_904,
      at: 1_799_000_000_000,
      submitted: true,
    };
    const raw = structuredClone(current) as unknown as Record<string, unknown>;
    raw.version = 19;
    (raw.trial as { bests: unknown[] }).bests = [historical];

    const migrated = migrate(raw);

    expect(migrated.version).toBe(SAVE_VERSION);
    expect(migrated.trial.bests).toEqual([{ ...historical, formulaVersion: 1 }]);
  });

  it('v19 → v20 缺失试炼成绩簿时明确拒绝，不伪造空历史', () => {
    const raw = structuredClone(
      createSave('损坏的试炼旧档', 'swordsman', 21, 1_800_000_000_000),
    ) as unknown as Record<string, unknown>;
    raw.version = 19;
    delete (raw.trial as { bests?: unknown }).bests;

    expect(() => migrate(raw)).toThrow('trial.bests 缺失或格式错误');
  });

  it('当前版本可创建并严格校验 kenshi 职业档', () => {
    const save = createSave('樱酱新号', 'kenshi', 19, 1_800_000_000_000);
    expect(migrate(save as unknown as Record<string, unknown>)).toEqual(save);
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
