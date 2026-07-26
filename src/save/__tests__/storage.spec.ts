import 'fake-indexeddb/auto';
import { openDB } from 'idb';
import { reactive } from 'vue';
import { afterEach, describe, expect, it } from 'vitest';
import { createSave } from '../schema';
import {
  InvalidSaveError,
  clearSave,
  exportToJson,
  importFromJson,
  loadBackup,
  loadSave,
  SaveLoadError,
  saveSave,
} from '../storage';

afterEach(async () => {
  await clearSave();
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
