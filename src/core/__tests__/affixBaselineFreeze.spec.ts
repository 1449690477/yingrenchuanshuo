/**
 * 改词条基准必须配套登记历史 —— 这条纪律此前只写在函数注释里，没有守卫。
 *
 * 2026-08-02 两套独立的平衡方案**同时**踩中同一个坑：改了 `sha_spirit` 基准，
 * 没登记旧基准，落地后线上灵巫老玩家会被 submit-trial 用 400 拒收。
 * 两套都跑过 `npm run verify` 与 `npm run sim` 全绿 —— 因为现有测试
 * **全部是「当前公式生成、当前公式校验」的自洽同版检查**，
 * 无论基准改成多少都不会红。
 */

import { describe, expect, it } from 'vitest';
import { AFFIX_POOL, PROFESSION_AFFIX_POOLS } from '@/data/constants';
import { affixValueRange, isVerifiablePersistedAffixValue } from '../equipment';
import { FROZEN_AFFIX_BASELINES } from '../affixBaselineFreeze';
import type { AffixKey, AffixTier } from '../types';

function currentBaselines(): Map<string, readonly [number, number]> {
  const out = new Map<string, readonly [number, number]>();
  for (const entry of AFFIX_POOL) out.set(entry.key, [entry.min, entry.max]);
  for (const pool of Object.values(PROFESSION_AFFIX_POOLS)) {
    for (const entry of pool) out.set(entry.key, [entry.min, entry.max]);
  }
  return out;
}

describe('词条基准冻结', () => {
  it('★ 基准值一改就红 —— 改之前先读 affixBaselineFreeze.ts 文件头的三步', () => {
    const current = currentBaselines();
    const drifted: string[] = [];
    for (const [key, [min, max]] of current) {
      const frozen = FROZEN_AFFIX_BASELINES[key];
      if (!frozen) continue; // 新增键由下面那条管
      if (frozen[0] !== min || frozen[1] !== max) {
        drifted.push(`  ${key}: [${frozen[0]}, ${frozen[1]}] -> [${min}, ${max}]`);
      }
    }
    expect(
      drifted,
      `以下词条的基准被改了：\n${drifted.join('\n')}\n\n` +
        '★ 这是破坏性改动：线上老玩家身上按旧基准掉落的装备，其词条值会落在新值域之外，\n' +
        '  isVerifiablePersistedAffixValue 返回 false，submit-trial 直接 400 拒收整条提交，\n' +
        '  玩家交不了试炼成绩且自己修不了。\n\n' +
        '**不要只把 affixBaselineFreeze.ts 里的数字改成新值** —— 那只会让这条测试闭嘴，\n' +
        '线上缺陷原样留着。正确顺序见该文件头：先登记旧基准到 legacyAffixHistory，\n' +
        '再补「老值域边界值仍可验证」的测试，最后才更新冻结表。\n' +
        '另外改基准通常还要把 CP_FORMULA_VERSION +1（旧装备算出的战力变了）。',
    ).toEqual([]);
  });

  it('新增词条键必须同时登记进冻结表 —— 否则下次它被改时没有基线可比', () => {
    const missing = [...currentBaselines().keys()].filter(
      (key) => FROZEN_AFFIX_BASELINES[key] === undefined,
    );
    expect(
      missing,
      `以下词条键不在冻结表里：${missing.join(', ')}\n` +
        '请把它当前的 [min, max] 加进 src/core/affixBaselineFreeze.ts。\n' +
        '新增键本身不是破坏性改动（老存档里不存在它），但不登记的话，\n' +
        '**将来有人改它的基准时这条守卫是瞎的**。',
    ).toEqual([]);
  });

  it('冻结表里不该有已经不存在的键 —— 删键同样是破坏性改动', () => {
    const current = currentBaselines();
    const orphans = Object.keys(FROZEN_AFFIX_BASELINES).filter((key) => !current.has(key));
    expect(
      orphans,
      `冻结表里这些键在当前词条池里找不到：${orphans.join(', ')}\n` +
        '删掉一个词条键会让老玩家装备上的该词条无法验证（同样 400）。\n' +
        '若确属有意删除，请先确认存档迁移已把它从旧装备上移除。',
    ).toEqual([]);
  });

  it('★ 冻结的基准确实就是当前公式在用的那个 —— 防止这张表变成一份没人读的摆设', () => {
    // 只对齐一下量纲：拿冻结基准手算出的 T1 值域，应与 affixValueRange 一致。
    // 若某天基准的取用方式变了（例如不再取 min/max 中值），这条会红，
    // 提醒维护者这张冻结表已经不再代表真实基准。
    const probe: AffixKey = 'sha_spirit';
    const frozen = FROZEN_AFFIX_BASELINES[probe];
    expect(frozen, '探针键不在冻结表里').toBeDefined();
    const range = affixValueRange(probe, 40, 1 as AffixTier);
    expect(range.min).toBeGreaterThan(0);
    expect(range.max).toBeGreaterThanOrEqual(range.min);
  });

  it('★ 当前基准掉出来的值，当前校验必须认 —— 这条钉的是「同版自洽」这一半', () => {
    // 它单独存在时抓不到基准漂移（那正是本文件第一条的职责），
    // 但它保证冻结表与校验链没有各自演化：任何一边坏了这条都会红。
    for (const level of [1, 40, 81]) {
      for (const tier of [1, 3, 5] as AffixTier[]) {
        for (const key of Object.keys(FROZEN_AFFIX_BASELINES) as AffixKey[]) {
          const range = affixValueRange(key, level, tier);
          for (const value of [range.min, range.max]) {
            expect(
              isVerifiablePersistedAffixValue(key, level, tier, value),
              `${key} Lv${level} T${tier} 的边界值 ${value} 通不过当前校验`,
            ).toBe(true);
          }
        }
      }
    }
  });
});
