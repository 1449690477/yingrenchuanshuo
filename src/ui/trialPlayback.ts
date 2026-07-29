import type {
  CombatTimelineEvent,
  DirectDamageSegmentEvent,
  OnHitElementalDamageEvent,
} from '@/core/combat';
import { requireTrialMotionTiming, type TrialBossMotion } from '@/data/trialVisuals';
import type { BeatKindForImpact } from '@/data/battleMotions';

export interface TrialPresentationBeat {
  id: number;
  source: CombatTimelineEvent['source'];
  target: CombatTimelineEvent['target'];
  kind: BeatKindForImpact;
  /** 玩家第几次直接攻击；怪物攻击为 0。 */
  playerHitOrdinal: number;
  direct: DirectDamageSegmentEvent;
  extras: readonly OnHitElementalDamageEvent[];
  totalDamage: number;
  startMs: number;
  impactMs: number;
  endMs: number;
}

export interface TrialPlaybackPlan {
  durationMs: number;
  beats: readonly TrialPresentationBeat[];
}

const INTRO_MS = 560;
const OUTRO_MS = 620;
const PLAYER_ATTACK_WINDUP_MS = 250;
const PLAYER_SKILL_WINDUP_MS = 360;
const PLAYER_RECOVERY_MS = 270;
const MIN_PLAYBACK_MS = 4_200;
const MAX_PLAYBACK_MS = 60_000;

/**
 * 将 core 的逐段结算时间线转换成可读的战斗演出节拍。
 *
 * core 只保证「直接伤害后紧跟本次攻击触发的元素追加段」，没有真实时间戳。
 * 表现层因此必须先把这些段合成同一击，再给每一击安排蓄力、命中和回位，
 * 不能继续按总进度在同一帧批量消费。
 */
export function createTrialPlaybackPlan(
  timeline: readonly CombatTimelineEvent[],
  runDurationSec: number,
  bossMotion: TrialBossMotion,
  reduceMotion = false,
): TrialPlaybackPlan {
  if (!Number.isFinite(runDurationSec) || runDurationSec < 0) {
    throw new Error(`[试炼演出] 战斗时长必须是非负有限数：${runDurationSec}`);
  }

  const grouped = groupTimeline(timeline);
  const durationMs = resolvePlaybackDuration(runDurationSec, grouped.length, reduceMotion);
  if (grouped.length === 0) return { durationMs, beats: [] };

  const usableMs = Math.max(1, durationMs - INTRO_MS - OUTRO_MS);
  const slotMs = usableMs / grouped.length;
  const bossTiming = requireTrialMotionTiming(bossMotion);
  let playerHitOrdinal = 0;

  const beats = grouped.map((group, index): TrialPresentationBeat => {
    if (group.source === 'player') playerHitOrdinal++;
    const skill = group.source === 'player' && playerHitOrdinal % 5 === 0;
    const kind: BeatKindForImpact =
      group.source === 'monster' ? 'monster-attack' : skill ? 'player-skill' : 'player-attack';
    const desiredWindup =
      kind === 'monster-attack'
        ? bossTiming.windupMs
        : kind === 'player-skill'
          ? PLAYER_SKILL_WINDUP_MS
          : PLAYER_ATTACK_WINDUP_MS;
    const desiredRecovery = kind === 'monster-attack' ? bossTiming.recoveryMs : PLAYER_RECOVERY_MS;
    const windupMs = reduceMotion
      ? Math.min(18, slotMs * 0.25)
      : Math.min(desiredWindup, Math.max(84, slotMs * 0.48));
    const recoveryMs = reduceMotion
      ? Math.min(18, slotMs * 0.25)
      : Math.min(desiredRecovery, Math.max(92, slotMs - windupMs - 12));
    const startMs = INTRO_MS + slotMs * index;
    const impactMs = startMs + windupMs;
    const endMs = Math.min(startMs + slotMs, impactMs + recoveryMs);

    return {
      id: index + 1,
      source: group.source,
      target: group.target,
      kind,
      playerHitOrdinal: group.source === 'player' ? playerHitOrdinal : 0,
      direct: group.direct,
      extras: group.extras,
      totalDamage: group.direct.damage + group.extras.reduce((sum, extra) => sum + extra.damage, 0),
      startMs,
      impactMs,
      endMs,
    };
  });

  return { durationMs, beats };
}

interface GroupedTimelineBeat {
  source: CombatTimelineEvent['source'];
  target: CombatTimelineEvent['target'];
  direct: DirectDamageSegmentEvent;
  extras: OnHitElementalDamageEvent[];
}

function groupTimeline(timeline: readonly CombatTimelineEvent[]): GroupedTimelineBeat[] {
  const groups: GroupedTimelineBeat[] = [];
  let lastSequence = -1;

  for (const item of timeline) {
    if (!Number.isSafeInteger(item.sequence) || item.sequence <= lastSequence) {
      throw new Error(`[试炼演出] 时间线序号必须严格递增：${item.sequence}`);
    }
    lastSequence = item.sequence;

    if (item.event.kind === 'direct-damage') {
      groups.push({
        source: item.source,
        target: item.target,
        direct: item.event,
        extras: [],
      });
      continue;
    }

    const current = groups.at(-1);
    if (!current) {
      throw new Error(`[试炼演出] 元素追加段 ${item.sequence} 前没有直接伤害`);
    }
    if (current.source !== item.source || current.target !== item.target) {
      throw new Error(`[试炼演出] 元素追加段 ${item.sequence} 与前一击攻守方不一致`);
    }
    current.extras.push(item.event);
  }

  return groups;
}

function resolvePlaybackDuration(
  runDurationSec: number,
  beatCount: number,
  reduceMotion: boolean,
): number {
  const naturalMs = runDurationSec * 1_000;
  if (reduceMotion) {
    return Math.min(1_800, Math.max(650, naturalMs));
  }
  if (runDurationSec >= 55) return MAX_PLAYBACK_MS;

  // 提前结束的战斗不硬拖到原始秒数，但至少留出几次完整、可读的交锋。
  const readableMs = beatCount * 880 + INTRO_MS + OUTRO_MS;
  return Math.min(MAX_PLAYBACK_MS, Math.max(MIN_PLAYBACK_MS, Math.min(naturalMs, readableMs)));
}
