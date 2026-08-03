import { describe, expect, it } from 'vitest';
import {
  alignDailyDungeonDay,
  canChallengeDailyDungeon,
  createDailyDungeonState,
  dailyDungeonOfDay,
  dailyDungeonReward,
  dailyDungeonThemeIdOfDay,
  unlockedDailyDungeonTiers,
  weekdayIndexOf,
  type DailyDungeonState,
  type DailyDungeonGateInput,
} from '../dailyDungeons';
import {
  DAILY_DUNGEON_THEMES,
  DAILY_DUNGEON_TIERS,
  DAILY_DUNGEON_THEME_BASE,
  DAILY_DUNGEON_UNLOCK_LEVEL,
  DAILY_DUNGEON_WEEK_ROTATION,
} from '@/data/dailyDungeons';
import { ENHANCE_MATERIAL_IDS } from '@/data/constants';

/** Lv15 刚解锁、无通过记录、今天没打过的新号。 */
const freshGate: DailyDungeonGateInput = { level: 15, clearedTierIds: [], todayRuns: {} };

describe('数据表一致性', () => {
  it('轮换表覆盖周一到周日 7 天，且主题 id 全部有定义', () => {
    expect(DAILY_DUNGEON_WEEK_ROTATION).toHaveLength(7);
    const themeIds = new Set(DAILY_DUNGEON_THEMES.map((theme) => theme.id));
    for (const themeId of DAILY_DUNGEON_WEEK_ROTATION) {
      expect(themeIds.has(themeId)).toBe(true);
    }
  });

  it('3 档难度逐级前置，等级门槛不低于副本开放等级', () => {
    expect(DAILY_DUNGEON_TIERS).toHaveLength(3);
    expect(DAILY_DUNGEON_TIERS[0]?.requiresTier ?? null).toBeNull();
    expect(DAILY_DUNGEON_TIERS[1]?.requiresTier).toBe('tier-1');
    expect(DAILY_DUNGEON_TIERS[2]?.requiresTier).toBe('tier-2');
    for (const tier of DAILY_DUNGEON_TIERS) {
      expect(tier.unlockLevel).toBeGreaterThanOrEqual(DAILY_DUNGEON_UNLOCK_LEVEL);
    }
  });

  it('主题材料全部复用既有强化材料 id（零新物品）', () => {
    const known = new Set<string>(Object.values(ENHANCE_MATERIAL_IDS));
    for (const theme of DAILY_DUNGEON_THEMES) {
      expect(known.has(theme.materialId)).toBe(true);
    }
  });
});

describe('星期推导（weekdayIndexOf）', () => {
  it('2026-08-03 是周一（下标 0），2026-08-09 是周日（下标 6）', () => {
    expect(weekdayIndexOf('2026-08-03')).toBe(0);
    expect(weekdayIndexOf('2026-08-09')).toBe(6);
  });

  it('拒绝非法 dayKey', () => {
    expect(() => weekdayIndexOf('2026/08/03')).toThrow('日切 key');
  });
});

describe('当日轮换（dailyDungeonOfDay）', () => {
  it('周一/三/六是强化石本，周二/四是黑铁矿本，周五/日是幸运本', () => {
    expect(dailyDungeonThemeIdOfDay('2026-08-03')).toBe('stone');
    expect(dailyDungeonThemeIdOfDay('2026-08-05')).toBe('stone');
    expect(dailyDungeonThemeIdOfDay('2026-08-08')).toBe('stone');
    expect(dailyDungeonThemeIdOfDay('2026-08-04')).toBe('ore');
    expect(dailyDungeonThemeIdOfDay('2026-08-06')).toBe('ore');
    expect(dailyDungeonThemeIdOfDay('2026-08-07')).toBe('lucky');
    expect(dailyDungeonThemeIdOfDay('2026-08-09')).toBe('lucky');
  });

  it('返回的主题定义与主题表同源', () => {
    const theme = dailyDungeonOfDay('2026-08-03');
    expect(theme.id).toBe('stone');
    expect(theme.materialId).toBe(ENHANCE_MATERIAL_IDS.stone);
  });
});

describe('难度门禁', () => {
  it('Lv15 新号只解锁普通档', () => {
    const tiers = unlockedDailyDungeonTiers(freshGate);
    expect(tiers.map((tier) => tier.id)).toEqual(['tier-1']);
  });

  it('Lv20 但没通过普通，仍只有普通档（前置未满足）', () => {
    const tiers = unlockedDailyDungeonTiers({ ...freshGate, level: 20 });
    expect(tiers.map((tier) => tier.id)).toEqual(['tier-1']);
  });

  it('Lv30 且通过普通+困难，三档全开', () => {
    const tiers = unlockedDailyDungeonTiers({
      level: 30,
      clearedTierIds: ['tier-1', 'tier-2'],
      todayRuns: {},
    });
    expect(tiers.map((tier) => tier.id)).toEqual(['tier-1', 'tier-2', 'tier-3']);
  });

  it('低于开放等级一律不可挑战', () => {
    const result = canChallengeDailyDungeon({ ...freshGate, level: 14 }, 'tier-1');
    expect(result).toEqual({ ok: false, reason: 'level-locked' });
  });

  it('前置未通过返回 tier-locked', () => {
    const result = canChallengeDailyDungeon({ ...freshGate, level: 25 }, 'tier-2');
    expect(result).toEqual({ ok: false, reason: 'tier-locked' });
  });

  it('今天该档已打过返回 runs-exhausted（每档各计一次）', () => {
    const gate: DailyDungeonGateInput = {
      level: 25,
      clearedTierIds: ['tier-1'],
      todayRuns: { 'tier-1': 1 },
    };
    expect(canChallengeDailyDungeon(gate, 'tier-1')).toEqual({
      ok: false,
      reason: 'runs-exhausted',
    });
    // 另一档不受影响
    expect(canChallengeDailyDungeon(gate, 'tier-2').ok).toBe(true);
  });

  it('未知难度返回 unknown-tier', () => {
    const result = canChallengeDailyDungeon(freshGate, 'tier-9' as never);
    expect(result).toEqual({ ok: false, reason: 'unknown-tier' });
  });

  it('非法等级直接抛错', () => {
    expect(() => unlockedDailyDungeonTiers({ ...freshGate, level: 0 })).toThrow('level');
  });
});

describe('奖励结算（dailyDungeonReward）', () => {
  it('强化石本普通档 = 基础产量 × 1 + 金币', () => {
    const reward = dailyDungeonReward('stone', 'tier-1');
    expect(reward.items[ENHANCE_MATERIAL_IDS.stone]).toBe(DAILY_DUNGEON_THEME_BASE.stone);
    expect(reward.gold).toBe(1500);
  });

  it('幸运本噩梦档 = 基础产量 × 2', () => {
    const reward = dailyDungeonReward('lucky', 'tier-3');
    expect(reward.items[ENHANCE_MATERIAL_IDS.lucky]).toBe(DAILY_DUNGEON_THEME_BASE.lucky * 2);
  });

  it('未知主题/难度抛错', () => {
    expect(() => dailyDungeonReward('none' as never, 'tier-1')).toThrow('主题');
    expect(() => dailyDungeonReward('stone', 'tier-9' as never)).toThrow('难度');
  });
});

describe('存档状态（DailyDungeonState）', () => {
  it('新建状态：day 空串 + 空通过记录 + 空今日次数', () => {
    const s = createDailyDungeonState();
    expect(s.day).toBe('');
    expect(s.clearedTierIds).toEqual([]);
    expect(s.todayRuns).toEqual({});
  });

  it('同日对齐幂等：原对象原样返回', () => {
    const s: DailyDungeonState = {
      day: '2026-08-03',
      clearedTierIds: ['tier-1'],
      todayRuns: { 'tier-1': 1 },
    };
    expect(alignDailyDungeonDay(s, '2026-08-03')).toBe(s);
  });

  it('跨日对齐：今日次数清零、历史通过难度保留、day 更新', () => {
    const s: DailyDungeonState = {
      day: '2026-08-03',
      clearedTierIds: ['tier-1'],
      todayRuns: { 'tier-1': 1, 'tier-2': 1 },
    };
    const next = alignDailyDungeonDay(s, '2026-08-04');
    expect(next.day).toBe('2026-08-04');
    expect(next.todayRuns).toEqual({});
    expect(next.clearedTierIds).toEqual(['tier-1']);
    // 入参不被修改
    expect(s.day).toBe('2026-08-03');
    expect(s.todayRuns).toEqual({ 'tier-1': 1, 'tier-2': 1 });
  });

  it('空串首次对齐即初始化当日状态', () => {
    const s = createDailyDungeonState();
    const first = alignDailyDungeonDay(s, '2026-08-03');
    expect(first.day).toBe('2026-08-03');
    expect(first.clearedTierIds).toEqual([]);
    expect(first.todayRuns).toEqual({});
  });

  it('非法 dayKey 抛错', () => {
    expect(() => alignDailyDungeonDay(createDailyDungeonState(), 'not-a-date')).toThrow(
      'dayKey',
    );
  });
});
