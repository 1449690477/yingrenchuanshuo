import { describe, expect, it } from 'vitest';
import {
  ENHANCE_BATCH_MAX_ATTEMPTS,
  enhanceBatch,
  enhanceGainSalt,
  type EnhanceBatchCandidate,
  type EnhanceBatchInput,
  type EnhanceBatchWallet,
} from '../enhanceBatch';
import type { EquipmentInstance } from '../types';
import { ENHANCE_MATERIAL_IDS, ENHANCE_MAX } from '@/data/constants';

function instance(
  uid: string,
  enhance = 0,
  overrides: Partial<EquipmentInstance> = {},
): EquipmentInstance {
  return {
    uid,
    defId: `eq_${uid}`,
    enhance,
    baseRollPermille: 1000,
    enhanceGainPermille: Array.from({ length: ENHANCE_MAX }, (_, index) =>
      index < enhance ? 80 : 0,
    ),
    enhanceLuck: {},
    affixes: [{ key: 'atk', value: 3, tier: 3 }],
    reforgeResonance: 0,
    locked: false,
    ...overrides,
  };
}

function candidate(
  uid: string,
  enhance = 0,
  equipmentLevel = 20,
  order = 0,
  overrides: Partial<EquipmentInstance> = {},
): EnhanceBatchCandidate {
  return {
    instance: instance(uid, enhance, overrides),
    equipmentLevel,
    order,
  };
}

function wallet(overrides: Partial<EnhanceBatchWallet> = {}): EnhanceBatchWallet {
  return {
    gold: 1_000_000_000,
    items: {
      [ENHANCE_MATERIAL_IDS.stone]: 1_000_000,
      [ENHANCE_MATERIAL_IDS.ore]: 1_000_000,
      [ENHANCE_MATERIAL_IDS.lucky]: 1_000_000,
      [ENHANCE_MATERIAL_IDS.protection]: 1_000_000,
    },
    ...overrides,
  };
}

function input(overrides: Partial<EnhanceBatchInput> = {}): EnhanceBatchInput {
  return {
    rngState: 1,
    wallet: wallet(),
    candidates: [candidate('one')],
    targetLevel: 5,
    strategy: 'single',
    ...overrides,
  };
}

describe('批量强化输入与确定性', () => {
  it('完整克隆资产、装备和嵌套字段，不修改任何输入', () => {
    const original = input({
      targetLevel: 3,
      wallet: wallet({
        gold: 100_000,
        items: {
          [ENHANCE_MATERIAL_IDS.stone]: 100,
          unrelated: 7,
        },
      }),
    });
    const snapshot = structuredClone(original);

    const result = enhanceBatch(original);

    expect(original).toEqual(snapshot);
    expect(result.wallet).not.toBe(original.wallet);
    expect(result.wallet.items).not.toBe(original.wallet.items);
    expect(result.instances[0]).not.toBe(original.candidates[0]!.instance);
    expect(result.instances[0]!.enhanceGainPermille).not.toBe(
      original.candidates[0]!.instance.enhanceGainPermille,
    );
    expect(result.instances[0]!.enhanceLuck).not.toBe(original.candidates[0]!.instance.enhanceLuck);
    expect(result.instances[0]!.affixes[0]).not.toBe(original.candidates[0]!.instance.affixes[0]);
  });

  it('相同输入和 RNG 状态产生完全相同的装备、资产、事件与下一状态', () => {
    const same = input({
      rngState: 31_337,
      targetLevel: 12,
      maxAttempts: 40,
    });
    expect(enhanceBatch(same)).toEqual(enhanceBatch(same));
  });

  it('强化增幅盐值与既有 store 算法逐 UTF-16 单元兼容', () => {
    expect(enhanceGainSalt('e1', 1)).toBe(3_340_386_194);
    expect(enhanceGainSalt('装备-🌸', 15)).toBe(2_899_578_275);
    expect(enhanceGainSalt('uid_abc', 13)).toBe(2_985_450_079);
  });
});

describe('单件一键强化', () => {
  it('+0 到 +5 精确扣除五级成本，并为每一级固定强化增幅', () => {
    const result = enhanceBatch(
      input({
        wallet: wallet({
          gold: 100_000,
          items: {
            [ENHANCE_MATERIAL_IDS.stone]: 1_000,
            [ENHANCE_MATERIAL_IDS.ore]: 12,
            [ENHANCE_MATERIAL_IDS.lucky]: 3,
            [ENHANCE_MATERIAL_IDS.protection]: 2,
            unrelated: 7,
          },
        }),
      }),
    );

    // Σ(1²…5²)=55；金币还要乘装备等级 20 与每级系数 8。
    expect(result.stopReason).toBe('target-reached');
    expect(result.attempts).toHaveLength(5);
    expect(result.wallet.gold).toBe(100_000 - 55 * 20 * 8);
    expect(result.wallet.items).toEqual({
      [ENHANCE_MATERIAL_IDS.stone]: 945,
      [ENHANCE_MATERIAL_IDS.ore]: 12,
      [ENHANCE_MATERIAL_IDS.lucky]: 3,
      [ENHANCE_MATERIAL_IDS.protection]: 2,
      unrelated: 7,
    });
    expect(result.instances[0]!.enhance).toBe(5);
    expect(result.instances[0]!.enhanceGainPermille.slice(0, 5).every((gain) => gain >= 80)).toBe(
      true,
    );
    expect(result.instances[0]!.enhanceGainPermille.slice(5)).toEqual(
      Array<number>(ENHANCE_MAX - 5).fill(0),
    );
  });

  it('资源不足在随机判定前停止，RNG 状态一格都不推进', () => {
    const rngState = 0x1234_5678;
    const result = enhanceBatch(
      input({
        rngState,
        wallet: wallet({ gold: 0 }),
      }),
    );

    expect(result.stopReason).toBe('blocked');
    expect(result.attempts).toEqual([]);
    expect(result.blocked).toMatchObject([
      {
        uid: 'one',
        reason: 'insufficient-gold',
        currentLevel: 0,
        targetLevel: 1,
      },
    ]);
    expect(result.nextRngState).toBe(rngState);
    expect(result.instances[0]!.enhance).toBe(0);
  });

  it('待确认洗练候选在 +13 碎裂判定前硬拒绝，资产与 RNG 都不推进', () => {
    const rngState = 0x2468_1357;
    const originalWallet = wallet();
    const pending = candidate('paid-pending', 12, 20, 0, {
      pendingAffixChange: {
        operation: 'temper',
        affixIndex: 0,
        candidate: { key: 'atk', value: 9, tier: 5 },
      },
    });

    const result = enhanceBatch(
      input({
        rngState,
        wallet: originalWallet,
        candidates: [pending],
        targetLevel: 13,
      }),
    );

    expect(result.stopReason).toBe('blocked');
    expect(result.attempts).toEqual([]);
    expect(result.blocked).toMatchObject([
      {
        uid: 'paid-pending',
        reason: 'pending-affix-result',
        currentLevel: 12,
        targetLevel: 13,
      },
    ]);
    expect(result.wallet).toEqual(originalWallet);
    expect(result.nextRngState).toBe(rngState);
    expect(result.instances[0]).toEqual(pending.instance);
  });

  it('+10 随机失败会掉一级并把幸运值留在 +10 独立桶', () => {
    const result = enhanceBatch(
      input({
        // state=1 的下一次随机值约 0.627，大于 +10 的 45% 成功率。
        rngState: 1,
        candidates: [candidate('downgrade', 9)],
        targetLevel: 10,
        wallet: wallet({
          gold: 16_000,
          items: {
            [ENHANCE_MATERIAL_IDS.stone]: 100,
            [ENHANCE_MATERIAL_IDS.ore]: 5,
          },
        }),
      }),
    );

    expect(result.attempts).toHaveLength(1);
    expect(result.attempts[0]!.result.outcome).toBe('downgraded');
    expect(result.instances[0]!.enhance).toBe(8);
    expect(result.instances[0]!.enhanceLuck).toEqual({ '10': 3 });
    expect(result.instances[0]!.enhanceGainPermille.slice(0, 9)).toEqual(Array<number>(9).fill(80));
  });

  it('+13 非保底会自动使用保护符，失败也只保护不碎装', () => {
    const result = enhanceBatch(
      input({
        rngState: 1,
        candidates: [candidate('safe', 12)],
        targetLevel: 13,
        maxAttempts: 1,
        wallet: wallet({
          gold: 27_040,
          items: {
            [ENHANCE_MATERIAL_IDS.stone]: 169,
            [ENHANCE_MATERIAL_IDS.ore]: 20,
            [ENHANCE_MATERIAL_IDS.lucky]: 1,
            [ENHANCE_MATERIAL_IDS.protection]: 1,
          },
        }),
      }),
    );

    expect(result.attempts).toHaveLength(1);
    expect(result.attempts[0]).toMatchObject({
      useProtection: true,
      result: {
        outcome: 'protected',
        nextLevel: 12,
        protectionConsumed: true,
      },
    });
    expect(result.attempts.some((event) => event.result.outcome === 'broken')).toBe(false);
    expect(result.instances[0]!.enhance).toBe(12);
    expect(result.instances[0]!.enhanceLuck).toEqual({ '13': 5 });
    expect(result.wallet.items[ENHANCE_MATERIAL_IDS.protection]).toBeUndefined();
  });

  it('+13 非保底缺保护符时跳过，资产与 RNG 都不动', () => {
    const rngState = 0x8765_4321;
    const originalWallet = wallet({
      gold: 27_040,
      items: {
        [ENHANCE_MATERIAL_IDS.stone]: 169,
        [ENHANCE_MATERIAL_IDS.ore]: 20,
        [ENHANCE_MATERIAL_IDS.lucky]: 1,
      },
    });
    const result = enhanceBatch(
      input({
        rngState,
        candidates: [candidate('no-charm', 12)],
        targetLevel: 13,
        wallet: originalWallet,
      }),
    );

    expect(result.stopReason).toBe('blocked');
    expect(result.attempts).toEqual([]);
    expect(result.blocked[0]!.reason).toBe('insufficient-protection');
    expect(result.wallet).toEqual(originalWallet);
    expect(result.nextRngState).toBe(rngState);
    expect(result.instances[0]!.enhance).toBe(12);
  });

  it('幸运值已满的 +13 不需要保护符也必定成功', () => {
    const result = enhanceBatch(
      input({
        rngState: 1,
        candidates: [
          candidate('guaranteed', 12, 20, 0, {
            enhanceLuck: { '13': 100 },
          }),
        ],
        targetLevel: 13,
        wallet: wallet({
          gold: 27_040,
          items: {
            [ENHANCE_MATERIAL_IDS.stone]: 169,
            [ENHANCE_MATERIAL_IDS.ore]: 20,
            [ENHANCE_MATERIAL_IDS.lucky]: 1,
          },
        }),
      }),
    );

    expect(result.stopReason).toBe('target-reached');
    expect(result.attempts[0]).toMatchObject({
      useProtection: false,
      result: {
        outcome: 'success',
        guaranteed: true,
        protectionConsumed: false,
      },
    });
    expect(result.instances[0]!.enhance).toBe(13);
    expect(result.instances[0]!.enhanceLuck).toEqual({});
    expect(result.attempts[0]!.gainRoll).not.toBeNull();
  });

  it('达到调用方尝试上限后停止，不会继续吞资源', () => {
    const result = enhanceBatch(
      input({
        targetLevel: 5,
        maxAttempts: 2,
      }),
    );

    expect(result.stopReason).toBe('attempt-limit');
    expect(result.attempts).toHaveLength(2);
    expect(result.instances[0]!.enhance).toBe(2);
  });
});

describe('全身均衡强化', () => {
  it('按 order 每轮各尝试一次，并保持结果实例为原输入顺序', () => {
    const result = enhanceBatch(
      input({
        strategy: 'balanced',
        candidates: [candidate('input-first', 0, 20, 7), candidate('slot-first', 0, 20, 0)],
        targetLevel: 5,
        maxAttempts: 4,
      }),
    );

    expect(result.stopReason).toBe('attempt-limit');
    expect(result.attempts.map((event) => event.uid)).toEqual([
      'slot-first',
      'input-first',
      'slot-first',
      'input-first',
    ]);
    expect(result.attempts.map((event) => event.round)).toEqual([1, 1, 2, 2]);
    expect(result.attempts.map((event) => event.milestone)).toEqual([5, 5, 5, 5]);
    expect(result.instances.map((item) => item.uid)).toEqual(['input-first', 'slot-first']);
    expect(result.instances.map((item) => item.enhance)).toEqual([2, 2]);
  });

  it('全身达到 +5 后才进入 +9 里程碑', () => {
    const result = enhanceBatch(
      input({
        strategy: 'balanced',
        candidates: [candidate('later', 0, 20, 1), candidate('earlier', 0, 20, 0)],
        targetLevel: 9,
        maxAttempts: 11,
      }),
    );

    expect(result.attempts.slice(0, 10).every((event) => event.milestone === 5)).toBe(true);
    expect(result.attempts[10]!.milestone).toBe(9);
    expect(result.attempts.slice(0, 10).map((event) => event.uid)).toEqual([
      'earlier',
      'later',
      'earlier',
      'later',
      'earlier',
      'later',
      'earlier',
      'later',
      'earlier',
      'later',
    ]);
  });

  it('高等级装备资源不足时可跳过，仍会尝试同轮可负担的装备', () => {
    const result = enhanceBatch(
      input({
        strategy: 'balanced',
        candidates: [candidate('expensive', 0, 100, 0), candidate('affordable', 0, 1, 1)],
        targetLevel: 5,
        maxAttempts: 1,
        wallet: wallet({
          gold: 100,
          items: { [ENHANCE_MATERIAL_IDS.stone]: 10 },
        }),
      }),
    );

    expect(result.blocked).toMatchObject([
      {
        uid: 'expensive',
        reason: 'insufficient-gold',
      },
    ]);
    expect(result.attempts.map((event) => event.uid)).toEqual(['affordable']);
    expect(result.instances.map((item) => item.enhance)).toEqual([0, 1]);
  });

  it('空候选直接结束且不推进 RNG', () => {
    const rngState = 0x1020_3040;
    const originalWallet = wallet();
    const result = enhanceBatch(
      input({
        rngState,
        strategy: 'balanced',
        candidates: [],
        wallet: originalWallet,
      }),
    );

    expect(result.stopReason).toBe('no-candidates');
    expect(result.attempts).toEqual([]);
    expect(result.blocked).toEqual([]);
    expect(result.instances).toEqual([]);
    expect(result.wallet).toEqual(originalWallet);
    expect(result.wallet).not.toBe(originalWallet);
    expect(result.wallet.items).not.toBe(originalWallet.items);
    expect(result.nextRngState).toBe(rngState);
  });
});

describe('批量强化参数边界', () => {
  it('拒绝突破 1024 次硬上限和 single 多候选歧义', () => {
    expect(() =>
      enhanceBatch(
        input({
          maxAttempts: ENHANCE_BATCH_MAX_ATTEMPTS + 1,
        }),
      ),
    ).toThrow('maxAttempts');

    expect(() =>
      enhanceBatch(
        input({
          candidates: [candidate('a'), candidate('b')],
        }),
      ),
    ).toThrow('只能传入一件');
  });
});
