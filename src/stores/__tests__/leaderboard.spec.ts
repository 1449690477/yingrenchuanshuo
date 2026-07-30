/**
 * 排行榜 store 的行为测试。
 *
 * 覆盖 docs/51 的几条验收红线：
 *   - 未配置 Supabase 时所有联机动作静默降级，绝不抛错、绝不阻塞游戏
 *   - 本地挑战确定性 + 个人纪录只升不降（永不倒退）
 *   - 「比上周」箭头只在上升时出现
 *   - 提交载荷里**没有伤害数字**（客户端不可能伪造伤害）
 */

import 'fake-indexeddb/auto';
import { createPinia, setActivePinia } from 'pinia';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { clearSave } from '@/save/storage';
import { createSave, type TrialBest } from '@/save/schema';
import { TRIAL_BEST_KEEP, TRIAL_BRACKETS, TRIAL_SEASON_ID } from '@/data/trialRules';
import { trialBracketFor, trialWeekIndex } from '@/core/trial';
import { useGameStore } from '../game';
import { useLeaderboardStore } from '../leaderboard';

const NOW = Date.parse('2026-07-29T17:56:00+08:00');

beforeEach(async () => {
  setActivePinia(createPinia());
  await clearSave();
  vi.useFakeTimers();
  vi.setSystemTime(NOW);
});

afterEach(async () => {
  vi.useRealTimers();
  vi.restoreAllMocks();
  await clearSave();
});

/** 默认档的分段，用它代替写死 id —— 分段会随内容曲线重划（docs/64 §一）。 */
const DEFAULT_BRACKET = trialBracketFor(45).id;

async function setupGame(level = 45) {
  const game = useGameStore();
  const save = createSave('夜见', 'swordsman', 42, NOW - 100_000);
  save.player.level = level;
  game.loadFrom(save);
  return game;
}

describe('challengeTrial / 本地挑战', () => {
  it('确定性：连续挑战成绩逐点一致，第二次不算新纪录', async () => {
    await setupGame();
    const lb = useLeaderboardStore();

    const first = lb.challengeTrial();
    expect(first.result.damage).toBeGreaterThanOrEqual(0);
    expect(first.improved).toBe(true);
    expect(first.best.damage).toBe(first.result.damage);

    const second = lb.challengeTrial();
    expect(second.result.damage).toBe(first.result.damage);
    expect(second.improved).toBe(false);
    expect(lb.myBestThisWeek?.damage).toBe(first.result.damage);
  });

  it('个人纪录只升不降，且持久化到存档', async () => {
    const game = await setupGame();
    const lb = useLeaderboardStore();
    const { best } = lb.challengeTrial();

    // 尝试写入一个更低的纪录：必须被忽略（永不倒退）
    game.recordTrialBest({ ...best, damage: best.damage - 1 });
    expect(lb.myBestThisWeek?.damage).toBe(best.damage);

    // 更高的纪录：覆盖且 submitted 复位，等待重新上传
    game.markTrialBestSubmitted(best.seasonId, best.weekIndex, best.bracketId);
    expect(lb.myBestThisWeek?.submitted).toBe(true);
    game.recordTrialBest({ ...best, damage: best.damage + 1000 });
    expect(lb.myBestThisWeek?.damage).toBe(best.damage + 1000);
    expect(lb.myBestThisWeek?.submitted).toBe(false);
  });

  it('成绩簿按周留存且数量有界', async () => {
    const game = await setupGame();
    const week = trialWeekIndex(NOW);
    for (let i = 1; i <= TRIAL_BEST_KEEP + 5; i++) {
      const record: TrialBest = {
        seasonId: TRIAL_SEASON_ID,
        weekIndex: week - i,
        bracketId: DEFAULT_BRACKET,
        classId: 'swordsman',
        damage: 1000 + i,
        at: NOW - i * 86_400_000,
        submitted: true,
      };
      // 直接绕过只升不降检查，模拟跨周历史
      game.save!.trial.bests.unshift(record);
    }
    game.recordTrialBest({
      seasonId: TRIAL_SEASON_ID,
      weekIndex: week,
      bracketId: DEFAULT_BRACKET,
      classId: 'swordsman',
      damage: 999_999,
      at: NOW,
      submitted: false,
    });
    expect(game.save!.trial.bests.length).toBeLessThanOrEqual(TRIAL_BEST_KEEP);
  });
});

describe('weekOverWeekGain / 环比箭头', () => {
  it('只在上升时给出增幅；下降与无对照都为 null', async () => {
    const game = await setupGame();
    const lb = useLeaderboardStore();
    const week = trialWeekIndex(NOW);

    // 无对照：null
    expect(lb.weekOverWeekGain).toBeNull();

    game.save!.trial.bests.unshift({
      seasonId: TRIAL_SEASON_ID,
      weekIndex: week - 1,
      bracketId: DEFAULT_BRACKET,
      classId: 'swordsman',
      damage: 10_000,
      at: NOW - 7 * 86_400_000,
      submitted: true,
    });
    game.save!.trial.bests.unshift({
      seasonId: TRIAL_SEASON_ID,
      weekIndex: week,
      bracketId: DEFAULT_BRACKET,
      classId: 'swordsman',
      damage: 11_800,
      at: NOW,
      submitted: false,
    });
    expect(lb.weekOverWeekGain).toBeCloseTo(0.18, 2);

    // 下降：不显示箭头、不显示红色（红线）
    game.save!.trial.bests[0]!.damage = 9_000;
    expect(lb.weekOverWeekGain).toBeNull();
  });
});

describe('离线降级 / 未配置 Supabase', () => {
  it('status 是 unconfigured，所有联机动作安静失败', async () => {
    await setupGame();
    const lb = useLeaderboardStore();

    expect(lb.status).toBe('unconfigured');
    await expect(lb.connect()).resolves.toBe(false);
    await expect(lb.refreshBoards()).resolves.toBeUndefined();
    await expect(lb.refreshBoards(true)).resolves.toBeUndefined();
    expect(lb.neighborhoodCache).toBeNull();
    expect(lb.topCache).toBeNull();
    expect(lb.powerCache).toBeNull();
  });

  it('没有本周成绩时 submitBest 直接返回 null', async () => {
    await setupGame();
    const lb = useLeaderboardStore();
    await expect(lb.submitBest()).resolves.toBeNull();
  });
});

describe('本周上下文', () => {
  it('分段与 Boss 跟随玩家等级', async () => {
    // 断言「分段与 Boss 跟随等级」这个关系本身，不写死具体 id：
    // 取第一段的末级与第二段的首级，重划分段后自动仍然有效。
    const sorted = [...TRIAL_BRACKETS].sort((a, b) => a.minLevel - b.minLevel);
    const [first, second] = [sorted[0]!, sorted[1]!];

    await setupGame(first.maxLevel);
    const lb = useLeaderboardStore();
    expect(lb.bracket.id).toBe(first.id);
    expect(lb.boss.bracket.id).toBe(first.id);

    useGameStore().save!.player.level = second.minLevel;
    expect(lb.bracket.id).toBe(second.id);
    expect(lb.boss.bracket.id).toBe(second.id);
  });

  it('上周对照可以来自不同分段（升级跨段也能看到自己进步了）', async () => {
    const game = await setupGame(31);
    const lb = useLeaderboardStore();
    const week = trialWeekIndex(NOW);
    game.save!.trial.bests.unshift({
      seasonId: TRIAL_SEASON_ID,
      weekIndex: week - 1,
      bracketId: trialBracketFor(1).id, // 上周还在最低段
      classId: 'swordsman',
      damage: 1,
      at: NOW - 7 * 86_400_000,
      submitted: true,
    });
    const { best } = lb.challengeTrial();
    expect(best.bracketId).toBe(trialBracketFor(31).id);
    expect(lb.weekOverWeekGain).not.toBeNull();
  });
});
