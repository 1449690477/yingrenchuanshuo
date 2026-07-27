import type { ClassId } from '@/core/types';
import type { CharacterAction } from './characterAppearance';

export interface ClassBattleMotion {
  /**
   * 普攻不再永远重复同一个姿势。
   * 序列只改变表现，不参与攻速、伤害或挂机结算。
   */
  basicSequence: readonly [CharacterAction, CharacterAction, CharacterAction];
}

export const CLASS_BATTLE_MOTIONS: Readonly<Record<ClassId, ClassBattleMotion>> = {
  swordsman: {
    basicSequence: ['attack', 'dash', 'spin'],
  },
  witch: {
    basicSequence: ['cast', 'attack', 'spin'],
  },
  shaman: {
    basicSequence: ['cast', 'spin', 'attack'],
  },
  catkin: {
    basicSequence: ['attack', 'dash', 'flurry'],
  },
};

/**
 * 用拍子序号稳定轮换普攻姿势。
 *
 * 这里不能使用随机数：同一拍在 Vue 重挂或截图复核时必须得到同一个动作，
 * 也不能让纯表现消耗战斗 RNG。
 */
export function basicBattleAction(classId: ClassId, beatSeq: number): CharacterAction {
  if (!Number.isSafeInteger(beatSeq) || beatSeq <= 0) {
    throw new Error(`[战斗动作] 拍子序号必须是正整数：${beatSeq}`);
  }
  const sequence = CLASS_BATTLE_MOTIONS[classId].basicSequence;
  return sequence[(beatSeq - 1) % sequence.length]!;
}

export interface SequencedActionBeat {
  seq: number;
  sourceSeq: number;
}

/**
 * 多段技能的延迟命中可能晚于下一拍才插入数组。
 * 人物姿势必须认原始拍子序号，不能因为旧技能的最后一段晚到而倒退。
 */
export function latestSourceBeat<T extends SequencedActionBeat>(
  beats: readonly T[],
  highestSeenSourceSeq: number,
): T | null {
  if (!Number.isSafeInteger(highestSeenSourceSeq) || highestSeenSourceSeq < 0) {
    throw new Error(`[战斗动作] 已见拍子序号必须是非负整数：${highestSeenSourceSeq}`);
  }
  let latest: T | null = null;
  for (const beat of beats) {
    if (beat.sourceSeq !== highestSeenSourceSeq) continue;
    if (latest === null || beat.seq > latest.seq) {
      latest = beat;
    }
  }
  return latest;
}

export type MonsterMotionProfile = 'flutter' | 'hopper' | 'bounce' | 'sway' | 'guard' | 'royal';

export type MonsterAction = 'idle' | 'attack' | 'hit' | 'defeat';

export interface MonsterActionState {
  defeated: boolean;
  attacking: boolean;
  hit: boolean;
}

export function monsterActionFor(state: MonsterActionState): MonsterAction {
  if (state.defeated) return 'defeat';
  if (state.attacking) return 'attack';
  if (state.hit) return 'hit';
  return 'idle';
}

export interface MonsterTargetVisualState {
  monsterId: string;
  pulseId: number;
}

export function shouldPlayMonsterSpawn(
  current: MonsterTargetVisualState,
  previous: MonsterTargetVisualState,
): boolean {
  const speciesChanged = current.monsterId !== previous.monsterId;
  const defeatedMonsterLeft = previous.pulseId > 0 && current.pulseId === 0;
  return current.pulseId === 0 && (speciesChanged || defeatedMonsterLeft);
}

export interface MonsterMotionTiming {
  attackMs: number;
  /** 攻击动作从蓄力进入命中的时点，供反馈层对齐玩家受击。 */
  impactMs: number;
  hitMs: number;
  defeatMs: number;
}

/**
 * 怪物动作时长集中登记，MonsterArtwork 只消费 CSS 变量。
 * 精英守卫与 BOSS 的动作更沉，普通飞行怪和跳跳怪更轻快。
 */
export const MONSTER_MOTION_TIMINGS: Readonly<Record<MonsterMotionProfile, MonsterMotionTiming>> = {
  flutter: { attackMs: 560, impactMs: 300, hitMs: 340, defeatMs: 540 },
  hopper: { attackMs: 520, impactMs: 270, hitMs: 320, defeatMs: 500 },
  bounce: { attackMs: 580, impactMs: 300, hitMs: 360, defeatMs: 560 },
  sway: { attackMs: 640, impactMs: 370, hitMs: 380, defeatMs: 620 },
  guard: { attackMs: 700, impactMs: 405, hitMs: 420, defeatMs: 680 },
  royal: { attackMs: 780, impactMs: 455, hitMs: 460, defeatMs: 720 },
};

export function requireMonsterMotionTiming(profile: MonsterMotionProfile): MonsterMotionTiming {
  const timing = MONSTER_MOTION_TIMINGS[profile];
  if (!timing) {
    throw new Error(`[怪物动作] 未登记动作节奏：${String(profile)}`);
  }
  return timing;
}
