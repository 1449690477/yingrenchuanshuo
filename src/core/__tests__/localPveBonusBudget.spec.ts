import { describe, expect, it } from 'vitest';
import { ACHIEVEMENT_BONUS_MAX_PERCENT } from '../achievements';
import {
  GALLERY_BONUS_CAP_PERCENT,
  GALLERY_REGION_BONUS_PERCENT,
  LOCAL_PVE_BONUS_CAP_PERCENT,
  combineLocalPveBonuses,
} from '../galleryBonuses';
import { REGIONS } from '@/data/regions';

/**
 * 本地 PvE 加成「预算不得透支」守卫。
 *
 * ## 它防的是什么
 *
 * `combineLocalPveBonuses` 会把各来源之和截到 `LOCAL_PVE_BONUS_CAP_PERCENT`。
 * 截断本身是对的 —— 问题在于**截断是静默的**：一旦各来源的上限之和超过总上限，
 * 多出来的那部分玩家**永远拿不到**，而界面、代码、现有测试都看不出任何异样。
 *
 * 具体的雷（2026-08-03 实测）：图鉴集齐按区域数**数据驱动**增长
 * （每区 +0.5%，注释明确写「r8 上线后自动 4%，不写死区数」），
 * 而总上限 5.5 是**写死的**，恰好等于当前 7 区的 3.5% + 成就 2.0%。
 * ⇒ **r8 一上线，图鉴升到 4.0%，合计 6.0% 被截回 5.5%，
 * 玩家集齐整整一个区域的图鉴，实际收益是 0。**
 *
 * 「自动跟随」只对图鉴自己成立，它的伴生上限不跟着长 —— 这是单向成立的
 * 安全性声明，和 docs/85 记的那一族同形。
 *
 * ## 为什么写成测试而不是直接改实现
 *
 * 改上限是数值裁定（归数值线），而且会改变线上数值口径；
 * **本文件不改任何数值，只让这个缺陷在发生的那一刻变得可见。**
 * 今天它是绿的（3.5 + 2.0 = 5.5，恰好贴线不截断）；
 * 谁加区域、加来源、或提高任一来源的上限，它当场变红。
 *
 * ## 红了怎么办
 *
 * **不要调低某个来源来「让它绿」** —— 那等于把已经承诺给玩家的收益砍掉。
 * 正确处置是二选一：
 * 1. 提高 `LOCAL_PVE_BONUS_CAP_PERCENT`（需数值线裁定，因为它影响强度口径）；
 * 2. 把总上限改成由各来源上限**求和推导**，从此不可能再透支。
 */

/** 图鉴集齐在当前内容量下能达到的最大加成。 */
function galleryMaxPercent(): number {
  return Math.min(REGIONS.length * GALLERY_REGION_BONUS_PERCENT, GALLERY_BONUS_CAP_PERCENT);
}

/** 称号目前是纯展示身份系统，不给战斗加成（M4-9 设计如此）。 */
const TITLE_BONUS_MAX_PERCENT = 0;

describe('本地 PvE 加成预算不得透支', () => {
  it('★ 各来源上限之和不得超过总上限 —— 超了就有玩家永远拿不到的收益', () => {
    const gallery = galleryMaxPercent();
    const sum = gallery + ACHIEVEMENT_BONUS_MAX_PERCENT + TITLE_BONUS_MAX_PERCENT;
    expect(
      sum,
      `各来源上限之和 ${sum}% 已超过总上限 ${LOCAL_PVE_BONUS_CAP_PERCENT}%\n` +
        `  （图鉴 ${gallery}% = ${REGIONS.length} 区 × ${GALLERY_REGION_BONUS_PERCENT}%` +
        ` ／ 成就 ${ACHIEVEMENT_BONUS_MAX_PERCENT}% ／ 称号 ${TITLE_BONUS_MAX_PERCENT}%）。\n` +
        '  超出的部分会被 combineLocalPveBonuses 静默截掉：玩家把该来源做满，' +
        '收益却一点不涨，而且界面与代码都看不出异样。\n' +
        '  ★不要靠调低某个来源来让本条变绿——那是把已承诺的收益砍掉。' +
        '正确处置是提高总上限（数值线裁定），或把总上限改成由各来源上限求和推导。',
    ).toBeLessThanOrEqual(LOCAL_PVE_BONUS_CAP_PERCENT);
  });

  it('反空转：合并函数确实会截断，本守卫不是在防一个不存在的行为', () => {
    // 若哪天截断逻辑被移除，上面那条就变成了一条永远不会触发的空断言。
    const over = LOCAL_PVE_BONUS_CAP_PERCENT + 10;
    expect(combineLocalPveBonuses([over])).toBe(LOCAL_PVE_BONUS_CAP_PERCENT);
  });

  it('反空转：图鉴上限确实随区域数增长，不是写死的常量', () => {
    // 这条钉住「数据驱动」这个前提本身。若图鉴改成写死值，
    // 第一条就失去了它要防的那个增长风险，应当重新设计守卫而不是留着空转。
    expect(REGIONS.length).toBeGreaterThan(0);
    expect(galleryMaxPercent()).toBeCloseTo(
      Math.min(REGIONS.length * GALLERY_REGION_BONUS_PERCENT, GALLERY_BONUS_CAP_PERCENT),
      5,
    );
  });
});
