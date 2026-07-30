import { describe, expect, it } from 'vitest';
import {
  createSaveEnvelope,
  SaveIntegrityViolationError,
  stableSerialize,
  verifySaveEnvelope,
  verifySaveEnvelopeChain,
} from '../saveIntegrity';

describe('存档完整性信封', () => {
  it('对象 key 顺序不同仍得到完全相同的规范字符串与摘要', async () => {
    const left = { z: 1, nested: { b: true, a: ['樱', 2] } };
    const right = { nested: { a: ['樱', 2], b: true }, z: 1 };
    expect(stableSerialize(left)).toBe(stableSerialize(right));

    const first = await createSaveEnvelope({
      revision: 1,
      parentDigest: null,
      writtenAt: 100,
      source: 'local',
      payload: left,
    });
    const second = await createSaveEnvelope({
      revision: 1,
      parentDigest: null,
      writtenAt: 100,
      source: 'local',
      payload: right,
    });
    expect(first.digest).toBe(second.digest);
  });

  it.each([Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY])(
    '拒绝 JSON 无法忠实表达的特殊数字 %s',
    (value) => expect(() => stableSerialize({ value })).toThrow(/NaN|Infinity/),
  );

  it('payload 被直接修改时报告摘要不一致', async () => {
    const envelope = await createSaveEnvelope({
      revision: 2,
      parentDigest: null,
      writtenAt: 200,
      source: 'local',
      payload: { gold: 10 },
    });
    const tampered = structuredClone(envelope);
    tampered.payload.gold = 9_999_999;
    await expect(verifySaveEnvelope(tampered)).rejects.toMatchObject({
      name: 'SaveIntegrityViolationError',
      reason: 'digest-mismatch',
    });
  });

  it('正常链接受、替换备份或丢失备份会报告链断裂', async () => {
    const backup = await createSaveEnvelope({
      revision: 7,
      parentDigest: null,
      writtenAt: 700,
      source: 'legacy',
      payload: { gold: 10 },
    });
    const main = await createSaveEnvelope({
      revision: 8,
      parentDigest: backup.digest,
      writtenAt: 800,
      source: 'legacy',
      payload: { gold: 11 },
    });
    expect(() => verifySaveEnvelopeChain(main, backup)).not.toThrow();
    expect(() => verifySaveEnvelopeChain(main, null)).toThrow(SaveIntegrityViolationError);

    const foreign = await createSaveEnvelope({
      revision: 7,
      parentDigest: null,
      writtenAt: 700,
      source: 'legacy',
      payload: { gold: 999 },
    });
    expect(() => verifySaveEnvelopeChain(main, foreign)).toThrow(/摘要链/);
  });
});
