import type { AffectionMood } from '@/core/affection';

export type HapticCue = AffectionMood | 'prismatic-drop';

const HAPTIC_PATTERNS: Readonly<Record<HapticCue, readonly number[]>> = {
  calm: [12],
  bright: [18, 26, 18],
  shy: [10, 48, 10],
  moved: [26, 32, 26],
  playful: [10, 16, 10, 16, 14],
  'prismatic-drop': [18, 30, 18, 38, 46],
};

/**
 * 只应从真实点击 / 触摸事件中调用。
 *
 * 振动是可选硬件能力：不支持时返回 false，不改变任何游戏状态，
 * 也不会用视觉假反馈掩盖奖励主流程。
 */
export function triggerHaptic(
  cue: HapticCue,
  enabled: boolean,
  reduceMotion: boolean,
): boolean {
  if (!enabled || reduceMotion || typeof navigator === 'undefined') return false;
  if (typeof navigator.vibrate !== 'function') return false;
  return navigator.vibrate([...HAPTIC_PATTERNS[cue]]);
}

export function hapticPattern(cue: HapticCue): readonly number[] {
  return [...HAPTIC_PATTERNS[cue]];
}
