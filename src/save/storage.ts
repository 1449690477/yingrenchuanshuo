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
const REVISION_KEY = `${SAVE_KEY}_revision`;

let dbPromise: Promise<IDBPDatabase> | null = null;

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

interface StoredSlots {
  main: unknown;
  backup: unknown;
  revision: number;
}

function parseRevision(value: unknown): number {
  if (value === undefined) return 0;
  if (Number.isSafeInteger(value) && (value as number) >= 0) return value as number;
  throw new Error('IndexedDB 存档 revision 元数据损坏');
}

function nextRevision(revision: number): number {
  if (revision >= Number.MAX_SAFE_INTEGER) {
    throw new Error('IndexedDB 存档 revision 已耗尽');
  }
  return revision + 1;
}

async function readStoredSlots(): Promise<StoredSlots> {
  const db = await getDb();
  const tx = db.transaction(STORE, 'readonly');
  const [main, backup, rawRevision] = await Promise.all([
    tx.store.get(SAVE_KEY),
    tx.store.get(`${SAVE_KEY}_backup`),
    tx.store.get(REVISION_KEY),
  ]);
  await tx.done;
  return { main, backup, revision: parseRevision(rawRevision) };
}

/**
 * 跨标签页 CAS 冲突。
 *
 * 每个标签页只能基于自己最后一次 load/save 成功后见到的 revision 继续写；
 * 另一个标签页先落盘后，旧标签必须先重新加载，不能用合法但过期的整份快照
 * last-write-wins 覆盖新资产。
 */
export class SaveConflictError extends Error {
  constructor(
    readonly expectedRevision: number,
    readonly actualRevision: number,
  ) {
    super(
      `存档已被另一个页面更新（当前 revision ${actualRevision}，本页仍是 ${expectedRevision}），请重新加载后再操作。`,
    );
    this.name = 'SaveConflictError';
  }
}

async function commitMainSnapshot(
  snapshot: SaveData,
  expectedRevision: number,
  preservePreviousMain: boolean,
): Promise<number> {
  try {
    const db = await getDb();
    const tx = db.transaction(STORE, 'readwrite');
    const actualRevision = parseRevision(await tx.store.get(REVISION_KEY));
    if (actualRevision !== expectedRevision) {
      await tx.done;
      throw new SaveConflictError(expectedRevision, actualRevision);
    }

    const revision = nextRevision(actualRevision);
    if (preservePreviousMain) {
      const previous = await tx.store.get(SAVE_KEY);
      if (previous) await tx.store.put(previous, `${SAVE_KEY}_backup`);
    }
    await tx.store.put(snapshot, SAVE_KEY);
    await tx.store.put(revision, REVISION_KEY);
    await tx.done;
    return revision;
  } catch (error) {
    if (error instanceof SaveConflictError) throw error;
    throw new SaveWriteError(error);
  }
}

async function clearStoredSlots(expectedRevision: number): Promise<number> {
  try {
    const db = await getDb();
    const tx = db.transaction(STORE, 'readwrite');
    const actualRevision = parseRevision(await tx.store.get(REVISION_KEY));
    if (actualRevision !== expectedRevision) {
      await tx.done;
      throw new SaveConflictError(expectedRevision, actualRevision);
    }

    const revision = nextRevision(actualRevision);
    await tx.store.delete(SAVE_KEY);
    await tx.store.delete(`${SAVE_KEY}_backup`);
    // revision 是清档墓碑，故意不删除。旧标签页仍持有清档前的 revision，
    // 后续自动保存会发生 CAS 冲突，而不是把已经删除的角色重新写回来。
    await tx.store.put(revision, REVISION_KEY);
    await tx.done;
    return revision;
  } catch (error) {
    if (error instanceof SaveConflictError) throw error;
    throw new SaveWriteError(error);
  }
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

/**
 * IndexedDB 写事务失败。
 *
 * 存档结构校验发生在写事务之前，必须继续抛出原始校验错误，不能把代码或
 * 配置缺陷伪装成浏览器存储故障；只有真正进入 IndexedDB 后的失败才包装成
 * 这个错误，供需要“写盘成功才提交”的付费事务精确识别并回滚。
 */
export class SaveWriteError extends Error {
  constructor(readonly writeError: unknown) {
    const detail = writeError instanceof Error ? writeError.message : '未知 IndexedDB 写入错误';
    super(`IndexedDB 写入失败：${detail}`, { cause: writeError });
    this.name = 'SaveWriteError';
  }
}

export interface SaveStorageClient {
  /** 读取主存档并记住本客户端的 CAS revision。没有存档返回 null。 */
  loadSave(): Promise<SaveData | null>;
  /** 读取备份存档；不会改变主槽的 CAS revision。 */
  loadBackup(): Promise<SaveData | null>;
  /** 基于本客户端最后读取/写入的 revision 保存。 */
  saveSave(data: SaveData): Promise<void>;
  /** 与本客户端写队列严格排序地清除主槽和备份槽。 */
  clearSave(): Promise<void>;
}

/**
 * 创建一个独立的存储客户端。
 *
 * 浏览器每个 JS realm 会各自创建默认客户端；测试也可用两个客户端精确复现
 * 两个标签页同时读取同一 revision 后竞争写入的边界。
 */
export function createSaveStorageClient(): SaveStorageClient {
  let knownRevision: number | null = null;
  let writeQueue: Promise<void> = Promise.resolve();

  function enqueueWrite(operation: () => Promise<void>): Promise<void> {
    const queued = writeQueue.then(operation);
    // 单次失败要原样返回给调用方，但不能让队列永久卡在 rejected 状态。
    writeQueue = queued.catch(() => undefined);
    return queued;
  }

  async function loadClientSave(): Promise<SaveData | null> {
    let slots: StoredSlots;
    try {
      slots = await readStoredSlots();
    } catch (error) {
      throw new SaveLoadError(error);
    }
    knownRevision = slots.revision;
    if (!slots.main) return null;

    try {
      return migrate(slots.main as Record<string, unknown>);
    } catch (mainError) {
      if (!slots.backup) throw new SaveLoadError(mainError);
      try {
        const recovered = migrate(slots.backup as Record<string, unknown>);
        // 备份已通过完整校验，仍须 CAS 修复主槽。若另一标签页已经先写入，
        // 这里会明确冲突，不能拿较旧备份覆盖它的新主档。
        await enqueueWrite(async () => {
          knownRevision = await commitMainSnapshot(recovered, slots.revision, false);
        });
        return recovered;
      } catch (backupError) {
        if (backupError instanceof SaveConflictError) throw backupError;
        throw new SaveLoadError(mainError, backupError);
      }
    }
  }

  async function loadClientBackup(): Promise<SaveData | null> {
    const db = await getDb();
    const raw = await db.get(STORE, `${SAVE_KEY}_backup`);
    if (!raw) return null;
    return migrate(raw as Record<string, unknown>);
  }

  async function saveClientSave(data: SaveData): Promise<void> {
    // Zod 在校验时会构造普通对象，因此即使传入的是 Vue 响应式 Proxy，
    // 写入 IndexedDB 的也一定是可结构化克隆的快照。
    const snapshot = parseSave(data);
    await enqueueWrite(async () => {
      // 未 load 的客户端只允许接管从未写过的 revision 0。正常游戏启动必先
      // load；若已有档却绕过 load 直接写，CAS 会拒绝而不是盲覆盖。
      const expectedRevision = knownRevision ?? 0;
      knownRevision = await commitMainSnapshot(snapshot, expectedRevision, true);
    });
  }

  function clearClientSave(): Promise<void> {
    return enqueueWrite(async () => {
      // 清档也是一次整槽写入，必须与普通保存使用同一 CAS 规则。
      // 否则旧标签页虽然不能拿旧快照覆盖新档，却仍能直接删除新档。
      const expectedRevision = knownRevision ?? 0;
      knownRevision = await clearStoredSlots(expectedRevision);
    });
  }

  return {
    loadSave: loadClientSave,
    loadBackup: loadClientBackup,
    saveSave: saveClientSave,
    clearSave: clearClientSave,
  };
}

const defaultStorageClient = createSaveStorageClient();

/** 读取主存档。没有存档返回 null。 */
export function loadSave(): Promise<SaveData | null> {
  return defaultStorageClient.loadSave();
}

/** 读取备份存档 */
export function loadBackup(): Promise<SaveData | null> {
  return defaultStorageClient.loadBackup();
}

/** 写入主存档，并把旧的主存档挪去备份 */
export function saveSave(data: SaveData): Promise<void> {
  return defaultStorageClient.saveSave(data);
}

/** 删除全部存档（重开新号），且与本 realm 的待写任务严格按调用顺序执行。 */
export function clearSave(): Promise<void> {
  return defaultStorageClient.clearSave();
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
