/**
 * 等级结构上限（2026-08-01，小榜 06:20 报的 39 级空档）。
 *
 * 背景：`level` 是战力上界与试炼伤害上界的**自变量**，而它由客户端上报、
 * 服务端只做范围校验。所以那个范围就是整条防线的宽度 ——
 * `sync-profile` 原本写的是 `max(120)`，而玩家实际能到 81，中间 39 级随便报。
 */

import { describe, expect, it } from 'vitest';
import { STAGE_LIST } from '@/data/stages';
import { EQUIPMENT } from '@/data/equipment';
import { LEVEL_SOFT_CAP_MARGIN } from '@/data/constants';
import { levelSoftCap } from '../progression';
import { isStructurallyPossibleLevel, STRUCTURAL_MAX_LEVEL } from '../levelCap';

const highestStageLevel = STAGE_LIST.reduce((max, s) => (s.level > max ? s.level : max), 1);

describe('等级结构上限', () => {
  it('★ 是从关卡数据推出来的，不是写死的数字', () => {
    // 这条断言的重点不是「等于 81」，而是「等于 levelSoftCap(内容顶)」——
    // 区域 8 一上线内容顶就变，写死 81 会把**合法玩家**挡在门外。
    expect(STRUCTURAL_MAX_LEVEL).toBe(levelSoftCap(highestStageLevel));
    expect(STRUCTURAL_MAX_LEVEL).toBe(highestStageLevel + LEVEL_SOFT_CAP_MARGIN);
  });

  it('内容顶等级本身合法，再高一级就不可能', () => {
    expect(isStructurallyPossibleLevel(STRUCTURAL_MAX_LEVEL)).toBe(true);
    expect(isStructurallyPossibleLevel(STRUCTURAL_MAX_LEVEL + 1)).toBe(false);
  });

  it('★ 线上那两行 level=100 的档案，按这条判据是不可能的', () => {
    // 它们是 2026-07-30 客户端还能直写 profiles 时留下的。
    // 这条断言的作用是：将来谁把上限调宽到能容下 100，会先看到这行注释。
    expect(isStructurallyPossibleLevel(100)).toBe(false);
  });

  it('★ 钳制不会让任何合法装备失效 —— 最高装备等级不得超过本上限', () => {
    // sync-profile 把超限等级**钳制**到本上限而不是拒绝（拒绝会把线上那两行
    // level=100 的档案永久锁死）。钳制的前提是「装备等级 ≤ 角色等级」这条校验
    // 在钳制后对真人依然成立 —— 也就是没有任何装备定义高于本上限。
    // 内容一旦加入高于上限的装备，这条会红，那时钳制就不再安全。
    const highest = Math.max(...Object.values(EQUIPMENT).map((d) => d.level));
    expect(
      highest,
      `最高装备定义 Lv${highest} 超过了结构等级上限 Lv${STRUCTURAL_MAX_LEVEL}：
` +
        `sync-profile 的等级钳制会让穿着它的真人触发「装备等级超过角色等级」而被拒。
` +
        `要么抬上限，要么把钳制改成别的形态 —— 但**不要改成直接拒绝**，理由见该函数注释。`,
    ).toBeLessThanOrEqual(STRUCTURAL_MAX_LEVEL);
  });

  it('拒绝非整数、零、负数', () => {
    expect(isStructurallyPossibleLevel(0)).toBe(false);
    expect(isStructurallyPossibleLevel(-1)).toBe(false);
    expect(isStructurallyPossibleLevel(1.5)).toBe(false);
    expect(isStructurallyPossibleLevel(Number.NaN)).toBe(false);
    expect(isStructurallyPossibleLevel(Number.POSITIVE_INFINITY)).toBe(false);
  });

  it('Lv1 合法 —— 上限收紧不能顺手把新手挡在外面', () => {
    expect(isStructurallyPossibleLevel(1)).toBe(true);
  });

  it('★ 上限只增不减 —— 缩内容会让已经超过新上限的真人永久同步不上去', () => {
    // 2026-08-01 的值。这条守的是**反方向**：
    // 上限跟着内容涨是安全的（新玩家慢慢够到），**跌不是** ——
    // 已经在 Lv81 的玩家会被 sync-profile 的载荷校验直接 400，
    // 而且每次打开排行榜都失败，提示还是一句笼统的「搭配快照不合法」。
    // 那正是「用一条防作弊的线把老实玩家锁在门外」，红线在 docs/65。
    //
    // 要调低就改这个数字，但**先处理 profiles 里超过新上限的行**
    // （线上现在就有两行 level=100，是别的原因来的，一并考虑）。
    expect(STRUCTURAL_MAX_LEVEL).toBeGreaterThanOrEqual(81);
  });

  it('★ 上限必须真的比原来那个 120 紧，否则这次修复等于没做', () => {
    // 不是为了断言某个具体数字，是为了钉住「这次收紧确实发生了」。
    // 万一将来内容扩到 Lv120 以上，这条会红 —— 那时请连同本注释一起重写，
    // 因为那时「120」不再是一个空档，而是真实内容。
    expect(STRUCTURAL_MAX_LEVEL).toBeLessThan(120);
  });
});
