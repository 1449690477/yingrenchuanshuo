/**
 * 怪物图鉴的只读组合层（M4-8 P2，镜像 setCodexData 的分层）。
 *
 * 职责：把「怪物定义数据 + 账本」组合成图鉴页要渲染的分组结构。
 * 它是纯函数，不碰 Vue / Pinia / storage；账本来自 props（由上层从存档传入）。
 *
 * 红线：图鉴是只读展示层，**不得复制任何数值**（怪物名、等级、类型、
 * 素材路径一律引用 data 权威表）；新增怪物时本文件自动收录，不需要改这里。
 */

import type { MonsterCodexLedger } from '@/core/monsterCodex';
import type { MonsterType } from '@/core/types';
import { MONSTERS, monstersOfChapter } from '@/data/monsters';
import { REGIONS } from '@/data/regions';
import { requireMonsterVisual } from '@/data/monsterVisuals';

export interface MonsterCodexEntry {
  id: string;
  name: string;
  type: MonsterType;
  level: number;
  asset: string;
  discovered: boolean;
}

export interface MonsterCodexChapterGroup {
  chapterId: string;
  chapterName: string;
  entries: MonsterCodexEntry[];
  discoveredCount: number;
  total: number;
}

export interface MonsterCodexRegionGroup {
  regionId: string;
  regionName: string;
  levelText: string;
  chapters: MonsterCodexChapterGroup[];
  discoveredCount: number;
  total: number;
}

export interface MonsterCodexSummary {
  discovered: number;
  total: number;
}

export interface MonsterCodexData {
  regions: MonsterCodexRegionGroup[];
  summary: MonsterCodexSummary;
}

export function buildMonsterCodex(ledger: MonsterCodexLedger): MonsterCodexData {
  const discovered = new Set(ledger.discoveredMonsterIds);
  const regions: MonsterCodexRegionGroup[] = [];
  let discoveredTotal = 0;
  let total = 0;

  for (const region of REGIONS) {
    const chapters: MonsterCodexChapterGroup[] = [];
    let regionDiscovered = 0;
    let regionTotal = 0;

    for (const chapter of region.chapters) {
      const entries = monstersOfChapter(chapter.id).map((m) => ({
        id: m.id,
        name: m.name,
        type: m.type,
        level: m.level,
        asset: requireMonsterVisual(m.id).asset,
        discovered: discovered.has(m.id),
      }));
      const chapterDiscovered = entries.filter((e) => e.discovered).length;
      chapters.push({
        chapterId: chapter.id,
        chapterName: chapter.name,
        entries,
        discoveredCount: chapterDiscovered,
        total: entries.length,
      });
      regionDiscovered += chapterDiscovered;
      regionTotal += entries.length;
    }

    regions.push({
      regionId: region.id,
      regionName: region.name,
      levelText: `Lv${region.levelFrom}–${region.levelTo}`,
      chapters,
      discoveredCount: regionDiscovered,
      total: regionTotal,
    });
    discoveredTotal += regionDiscovered;
    total += regionTotal;
  }

  return { regions, summary: { discovered: discoveredTotal, total } };
}

/** 防空转：图鉴永远只收录 MONSTERS 里真实存在的怪物。 */
export function monsterCodexTotalMonsters(): number {
  return Object.keys(MONSTERS).length;
}
