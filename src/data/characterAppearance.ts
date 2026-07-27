import type {
  ClassId,
  EquipmentInstance,
  EquipSlot,
  Quality,
} from '@/core/types';
import { requireEquipment } from './equipment';

export type CharacterAction = 'idle' | 'attack' | 'cast' | 'react';
export type CharacterVariant = 'showcase' | 'battle' | 'avatar';
export type GrowthTierId = 'bud' | 'bloom' | 'moon' | 'star' | 'legend';

export interface GrowthTier {
  id: GrowthTierId;
  minLevel: number;
  label: string;
  shortLabel: string;
}

export const GROWTH_TIERS: readonly GrowthTier[] = [
  { id: 'bud', minLevel: 1, label: '初樱见习', shortLabel: '初樱' },
  { id: 'bloom', minLevel: 10, label: '花影绽放', shortLabel: '花影' },
  { id: 'moon', minLevel: 20, label: '月华觉醒', shortLabel: '月华' },
  { id: 'star', minLevel: 35, label: '星辉共鸣', shortLabel: '星辉' },
  { id: 'legend', minLevel: 50, label: '传说樱冠', shortLabel: '传说' },
] as const;

export interface LayerTransform {
  /** 相对完整 1024×1536 画布的缩放。 */
  scale: number;
  /** 相对完整画布宽高的位移百分比。 */
  x: number;
  y: number;
  rotate?: number;
}

interface LayerAppearance {
  id: string;
  slot: EquipSlot;
  renderMode: 'layer';
  assets: Record<ClassId, string>;
  transforms: Record<ClassId, LayerTransform>;
}

interface SlotOnlyAppearance {
  id: string;
  slot: EquipSlot;
  renderMode: 'slot-only';
}

export type EquipmentAppearance = LayerAppearance | SlotOnlyAppearance;

const classAssets = (fileName: string): Record<ClassId, string> => ({
  swordsman: `assets/characters/modular/swordsman/${fileName}.png`,
  witch: `assets/characters/modular/witch/${fileName}.png`,
  shaman: `assets/characters/modular/shaman/${fileName}.png`,
});

const sameTransform = (transform: LayerTransform): Record<ClassId, LayerTransform> => ({
  swordsman: transform,
  witch: transform,
  shaman: transform,
});

/**
 * 生产脚本已经把每一层规范到同一张 640×960 画布和脚底锚点。
 * 运行时只做恒等叠加，避免手机浏览器重复缩放透明大图产生模糊边缘。
 */
const alignedTransforms = sameTransform({ scale: 1, x: 0, y: 0 });

/**
 * 装备定义到运行时外观的显式注册表。
 *
 * 只有在人物缩略图里能辨认的武器、头冠、衣裙直接叠到角色身上；
 * 项链、手镯、戒指、腰带与鞋仍完整显示在人物两侧的装备槽里。
 * 缺少注册时直接抛错，禁止静默退回旧立绘掩盖素材问题。
 */
export const EQUIPMENT_APPEARANCES: Readonly<Record<string, EquipmentAppearance>> = {
  'r1-weapon': {
    id: 'r1-weapon',
    slot: 'weapon',
    renderMode: 'layer',
    assets: classAssets('r1-weapon'),
    transforms: alignedTransforms,
  },
  'r1-head': {
    id: 'r1-head',
    slot: 'head',
    renderMode: 'layer',
    assets: classAssets('r1-head'),
    transforms: alignedTransforms,
  },
  'r1-body': {
    id: 'r1-body',
    slot: 'body',
    renderMode: 'layer',
    assets: classAssets('r1-body'),
    transforms: alignedTransforms,
  },
  'r1-necklace': { id: 'r1-necklace', slot: 'necklace', renderMode: 'slot-only' },
  'r1-bracelet': { id: 'r1-bracelet', slot: 'bracelet', renderMode: 'slot-only' },
  'r1-ring': { id: 'r1-ring', slot: 'ring', renderMode: 'slot-only' },
  'r1-belt': { id: 'r1-belt', slot: 'belt', renderMode: 'slot-only' },
  'r1-shoes': { id: 'r1-shoes', slot: 'shoes', renderMode: 'slot-only' },
  'r2-weapon': {
    id: 'r2-weapon',
    slot: 'weapon',
    renderMode: 'layer',
    assets: classAssets('r2-weapon'),
    transforms: alignedTransforms,
  },
  'r2-head': {
    id: 'r2-head',
    slot: 'head',
    renderMode: 'layer',
    assets: classAssets('r2-head'),
    transforms: alignedTransforms,
  },
  'r2-body': {
    id: 'r2-body',
    slot: 'body',
    renderMode: 'layer',
    assets: classAssets('r2-body'),
    transforms: alignedTransforms,
  },
  'r2-necklace': { id: 'r2-necklace', slot: 'necklace', renderMode: 'slot-only' },
  'r2-bracelet': { id: 'r2-bracelet', slot: 'bracelet', renderMode: 'slot-only' },
  'r2-ring': { id: 'r2-ring', slot: 'ring', renderMode: 'slot-only' },
  'r2-belt': { id: 'r2-belt', slot: 'belt', renderMode: 'slot-only' },
  'r2-shoes': { id: 'r2-shoes', slot: 'shoes', renderMode: 'slot-only' },
};

export const CHARACTER_BASE_ASSETS: Readonly<Record<ClassId, string>> = {
  swordsman: 'assets/characters/modular/swordsman/base.png',
  witch: 'assets/characters/modular/witch/base.png',
  shaman: 'assets/characters/modular/shaman/base.png',
};

export const BASIC_ATTACK_EFFECTS: Readonly<Record<ClassId, string>> = {
  swordsman: 'assets/effects/basic/swordsman-strike.png',
  witch: 'assets/effects/basic/witch-spark.png',
  shaman: 'assets/effects/basic/shaman-wisp.png',
};

const QUALITY_RANK: Readonly<Record<Quality, number>> = {
  common: 0,
  fine: 1,
  rare: 2,
  epic: 3,
  legendary: 4,
  mythic: 5,
  divine: 6,
};

export interface ResolvedAppearanceLayer {
  id: string;
  asset: string;
  slot: EquipSlot;
  name: string;
  quality: Quality;
  enhance: number;
  transform: LayerTransform;
}

export interface ResolvedCharacterAppearance {
  classId: ClassId;
  baseAsset: string;
  growthTier: GrowthTier;
  layers: ResolvedAppearanceLayer[];
  equippedCount: number;
  visibleEquippedCount: number;
  highestVisibleQuality: Quality;
  enhanceStage: 0 | 1 | 2 | 3 | 4;
  signature: string;
  ariaLabel: string;
}

export type EquippedRecord = Record<EquipSlot, EquipmentInstance | null>;

export function growthTierFor(level: number): GrowthTier {
  let matched = GROWTH_TIERS[0]!;
  for (const tier of GROWTH_TIERS) {
    if (level >= tier.minLevel) matched = tier;
  }
  return matched;
}

export function requireEquipmentAppearance(id: string): EquipmentAppearance {
  const appearance = EQUIPMENT_APPEARANCES[id];
  if (!appearance) throw new Error(`[配置错误] 装备外观未登记：${id}`);
  return appearance;
}

function enhanceStageFor(level: number): 0 | 1 | 2 | 3 | 4 {
  if (level >= 15) return 4;
  if (level >= 13) return 3;
  if (level >= 10) return 2;
  if (level >= 5) return 1;
  return 0;
}

export function resolveCharacterAppearance(
  classId: ClassId,
  level: number,
  equipped: EquippedRecord | null | undefined,
): ResolvedCharacterAppearance {
  const layers: ResolvedAppearanceLayer[] = [];
  let equippedCount = 0;
  let highestVisibleQuality: Quality = 'common';
  let highestEnhance = 0;

  if (equipped) {
    for (const [slot, instance] of Object.entries(equipped) as [
      EquipSlot,
      EquipmentInstance | null,
    ][]) {
      if (!instance) continue;
      equippedCount += 1;
      const equipment = requireEquipment(instance.defId);
      const appearance = requireEquipmentAppearance(equipment.appearanceId);
      if (appearance.slot !== slot || appearance.slot !== equipment.slot) {
        throw new Error(
          `[配置错误] ${equipment.id} 的外观槽位 ${appearance.slot} 与装备槽位 ${slot} 不一致`,
        );
      }
      if (appearance.renderMode === 'slot-only') continue;

      const asset = appearance.assets[classId];
      const transform = appearance.transforms[classId];
      if (!asset || !transform) {
        throw new Error(`[配置错误] ${classId} 缺少装备外观：${appearance.id}`);
      }
      layers.push({
        id: appearance.id,
        asset,
        slot,
        name: equipment.name,
        quality: equipment.quality,
        enhance: instance.enhance,
        transform,
      });
      if (QUALITY_RANK[equipment.quality] > QUALITY_RANK[highestVisibleQuality]) {
        highestVisibleQuality = equipment.quality;
      }
      highestEnhance = Math.max(highestEnhance, instance.enhance);
    }
  }

  const slotOrder: Readonly<Record<EquipSlot, number>> = {
    body: 0,
    head: 1,
    weapon: 2,
    necklace: 3,
    bracelet: 4,
    ring: 5,
    belt: 6,
    shoes: 7,
  };
  layers.sort((a, b) => slotOrder[a.slot] - slotOrder[b.slot]);

  const growthTier = growthTierFor(level);
  const visibleNames = layers.map((layer) => layer.name);
  return {
    classId,
    baseAsset: CHARACTER_BASE_ASSETS[classId],
    growthTier,
    layers,
    equippedCount,
    visibleEquippedCount: layers.length,
    highestVisibleQuality,
    enhanceStage: enhanceStageFor(highestEnhance),
    signature: layers.map((layer) => `${layer.slot}:${layer.id}`).join('|') || 'base',
    ariaLabel: visibleNames.length
      ? `${growthTier.label}角色，当前可见外观：${visibleNames.join('、')}`
      : `${growthTier.label}角色，当前为基础训练装`,
  };
}
