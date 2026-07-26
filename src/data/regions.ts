/**
 * 区域 / 章节 / 关卡 的声明式定义。
 *
 * 关卡、怪物、掉落表都由这份声明**生成**，不手写 —— 见 docs/12 第七节。
 * 手写 300 个关卡必然出错且无法维护。
 *
 * 世界观与等级段见 docs/11-地图与关卡.md。
 * 美术基调见 ADR-008：即使是亡灵/恶魔题材也走可爱路线。
 */

import type { Element } from '@/core/types';

export interface ChapterSpec {
  /** 章节号，如 '1-3' */
  id: string;
  name: string;
  levelFrom: number;
  levelTo: number;
  element: Element;
  /** 小怪名（4 个），等级在 levelFrom..levelTo 之间分布 */
  normals: string[];
  /** 精英怪名，可空 */
  elite?: string;
  /** 章节 BOSS 名，每章最后一关。可空 */
  boss?: string;
  /** 本章掉落的材料 id */
  materials: string[];
  /** 首次通关的引导提示，用于新手教学 */
  tutorial?: string;
  /** 章节场景图，用于关卡选择与挂机战场背景 */
  mapAsset: string;
}

export interface RegionSpec {
  id: string;
  index: number;
  name: string;
  subtitle: string;
  levelFrom: number;
  levelTo: number;
  /** 主题色，用于区域卡片渐变 */
  theme: [string, string];
  /** 区域总览图 */
  mapAsset: string;
  chapters: ChapterSpec[];
}

// ─────────────────────────────────────────────
// 区域 1 · 樱花初镇（Lv 1–10）
// 基调：明亮、温暖、零压力。唯一任务是让玩家 5 分钟内学会怎么玩。
// ─────────────────────────────────────────────
const REGION_1: RegionSpec = {
  id: 'r1',
  index: 1,
  name: '樱花初镇',
  subtitle: '飘着花瓣的温暖小镇',
  levelFrom: 1,
  levelTo: 10,
  theme: ['#ffd6e7', '#ffeef5'],
  mapAsset: 'assets/maps/r1.webp',
  chapters: [
    {
      id: '1-1',
      name: '初醒的樱庭',
      levelFrom: 1,
      levelTo: 2,
      element: 'none',
      normals: ['樱花精灵', '迷路兔娘', '小花妖', '飘叶灵'],
      materials: ['petal_sakura', 'grass_soft'],
      tutorial: '挂机会自动打怪，离开后回来能领取离线收益。',
      mapAsset: 'assets/maps/chapter-1-1.webp',
    },
    {
      id: '1-2',
      name: '镇外小径',
      levelFrom: 3,
      levelTo: 4,
      element: 'none',
      normals: ['蘑菇娘', '野猫娘', '草团子', '风铃精'],
      materials: ['petal_sakura', 'grass_soft'],
      tutorial: '掉落的装备可以在「养成」里穿上，战力会提升。',
      mapAsset: 'assets/maps/chapter-1-2.webp',
    },
    {
      id: '1-3',
      name: '荒废的花房',
      levelFrom: 5,
      levelTo: 6,
      element: 'none',
      normals: ['藤蔓娘', '花妖', '盆栽小怪', '洒水壶灵'],
      elite: '温室看守',
      materials: ['petal_sakura', 'bell_wood'],
      tutorial: '装备可以强化，+5 以内绝对不会失败，放心点。',
      mapAsset: 'assets/maps/chapter-1-3.webp',
    },
    {
      id: '1-4',
      name: '樱之林深处',
      levelFrom: 7,
      levelTo: 8,
      element: 'none',
      normals: ['树灵', '木偶娘', '林间萤火', '苔藓兔'],
      elite: '古木守卫',
      materials: ['bell_wood', 'grass_soft'],
      tutorial: '等级到了会解锁新技能，技能在挂机时自动释放。',
      mapAsset: 'assets/maps/chapter-1-4.webp',
    },
    {
      id: '1-5',
      name: '落樱结界',
      levelFrom: 9,
      levelTo: 10,
      element: 'none',
      normals: ['结界守卫', '樱吹雪', '光之碎片', '守护木灵'],
      elite: '结界巡守',
      boss: '樱守·绯',
      materials: ['core_barrier', 'petal_sakura'],
      tutorial: '打过 BOSS 后就能「扫荡」这一关，用体力换收益，不用一直挂着。',
      mapAsset: 'assets/maps/chapter-1-5.webp',
    },
  ],
};

// ─────────────────────────────────────────────
// 区域 2 · 迷糊草原（Lv 10–20）
// 基调：Q 版、搞笑。棉花糖史莱姆、会打瞌睡的稻草人娘。
// ─────────────────────────────────────────────
const REGION_2: RegionSpec = {
  id: 'r2',
  index: 2,
  name: '迷糊草原',
  subtitle: '连怪物都在打瞌睡',
  levelFrom: 10,
  levelTo: 20,
  theme: ['#cdeafd', '#eaf7ff'],
  mapAsset: 'assets/maps/r2.webp',
  chapters: [
    {
      id: '2-1',
      name: '棉花糖丘陵',
      levelFrom: 10,
      levelTo: 12,
      element: 'none',
      normals: ['棉花糖史莱姆', '云朵兔', '软糖小怪', '糖霜蝶'],
      materials: ['jelly_cotton', 'grass_soft'],
      mapAsset: 'assets/maps/chapter-2-1.webp',
    },
    {
      id: '2-2',
      name: '打盹稻草田',
      levelFrom: 12,
      levelTo: 14,
      element: 'none',
      normals: ['稻草人娘', '瞌睡麻雀', '草垛怪', '晒谷灵'],
      elite: '稻草田监工',
      materials: ['straw_sleepy', 'grass_soft'],
      mapAsset: 'assets/maps/chapter-2-2.webp',
    },
    {
      id: '2-3',
      name: '蜂娘蜂巢',
      levelFrom: 14,
      levelTo: 16,
      element: 'none',
      normals: ['小蜜蜂娘', '花粉精', '巢穴守卫', '蜜滴怪'],
      elite: '蜂后侍卫',
      materials: ['honey_bee', 'jelly_cotton'],
      mapAsset: 'assets/maps/chapter-2-3.webp',
    },
    {
      id: '2-4',
      name: '迷路者营地',
      levelFrom: 16,
      levelTo: 18,
      element: 'none',
      normals: ['迷路旅人', '营火精', '行囊怪', '路标灵'],
      elite: '营地首领',
      materials: ['straw_sleepy', 'honey_bee'],
      mapAsset: 'assets/maps/chapter-2-4.webp',
    },
    {
      id: '2-5',
      name: '草原祭坛',
      levelFrom: 18,
      levelTo: 20,
      element: 'ice',
      normals: ['祭坛守卫', '结晶史莱姆', '古文碑灵', '冰霜团子'],
      elite: '祭坛祭司',
      boss: '大史莱姆女王',
      materials: ['crystal_altar', 'jelly_cotton'],
      tutorial: '有些关卡的怪带属性。炎克冰、冰克雷、雷克炎，穿对属性装备伤害更高。',
      mapAsset: 'assets/maps/chapter-2-5.webp',
    },
  ],
};

/** 全部区域。M2 只做前两个，后续区域按 docs/11 逐步补。 */
export const REGIONS: RegionSpec[] = [REGION_1, REGION_2];

/** 每章的关卡数 */
export const STAGES_PER_CHAPTER = 6;

export const ALL_CHAPTERS: ChapterSpec[] = REGIONS.flatMap((r) => r.chapters);

export function getRegion(id: string): RegionSpec | undefined {
  return REGIONS.find((r) => r.id === id);
}

export function requireRegion(id: string): RegionSpec {
  const region = getRegion(id);
  if (!region) throw new Error(`[配置错误] 区域不存在：${id}`);
  return region;
}

export function getChapter(id: string): ChapterSpec | undefined {
  return ALL_CHAPTERS.find((c) => c.id === id);
}

export function requireChapter(id: string): ChapterSpec {
  const chapter = getChapter(id);
  if (!chapter) throw new Error(`[配置错误] 章节不存在：${id}`);
  return chapter;
}

/** 章节所属区域 */
export function regionOfChapter(chapterId: string): RegionSpec | undefined {
  return REGIONS.find((r) => r.chapters.some((c) => c.id === chapterId));
}

export function requireRegionOfChapter(chapterId: string): RegionSpec {
  const region = regionOfChapter(chapterId);
  if (!region) throw new Error(`[配置错误] 章节没有所属区域：${chapterId}`);
  return region;
}
