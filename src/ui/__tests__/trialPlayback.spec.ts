import { describe, expect, it } from 'vitest';
import type { CombatTimelineEvent } from '@/core/combat';
import { createTrialPlaybackPlan } from '../trialPlayback';

const TIMELINE: CombatTimelineEvent[] = [
  {
    sequence: 0,
    source: 'player',
    target: 'monster',
    event: { kind: 'direct-damage', damage: 100, hit: true, crit: false, element: 'fire' },
  },
  {
    sequence: 1,
    source: 'player',
    target: 'monster',
    event: {
      kind: 'on-hit-elemental-damage',
      damage: 25,
      triggerId: 'set-fire',
      element: 'fire',
    },
  },
  {
    sequence: 2,
    source: 'monster',
    target: 'player',
    event: { kind: 'direct-damage', damage: 40, hit: true, crit: false, element: 'ice' },
  },
];

describe('trialPlayback / 试炼逐击表现调度', () => {
  it('把直接伤害与紧随的元素追加段合并成同一次命中且不改变总伤害', () => {
    const plan = createTrialPlaybackPlan(TIMELINE, 12, 'weighty');

    expect(plan.beats).toHaveLength(2);
    expect(plan.beats[0]).toMatchObject({
      source: 'player',
      kind: 'player-attack',
      totalDamage: 125,
    });
    expect(plan.beats[0]?.extras).toHaveLength(1);
    expect(plan.beats.reduce((sum, beat) => sum + beat.totalDamage, 0)).toBe(165);
  });

  it('为每一击安排严格递增的蓄力、命中与回位时点', () => {
    const plan = createTrialPlaybackPlan(TIMELINE, 12, 'elusive');

    expect(plan.durationMs).toBeGreaterThanOrEqual(4_200);
    for (const [index, beat] of plan.beats.entries()) {
      expect(beat.startMs).toBeLessThan(beat.impactMs);
      expect(beat.impactMs).toBeLessThan(beat.endMs);
      if (index > 0) {
        expect(beat.startMs).toBeGreaterThan(plan.beats[index - 1]!.startMs);
      }
    }
  });

  it('稳定把玩家每第 5 次直接攻击标记为技能，不受元素追加段干扰', () => {
    const fivePlayerHits = Array.from({ length: 5 }, (_, index): CombatTimelineEvent => ({
      sequence: index,
      source: 'player',
      target: 'monster',
      event: {
        kind: 'direct-damage',
        damage: 10,
        hit: true,
        crit: false,
        element: 'thunder',
      },
    }));

    const plan = createTrialPlaybackPlan(fivePlayerHits, 10, 'fierce');

    expect(plan.beats.map((beat) => beat.kind)).toEqual([
      'player-attack',
      'player-attack',
      'player-attack',
      'player-attack',
      'player-skill',
    ]);
  });

  it('拒绝没有前置直接伤害的元素追加段，避免表现层静默吞错', () => {
    const orphan: CombatTimelineEvent[] = [
      {
        sequence: 0,
        source: 'player',
        target: 'monster',
        event: {
          kind: 'on-hit-elemental-damage',
          damage: 20,
          triggerId: 'orphan',
          element: 'fire',
        },
      },
    ];

    expect(() => createTrialPlaybackPlan(orphan, 1, 'weighty')).toThrow('前没有直接伤害');
  });

  it('持续伤害是独立结算拍，不伪装成上一击的元素追加段', () => {
    const timeline: CombatTimelineEvent[] = [
      TIMELINE[0]!,
      {
        sequence: 1,
        source: 'player',
        target: 'player',
        event: {
          kind: 'on-crit-recovery',
          damage: 0,
          healing: 30,
          triggerId: 'bloodmoon',
        },
      },
      {
        sequence: 2,
        source: 'player',
        target: 'monster',
        event: {
          kind: 'periodic-damage',
          damage: 8,
          hit: true,
          crit: false,
          element: 'none',
          triggerId: 'bloodmoon',
          statusId: 'bleed',
          stacks: 1,
        },
      },
    ];

    const plan = createTrialPlaybackPlan(timeline, 4, 'weighty');
    expect(plan.beats).toHaveLength(2);
    expect(plan.beats[0]?.recoveries[0]).toMatchObject({ kind: 'on-crit-recovery' });
    expect(plan.beats[1]).toMatchObject({
      kind: 'player-skill',
      direct: { kind: 'periodic-damage', damage: 8 },
      totalDamage: 8,
    });
  });

  it('60 秒存活局保持完整时长，减少动态效果时压缩演出', () => {
    expect(createTrialPlaybackPlan(TIMELINE, 60, 'weighty').durationMs).toBe(60_000);
    expect(createTrialPlaybackPlan(TIMELINE, 60, 'weighty', true).durationMs).toBe(1_800);
  });
});
