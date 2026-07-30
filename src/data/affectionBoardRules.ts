/**
 * 羁绊榜规则（docs/63 §三 · P2）。
 *
 * 口径：**四位角色心意点数之和**。不按单角色排 —— 那会逼玩家
 * 「选最优角色」，破坏 galgame 线的自主性；也不展示单角色明细 ——
 * 谁给谁刷了多少好感是私事，公开会制造攀比与窥私（docs/63 红线）。
 *
 * 所有上限都从数据现值推导，不写死数字：后续批次加幕、加礼物、
 * 加互动时防线自动跟上，不需要回来改这份文件。
 */

import { AFFECTION_CHARACTERS } from './affection';
import { AFFECTION_DATE_STORIES } from './affectionDates';
import { AFFECTION_GIFT_LIST } from './affectionGifts';
import { AFFECTION_RULES } from './affectionRules';
import { CLASS_IDS } from '@/core/types';

/** 单次互动 / 送礼可获得的最高心意（现值 18）。 */
export const AFFECTION_MAX_SINGLE_POINTS = Math.max(
  ...CLASS_IDS.flatMap((classId) =>
    AFFECTION_CHARACTERS[classId].interactions.map((entry) => entry.points),
  ),
  ...AFFECTION_GIFT_LIST.map((gift) => gift.points),
);

/** 单幕剧情完成的最高心意（现值 60，主剧情幕与约会幕共用同一档）。 */
export const AFFECTION_STORY_COMPLETION_POINTS = Math.max(
  ...CLASS_IDS.flatMap((classId) =>
    AFFECTION_CHARACTERS[classId].stories.map((story) => story.completionPoints),
  ),
  ...AFFECTION_DATE_STORIES.map((story) => story.completionPoints),
);

/** 每角色可完成的剧情幕总数上限（主剧情 + 约会；现值 9 + 3 = 12）。 */
export const AFFECTION_STORY_CAP_PER_CHARACTER = Math.max(
  ...CLASS_IDS.map(
    (classId) =>
      AFFECTION_CHARACTERS[classId].stories.length +
      AFFECTION_DATE_STORIES.filter((story) => story.classId === classId).length,
  ),
);

/** 每角色每日互动次数上限（北京 04:00 日切）。 */
export const AFFECTION_DAILY_INTERACTION_LIMIT = AFFECTION_RULES.dailyInteractionLimit;

/** 单角色心意上限（存档 schema 同值）。 */
export const AFFECTION_MAX_POINTS_PER_CHARACTER = AFFECTION_RULES.maxPoints;

/**
 * 合理性下界的宽松系数。
 *
 * 数学上真实玩家不可能触到下界（单次 ≤ 18、幕数 ≤ 12、日 ≤ 4 次全是
 * core 与存档 schema 的硬规则），1.0 倍就够；留 2 倍是防「未来单次
 * 点数上调而校验没跟上」的腐化，不是给作弊留门 —— 顶格 40 万心意
 * 需要上万次互动与上千天账龄，宽松系数救不了造假者。
 */
export const AFFECTION_PLAUSIBILITY_MARGIN = 2;
