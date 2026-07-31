import { describe, expect, it } from 'vitest';
import {
  VERSION_SKEW_IMMUNE,
  CHEAT_FIELD_LABELS,
  EXTREME_OVERAGE,
  PUBLISH_MIN_OVERAGE,
  describeCheatEvidence,
  judgeCheatEvidence,
} from '../cheatEvidence';

/** 默认输入：上界方向、无历史证据。各用例只覆写自己关心的字段。 */
function input(over: Partial<Parameters<typeof judgeCheatEvidence>[0]> = {}) {
  return judgeCheatEvidence({
    source: 'sync-profile',
    claimField: 'combat_power',
    claimedValue: 100,
    boundValue: 100,
    boundKind: 'upper',
    priorEvidenceCount: 0,
    ...over,
  });
}

describe('作弊证据分级 · 闸门一：只认物理越界', () => {
  it('刚好等于上界的不构成证据 —— 满配肝帝就在这条线上', () => {
    expect(input({ claimedValue: 100, boundValue: 100 }).isProven).toBe(false);
  });

  it('低于上界的不构成证据', () => {
    expect(input({ claimedValue: 99.9, boundValue: 100 }).isProven).toBe(false);
  });

  it('非有限数不构成证据（客户端 bug 不该被当成作弊）', () => {
    expect(input({ claimedValue: Number.NaN }).isProven).toBe(false);
    expect(input({ claimedValue: Number.POSITIVE_INFINITY }).isProven).toBe(false);
    expect(input({ boundValue: Number.NaN }).isProven).toBe(false);
  });

  it('界限非正时不构成证据 —— 除法得不到有意义的倍率', () => {
    expect(input({ boundValue: 0, claimedValue: 1 }).isProven).toBe(false);
    expect(input({ boundValue: -1, claimedValue: 1 }).isProven).toBe(false);
  });
});

describe('作弊证据分级 · 闸门二：版本漂移余量', () => {
  it('超出但不足 2 倍：记录但不公开 —— 这正是 Edge 未重打包时合法新装备的形态', () => {
    const verdict = input({ claimedValue: 130, boundValue: 100 });
    expect(verdict.isProven).toBe(true);
    expect(verdict.overageRatio).toBeCloseTo(1.3);
    expect(verdict.shouldPublish).toBe(false);
    expect(verdict.holdReason).toBe('below-margin');
  });

  it('恰好 2 倍且有第二条证据时公开', () => {
    const verdict = input({
      claimedValue: 100 * PUBLISH_MIN_OVERAGE,
      boundValue: 100,
      priorEvidenceCount: 1,
    });
    expect(verdict.shouldPublish).toBe(true);
  });
});

describe('作弊证据分级 · 闸门三：重复或极端', () => {
  it('首次 2~10 倍：只记录，等第二条', () => {
    const verdict = input({ claimedValue: 500, boundValue: 100, priorEvidenceCount: 0 });
    expect(verdict.isProven).toBe(true);
    expect(verdict.shouldPublish).toBe(false);
    expect(verdict.holdReason).toBe('awaiting-second-evidence');
  });

  it('第二次 2~10 倍：公开', () => {
    const verdict = input({ claimedValue: 500, boundValue: 100, priorEvidenceCount: 1 });
    expect(verdict.shouldPublish).toBe(true);
    expect(verdict.holdReason).toBe('none');
  });

  it('单次超 10 倍：立刻公开，不必等第二次', () => {
    const verdict = input({
      claimedValue: 100 * EXTREME_OVERAGE,
      boundValue: 100,
      priorEvidenceCount: 0,
    });
    expect(verdict.shouldPublish).toBe(true);
  });

  it('填 999999999 这种当场公开', () => {
    const verdict = input({ claimedValue: 999_999_999, boundValue: 47_210 });
    expect(verdict.shouldPublish).toBe(true);
    expect(verdict.overageRatio).toBeGreaterThan(1000);
  });
});

describe('作弊证据分级 · 下界方向（秘境用时越小越强）', () => {
  it('用时高于物理下限属正常', () => {
    const verdict = input({
      claimField: 'dungeon_duration',
      boundKind: 'lower',
      claimedValue: 12_000,
      boundValue: 8_400,
    });
    expect(verdict.isProven).toBe(false);
  });

  it('用时远低于物理下限：倍率按 界限/报值 算并公开', () => {
    const verdict = input({
      claimField: 'dungeon_duration',
      boundKind: 'lower',
      claimedValue: 100,
      boundValue: 8_400,
    });
    expect(verdict.isProven).toBe(true);
    expect(verdict.overageRatio).toBeCloseTo(84);
    expect(verdict.shouldPublish).toBe(true);
  });

  it('报 0 用时属结构性伪造，按极端处理而不是除零', () => {
    const verdict = input({
      claimField: 'dungeon_duration',
      boundKind: 'lower',
      claimedValue: 0,
      boundValue: 8_400,
    });
    expect(verdict.isProven).toBe(true);
    expect(Number.isFinite(verdict.overageRatio)).toBe(true);
    expect(verdict.shouldPublish).toBe(true);
  });

  it('用时略低于下限（1.2 倍）不公开 —— 帧对齐口径差异不该点名', () => {
    const verdict = input({
      claimField: 'dungeon_duration',
      boundKind: 'lower',
      claimedValue: 7_000,
      boundValue: 8_400,
    });
    expect(verdict.shouldPublish).toBe(false);
  });
});

describe('作弊证据分级 · 闸门零：版本漂移敏感判据不自动公开', () => {
  it('词条不符合生成公式：即便超 1000 倍也只记录不公开', () => {
    const verdict = input({
      claimField: 'equipment_affix',
      claimedValue: 100_000,
      boundValue: 100,
      priorEvidenceCount: 5,
    });
    expect(verdict.isProven).toBe(true);
    expect(verdict.shouldPublish).toBe(false);
    expect(verdict.holdReason).toBe('version-skew-sensitive');
  });

  it('免疫判据在同样倍率下则会公开 —— 两者的区别只在判据本身', () => {
    const verdict = input({ claimField: 'combat_power', claimedValue: 100_000, boundValue: 100 });
    expect(verdict.shouldPublish).toBe(true);
  });

  it('免疫表覆盖全部可判定字段，新增字段必须显式表态', () => {
    for (const field of Object.keys(CHEAT_FIELD_LABELS) as (keyof typeof CHEAT_FIELD_LABELS)[]) {
      expect(typeof VERSION_SKEW_IMMUNE[field]).toBe('boolean');
    }
  });
});

describe('封神榜文案', () => {
  it('上界方向三段齐全：改了什么、报了多少、上限多少、超几倍', () => {
    const text = describeCheatEvidence({
      claimField: 'combat_power',
      claimedValue: 999_999_999,
      boundValue: 47_210,
      boundKind: 'upper',
      overageRatio: 21_178,
    });
    expect(text).toContain('战力');
    expect(text).toContain('999,999,999');
    expect(text).toContain('47,210');
    expect(text).toContain('倍');
  });

  it('下界方向不写「超几倍」，写物理下限', () => {
    const text = describeCheatEvidence({
      claimField: 'dungeon_duration',
      claimedValue: 3,
      boundValue: 8_400,
      boundKind: 'lower',
      overageRatio: 2800,
    });
    expect(text).toContain('秘境用时');
    expect(text).toContain('物理下限');
    expect(text).not.toContain('超');
  });

  it('每个可判定字段都有中文名 —— 榜上不许出现英文字段名', () => {
    for (const label of Object.values(CHEAT_FIELD_LABELS)) {
      expect(label).toMatch(/[一-龥]/);
    }
  });
});
