/**
 * 历史词条值的**联机可验证性**回归守卫。
 *
 * ## 守的是什么
 *
 * `isVerifiablePersistedAffixValue` 决定「玩家背包里这个词条数值，是不是可能
 * 由正式版本产生」。它一旦对**真实旧值**判 false，`submit-trial` /
 * `sync-profile` / arena / guild 会**直接回 400**，那位玩家**再也交不上成绩**，
 * 而且自己无从修复 —— 他什么都没做错，只是玩得早。
 *
 * ## 为什么必须两个方向一起钉
 *
 * 这条判据有两种坏法，而它们**在只测一个方向时长得一模一样**：
 *
 * · **收得太紧** ⇒ 真实旧装备被判非法 ⇒ 老玩家被 400（2026-08-02 的 P0）。
 * · **放得太松** ⇒ 伪造值也能过 ⇒ 反作弊失效，而且**不会有任何人发现**。
 *
 * 修第一种最省事的做法就是把校验放宽，**而放宽之后「旧值通过」这条照样绿**。
 * 所以下面每一组都同时断言「该过的过」与「该拒的拒」。
 *
 * ## 这些数字是哪来的
 *
 * 不是构造的，是**改动前 main 上真实的合法上沿**：2026-08-02 的 C2/C5 重标把
 * `sha_spirit` 基准从 0.84 下调之后，老装备上按 0.84 掷出的值落在了新区间之外。
 * 171.6（Lv40 T5）与 422.6（Lv80 T5）就是当时实测到的、会被新代码拒收的真实值。
 *
 * ## 给后来者
 *
 * · 这个文件**只测判据行为，不含任何平衡参数** —— 改数值的人不需要动它。
 * · 它红了**不要靠放宽校验来修**：先问「这个值到底是不是正式版本能产生的」。
 *   是 ⇒ 该登记的历史基准没登记；不是 ⇒ 那本来就该拒。
 * · `cat_swift` 那条同族缺陷（2026-08-02 18:38 发现）定稿后，**欢迎把它的用例
 *   加进这里** —— 这个文件就是为「历史值必须一直可验证」准备的。
 */

import { describe, expect, it } from 'vitest';
import { affixValueRange, isVerifiablePersistedAffixValue } from '../equipment';

/** 基准下调前，老玩家装备上真实存在的合法值。 */
const LEGACY_SHA_SPIRIT = [
  { level: 40, tier: 5 as const, value: 171.6 },
  { level: 80, tier: 5 as const, value: 422.6 },
];

describe('历史词条值必须一直通过联机校验（2026-08-02 P0 回归）', () => {
  it('★ 基准下调前掷出的 sha_spirit 值仍然可验证 —— 判 false 就是老玩家被 400', () => {
    for (const { level, tier, value } of LEGACY_SHA_SPIRIT) {
      const current = affixValueRange('sha_spirit', level, tier);
      expect(
        isVerifiablePersistedAffixValue('sha_spirit', level, tier, value),
        `Lv${level} T${tier} 的旧值 ${value} 被判非法（当前区间 [${current.min}, ${current.max}]）。` +
          '这不是伪造：它是基准下调前正式掉落能产生的值。' +
          '被拒的玩家会在提交成绩时收到 400，且自己无法修复。' +
          '修法是把改动前的基准登记进 legacyAffixHistory，不是放宽校验。',
      ).toBe(true);
    }
  });

  it('★ 放宽校验会让这条红：明显伪造的值必须仍被拒', () => {
    for (const { level, tier } of LEGACY_SHA_SPIRIT) {
      expect(
        isVerifiablePersistedAffixValue('sha_spirit', level, tier, 10_000),
        `Lv${level} T${tier} 接受了 10000 —— 校验被放宽到失去意义了。`,
      ).toBe(false);
    }
  });

  it('★ 边界也要拒：比历史上沿再高 20% 的值不是任何版本能产生的', () => {
    // 只拒离谱值是不够的——「把区间放宽一点」同样会让上面那条变绿。
    for (const { level, tier, value } of LEGACY_SHA_SPIRIT) {
      const beyond = Number((value * 1.2).toFixed(1));
      expect(
        isVerifiablePersistedAffixValue('sha_spirit', level, tier, beyond),
        `Lv${level} T${tier} 接受了 ${beyond}，它比历史合法上沿还高 20%，任何版本都掷不出来。`,
      ).toBe(false);
    }
  });

  it('这些用例确实在检验历史路径 —— 旧值必须落在当前区间之外，否则本文件退化成空转', () => {
    // 若哪天当前区间重新覆盖了这些旧值，上面第一条就会因为「走当前路径」而通过，
    // 历史兼容那条链等于没被测到。届时应换一组真正落在区间外的历史值。
    for (const { level, tier, value } of LEGACY_SHA_SPIRIT) {
      const current = affixValueRange('sha_spirit', level, tier);
      expect(
        value > current.max || value < current.min,
        `Lv${level} T${tier} 的旧值 ${value} 已落回当前区间 [${current.min}, ${current.max}]，` +
          '本文件不再检验历史兼容路径，请换一组仍在区间外的历史值。',
      ).toBe(true);
    }
  });
});
