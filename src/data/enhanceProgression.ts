import type { LootEntry, LootResult, MonsterType } from '@/core/types';
import { ENHANCE_MATERIAL_IDS } from './constants';
import { REGION_5_ENHANCE_PROGRESSION } from './region5EnhanceProgression';
import { REGION_6_ENHANCE_PROGRESSION } from './region6EnhanceProgression';

const MATERIAL = {
  ...ENHANCE_MATERIAL_IDS,
  reforge: 'stone_reforge',
  resonance: 'crystal_resonance',
} as const;

export const ENHANCE_PROGRESSION_MATERIAL_IDS = [
  MATERIAL.stone,
  MATERIAL.ore,
  MATERIAL.lucky,
  MATERIAL.protection,
] as const;

export type EnhanceProgressionMaterialId = (typeof ENHANCE_PROGRESSION_MATERIAL_IDS)[number];

export interface EnhanceLootSource {
  readonly entries: readonly LootEntry[];
  readonly guaranteed: readonly LootEntry[];
}

export interface ChapterEnhanceProgression {
  chapterId: string;
  /** 该章通关时，普通玩家建议达到的全身强化等级。 */
  recommendedAllEnhance: number;
  /** 武器或当前主养装备建议达到的强化等级。 */
  recommendedMainEnhance: number;
  loot: Readonly<Record<MonsterType, EnhanceLootSource>>;
  firstClear: {
    /** 六个关卡逐级递增的强化石奖励。 */
    readonly stoneByStage: readonly [number, number, number, number, number, number];
    /** 第六关额外奖励；洗练石也放在这里，避免 stages.ts 再写另一套规则。 */
    readonly finalBonus: readonly LootResult[];
  };
}

function entry(
  itemId: string,
  weight: number,
  minCount: number,
  maxCount: number,
  pityCount?: number,
): LootEntry {
  return {
    itemId,
    weight,
    minCount,
    maxCount,
    ...(pityCount === undefined ? {} : { pityCount }),
  };
}

function guaranteed(itemId: string, minCount: number, maxCount: number): LootEntry {
  return entry(itemId, 0, minCount, maxCount);
}

function source(
  entries: readonly LootEntry[] = [],
  guaranteedEntries: readonly LootEntry[] = [],
): EnhanceLootSource {
  return { entries, guaranteed: guaranteedEntries };
}

function chapter(
  chapterId: string,
  recommendedAllEnhance: number,
  recommendedMainEnhance: number,
  stoneByStage: ChapterEnhanceProgression['firstClear']['stoneByStage'],
  loot: ChapterEnhanceProgression['loot'],
  finalBonus: readonly LootResult[] = [{ itemId: MATERIAL.reforge, count: 2 }],
): ChapterEnhanceProgression {
  return {
    chapterId,
    recommendedAllEnhance,
    recommendedMainEnhance,
    loot,
    firstClear: { stoneByStage, finalBonus },
  };
}

const EMPTY_SOURCE = source();

/**
 * 区域 1～2 的强化成长与材料来源。
 *
 * 权重仍由 LootTable 的统一权重池解释；配置旁的数值不在 store 或 UI 重复。
 * 非必掉高阶材料均带保底，避免玩家因长时间不出关键材料被永久卡住。
 */
export const ENHANCE_PROGRESSION: Record<string, ChapterEnhanceProgression> = {
  '1-1': chapter('1-1', 0, 2, [2, 3, 4, 5, 6, 8], {
    normal: source([entry(MATERIAL.stone, 170, 1, 2)]),
    elite: EMPTY_SOURCE,
    boss: EMPTY_SOURCE,
  }),
  '1-2': chapter('1-2', 1, 3, [3, 4, 5, 6, 8, 10], {
    normal: source([entry(MATERIAL.stone, 170, 1, 2)]),
    elite: EMPTY_SOURCE,
    boss: EMPTY_SOURCE,
  }),
  '1-3': chapter('1-3', 3, 5, [6, 8, 10, 12, 15, 20], {
    normal: source([entry(MATERIAL.stone, 180, 1, 3)]),
    elite: source([], [guaranteed(MATERIAL.stone, 3, 5)]),
    boss: EMPTY_SOURCE,
  }),
  '1-4': chapter(
    '1-4',
    4,
    6,
    [10, 12, 15, 18, 22, 30],
    {
      normal: source([entry(MATERIAL.stone, 190, 2, 3)]),
      elite: source([entry(MATERIAL.ore, 44, 1, 1, 3)], [guaranteed(MATERIAL.stone, 4, 6)]),
      boss: EMPTY_SOURCE,
    },
    [
      { itemId: MATERIAL.reforge, count: 2 },
      { itemId: MATERIAL.ore, count: 2 },
    ],
  ),
  '1-5': chapter(
    '1-5',
    5,
    8,
    [15, 18, 22, 26, 30, 50],
    {
      normal: source([entry(MATERIAL.stone, 210, 2, 4)]),
      elite: source([entry(MATERIAL.ore, 68, 1, 2, 2)], [guaranteed(MATERIAL.stone, 5, 8)]),
      boss: source(
        [entry(MATERIAL.lucky, 6, 1, 1, 9), entry(MATERIAL.protection, 3, 1, 1, 19)],
        [
          guaranteed(MATERIAL.stone, 20, 30),
          guaranteed(MATERIAL.reforge, 1, 3),
          guaranteed(MATERIAL.ore, 5, 8),
        ],
      ),
    },
    [
      { itemId: MATERIAL.reforge, count: 2 },
      { itemId: MATERIAL.ore, count: 10 },
      { itemId: MATERIAL.lucky, count: 1 },
      { itemId: MATERIAL.protection, count: 1 },
    ],
  ),
  '2-1': chapter(
    '2-1',
    5,
    8,
    [20, 24, 28, 32, 36, 50],
    {
      normal: source([entry(MATERIAL.stone, 220, 3, 5)]),
      elite: EMPTY_SOURCE,
      boss: EMPTY_SOURCE,
    },
    [
      { itemId: MATERIAL.reforge, count: 2 },
      { itemId: MATERIAL.ore, count: 3 },
    ],
  ),
  '2-2': chapter(
    '2-2',
    6,
    9,
    [28, 32, 36, 42, 48, 60],
    {
      normal: source([entry(MATERIAL.stone, 230, 4, 6)]),
      elite: source([entry(MATERIAL.ore, 34, 1, 1, 4)], [guaranteed(MATERIAL.stone, 6, 10)]),
      boss: EMPTY_SOURCE,
    },
    [
      { itemId: MATERIAL.reforge, count: 2 },
      { itemId: MATERIAL.ore, count: 5 },
    ],
  ),
  '2-3': chapter(
    '2-3',
    7,
    9,
    [36, 42, 48, 55, 62, 75],
    {
      normal: source([entry(MATERIAL.stone, 250, 4, 7)]),
      elite: source([entry(MATERIAL.ore, 55, 1, 2, 3)], [guaranteed(MATERIAL.stone, 8, 12)]),
      boss: EMPTY_SOURCE,
    },
    [
      { itemId: MATERIAL.reforge, count: 2 },
      { itemId: MATERIAL.ore, count: 8 },
    ],
  ),
  '2-4': chapter(
    '2-4',
    8,
    10,
    [48, 55, 62, 70, 80, 100],
    {
      normal: source([entry(MATERIAL.stone, 275, 5, 8)]),
      elite: source([], [guaranteed(MATERIAL.stone, 10, 15), guaranteed(MATERIAL.ore, 2, 3)]),
      boss: EMPTY_SOURCE,
    },
    [
      { itemId: MATERIAL.reforge, count: 2 },
      { itemId: MATERIAL.ore, count: 12 },
    ],
  ),
  '2-5': chapter(
    '2-5',
    9,
    10,
    [60, 70, 80, 90, 100, 150],
    {
      normal: source([entry(MATERIAL.stone, 275, 6, 10)]),
      elite: source([], [guaranteed(MATERIAL.stone, 12, 18), guaranteed(MATERIAL.ore, 3, 5)]),
      boss: source(
        [entry(MATERIAL.lucky, 18, 1, 1, 3), entry(MATERIAL.protection, 10, 1, 1, 5)],
        [
          guaranteed(MATERIAL.stone, 40, 60),
          guaranteed(MATERIAL.reforge, 2, 4),
          guaranteed(MATERIAL.ore, 12, 18),
        ],
      ),
    },
    [
      { itemId: MATERIAL.reforge, count: 2 },
      { itemId: MATERIAL.ore, count: 30 },
      { itemId: MATERIAL.lucky, count: 2 },
      { itemId: MATERIAL.protection, count: 2 },
    ],
  ),

  // ── 区域 3 虫娘洞窟（Lv20-30）──
  // 推荐档位必须从区域 2 收尾的 9 / 10 继续递增，不能回落；
  // 精英掉落只配给真正有精英的章节（3-2 / 3-5），否则会生成不可触达的掉落表。
  '3-1': chapter('3-1', 9, 10, [110, 125, 140, 155, 170, 240], {
    normal: source([entry(MATERIAL.stone, 300, 8, 13)]),
    elite: EMPTY_SOURCE,
    boss: EMPTY_SOURCE,
  }),
  '3-2': chapter('3-2', 9, 11, [125, 140, 155, 170, 190, 265], {
    normal: source([entry(MATERIAL.stone, 305, 9, 14)]),
    elite: source(
      [entry(MATERIAL.ore, 24, 1, 2, 4)],
      [guaranteed(MATERIAL.stone, 18, 26), guaranteed(MATERIAL.ore, 4, 7)],
    ),
    boss: EMPTY_SOURCE,
  }),
  '3-3': chapter('3-3', 10, 11, [140, 155, 175, 190, 210, 290], {
    normal: source([entry(MATERIAL.stone, 310, 10, 15)]),
    elite: EMPTY_SOURCE,
    boss: EMPTY_SOURCE,
  }),
  '3-4': chapter('3-4', 10, 12, [155, 175, 195, 210, 230, 320], {
    normal: source([entry(MATERIAL.stone, 315, 11, 16)]),
    elite: EMPTY_SOURCE,
    boss: EMPTY_SOURCE,
  }),
  '3-5': chapter(
    '3-5',
    10,
    12,
    [175, 195, 215, 235, 260, 360],
    {
      normal: source([entry(MATERIAL.stone, 320, 12, 18)]),
      elite: source([], [guaranteed(MATERIAL.stone, 24, 34), guaranteed(MATERIAL.ore, 7, 11)]),
      boss: source(
        [entry(MATERIAL.lucky, 22, 1, 2, 3), entry(MATERIAL.protection, 13, 1, 1, 4)],
        [
          guaranteed(MATERIAL.stone, 55, 80),
          guaranteed(MATERIAL.reforge, 3, 5),
          guaranteed(MATERIAL.ore, 16, 24),
        ],
      ),
    },
    [
      { itemId: MATERIAL.reforge, count: 3 },
      { itemId: MATERIAL.ore, count: 40 },
      { itemId: MATERIAL.lucky, count: 3 },
      { itemId: MATERIAL.protection, count: 2 },
    ],
  ),

  // ── 区域 4 月下墓园（Lv30-40）──
  // 保护符从「首通奖励」转为精英与 BOSS 的常规低概率产出，
  // 支撑玩家第一次尝试冲 +13 以上。精英章节为 4-2 / 4-4 / 4-5。
  '4-1': chapter('4-1', 11, 12, [200, 225, 250, 275, 300, 420], {
    normal: source([entry(MATERIAL.stone, 325, 14, 20)]),
    elite: EMPTY_SOURCE,
    boss: EMPTY_SOURCE,
  }),
  '4-2': chapter('4-2', 11, 13, [225, 250, 275, 300, 330, 460], {
    normal: source([entry(MATERIAL.stone, 330, 15, 22)]),
    elite: source(
      [entry(MATERIAL.ore, 28, 2, 4, 4), entry(MATERIAL.protection, 6, 1, 1, 8)],
      [guaranteed(MATERIAL.stone, 30, 42), guaranteed(MATERIAL.ore, 9, 14)],
    ),
    boss: EMPTY_SOURCE,
  }),
  '4-3': chapter('4-3', 11, 13, [250, 275, 305, 330, 365, 505], {
    normal: source([entry(MATERIAL.stone, 335, 16, 24)]),
    elite: EMPTY_SOURCE,
    boss: EMPTY_SOURCE,
  }),
  '4-4': chapter('4-4', 12, 14, [275, 305, 335, 365, 400, 555], {
    normal: source([entry(MATERIAL.stone, 340, 18, 26)]),
    elite: source(
      [entry(MATERIAL.ore, 30, 3, 5, 3), entry(MATERIAL.lucky, 8, 1, 1, 6)],
      [guaranteed(MATERIAL.stone, 35, 48), guaranteed(MATERIAL.ore, 11, 17)],
    ),
    boss: EMPTY_SOURCE,
  }),
  '4-5': chapter(
    '4-5',
    12,
    14,
    [305, 335, 370, 400, 440, 610],
    {
      normal: source([entry(MATERIAL.stone, 345, 20, 28)]),
      elite: source([], [guaranteed(MATERIAL.stone, 38, 52), guaranteed(MATERIAL.ore, 13, 19)]),
      boss: source(
        [entry(MATERIAL.lucky, 26, 2, 3, 3), entry(MATERIAL.protection, 16, 1, 2, 3)],
        [
          guaranteed(MATERIAL.stone, 75, 105),
          guaranteed(MATERIAL.reforge, 4, 6),
          guaranteed(MATERIAL.ore, 22, 32),
        ],
      ),
    },
    [
      { itemId: MATERIAL.reforge, count: 4 },
      { itemId: MATERIAL.ore, count: 55 },
      { itemId: MATERIAL.lucky, count: 4 },
      { itemId: MATERIAL.protection, count: 3 },
    ],
  ),
  ...REGION_5_ENHANCE_PROGRESSION,
  ...REGION_6_ENHANCE_PROGRESSION,
};


export function getEnhanceProgression(chapterId: string): ChapterEnhanceProgression | undefined {
  return ENHANCE_PROGRESSION[chapterId];
}

export function requireEnhanceProgression(chapterId: string): ChapterEnhanceProgression {
  const progression = getEnhanceProgression(chapterId);
  if (!progression) throw new Error(`[配置错误] 章节缺少强化成长配置：${chapterId}`);
  return progression;
}

/** 生成一关的首通强化奖励，返回副本以防调用方修改共享配置。 */
export function enhanceFirstClearRewards(
  chapterId: string,
  stageIndex: number,
  isBossStage: boolean,
): LootResult[] {
  if (!Number.isInteger(stageIndex) || stageIndex < 0 || stageIndex >= 6) {
    throw new Error(`[配置错误] 首通奖励关卡索引必须在 0~5：${stageIndex}`);
  }

  const firstClear = requireEnhanceProgression(chapterId).firstClear;
  const rewards: LootResult[] = [
    {
      itemId: MATERIAL.stone,
      count: firstClear.stoneByStage[stageIndex]!,
    },
  ];
  if (stageIndex === 5 && isBossStage) {
    rewards.push({ itemId: MATERIAL.resonance, count: 1 });
  }
  if (stageIndex === 5) {
    rewards.push(...firstClear.finalBonus.map((reward) => ({ ...reward })));
  }
  return rewards;
}
