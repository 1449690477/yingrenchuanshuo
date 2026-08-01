/**
 * 区域 5「熔岩神殿」的可见成长轨。
 *
 * M5-9 复验确认数值本身健康，但 Lv40～52 的成长主要藏在挂机技能倍率、
 * 强化与绯焰碎片累积里。这里把已经真实结算的三条进度汇成一个展示模型，
 * 不复制掉率、不额外发奖励，也不把表现层进度冒充新的养成系统。
 */

import { AVG_SKILL_MULTIPLIERS } from './constants';
import {
  REGION_5,
  REGION_5_EQUIPMENT_THEME,
  REGION_5_FRAGMENT_COST,
  REGION_5_SET_SLOTS,
  region5SetEquipmentId,
} from './region5';
import { QUALITY_LEVEL_OFFSET } from './qualitySchedule';

function skillMultiplierAt(level: number): number {
  const entry = AVG_SKILL_MULTIPLIERS.find((candidate) => level >= candidate.minLevel);
  if (!entry) throw new Error(`[R5成长轨] Lv${level} 缺少挂机技能倍率`);
  return entry.multiplier;
}

const rhythmStep = AVG_SKILL_MULTIPLIERS.find(
  (entry) => entry.minLevel > REGION_5.levelFrom && entry.minLevel <= REGION_5.levelTo,
);
if (!rhythmStep) throw new Error('[R5成长轨] 区域内缺少挂机技能倍率跃迁点');

const legendaryLevel = REGION_5_EQUIPMENT_THEME.level + QUALITY_LEVEL_OFFSET.legendary;
if (legendaryLevel < REGION_5.levelFrom || legendaryLevel > REGION_5.levelTo) {
  throw new Error('[R5成长轨] 普通传说品质首次可得等级没有落在区域 5 内');
}

export const REGION_5_RHYTHM_LEVEL = rhythmStep.minLevel;
export const REGION_5_LEGENDARY_LEVEL = legendaryLevel;
export const REGION_5_SET_TARGET = REGION_5_FRAGMENT_COST * REGION_5_SET_SLOTS.length;

export interface Region5GrowthInput {
  playerLevel: number;
  currentFragments: number;
  /** 永久装备图鉴定义 ID；分解装备后收集进度也不倒退。 */
  discoveredDefIds: readonly string[];
}

export interface Region5GrowthSnapshot {
  playerLevel: number;
  rhythm: {
    level: number;
    before: number;
    after: number;
    unlocked: boolean;
  };
  legendary: {
    level: number;
    unlocked: boolean;
  };
  set: {
    collectedPieces: number;
    totalPieces: number;
    currentFragments: number;
    fragmentCostPerPiece: number;
    effectiveProgress: number;
    target: number;
    ratio: number;
    complete: boolean;
  };
  nextHint: string;
}

function requireNonNegativeInteger(value: number, label: string): void {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new Error(`[R5成长轨] ${label} 必须是非负整数：${value}`);
  }
}

/**
 * 从真实存档字段投影展示进度。
 *
 * `effectiveProgress` = 已发现的唯一套装部位 × 单件成本 + 当前碎片，最多封顶 240。
 * 它只用于显示“离六件收齐还有多远”，不写回存档、不参与合成结算。
 */
export function region5GrowthSnapshot(input: Region5GrowthInput): Region5GrowthSnapshot {
  requireNonNegativeInteger(input.playerLevel, '玩家等级');
  requireNonNegativeInteger(input.currentFragments, '绯焰碎片');

  const discovered = new Set(input.discoveredDefIds);
  const collectedPieces = REGION_5_SET_SLOTS.filter((slot) =>
    discovered.has(region5SetEquipmentId(slot)),
  ).length;
  const effectiveProgress = Math.min(
    REGION_5_SET_TARGET,
    collectedPieces * REGION_5_FRAGMENT_COST + input.currentFragments,
  );
  const complete = collectedPieces === REGION_5_SET_SLOTS.length;
  const rhythmUnlocked = input.playerLevel >= REGION_5_RHYTHM_LEVEL;
  const legendaryUnlocked = input.playerLevel >= REGION_5_LEGENDARY_LEVEL;

  let nextHint: string;
  if (!rhythmUnlocked) {
    nextHint = `再升 ${REGION_5_RHYTHM_LEVEL - input.playerLevel} 级，挂机技能节奏提升`;
  } else if (!legendaryUnlocked) {
    nextHint = `Lv.${REGION_5_LEGENDARY_LEVEL} 开启普通传说装备掉落`;
  } else if (!complete) {
    nextHint = `再收集 ${REGION_5_SET_SLOTS.length - collectedPieces} 个不同部位，完成绯焰六件套`;
  } else {
    nextHint = '区域成长目标完成，绯焰共鸣已全部收集';
  }

  return {
    playerLevel: input.playerLevel,
    rhythm: {
      level: REGION_5_RHYTHM_LEVEL,
      before: skillMultiplierAt(REGION_5_RHYTHM_LEVEL - 1),
      after: skillMultiplierAt(REGION_5_RHYTHM_LEVEL),
      unlocked: rhythmUnlocked,
    },
    legendary: {
      level: REGION_5_LEGENDARY_LEVEL,
      unlocked: legendaryUnlocked,
    },
    set: {
      collectedPieces,
      totalPieces: REGION_5_SET_SLOTS.length,
      currentFragments: input.currentFragments,
      fragmentCostPerPiece: REGION_5_FRAGMENT_COST,
      effectiveProgress,
      target: REGION_5_SET_TARGET,
      ratio: effectiveProgress / REGION_5_SET_TARGET,
      complete,
    },
    nextHint,
  };
}
