import { describe, it, expect } from 'vitest';
import {
  isOverCapacity,
  planBulkDecompose,
  planBulkLock,
  shouldAutoLock,
  trimBag,
  type TrimContext,
} from '../bag';
import type { Affix, Element, EquipmentInstance, EquipSlot, Quality } from '../types';

/** 造一件测试装备。value 直接当战力用，方便断言。 */
function mk(
  uid: string,
  opts: {
    slot?: EquipSlot;
    quality?: Quality;
    value?: number;
    locked?: boolean;
    enhance?: number;
    pending?: boolean;
    affixes?: Affix[];
    weaponElement?: Element;
  } = {},
): EquipmentInstance & { _v: number; _slot: EquipSlot; _q: Quality } {
  return {
    uid,
    defId: 'def_' + uid,
    enhance: opts.enhance ?? 0,
    affixes: opts.affixes ?? [{ key: 'atk', value: 1, tier: 1 }],
    ...(opts.pending
      ? {
          pendingAffixChange: {
            operation: 'temper',
            affixIndex: 0,
            candidate: { key: 'atk', value: 2, tier: 3 },
          },
        }
      : {}),
    locked: opts.locked ?? false,
    _v: opts.value ?? 1,
    _slot: opts.slot ?? 'weapon',
    _q: opts.quality ?? 'common',
    _element: opts.weaponElement,
  } as never;
}

const ctx: TrimContext = {
  valueOf: (i) => (i as never as { _v: number })._v,
  slotOf: (i) => (i as never as { _slot: EquipSlot })._slot,
  qualityOf: (i) => (i as never as { _q: Quality })._q,
  weaponElementOf: (i) => (i as never as { _element?: Element })._element,
};

describe('trimBag', () => {
  it('没超容量时原样返回', () => {
    const list = [mk('a'), mk('b')];
    const r = trimBag(list, 10, ctx);
    expect(r.removed).toEqual([]);
    expect(r.kept).toHaveLength(2);
  });

  it('容量为 0 或负数时不做任何裁剪（关闭上限）', () => {
    const list = [mk('a'), mk('b'), mk('c')];
    expect(trimBag(list, 0, ctx).removed).toEqual([]);
    expect(trimBag(list, -1, ctx).removed).toEqual([]);
  });

  it('超出容量时删掉战力最低的，删够为止', () => {
    const list = [
      mk('low', { value: 1, slot: 'weapon' }),
      mk('mid', { value: 5, slot: 'head' }),
      mk('high', { value: 9, slot: 'body' }),
      mk('low2', { value: 2, slot: 'weapon' }),
      mk('low3', { value: 3, slot: 'head' }),
    ];
    const r = trimBag(list, 3, ctx);
    expect(r.kept).toHaveLength(3);
    expect(r.removed).toHaveLength(2);
    // 被删的是 weapon 的次低件和 head 的次低件（每部位最高的受保护）
    expect(r.removed.map((e) => e.uid).sort()).toEqual(['low', 'low3']);
  });

  it('锁定的装备永不被自动分解', () => {
    const list = [
      mk('locked', { value: 1, locked: true, slot: 'weapon' }),
      mk('keepW', { value: 9, slot: 'weapon' }),
      mk('junk1', { value: 2, slot: 'head' }),
      mk('junk2', { value: 3, slot: 'head' }),
      mk('junk3', { value: 4, slot: 'head' }),
    ];
    const r = trimBag(list, 3, ctx);
    expect(r.removed.some((e) => e.uid === 'locked')).toBe(false);
    expect(r.kept.some((e) => e.uid === 'locked')).toBe(true);
  });

  it('已付费但待确认的洗练候选永不被容量裁剪', () => {
    const list = [
      mk('pending', { value: 1, pending: true, slot: 'weapon' }),
      mk('better-weapon', { value: 99, slot: 'weapon' }),
      mk('junk-head', { value: 2, slot: 'head' }),
      mk('better-head', { value: 98, slot: 'head' }),
    ];

    const result = trimBag(list, 2, ctx);

    expect(result.kept.map((item) => item.uid)).toContain('pending');
    expect(result.removed.map((item) => item.uid)).not.toContain('pending');
    expect(result.kept).toHaveLength(3);
  });

  it('史诗及以上永不被自动分解', () => {
    const list = [
      mk('epic', { value: 1, quality: 'epic', slot: 'ring' }),
      mk('legend', { value: 1, quality: 'legendary', slot: 'belt' }),
      mk('c1', { value: 5, slot: 'head' }),
      mk('c2', { value: 6, slot: 'head' }),
      mk('c3', { value: 7, slot: 'head' }),
    ];
    const r = trimBag(list, 3, ctx);
    const removedIds = r.removed.map((e) => e.uid);
    expect(removedIds).not.toContain('epic');
    expect(removedIds).not.toContain('legend');
  });

  it('每个部位至少保留战力最高的一件', () => {
    const list = [
      mk('w1', { value: 1, slot: 'weapon' }),
      mk('w2', { value: 9, slot: 'weapon' }),
      mk('h1', { value: 2, slot: 'head' }),
      mk('h2', { value: 8, slot: 'head' }),
      mk('b1', { value: 3, slot: 'body' }),
    ];
    const r = trimBag(list, 3, ctx);
    const keptIds = new Set(r.kept.map((e) => e.uid));
    expect(keptIds.has('w2')).toBe(true);
    expect(keptIds.has('h2')).toBe(true);
    expect(keptIds.has('b1')).toBe(true); // body 只有这一件，是该部位最高
  });

  it('低战力蓝装上的 T4/T5 战斗词条仍动态保留', () => {
    const list = [
      mk('slot-best', { value: 100, slot: 'ring' }),
      mk('reduce-t4', {
        value: 1,
        slot: 'ring',
        quality: 'rare',
        affixes: [{ key: 'dmgReduce', value: 2.2, tier: 4 }],
      }),
      mk('lifesteal-t5', {
        value: 2,
        slot: 'ring',
        quality: 'rare',
        affixes: [{ key: 'lifesteal', value: 2.8, tier: 5 }],
      }),
      mk('junk', { value: 3, slot: 'ring' }),
    ];

    const result = trimBag(list, 1, ctx);
    const kept = result.kept.map((item) => item.uid);
    expect(kept).toEqual(expect.arrayContaining(['slot-best', 'reduce-t4', 'lifesteal-t5']));
    expect(result.removed.map((item) => item.uid)).toContain('junk');
  });

  it('炎冰雷分别占一个动态保护组，不会互相覆盖', () => {
    const list = [
      mk('slot-best', { value: 100, slot: 'weapon' }),
      ...(['fire', 'ice', 'thunder'] as const).map((element, index) =>
        mk(element, {
          value: index + 1,
          slot: 'weapon',
          quality: 'fine',
          affixes: [{ key: 'elemDmg', value: 8 + index, tier: 4, element }],
        }),
      ),
      mk('junk', { value: 5, slot: 'weapon' }),
    ];

    const kept = trimBag(list, 1, ctx).kept.map((item) => item.uid);
    expect(kept).toEqual(expect.arrayContaining(['fire', 'ice', 'thunder']));
  });

  it('每种真实武器元素动态保留评分最高的一把，教学来源不会被清包', () => {
    const list = [
      mk('neutral-slot-best', { value: 100, slot: 'weapon', weaponElement: 'none' }),
      mk('fire-old', { value: 2, slot: 'weapon', quality: 'fine', weaponElement: 'fire' }),
      mk('fire-best', { value: 3, slot: 'weapon', quality: 'fine', weaponElement: 'fire' }),
      mk('ice-only', { value: 1, slot: 'weapon', quality: 'fine', weaponElement: 'ice' }),
      mk('junk', { value: 4, slot: 'weapon' }),
    ];

    const result = trimBag(list, 1, ctx);
    expect(result.kept.map((item) => item.uid)).toEqual([
      'neutral-slot-best',
      'fire-best',
      'ice-only',
    ]);
    expect(result.removed.map((item) => item.uid)).toEqual(
      expect.arrayContaining(['fire-old', 'junk']),
    );
  });

  it('通用与职业同用途合并成一个冠军，先比品阶、再比词条值、最后比装备评分', () => {
    const list = [
      mk('slot-best', { value: 100, slot: 'belt' }),
      mk('t4-high-value', {
        value: 90,
        slot: 'belt',
        affixes: [{ key: 'dmgReduce', value: 99, tier: 4 }],
      }),
      mk('t5-low-value', {
        value: 1,
        slot: 'belt',
        affixes: [{ key: 'dmgReduce', value: 1, tier: 5 }],
      }),
      mk('t5-better-value-low-cp', {
        value: 2,
        slot: 'belt',
        affixes: [{ key: 'dmgReduce', value: 2, tier: 5 }],
      }),
      mk('t5-better-value-high-cp', {
        value: 3,
        slot: 'belt',
        affixes: [{ key: 'sha_ward', value: 2, tier: 5 }],
      }),
    ];

    const result = trimBag(list, 1, ctx);
    expect(result.kept.map((item) => item.uid)).toEqual([
      'slot-best',
      't5-better-value-high-cp',
    ]);
  });

  it('T3、基础属性与待开放词条不占动态保护位', () => {
    const list = [
      mk('slot-best', { value: 100, slot: 'bracelet' }),
      mk('reduce-t3', {
        value: 1,
        slot: 'bracelet',
        affixes: [{ key: 'dmgReduce', value: 2.5, tier: 3 }],
      }),
      mk('atk-t5', {
        value: 2,
        slot: 'bracelet',
        affixes: [{ key: 'atk', value: 999, tier: 5 }],
      }),
      mk('skill-t5', {
        value: 3,
        slot: 'bracelet',
        affixes: [{ key: 'skillMul', value: 4, tier: 5 }],
      }),
    ];

    const result = trimBag(list, 1, ctx);
    expect(result.kept.map((item) => item.uid)).toEqual(['slot-best']);
  });

  it('全是受保护装备时宁可超出上限也不删', () => {
    const list = [
      mk('a', { quality: 'epic', slot: 'weapon' }),
      mk('b', { quality: 'epic', slot: 'head' }),
      mk('c', { locked: true, slot: 'body' }),
      mk('d', { quality: 'mythic', slot: 'ring' }),
    ];
    const r = trimBag(list, 1, ctx);
    expect(r.removed).toEqual([]);
    expect(r.kept).toHaveLength(4);
  });

  it('大批量裁剪结果精确到容量', () => {
    const list = Array.from({ length: 5000 }, (_, i) => mk('e' + i, { value: i, slot: 'weapon' }));
    const r = trimBag(list, 300, ctx);
    expect(r.kept).toHaveLength(300);
    expect(r.removed).toHaveLength(4700);
    // 保留的应该是战力最高的那批
    const keptValues = r.kept.map((e) => (e as never as { _v: number })._v);
    expect(Math.min(...keptValues)).toBe(4700);
  });

  // 回归测试：曾经在 sort 比较器里现算战力，
  // 1.5 万件会触发约 43 万次计算，直接把页面卡死。
  it('每件装备只计算一次战力（不能在排序比较器里现算）', () => {
    const list = Array.from({ length: 2000 }, (_, i) => mk('e' + i, { value: i % 97 }));
    let calls = 0;
    const countingCtx: TrimContext = {
      ...ctx,
      valueOf: (i) => {
        calls++;
        return ctx.valueOf(i);
      },
    };
    trimBag(list, 100, countingCtx);
    expect(calls).toBe(list.length);
  });

  it('不修改传入的数组', () => {
    const list = [mk('a', { value: 1 }), mk('b', { value: 2 }), mk('c', { value: 3 })];
    const copy = [...list];
    trimBag(list, 1, ctx);
    expect(list).toEqual(copy);
  });
});

describe('trimBag · autoDecomposeBelow 门槛选项（M4-12 设置页接线）', () => {
  it('缺省行为不变：白/绿/蓝可被自动分解，史诗及以上受保护', () => {
    const list = [
      mk('w1', { value: 1, quality: 'common', slot: 'head' }),
      mk('w2', { value: 2, quality: 'common', slot: 'head' }),
      mk('f1', { value: 3, quality: 'fine', slot: 'head' }),
      mk('r1', { value: 4, quality: 'rare', slot: 'head' }),
      mk('e1', { value: 5, quality: 'epic', slot: 'head' }),
    ];
    const r = trimBag(list, 2, ctx);
    expect(r.removed.length).toBeGreaterThan(0);
    expect(r.removed.some((e) => e.uid === 'e1')).toBe(false);
    expect(r.kept.some((e) => e.uid === 'e1')).toBe(true);
  });

  it("autoDecomposeBelow: 'common' 只删白装，蓝/绿受保护", () => {
    const list = [
      mk('w1', { value: 1, quality: 'common', slot: 'head' }),
      mk('w2', { value: 2, quality: 'common', slot: 'head' }),
      mk('f1', { value: 3, quality: 'fine', slot: 'head' }),
      mk('r1', { value: 4, quality: 'rare', slot: 'head' }),
      mk('keep-h', { value: 99, quality: 'fine', slot: 'head' }),
    ];
    const r = trimBag(list, 2, ctx, { autoDecomposeBelow: 'common' });
    expect(r.removed.map((e) => e.uid).sort()).toEqual(['w1', 'w2']);
    expect(r.kept.some((e) => e.uid === 'f1')).toBe(true);
    expect(r.kept.some((e) => e.uid === 'r1')).toBe(true);
  });

  it("autoDecomposeBelow: 'fine' 门槛含该品质：只删白+绿", () => {
    const list = [
      mk('w1', { value: 1, quality: 'common', slot: 'head' }),
      mk('w2', { value: 2, quality: 'common', slot: 'head' }),
      mk('f1', { value: 3, quality: 'fine', slot: 'head' }),
      mk('f2', { value: 4, quality: 'fine', slot: 'head' }),
      mk('r1', { value: 5, quality: 'rare', slot: 'head' }),
    ];
    const r = trimBag(list, 2, ctx, { autoDecomposeBelow: 'fine' });
    expect(r.removed.map((e) => e.uid).sort()).toEqual(['f1', 'w1', 'w2']);
    expect(r.kept.some((e) => e.uid === 'r1')).toBe(true);
  });

  it("autoDecomposeBelow: 'none' 关闭自动分解，宁可超容也不删", () => {
    const list = [
      mk('w1', { value: 1, quality: 'common', slot: 'head' }),
      mk('w2', { value: 2, quality: 'common', slot: 'head' }),
      mk('f1', { value: 3, quality: 'fine', slot: 'head' }),
      mk('r1', { value: 4, quality: 'rare', slot: 'head' }),
    ];
    const r = trimBag(list, 2, ctx, { autoDecomposeBelow: 'none' });
    expect(r.removed).toEqual([]);
    expect(r.kept).toHaveLength(4);
  });
});

describe('isOverCapacity', () => {
  it('容量为 0 视为不限制', () => {
    expect(isOverCapacity(9999, 0)).toBe(false);
  });

  it('等于容量不算超出', () => {
    expect(isOverCapacity(300, 300)).toBe(false);
    expect(isOverCapacity(301, 300)).toBe(true);
  });
});

describe('planBulkDecompose', () => {
  it('只选择玩家明确勾选的品质，并支持蓝色及以上全部品质', () => {
    const qualities: Quality[] = [
      'common',
      'fine',
      'rare',
      'epic',
      'legendary',
      'mythic',
      'prismatic',
      'divine',
    ];
    const list = qualities.map((quality) => mk(quality, { quality }));

    const blueAndAbove = planBulkDecompose(list, qualities.slice(2), false, ctx.qualityOf);

    expect(blueAndAbove.targets.map((item) => item.uid)).toEqual(qualities.slice(2));
  });

  it('锁定装备永不进入分解计划', () => {
    const list = [
      mk('normal', { quality: 'rare' }),
      mk('locked', { quality: 'rare', locked: true }),
    ];

    const plan = planBulkDecompose(list, ['rare'], true, ctx.qualityOf);

    expect(plan.targets.map((item) => item.uid)).toEqual(['normal']);
    expect(plan.protectedLocked).toBe(1);
  });

  it('待确认洗练候选不受强化许可影响，始终从批量分解计划中硬拒绝', () => {
    const list = [
      mk('normal', { quality: 'rare' }),
      mk('pending', { quality: 'rare', pending: true, enhance: 7 }),
    ];

    const plan = planBulkDecompose(list, ['rare'], true, ctx.qualityOf);

    expect(plan.targets.map((item) => item.uid)).toEqual(['normal']);
    expect(plan.protectedPending).toBe(1);
    expect(plan.protectedEnhanced).toBe(0);
  });

  it('默认保护强化装备，只有明确许可后才纳入', () => {
    const list = [
      mk('plain', { quality: 'rare' }),
      mk('enhanced', { quality: 'rare', enhance: 7 }),
    ];

    const protectedPlan = planBulkDecompose(list, ['rare'], false, ctx.qualityOf);
    const allowedPlan = planBulkDecompose(list, ['rare'], true, ctx.qualityOf);

    expect(protectedPlan.targets.map((item) => item.uid)).toEqual(['plain']);
    expect(protectedPlan.protectedEnhanced).toBe(1);
    expect(allowedPlan.targets.map((item) => item.uid)).toEqual(['plain', 'enhanced']);
  });

  it('品质定义缺失时跳过，并且不修改传入数组', () => {
    const list = [mk('known', { quality: 'rare' }), mk('unknown', { quality: 'rare' })];
    const before = [...list];

    const plan = planBulkDecompose(list, ['rare'], false, (item) =>
      item.uid === 'unknown' ? undefined : ctx.qualityOf(item),
    );

    expect(plan.targets.map((item) => item.uid)).toEqual(['known']);
    expect(list).toEqual(before);
  });
});

describe('自动上锁门槛', () => {
  it('传说及以上一律上锁，奇迹胚子把门槛下调到史诗', () => {
    expect(shouldAutoLock('legendary', false)).toBe(true);
    expect(shouldAutoLock('mythic', false)).toBe(true);
    expect(shouldAutoLock('divine', false)).toBe(true);
    expect(shouldAutoLock('epic', true)).toBe(true);
    expect(shouldAutoLock('epic', false)).toBe(false);
  });

  it('蓝装及以下即使摇到奇迹胚子也不上锁', () => {
    // 原规则会把它们永久锁死：锁定是 trimBag 的硬保护，背包再也清不掉
    expect(shouldAutoLock('common', true)).toBe(false);
    expect(shouldAutoLock('fine', true)).toBe(false);
    expect(shouldAutoLock('rare', true)).toBe(false);
  });
});

describe('批量锁定 / 解锁', () => {
  const qualityOf = (inst: EquipmentInstance) =>
    (inst as EquipmentInstance & { _q: Quality })._q;

  it('只挑选中品质里状态需要改变的装备', () => {
    const bag = [
      mk('a', { quality: 'legendary', locked: false }),
      mk('b', { quality: 'legendary', locked: true }),
      mk('c', { quality: 'rare', locked: false }),
    ];
    const plan = planBulkLock(bag, ['legendary'], true, qualityOf);
    expect(plan.targets.map((inst) => inst.uid)).toEqual(['a']);
    expect(plan.alreadyInState).toBe(1);
  });

  it('解锁会跳过穿戴中的装备', () => {
    const bag = [
      mk('worn', { quality: 'legendary', locked: true }),
      mk('spare', { quality: 'legendary', locked: true }),
    ];
    // 解锁通常是为了紧接着批量分解，把身上正穿的一起放开等于给自己挖坑
    const plan = planBulkLock(bag, ['legendary'], false, qualityOf, (inst) => inst.uid === 'worn');
    expect(plan.targets.map((inst) => inst.uid)).toEqual(['spare']);
    expect(plan.skippedEquipped).toBe(1);
  });

  it('上锁不跳过穿戴中的装备', () => {
    const bag = [mk('worn', { quality: 'legendary', locked: false })];
    const plan = planBulkLock(bag, ['legendary'], true, qualityOf, () => true);
    expect(plan.targets.map((inst) => inst.uid)).toEqual(['worn']);
    expect(plan.skippedEquipped).toBe(0);
  });
});
