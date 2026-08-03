import { describe, expect, it } from 'vitest';
import { BOUTIQUE_SHELVES, BOUTIQUE_SHELF_LIST, BOUTIQUE_THEMES } from '@/data/boutique';
import { EQUIPMENT } from '@/data/equipment';
import { boutiqueBossDropIds } from '@/data/shop';

/**
 * 冰雪华年套「下架但不删除」的双向守卫（2026-08-03）。
 *
 * ## 背景
 *
 * 该套 20 件穿戴层里 19 件与绯樱星愿夜宴逐像素同形（18 件内容完全相同、
 * kenshi-body 形状 IoU 0.9604），实为描图改色。老板决定先下架，
 * 等 codex 有额度后按美术施工文档重做再上架。
 *
 * ## 为什么两个方向都要钉
 *
 * · **只钉「不上架」不够**：下一个人可能顺手把主题和装备定义一起删掉「清理干净」。
 *   而服务端不存背包（购买与持有都在玩家本地 IndexedDB），
 *   `core/trial.ts` 的 `getEquipment(defId)` 查不到定义就返回 `unknown-equipment` → 400。
 *   **已经买过的玩家会在 sync-profile / submit-trial / arena / guild 全线被拒，且无法自救。**
 * · **只钉「定义还在」不够**：那样下架本身随时可能被回退，玩家又能买到描图。
 *
 * 所以下面同时断言：**商店里买不到** ＋ **定义一件不少**。
 */

const ICE_SNOW_EQUIPMENT_COUNT = 12;

describe('冰雪华年套：已下架但定义完整保留', () => {
  it('★ 商店货架列表里不再出现冰雪馆 —— 玩家买不到新的', () => {
    expect(
      BOUTIQUE_SHELF_LIST.some((shelf) => shelf.id === 'ice-snow'),
      '冰雪馆重新出现在商店货架列表里。它目前是描图素材，重新上架前必须先完成美术重做。',
    ).toBe(false);
  });

  it('★ 但主题与货架条目本身仍然存在 —— 已购玩家的物品要靠它解析', () => {
    expect(BOUTIQUE_SHELVES['ice-snow'], '冰雪货架条目被整个删掉了').toBeDefined();
    expect(BOUTIQUE_THEMES['ice-snow'], '冰雪主题被整个删掉了').toBeDefined();
  });

  it('★★ 全部冰雪装备定义必须原样保留 —— 删一件就有玩家被判成外挂', () => {
    const ids = Object.keys(EQUIPMENT).filter((id) => id.includes('ice-snow'));
    expect(
      ids.length,
      `冰雪装备定义只剩 ${ids.length} 件（应为 ${ICE_SNOW_EQUIPMENT_COUNT} 件）。` +
        '服务端查不到定义会返回 unknown-equipment 并回 400，' +
        '已经买过的玩家将在 sync-profile / submit-trial / arena / guild 全线被拒且无法自救。' +
        '下架只能摘牌，不能删定义。',
    ).toBe(ICE_SNOW_EQUIPMENT_COUNT);
  });

  it('★★ 7-5 章节 BOSS 也不再掉落冰雪 —— 只藏货架的话下架形同虚设', () => {
    // 获取路径有两条：商店购买、章节 BOSS 直掉。只堵购买那条，
    // 玩家照样能从 7-5 拿到同一批描图外观，只是不花钱而已。
    expect(
      boutiqueBossDropIds('7-5'),
      '7-5 BOSS 又开始掉冰雪套了。下架期间两条获取路径都必须关闭；' +
        '重新上架时请连同 BOUTIQUE_BOSS_DROP_THEME 里那一行一起恢复。',
    ).toEqual([]);
  });

  it('反空转：其他章节的 BOSS 直掉仍然正常，说明没把整张掉落表关掉', () => {
    // 若这条也空了，说明改动误伤了全部主题，而不是只停冰雪。
    expect(boutiqueBossDropIds('2-1').length, '2-1 的莓霜直掉被一起关掉了').toBeGreaterThan(0);
    expect(boutiqueBossDropIds('2-5').length, '2-5 的绯夜直掉被一起关掉了').toBeGreaterThan(0);
  });

  it('反空转：其余货架仍然正常上架，说明过滤没有把所有货架一起干掉', () => {
    expect(
      BOUTIQUE_SHELF_LIST.length,
      '商店里一个货架都不剩了——下架过滤写错了范围。',
    ).toBeGreaterThan(0);
    expect(BOUTIQUE_SHELF_LIST.some((shelf) => shelf.id === 'sakura')).toBe(true);
  });
});
