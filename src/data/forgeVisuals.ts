import type { ForgeStage } from '@/core/types';

export interface ForgeStageVisual {
  readonly stage: ForgeStage;
  readonly name: string;
  readonly minLevel: number;
  /** 叠在装备图标上方的透明光环；原貌阶段不叠加。 */
  readonly overlayAsset: string | null;
}

export const FORGE_STAGE_ORDER = [
  'original',
  'gleam',
  'radiant',
  'starforged',
  'sakura',
] as const satisfies readonly ForgeStage[];

export const FORGE_STAGE_VISUALS: Record<ForgeStage, ForgeStageVisual> = {
  original: {
    stage: 'original',
    name: '原貌',
    minLevel: 0,
    overlayAsset: null,
  },
  gleam: {
    stage: 'gleam',
    name: '微光',
    minLevel: 5,
    overlayAsset: 'assets/effects/forge/icon-gleam.png',
  },
  radiant: {
    stage: 'radiant',
    name: '辉光',
    minLevel: 9,
    overlayAsset: 'assets/effects/forge/icon-radiant.png',
  },
  starforged: {
    stage: 'starforged',
    name: '星铸',
    minLevel: 12,
    overlayAsset: 'assets/effects/forge/icon-starforged.png',
  },
  sakura: {
    stage: 'sakura',
    name: '樱华',
    minLevel: 15,
    overlayAsset: 'assets/effects/forge/icon-sakura.png',
  },
};

export function requireForgeStageVisual(stage: ForgeStage): ForgeStageVisual {
  return FORGE_STAGE_VISUALS[stage];
}
