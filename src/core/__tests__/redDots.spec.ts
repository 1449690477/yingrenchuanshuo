import { describe, expect, it } from 'vitest';
import { ENHANCE_MATERIAL_IDS, ENHANCE_MAX } from '@/data/constants';
import {
  countPendingAffix,
  evaluateRedDots,
  isEnhanceable,
  type EnhanceableWallet,
  type RedDotSnapshot,
} from '../redDots';
import type { EquipmentInstance, EquipSlot, PendingAffixChange } from '../types';

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

function pendingAffix(): PendingAffixChange {
  return {
    operation: 'temper',
    affixIndex: 0,
    candidate: { key: 'atk', value: 3, tier: 3 },
  };
}

function wallet(overrides: Partial<EnhanceableWallet> = {}): EnhanceableWallet {
  return {
    gold: 1_000_000_000,
    items: {
      [ENHANCE_MATERIAL_IDS.stone]: 1_000_000,
      [ENHANCE_MATERIAL_IDS.ore]: 1_000_000,
      [ENHANCE_MATERIAL_IDS.lucky]: 1_000_000,
    },
    ...overrides,
  };
}

function snapshot(overrides: Partial<RedDotSnapshot> = {}): RedDotSnapshot {
  return {
    staminaClaimRemaining: 0,
    pendingEncounterCount: 0,
    pendingAffixCount: 0,
    enhanceableEquipped: 0,
    skillUpgradeable: 0,
    dungeonAttemptsRemaining: 0,
    affectionInteractionsRemaining: 0,
    hasUnsyncedProgress: false,
    pendingMilestoneCount: 0,
    guildClaimableCount: 0,
    hasClaimableMail: false,
    dailyTierClaimable: false,
    ...overrides,
  };
}

describe('isEnhanceable', () => {
  it('未满级且资源足够 → 可强化', () => {
    expect(isEnhanceable(instance('a'), 20, wallet())).toBe(true);
  });

  it('满级（ENHANCE_MAX）→ 不可强化', () => {
    expect(isEnhanceable(instance('a', ENHANCE_MAX), 20, wallet())).toBe(false);
  });

  it('有待确认洗练结果 → 不可强化', () => {
    expect(
      isEnhanceable(instance('a', 0, { pendingAffixChange: pendingAffix() }), 20, wallet()),
    ).toBe(false);
  });

  it('金币不足 → 不可强化', () => {
    expect(isEnhanceable(instance('a'), 20, wallet({ gold: 0 }))).toBe(false);
  });

  it('强化石不足 → 不可强化', () => {
    expect(
      isEnhanceable(
        instance('a'),
        20,
        wallet({ items: { [ENHANCE_MATERIAL_IDS.stone]: 0 } }),
      ),
    ).toBe(false);
  });

  it('高段强化（+15 需精铁矿与幸运石）缺资源 → 不可强化', () => {
    const highLevel = instance('a', ENHANCE_MAX - 1);
    const emptyOre = wallet({
      items: { [ENHANCE_MATERIAL_IDS.stone]: 1_000, [ENHANCE_MATERIAL_IDS.lucky]: 1_000 },
    });
    expect(isEnhanceable(highLevel, 20, emptyOre)).toBe(false);

    const emptyLucky = wallet({
      items: { [ENHANCE_MATERIAL_IDS.stone]: 1_000, [ENHANCE_MATERIAL_IDS.ore]: 1_000 },
    });
    expect(isEnhanceable(highLevel, 20, emptyLucky)).toBe(false);
  });
});

describe('countPendingAffix', () => {
  it('穿戴与背包中待确认的件数都会被数到', () => {
    const equipped: Partial<Record<EquipSlot, EquipmentInstance | null>> = {
      weapon: instance('w', 0, { pendingAffixChange: pendingAffix() }),
      head: instance('a'),
    };
    const bag = [
      instance('b1', 0, { pendingAffixChange: pendingAffix() }),
      instance('b2'),
    ];
    expect(countPendingAffix(equipped, bag)).toBe(2);
  });

  it('空槽与空背包 → 0', () => {
    expect(countPendingAffix({}, [])).toBe(0);
  });
});

describe('evaluateRedDots', () => {
  it('全部来源为空 → 六个 tab 全灭', () => {
    expect(evaluateRedDots(snapshot())).toEqual({
      idle: false,
      bag: false,
      growth: false,
      dungeon: false,
      rank: false,
      more: false,
    });
  });

  it('体力补给可领 → idle 亮', () => {
    expect(evaluateRedDots(snapshot({ staminaClaimRemaining: 1 })).idle).toBe(true);
  });

  it('日常宝箱可领 → idle 亮（M4-1 信息型布尔）', () => {
    const r = evaluateRedDots(snapshot({ dailyTierClaimable: true }));
    expect(r.idle).toBe(true);
    expect(r.bag).toBe(false);
    expect(r.growth).toBe(false);
  });

  it('日常宝箱不可领且其他来源为空 → idle 灭', () => {
    expect(evaluateRedDots(snapshot({ dailyTierClaimable: false })).idle).toBe(false);
  });

  it('奇遇待处理 → idle 亮', () => {
    expect(evaluateRedDots(snapshot({ pendingEncounterCount: 1 })).idle).toBe(true);
  });

  it('待确认洗练 → bag 亮', () => {
    expect(evaluateRedDots(snapshot({ pendingAffixCount: 1 })).bag).toBe(true);
  });

  it('可强化或技能可升级任一成立 → growth 亮', () => {
    expect(evaluateRedDots(snapshot({ enhanceableEquipped: 1 })).growth).toBe(true);
    expect(evaluateRedDots(snapshot({ skillUpgradeable: 1 })).growth).toBe(true);
  });

  it('副本剩余次数 > 0 → dungeon 亮', () => {
    expect(evaluateRedDots(snapshot({ dungeonAttemptsRemaining: 1 })).dungeon).toBe(true);
  });

  it('未同步进度或好感可互动 → rank 亮', () => {
    expect(evaluateRedDots(snapshot({ hasUnsyncedProgress: true })).rank).toBe(true);
    expect(evaluateRedDots(snapshot({ affectionInteractionsRemaining: 1 })).rank).toBe(true);
  });

  it('里程碑待上报 → rank 亮', () => {
    expect(evaluateRedDots(snapshot({ pendingMilestoneCount: 1 })).rank).toBe(true);
  });

  it('公会可领取数 > 0 → more 亮', () => {
    expect(evaluateRedDots(snapshot({ guildClaimableCount: 1 })).more).toBe(true);
  });

  it('邮箱有可领取附件 → more 亮（M4-5 信息型布尔）', () => {
    expect(evaluateRedDots(snapshot({ hasClaimableMail: true })).more).toBe(true);
  });

  it('多个来源同时成立 → 多个 tab 同时亮', () => {
    const state = evaluateRedDots(
      snapshot({ staminaClaimRemaining: 2, pendingAffixCount: 1, dungeonAttemptsRemaining: 3 }),
    );
    expect(state.idle).toBe(true);
    expect(state.bag).toBe(true);
    expect(state.dungeon).toBe(true);
    expect(state.growth).toBe(false);
    expect(state.rank).toBe(false);
    expect(state.more).toBe(false);
  });
});
