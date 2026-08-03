/**
 * 成就展示面板（M4-7 展示侧）契约测试。
 *
 * 口径：面板只消费 core 评估结果与 data 权威表，全部 80 条都要渲染，
 * 解锁态/进度/档位奖励与 evaluateAchievements 输出一致。
 */

import { readFileSync } from 'node:fs';
import { createSSRApp } from 'vue';
import { renderToString } from 'vue/server-renderer';
import { describe, expect, it } from 'vitest';
import { ACHIEVEMENTS } from '@/data/achievements';
import { evaluateAchievements, type AchievementInput } from '@/core/achievements';
import AchievementsView from '@/views/AchievementsView.vue';

const viewSource = readFileSync(new URL('../../views/AchievementsView.vue', import.meta.url), 'utf8');

function input(overrides: Partial<AchievementInput> = {}): AchievementInput {
  return {
    totalKills: 0,
    bossKillKinds: 0,
    bossKills: 0,
    level: 0,
    cp: 0,
    gold: 0,
    equipmentCodexCount: 0,
    monsterCodexCount: 0,
    epicCount: 0,
    legendaryCount: 0,
    totalCodexCount: 0,
    clearedChapterCount: 0,
    clearedStageCount: 0,
    enhanceCount: 0,
    reforgeCount: 0,
    sweepCount: 0,
    affectionCount: 0,
    arenaCount: 0,
    dungeonCount: 0,
    ...overrides,
  };
}

async function render(inputValue: AchievementInput): Promise<string> {
  return renderToString(
    createSSRApp(AchievementsView, { evaluation: evaluateAchievements(inputValue) }),
  );
}

describe('AchievementsView 展示面板', () => {
  it('覆盖全部成就：80 条全部渲染，且名称来自 ACHIEVEMENTS 权威表', async () => {
    const html = await render(input({ totalKills: 999999, bossKillKinds: 99, bossKills: 9999 }));
    for (const def of ACHIEVEMENTS) {
      expect(html).toContain(def.label);
      expect(html).toContain(def.description);
    }
  });

  it('解锁态与进度与 evaluateAchievements 一致', async () => {
    const sample = input({
      totalKills: 5000,
      bossKillKinds: 1,
      level: 20,
      gold: 2_000_000,
      clearedStageCount: 30,
    });
    const evaluation = evaluateAchievements(sample);
    const html = await render(sample);

    expect(html).toContain(`${evaluation.achievedCount}`);
    expect(html).toContain(`/ ${ACHIEVEMENTS.length}`);
    for (const result of evaluation.results) {
      const def = ACHIEVEMENTS.find((item) => item.id === result.id)!;
      const expectedState = result.achieved ? '已达成' : '未达成';
      expect(html).toContain(def.label);
      expect(html).toContain(expectedState);
      expect(html).toContain(`${result.progress} / ${def.target}`);
    }
  });

  it('档位奖励预览与评估输出的 bonusPercent 一致', async () => {
    const sample = input({
      totalKills: 100000,
      bossKillKinds: 5,
      bossKills: 60,
      level: 80,
      cp: 1_200_000,
      gold: 2_000_000,
      clearedChapterCount: 7,
      clearedStageCount: 200,
    });
    const evaluation = evaluateAchievements(sample);
    const html = await render(sample);
    expect(html).toContain(`+${evaluation.bonusPercent.toFixed(1)}%`);
  });

  it('视图不复制数值：不出现与 data 无关的硬编码目标数', () => {
    // 面板的 target 一律来自 data/achievements；这里钉住它不内联数字。
    expect(viewSource).toMatch(/from ['"]@\/data\/achievements['"]/);
    expect(viewSource).not.toMatch(/target\s*:\s*\d/);
  });
});
