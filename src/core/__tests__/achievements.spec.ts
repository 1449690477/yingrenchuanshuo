import { describe, expect, it } from 'vitest';
import { ACHIEVEMENTS } from '@/data/achievements';
import {
  ACHIEVEMENT_BONUS_MAX_PERCENT,
  evaluateAchievements,
  type AchievementInput,
  type AchievementStat,
} from '../achievements';

const VALID_STATS = new Set<AchievementStat>([
  'totalKills',
  'bossKillKinds',
  'bossKills',
  'level',
  'cp',
  'gold',
  'equipmentCodexCount',
  'monsterCodexCount',
  'epicCount',
  'legendaryCount',
  'totalCodexCount',
  'clearedChapterCount',
  'clearedStageCount',
  'enhanceCount',
  'reforgeCount',
  'sweepCount',
  'affectionCount',
  'arenaCount',
]);

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
    ...overrides,
  };
}

describe('成就数据完整性', () => {
  it('恰好 80 条，id 唯一，字段合法', () => {
    expect(ACHIEVEMENTS).toHaveLength(80);
    const ids = new Set(ACHIEVEMENTS.map((def) => def.id));
    expect(ids.size).toBe(80);
    for (const def of ACHIEVEMENTS) {
      expect(def.label.length).toBeGreaterThan(0);
      expect(def.description.length).toBeGreaterThan(0);
      expect(def.target).toBeGreaterThanOrEqual(1);
      expect(['battle', 'growth', 'collect', 'explore', 'cultivate']).toContain(def.category);
      expect(VALID_STATS.has(def.stat)).toBe(true);
    }
  });

  it('每个统计口径都有成就引用（无死字段）', () => {
    const used = new Set(ACHIEVEMENTS.map((def) => def.stat));
    for (const stat of VALID_STATS) {
      expect(used.has(stat), `统计口径 ${stat} 无成就引用`).toBe(true);
    }
  });
});

describe('evaluateAchievements', () => {
  it('全 0 输入 → 0 条达成、0% 奖励', () => {
    const evaluation = evaluateAchievements(input());
    expect(evaluation.achievedCount).toBe(0);
    expect(evaluation.bonusPercent).toBe(0);
    expect(evaluation.results.every((result) => !result.achieved)).toBe(true);
  });

  it('进度 = min(当前值, 目标值)，达成后不再增长', () => {
    const partial = evaluateAchievements(input({ totalKills: 500 }));
    const kill1k = partial.results.find((result) => result.id === 'kill_1k')!;
    expect(kill1k.achieved).toBe(false);
    expect(kill1k.progress).toBe(500);

    const full = evaluateAchievements(input({ totalKills: 2000 }));
    const kill1kFull = full.results.find((result) => result.id === 'kill_1k')!;
    expect(kill1kFull.achieved).toBe(true);
    expect(kill1kFull.progress).toBe(1000);
  });

  it('派生类：击杀 / BOSS / 等级 / 战力 / 金币 / 图鉴 / 章节 / 关卡各自独立判定', () => {
    const evaluation = evaluateAchievements(
      input({
        totalKills: 10000,
        bossKillKinds: 5,
        bossKills: 50,
        level: 40,
        cp: 100000,
        gold: 1000000,
        equipmentCodexCount: 100,
        monsterCodexCount: 60,
        epicCount: 10,
        legendaryCount: 15,
        clearedChapterCount: 4,
        clearedStageCount: 120,
      }),
    );
    expect(evaluation.results.find((r) => r.id === 'kill_10k')!.achieved).toBe(true);
    expect(evaluation.results.find((r) => r.id === 'kill_50k')!.achieved).toBe(false);
    expect(evaluation.results.find((r) => r.id === 'boss_kind_5')!.achieved).toBe(true);
    expect(evaluation.results.find((r) => r.id === 'boss_kind_7')!.achieved).toBe(false);
    expect(evaluation.results.find((r) => r.id === 'boss_total_50')!.achieved).toBe(true);
    expect(evaluation.results.find((r) => r.id === 'level_40')!.achieved).toBe(true);
    expect(evaluation.results.find((r) => r.id === 'cp_100k')!.achieved).toBe(true);
    expect(evaluation.results.find((r) => r.id === 'gold_1m')!.achieved).toBe(true);
    expect(evaluation.results.find((r) => r.id === 'codex_eq_100')!.achieved).toBe(true);
    expect(evaluation.results.find((r) => r.id === 'codex_mon_60')!.achieved).toBe(true);
    expect(evaluation.results.find((r) => r.id === 'epic_10')!.achieved).toBe(true);
    expect(evaluation.results.find((r) => r.id === 'legendary_15')!.achieved).toBe(true);
    expect(evaluation.results.find((r) => r.id === 'chapter_4')!.achieved).toBe(true);
    expect(evaluation.results.find((r) => r.id === 'stage_120')!.achieved).toBe(true);
    expect(evaluation.results.find((r) => r.id === 'stage_150')!.achieved).toBe(false);
  });

  it('计数类（v27 字段）：强化 / 洗练 / 扫荡 / 好感 / 竞技独立判定', () => {
    const evaluation = evaluateAchievements(
      input({
        enhanceCount: 200,
        reforgeCount: 50,
        sweepCount: 1000,
        affectionCount: 200,
        arenaCount: 10,
      }),
    );
    expect(evaluation.results.find((r) => r.id === 'enhance_200')!.achieved).toBe(true);
    expect(evaluation.results.find((r) => r.id === 'enhance_500')!.achieved).toBe(false);
    expect(evaluation.results.find((r) => r.id === 'reforge_50')!.achieved).toBe(true);
    expect(evaluation.results.find((r) => r.id === 'sweep_1000')!.achieved).toBe(true);
    expect(evaluation.results.find((r) => r.id === 'affection_200')!.achieved).toBe(true);
    expect(evaluation.results.find((r) => r.id === 'arena_10')!.achieved).toBe(true);
  });

  it('档位奖励：24 条达成 → +0.5%，44 条 → +1.0%，80 条 → +2.0% 封顶', () => {
    const tier1 = evaluateAchievements(
      input({
        totalKills: 500000,
        bossKillKinds: 15,
        bossKills: 1000,
        level: 80,
      }),
    );
    expect(tier1.achievedCount).toBe(24);
    expect(tier1.bonusPercent).toBe(0.5);

    const tier2 = evaluateAchievements(
      input({
        totalKills: 500000,
        bossKillKinds: 15,
        bossKills: 1000,
        level: 80,
        cp: 1000000,
        gold: 1000000,
        equipmentCodexCount: 300,
        monsterCodexCount: 100,
      }),
    );
    expect(tier2.achievedCount).toBe(44);
    expect(tier2.bonusPercent).toBe(1.0);

    const full = evaluateAchievements(
      input({
        totalKills: 500000,
        bossKillKinds: 15,
        bossKills: 1000,
        level: 80,
        cp: 1000000,
        gold: 1000000,
        equipmentCodexCount: 300,
        monsterCodexCount: 100,
        epicCount: 30,
        legendaryCount: 30,
        totalCodexCount: 500,
        clearedChapterCount: 7,
        clearedStageCount: 180,
        enhanceCount: 1000,
        reforgeCount: 500,
        sweepCount: 1000,
        affectionCount: 200,
        arenaCount: 10,
      }),
    );
    expect(full.achievedCount).toBe(80);
    expect(full.bonusPercent).toBe(ACHIEVEMENT_BONUS_MAX_PERCENT);
  });

  it('19 条达成不升档，20 条达成升一档', () => {
    // 19 条：击杀 6 + BOSS 种类 6 + BOSS 次数 4 + 等级 3（10/20/30）
    const justBelow = evaluateAchievements(
      input({ totalKills: 500000, bossKillKinds: 15, bossKills: 1000, level: 30 }),
    );
    expect(justBelow.achievedCount).toBe(19);
    expect(justBelow.bonusPercent).toBe(0);

    const exactlyStep = evaluateAchievements(
      input({ totalKills: 500000, bossKillKinds: 15, bossKills: 1000, level: 40 }),
    );
    expect(exactlyStep.achievedCount).toBe(20);
    expect(exactlyStep.bonusPercent).toBe(0.5);
  });
});
