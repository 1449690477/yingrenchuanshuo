import { describe, expect, it } from 'vitest';
import { createSave, SAVE_VERSION, SaveValidationError } from '../schema';
import { migrate, SaveTooNewError } from '../migrations';

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

    expect(migrated.version).toBe(3);
    expect(migrated.shop.purchasedOfferIds).toEqual([]);
    expect(migrated.player.gold).toBe(7_654_321);
    expect(migrated.player.name).toBe('v2 少女');
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
