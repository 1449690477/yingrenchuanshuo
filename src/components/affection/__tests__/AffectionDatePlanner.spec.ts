import { createSSRApp, h } from 'vue';
import { renderToString } from 'vue/server-renderer';
import { describe, expect, it } from 'vitest';
import type { AffectionCharacterProgress } from '@/core/affection';
import { isAffectionStoryUnlocked } from '@/core/affection';
import { AFFECTION_CHARACTERS } from '@/data/affection';
import AffectionDatePlanner from '../AffectionDatePlanner.vue';

const character = AFFECTION_CHARACTERS.swordsman;

function makeProgress(points: number, completedStoryIds: string[]): AffectionCharacterProgress {
  return {
    points,
    mood: 'calm',
    dayKey: '2026-07-28',
    interactionsToday: 0,
    totalInteractions: 0,
    gearPity: 0,
    discoveredGearIds: [],
    completedStoryIds,
    choiceHistory: {},
  };
}

async function renderPlanner(points: number, completedStoryIds: string[]): Promise<string> {
  const progress = makeProgress(points, completedStoryIds);
  const stories = character.stories.map((story) => ({
    story,
    unlocked: isAffectionStoryUnlocked(progress, story),
    completed: progress.completedStoryIds.includes(story.id),
  }));
  const app = createSSRApp(h(AffectionDatePlanner, { stories, progress }));
  return renderToString(app);
}

const EPISODE_9_ID = 'aff_swordsman_09_reciprocal';
const EPISODE_10_ID = 'aff_swordsman_10_market';

describe('AffectionDatePlanner', () => {
  it('按上午/午后/夜晚顺序渲染三张约会卡', async () => {
    const html = await renderPlanner(0, []);
    expect(html).toContain('约会日程');
    expect(html.indexOf('上午')).toBeLessThan(html.indexOf('午后'));
    expect(html.indexOf('午后')).toBeLessThan(html.indexOf('夜晚'));
    expect(html).toContain('0 / 3');
  });

  it('心意不足时显示「需要 X 心意」且卡片禁用', async () => {
    const html = await renderPlanner(0, [EPISODE_9_ID]);
    expect(html).toContain('需要 3000 心意');
    expect(html).toContain('disabled');
  });

  it('心意足够但缺前置幕时显示「先完成上一幕」', async () => {
    const html = await renderPlanner(9_999, []);
    expect(html).toContain('先完成上一幕《');
  });

  it('已解锁未完成的约会显示「可赴约」并带 NEW 角标', async () => {
    const html = await renderPlanner(3_000, [EPISODE_9_ID]);
    expect(html).toContain('可赴约');
    expect(html).toContain('NEW');
  });

  it('已完成的约会显示「已珍藏 · 可再次回忆」并计入进度', async () => {
    const html = await renderPlanner(3_000, [EPISODE_9_ID, EPISODE_10_ID]);
    expect(html).toContain('已珍藏 · 可再次回忆');
    expect(html).toContain('1 / 3');
  });
});
