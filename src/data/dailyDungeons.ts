/**
 * M4-4 · 日常材料副本定义（docs/14：Lv15 开放，周一到周日轮换材料本；
 * docs/30：3 个难度）。
 *
 * 内容与代码分离（铁律 2）：本文件只描述副本内容（主题/轮换/难度/奖励），
 * 轮换判定与门禁逻辑在 core/dailyDungeons.ts。
 *
 * 设计口径：
 * - 日常副本是材料的定向补充渠道（挂机掉落为主，这里补缺），数值保守；
 * - 轮换按业务日切 key 推导星期，与全游戏共用同一套日切（docs/52 §九）；
 * - 奖励只复用既有材料 id（ENHANCE_MATERIAL_IDS）与金币，零新物品。
 */

import { ENHANCE_MATERIAL_IDS } from './constants';

/** 日常副本开放等级（docs/14 系统清单）。 */
export const DAILY_DUNGEON_UNLOCK_LEVEL = 15;

/** 每个主题每天可挑战的次数上限（每档难度各计一次）。 */
export const DAILY_DUNGEON_RUNS_PER_TIER = 1;

/** 副本主题：决定产出材料。 */
export type DailyDungeonThemeId = 'stone' | 'ore' | 'lucky';

export interface DailyDungeonTheme {
  id: DailyDungeonThemeId;
  /** 玩家可见的副本名。 */
  name: string;
  /** 一句话描述（UI 副标题）。 */
  subtitle: string;
  /** 主题材料 id（发放走 bag.items 既有口径）。 */
  materialId: string;
  /** 主题色（与装备副本门户同款用法）。 */
  accent: string;
}

/** 三个材料主题：强化石 / 黑铁矿 / 幸运九。 */
export const DAILY_DUNGEON_THEMES: readonly DailyDungeonTheme[] = [
  {
    id: 'stone',
    name: '星辉石窟',
    subtitle: '强化石的矿脉，洞壁闪着星屑。',
    materialId: ENHANCE_MATERIAL_IDS.stone,
    accent: '#ff718c',
  },
  {
    id: 'ore',
    name: '黑铁回廊',
    subtitle: '沉在暮色里的矿道，黑铁矿成串垂落。',
    materialId: ENHANCE_MATERIAL_IDS.ore,
    accent: '#8f8cff',
  },
  {
    id: 'lucky',
    name: '幸运虹厅',
    subtitle: '虹光落下的厅堂，传闻能捡到好运。',
    materialId: ENHANCE_MATERIAL_IDS.lucky,
    accent: '#ffb26b',
  },
];

/**
 * 周一到周日的主题轮换（下标 0 = 周一）。
 * 周一/三/六 强化石，周二/四 黑铁矿，周五/日 幸运九。
 */
export const DAILY_DUNGEON_WEEK_ROTATION: readonly DailyDungeonThemeId[] = [
  'stone',
  'ore',
  'stone',
  'ore',
  'lucky',
  'stone',
  'lucky',
];

export type DailyDungeonTierId = 'tier-1' | 'tier-2' | 'tier-3';

export interface DailyDungeonTier {
  id: DailyDungeonTierId;
  /** 玩家可见的难度名。 */
  label: string;
  /** 解锁所需角色等级。 */
  unlockLevel: number;
  /** 解锁前置：需已通过的难度 id（null = 无前置）。 */
  requiresTier: DailyDungeonTierId | null;
  /** 单次挑战体力成本（挑战失败不退还，与关卡挑战同口径）。 */
  staminaCost: number;
  /** 主题材料基础产量。 */
  materialReward: number;
  /** 金币奖励。 */
  goldReward: number;
}

/**
 * 3 个难度：逐级解锁（等级 + 通过前一档）。
 * 体力成本参照既有口径：关卡挑战 6 / 扫荡 5（constants.ts）。
 */
export const DAILY_DUNGEON_TIERS: readonly DailyDungeonTier[] = [
  {
    id: 'tier-1',
    label: '普通',
    unlockLevel: 15,
    requiresTier: null,
    staminaCost: 10,
    materialReward: 1,
    goldReward: 1500,
  },
  {
    id: 'tier-2',
    label: '困难',
    unlockLevel: 20,
    requiresTier: 'tier-1',
    staminaCost: 15,
    materialReward: 1,
    goldReward: 4000,
  },
  {
    id: 'tier-3',
    label: '噩梦',
    unlockLevel: 30,
    requiresTier: 'tier-2',
    staminaCost: 20,
    materialReward: 2,
    goldReward: 10000,
  },
];

/** 各主题的材料基础产量（档位表里的 materialReward 以此为倍率基准）。 */
export const DAILY_DUNGEON_THEME_BASE: Readonly<Record<DailyDungeonThemeId, number>> = {
  stone: 4,
  ore: 16,
  lucky: 1,
};
