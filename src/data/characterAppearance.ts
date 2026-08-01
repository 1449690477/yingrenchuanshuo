import {
  CLASS_IDS,
  type BoutiqueThemeId,
  type ClassId,
  type EquipmentInstance,
  type EquipSlot,
  type ForgeStage,
  type Quality,
} from '@/core/types';
import { forgeStageAt } from '@/core/equipment';
import { requireEquipment } from './equipment';
import { equipmentPresentation } from './equipmentPresentation';
import { BOUTIQUE_THEME_LIST, BOUTIQUE_THEMES, boutiqueAppearanceId } from './boutique';
import { QUALITY_RANK } from './constants';
import { ARENA_EQUIPMENT_LIST } from './arenaEquipment';
import {
  EQUIPMENT_DUNGEON_TIERS,
  equipmentDungeonAppearanceId,
  type EquipmentDungeonTierId,
} from './equipmentDungeonGear';

export type CharacterAction =
  | 'idle'
  | 'attack'
  | 'cast'
  | 'react'
  | 'dash'
  | 'flurry'
  | 'spin'
  | 'counter'
  | 'victory';
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
  assets: Partial<Record<ClassId, string>>;
  transforms: Record<ClassId, LayerTransform>;
  /**
   * 头部图层默认压在三职业安全脸层之上、喵喵安全脸层之下（保护猫耳与眼睛）。
   * 置 true 时喵喵也提到脸层之上——只给「遮住头顶但不会盖眼睛」的帽饰使用。
   */
  aboveFace?: boolean;
}

interface SlotOnlyAppearance {
  id: string;
  slot: EquipSlot;
  renderMode: 'slot-only';
}

interface ReplacementAppearance {
  id: string;
  slot: 'body';
  renderMode: 'replacement';
  assets: Partial<Record<ClassId, string>>;
}

export type EquipmentAppearance =
  | LayerAppearance
  | ReplacementAppearance
  | SlotOnlyAppearance;

const classAssets = (fileName: string): Record<ClassId, string> => ({
  swordsman: `assets/characters/modular/swordsman/${fileName}.png`,
  witch: `assets/characters/modular/witch/${fileName}.png`,
  shaman: `assets/characters/modular/shaman/${fileName}.png`,
  catkin: `assets/characters/modular/catkin/${fileName}.png`,
  // P1 明确复用现有猫耳角色层，P2 资产齐后再原位替换为 kenshi 专属路径。
  kenshi: `assets/characters/modular/catkin/${fileName}.png`,
});

const sameTransform = (transform: LayerTransform): Record<ClassId, LayerTransform> => ({
  swordsman: transform,
  witch: transform,
  shaman: transform,
  catkin: transform,
  kenshi: transform,
});

/**
 * 生产脚本已经把每一层规范到同一张 640×960 画布和脚底锚点。
 * 运行时只做恒等叠加，避免手机浏览器重复缩放透明大图产生模糊边缘。
 */
const alignedTransforms = sameTransform({ scale: 1, x: 0, y: 0 });

function boutiqueClassAssets(
  themeId: BoutiqueThemeId,
  slot: 'body' | 'head' | 'shoes' | 'weapon',
  classId?: ClassId,
): Partial<Record<ClassId, string>> {
  if (classId) {
    const assetClassId = classId === 'kenshi' ? 'catkin' : classId;
    return {
      [classId]: `assets/characters/modular/shop/${themeId}/${assetClassId}-${slot}.png`,
    };
  }
  return Object.fromEntries(
    CLASS_IDS.map((candidate) => [
      candidate,
      `assets/characters/modular/shop/${themeId}/${candidate === 'kenshi' ? 'catkin' : candidate}-${slot}.png`,
    ]),
  ) as Record<ClassId, string>;
}

function buildBoutiqueAppearances(): Record<string, EquipmentAppearance> {
  const out: Record<string, EquipmentAppearance> = {};
  for (const theme of BOUTIQUE_THEME_LIST) {
    for (const item of theme.items) {
      const id = boutiqueAppearanceId(theme.id, item.slot, item.classId);
      if (out[id]) continue;
      if (item.slot === 'body' && item.renderMode === 'replacement') {
        out[id] = {
          id,
          slot: 'body',
          renderMode: 'replacement',
          assets: boutiqueClassAssets(theme.id, 'body', item.classId),
        };
        continue;
      }
      if (['body', 'head', 'shoes', 'weapon'].includes(item.slot)) {
        const slot = item.slot as 'body' | 'head' | 'shoes' | 'weapon';
        out[id] = {
          id,
          slot,
          renderMode: 'layer',
          assets: boutiqueClassAssets(theme.id, slot, item.classId),
          transforms: alignedTransforms,
          // 精品店帽饰是戴在头顶的整帽，喵喵同样需要压过安全脸层，否则整顶被头发埋住。
          ...(slot === 'head' ? { aboveFace: true } : {}),
        };
        continue;
      }
      out[id] = { id, slot: item.slot, renderMode: 'slot-only' };
    }
  }
  return out;
}

function dungeonClassAssets(
  tierId: EquipmentDungeonTierId,
  slot: 'body' | 'head' | 'shoes' | 'weapon',
): Record<ClassId, string> {
  return {
    swordsman: `assets/characters/modular/dungeon/${tierId}/swordsman-${slot}.png`,
    witch: `assets/characters/modular/dungeon/${tierId}/witch-${slot}.png`,
    shaman: `assets/characters/modular/dungeon/${tierId}/shaman-${slot}.png`,
    catkin: `assets/characters/modular/dungeon/${tierId}/catkin-${slot}.png`,
    kenshi: `assets/characters/modular/dungeon/${tierId}/catkin-${slot}.png`,
  };
}

function buildEquipmentDungeonAppearances(): Record<string, EquipmentAppearance> {
  const out: Record<string, EquipmentAppearance> = {};
  for (const tier of EQUIPMENT_DUNGEON_TIERS) {
    const bodyId = equipmentDungeonAppearanceId(tier.id, 'body');
    out[bodyId] = {
      id: bodyId,
      slot: 'body',
      renderMode: 'replacement',
      assets: dungeonClassAssets(tier.id, 'body'),
    };
    for (const slot of ['head', 'weapon'] as const) {
      const id = equipmentDungeonAppearanceId(tier.id, slot);
      out[id] = {
        id,
        slot,
        renderMode: 'layer',
        assets: dungeonClassAssets(tier.id, slot),
        transforms: alignedTransforms,
      };
    }
    // 整身换装本体已画出配套鞋靴；独立的鞋子图层素材悬空错位，不再叠加到人物身上。
    for (const slot of ['necklace', 'bracelet', 'ring', 'belt', 'shoes'] as const) {
      const id = equipmentDungeonAppearanceId(tier.id, slot);
      out[id] = { id, slot, renderMode: 'slot-only' };
    }
  }
  return out;
}

function buildRegionAppearances(regionIds: readonly string[]): Record<string, EquipmentAppearance> {
  const out: Record<string, EquipmentAppearance> = {};
  for (const regionId of regionIds) {
    for (const slot of ['body', 'head', 'weapon'] as const) {
      const id = `${regionId}-${slot}`;
      out[id] = {
        id,
        slot,
        renderMode: 'layer',
        assets: classAssets(id),
        transforms: alignedTransforms,
      };
    }
    for (const slot of ['necklace', 'bracelet', 'ring', 'belt', 'shoes'] as const) {
      const id = `${regionId}-${slot}`;
      out[id] = { id, slot, renderMode: 'slot-only' };
    }
  }
  return out;
}

/**
 * 区域 3/4 的待启用换装注册表。
 *
 * 与新区装备定义和实际图层一起原子接入 `EQUIPMENT_APPEARANCES`，生产期间
 * 保持当前线上内容数量不变，避免其他协作者的完整性验证被半成品干扰。
 */
export const REGION_34_EQUIPMENT_APPEARANCES: Readonly<
  Record<string, EquipmentAppearance>
> = buildRegionAppearances(['r3', 'r4']);

function buildRegion5SetAppearances(): Record<string, EquipmentAppearance> {
  const out: Record<string, EquipmentAppearance> = {};
  for (const slot of ['body', 'head', 'weapon'] as const) {
    const id = `r5-set-${slot}`;
    out[id] = {
      id,
      slot,
      renderMode: 'layer',
      assets: Object.fromEntries(
        CLASS_IDS.map((classId) => [
          classId,
          `assets/characters/modular/${classId === 'kenshi' ? 'catkin' : classId}/r5-crimson-${slot}.png`,
        ]),
      ) as Record<ClassId, string>,
      transforms: alignedTransforms,
    };
  }
  for (const slot of ['necklace', 'bracelet', 'ring'] as const) {
    const id = `r5-set-${slot}`;
    out[id] = { id, slot, renderMode: 'slot-only' };
  }
  return out;
}

function buildRegion6SetAppearances(): Record<string, EquipmentAppearance> {
  const out: Record<string, EquipmentAppearance> = {};
  for (const slot of ['body', 'head', 'weapon'] as const) {
    const id = `r6-set-${slot}`;
    out[id] = {
      id,
      slot,
      renderMode: 'layer',
      assets: Object.fromEntries(
        CLASS_IDS.map((classId) => [
          classId,
          `assets/characters/modular/${classId === 'kenshi' ? 'catkin' : classId}/r6-shadow-${slot}.png`,
        ]),
      ) as Record<ClassId, string>,
      transforms: alignedTransforms,
    };
  }
  for (const slot of ['necklace', 'bracelet', 'ring', 'belt', 'shoes'] as const) {
    const id = `r6-set-${slot}`;
    out[id] = { id, slot, renderMode: 'slot-only' };
  }
  return out;
}

function buildRegion7SetAppearances(): Record<string, EquipmentAppearance> {
  const out: Record<string, EquipmentAppearance> = {};
  for (const slot of ['body', 'head', 'weapon'] as const) {
    const id = `r7-set-${slot}`;
    out[id] = {
      id,
      slot,
      renderMode: 'layer',
      assets: Object.fromEntries(
        CLASS_IDS.map((classId) => [
          classId,
          `assets/characters/modular/${classId === 'kenshi' ? 'catkin' : classId}/r7-bloodmoon-${slot}.png`,
        ]),
      ) as Record<ClassId, string>,
      transforms: alignedTransforms,
    };
  }
  for (const slot of ['necklace', 'bracelet', 'ring', 'belt', 'shoes'] as const) {
    const id = `r7-set-${slot}`;
    out[id] = { id, slot, renderMode: 'slot-only' };
  }
  return out;
}

/**
 * R5 普通八部位与绯焰六件套的完整外观注册表。
 *
 * 普通装和套装各自使用独立的 body / head / weapon 图层；首饰继续在装备槽
 * 显示，避免小尺寸人物上叠加不可辨认的装饰噪点。
 */
export const REGION_5_EQUIPMENT_APPEARANCES: Readonly<
  Record<string, EquipmentAppearance>
> = {
  ...buildRegionAppearances(['r5']),
  ...buildRegion5SetAppearances(),
};

export const REGION_6_EQUIPMENT_APPEARANCES: Readonly<
  Record<string, EquipmentAppearance>
> = {
  ...buildRegionAppearances(['r6']),
  ...buildRegion6SetAppearances(),
};

export const REGION_7_EQUIPMENT_APPEARANCES: Readonly<
  Record<string, EquipmentAppearance>
> = {
  ...buildRegionAppearances(['r7']),
  ...buildRegion7SetAppearances(),
};

/**
 * 圣痕装备（竞技场）：四槽统一 slot-only
 * —— 图标完整显示在装备槽里，人物立绘不变。
 * 换装层是第二批工作（docs/53 §2.4），落地后在这里升级为 layer。
 */
function buildArenaAppearances(): Record<string, EquipmentAppearance> {
  const out: Record<string, EquipmentAppearance> = {};
  for (const definition of ARENA_EQUIPMENT_LIST) {
    out[definition.appearanceId] = {
      id: definition.appearanceId,
      slot: definition.slot,
      renderMode: 'slot-only',
    };
  }
  return out;
}

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
  // 区域 3/4：body / head / weapon 有真实换装层，其余五槽与区域 1～2 一致走 slot-only。
  // 生产脚本每职业各出 3 层 × 2 区域 = 24 张，见 docs/46。
  ...Object.fromEntries(
    (['r3', 'r4'] as const).flatMap((regionId) => [
      ...(['weapon', 'head', 'body'] as const).map((slot) => [
        `${regionId}-${slot}`,
        {
          id: `${regionId}-${slot}`,
          slot,
          renderMode: 'layer' as const,
          assets: classAssets(`${regionId}-${slot}`),
          transforms: alignedTransforms,
        },
      ]),
      ...(['necklace', 'bracelet', 'ring', 'belt', 'shoes'] as const).map((slot) => [
        `${regionId}-${slot}`,
        { id: `${regionId}-${slot}`, slot, renderMode: 'slot-only' as const },
      ]),
    ]),
  ),
  ...REGION_5_EQUIPMENT_APPEARANCES,
  ...REGION_6_EQUIPMENT_APPEARANCES,
  ...REGION_7_EQUIPMENT_APPEARANCES,

  ...buildBoutiqueAppearances(),
  ...buildEquipmentDungeonAppearances(),
  ...buildArenaAppearances(),
};

export const CHARACTER_BASE_ASSETS: Readonly<Record<ClassId, string>> = {
  swordsman: 'assets/characters/modular/swordsman/base.png',
  witch: 'assets/characters/modular/witch/base.png',
  shaman: 'assets/characters/modular/shaman/base.png',
  catkin: 'assets/characters/modular/catkin/base.png',
  kenshi: 'assets/characters/modular/catkin/base.png',
};

/**
 * 脱掉初始靴的底模：靴区被重涂成裤袜质感。
 * 只要装备了会真实叠加到身上的鞋子图层就换用该底模，
 * 避免初始靴从新鞋上沿/后方探出来形成「双靴」。
 */
export const CHARACTER_BASE_NOSHOES_ASSETS: Readonly<Record<ClassId, string>> = {
  swordsman: 'assets/characters/modular/swordsman/base-noshoes.png',
  witch: 'assets/characters/modular/witch/base-noshoes.png',
  shaman: 'assets/characters/modular/shaman/base-noshoes.png',
  catkin: 'assets/characters/modular/catkin/base-noshoes.png',
  kenshi: 'assets/characters/modular/catkin/base-noshoes.png',
};

export const BASIC_ATTACK_EFFECTS: Readonly<Record<ClassId, string>> = {
  swordsman: 'assets/effects/basic/swordsman-strike.png',
  witch: 'assets/effects/basic/witch-spark.png',
  shaman: 'assets/effects/basic/shaman-wisp.png',
  catkin: 'assets/effects/basic/catkin-paw.png',
  kenshi: 'assets/effects/basic/catkin-paw.png',
};

export interface ResolvedAppearanceLayer {
  id: string;
  asset: string;
  slot: EquipSlot;
  name: string;
  quality: Quality;
  enhance: number;
  forgeStage: ForgeStage;
  transform: LayerTransform;
  aboveFace?: boolean;
}

export interface ResolvedCharacterAppearance {
  classId: ClassId;
  baseAsset: string;
  growthTier: GrowthTier;
  layers: ResolvedAppearanceLayer[];
  equippedCount: number;
  visibleEquippedCount: number;
  highestVisibleQuality: Quality;
  activeBoutiqueTheme: BoutiqueThemeId | null;
  boutiqueEffectAsset: string | null;
  activeDungeonTier: EquipmentDungeonTierId | null;
  forgeStage: ForgeStage;
  weaponForgeStage: ForgeStage;
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

export function resolveCharacterAppearance(
  classId: ClassId,
  level: number,
  equipped: EquippedRecord | null | undefined,
): ResolvedCharacterAppearance {
  const layers: ResolvedAppearanceLayer[] = [];
  let equippedCount = 0;
  let highestVisibleQuality: Quality = 'common';
  let highestVisibleEnhance = 0;
  let weaponEnhance = 0;
  let activeBoutiqueTheme: BoutiqueThemeId | null = null;
  let activeDungeonTier: EquipmentDungeonTierId | null = null;
  let replacementBaseAsset: string | null = null;
  let replacementId: string | null = null;
  let hasVisibleShoes = false;
  let visibleEquippedCount = 0;
  const visibleNames: string[] = [];

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
      if (
        equipment.boutiqueTheme &&
        (!activeBoutiqueTheme ||
          BOUTIQUE_THEMES[equipment.boutiqueTheme].rank > BOUTIQUE_THEMES[activeBoutiqueTheme].rank)
      ) {
        activeBoutiqueTheme = equipment.boutiqueTheme;
      }
      const dungeonTier = EQUIPMENT_DUNGEON_TIERS.find(
        (tier) => tier.setId === equipment.setId,
      );
      if (
        dungeonTier &&
        (!activeDungeonTier ||
          EQUIPMENT_DUNGEON_TIERS.findIndex((tier) => tier.id === dungeonTier.id) >
            EQUIPMENT_DUNGEON_TIERS.findIndex((tier) => tier.id === activeDungeonTier))
      ) {
        activeDungeonTier = dungeonTier.id;
      }
      if (appearance.renderMode === 'slot-only') continue;
      if (QUALITY_RANK[equipment.quality] > QUALITY_RANK[highestVisibleQuality]) {
        highestVisibleQuality = equipment.quality;
      }
      highestVisibleEnhance = Math.max(highestVisibleEnhance, instance.enhance);
      if (slot === 'weapon') weaponEnhance = instance.enhance;

      const asset = appearance.assets[classId];
      if (!asset) {
        throw new Error(`[配置错误] ${classId} 缺少装备外观：${appearance.id}`);
      }
      visibleEquippedCount += 1;
      const presentation = equipmentPresentation(equipment, classId);
      visibleNames.push(presentation.name);
      if (appearance.renderMode === 'replacement') {
        replacementBaseAsset = asset;
        replacementId = appearance.id;
        continue;
      }
      const transform = appearance.transforms[classId];
      if (!transform) {
        throw new Error(`[配置错误] ${classId} 缺少装备外观变换：${appearance.id}`);
      }
      if (slot === 'shoes') hasVisibleShoes = true;
      layers.push({
        id: appearance.id,
        asset,
        slot,
        name: presentation.name,
        quality: equipment.quality,
        enhance: instance.enhance,
        forgeStage: forgeStageAt(instance.enhance),
        transform,
        ...(appearance.aboveFace ? { aboveFace: true } : {}),
      });
    }
  }

  const boutiqueEffectAsset = activeBoutiqueTheme
    ? BOUTIQUE_THEMES[activeBoutiqueTheme].attackEffects[classId]
    : undefined;
  if (activeBoutiqueTheme && !boutiqueEffectAsset) {
    throw new Error(`[配置错误] ${activeBoutiqueTheme} 缺少 ${classId} 的攻击特效`);
  }

  const slotOrder: Readonly<Record<EquipSlot, number>> = {
    body: 0,
    shoes: 1,
    head: 2,
    weapon: 3,
    necklace: 4,
    bracelet: 5,
    ring: 6,
    belt: 7,
  };
  layers.sort((a, b) => slotOrder[a.slot] - slotOrder[b.slot]);

  const growthTier = growthTierFor(level);
  const baseAsset =
    replacementBaseAsset ??
    (hasVisibleShoes ? CHARACTER_BASE_NOSHOES_ASSETS[classId] : CHARACTER_BASE_ASSETS[classId]);
  return {
    classId,
    baseAsset,
    growthTier,
    layers,
    equippedCount,
    visibleEquippedCount,
    highestVisibleQuality,
    activeBoutiqueTheme,
    boutiqueEffectAsset: boutiqueEffectAsset ?? null,
    activeDungeonTier,
    forgeStage: forgeStageAt(highestVisibleEnhance),
    weaponForgeStage: forgeStageAt(weaponEnhance),
    signature: [
      [
        replacementId ? `body:${replacementId}` : '',
        layers.map((layer) => `${layer.slot}:${layer.id}`).join('|'),
      ]
        .filter(Boolean)
        .join('|') || 'base',
      activeBoutiqueTheme ? `theme:${activeBoutiqueTheme}` : '',
      activeDungeonTier ? `dungeon:${activeDungeonTier}` : '',
    ]
      .filter(Boolean)
      .join('|'),
    ariaLabel: visibleNames.length
      ? `${growthTier.label}角色，当前可见外观：${visibleNames.join('、')}${
          activeBoutiqueTheme ? `，激活${BOUTIQUE_THEMES[activeBoutiqueTheme].name}特效` : ''
        }${
          activeDungeonTier
            ? `，激活${requireDungeonTier(activeDungeonTier).setName}共鸣外观`
            : ''
        }`
      : activeDungeonTier
        ? `${growthTier.label}角色，首饰激活${requireDungeonTier(activeDungeonTier).setName}共鸣外观`
        : `${growthTier.label}角色，当前为基础训练装`,
  };
}

function requireDungeonTier(tierId: EquipmentDungeonTierId) {
  const tier = EQUIPMENT_DUNGEON_TIERS.find((candidate) => candidate.id === tierId);
  if (!tier) throw new Error(`[配置错误] 装备副本外观档不存在：${tierId}`);
  return tier;
}
