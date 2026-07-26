/**
 * 怪物表 —— 由 regions.ts 的章节声明**生成**。
 *
 * 生成规则：
 *   每章 4 个小怪，等级在 levelFrom..levelTo 之间均匀分布
 *   有 elite 的章节额外生成一只精英（等级 = levelTo）
 *   有 boss 的章节额外生成一只 BOSS（等级 = levelTo）
 *
 * 想改某只怪的具体数值，不要改这里 —— 改 regions.ts 的声明，
 * 或者在 MONSTER_OVERRIDES 里加一条覆盖。
 */

import type { MonsterDef, MonsterType } from '@/core/types';
import { ALL_CHAPTERS, type ChapterSpec } from './regions';

/**
 * 个别怪物的手工微调。
 * key 为怪物 id，值会浅合并到生成结果上。
 */
const MONSTER_OVERRIDES: Record<string, Partial<MonsterDef>> = {
  // 首关第一只怪刻意调弱，保证新玩家进游戏就能秒掉，建立正反馈
  'mon_1-1_0': { hpMul: 0.5 },
  // 樱守·绯 是第一个 BOSS，不能太硬，否则新手会卡住
  'mon_1-5_boss': { hpMul: 0.6, atkMul: 0.8 },
};

function idFor(chapterId: string, key: string | number): string {
  return `mon_${chapterId}_${key}`;
}

/** 把小怪等级在章节区间内均匀铺开 */
function spreadLevel(spec: ChapterSpec, index: number, total: number): number {
  if (total <= 1) return spec.levelFrom;
  const t = index / (total - 1);
  return Math.round(spec.levelFrom + (spec.levelTo - spec.levelFrom) * t);
}

function make(
  chapterId: string,
  key: string | number,
  name: string,
  level: number,
  type: MonsterType,
  spec: ChapterSpec,
): MonsterDef {
  const id = idFor(chapterId, key);
  const base: MonsterDef = {
    id,
    name,
    level,
    type,
    element: spec.element,
    lootTableId: lootTableIdFor(chapterId, type),
    sprite: `monsters/${id}.png`,
    desc: type === 'boss' ? `${spec.name}的守护者。` : undefined,
  };
  return { ...base, ...MONSTER_OVERRIDES[id] };
}

/** 掉落表 id 规则。lootTables.ts 按同一规则生成，两边必须一致。 */
export function lootTableIdFor(chapterId: string, type: MonsterType): string {
  return `loot_${chapterId}_${type}`;
}

function buildMonsters(): Record<string, MonsterDef> {
  const out: Record<string, MonsterDef> = {};

  for (const spec of ALL_CHAPTERS) {
    spec.normals.forEach((name, i) => {
      const m = make(spec.id, i, name, spreadLevel(spec, i, spec.normals.length), 'normal', spec);
      out[m.id] = m;
    });

    if (spec.elite) {
      const m = make(spec.id, 'elite', spec.elite, spec.levelTo, 'elite', spec);
      out[m.id] = m;
    }

    if (spec.boss) {
      const m = make(spec.id, 'boss', spec.boss, spec.levelTo, 'boss', spec);
      out[m.id] = m;
    }
  }

  return out;
}

export const MONSTERS: Record<string, MonsterDef> = buildMonsters();

export function getMonster(id: string): MonsterDef | undefined {
  return MONSTERS[id];
}

export function requireMonster(id: string): MonsterDef {
  const monster = MONSTERS[id];
  if (!monster) throw new Error(`[配置错误] 怪物不存在：${id}`);
  return monster;
}

/** 某章节的全部怪物 */
export function monstersOfChapter(chapterId: string): MonsterDef[] {
  return Object.values(MONSTERS).filter((m) => m.id.startsWith(`mon_${chapterId}_`));
}

/** 某章节的小怪（不含精英与 BOSS） */
export function normalsOfChapter(chapterId: string): MonsterDef[] {
  return monstersOfChapter(chapterId).filter((m) => m.type === 'normal');
}

export function eliteOfChapter(chapterId: string): MonsterDef | undefined {
  return MONSTERS[idFor(chapterId, 'elite')];
}

export function bossOfChapter(chapterId: string): MonsterDef | undefined {
  return MONSTERS[idFor(chapterId, 'boss')];
}
