import { describe, expect, it } from 'vitest';
import type { EquipmentDef, EquipmentInstance } from '../types';
import { imprintCostOf, planImprint, type ImprintWallet } from '../equipmentImprint';
import {
  IMPRINT_CORE_ID,
  IMPRINT_CRYSTAL_COST,
  IMPRINT_CRYSTAL_IDS,
  IMPRINT_GOLD_PER_LEVEL,
} from '@/data/imprintRules';
import { ENHANCE_MAX } from '@/data/constants';

const SET = 'set_dungeon_azure';

function def(overrides: Partial<EquipmentDef> = {}): EquipmentDef {
  return {
    id: 'eq_test',
    name: '测试戒指',
    slot: 'ring',
    quality: 'epic',
    level: 30,
    icon: '',
    appearanceId: 'test-ring',
    ...overrides,
  } as EquipmentDef;
}

function inst(overrides: Partial<EquipmentInstance> = {}): EquipmentInstance {
  return {
    uid: 'e1',
    defId: 'eq_test',
    enhance: 5,
    baseRollPermille: 1100,
    enhanceGainPermille: Array<number>(ENHANCE_MAX)
      .fill(0)
      .map((_, i) => (i < 5 ? 80 : 0)),
    enhanceLuck: {},
    affixes: [{ key: 'atk', value: 20, tier: 4 }],
    reforgeResonance: 3,
    locked: true,
    ...overrides,
  };
}

function richWallet(): ImprintWallet {
  return { gold: 1_000_000, itemCount: () => 99 };
}

describe('烙印成本', () => {
  it('晶路径 6 晶，核路径 1 核 + 2 晶，金币随装备等级', () => {
    const normal = imprintCostOf(def(), SET, false)!;
    expect(normal.crystalId).toBe(IMPRINT_CRYSTAL_IDS.azure);
    expect(normal.crystals).toBe(IMPRINT_CRYSTAL_COST);
    expect(normal.cores).toBe(0);
    expect(normal.gold).toBe(30 * IMPRINT_GOLD_PER_LEVEL);

    const alt = imprintCostOf(def(), SET, true)!;
    expect(alt.cores).toBe(1);
    expect(alt.coreId).toBe(IMPRINT_CORE_ID);
    expect(alt.crystals).toBe(2);
  });

  it('非可烙套装（圣痕/区域套/乱写的）返回 null', () => {
    expect(imprintCostOf(def(), 'set_arena_sacred', false)).toBeNull();
    expect(imprintCostOf(def(), 'no-such-set', false)).toBeNull();
  });
});

describe('烙印计划', () => {
  it('四不原则：只写 imprintSetId，品质/胚子/词条/强化原样保留', () => {
    const before = inst();
    const plan = planImprint(def(), before, SET, true, richWallet(), false);
    expect(plan.ok).toBe(true);
    if (!plan.ok) return;
    expect(plan.nextInstance.imprintSetId).toBe(SET);
    // 除 imprintSetId 外逐字段一致，且不修改入参
    const { imprintSetId: _x, ...rest } = plan.nextInstance;
    const { imprintSetId: _y, ...restBefore } = before;
    expect(rest).toEqual(restBefore);
    expect(before.imprintSetId).toBeUndefined();
  });

  it('拒绝分支：定义级套装身份不可覆盖', () => {
    const plan = planImprint(
      def({ setId: 'set_dungeon_violet' }),
      inst(),
      SET,
      true,
      richWallet(),
      false,
    );
    expect(plan).toMatchObject({ ok: false, reason: 'def-set-conflict' });
  });

  it('拒绝分支：固定珍品 / 洗练候选未决 / 同款重烙 / 未解锁', () => {
    expect(
      planImprint(def({ fixedTemplate: true }), inst(), SET, true, richWallet(), false),
    ).toMatchObject({ ok: false, reason: 'fixed-template' });
    expect(
      planImprint(
        def(),
        inst({
          pendingAffixChange: { operation: 'reforge', affixIndex: 0, candidate: { key: 'def', value: 5, tier: 2 } },
        }),
        SET,
        true,
        richWallet(),
        false,
      ),
    ).toMatchObject({ ok: false, reason: 'pending-affix' });
    expect(
      planImprint(def(), inst({ imprintSetId: SET }), SET, true, richWallet(), false),
    ).toMatchObject({ ok: false, reason: 'already-imprinted-same' });
    expect(planImprint(def(), inst(), SET, false, richWallet(), false)).toMatchObject({
      ok: false,
      reason: 'set-locked',
    });
  });

  it('重烙成不同套装允许（覆盖、全价）', () => {
    const plan = planImprint(
      def(),
      inst({ imprintSetId: 'set_dungeon_violet' }),
      SET,
      true,
      richWallet(),
      false,
    );
    expect(plan.ok).toBe(true);
    if (plan.ok) expect(plan.nextInstance.imprintSetId).toBe(SET);
  });

  it('材料与金币不足分别拒绝，且给出完整成本供 UI 显示缺口', () => {
    const noCrystal = planImprint(
      def(),
      inst(),
      SET,
      true,
      { gold: 1_000_000, itemCount: () => 0 },
      false,
    );
    expect(noCrystal).toMatchObject({ ok: false, reason: 'materials' });
    if (!noCrystal.ok) expect(noCrystal.cost?.crystals).toBe(IMPRINT_CRYSTAL_COST);

    const noGold = planImprint(def(), inst(), SET, true, { gold: 0, itemCount: () => 99 }, false);
    expect(noGold).toMatchObject({ ok: false, reason: 'gold' });
  });
});

describe('部位归属守卫（防 resolver 抛错崩在装备栏）', () => {
  it('目标套装不含该部位时拒绝，而不是放行等 resolver 崩', () => {
    const plan = planImprint(
      def({ slot: 'ring' }),
      inst(),
      SET,
      true,
      richWallet(),
      false,
      ['weapon', 'head'], // 该套只覆盖两个部位
    );
    expect(plan).toMatchObject({ ok: false, reason: 'slot-not-in-set' });
  });

  it('部位在套装内正常放行', () => {
    const plan = planImprint(def({ slot: 'ring' }), inst(), SET, true, richWallet(), false, [
      'ring',
      'belt',
    ]);
    expect(plan.ok).toBe(true);
  });
});
