import { describe, expect, it } from 'vitest';
import { decomposeGold } from '../economy';
import { CLASS_IDS } from '../types';
import type { EquipmentDef, EquipmentInstance, Quality } from '../types';
import { ENHANCE_MAX } from '@/data/constants';
import { EQUIPMENT } from '@/data/equipment';
import { SHOP_OFFERS } from '@/data/shop';
import { BOUTIQUE_THEME_LIST } from '@/data/boutique';

function equipment(quality: Quality): EquipmentDef {
  return {
    id: `eq_${quality}`,
    name: '测试装备',
    slot: 'weapon',
    element: 'none',
    quality,
    level: 20,
    icon: '',
    appearanceId: 'test',
  };
}

function instance(defId: string, enhance = 0): EquipmentInstance {
  return {
    uid: 'e1',
    defId,
    enhance,
    baseRollPermille: 1000,
    enhanceGainPermille: Array.from({ length: ENHANCE_MAX }, (_, index) =>
      index < enhance ? 80 : 0,
    ),
    enhanceLuck: {},
    affixes: [],
    reforgeResonance: 0,
    locked: false,
  };
}

describe('装备分解经济', () => {
  it('同等级品质越高、强化越高，分解金币越多', () => {
    const common = equipment('common');
    const mythic = equipment('mythic');
    expect(decomposeGold(mythic, instance(mythic.id))).toBeGreaterThan(
      decomposeGold(common, instance(common.id)),
    );
    expect(decomposeGold(common, instance(common.id, 5))).toBeGreaterThan(
      decomposeGold(common, instance(common.id)),
    );
  });

  it('实例与定义不匹配时直接暴露错误', () => {
    expect(() => decomposeGold(equipment('rare'), instance('eq_other'))).toThrow('不匹配');
  });

  it('全部商店珍品立即分解都远低于买入价，不存在套利', () => {
    for (const offer of SHOP_OFFERS) {
      const def = EQUIPMENT[offer.defId]!;
      const refund = decomposeGold(def, instance(def.id));
      expect(offer.price, offer.id).toBeGreaterThan(refund * 100);
    }
  });
});

describe('精品商店价格表的结构约束', () => {
  // ── 这一组的来历 ──
  // 来自外部贡献者 Yukk1o 的 PR#3。那个 PR 同时做了两件事：
  // 把价格统一砍到三分之一、以及加这几条结构约束。
  //
  // **价格改动没有采纳**：它的论证前提是「解锁期收入只从 5.6 万/小时涨到
  // 14.6 万/小时」，而 2026-07-31 实测已经是 22.9~219.5 万/小时 ——
  // 经济基线在他提 PR 之后被整体重排过，富了约 15 倍。
  // 在今天的经济上再砍到三分之一，最贵的绯夜整套会变成约 52 小时可得，
  // 珍品商店就没有长期目标了。
  //
  // **但结构约束这部分是好东西，所以按当前价格重写在这里。**
  // 它们与具体数值无关，管的是「价格表的形状不许塌」——
  // 将来谁调价、或者加第四档主题，这几条会先拦住形状上的错误。

  it('同一档里每个职业能买到的整套总价必须一致', () => {
    for (const theme of BOUTIQUE_THEME_LIST) {
      const perClass = new Map<string, number>();
      for (const item of theme.items) {
        // classId 为空 = 四职业通用件，每个职业都算得上
        const owners = item.classId ? [item.classId] : [...CLASS_IDS];
        for (const cls of owners) {
          perClass.set(cls, (perClass.get(cls) ?? 0) + item.price);
        }
      }
      const totals = [...perClass.values()];
      if (totals.length === 0) continue;
      const min = Math.min(...totals);
      const max = Math.max(...totals);
      expect(
        max,
        `${theme.shortName} 各职业整套总价不一致：最低 ${min}、最高 ${max}。` +
          `职业专属件必须等价 —— 否则「选哪个职业」会变成一道经济题，` +
          `而职业选择本该只关乎玩法风格。`,
      ).toBe(min);
    }
  });

  it('同一部位的价格必须按档位严格递增', () => {
    // 宅猫是单职业限定主题，不在莓霜→月糖→绯夜这条主线阶梯上
    const ladder = ['莓霜', '月糖', '绯夜', '冰雪'];
    const bySlot = new Map<string, Map<string, number>>();
    for (const theme of BOUTIQUE_THEME_LIST) {
      if (!ladder.includes(theme.shortName)) continue;
      for (const item of theme.items) {
        const row = bySlot.get(item.slot) ?? new Map<string, number>();
        row.set(theme.shortName, item.price);
        bySlot.set(item.slot, row);
      }
    }
    expect(bySlot.size).toBeGreaterThan(0);
    for (const [slot, row] of bySlot) {
      const seq = ladder.map((name) => row.get(name)).filter((v): v is number => v !== undefined);
      for (let i = 1; i < seq.length; i += 1) {
        expect(
          seq[i]!,
          `${slot} 的价格没有随档位递增：${ladder.join(' → ')} = ${seq.join(' → ')}。` +
            `后一档的同部位必须更贵，否则玩家会发现「越高档反而越便宜」，` +
            `档位阶梯当场失去意义。`,
        ).toBeGreaterThan(seq[i - 1]!);
      }
    }
  });

  it('所有价格都是正的安全整数', () => {
    for (const theme of BOUTIQUE_THEME_LIST) {
      for (const item of theme.items) {
        expect(
          Number.isSafeInteger(item.price) && item.price > 0,
          `${theme.shortName} 的「${item.name}」价格是 ${item.price}。` +
            `金币是整数资源，小数或超出安全整数范围会在扣费与显示两侧各自舍入，` +
            `舍到不一样的值就是玩家能看见的对不上账。`,
        ).toBe(true);
      }
    }
  });

  it('冰雪华年每职业整套为 11.5 亿，保持顶段长期目标而非廉价跳级', () => {
    const theme = BOUTIQUE_THEME_LIST.find((entry) => entry.id === 'ice-snow');
    expect(theme).toBeDefined();
    for (const classId of CLASS_IDS) {
      const total = theme!.items
        .filter((item) => !item.classId || item.classId === classId)
        .reduce((sum, item) => sum + item.price, 0);
      expect(total, classId).toBe(1_150_000_000);
    }
  });
});
