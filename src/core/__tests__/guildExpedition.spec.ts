import { describe, expect, it } from 'vitest';
import {
  guildBossThemeSeed,
  guildContributionPoints,
  guildDayKey,
  guildDisplayStage,
  guildExpeditionBoss,
  guildRunSeed,
  guildWeeklyTarget,
  guildWeekKey,
} from '../guildExpedition';
import { GUILD_CONTRIBUTION_MAX, GUILD_WEEKLY_TARGET_PER_MEMBER } from '@/data/guildRules';
import {
  TRIAL_BOSS_HP_HEADROOM,
  TRIAL_BRACKETS,
  TRIAL_DURATION_SEC,
} from '@/data/trialRules';
import { estimateDps } from '../combat';
import { addStats } from '../formula';
import { applyClassMods, baseStatsFor, makePlayer } from '../progression';
import { expectedGearStats, typicalQualityAt } from '@/data/expectedPower';
import { buildDefaultPlayerSkillKit } from '../playerSkillKit';

describe('公会远征时间边界', () => {
  it('按北京时间 04:00 切日', () => {
    expect(guildDayKey(Date.UTC(2026, 6, 29, 19, 59, 59))).toBe('2026-07-29');
    expect(guildDayKey(Date.UTC(2026, 6, 29, 20, 0, 0))).toBe('2026-07-30');
  });

  it('周一 04:00 后切换周键', () => {
    const before = guildWeekKey('s1', Date.UTC(2026, 6, 26, 19, 59, 59));
    const after = guildWeekKey('s1', Date.UTC(2026, 6, 26, 20, 0, 0));
    expect(after).not.toBe(before);
  });
});

describe('公会远征确定性与归一化', () => {
  it('不同等级分段共享首领主题，但属性随分段缩放', () => {
    const low = guildExpeditionBoss('s1', 8, TRIAL_BRACKETS[0]!.id);
    const high = guildExpeditionBoss('s1', 8, TRIAL_BRACKETS[TRIAL_BRACKETS.length - 1]!.id);
    expect(low.name).toBe(high.name);
    expect(low.combatant.element).toBe(high.combatant.element);
    expect(low.tilt.id).toBe(high.tilt.id);
    expect(high.combatant.stats.hp).toBeGreaterThan(low.combatant.stats.hp);
  });

  it('远征首领血量按完整真实技能轮转标定，不受 1HP 原型过量截断', () => {
    for (const bracket of TRIAL_BRACKETS) {
      const boss = guildExpeditionBoss('s1', 8, bracket.id).combatant;
      const quality = typicalQualityAt(bracket.bossLevel);
      const reference = makePlayer(
        '公会基准成员',
        bracket.bossLevel,
        applyClassMods(
          'swordsman',
          addStats(
            baseStatsFor('swordsman', bracket.bossLevel),
            expectedGearStats(bracket.bossLevel, quality),
          ),
        ),
      );
      const dps = estimateDps(
        reference,
        boss,
        1,
        [],
        buildDefaultPlayerSkillKit('swordsman', bracket.bossLevel),
        'boss',
      );
      expect(boss.stats.hp).toBeGreaterThanOrEqual(
        dps * TRIAL_DURATION_SEC * (TRIAL_BOSS_HP_HEADROOM - 1),
      );
    }
  });

  it('主题种子和挑战种子同输入可复现', () => {
    expect(guildBossThemeSeed('s1', 3)).toBe(guildBossThemeSeed('s1', 3));
    const args = ['s1', 3, 'user-a', '2026-07-30', 1, 'abcd'] as const;
    expect(guildRunSeed(...args)).toBe(guildRunSeed(...args));
    expect(guildRunSeed(...args)).not.toBe(
      guildRunSeed('s1', 3, 'user-a', '2026-07-30', 2, 'abcd'),
    );
  });

  it('伤害按比例归一化且极端值封顶', () => {
    expect(guildContributionPoints(0, 10_000)).toBe(0);
    expect(guildContributionPoints(2_500, 10_000)).toBe(GUILD_CONTRIBUTION_MAX);
    expect(guildContributionPoints(99_999, 10_000)).toBe(GUILD_CONTRIBUTION_MAX);
  });
});

describe('公会目标与展示成长', () => {
  it('单人和空成员快照均按一人目标，成员数线性锁定', () => {
    expect(guildWeeklyTarget(0)).toBe(GUILD_WEEKLY_TARGET_PER_MEMBER);
    expect(guildWeeklyTarget(1)).toBe(GUILD_WEEKLY_TARGET_PER_MEMBER);
    expect(guildWeeklyTarget(20)).toBe(GUILD_WEEKLY_TARGET_PER_MEMBER * 20);
  });

  it('声望只映射展示阶段', () => {
    expect(guildDisplayStage(0).id).toBe('seedling');
    expect(guildDisplayStage(299).id).toBe('seedling');
    expect(guildDisplayStage(300).id).toBe('bloom');
    expect(guildDisplayStage(1_500).id).toBe('legend');
  });
});
