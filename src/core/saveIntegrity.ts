/**
 * 存档完整性信封纯逻辑。
 *
 * 这里刻意使用公开 SHA-256，而不是把“密钥”塞进前端包里制造虚假的安全感。
 * 它能发现损坏和只改 payload 的低成本编辑，但不能阻止掌握开发者工具的人重算摘要。
 */

export const SAVE_ENVELOPE_VERSION = 1 as const;

export type SaveEnvelopeSource = 'local' | 'legacy' | 'imported';

export interface SaveEnvelope<T = unknown> {
  envelopeVersion: typeof SAVE_ENVELOPE_VERSION;
  revision: number;
  parentDigest: string | null;
  digest: string;
  writtenAt: number;
  source: SaveEnvelopeSource;
  payload: T;
}

export type SaveIntegrityReason =
  'malformed-envelope' | 'digest-mismatch' | 'chain-mismatch' | 'revision-mismatch';

export class SaveIntegrityViolationError extends Error {
  constructor(
    readonly reason: SaveIntegrityReason,
    message: string,
  ) {
    super(message);
    this.name = 'SaveIntegrityViolationError';
  }
}

function assertJsonValue(value: unknown, seen: Set<object>): string {
  if (value === null) return 'null';
  if (typeof value === 'string') return JSON.stringify(value);
  if (typeof value === 'boolean') return value ? 'true' : 'false';
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) throw new TypeError('完整性序列化不接受 NaN 或 Infinity');
    return Object.is(value, -0) ? '0' : String(value);
  }
  if (typeof value !== 'object') {
    throw new TypeError(`完整性序列化不接受 ${typeof value}`);
  }
  if (seen.has(value)) throw new TypeError('完整性序列化不接受循环引用');
  seen.add(value);
  try {
    if (Array.isArray(value)) {
      const items: string[] = [];
      for (let index = 0; index < value.length; index += 1) {
        if (!(index in value)) throw new TypeError('完整性序列化不接受稀疏数组');
        items.push(assertJsonValue(value[index], seen));
      }
      return `[${items.join(',')}]`;
    }

    const prototype = Object.getPrototypeOf(value) as object | null;
    if (prototype !== Object.prototype && prototype !== null) {
      throw new TypeError('完整性序列化只接受普通 JSON 对象');
    }
    const record = value as Record<string, unknown>;
    return `{${Object.keys(record)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${assertJsonValue(record[key], seen)}`)
      .join(',')}}`;
  } finally {
    seen.delete(value);
  }
}

/** 对 JSON 值按对象 key 排序，得到跨运行环境一致的字符串。 */
export function stableSerialize(value: unknown): string {
  return assertJsonValue(value, new Set());
}

/** WebCrypto 是浏览器与 Edge Runtime 的共同标准，且不会引入可被误解为秘密的密钥。 */
export async function sha256Hex(value: string): Promise<string> {
  const bytes = new TextEncoder().encode(value);
  const digest = await globalThis.crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
}

function digestInput<T>(envelope: Omit<SaveEnvelope<T>, 'digest'>): string {
  return stableSerialize(envelope);
}

export async function createSaveEnvelope<T>(input: {
  revision: number;
  parentDigest: string | null;
  writtenAt: number;
  source: SaveEnvelopeSource;
  payload: T;
}): Promise<SaveEnvelope<T>> {
  const unsigned = {
    envelopeVersion: SAVE_ENVELOPE_VERSION,
    revision: input.revision,
    parentDigest: input.parentDigest,
    writtenAt: input.writtenAt,
    source: input.source,
    payload: input.payload,
  } as const;
  validateUnsignedEnvelope(unsigned);
  return { ...unsigned, digest: await sha256Hex(digestInput(unsigned)) };
}

function isDigest(value: unknown): value is string {
  return typeof value === 'string' && /^[0-9a-f]{64}$/.test(value);
}

function validateUnsignedEnvelope(value: Omit<SaveEnvelope, 'digest'>): void {
  if (value.envelopeVersion !== SAVE_ENVELOPE_VERSION) {
    throw new SaveIntegrityViolationError('malformed-envelope', '存档完整性信封版本不受支持');
  }
  if (!Number.isSafeInteger(value.revision) || value.revision < 0) {
    throw new SaveIntegrityViolationError('malformed-envelope', '存档完整性 revision 不合法');
  }
  if (value.parentDigest !== null && !isDigest(value.parentDigest)) {
    throw new SaveIntegrityViolationError('malformed-envelope', '存档父摘要格式不合法');
  }
  if (!Number.isSafeInteger(value.writtenAt) || value.writtenAt < 0) {
    throw new SaveIntegrityViolationError('malformed-envelope', '存档写入时间不合法');
  }
  if (!['local', 'legacy', 'imported'].includes(value.source)) {
    throw new SaveIntegrityViolationError('malformed-envelope', '存档来源标记不合法');
  }
  stableSerialize(value.payload);
}

export function looksLikeSaveEnvelope(value: unknown): boolean {
  return typeof value === 'object' && value !== null && 'envelopeVersion' in value;
}

/** 校验信封结构与摘要；成功时返回同一份带类型对象。 */
export async function verifySaveEnvelope<T = unknown>(value: unknown): Promise<SaveEnvelope<T>> {
  if (typeof value !== 'object' || value === null) {
    throw new SaveIntegrityViolationError('malformed-envelope', '存档完整性信封不是对象');
  }
  const keys = Object.keys(value).sort();
  const expectedKeys = [
    'digest',
    'envelopeVersion',
    'parentDigest',
    'payload',
    'revision',
    'source',
    'writtenAt',
  ];
  if (
    keys.length !== expectedKeys.length ||
    keys.some((key, index) => key !== expectedKeys[index])
  ) {
    throw new SaveIntegrityViolationError('malformed-envelope', '存档完整性信封字段不完整');
  }
  const envelope = value as SaveEnvelope<T>;
  const { digest, ...unsigned } = envelope;
  validateUnsignedEnvelope(unsigned);
  if (!isDigest(digest)) {
    throw new SaveIntegrityViolationError('malformed-envelope', '存档摘要格式不合法');
  }
  const expected = await sha256Hex(digestInput(unsigned));
  if (digest !== expected) {
    throw new SaveIntegrityViolationError('digest-mismatch', '存档内容与完整性摘要不一致');
  }
  return envelope;
}

/** 主/备份链校验。备份存在时，主档必须明确引用它且 revision 更大。 */
export function verifySaveEnvelopeChain(main: SaveEnvelope, backup: SaveEnvelope | null): void {
  if (!backup) {
    if (main.parentDigest !== null) {
      throw new SaveIntegrityViolationError('chain-mismatch', '存档父摘要指向了不存在的备份');
    }
    return;
  }
  if (main.parentDigest !== backup.digest || main.revision <= backup.revision) {
    throw new SaveIntegrityViolationError('chain-mismatch', '主存档与备份的摘要链不连续');
  }
}
