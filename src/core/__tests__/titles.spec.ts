import { describe, expect, it } from 'vitest';
import { TITLES } from '@/data/titles';
import { evaluateUnlockedTitles, isTitleEquippable } from '../titles';
import type { AchievementInput } from '../achievements';

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

describe('称号数据完整性', () => {
  it('16 个称号，id 唯一，名称与目标合法', () => {
    expect(TITLES).toHaveLength(16);
    const ids = new Set(TITLES.map((title) => title.id));
    expect(ids.size).toBe(16);
    for (const title of TITLES) {
      expect(title.name.length).toBeGreaterThan(0);
      expect(title.description.length).toBeGreaterThan(0);
      expect(title.target).toBeGreaterThanOrEqual(1);
    }
  });
});

describe('evaluateUnlockedTitles', () => {
  it('全 0 输入 → 全部未解锁', () => {
    const results = evaluateUnlockedTitles(input());
    expect(results).toHaveLength(16);
    expect(results.every((result) => !result.unlocked)).toBe(true);
  });

  it('里程碑达标 → 对应称号解锁，进度封顶', () => {
    const results = evaluateUnlockedTitles(
      input({
        totalKills: 20000,
        level: 80,
        clearedChapterCount: 7,
        enhanceCount: 500,
      }),
    );
    const slayer10k = results.find((r) => r.id === 'slayer_10k')!;
    expect(slayer10k.unlocked).toBe(true);
    expect(slayer10k.progress).toBe(10000);
    expect(results.find((r) => r.id === 'slayer_100k')!.unlocked).toBe(false);
    expect(results.find((r) => r.id === 'legend_80')!.unlocked).toBe(true);
    expect(results.find((r) => r.id === 'wanderer')!.unlocked).toBe(true);
    expect(results.find((r) => r.id === 'grand_smith')!.unlocked).toBe(true);
    expect(results.find((r) => r.id === 'million_cp')!.unlocked).toBe(false);
  });

  it('进度 = min(当前值, 目标值)，未达标时如实展示', () => {
    const results = evaluateUnlockedTitles(input({ totalKills: 5000 }));
    expect(results.find((r) => r.id === 'slayer_10k')!.progress).toBe(5000);
  });
});

describe('isTitleEquippable', () => {
  it('已解锁可装备；未解锁 / 未知 id 不可装备', () => {
    const unlocked = new Set(['slayer_10k']);
    expect(isTitleEquippable('slayer_10k', unlocked)).toBe(true);
    expect(isTitleEquippable('legend_80', unlocked)).toBe(false);
    expect(isTitleEquippable('no_such_title', unlocked)).toBe(false);
  });
});
