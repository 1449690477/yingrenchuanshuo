export type Region6ClassId = 'swordsman' | 'witch' | 'shaman' | 'catkin' | 'kenshi';
export type Region6VisibleSlot = 'body' | 'head' | 'weapon';
export type Region6Slot =
  | 'weapon'
  | 'head'
  | 'body'
  | 'necklace'
  | 'bracelet'
  | 'ring'
  | 'belt'
  | 'shoes';

interface CalledAsset {
  id: string;
  callId: string;
}

export const REGION6_CLASSES: readonly [
  'swordsman',
  'witch',
  'shaman',
  'catkin',
  'kenshi',
];
export const REGION6_VISIBLE_SLOTS: readonly Region6VisibleSlot[];
export const REGION6_SLOTS: readonly Region6Slot[];
export const REGION6_MAPS: readonly (CalledAsset & {
  kind: 'region' | 'chapter';
})[];
export const REGION6_BATTLEFIELDS: readonly CalledAsset[];
export const REGION6_ITEMS: readonly (CalledAsset & {
  kind: 'material' | 'fragment';
})[];
export const REGION6_EQUIPMENT: readonly (CalledAsset & {
  family: 'region';
  slot: Region6Slot;
})[];
export const REGION6_SET_EQUIPMENT: readonly (CalledAsset & {
  family: 'set';
  slot: Region6Slot;
})[];
export const REGION6_MONSTERS: readonly (CalledAsset & {
  name: string;
  motion: string;
})[];
export const REGION6_MODULAR_LAYERS: readonly (CalledAsset & {
  classId: Region6ClassId;
  family: 'r6';
  slot: Region6VisibleSlot;
})[];
export const REGION6_SET_MODULAR_LAYERS: readonly (CalledAsset & {
  classId: Region6ClassId;
  family: 'r6-shadow';
  slot: Region6VisibleSlot;
})[];
export const REGION6_COUNTS: Readonly<{
  maps: 6;
  battlefields: 5;
  monsters: 24;
  items: 5;
  equipment: 8;
  setEquipment: 8;
  modularLayers: 15;
  setModularLayers: 15;
  regionContentRuntime: 55;
  regionSetRuntime: 20;
  runtimeTotal: 86;
}>;
export const REGION6_ALL_ASSETS: readonly (CalledAsset & {
  category:
    | 'map'
    | 'battlefield'
    | 'monster'
    | 'item'
    | 'equipment'
    | 'set-equipment'
    | 'layer'
    | 'set-layer';
})[];
