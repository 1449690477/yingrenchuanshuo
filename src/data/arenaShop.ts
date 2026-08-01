/**
 * 荣誉商店与竞技场奖励箱（docs/53 §四）。
 *
 * 本文件只有数据没有逻辑（AGENTS.md 铁律 2）。
 *
 * 设计口径：
 *   - 圣痕套全员可得，只是快慢有别 —— 底层玩家靠每日结算约 60 天集齐，
 *     不设「只有前 100 名才配拥有」的门槛（docs/53 §4.1）；
 *   - 圣痕碎片 40 换 1 是高段位玩家的快车道，但**不是独占路**（荣誉直购人人可走）；
 *   - 奖励箱在每日 04:00 结算时**直接进背包**，不需要点「领取」——
 *     「不领取就清空」是 docs/40 惩罚红线，玩家哪天不上线也不会损失（§4.3）。
 */

import type { ClassId } from '@/core/types';

/** 荣誉商店里的一个货架。 */
export interface ArenaShopEntry {
  /** 货架 id：arena_<class>_<slot>（同一职业同部位只有一个圣痕装备） */
  id: string;
  classId: ClassId;
  slot: 'weapon' | 'head' | 'body' | 'ring';
  /** 价格（荣誉印记） */
  price: number;
}

/**
 * 定价（docs/53 §4.1）：武器 1500 / 头冠 1200 / 衣装 1200 / 戒指 900，全套 4800。
 * 对照每日结算产出：樱冠约 14 天、绯樱约 20 天、青樱约 60 天集齐全套。
 */
export const ARENA_SHOP_PRICES: Readonly<Record<ArenaShopEntry['slot'], number>> = {
  weapon: 1500,
  head: 1200,
  body: 1200,
  ring: 900,
} as const;

const ARENA_SHOP_SLOTS = ['weapon', 'head', 'body', 'ring'] as const;
const ARENA_SHOP_CLASSES: readonly ClassId[] = [
  'swordsman',
  'witch',
  'shaman',
  'catkin',
  'kenshi',
];

/** 全部 20 个货架（5 职业 × 4 部位）。 */
export const ARENA_SHOP_ENTRIES: readonly ArenaShopEntry[] = ARENA_SHOP_CLASSES.flatMap(
  (classId) =>
    ARENA_SHOP_SLOTS.map((slot) => ({
      id: `arena_${classId}_${slot}`,
      classId,
      slot,
      price: ARENA_SHOP_PRICES[slot],
    })),
);

/** 圣痕碎片兑换：40 枚任选一件圣痕装备（docs/53 §4.2，非独占快车道）。 */
export const ARENA_FRAGMENT_EXCHANGE_COST = 40;

/** 奖励箱 id 与内容（docs/53 §4.2）。 */
export interface ArenaBoxReward {
  /** 荣誉印记数量区间 [min, max]，闭区间 */
  honor: { min: number; max: number };
  /** 物品 id → 数量（固定值）或 [min, max] 区间 */
  items: Readonly<Record<string, number | readonly [number, number]>>;
}

export interface ArenaBoxDef {
  id: 'box_starlight' | 'box_sacred';
  name: string;
  reward: ArenaBoxReward;
}

export const ARENA_BOXES: Readonly<Record<ArenaBoxDef['id'], ArenaBoxDef>> = {
  box_starlight: {
    id: 'box_starlight',
    name: '星辉匣',
    reward: {
      honor: { min: 30, max: 80 },
      items: {
        stone_reforge: [3, 8],
        sand_crystal: [1, 3],
      },
    },
  },
  box_sacred: {
    id: 'box_sacred',
    name: '圣痕匣',
    reward: {
      honor: { min: 120, max: 200 },
      items: {
        stone_reforge: 10,
        frag_stigma: [1, 3],
      },
    },
  },
} as const;

/** 段位每日奖励箱的发放规则在 arenaRules.ts 的 ARENA_TIERS.dailyBoxes。 */
export function arenaShopEntryPrice(entryId: string): number {
  const entry = ARENA_SHOP_ENTRIES.find((candidate) => candidate.id === entryId);
  if (!entry) throw new Error(`[配置错误] 荣誉商店货架不存在：${entryId}`);
  return entry.price;
}
