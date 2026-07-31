/** 公会团本只替换专属战场；同名周常首领继续使用同一套严格 Boss 映射。 */
import type { Element } from '@/core/types';
import { requireTrialVisual, type TrialVisual } from '@/data/trialVisuals';

export const GUILD_EXPEDITION_SCENE_ASSET = 'assets/guild/guild-expedition-arena.webp';

export function requireGuildExpeditionVisual(tiltId: string, element: Element): TrialVisual {
  const boss = requireTrialVisual(tiltId, element);
  return {
    ...boss,
    sceneAsset: GUILD_EXPEDITION_SCENE_ASSET,
    arenaName: '樱庭远征场',
  };
}
