import type { ClassId } from '@/core/types';

/** 战斗美术可以逐步补齐的标准动作。 */
export type BattleVisualAction = 'idle' | 'attack' | 'hit' | 'defeat';

/**
 * 横向等宽精灵图配置。asset 相对于 public/，每一帧从左到右排列。
 * 当前素材还没有逐帧图，因此注册表先保持为空；以后只填数据即可接入。
 */
export interface SpriteSheetAnimation {
  asset: string;
  frames: number;
  fps: number;
  loop: boolean;
}

export type BattleAnimationSet = Partial<Record<BattleVisualAction, SpriteSheetAnimation>>;

export const CLASS_BATTLE_ANIMATIONS: Readonly<
  Partial<Record<ClassId, BattleAnimationSet>>
> = {};

export const MONSTER_BATTLE_ANIMATIONS: Readonly<Record<string, BattleAnimationSet>> = {};

export function getClassBattleAnimation(
  classId: ClassId,
  action: BattleVisualAction,
): SpriteSheetAnimation | undefined {
  return CLASS_BATTLE_ANIMATIONS[classId]?.[action];
}

export function getMonsterBattleAnimation(
  monsterId: string,
  action: BattleVisualAction,
): SpriteSheetAnimation | undefined {
  return MONSTER_BATTLE_ANIMATIONS[monsterId]?.[action];
}
