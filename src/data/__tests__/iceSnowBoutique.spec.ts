import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { affixValueRange } from '@/core/equipment';
import { CLASS_IDS } from '@/core/types';
import { BOUTIQUE_SHELVES, BOUTIQUE_THEMES, boutiqueEquipmentId } from '../boutique';
import { QUALITY_AFFIX_COUNT, SLOT_ORDER } from '../constants';
import { requireEquipment } from '../equipment';
import { requireEquipmentAppearance } from '../characterAppearance';
import { LOOT_TABLES } from '../lootTables';
import { boutiqueBossDropIds, SHOP_OFFERS } from '../shop';

const THEME_ID = 'ice-snow' as const;
const EXPECTED_SET_PRICE = 1_150_000_000;

describe('冰雪华年五职业 T0 珍品套', () => {
  it('独立货架只陈列冰雪主题，并使用专属 3:2 场景', () => {
    const shelf = BOUTIQUE_SHELVES[THEME_ID];

    expect(shelf.name).toBe('冰雪华年新春货架');
    expect(shelf.themeIds).toEqual([THEME_ID]);
    expect(shelf.sceneAsset).toBe('assets/shops/ice-snow-shelf.webp');
    expect(existsSync(resolve('public', shelf.sceneAsset))).toBe(true);
  });

  it('五职业各自拥有八个真实装备槽，职业间价格完全一致', () => {
    const theme = BOUTIQUE_THEMES[THEME_ID];
    expect(theme).toMatchObject({ quality: 'legendary', level: 78, fixedAffixTier: 5 });
    expect(theme.extraAffixSlots).toBe(3);

    for (const classId of CLASS_IDS) {
      const definitions = SHOP_OFFERS.filter((offer) => offer.id.startsWith('offer_ice-snow_'))
        .map((offer) => requireEquipment(offer.defId))
        .filter((definition) => !definition.classId || definition.classId === classId);

      expect(definitions, classId).toHaveLength(8);
      expect(definitions.map((definition) => definition.slot).sort(), classId).toEqual(
        [...SLOT_ORDER].sort(),
      );
      expect(
        definitions.reduce((total, definition) => {
          const offer = SHOP_OFFERS.find((candidate) => candidate.defId === definition.id)!;
          return total + offer.price;
        }, 0),
        classId,
      ).toBe(EXPECTED_SET_PRICE);
      expect(
        definitions.find((definition) => definition.slot === 'weapon')?.id,
        classId,
      ).toBe(boutiqueEquipmentId(THEME_ID, 'weapon', classId));
    }
  });

  it('每件都是真 T5 固定词条加三条可洗槽，不用 divine 品质虚抬裸值', () => {
    const offers = SHOP_OFFERS.filter((offer) => offer.id.startsWith('offer_ice-snow_'));
    expect(offers).toHaveLength(12);

    for (const offer of offers) {
      const definition = requireEquipment(offer.defId);
      expect(definition.quality, definition.id).toBe('legendary');
      expect(definition.level, definition.id).toBe(78);
      if (definition.slot === 'weapon') expect(definition.element, definition.id).toBe('ice');
      expect(definition.fixedAffixes, definition.id).toHaveLength(
        QUALITY_AFFIX_COUNT.legendary,
      );
      expect(definition.extraAffixSlots, definition.id).toBe(3);
      for (const affix of definition.fixedAffixes ?? []) {
        expect(affix.tier, `${definition.id}:${affix.key}`).toBe(5);
        const range = affixValueRange(affix.key, definition.level, 5);
        expect(affix.value, `${definition.id}:${affix.key}`).toBeGreaterThanOrEqual(range.min);
        expect(affix.value, `${definition.id}:${affix.key}`).toBeLessThanOrEqual(range.max);
      }
    }
  });

  /*
   * 原用例「最终 BOSS 同款直掉 12 件，职业武器带过滤且每件权重为 0.001」
   * 在 2026-08-03 冰雪套下架期间**不成立**：两条获取路径（商店购买、7-5 BOSS 直掉）
   * 已一并关闭，`boutiqueBossDropIds('7-5')` 现在返回空数组。
   *
   * ★ 重新上架时，恢复 BOUTIQUE_BOSS_DROP_THEME 的 '7-5': 'ice-snow' 之后，
   *   **必须把下面这条一并解除 skip**，否则掉落权重与职业过滤将失去覆盖。
   *   下架期间由 shopIceSnowDelisted.spec.ts 反向断言「7-5 不再掉冰雪」。
   */
  it.skip('最终 BOSS 同款直掉 12 件，职业武器带过滤且每件权重为 0.001（下架期间停用）', () => {
    const ids = boutiqueBossDropIds('7-5');
    expect(ids).toHaveLength(12);
    const table = LOOT_TABLES['loot_7-5_boss'];
    expect(table).toBeDefined();

    for (const id of ids) {
      const definition = requireEquipment(id);
      const entry = table!.entries.find((candidate) => candidate.itemId === id);
      expect(entry, id).toMatchObject({ weight: 0.001, minCount: 1, maxCount: 1 });
      expect(entry?.classId, id).toBe(definition.classId);
    }
  });

  it('只把冰雪樱酱整身衣裙解析为 replacement，老四职业仍保留分层换装', () => {
    const appearance = requireEquipmentAppearance('boutique-ice-snow-body');
    expect(appearance).toMatchObject({
      renderMode: 'layer',
      replacementClasses: ['kenshi'],
    });
    if (appearance.renderMode !== 'layer') throw new Error('冰雪衣裙必须走 layer 主契约');
    expect(appearance.replacementIncludes).toBeUndefined();
  });
});
