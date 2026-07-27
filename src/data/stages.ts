/**
 * 关卡表 —— 生成。
 *
 * 每章 6 关（STAGES_PER_CHAPTER）：
 *   第 1、2、4、5 关：3 波小怪
 *   第 3 关：2 波小怪 + 精英
 *   第 6 关：2 波小怪 + 精英 + BOSS（若该章有 BOSS）
 *
 * recommendCP 由公式估算，不手填 —— 见 docs/02 的 Stage 定义。
 */

import type { Stage, Wave } from '@/core/types';
import { combatPower } from '@/core/formula';
import { baseStatsFor, monsterHp } from '@/core/progression';
import { ALL_CHAPTERS, STAGES_PER_CHAPTER, type ChapterSpec } from './regions';
import { bossOfChapter, eliteOfChapter, lootTableIdFor, normalsOfChapter } from './monsters';
import { DEFAULT_MAX_KILLS_PER_SEC } from './constants';

/** 关卡等级：在章节区间内按关卡序号递增 */
function stageLevel(spec: ChapterSpec, idx: number): number {
  const t = STAGES_PER_CHAPTER <= 1 ? 0 : idx / (STAGES_PER_CHAPTER - 1);
  return Math.round(spec.levelFrom + (spec.levelTo - spec.levelFrom) * t);
}

/**
 * 推荐战力估算。
 *
 * 思路：取「该等级裸属性战力」的一个倍数。倍数随关卡推进略微上升，
 * 反映出玩家需要靠装备补上缺口（怪物血量指数比装备快 0.1，见 ADR-005）。
 *
 * 这只是给玩家的参考线，宁可略低一点也不要虚高 ——
 * 虚高会让玩家以为打不过而不敢挂。
 */
function estimateRecommendCP(level: number): number {
  const bare = combatPower(baseStatsFor('swordsman', level));

  // 装备依赖度随等级上升：Lv1 玩家一件装备都没有，推荐战力必须低于裸属性，
  // 否则新号进游戏第一关就被判定「战力不足」而无法挂机（真出过这个 bug）。
  // 到 Lv50 之后需要接近满配，系数收敛到 1.85。
  const gearFactor = 0.85 + Math.min(1.0, (level - 1) * 0.02);
  return Math.round(bare * gearFactor);
}

function buildWaves(spec: ChapterSpec, idx: number): { waves: Wave[]; bossId?: string } {
  const normals = normalsOfChapter(spec.id);
  const elite = eliteOfChapter(spec.id);
  const boss = bossOfChapter(spec.id);

  const isEliteStage = idx === 2;
  const isFinalStage = idx === STAGES_PER_CHAPTER - 1;

  const waves: Wave[] = [];
  const normalWaveCount = isEliteStage || isFinalStage ? 2 : 3;

  for (let w = 0; w < normalWaveCount; w++) {
    // 波次里混 2 种小怪，数量随波次递增
    const a = normals[(idx + w) % normals.length];
    const b = normals[(idx + w + 1) % normals.length];
    const monsters: Wave['monsters'] = [];
    if (a) monsters.push({ id: a.id, count: 2 + w });
    if (b && b.id !== a?.id) monsters.push({ id: b.id, count: 1 + w });
    waves.push({ monsters });
  }

  if ((isEliteStage || isFinalStage) && elite) {
    waves.push({ monsters: [{ id: elite.id, count: 1 }] });
  }

  if (isFinalStage && boss) {
    waves.push({ monsters: [{ id: boss.id, count: 1 }] });
    return { waves, bossId: boss.id };
  }

  return { waves };
}

function buildStages(): Record<string, Stage> {
  const out: Record<string, Stage> = {};

  for (const spec of ALL_CHAPTERS) {
    for (let idx = 0; idx < STAGES_PER_CHAPTER; idx++) {
      const level = stageLevel(spec, idx);
      const { waves, bossId } = buildWaves(spec, idx);
      const id = `stage_${spec.id}_${idx + 1}`;
      const isFinal = idx === STAGES_PER_CHAPTER - 1;
      const firstClearRewards: Stage['firstClearRewards'] = [
        {
          itemId: isFinal ? 'stone_reforge' : 'stone_enhance',
          count: isFinal ? 2 : idx + 1,
        },
      ];
      if (isFinal && bossId) {
        firstClearRewards.push(
          { itemId: 'ore_black', count: 10 },
          { itemId: 'lucky_nine', count: 1 },
          { itemId: 'charm_protect', count: 1 },
        );
      }

      out[id] = {
        id,
        chapterId: spec.id,
        name: `${spec.name} ${idx + 1}`,
        level,
        waves,
        ...(bossId ? { bossId } : {}),
        recommendCP: estimateRecommendCP(level),
        firstClearRewards,
        // 持续挂机的每次普通击杀只掷普通表；BOSS 表由完整波次结束时单独结算。
        lootTableId: lootTableIdFor(spec.id, 'normal'),
        maxKillsPerSec: DEFAULT_MAX_KILLS_PER_SEC,
        element: spec.element,
      };
    }
  }

  return out;
}

export const STAGES: Record<string, Stage> = buildStages();

export const STAGE_LIST: Stage[] = Object.values(STAGES);

export function getStage(id: string): Stage | undefined {
  return STAGES[id];
}

export function stagesOfChapter(chapterId: string): Stage[] {
  return STAGE_LIST.filter((s) => s.chapterId === chapterId);
}

/** 全部关卡按顺序排列，用于「上一关 / 下一关」和解锁判定 */
export const ORDERED_STAGE_IDS: string[] = ALL_CHAPTERS.flatMap((c) =>
  stagesOfChapter(c.id).map((s) => s.id),
);

/** 第一关，新号默认挂机点 */
export const FIRST_STAGE_ID = ORDERED_STAGE_IDS[0]!;

/** 某关的下一关，没有则返回 undefined */
export function nextStageId(stageId: string): string | undefined {
  const i = ORDERED_STAGE_IDS.indexOf(stageId);
  if (i < 0 || i + 1 >= ORDERED_STAGE_IDS.length) return undefined;
  return ORDERED_STAGE_IDS[i + 1];
}

/** 该关卡的代表性怪物血量，用于挂机产出估算 */
export function representativeMonsterLevel(stage: Stage): number {
  return stage.level;
}

/** 关卡内怪物总数，用于「通关需要打多少只」的显示 */
export function totalMonsterCount(stage: Stage): number {
  return stage.waves.reduce((s, w) => s + w.monsters.reduce((n, m) => n + m.count, 0), 0);
}

/** 关卡平均怪物血量（含精英/BOSS 加权），挂机估算用 */
export function averageMonsterHp(stage: Stage): number {
  return monsterHp(stage.level, 'normal');
}
