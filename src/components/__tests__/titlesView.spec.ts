/**
 * 称号展示面板（M4-9 展示侧）契约测试。
 *
 * 口径：纯展示身份系统（零属性零乘区），全部 16 个称号都要渲染，
 * 解锁态/进度与 evaluateUnlockedTitles 一致，文本来自 TITLES 权威表。
 */

import { readFileSync } from 'node:fs';
import { createSSRApp } from 'vue';
import { renderToString } from 'vue/server-renderer';
import { describe, expect, it } from 'vitest';
import { TITLES } from '@/data/titles';
import { evaluateUnlockedTitles } from '@/core/titles';
import type { AchievementInput } from '@/core/achievements';
import TitlesView from '@/views/TitlesView.vue';

const viewSource = readFileSync(new URL('../../views/TitlesView.vue', import.meta.url), 'utf8');

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

async function render(
  inputValue: AchievementInput,
  equippedTitleId: string | null = null,
): Promise<string> {
  return renderToString(
    createSSRApp(TitlesView, {
      unlockedTitles: evaluateUnlockedTitles(inputValue),
      equippedTitleId,
    }),
  );
}

describe('TitlesView 展示面板', () => {
  it('覆盖全部称号：16 个全部渲染，且文本来自 TITLES 权威表', async () => {
    const html = await render(input({ totalKills: 999999 }));
    for (const def of TITLES) {
      expect(html).toContain(def.name);
      expect(html).toContain(def.description);
    }
  });

  it('解锁态与进度与 evaluateUnlockedTitles 一致', async () => {
    const sample = input({
      totalKills: 10000,
      bossKillKinds: 3,
      level: 70,
      gold: 1_000_000,
      clearedChapterCount: 7,
      clearedStageCount: 180,
      monsterCodexCount: 80,
    });
    const results = evaluateUnlockedTitles(sample);
    const html = await render(sample);

    expect(html).toContain(`${results.filter((title) => title.unlocked).length}`);
    expect(html).toContain(`/ ${TITLES.length}`);
    for (const result of results) {
      const def = TITLES.find((item) => item.id === result.id)!;
      const expectedState = result.unlocked ? '已解锁' : '未解锁';
      expect(html).toContain(def.name);
      expect(html).toContain(expectedState);
      expect(html).toContain(`${result.progress} / ${def.target}`);
    }
  });

  it('零属性：不渲染任何百分比加成（纯展示身份系统）', async () => {
    const html = await render(input({ totalKills: 999999, level: 99 }));
    expect(html).not.toMatch(/\+[\d.]+%/);
  });

  it('视图不复制数值：target 一律来自 data 权威表', () => {
    expect(viewSource).toMatch(/from ['"]@\/data\/titles['"]/);
    expect(viewSource).not.toMatch(/target\s*:\s*\d/);
  });

  it('装备位：已装备称号显示「已装备 + 卸下」，其余已解锁称号显示「装备」，未解锁无按钮', async () => {
    const html = await render(input({ totalKills: 20000 }), 'slayer_10k');
    expect(html).toContain('已装备');
    expect(html).toContain('卸下');
    expect(html).toContain('装备');
    // slayer_100k 未解锁（2 万击杀 < 10 万）：其条目内不得出现装备按钮
    const slayer100kName = TITLES.find((title) => title.id === 'slayer_100k')!.name;
    const from100k = html.slice(html.indexOf(slayer100kName));
    expect(from100k.slice(0, from100k.indexOf('</li>'))).not.toContain('装备');
  });

  it('未装备时：已解锁称号只有「装备」，不出现「已装备 / 卸下」', async () => {
    const html = await render(input({ totalKills: 20000 }));
    expect(html).not.toContain('已装备');
    expect(html).not.toContain('卸下');
    expect(html).toContain('装备');
  });
});
