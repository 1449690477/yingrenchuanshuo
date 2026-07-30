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
import { expectedBuildCp } from './expectedPower';
import { ALL_CHAPTERS, STAGES_PER_CHAPTER, type ChapterSpec } from './regions';
import { bossOfChapter, eliteOfChapter, lootTableIdFor, normalsOfChapter } from './monsters';
import { DEFAULT_MAX_KILLS_PER_SEC } from './constants';
import { enhanceFirstClearRewards } from './enhanceProgression';

/**
 * 教学依赖的确定性装备来源。
 *
 * 2-5 开始正式教学炎克冰，因此上一章最终关固定给一把炎属性武器；这不是
 * “掉率高一点”的随机兜底，而是教程主流程的硬前置。后续若增加教学装备，
 * 必须在这里逐关登记并配来源测试。
 */
const STAGE_FIRST_CLEAR_GEAR_REWARDS: Readonly<
  Record<string, readonly { itemId: string; count: number }[]>
> = {
  'stage_2-4_6': [{ itemId: 'eq_r2_weapon_fine', count: 1 }],
};

/** 关卡等级：在章节区间内按关卡序号递增 */
function stageLevel(spec: ChapterSpec, idx: number): number {
  const t = STAGES_PER_CHAPTER <= 1 ? 0 : idx / (STAGES_PER_CHAPTER - 1);
  return Math.round(spec.levelFrom + (spec.levelTo - spec.levelFrom) * t);
}

/**
 * 推荐战力（docs/56 §3.2）。
 *
 * 口径 = expectedBuildCp（满配 × 典型强化 × 典型词条）× 0.85。
 * 0.85 与装备副本的 0.9 同方法论：留一段「养一养再来」的目标空间。
 *
 * 旧公式是「裸属性 × (0.85~1.85)」—— 实测 Lv50 比玩家真实水平低 6 倍、
 * Lv118 低 37 倍，战力参考显示 200%~3700%，参考线彻底失真（docs/56 病根二）。
 * 全游戏「该等级该多强」只允许 expectedPower 这一个口径，禁止再手填系数。
 */
const RECOMMEND_BUILD_RATIO = 0.85;

function estimateRecommendCP(level: number): number {
  const bare = combatPower(baseStatsFor('swordsman', level));

  // Lv1~5 特判维持「低于裸属性」：新号一件装备都没有，
  // 若按满配口径出推荐值，第一关就会显示「战力不足」（真出过这个 bug）。
  if (level <= 5) return Math.round(bare * 0.85);

  // 满配口径在低段可能低于裸属性口径（common 装备贡献小），取两者较大值
  // 保证推荐线单调、不出现「升级后推荐反而变低」的怪相。
  return Math.round(Math.max(bare * 0.85, expectedBuildCp(level) * RECOMMEND_BUILD_RATIO));
}

function buildWaves(spec: ChapterSpec, idx: number): { waves: Wave[]; bossId?: string } {
  const normals = normalsOfChapter(spec.id);
  const elite = eliteOfChapter(spec.id);
  const boss = bossOfChapter(spec.id);

  const isEliteStage = idx === 2;
  const isFinalStage = idx === STAGES_PER_CHAPTER - 1;
  const hasEliteWave = (isEliteStage || isFinalStage) && Boolean(elite);
  const hasBossWave = isFinalStage && Boolean(boss);

  const waves: Wave[] = [];
  // 第 3 / 6 关只有在确实存在精英或 BOSS 时才让出一波。
  // 没有特殊怪的章节仍应完整打 3 波小怪，不能因为关卡序号凭空少一波。
  const normalWaveCount = hasEliteWave || hasBossWave ? 2 : 3;

  for (let w = 0; w < normalWaveCount; w++) {
    // 波次里混 2 种小怪，数量随波次递增
    const a = normals[(idx + w) % normals.length];
    const b = normals[(idx + w + 1) % normals.length];
    const monsters: Wave['monsters'] = [];
    if (a) monsters.push({ id: a.id, count: 2 + w });
    if (b && b.id !== a?.id) monsters.push({ id: b.id, count: 1 + w });
    waves.push({ monsters });
  }

  if (hasEliteWave && elite) {
    waves.push({ monsters: [{ id: elite.id, count: 1 }] });
  }

  if (hasBossWave && boss) {
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
      const firstClearGearRewards = STAGE_FIRST_CLEAR_GEAR_REWARDS[id] ?? [];

      out[id] = {
        id,
        chapterId: spec.id,
        name: `${spec.name} ${idx + 1}`,
        level,
        waves,
        ...(bossId ? { bossId } : {}),
        recommendCP: estimateRecommendCP(level),
        firstClearRewards: [
          ...enhanceFirstClearRewards(spec.id, idx, Boolean(bossId)),
          ...firstClearGearRewards.map((reward) => ({ ...reward })),
        ],
        // 挂机基础收益统一掷普通表；store 再按真实波次为精英/BOSS 追加专属表。
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
