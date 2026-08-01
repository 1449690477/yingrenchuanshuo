export type Region5AssetFamily = 'region' | 'set';
export type Region5VisibleSlot = 'body' | 'head' | 'weapon';
export type Region5Slot =
  | 'weapon'
  | 'head'
  | 'body'
  | 'necklace'
  | 'bracelet'
  | 'ring'
  | 'belt'
  | 'shoes';
export type Region5SetSlot =
  | 'weapon'
  | 'head'
  | 'body'
  | 'necklace'
  | 'ring'
  | 'bracelet';

export const REGION5_CLASSES: readonly ['swordsman', 'witch', 'shaman', 'catkin', 'kenshi'];
export const REGION5_VISIBLE_SLOTS: readonly Region5VisibleSlot[];
export const REGION5_SLOTS: readonly Region5Slot[];
export const REGION5_SET_SLOTS: readonly Region5SetSlot[];
export const REGION5_MAPS: readonly {
  id: string;
  kind: 'region' | 'chapter';
}[];
export const REGION5_BATTLEFIELDS: readonly { id: string }[];
export const REGION5_ITEMS: readonly {
  id: string;
  kind: 'material' | 'fragment';
}[];
export const REGION5_EQUIPMENT: readonly {
  id: string;
  family: 'region';
  slot: Region5Slot;
}[];
export const REGION5_SET_EQUIPMENT: readonly {
  id: string;
  family: 'set';
  slot: Region5SetSlot;
}[];
export const REGION5_MONSTERS: readonly {
  id: string;
  name: string;
  motion: string;
}[];
export const REGION5_MODULAR_LAYERS: readonly {
  classId: string;
  family: 'region';
  slot: Region5VisibleSlot;
  id: string;
}[];
export const REGION5_SET_MODULAR_LAYERS: readonly {
  classId: string;
  family: 'set';
  slot: Region5VisibleSlot;
  id: string;
}[];
export const REGION5_COUNTS: Readonly<{
  maps: 6;
  battlefields: 5;
  monsters: 24;
  items: 5;
  equipment: 8;
  setEquipment: 6;
  modularLayers: 15;
  setModularLayers: 15;
  regionContentRuntime: 55;
  regionSetRuntime: 18;
  runtimeTotal: 84;
}>;
