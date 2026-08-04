/**
 * 套装图鉴（M5-5）视图装配层。
 *
 * 只做「读 data 表 + 读存档快照」的纯装配，没有任何数值口径：套装件数、
 * 加成文案、碎片成本、副本解锁等级全部直接引用各 data 权威表，本模块不复制
 * 任何游戏数值（铁律 2）。改动 data 表后图鉴自动跟随，不需要回来改这里。
 */

import type { ClassId, EquipmentDef, EquipmentInstance, EquipSlot } from '@/core/types';
import { getEquipment, requireEquipment } from '@/data/equipment';
import { ARENA_EQUIPMENT_SET, arenaEquipmentForClass } from '@/data/arenaEquipment';
import {
  equipmentDungeonGearFor,
  requireEquipmentDungeonTier,
} from '@/data/equipmentDungeonGear';
import { EQUIPMENT_DUNGEON_SETS, type EquipmentDungeonSetDefinition } from '@/data/equipmentDungeonSets';
import { EQUIPMENT_SET_CRAFTING_RECIPES } from '@/data/equipmentSetCrafting';
import { requireItem } from '@/data/items';
import { REGION_5, REGION_5_SET_ID } from '@/data/region5';
import { REGION_6, REGION_6_SET_ID } from '@/data/region6';
import {
  REGION_7,
  REGION_7_COMPLETION_BADGE,
  REGION_7_COMPLETION_TITLE,
  REGION_7_SET_ID,
} from '@/data/region7';
import {
  REGION_8,
  REGION_8_COMPLETION_BADGE,
  REGION_8_COMPLETION_TITLE,
  REGION_8_SET_ID,
} from '@/data/region8';
import { REGION_EQUIPMENT_SETS } from '@/data/regionEquipmentSets';
import { IMPRINT_BATCH_ACTIVE } from '@/ui/imprintActivation';

export type SetCodexGroup = 'region' | 'dungeon' | 'arena';

export const SET_CODEX_GROUP_LABELS: Readonly<Record<SetCodexGroup, string>> = {
  region: '区域套装',
  dungeon: '副本套装',
  arena: '竞技场套装',
};

/** 一个槽位的代表装备与「算拥有」的全部定义 ID（同款变体 / 同槽职业装）。 */
export interface SetCodexPiece {
  slot: EquipSlot;
  def: EquipmentDef;
  altDefIds: readonly string[];
}

export interface SetCodexBonusLine {
  pieces: number;
  label: string;
  description: string;
}

export interface SetCodexCraft {
  fragmentItemId: string;
  fragmentName: string;
  fragmentIcon: string;
  cost: number;
}

export interface SetCodexEntry {
  setId: string;
  name: string;
  group: SetCodexGroup;
  /** 来源定位：区域 5「熔岩神殿」 / 装备副本「晴蓝梦匣」 / 竞技场荣誉商店 */
  subtitle: string;
  sourceLines: readonly string[];
  /** 按套装登记的槽位顺序排列 */
  pieces: readonly SetCodexPiece[];
  bonuses: readonly SetCodexBonusLine[];
  craft: SetCodexCraft | null;
  completionTitle: string | null;
  completionBadge: string | null;
  /** 烙印激活批次后旧副本整装转为绝版（docs/58 §3.3），只影响展示口径。 */
  legacy: boolean;
  /** 圣痕套效果只在竞技场内生效（docs/53 红线），图鉴必须显式标注。 */
  arenaOnly: boolean;
}

const REGION_SET_META = [
  {
    setId: REGION_5_SET_ID,
    regionIndex: REGION_5.index,
    regionName: REGION_5.name,
    completionTitle: null,
    completionBadge: null,
  },
  {
    setId: REGION_6_SET_ID,
    regionIndex: REGION_6.index,
    regionName: REGION_6.name,
    completionTitle: null,
    completionBadge: null,
  },
  {
    setId: REGION_8_SET_ID,
    regionIndex: REGION_8.index,
    regionName: REGION_8.name,
    completionTitle: REGION_8_COMPLETION_TITLE,
    completionBadge: REGION_8_COMPLETION_BADGE,
  },
  {
    setId: REGION_7_SET_ID,
    regionIndex: REGION_7.index,
    regionName: REGION_7.name,
    completionTitle: REGION_7_COMPLETION_TITLE,
    completionBadge: REGION_7_COMPLETION_BADGE,
  },
] as const;

function craftingRecipeForSet(setId: string) {
  const recipe = Object.values(EQUIPMENT_SET_CRAFTING_RECIPES).find((r) => r.setId === setId);
  if (!recipe) throw new Error(`[配置错误] 区域套装缺少合成配方：${setId}`);
  return recipe;
}

function buildBonusLines(setId: string, bonuses: SetCodexEntry['bonuses']): SetCodexBonusLine[] {
  if (bonuses.length === 0) throw new Error(`[配置错误] 套装没有任何加成档位：${setId}`);
  return bonuses.map((bonus) => ({
    pieces: bonus.pieces,
    label: bonus.label,
    description: bonus.description,
  }));
}

function buildRegionEntry(
  meta: (typeof REGION_SET_META)[number],
): SetCodexEntry {
  const definition = REGION_EQUIPMENT_SETS[meta.setId];
  if (!definition) throw new Error(`[配置错误] 区域套装未登记：${meta.setId}`);
  const recipe = craftingRecipeForSet(meta.setId);
  const fragment = requireItem(recipe.fragmentItemId);

  const pieces = definition.pieceSlots.map((slot) => {
    const defId = recipe.targetDefIds[slot];
    if (!defId) {
      throw new Error(`[配置错误] 配方 ${recipe.id} 缺少槽位 ${slot} 的目标装备`);
    }
    return { slot, def: requireEquipment(defId), altDefIds: [defId] as const };
  });

  return {
    setId: definition.id,
    name: definition.name,
    group: 'region',
    subtitle: `区域 ${meta.regionIndex}「${meta.regionName}」`,
    sourceLines: [
      `区域 ${meta.regionIndex}「${meta.regionName}」掉落${fragment.name}`,
      `${recipe.fragmentCount} 个${fragment.name}可定向合成任一部位`,
    ],
    pieces,
    bonuses: buildBonusLines(definition.id, definition.bonuses),
    craft: {
      fragmentItemId: fragment.id,
      fragmentName: fragment.name,
      fragmentIcon: fragment.icon,
      cost: recipe.fragmentCount,
    },
    completionTitle: meta.completionTitle,
    completionBadge: meta.completionBadge,
    legacy: false,
    arenaOnly: false,
  };
}

function buildDungeonEntry(
  definition: EquipmentDungeonSetDefinition,
  classId: ClassId,
): SetCodexEntry {
  const tier = requireEquipmentDungeonTier(definition.tierId);
  const pieces = definition.pieceSlots.map((slot) => {
    const defs =
      slot === 'weapon' || slot === 'body'
        ? equipmentDungeonGearFor(tier.id, slot, classId)
        : equipmentDungeonGearFor(tier.id, slot);
    if (defs.length === 0) {
      throw new Error(`[配置错误] 副本套装 ${definition.id} 缺少槽位 ${slot} 的装备`);
    }
    return { slot, def: defs[0], altDefIds: defs.map((d) => d.id) };
  });

  return {
    setId: definition.id,
    name: definition.name,
    group: 'dungeon',
    subtitle: `装备副本「${tier.name}」`,
    sourceLines: IMPRINT_BATCH_ACTIVE
      ? [
          `「${tier.name}」已随烙印改版改为掉落材料，整装不再产出`,
          '已获得的装备全部保留（绝版）',
        ]
      : [`通关装备副本「${tier.name}」掉落`, `角色 ${tier.unlockLevel} 级解锁该副本`],
    pieces,
    bonuses: buildBonusLines(definition.id, definition.bonuses),
    craft: null,
    completionTitle: null,
    completionBadge: null,
    legacy: IMPRINT_BATCH_ACTIVE,
    arenaOnly: false,
  };
}

function buildArenaEntry(classId: ClassId): SetCodexEntry | null {
  const definition = ARENA_EQUIPMENT_SET;
  const classDefs = arenaEquipmentForClass(classId);
  // 第五职业 P1 尚未制作圣痕装备。完整缺席代表该职业尚未开放本套装；
  // 若只缺部分槽位则仍视为配置错误，不能拿别的职业装备兜底。
  if (classDefs.length === 0) return null;
  const pieces = definition.pieceSlots.map((slot) => {
    const def = classDefs.find((d) => d.slot === slot);
    if (!def) throw new Error(`[配置错误] 圣痕套缺少 ${classId} 的槽位 ${slot}`);
    return { slot, def, altDefIds: [def.id] as const };
  });

  return {
    setId: definition.id,
    name: definition.name,
    group: 'arena',
    subtitle: '竞技场荣誉商店',
    sourceLines: ['竞技场荣誉商店兑换', '套装效果只在竞技场对战中生效，挂机与主线不生效'],
    pieces,
    bonuses: buildBonusLines(definition.id, definition.bonuses),
    craft: null,
    completionTitle: null,
    completionBadge: null,
    legacy: false,
    arenaOnly: true,
  };
}

/**
 * 全部套装的图鉴装配：3 区域套（按区域序号）+ 4 副本套（按解锁等级）+
 * 当前职业已经实际配置的圣痕套。
 */
export function buildSetCodex(classId: ClassId): SetCodexEntry[] {
  const regionEntries = REGION_SET_META.map((meta) => buildRegionEntry(meta));
  const dungeonEntries = Object.values(EQUIPMENT_DUNGEON_SETS)
    .slice()
    .sort(
      (a, b) =>
        requireEquipmentDungeonTier(a.tierId).unlockLevel -
        requireEquipmentDungeonTier(b.tierId).unlockLevel,
    )
    .map((definition) => buildDungeonEntry(definition, classId));
  const arenaEntry = buildArenaEntry(classId);
  return arenaEntry
    ? [...regionEntries, ...dungeonEntries, arenaEntry]
    : [...regionEntries, ...dungeonEntries];
}

/** 进度计算的存档快照输入：只取所需字段，视图直接传入 store 的响应式对象即可。 */
export interface SetCollectionInput {
  bagEquipment: readonly Pick<EquipmentInstance, 'defId'>[];
  equipped: readonly (Pick<EquipmentInstance, 'defId' | 'imprintSetId'> | null)[];
  bagItems: Readonly<Record<string, number>>;
  /**
   * 永久图鉴账本里「曾经获得过」的定义 id（存档 v17 起）。
   *
   * 有了它，分解装备不再让图鉴进度倒退（docs/40 红线）——
   * 这也是这一页从「当前持有」升级回「已收集」的依据。
   * 可选：老档迁移前或调用方没传时，退化成只看背包与穿戴，
   * 表现与 v17 之前完全一致。
   */
  discoveredDefIds?: readonly string[];
}

export interface SetProgress {
  ownedPieces: number;
  totalPieces: number;
  complete: boolean;
  /** 当前穿戴中结算进该套的件数（与 core resolver 同口径：烙印优先于定义）。 */
  equippedPieces: number;
  fragmentCount: number | null;
}

/** 单套收集进度：拥有一件即点亮该槽（同款变体 / 职业装任一即可）。 */
export function setProgressFor(entry: SetCodexEntry, input: SetCollectionInput): SetProgress {
  // 「曾经获得过」优先：分解掉的装备仍然算收集过（docs/63 §4.2）
  const ownedDefIds = new Set<string>(input.discoveredDefIds ?? []);
  for (const inst of input.bagEquipment) ownedDefIds.add(inst.defId);

  let equippedPieces = 0;
  for (const inst of input.equipped) {
    if (!inst) continue;
    ownedDefIds.add(inst.defId);
    const def = getEquipment(inst.defId);
    if (!def) throw new Error(`[配置错误] 装备定义不存在：${inst.defId}`);
    if ((inst.imprintSetId ?? def.setId) === entry.setId) equippedPieces += 1;
  }

  let ownedPieces = 0;
  for (const piece of entry.pieces) {
    if (piece.altDefIds.some((id) => ownedDefIds.has(id))) ownedPieces += 1;
  }

  return {
    ownedPieces,
    totalPieces: entry.pieces.length,
    complete: ownedPieces === entry.pieces.length,
    equippedPieces,
    fragmentCount: entry.craft ? (input.bagItems[entry.craft.fragmentItemId] ?? 0) : null,
  };
}
