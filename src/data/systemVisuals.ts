export type SystemVisualId = 'enhance' | 'salvage' | 'sweep' | 'dungeon';

export interface SystemVisual {
  id: SystemVisualId;
  name: string;
  asset: string;
  alt: string;
}

export const SYSTEM_VISUALS: Record<SystemVisualId, SystemVisual> = {
  enhance: {
    id: 'enhance',
    name: '樱光强化台',
    asset: 'assets/system/enhance-anvil.png',
    alt: '樱光强化台与魔法锤',
  },
  salvage: {
    id: 'salvage',
    name: '星屑分解炉',
    asset: 'assets/system/salvage-furnace.png',
    alt: '星屑分解炉与回收光环',
  },
  sweep: {
    id: 'sweep',
    name: '疾风扫荡卷',
    asset: 'assets/system/sweep-scroll.png',
    alt: '疾风环绕的扫荡地图卷轴',
  },
  dungeon: {
    id: 'dungeon',
    name: '樱境传送门',
    asset: 'assets/system/dungeon-portal.png',
    alt: '发出樱粉与天蓝光芒的副本传送门',
  },
};

export function requireSystemVisual(id: SystemVisualId): SystemVisual {
  return SYSTEM_VISUALS[id];
}
