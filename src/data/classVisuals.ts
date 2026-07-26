import type { ClassId } from '@/core/types';

export interface ClassVisual {
  symbol: string;
  /**
   * 相对于 public/ 的资源路径。
   * null 表示这个职业的正式立绘尚未制作，UI 会明确展示「制作中」占位。
   */
  portrait: string | null;
  /** 战斗施法动作；尚未制作时必须明确为 null。 */
  castPortrait: string | null;
}

/**
 * 职业视觉资源的唯一索引。
 *
 * 后续新增立绘时只改这里，组件不应自行拼文件名或猜测资源是否存在。
 */
export const CLASS_VISUALS: Record<ClassId, ClassVisual> = {
  swordsman: {
    symbol: '🗡️',
    portrait: null,
    castPortrait: null,
  },
  witch: {
    symbol: '🔮',
    portrait: 'assets/characters/witch-sakura.png',
    castPortrait: 'assets/characters/witch-sakura-cast.png',
  },
  shaman: {
    symbol: '🌿',
    portrait: null,
    castPortrait: null,
  },
};
