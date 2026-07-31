/**
 * 区域装备品质进度表（docs/73 A3 的数据源）。
 *
 * 装备的「等级 × 品质」节奏在这里唯一声明：equipment.ts 的主题表与
 * expectedPower 的 typicalQualityAt 都从本表派生，改装备节奏只改这里。
 * 珍品商店（boutique）是有意超前的已知残差（docs/73 A4）、心虹好感线
 * （prismatic）是独立系统，两者都不进入主线典型口径。
 *
 * ⚠ 本模块只允许依赖轻量数据（区域清单 / 副本档位），禁止 import
 * equipment.ts / expectedPower.ts / arenaEquipment.ts，否则会制造循环。
 */

import type { Quality } from '@/core/types';
import { EQUIPMENT_DUNGEON_TIERS } from './equipmentDungeonGear';
import { REGION_5_EQUIPMENT_THEME } from './region5';
import { REGION_5_SET_LEVEL, REGION_5_SET_QUALITY } from './region5';
import { REGION_6_EQUIPMENT_THEME } from './region6';
import { REGION_6_SET_LEVEL, REGION_6_SET_QUALITY } from './region6';
import { REGION_7_EQUIPMENT_THEME } from './region7';
import { REGION_7_SET_LEVEL, REGION_7_SET_QUALITY } from './region7';

export interface RegionQualityScheduleEntry {
  regionId: string;
  /** 该区域装备的主题基准等级（各品质按 QUALITY_LEVEL_OFFSET 偏移） */
  level: number;
  qualities: readonly Quality[];
}

export const REGION_QUALITY_SCHEDULE: readonly RegionQualityScheduleEntry[] = [
  { regionId: 'r1', level: 4, qualities: ['common', 'fine', 'rare'] },
  { regionId: 'r2', level: 16, qualities: ['fine', 'rare', 'epic'] },
  { regionId: 'r3', level: 26, qualities: ['fine', 'rare', 'epic'] },
  { regionId: 'r4', level: 36, qualities: ['fine', 'rare', 'epic'] },
  {
    regionId: REGION_5_EQUIPMENT_THEME.regionId,
    level: REGION_5_EQUIPMENT_THEME.level,
    qualities: REGION_5_EQUIPMENT_THEME.qualities,
  },
  {
    regionId: REGION_6_EQUIPMENT_THEME.regionId,
    level: REGION_6_EQUIPMENT_THEME.level,
    qualities: REGION_6_EQUIPMENT_THEME.qualities,
  },
  {
    regionId: REGION_7_EQUIPMENT_THEME.regionId,
    level: REGION_7_EQUIPMENT_THEME.level,
    qualities: REGION_7_EQUIPMENT_THEME.qualities,
  },
];

/** 不同品质的等级偏移：高品质装备需求等级略高 */
export const QUALITY_LEVEL_OFFSET: Readonly<Record<Quality, number>> = {
  common: -2,
  fine: 0,
  rare: 2,
  epic: 4,
  legendary: 6,
  mythic: 8,
  prismatic: 9,
  divine: 10,
};

export function regionQualityLevel(regionId: string): number {
  const entry = REGION_QUALITY_SCHEDULE.find((r) => r.regionId === regionId);
  if (!entry) throw new Error(`[配置错误] 区域 ${regionId} 未登记品质进度表`);
  return entry.level;
}

export function regionQualities(regionId: string): readonly Quality[] {
  const entry = REGION_QUALITY_SCHEDULE.find((r) => r.regionId === regionId);
  if (!entry) throw new Error(`[配置错误] 区域 ${regionId} 未登记品质进度表`);
  return entry.qualities;
}

/**
 * 各品质「实际首次可得等级」：主线区域主题 + 区域套装 + 副本档位推导，
 * 禁止手填（docs/73 A3）。
 */
export const QUALITY_FIRST_AVAILABLE_LEVEL: Readonly<Partial<Record<Quality, number>>> = (() => {
  const first = new Map<Quality, number>();
  const note = (q: Quality, level: number) => {
    const cur = first.get(q);
    if (cur === undefined || level < cur) first.set(q, level);
  };
  for (const entry of REGION_QUALITY_SCHEDULE) {
    for (const q of entry.qualities) note(q, Math.max(1, entry.level + QUALITY_LEVEL_OFFSET[q]));
  }
  note(REGION_5_SET_QUALITY, REGION_5_SET_LEVEL);
  note(REGION_6_SET_QUALITY, REGION_6_SET_LEVEL);
  note(REGION_7_SET_QUALITY, REGION_7_SET_LEVEL);
  for (const tier of EQUIPMENT_DUNGEON_TIERS) note(tier.quality, tier.level);
  return Object.fromEntries(first) as Partial<Record<Quality, number>>;
})();
