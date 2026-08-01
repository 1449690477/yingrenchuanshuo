export type Region7ClassId = 'swordsman' | 'witch' | 'shaman' | 'catkin' | 'kenshi';
export type Region7VisibleSlot = 'body' | 'head' | 'weapon';
export type Region7Slot =
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

export const REGION7_CLASSES: readonly [
  'swordsman',
  'witch',
  'shaman',
  'catkin',
  'kenshi',
];
export const REGION7_VISIBLE_SLOTS: readonly Region7VisibleSlot[];
export const REGION7_SLOTS: readonly Region7Slot[];
export const REGION7_MAPS: readonly (CalledAsset & {
  kind: 'region' | 'chapter';
})[];
export const REGION7_BATTLEFIELDS: readonly CalledAsset[];
export const REGION7_ITEMS: readonly (CalledAsset & {
  kind: 'material' | 'fragment';
})[];
export const REGION7_EQUIPMENT: readonly (CalledAsset & {
  family: 'region';
  slot: Region7Slot;
})[];
export const REGION7_SET_EQUIPMENT: readonly (CalledAsset & {
  family: 'set';
  slot: Region7Slot;
})[];
export const REGION7_BADGE: CalledAsset & {
  family: 'badge';
};
export const REGION7_MONSTERS: readonly (CalledAsset & {
  name: string;
  motion: string;
  subjectCount?: number;
})[];
export const REGION7_MODULAR_LAYERS: readonly (CalledAsset & {
  classId: Region7ClassId;
  family: 'r7';
  slot: Region7VisibleSlot;
})[];
export const REGION7_SET_MODULAR_LAYERS: readonly (CalledAsset & {
  classId: Region7ClassId;
  family: 'r7-bloodmoon';
  slot: Region7VisibleSlot;
})[];
export const REGION7_COUNTS: Readonly<{
  maps: 6;
  battlefields: 5;
  monsters: 24;
  items: 5;
  equipment: 8;
  setEquipment: 8;
  badges: 1;
  modularLayers: 15;
  setModularLayers: 15;
  regionContentRuntime: 55;
  regionSetRuntime: 21;
  runtimeTotal: 87;
}>;
export const REGION7_ALL_ASSETS: readonly (CalledAsset & {
  category:
    | 'map'
    | 'battlefield'
    | 'monster'
    | 'item'
    | 'equipment'
    | 'set-equipment'
    | 'badge'
    | 'layer'
    | 'set-layer';
})[];
