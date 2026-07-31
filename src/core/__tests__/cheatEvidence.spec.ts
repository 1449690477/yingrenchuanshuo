import { describe, expect, it } from 'vitest';
import {
  VERSION_SKEW_IMMUNE,
  CHEAT_FIELD_LABELS,
  EXTREME_OVERAGE,
  PUBLISH_MIN_OVERAGE,
  describeCheatEvidence,
  describeInputFault,
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

describe('作弊证据分级 · 我方判据故障与「玩家清白」必须可区分', () => {
  // 这一组守的是 2026-07-31 的真实教训：
  // 「被判定为不可信」与「压根没被判过」在库里长得一模一样，
  // 于是恰恰在我方尺子算坏了的时候，用来发现它的仪器是瞎的。
  it('玩家清白时 inputFault 为空 —— 清白就该安静', () => {
    const v = input({ claimedValue: 99, boundValue: 100 });
    expect(v.isProven).toBe(false);
    expect(v.inputFault).toBeNull();
  });

  it('报值为负：判为我方故障而非玩家清白，且仍然不落库不公示', () => {
    const v = input({ claimedValue: -5, boundValue: 100 });
    expect(v.inputFault).toBe('claimed-negative');
    expect(v.isProven).toBe(false);
    expect(v.shouldPublish).toBe(false);
  });

  it('界限 ≤ 0：上界函数自身失效，同样报我方故障', () => {
    expect(input({ claimedValue: 1, boundValue: 0 }).inputFault).toBe('bound-non-positive');
    expect(input({ claimedValue: 1, boundValue: -1 }).inputFault).toBe('bound-non-positive');
  });

  it('非有限数按来源分开报，便于日志直接指出坏的是哪一侧', () => {
    expect(input({ claimedValue: Number.NaN }).inputFault).toBe('claimed-not-finite');
    expect(input({ claimedValue: Number.POSITIVE_INFINITY }).inputFault).toBe('claimed-not-finite');
    expect(input({ boundValue: Number.NaN }).inputFault).toBe('bound-not-finite');
  });

  it('★ 任何带 inputFault 的判定都绝不可公示 —— 坏尺子不许用来量玩家', () => {
    const faults = [
      { claimedValue: Number.NaN, boundValue: 100 },
      { claimedValue: 100, boundValue: Number.NaN },
      { claimedValue: -1, boundValue: 100 },
      { claimedValue: 100, boundValue: 0 },
    ];
    for (const f of faults) {
      // priorEvidenceCount 拉高、倍率拉到极端也不能把它推上榜
      const v = input({ ...f, priorEvidenceCount: 99 });
      expect(v.inputFault).not.toBeNull();
      expect(v.shouldPublish).toBe(false);
      expect(v.isProven).toBe(false);
    }
  });

  it('构成证据的各支 inputFault 恒为空 —— 别把正常判定误报成我方故障', () => {
    expect(input({ claimedValue: 300, boundValue: 100 }).inputFault).toBeNull();
    expect(input({ claimedValue: 1e6, boundValue: 100 }).inputFault).toBeNull();
    expect(input({ claimField: 'equipment_affix', claimedValue: 1e6 }).inputFault).toBeNull();
  });

  it('故障日志以「判据异常」开头，读日志的人第一眼就知道不是抓到了谁', () => {
    const line = describeInputFault({
      fault: 'claimed-negative',
      claimField: 'combat_power',
      claimedValue: -12,
      boundValue: 100,
    });
    expect(line.startsWith('判据异常')).toBe(true);
    expect(line).toContain('我方故障');
    expect(line).toContain('战力');
    expect(line).toContain('-12');
    expect(line).not.toContain('作弊');
  });
});
