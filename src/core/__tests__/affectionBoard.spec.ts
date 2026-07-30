/**
 * 羁绊榜纯逻辑与数据推导的契约测试（docs/63 §三）。
 *
 * 防两类事故：
 *   1. 下界校验误伤真实玩家（真实极限值必须离下界有数量级距离）
 *   2. 上限常量与好感数据脱节（数据批次加幕后推导值必须自动跟上）
 */

import { describe, expect, it } from 'vitest';
import {
  affectionTotalPoints,
  formatAffectionTotal,
  isAffectionClaimWellFormed,
  isPlausibleAffectionClaim,
  type AffectionBoardClaim,
} from '@/core/affectionBoard';
import {
  AFFECTION_DAILY_INTERACTION_LIMIT,
  AFFECTION_MAX_POINTS_PER_CHARACTER,
  AFFECTION_MAX_SINGLE_POINTS,
  AFFECTION_PLAUSIBILITY_MARGIN,
  AFFECTION_STORY_CAP_PER_CHARACTER,
  AFFECTION_STORY_COMPLETION_POINTS,
} from '@/data/affectionBoardRules';
import { AFFECTION_CHARACTERS } from '@/data/affection';
import { AFFECTION_DATE_STORIES } from '@/data/affectionDates';
import { CLASS_IDS } from '@/core/types';

const DAY_MS = 86_400_000;

function claim(partial: Partial<AffectionBoardClaim> = {}): AffectionBoardClaim {
  return { points: 0, totalInteractions: 0, storyCount: 0, ...partial };
}

describe('羁绊榜常量（从数据推导，不硬编码）', () => {
  it('单次上限 = 互动与礼物的现值最大 18', () => {
    expect(AFFECTION_MAX_SINGLE_POINTS).toBe(18);
  });

  it('单幕上限 = 主剧情与约会幕的现值最大 60', () => {
    expect(AFFECTION_STORY_COMPLETION_POINTS).toBe(60);
  });

  it('每角色幕数上限 = 主剧情幕数 + 该角色约会幕数，且与数据一致', () => {
    for (const classId of CLASS_IDS) {
      const mainCount = AFFECTION_CHARACTERS[classId].stories.length;
      const dateCount = AFFECTION_DATE_STORIES.filter((s) => s.classId === classId).length;
      expect(mainCount + dateCount).toBeLessThanOrEqual(AFFECTION_STORY_CAP_PER_CHARACTER);
    }
    // 现值 12 + 3 = 15；后续批次加幕时这个断言逼着下界公式一起动
    expect(AFFECTION_STORY_CAP_PER_CHARACTER).toBe(15);
  });

  it('日互动上限与单角色心意上限取自同一份规则', () => {
    expect(AFFECTION_DAILY_INTERACTION_LIMIT).toBe(4);
    expect(AFFECTION_MAX_POINTS_PER_CHARACTER).toBe(99_999);
    expect(AFFECTION_PLAUSIBILITY_MARGIN).toBeGreaterThanOrEqual(1.5);
  });
});

describe('affectionTotalPoints', () => {
  it('总分 = 四角色心意之和', () => {
    const claims = [
      claim({ points: 100 }),
      claim({ points: 200 }),
      claim({ points: 0 }),
      claim({ points: 3 }),
    ];
    expect(affectionTotalPoints(claims)).toBe(303);
    expect(affectionTotalPoints([])).toBe(0);
  });

  it('展示格式带千分位与单位', () => {
    expect(formatAffectionTotal(12345)).toBe('12,345 心意');
    expect(formatAffectionTotal(0)).toBe('0 心意');
  });
});

describe('isAffectionClaimWellFormed（结构合法性）', () => {
  it('合法快照通过', () => {
    expect(isAffectionClaimWellFormed(claim({ points: 500, totalInteractions: 40, storyCount: 6 }))).toBe(true);
  });

  it.each([
    ['负点数', claim({ points: -1 })],
    ['点数超上限', claim({ points: 100_000 })],
    ['点数为小数', claim({ points: 1.5 })],
    ['负互动数', claim({ totalInteractions: -1 })],
    ['幕数为负', claim({ storyCount: -1 })],
    ['幕数超上限', claim({ storyCount: AFFECTION_STORY_CAP_PER_CHARACTER + 1 })],
  ])('%s 一律不合法', (_label, input) => {
    expect(isAffectionClaimWellFormed(input)).toBe(false);
  });
});

describe('isPlausibleAffectionClaim（合理性下界）', () => {
  it('30 天满勤满幕的真实肝帝通过：每天 4 次全送 18 点礼物 + 12 幕全通', () => {
    const hardcore = claim({
      totalInteractions: 4 * 30,
      points: 4 * 30 * 18 + 12 * 60, // 2880，理论满值
      storyCount: 12,
    });
    expect(isPlausibleAffectionClaim(hardcore, 30 * DAY_MS)).toBe(true);
  });

  it('真实玩家理论满值距下界有数量级余量（防误伤断言）', () => {
    // 构造 30 天的理论满值，下界必须至少是它的 2 倍
    const theoreticalMax =
      4 * 30 * AFFECTION_MAX_SINGLE_POINTS + 12 * AFFECTION_STORY_COMPLETION_POINTS;
    const cap =
      (4 * 31 * AFFECTION_MAX_SINGLE_POINTS + 12 * AFFECTION_STORY_COMPLETION_POINTS) *
      AFFECTION_PLAUSIBILITY_MARGIN;
    expect(cap).toBeGreaterThanOrEqual(theoreticalMax * 2);
  });

  it('新号顶格 99999 是荒谬声明，拒', () => {
    const cheater = claim({ points: 99_999, totalInteractions: 10_000, storyCount: 12 });
    expect(isPlausibleAffectionClaim(cheater, 1 * DAY_MS)).toBe(false);
  });

  it('虚报互动次数超日上限，拒（否则次数下界形同虚设）', () => {
    const liar = claim({ points: 10_000, totalInteractions: 4 * 30 * 3, storyCount: 0 });
    expect(isPlausibleAffectionClaim(liar, 10 * DAY_MS)).toBe(false);
  });

  it('幕数超上限由结构校验挡下，合理性同样拒', () => {
    const impossible = claim({ points: 100, totalInteractions: 10, storyCount: 99 });
    expect(isPlausibleAffectionClaim(impossible, 365 * DAY_MS)).toBe(false);
  });

  it('首日账号当天 4 次互动 + 0 幕的真实新手通过', () => {
    const newbie = claim({ points: 4 * 10, totalInteractions: 4, storyCount: 0 });
    expect(isPlausibleAffectionClaim(newbie, 0)).toBe(true);
  });
});
