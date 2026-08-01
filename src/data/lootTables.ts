/**
 * 掉落表 —— 生成。
 *
 * 每章 × 每怪物类型 一张表，id 规则见 monsters.ts 的 lootTableIdFor。
 *
 * 权重设计原则（docs/12 第五节「装备获取路径总表」）：
 *   小怪   高频低质：大量材料 + 少量白绿装
 *   精英   中频中质：蓝装为主
 *   BOSS   低频高质：紫装 + 章节专属材料，且带保底
 */

import type { LootTable, MonsterType, Quality } from '@/core/types';
import { ALL_CHAPTERS, regionOfChapter, type ChapterSpec } from './regions';
import { equipIdsOf, requireEquipment } from './equipment';
import { lootTableIdFor } from './monsters';
import { boutiqueBossDropIds } from './shop';
import { requireEnhanceProgression } from './enhanceProgression';
import { requireItem } from './items';
import {
  regionMaterialIdsForMonsterType,
  requireRegionMaterialPityCount,
  type RegionMaterialTier,
} from './materialSources';
import { regionLootProfile } from './regionLootProfiles';
import { region5FragmentLootForTable } from './region5Loot';
import { region6FragmentLootForTable } from './region6Loot';
import { region7FragmentLootForTable } from './region7Loot';

const REFORGE_DROP = {
  temper: 'sand_crystal',
  bind: 'charm_bind',
  resonance: 'crystal_resonance',
  sigils: {
    swordsman: 'sigil_swordsman',
    witch: 'sigil_witch',
    shaman: 'sigil_shaman',
    catkin: 'sigil_catkin',
    kenshi: 'sigil_kenshi',
  },
} as const;

/**
 * 区域 1～4 的现行装备权重已经迁到 regionLootProfiles.ts。
 *
 * ⚠ 这些权重是相对材料权重（MATERIAL_WEIGHT）而言的。
 * 原本小怪的装备总权重是 49、材料 560，即每只怪 8% 出装备 ——
 * 按满速 3 只/秒算就是 864 件/小时，背包必然爆炸。
 * 现在下调到约 2%（1/50 只），装备重新变成「偶尔出一件」的惊喜，
 * 而不是刷屏的垃圾。精英与 BOSS 保持较高产出，维持「打 BOSS 才有好东西」的手感。
 */
/** 材料权重：小怪掉得最多，BOSS 掉专属材料 */
const MATERIAL_WEIGHT: Record<MonsterType, number> = {
  normal: 200,
  elite: 120,
  boss: 80,
};

/** 每次击杀掷几次 */
const ROLLS: Record<MonsterType, number> = { normal: 1, elite: 2, boss: 4 };

function buildTable(spec: ChapterSpec, type: MonsterType): LootTable {
  const region = regionOfChapter(spec.id);
  const id = lootTableIdFor(spec.id, type);
  const entries: LootTable['entries'] = [];
  const enhanceLoot = requireEnhanceProgression(spec.id).loot[type];
  const guaranteed: LootTable['entries'] = enhanceLoot.guaranteed.map((drop) => ({ ...drop }));

  // ── 材料 ──
  const regionMaterialIds = regionMaterialIdsForMonsterType(
    spec.materials,
    type,
    (materialId): RegionMaterialTier | undefined => {
      const tier = requireItem(materialId).tier;
      return tier === 'common' || tier === 'fine' || tier === 'rare' ? tier : undefined;
    },
  );
  for (const matId of regionMaterialIds) {
    entries.push({
      itemId: matId,
      weight: MATERIAL_WEIGHT[type],
      minCount: type === 'boss' ? 3 : 1,
      maxCount: type === 'boss' ? 6 : type === 'elite' ? 3 : 2,
      ...(type === 'boss' ? { pityCount: requireRegionMaterialPityCount(matId) } : {}),
    });
  }

  // 强化材料按章节成长配置注入，避免关卡等级、成本与产出各写一套规则。
  entries.push(...enhanceLoot.entries.map((drop) => ({ ...drop })));

  // 洗练材料遵循「小怪供日常、精英供进阶、BOSS 供定向与突破」的来源分层。
  if (type === 'normal') {
    entries.push({
      itemId: REFORGE_DROP.temper,
      weight: 120,
      minCount: 1,
      maxCount: 2,
    });
  } else if (type === 'elite') {
    entries.push({
      itemId: REFORGE_DROP.bind,
      weight: 18,
      minCount: 1,
      maxCount: 1,
    });
  } else {
    for (const [classId, itemId] of Object.entries(REFORGE_DROP.sigils)) {
      entries.push({
        itemId,
        classId: classId as keyof typeof REFORGE_DROP.sigils,
        weight: 2,
        minCount: 1,
        maxCount: 1,
      });
    }
    entries.push({
      itemId: REFORGE_DROP.resonance,
      weight: 0.25,
      minCount: 1,
      maxCount: 1,
      pityCount: 80,
    });
  }

  // R5 套装碎片使用独立来源表，只向真实精英 / BOSS 对应的表注入。
  const region5Fragment = region5FragmentLootForTable(id);
  if (region5Fragment) entries.push(region5Fragment);
  const region6Fragment = region6FragmentLootForTable(id);
  if (region6Fragment) entries.push(region6Fragment);
  const region7Fragment = region7FragmentLootForTable(id);
  if (region7Fragment) entries.push(region7Fragment);

  // ── 装备 ──
  let pityGroups: LootTable['pityGroups'];
  const hasRealMonsterSource =
    type === 'normal' ||
    (type === 'elite' && Boolean(spec.elite)) ||
    (type === 'boss' && Boolean(spec.boss));
  if (region && hasRealMonsterSource) {
    const profile = regionLootProfile(region.id);
    for (const [quality, weight] of Object.entries(profile.qualityWeights[type]) as [
      Quality,
      number,
    ][]) {
      for (const eqId of equipIdsOf(region.id, quality)) {
        entries.push({
          itemId: eqId,
          // 8 个槽位平分该品质的权重，避免某个部位刷不出来
          weight: weight / 8,
          minCount: 1,
          maxCount: 1,
          // BOSS 的紫装带保底：连续 30 次没掉就必掉
          ...(type === 'boss' && quality === 'epic' ? { pityCount: 30 } : {}),
        });
      }
    }

    const qualityPity = profile.bossQualityPity;
    if (type === 'boss' && spec.boss && qualityPity) {
      const itemIds = equipIdsOf(region.id, qualityPity.quality);
      if (itemIds.length === 0) {
        throw new Error(
          `[配置错误] ${region.id} 的 ${qualityPity.quality} 品质组保底没有候选装备`,
        );
      }
      pityGroups = [
        {
          id: qualityPity.groupId,
          pityCount: qualityPity.pityCount,
          itemIds,
        },
      ];
    }
  }

  // ── BOSS 珍品直掉：商店同款也必须有「靠打获得」路径 ──
  if (type === 'boss') {
    for (const equipmentId of boutiqueBossDropIds(spec.id)) {
      const equipment = requireEquipment(equipmentId);
      entries.push({
        itemId: equipmentId,
        ...(equipment.classId ? { classId: equipment.classId } : {}),
        // 每件独立约十余天在线刷取；商店是昂贵但确定的保底路径。
        weight: 0.001,
        minCount: 1,
        maxCount: 1,
      });
    }
  }

  return {
    id,
    rolls: ROLLS[type],
    entries,
    ...(guaranteed.length > 0 ? { guaranteed } : {}),
    ...(pityGroups ? { pityGroups } : {}),
  };
}

function buildAll(): Record<string, LootTable> {
  const out: Record<string, LootTable> = {};
  for (const spec of ALL_CHAPTERS) {
    for (const type of ['normal', 'elite', 'boss'] as MonsterType[]) {
      // 没有精英/BOSS 的章节也生成表，避免引用时找不到
      const t = buildTable(spec, type);
      out[t.id] = t;
    }
  }
  return out;
}

export const LOOT_TABLES: Record<string, LootTable> = buildAll();

export function getLootTable(id: string): LootTable | undefined {
  return LOOT_TABLES[id];
}

/** 主流程必须显式暴露配置错误，不能用空掉落表把问题藏起来。 */
export function requireLootTable(id: string): LootTable {
  const table = LOOT_TABLES[id];
  if (!table) throw new Error(`[配置错误] 掉落表不存在：${id}`);
  return table;
}
