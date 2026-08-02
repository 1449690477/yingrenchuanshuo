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
import { ENHANCE_MAX } from '@/data/constants';
import { migrate } from '@/save/migrations';
import { createSave } from '@/save/schema';
import { affixValueRange, isVerifiablePersistedAffixValue } from '../equipment';
import type { AffixTier, EquipmentInstance } from '../types';

/** 基准下调前，老玩家装备上真实存在的合法值。 */
const LEGACY_SHA_SPIRIT = [
  { level: 40, tier: 5 as const, value: 171.6 },
  { level: 80, tier: 5 as const, value: 422.6 },
];

/**
 * v10 时期 T1 `cat_swift` 真实能掷出的全部离散值。
 *
 * 当年基准 0.039 × T1 系数 0.62 = 0.02418，±3% 后按配置的 3 位小数落袋，
 * 可能的结果只有这三个。**不是我构造的边界，是当时的掉落全集。**
 */
const V10_CAT_SWIFT_T1_ROLLS = [0.023, 0.024, 0.025];

/** 造一份 v10 存档，背包里放一件带指定 cat_swift 词条的装备。 */
function v10SaveWithCatSwift(value: number): Record<string, unknown> {
  const save = createSave('v10 少女', 'witch', 33, 1_800_000_000_000);
  save.nextUid = 5;
  save.bag.equipment.push({
    uid: 'e1',
    defId: 'eq_r2_ring_epic',
    enhance: 0,
    baseRollPermille: 1000,
    enhanceGainPermille: Array<number>(ENHANCE_MAX).fill(0),
    enhanceLuck: {},
    affixes: [
      { key: 'atk', value: affixValueRange('atk', 20, 2).min, tier: 2 },
      { key: 'cat_swift', value, tier: 1 },
    ],
    reforgeResonance: 0,
    locked: false,
  } as unknown as EquipmentInstance);
  return { ...save, version: 10 };
}

/** 把一份 v10 存档跑完整迁移链，取出迁移后的 cat_swift 词条。 */
function migratedCatSwift(value: number): { value: number; tier: AffixTier } {
  const migrated = migrate(v10SaveWithCatSwift(value)) as unknown as {
    bag: { equipment: EquipmentInstance[] };
  };
  const affix = migrated.bag.equipment[0]?.affixes.find((a) => a.key === 'cat_swift');
  if (!affix) throw new Error(`v10 值 ${value} 迁移后 cat_swift 消失了，用例前提已不成立`);
  return { value: affix.value, tier: affix.tier };
}

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

/**
 * 第二个维度：**迁移产物**。
 *
 * 上面那组测的是「旧值原封不动存在存档里」的情形（保值模式）。但还有一类值
 * 不是原封不动来的，而是**迁移器自己算出来写进存档的** —— v10→v11 会按新旧
 * 基准比例重标每一个职业词条。
 *
 * 这两类值的校验走的是不同代码路径，于是出现过一次**两侧各自都绿、洞在中间**：
 * 2026-08-02 有人把 v10 重标表从 0.027 改成 0.045（迁移器）与 0.044（校验器），
 * 迁移器算出 0.029、校验器复现出 0.028，**校验器复现不出迁移器自己的产物**。
 * 当时保值维度的测试全绿，因为它压根不经过迁移。
 *
 * 所以这一组的判据只有一句：**任取一个 v10 时期能掷出的值，跑完真正的
 * `migrate()`，产物必须能通过联机校验。**不许拿比例手算代替 `migrate()` ——
 * 当天有两个人用手算探针复核，都得出了「两边都不通过」的错误读数，
 * 因为手算跳过了迁移链里的多次四舍五入。
 */
describe('迁移产物必须一直通过联机校验（2026-08-02 cat_swift 回归）', () => {
  it('★ v10 的 cat_swift 掷值经真实迁移后仍可验证 —— 判 false 就是老档回归即被 400', () => {
    for (const rolled of V10_CAT_SWIFT_T1_ROLLS) {
      const { value, tier } = migratedCatSwift(rolled);
      const current = affixValueRange('cat_swift', 20, tier);
      expect(
        isVerifiablePersistedAffixValue('cat_swift', 20, tier, value),
        `v10 的 T1 掷值 ${rolled} 经 migrate() 得到 ${value}（T${tier}），` +
          `却被判非法（当前区间 [${current.min}, ${current.max}]）。` +
          '这个值是迁移器自己写进存档的，玩家无从干预，也无法自救：' +
          '他一登录就会在 sync-profile / submit-trial / arena / guild 全线收到 400。' +
          '修法是让校验器与迁移器读同一张 v10 重标表，不是放宽校验。',
      ).toBe(true);
    }
  });

  it('★ 放宽校验会让这条红：迁移产物放大十倍后必须仍被拒', () => {
    for (const rolled of V10_CAT_SWIFT_T1_ROLLS) {
      const { value, tier } = migratedCatSwift(rolled);
      const forged = Number((value * 10).toFixed(3));
      expect(
        isVerifiablePersistedAffixValue('cat_swift', 20, tier, forged),
        `T${tier} 接受了 ${forged}（真实迁移产物 ${value} 的十倍）—— 校验被放宽到失去意义了。`,
      ).toBe(false);
    }
  });

  /*
   * 这里本该再加一条「迁移器与校验器必须读同一张 v10 重标表」的直接断言，
   * 好在分叉时直接指出根因，而不是只报某个值被拒。**写不了**：
   * `save/migrations.ts` 里那张 `V10_PROFESSION_AFFIX_REBASE` 是模块私有的
   * 副本（migrations.ts:607），它并不 import `data/legacyAffixHistory.ts`
   * 导出的那张 —— 同一份历史契约在两个模块里各存一份，靠人手同步。
   *
   * **真正的修法不是加断言，是消灭副本**：让 migrations.ts 直接 import
   * 那张已导出的表（连同 isV10RebasedAffixKey），两处就不可能再分叉，
   * 本文件第一条也就永远不会因为这个原因红。在那之前，这条只能靠上面
   * 「迁移产物必须可验证」间接兜住。
   */

  it('这组用例确实在检验迁移路径 —— 产物必须落在当前区间之外，否则退化成空转', () => {
    // 若哪天当前区间重新覆盖了迁移产物，第一条会因为「走当前路径」而通过，
    // 迁移兼容那条链等于没被测到。
    const outside = V10_CAT_SWIFT_T1_ROLLS.some((rolled) => {
      const { value, tier } = migratedCatSwift(rolled);
      const current = affixValueRange('cat_swift', 20, tier);
      return value > current.max || value < current.min;
    });
    expect(
      outside,
      '全部 v10 迁移产物都落回了当前可生成区间，本组不再检验迁移兼容路径，' +
        '请换一个仍会落在区间外的键或品阶。',
    ).toBe(true);
  });
});
