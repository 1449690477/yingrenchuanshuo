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
import { equipIdsOf } from './equipment';
import { lootTableIdFor } from './monsters';
import { boutiqueBossDropIds } from './shop';

/** 各怪物类型能掉的装备品质及权重 */
/**
 * 各怪物类型能掉的装备品质及权重。
 *
 * ⚠ 这些权重是相对材料权重（MATERIAL_WEIGHT）而言的。
 * 原本小怪的装备总权重是 49、材料 560，即每只怪 8% 出装备 ——
 * 按满速 3 只/秒算就是 864 件/小时，背包必然爆炸。
 * 现在下调到约 2%（1/50 只），装备重新变成「偶尔出一件」的惊喜，
 * 而不是刷屏的垃圾。精英与 BOSS 保持较高产出，维持「打 BOSS 才有好东西」的手感。
 */
const QUALITY_WEIGHTS: Record<MonsterType, Partial<Record<Quality, number>>> = {
  normal: { common: 8, fine: 3, rare: 0.6 },
  elite: { common: 12, fine: 20, rare: 8, epic: 1 },
  boss: { fine: 20, rare: 40, epic: 12 },
};

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

  // ── 材料 ──
  for (const matId of spec.materials) {
    entries.push({
      itemId: matId,
      weight: MATERIAL_WEIGHT[type],
      minCount: type === 'boss' ? 3 : 1,
      maxCount: type === 'boss' ? 6 : type === 'elite' ? 3 : 2,
    });
  }

  // 强化石全程通用，保证玩家永远有东西可强化
  entries.push({
    itemId: 'stone_enhance',
    weight: MATERIAL_WEIGHT[type] * 0.8,
    minCount: 1,
    maxCount: type === 'boss' ? 8 : type === 'elite' ? 4 : 2,
  });

  // +10 以上材料必须有真实可重复来源，不能让强化台在 +9 后变成死功能。
  if (type === 'elite' && spec.levelFrom >= 7) {
    entries.push({
      itemId: 'ore_black',
      weight: 8,
      minCount: 1,
      maxCount: 2,
    });
  }
  if (type === 'boss' && spec.boss) {
    entries.push(
      {
        itemId: 'lucky_nine',
        weight: 6,
        minCount: 1,
        maxCount: 1,
      },
      {
        itemId: 'charm_protect',
        weight: 2,
        minCount: 1,
        maxCount: 1,
      },
    );
  }

  // ── 装备 ──
  if (region) {
    for (const [quality, weight] of Object.entries(QUALITY_WEIGHTS[type]) as [Quality, number][]) {
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
  }

  // ── BOSS 珍品直掉：商店同款也必须有「靠打获得」路径 ──
  if (type === 'boss') {
    for (const equipmentId of boutiqueBossDropIds(spec.id)) {
      entries.push({
        itemId: equipmentId,
        // 每件独立约十余天在线刷取；商店是昂贵但确定的保底路径。
        weight: 0.001,
        minCount: 1,
        maxCount: 1,
      });
    }
  }

  // ── BOSS 额外：洗练石 ──
  const guaranteed: LootTable['entries'] = [];
  if (type === 'boss' && spec.boss) {
    guaranteed.push(
      { itemId: 'stone_reforge', weight: 0, minCount: 1, maxCount: 3 },
      { itemId: 'ore_black', weight: 0, minCount: 3, maxCount: 6 },
    );
  }

  return { id, rolls: ROLLS[type], entries, ...(guaranteed.length > 0 ? { guaranteed } : {}) };
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
