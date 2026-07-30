import 'fake-indexeddb/auto';
import { openDB } from 'idb';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { EquipmentInstance } from '@/core/types';
import {
  SaveIntegrityViolationError,
  verifySaveEnvelope,
  verifySaveEnvelopeChain,
  type SaveEnvelope,
} from '@/core/saveIntegrity';
import { createSave, SAVE_VERSION, type SaveData } from '../schema';
import {
  createSaveStorageClient,
  exportRawSaveDiagnostics,
  exportToJson,
  importFromJson,
  InvalidSaveError,
} from '../storage';

const DB_NAME = 'sakura-legend';
const STORE = 'saves';

async function rawSlot(key: string): Promise<unknown> {
  const db = await openDB(DB_NAME, 1);
  return db.get(STORE, key);
}

beforeEach(async () => {
  await createSaveStorageClient().forceClearCorruptedSave();
});

afterEach(async () => {
  await createSaveStorageClient().forceClearCorruptedSave();
});

describe('IndexedDB 完整性信封', () => {
  it('旧 v12 裸快照无损读取，首次保存升级主档与备份信封且不改 SAVE_VERSION', async () => {
    expect(SAVE_VERSION).toBe(12);
    const legacy = createSave('旧档少女', 'swordsman', 12, 1_800_000_000_000);
    legacy.player.gold = 321;
    const db = await openDB(DB_NAME, 1);
    await db.put(STORE, legacy, 'main');
    await db.put(STORE, 0, 'main_revision');

    const client = createSaveStorageClient({ now: () => 1_800_000_000_100 });
    const loaded = await client.loadSave();
    expect(loaded).toEqual(legacy);
    expect(client.getIntegrityStatus()).toMatchObject({ state: 'legacy', revision: 0 });

    await client.saveSave(loaded!);
    const main = await verifySaveEnvelope<SaveData>(await rawSlot('main'));
    const backup = await verifySaveEnvelope<SaveData>(await rawSlot('main_backup'));
    expect(main.payload).toEqual(legacy);
    expect(backup.payload).toEqual(legacy);
    expect(main.source).toBe('legacy');
    expect(backup.source).toBe('legacy');
    expect(() => verifySaveEnvelopeChain(main, backup)).not.toThrow();
    expect(main.payload.version).toBe(12);
  });

  it('连续保存 revision 单调增加，主档明确引用上一版备份', async () => {
    let clock = 1_800_000_000_000;
    const client = createSaveStorageClient({ now: () => ++clock });
    expect(await client.loadSave()).toBeNull();
    const first = createSave('链式少女', 'witch', 20, clock);
    const second = structuredClone(first);
    second.player.gold = 88;

    await client.saveSave(first);
    await client.saveSave(second);

    const main = await verifySaveEnvelope<SaveData>(await rawSlot('main'));
    const backup = await verifySaveEnvelope<SaveData>(await rawSlot('main_backup'));
    expect(main.revision).toBe(backup.revision + 1);
    expect(main.parentDigest).toBe(backup.digest);
    expect(() => verifySaveEnvelopeChain(main, backup)).not.toThrow();
  });

  it('直接改 payload 会阻止读取和后续写入，显式恢复前保留原始证据', async () => {
    const writer = createSaveStorageClient({ now: () => 1_800_000_000_000 });
    await writer.loadSave();
    const first = createSave('备份证据', 'shaman', 21, 1_800_000_000_000);
    const second = structuredClone(first);
    second.player.gold = 50;
    await writer.saveSave(first);
    await writer.saveSave(second);

    const db = await openDB(DB_NAME, 1);
    const tampered = (await db.get(STORE, 'main')) as SaveEnvelope<SaveData>;
    tampered.payload.player.gold = 9_999_999;
    await db.put(STORE, tampered, 'main');

    const reader = createSaveStorageClient();
    await expect(reader.loadSave()).rejects.toMatchObject({
      name: 'SaveLoadError',
      reason: 'digest-mismatch',
      backupAvailable: true,
    });
    await expect(reader.saveSave(second)).rejects.toMatchObject({
      name: 'SaveIntegrityViolationError',
      reason: 'digest-mismatch',
    });
    expect(await exportRawSaveDiagnostics()).toContain('9999999');

    const recovered = await reader.recoverBackup();
    expect(recovered.player.gold).toBe(first.player.gold);
    expect(await db.get(STORE, 'main_quarantine')).toMatchObject({ main: tampered });
    expect((await reader.loadSave())?.player.gold).toBe(first.player.gold);
  });

  it('导入档建立 imported 来源链，后续普通保存不会伪装成本机可信档', async () => {
    const original = createSave('导入少女', 'catkin', 22, 1_800_000_000_000);
    const imported = importFromJson(exportToJson(original));
    const client = createSaveStorageClient({ now: () => 1_800_000_000_100 });
    await client.loadSave();
    await client.saveSave(imported, { source: 'imported' });
    expect(client.getIntegrityStatus()).toMatchObject({ state: 'imported', source: 'imported' });

    imported.player.gold += 1;
    await client.saveSave(imported);
    const main = await verifySaveEnvelope<SaveData>(await rawSlot('main'));
    expect(main.source).toBe('imported');
    expect(() =>
      importFromJson(JSON.stringify({ ...original, serverProof: 'forged-proof' })),
    ).toThrow(InvalidSaveError);
  });

  it('主备份都异常时普通清档也被阻止，只能显式导出诊断后确认清除', async () => {
    const client = createSaveStorageClient();
    await client.loadSave();
    await client.saveSave(createSave('双坏档', 'swordsman', 23, 1_800_000_000_000));
    const db = await openDB(DB_NAME, 1);
    await db.put(STORE, { broken: 'main', impossibleInJson: 1n }, 'main');
    await db.put(STORE, { broken: 'backup' }, 'main_backup');

    const reader = createSaveStorageClient();
    await expect(reader.loadSave()).rejects.toMatchObject({ backupAvailable: false });
    await expect(reader.clearSave()).rejects.toBeInstanceOf(SaveIntegrityViolationError);
    const diagnostics = JSON.parse(await exportRawSaveDiagnostics()) as Record<string, unknown>;
    expect(diagnostics).toMatchObject({
      main: {
        broken: 'main',
        impossibleInJson: { __unsupportedType: 'bigint', value: '1' },
      },
      backup: { broken: 'backup' },
    });

    await reader.forceClearCorruptedSave();
    expect(await reader.loadSave()).toBeNull();
  });

  it('信封 revision 与 IndexedDB 元数据不同会单独报告 revision-mismatch', async () => {
    const client = createSaveStorageClient();
    await client.loadSave();
    await client.saveSave(createSave('修订少女', 'witch', 24, 1_800_000_000_000));
    const db = await openDB(DB_NAME, 1);
    await db.put(STORE, 99, 'main_revision');

    await expect(createSaveStorageClient().loadSave()).rejects.toMatchObject({
      reason: 'revision-mismatch',
    });
  });

  it('300 件装备的稳定序列化与 SHA-256 不阻塞长期保存队列', async () => {
    const save = createSave('满背包少女', 'swordsman', 25, 1_800_000_000_000);
    save.bag.equipment = Array.from({ length: 300 }, (_, index) => equipment(index));
    const startedAt = performance.now();
    const client = createSaveStorageClient({ now: () => 1_800_000_000_001 });
    await client.loadSave();
    await client.saveSave(save);
    const elapsed = performance.now() - startedAt;

    expect((await client.loadSave())?.bag.equipment).toHaveLength(300);
    expect(elapsed).toBeLessThan(250);
  });
});

function equipment(index: number): EquipmentInstance {
  return {
    uid: `integrity-${index}`,
    defId: 'eq_r1_ring_common',
    enhance: 0,
    baseRollPermille: 1_000,
    enhanceGainPermille: Array<number>(15).fill(0),
    enhanceLuck: {},
    affixes: [],
    reforgeResonance: 0,
    locked: false,
  };
}
