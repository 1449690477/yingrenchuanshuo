/**
 * IndexedDB 存档：主/备份槽、跨标签 CAS 与公开 SHA-256 完整性信封。
 *
 * 摘要用于发现损坏和普通直接编辑，不是服务端防作弊。任何前端摘要都可被
 * 掌握开发者工具的人重算；会影响他人的装备与货币仍必须由服务端账本裁定。
 */

import { openDB, type IDBPDatabase } from 'idb';
import {
  createSaveEnvelope,
  looksLikeSaveEnvelope,
  SaveIntegrityViolationError,
  stableSerialize,
  verifySaveEnvelope,
  verifySaveEnvelopeChain,
  type SaveEnvelope,
  type SaveEnvelopeSource,
  type SaveIntegrityReason,
} from '@/core/saveIntegrity';
import { SAVE_KEY, parseSave, type SaveData } from './schema';
import { migrate, SaveTooNewError } from './migrations';

const DB_NAME = 'sakura-legend';
const DB_VERSION = 1;
const STORE = 'saves';
const BACKUP_KEY = `${SAVE_KEY}_backup`;
const REVISION_KEY = `${SAVE_KEY}_revision`;
const QUARANTINE_KEY = `${SAVE_KEY}_quarantine`;

let dbPromise: Promise<IDBPDatabase> | null = null;

function getDb(): Promise<IDBPDatabase> {
  if (!dbPromise) {
    dbPromise = openDB(DB_NAME, DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE);
      },
    });
  }
  return dbPromise;
}

interface RawStoredSlots {
  main: unknown;
  backup: unknown;
  rawRevision: unknown;
}

interface DecodedSlot {
  payload: SaveData;
  envelope: SaveEnvelope<SaveData> | null;
  source: SaveEnvelopeSource;
}

export interface SaveIntegrityStatus {
  state: 'empty' | 'legacy' | 'verified' | 'imported' | 'error';
  revision: number | null;
  source: SaveEnvelopeSource | null;
  backupAvailable: boolean;
  reason?: SaveIntegrityReason | 'schema-invalid';
  message?: string;
}

const EMPTY_INTEGRITY_STATUS: SaveIntegrityStatus = {
  state: 'empty',
  revision: 0,
  source: null,
  backupAvailable: false,
};

function parseRevision(value: unknown): number {
  if (value === undefined) return 0;
  if (Number.isSafeInteger(value) && (value as number) >= 0) return value as number;
  throw new SaveIntegrityViolationError('revision-mismatch', 'IndexedDB 存档 revision 元数据损坏');
}

function nextRevision(revision: number): number {
  if (revision >= Number.MAX_SAFE_INTEGER) throw new Error('IndexedDB 存档 revision 已耗尽');
  return revision + 1;
}

async function readRawStoredSlots(): Promise<RawStoredSlots> {
  const db = await getDb();
  const tx = db.transaction(STORE, 'readonly');
  const [main, backup, rawRevision] = await Promise.all([
    tx.store.get(SAVE_KEY),
    tx.store.get(BACKUP_KEY),
    tx.store.get(REVISION_KEY),
  ]);
  await tx.done;
  return { main, backup, rawRevision };
}

async function decodeSlot(raw: unknown): Promise<DecodedSlot> {
  if (looksLikeSaveEnvelope(raw)) {
    const envelope = await verifySaveEnvelope(raw);
    return {
      payload: migrate(envelope.payload as Record<string, unknown>),
      envelope: envelope as SaveEnvelope<SaveData>,
      source: envelope.source,
    };
  }
  return {
    payload: migrate(raw as Record<string, unknown>),
    envelope: null,
    source: 'legacy',
  };
}

async function canRecoverBackup(
  raw: unknown,
): Promise<{ decoded: DecodedSlot | null; error?: unknown }> {
  if (!raw) return { decoded: null };
  try {
    return { decoded: await decodeSlot(raw) };
  } catch (error) {
    return { decoded: null, error };
  }
}

function diagnosticJson(value: unknown, space?: number): string {
  const seen = new WeakSet<object>();
  return JSON.stringify(
    value,
    (_key, item: unknown) => {
      if (typeof item === 'bigint') return { __unsupportedType: 'bigint', value: item.toString() };
      if (typeof item === 'number' && !Number.isFinite(item)) {
        return { __unsupportedType: 'number', value: String(item) };
      }
      if (item instanceof Map) {
        return { __unsupportedType: 'Map', entries: [...item.entries()] };
      }
      if (item instanceof Set) {
        return { __unsupportedType: 'Set', values: [...item.values()] };
      }
      if (item instanceof ArrayBuffer) {
        return { __unsupportedType: 'ArrayBuffer', bytes: [...new Uint8Array(item)] };
      }
      if (ArrayBuffer.isView(item)) {
        return {
          __unsupportedType: item.constructor.name,
          bytes: [...new Uint8Array(item.buffer, item.byteOffset, item.byteLength)],
        };
      }
      if (typeof item === 'object' && item !== null) {
        if (seen.has(item)) return { __unsupportedType: 'circular-reference' };
        seen.add(item);
      }
      return item;
    },
    space,
  );
}

function rawFingerprint(value: unknown): string | null {
  if (value === undefined) return null;
  try {
    return stableSerialize(value);
  } catch {
    // 被手动写入 IndexedDB 的异常结构也必须能比较、导出并由玩家明确清除。
    return `unsupported:${diagnosticJson(value)}`;
  }
}

/** 跨标签页或同 revision 槽位被替换时拒绝旧快照覆盖。 */
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

export class SaveLoadError extends Error {
  constructor(
    readonly mainError: unknown,
    readonly backupError?: unknown,
    readonly backupAvailable = false,
    readonly reason: SaveIntegrityReason | 'schema-invalid' = mainError instanceof
    SaveIntegrityViolationError
      ? mainError.reason
      : 'schema-invalid',
  ) {
    const main = mainError instanceof Error ? mainError.message : '未知主存档错误';
    const backup = backupError instanceof Error ? `；备份也失败：${backupError.message}` : '';
    const recover = backupAvailable ? '；检测到可恢复的上一版备份' : '';
    super(`主存档读取失败：${main}${backup}${recover}`);
    this.name = 'SaveLoadError';
  }
}

export class SaveWriteError extends Error {
  constructor(readonly writeError: unknown) {
    const detail = writeError instanceof Error ? writeError.message : '未知 IndexedDB 写入错误';
    super(`IndexedDB 写入失败：${detail}`, { cause: writeError });
    this.name = 'SaveWriteError';
  }
}

interface CommitResult {
  revision: number;
  fingerprint: string;
  source: SaveEnvelopeSource;
}

async function preparePreviousEnvelope(
  raw: unknown,
  revision: number,
  writtenAt: number,
): Promise<SaveEnvelope<SaveData> | null> {
  if (!raw) return null;
  const decoded = await decodeSlot(raw);
  if (decoded.envelope) {
    if (decoded.envelope.revision !== revision) {
      throw new SaveIntegrityViolationError(
        'revision-mismatch',
        '主存档信封 revision 与 IndexedDB 元数据不一致',
      );
    }
    return decoded.envelope;
  }
  return createSaveEnvelope({
    revision,
    parentDigest: null,
    writtenAt,
    source: 'legacy',
    payload: decoded.payload,
  });
}

async function commitMainSnapshot(
  snapshot: SaveData,
  expectedRevision: number,
  expectedMainFingerprint: string | null,
  preservePreviousMain: boolean,
  source: SaveEnvelopeSource,
  writtenAt: number,
): Promise<CommitResult> {
  try {
    const before = await readRawStoredSlots();
    const beforeRevision = parseRevision(before.rawRevision);
    if (beforeRevision !== expectedRevision) {
      throw new SaveConflictError(expectedRevision, beforeRevision);
    }
    if (rawFingerprint(before.main) !== expectedMainFingerprint) {
      throw new SaveIntegrityViolationError(
        'digest-mismatch',
        '主存档在当前 revision 下被替换，已停止写入',
      );
    }

    const revision = nextRevision(beforeRevision);
    const previous = preservePreviousMain
      ? await preparePreviousEnvelope(before.main, beforeRevision, writtenAt)
      : null;
    const envelope = await createSaveEnvelope({
      revision,
      parentDigest: previous?.digest ?? null,
      writtenAt,
      source,
      payload: snapshot,
    });

    const db = await getDb();
    const tx = db.transaction(STORE, 'readwrite');
    const [rawRevision, currentMain] = await Promise.all([
      tx.store.get(REVISION_KEY),
      tx.store.get(SAVE_KEY),
    ]);
    const actualRevision = parseRevision(rawRevision);
    if (actualRevision !== expectedRevision) {
      await tx.done;
      throw new SaveConflictError(expectedRevision, actualRevision);
    }
    if (rawFingerprint(currentMain) !== expectedMainFingerprint) {
      await tx.done;
      throw new SaveIntegrityViolationError(
        'digest-mismatch',
        '主存档在写入事务前被替换，已停止写入',
      );
    }
    if (previous) await tx.store.put(previous, BACKUP_KEY);
    await tx.store.put(envelope, SAVE_KEY);
    await tx.store.put(revision, REVISION_KEY);
    await tx.done;
    return { revision, fingerprint: stableSerialize(envelope), source };
  } catch (error) {
    if (error instanceof SaveConflictError || error instanceof SaveIntegrityViolationError) {
      throw error;
    }
    throw new SaveWriteError(error);
  }
}

async function clearStoredSlots(
  expectedRevision: number,
  expectedMainFingerprint: string | null,
): Promise<number> {
  try {
    const db = await getDb();
    const tx = db.transaction(STORE, 'readwrite');
    const [rawRevision, currentMain] = await Promise.all([
      tx.store.get(REVISION_KEY),
      tx.store.get(SAVE_KEY),
    ]);
    const actualRevision = parseRevision(rawRevision);
    if (actualRevision !== expectedRevision) {
      await tx.done;
      throw new SaveConflictError(expectedRevision, actualRevision);
    }
    if (rawFingerprint(currentMain) !== expectedMainFingerprint) {
      await tx.done;
      throw new SaveIntegrityViolationError('digest-mismatch', '主存档在清档前被替换，已停止操作');
    }
    const revision = nextRevision(actualRevision);
    await tx.store.delete(SAVE_KEY);
    await tx.store.delete(BACKUP_KEY);
    await tx.store.delete(QUARANTINE_KEY);
    await tx.store.put(revision, REVISION_KEY);
    await tx.done;
    return revision;
  } catch (error) {
    if (error instanceof SaveConflictError || error instanceof SaveIntegrityViolationError) {
      throw error;
    }
    throw new SaveWriteError(error);
  }
}

export interface SaveStorageClient {
  loadSave(): Promise<SaveData | null>;
  loadBackup(): Promise<SaveData | null>;
  saveSave(data: SaveData, options?: { source?: SaveEnvelopeSource }): Promise<void>;
  clearSave(): Promise<void>;
  recoverBackup(): Promise<SaveData>;
  forceClearCorruptedSave(): Promise<void>;
  getIntegrityStatus(): SaveIntegrityStatus;
}

export function createSaveStorageClient(options?: { now?: () => number }): SaveStorageClient {
  const now = options?.now ?? Date.now;
  let knownRevision: number | null = null;
  let knownMainFingerprint: string | null = null;
  let knownSource: SaveEnvelopeSource = 'local';
  let integrityStatus: SaveIntegrityStatus = { ...EMPTY_INTEGRITY_STATUS };
  let integrityBlocked = false;
  let writeQueue: Promise<void> = Promise.resolve();

  function enqueueWrite<T>(operation: () => Promise<T>): Promise<T> {
    const queued = writeQueue.then(operation);
    writeQueue = queued.then(
      () => undefined,
      () => undefined,
    );
    return queued;
  }

  async function loadClientSave(): Promise<SaveData | null> {
    let slots: RawStoredSlots;
    try {
      slots = await readRawStoredSlots();
    } catch (error) {
      integrityStatus = {
        state: 'error',
        revision: null,
        source: null,
        backupAvailable: false,
        reason: 'schema-invalid',
        message: error instanceof Error ? error.message : String(error),
      };
      integrityBlocked = true;
      throw new SaveLoadError(error);
    }
    knownMainFingerprint = rawFingerprint(slots.main);
    try {
      knownRevision = parseRevision(slots.rawRevision);
    } catch (error) {
      const recovery = await canRecoverBackup(slots.backup);
      const backupAvailable = recovery.decoded !== null;
      const reason = error instanceof SaveIntegrityViolationError ? error.reason : 'schema-invalid';
      integrityStatus = {
        state: 'error',
        revision: null,
        source: null,
        backupAvailable,
        reason,
        message: error instanceof Error ? error.message : String(error),
      };
      integrityBlocked = true;
      throw new SaveLoadError(error, recovery.error, backupAvailable, reason);
    }
    if (!slots.main) {
      integrityStatus = { ...EMPTY_INTEGRITY_STATUS, revision: knownRevision };
      integrityBlocked = false;
      return null;
    }

    try {
      const main = await decodeSlot(slots.main);
      if (main.envelope) {
        if (main.envelope.revision !== knownRevision) {
          throw new SaveIntegrityViolationError(
            'revision-mismatch',
            '主存档信封 revision 与 IndexedDB 元数据不一致',
          );
        }
        let backupEnvelope: SaveEnvelope<SaveData> | null = null;
        if (slots.backup) {
          const backup = await decodeSlot(slots.backup);
          if (!backup.envelope) {
            throw new SaveIntegrityViolationError(
              'chain-mismatch',
              '完整性主档对应的备份仍是无法验证的旧格式',
            );
          }
          backupEnvelope = backup.envelope;
        }
        verifySaveEnvelopeChain(main.envelope, backupEnvelope);
      }
      knownSource = main.source;
      integrityStatus = {
        state: main.envelope ? (main.source === 'imported' ? 'imported' : 'verified') : 'legacy',
        revision: knownRevision,
        source: main.source,
        backupAvailable: Boolean(slots.backup),
      };
      integrityBlocked = false;
      return main.payload;
    } catch (mainError) {
      const recovery = await canRecoverBackup(slots.backup);
      const backupAvailable = recovery.decoded !== null;
      const reason =
        mainError instanceof SaveIntegrityViolationError ? mainError.reason : 'schema-invalid';
      integrityStatus = {
        state: 'error',
        revision: knownRevision,
        source: null,
        backupAvailable,
        reason,
        message: mainError instanceof Error ? mainError.message : '未知主存档错误',
      };
      integrityBlocked = true;
      throw new SaveLoadError(mainError, recovery.error, backupAvailable, reason);
    }
  }

  async function loadClientBackup(): Promise<SaveData | null> {
    const db = await getDb();
    const raw = await db.get(STORE, BACKUP_KEY);
    return raw ? (await decodeSlot(raw)).payload : null;
  }

  async function saveClientSave(
    data: SaveData,
    saveOptions?: { source?: SaveEnvelopeSource },
  ): Promise<void> {
    if (integrityBlocked) {
      return Promise.reject(
        new SaveIntegrityViolationError(
          integrityStatus.reason === 'schema-invalid' || !integrityStatus.reason
            ? 'malformed-envelope'
            : integrityStatus.reason,
          '存档完整性异常尚未处理，已停止自动写入',
        ),
      );
    }
    const snapshot = parseSave(data);
    await enqueueWrite(async () => {
      const expectedRevision = knownRevision ?? 0;
      const source = saveOptions?.source ?? knownSource;
      const result = await commitMainSnapshot(
        snapshot,
        expectedRevision,
        knownMainFingerprint,
        true,
        source,
        now(),
      );
      knownRevision = result.revision;
      knownMainFingerprint = result.fingerprint;
      knownSource = result.source;
      integrityStatus = {
        state: source === 'imported' ? 'imported' : 'verified',
        revision: result.revision,
        source,
        backupAvailable: expectedRevision > 0,
      };
    });
  }

  function clearClientSave(): Promise<void> {
    if (integrityBlocked) {
      return Promise.reject(
        new SaveIntegrityViolationError(
          integrityStatus.reason === 'schema-invalid' || !integrityStatus.reason
            ? 'malformed-envelope'
            : integrityStatus.reason,
          '存档完整性异常尚未处理，请使用明确的损坏存档清除操作',
        ),
      );
    }
    return enqueueWrite(async () => {
      const expectedRevision = knownRevision ?? 0;
      knownRevision = await clearStoredSlots(expectedRevision, knownMainFingerprint);
      knownMainFingerprint = null;
      knownSource = 'local';
      integrityStatus = { ...EMPTY_INTEGRITY_STATUS, revision: knownRevision };
    });
  }

  function recoverClientBackup(): Promise<SaveData> {
    return enqueueWrite(async () => {
      const slots = await readRawStoredSlots();
      const recovery = await canRecoverBackup(slots.backup);
      if (!recovery.decoded) {
        throw new SaveLoadError(new Error('没有可恢复的有效备份'), recovery.error);
      }
      let rawRevision: number;
      try {
        rawRevision = parseRevision(slots.rawRevision);
      } catch {
        rawRevision = recovery.decoded.envelope?.revision ?? 0;
      }
      const backupEnvelope =
        recovery.decoded.envelope ??
        (await createSaveEnvelope({
          revision: rawRevision,
          parentDigest: null,
          writtenAt: now(),
          source: 'legacy',
          payload: recovery.decoded.payload,
        }));
      const revision = nextRevision(Math.max(rawRevision, backupEnvelope.revision));
      const mainEnvelope = await createSaveEnvelope({
        revision,
        parentDigest: backupEnvelope.digest,
        writtenAt: now(),
        source: backupEnvelope.source,
        payload: recovery.decoded.payload,
      });

      const db = await getDb();
      const tx = db.transaction(STORE, 'readwrite');
      const [currentMain, currentBackup, currentRevision] = await Promise.all([
        tx.store.get(SAVE_KEY),
        tx.store.get(BACKUP_KEY),
        tx.store.get(REVISION_KEY),
      ]);
      if (
        rawFingerprint(currentMain) !== rawFingerprint(slots.main) ||
        rawFingerprint(currentBackup) !== rawFingerprint(slots.backup) ||
        rawFingerprint(currentRevision) !== rawFingerprint(slots.rawRevision)
      ) {
        await tx.done;
        throw new SaveConflictError(rawRevision, parseRevision(currentRevision));
      }
      await tx.store.put(
        { capturedAt: now(), main: slots.main, backup: slots.backup, revision: slots.rawRevision },
        QUARANTINE_KEY,
      );
      await tx.store.put(backupEnvelope, BACKUP_KEY);
      await tx.store.put(mainEnvelope, SAVE_KEY);
      await tx.store.put(revision, REVISION_KEY);
      await tx.done;

      knownRevision = revision;
      knownMainFingerprint = stableSerialize(mainEnvelope);
      knownSource = mainEnvelope.source;
      integrityStatus = {
        state: mainEnvelope.source === 'imported' ? 'imported' : 'verified',
        revision,
        source: mainEnvelope.source,
        backupAvailable: true,
      };
      integrityBlocked = false;
      return recovery.decoded.payload;
    });
  }

  function forceClearClientCorruptedSave(): Promise<void> {
    return enqueueWrite(async () => {
      const slots = await readRawStoredSlots();
      const revisions = [0];
      if (Number.isSafeInteger(slots.rawRevision) && (slots.rawRevision as number) >= 0) {
        revisions.push(slots.rawRevision as number);
      }
      for (const raw of [slots.main, slots.backup]) {
        if (looksLikeSaveEnvelope(raw)) {
          const revision = (raw as { revision?: unknown }).revision;
          if (Number.isSafeInteger(revision) && (revision as number) >= 0) {
            revisions.push(revision as number);
          }
        }
      }
      const revision = nextRevision(Math.max(...revisions));
      const db = await getDb();
      const tx = db.transaction(STORE, 'readwrite');
      const [currentMain, currentBackup, currentRevision] = await Promise.all([
        tx.store.get(SAVE_KEY),
        tx.store.get(BACKUP_KEY),
        tx.store.get(REVISION_KEY),
      ]);
      if (
        rawFingerprint(currentMain) !== rawFingerprint(slots.main) ||
        rawFingerprint(currentBackup) !== rawFingerprint(slots.backup) ||
        rawFingerprint(currentRevision) !== rawFingerprint(slots.rawRevision)
      ) {
        await tx.done;
        throw new SaveIntegrityViolationError(
          'revision-mismatch',
          '损坏存档在确认清除前已发生变化，请刷新后重试',
        );
      }
      await tx.store.delete(SAVE_KEY);
      await tx.store.delete(BACKUP_KEY);
      await tx.store.delete(QUARANTINE_KEY);
      await tx.store.put(revision, REVISION_KEY);
      await tx.done;
      knownRevision = revision;
      knownMainFingerprint = null;
      knownSource = 'local';
      integrityStatus = { ...EMPTY_INTEGRITY_STATUS, revision };
      integrityBlocked = false;
    });
  }

  return {
    loadSave: loadClientSave,
    loadBackup: loadClientBackup,
    saveSave: saveClientSave,
    clearSave: clearClientSave,
    recoverBackup: recoverClientBackup,
    forceClearCorruptedSave: forceClearClientCorruptedSave,
    getIntegrityStatus: () => ({ ...integrityStatus }),
  };
}

const defaultStorageClient = createSaveStorageClient();

export function loadSave(): Promise<SaveData | null> {
  return defaultStorageClient.loadSave();
}

export function loadBackup(): Promise<SaveData | null> {
  return defaultStorageClient.loadBackup();
}

export function saveSave(data: SaveData, options?: { source?: SaveEnvelopeSource }): Promise<void> {
  return defaultStorageClient.saveSave(data, options);
}

export function clearSave(): Promise<void> {
  return defaultStorageClient.clearSave();
}

export function recoverBackup(): Promise<SaveData> {
  return defaultStorageClient.recoverBackup();
}

export function forceClearCorruptedSave(): Promise<void> {
  return defaultStorageClient.forceClearCorruptedSave();
}

export function getSaveIntegrityStatus(): SaveIntegrityStatus {
  return defaultStorageClient.getIntegrityStatus();
}

export function exportToJson(data: SaveData): string {
  return JSON.stringify(data, null, 2);
}

export function downloadSave(data: SaveData): void {
  downloadJson(exportToJson(data), `樱刃传说-存档-${fileStamp()}.json`);
}

function fileStamp(): string {
  return new Date().toISOString().slice(0, 16).replace(/[:T]/g, '-');
}

function downloadJson(text: string, filename: string): void {
  const blob = new Blob([text], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

/** 导出主/备份原始槽位供排查；不会把这些元数据当作可再次导入的可信证明。 */
export async function exportRawSaveDiagnostics(): Promise<string> {
  const slots = await readRawStoredSlots();
  const db = await getDb();
  const quarantine = await db.get(STORE, QUARANTINE_KEY);
  return diagnosticJson(
    {
      warning: '仅供存档故障排查，不能作为可信资产证明，也不能直接导入游戏。',
      exportedAt: Date.now(),
      main: slots.main,
      backup: slots.backup,
      revision: slots.rawRevision,
      quarantine,
    },
    2,
  );
}

export async function downloadRawSaveDiagnostics(): Promise<void> {
  downloadJson(await exportRawSaveDiagnostics(), `樱刃传说-存档诊断-${fileStamp()}.json`);
}

export class InvalidSaveError extends Error {
  constructor(msg: string) {
    super(msg);
    this.name = 'InvalidSaveError';
  }
}

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
  if (
    'envelopeVersion' in parsed ||
    'digest' in parsed ||
    'parentDigest' in parsed ||
    'authoritativeRevision' in parsed ||
    'serverProof' in parsed
  ) {
    throw new InvalidSaveError('导入文件包含完整性或服务端证明字段；只接受普通 SaveData 备份。');
  }
  try {
    return migrate(parsed as Record<string, unknown>);
  } catch (error) {
    if (error instanceof SaveTooNewError) throw error;
    const message = error instanceof Error ? error.message : '未知结构错误';
    throw new InvalidSaveError(`存档结构校验失败：${message}`);
  }
}
