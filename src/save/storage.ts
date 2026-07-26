/**
 * 存档持久化：IndexedDB 读写 + JSON 导入导出。
 *
 * 为什么用 IndexedDB 而不是 localStorage：
 *   - localStorage 只有 5MB 且是同步阻塞的，写入时会卡住渲染
 *   - 装备实例会越来越多，容量必须够
 *
 * 另外每次保存都会留一份「上一版」备份（slot: backup），
 * 万一主存档写坏了还能捞回来。
 */

import { openDB, type IDBPDatabase } from 'idb';
import { SAVE_KEY, parseSave, type SaveData } from './schema';
import { migrate, SaveTooNewError } from './migrations';

const DB_NAME = 'sakura-legend';
const DB_VERSION = 1;
const STORE = 'saves';

let dbPromise: Promise<IDBPDatabase> | null = null;
let writeQueue: Promise<void> = Promise.resolve();

function getDb(): Promise<IDBPDatabase> {
  if (!dbPromise) {
    dbPromise = openDB(DB_NAME, DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains(STORE)) {
          db.createObjectStore(STORE);
        }
      },
    });
  }
  return dbPromise;
}

/** 读取主存档。没有存档返回 null。 */
export async function loadSave(): Promise<SaveData | null> {
  const db = await getDb();
  const raw = await db.get(STORE, SAVE_KEY);
  if (!raw) return null;

  try {
    return migrate(raw as Record<string, unknown>);
  } catch (mainError) {
    const backupRaw = await db.get(STORE, `${SAVE_KEY}_backup`);
    if (!backupRaw) throw new SaveLoadError(mainError);
    try {
      const recovered = migrate(backupRaw as Record<string, unknown>);
      // 备份已通过完整校验，立即修复主槽；不能等自动保存再把坏主档覆盖到备份槽。
      await db.put(STORE, recovered, SAVE_KEY);
      return recovered;
    } catch (backupError) {
      throw new SaveLoadError(mainError, backupError);
    }
  }
}

/** 读取备份存档 */
export async function loadBackup(): Promise<SaveData | null> {
  const db = await getDb();
  const raw = await db.get(STORE, `${SAVE_KEY}_backup`);
  if (!raw) return null;
  return migrate(raw as Record<string, unknown>);
}

export class SaveLoadError extends Error {
  constructor(
    readonly mainError: unknown,
    readonly backupError?: unknown,
  ) {
    const main = mainError instanceof Error ? mainError.message : '未知主存档错误';
    const backup = backupError instanceof Error ? `；备份也失败：${backupError.message}` : '';
    super(`主存档读取失败：${main}${backup}`);
    this.name = 'SaveLoadError';
  }
}

/** 写入主存档，并把旧的主存档挪去备份 */
export async function saveSave(data: SaveData): Promise<void> {
  // Zod 在校验时会构造普通对象，因此即使传入的是 Vue 响应式 Proxy，
  // 写入 IndexedDB 的也一定是可结构化克隆的快照。
  const snapshot = parseSave(data);
  const operation = writeQueue.then(async () => {
    const db = await getDb();
    const tx = db.transaction(STORE, 'readwrite');
    const prev = await tx.store.get(SAVE_KEY);
    if (prev) await tx.store.put(prev, `${SAVE_KEY}_backup`);
    await tx.store.put(snapshot, SAVE_KEY);
    await tx.done;
  });

  // 单次失败要原样返回给调用方，但不能让队列永久卡在 rejected 状态。
  writeQueue = operation.catch(() => undefined);
  return operation;
}

/** 删除全部存档（重开新号） */
export async function clearSave(): Promise<void> {
  const db = await getDb();
  const tx = db.transaction(STORE, 'readwrite');
  await tx.store.delete(SAVE_KEY);
  await tx.store.delete(`${SAVE_KEY}_backup`);
  await tx.done;
}

// ─────────────────────── 导入 / 导出 ───────────────────────

/**
 * 导出为 JSON 文本。
 *
 * 单机存档必须提供导出，否则玩家清浏览器数据就全没了。
 * UI 里要明确提醒玩家定期备份。
 */
export function exportToJson(data: SaveData): string {
  return JSON.stringify(data, null, 2);
}

/** 触发浏览器下载 */
export function downloadSave(data: SaveData): void {
  const blob = new Blob([exportToJson(data)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  const stamp = new Date().toISOString().slice(0, 16).replace(/[:T]/g, '-');
  a.href = url;
  a.download = `樱刃传说-存档-${stamp}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

export class InvalidSaveError extends Error {
  constructor(msg: string) {
    super(msg);
    this.name = 'InvalidSaveError';
  }
}

/**
 * 从 JSON 文本导入。
 * 会跑一遍迁移与校验，坏档直接抛错而不是写进去把游戏搞坏。
 */
export function importFromJson(text: string): SaveData {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new InvalidSaveError('文件不是合法的 JSON，可能选错了文件。');
  }

  if (typeof parsed !== 'object' || parsed === null) {
    throw new InvalidSaveError('存档内容为空或格式不对。');
  }

  try {
    return migrate(parsed as Record<string, unknown>);
  } catch (error) {
    if (error instanceof SaveTooNewError) throw error;
    const message = error instanceof Error ? error.message : '未知结构错误';
    throw new InvalidSaveError(`存档结构校验失败：${message}`);
  }
}
