/**
 * 战力公式版本戳的**强制机制**。
 *
 * 这不是一组普通断言 —— 它的职责是：**让「改了公式却忘了改版本号」这件事
 * 不可能悄悄发生**。线上 profiles 只存战力数字不存搭配，公式一改就没有重算
 * 路径（见 cpFormulaVersion.ts 文件头），所以版本号漏改的代价是榜单永久失真
 * 且事后无法区分哪行是哪把尺算的。
 *
 * 与「改 SAVE_VERSION 必须写迁移」由测试兜底是同一条路子。
 */

import { describe, expect, it } from 'vitest';
import { combatPower } from '../formula';
import {
  CP_FORMULA_PROBE_STATS,
  CP_FORMULA_VERSION,
  isKnownCpFormulaVersion,
} from '../cpFormulaVersion';

/**
 * 各版本公式在固定探针上的输出指纹。
 *
 * **改公式的人要做的事**：如果下面这条测试红了，说明你改变了 combatPower 的
 * 输出。请做两件事，缺一不可：
 *   ① 把 CP_FORMULA_VERSION 从 N 改成 N+1（cpFormulaVersion.ts）
 *   ② 在下表**新增**一行 N+1 的实测值（跑一次拿到实际输出即可），
 *      **不要修改已有版本那一行** —— 它记录的是历史事实，改掉它等于抹掉
 *      「线上那些标着版本 N 的行当时是怎么算的」这个唯一证据。
 */
const FINGERPRINTS: Record<number, readonly number[]> = {
  // v1 = 加权和 × spd（ADR-009 的形状），2026-08-01 之前一直在用的那版
  1: [0, 200, 300, 150, 220, 285, 3262, 2935, 4077, 5218],
  // v2 = 锚点化乘法投影（docs/73 批3-1）：单参 + 参考怪钉 Lv1；前 6 个探针在
  //     新形状下无意义归 0，后 4 个为真实输出（2026-08-01 实测）。
  2: [0, 0, 0, 0, 0, 0, 4645, 4406, 5193, 5875],
  // v3 = 五职业真实技能/怪物节奏重标后的参考怪锚；保留 v2 作为已上线历史。
  3: [0, 0, 0, 0, 0, 0, 3792, 3598, 4240, 4797],
};

describe('战力公式版本戳', () => {
  it('★ 公式行为与当前版本号登记的指纹一致（红了说明忘了 +1，看上方注释）', () => {
    const expected = FINGERPRINTS[CP_FORMULA_VERSION];
    expect(
      expected,
      `CP_FORMULA_VERSION = ${CP_FORMULA_VERSION}，但 FINGERPRINTS 里没有这一版的记录。` +
        `改版本号的同时要补一行实测指纹。`,
    ).toBeDefined();

    const actual = CP_FORMULA_PROBE_STATS.map((stats) => combatPower(stats));
    expect(
      actual,
      `战力公式的输出变了，但 CP_FORMULA_VERSION 还是 ${CP_FORMULA_VERSION}。\n` +
        `线上 profiles 只存战力数字、不存搭配，所以存量没有重算路径：\n` +
        `版本号不 +1，新旧两把尺的数字会在同一张榜上按同一字段排序，且事后无法区分。\n` +
        `请把 CP_FORMULA_VERSION 改成 ${CP_FORMULA_VERSION + 1}，并在 FINGERPRINTS 里新增：\n` +
        `  ${CP_FORMULA_VERSION + 1}: ${JSON.stringify(actual)},`,
    ).toEqual(expected);
  });

  it('历史版本的指纹只增不改：每个版本都有记录，且版本号连续', () => {
    const versions = Object.keys(FINGERPRINTS)
      .map(Number)
      .sort((a, b) => a - b);
    expect(versions[0]).toBe(1);
    versions.forEach((v, i) => expect(v).toBe(i + 1));
    expect(versions.at(-1)).toBe(CP_FORMULA_VERSION);
  });

  it('探针覆盖 spd ≠ 1：spd 是整条战力的乘数，只测 spd=1 会漏掉乘法侧改动', () => {
    const spds = new Set(CP_FORMULA_PROBE_STATS.map((s) => s.spd));
    expect(spds.size).toBeGreaterThan(1);
    expect([...spds].some((s) => s > 1)).toBe(true);
    expect([...spds].some((s) => s < 1)).toBe(true);
  });

  it('探针是冻结的：改动探针会让指纹失去与历史版本的可比性', () => {
    expect(Object.isFrozen(CP_FORMULA_PROBE_STATS)).toBe(true);
  });

  describe('isKnownCpFormulaVersion', () => {
    it('接受当前版本与历史版本', () => {
      expect(isKnownCpFormulaVersion(1)).toBe(true);
      expect(isKnownCpFormulaVersion(CP_FORMULA_VERSION)).toBe(true);
    });

    it('★ 拒绝未来版本：客户端拿不到未来的公式，只可能是伪造', () => {
      expect(isKnownCpFormulaVersion(CP_FORMULA_VERSION + 1)).toBe(false);
      expect(isKnownCpFormulaVersion(999)).toBe(false);
    });

    it('拒绝 0、负数与非整数', () => {
      expect(isKnownCpFormulaVersion(0)).toBe(false);
      expect(isKnownCpFormulaVersion(-1)).toBe(false);
      expect(isKnownCpFormulaVersion(1.5)).toBe(false);
      expect(isKnownCpFormulaVersion(Number.NaN)).toBe(false);
    });
  });
});
