/**
 * 战力**输入侧**的指纹 —— 补上 `cpFormulaVersion.spec.ts` 抓不到的那一半。
 *
 * ── 这个洞是怎么发现的 ──
 * `cpFormulaVersion.spec.ts` 的探针是**冻结的 Stats 向量**，直接喂给 `combatPower`。
 * 所以它钉的是「**拿到同样的属性，公式算出同样的数**」——
 * 改公式会红，**改「玩家能拿到多少属性」的那些数据一声不吭**。
 *
 * 而 `cpFormulaVersion.ts` 文件头当时写的是「这条纪律**不靠人记**：指纹会红」。
 * 那句话只对改公式成立。2026-08-02 两套平衡方案改了词条基准，
 * 战力随之改变、却没有任何守卫提醒要升 `CP_FORMULA_VERSION` ——
 * **不是有人忘了，是没有东西会提醒他。**
 *
 * ── 这条钉的是什么 ──
 * 「同一个职业、同一个等级的**裸装玩家**，战力是多少」。
 * 它把 `CLASS_BASE_STATS`、每级成长、`CLASS_ATK_MUL` 这几张数据表一起罩住：
 * 任何一处改动都会让下面的数字变，测试当场红。
 *
 * ── 为什么用裸装而不是带装备 ──
 * 带装备的探针会被「新增一件装备」之类的无害改动打红，噪声太大；
 * 而装备侧的基准漂移已经由 `affixBaselineFreeze.spec.ts` 专门守着。
 * 两条各管一段，合起来覆盖「公式」「职业基础数据」「词条基准」三类。
 *
 * ── 红了怎么办 ──
 * **先判断玩家的战力是不是真的变了**（几乎必然是）。若是：
 *   1. 把 `CP_FORMULA_VERSION` +1，并在 `cpFormulaVersion.spec.ts` 的
 *      `FINGERPRINTS` 里新增那一版（那条测试会打印该粘贴的内容）；
 *   2. 才更新下面的数字。
 * 只改下面的数字 = 把守卫关掉，线上会出现「戳说是旧版、数其实是新数据算的」，
 * 而**榜单看起来完全正常** —— 那正是版本戳存在的全部意义要防的事。
 */

import { describe, expect, it } from 'vitest';
import { combatPower } from '../formula';
import { applyClassMods, baseStatsFor } from '../progression';
import { CLASS_IDS, type ClassId } from '../types';

/** 探针等级。只增不改 —— 改掉某一档等于把该档的历史读数抹了。 */
const PROBE_LEVELS = [1, 20, 40, 60, 81] as const;

/**
 * 裸装玩家在各探针等级的战力。
 *
 * **只在完成文件头「红了怎么办」那两步之后才更新。**
 */
const FROZEN_BASE_CP: Readonly<Record<ClassId, readonly number[]>> = Object.freeze({
  swordsman: [30, 189, 424, 720, 1095],
  witch: [27, 144, 300, 490, 725],
  shaman: [23, 139, 302, 506, 762],
  catkin: [25, 147, 313, 518, 771],
  kenshi: [26, 163, 351, 584, 874],
});

describe('战力输入侧指纹', () => {
  it('★ 职业基础数据一改，战力就变 —— 变了必须升 CP_FORMULA_VERSION', () => {
    const drift: string[] = [];
    for (const classId of CLASS_IDS) {
      const actual = PROBE_LEVELS.map((level) =>
        Math.round(combatPower(applyClassMods(classId, baseStatsFor(classId, level)))),
      );
      const frozen = FROZEN_BASE_CP[classId];
      if (frozen.length !== actual.length || frozen.some((v, i) => v !== actual[i])) {
        drift.push(`  ${classId}: [${frozen.join(', ')}] -> [${actual.join(', ')}]`);
      }
    }
    expect(
      drift,
      `裸装战力变了：\n${drift.join('\n')}\n\n` +
        '说明 CLASS_BASE_STATS / 每级成长 / CLASS_ATK_MUL 里有改动，\n' +
        '**同一个玩家的战力因此变了**，线上旧行与新行不可比。\n\n' +
        '请先把 CP_FORMULA_VERSION +1（cpFormulaVersion.spec.ts 会打印要粘贴的指纹），\n' +
        '**再**更新本文件里的数字。只改数字 = 关掉守卫，\n' +
        '线上会出现「戳说旧版、数是新数据算的」，而榜单看起来完全正常。',
    ).toEqual([]);
  });

  it('探针覆盖全部职业 —— 新增职业必须一并登记，否则它的数据改动没人看着', () => {
    const missing = CLASS_IDS.filter((c) => FROZEN_BASE_CP[c] === undefined);
    expect(missing, `这些职业不在指纹表里：${missing.join(', ')}`).toEqual([]);
  });

  it('★ 与公式侧指纹是互补关系，不是重复 —— 这条说明为什么两条都要留', () => {
    // 公式侧：冻结 Stats 喂 combatPower ⇒ 改公式红、改数据不红。
    // 本文件：冻结「职业+等级」算出的属性再喂 combatPower ⇒ 改数据也红。
    // 若哪天有人觉得两条重复想删一条，这里的断言会提醒：它们的输入不同源。
    // ⚠ 别拿剑姬做这个探针：它的 CLASS_ATK_MUL 恰好是 1.0，乘完等于没乘，
    // 于是「系数没生效」和「系数是 1」长得一模一样。我第一版就写错在这。
    // 取全部职业里至少有一个被改动过，才说明这条链真的经过了数据层。
    const touched = CLASS_IDS.filter((classId) => {
      const stats = baseStatsFor(classId, 40);
      return applyClassMods(classId, stats).atk !== stats.atk;
    });
    expect(
      touched.length,
      '没有任何职业的攻击被 applyClassMods 改动，说明这条探针没有真的经过数据层',
    ).toBeGreaterThan(0);
  });
});
