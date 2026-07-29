import 'fake-indexeddb/auto';
import { openDB } from 'idb';
import { reactive } from 'vue';
import { afterEach, describe, expect, it } from 'vitest';
import { createSave } from '../schema';
import {
  createSaveStorageClient,
  InvalidSaveError,
  clearSave,
  exportToJson,
  importFromJson,
  loadBackup,
  loadSave,
  SaveConflictError,
  SaveLoadError,
  saveSave,
} from '../storage';

async function synchronizeAndClear(): Promise<void> {
  // CAS 清档必须先同步到测试结束时的最新 revision；部分用例会让独立客户端
  // 成为最后写入者，默认客户端此时按设计已经过期。
  try {
    await loadSave();
  } catch {
    // 主槽损坏用例仍会在读取阶段记住 revision，随后可以安全清除。
  }
  await clearSave();
}

afterEach(async () => {
  await synchronizeAndClear();
});

describe('IndexedDB storage', () => {
  it('保存并读取完整存档', async () => {
    const save = createSave('小樱', 'swordsman', 2026, 1_800_000_000_000);
    save.player.gold = 1234;

    await saveSave(save);
    expect(await loadSave()).toEqual(save);
  });

  it('Vue 响应式 Proxy 也会转成普通快照后写入', async () => {
    const save = reactive(createSave('魔女', 'witch', 9, 1_800_000_000_000));
    await saveSave(save);

    const loaded = await loadSave();
    expect(loaded?.player.name).toBe('魔女');
    expect(loaded).not.toBe(save);
  });

  it('新主档写入前会保留上一版备份', async () => {
    const first = createSave('第一版', 'swordsman', 1, 1_800_000_000_000);
    const second = createSave('第二版', 'swordsman', 1, 1_800_000_000_001);

    await saveSave(first);
    await saveSave(second);

    expect((await loadSave())?.player.name).toBe('第二版');
    expect((await loadBackup())?.player.name).toBe('第一版');
  });

  it('并发保存按调用顺序落盘，不会被旧请求覆盖', async () => {
    const saves = Array.from({ length: 6 }, (_, index) => {
      const save = createSave(`第${index}版`, 'shaman', index + 1, 1_800_000_000_000 + index);
      save.player.gold = index;
      return save;
    });

    await Promise.all(saves.map((save) => saveSave(save)));
    expect((await loadSave())?.player.gold).toBe(5);
    expect((await loadBackup())?.player.gold).toBe(4);
  });

  it('两个客户端同时读取后，旧 revision 不能覆盖另一客户端的新主档', async () => {
    const initial = createSave('双标签少女', 'witch', 31, 1_800_000_000_000);
    initial.player.gold = 100;
    await saveSave(initial);

    const clientA = createSaveStorageClient();
    const clientB = createSaveStorageClient();
    const snapshotA = await clientA.loadSave();
    const snapshotB = await clientB.loadSave();
    expect(snapshotA).not.toBeNull();
    expect(snapshotB).not.toBeNull();

    snapshotA!.player.gold = 120;
    snapshotB!.player.gold = 80;
    await clientA.saveSave(snapshotA!);

    await expect(clientB.saveSave(snapshotB!)).rejects.toMatchObject({
      name: 'SaveConflictError',
      expectedRevision: expect.any(Number),
      actualRevision: expect.any(Number),
    });
    expect((await loadSave())?.player.gold).toBe(120);
    expect((await loadBackup())?.player.gold).toBe(100);
  });

  it('旧客户端不能用清档绕过 CAS 删除另一标签刚写入的新主档', async () => {
    const initial = createSave('清档竞争', 'swordsman', 32, 1_800_000_000_000);
    initial.player.gold = 100;
    await saveSave(initial);

    const currentClient = createSaveStorageClient();
    const staleClient = createSaveStorageClient();
    const currentSnapshot = await currentClient.loadSave();
    await staleClient.loadSave();
    if (!currentSnapshot) throw new Error('清档 CAS 测试缺少初始存档');

    currentSnapshot.player.gold = 999;
    await currentClient.saveSave(currentSnapshot);

    await expect(staleClient.clearSave()).rejects.toBeInstanceOf(SaveConflictError);
    expect((await loadSave())?.player.gold).toBe(999);
  });

  it('跨客户端清档会递增 revision 墓碑，旧自动保存不能复活角色', async () => {
    const initial = createSave('即将重开', 'shaman', 37, 1_800_000_000_000);
    await saveSave(initial);

    const clearingClient = createSaveStorageClient();
    const staleClient = createSaveStorageClient();
    await clearingClient.loadSave();
    const staleSnapshot = await staleClient.loadSave();
    expect(staleSnapshot).not.toBeNull();

    await clearingClient.clearSave();
    await expect(staleClient.saveSave(staleSnapshot!)).rejects.toBeInstanceOf(SaveConflictError);
    expect(await loadSave()).toBeNull();
    expect(await loadBackup()).toBeNull();
  });

  it('同 realm 的保存与清档按调用顺序排队，不会在清档后复活', async () => {
    const save = createSave('排队清档', 'catkin', 41, 1_800_000_000_000);
    const saving = saveSave(save);
    const clearing = clearSave();

    await Promise.all([saving, clearing]);
    expect(await loadSave()).toBeNull();
    expect(await loadBackup()).toBeNull();
  });

  it('主档损坏时读取上一版有效备份', async () => {
    const first = createSave('可恢复备份', 'swordsman', 1, 1_800_000_000_000);
    const second = createSave('损坏前主档', 'witch', 2, 1_800_000_000_001);
    await saveSave(first);
    await saveSave(second);

    const db = await openDB('sakura-legend', 1);
    await db.put('saves', { version: 2, player: {} }, 'main');

    expect((await loadSave())?.player.name).toBe('可恢复备份');
  });

  it('主档损坏且没有备份时明确报错，不伪装成新玩家', async () => {
    const db = await openDB('sakura-legend', 1);
    await db.put('saves', { version: 2, player: {} }, 'main');

    await expect(loadSave()).rejects.toBeInstanceOf(SaveLoadError);
  });
});

describe('JSON import/export', () => {
  it('导出再导入不丢数据', () => {
    const save = createSave('备份少女', 'shaman', 77, 1_800_000_000_000);
    save.bag.items.stone_enhance = 88;

    expect(importFromJson(exportToJson(save))).toEqual(save);
  });

  it('非法 JSON 和残缺结构会给出明确错误', () => {
    expect(() => importFromJson('{broken')).toThrow(InvalidSaveError);
    expect(() => importFromJson(JSON.stringify({ version: 1, player: {} }))).toThrow(
      InvalidSaveError,
    );
  });
});
