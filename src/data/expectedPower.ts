/**
 * 「玩家在某等级应该有多强」的唯一口径。
 *
 * ## 为什么需要它
 *
 * 判断一个副本、一张图该不该让玩家进，唯一靠谱的参照是
 * **同级玩家穿着主线能拿到的装备时的战力**。
 *
 * 这个口径此前只存在于 `scripts/simulate.ts` 里（`typicalQuality` + `gearStats`），
 * 运行时代码拿不到，于是装备副本的推荐战力改用「裸属性战力 × 一个手填系数」
 * 估算 —— 结果四档里三档的门槛高于同级玩家满配战力，最低档甚至高出 39%，
 * 玩家必须越级才能打（见 docs/47）。
 *
 * 抽到这里之后，副本门槛可以直接由公式推导；
 * 以后调装备曲线，门槛会自动跟着走，不会再次脱节。
 */

import type { ClassId, EquipSlot, Quality, Stats } from '@/core/types';
import { baseStatsFor } from '@/core/progression';
import { addStats, combatPower } from '@/core/formula';
import {
  ITEM_BASE,
  ITEM_POW,
  ITEM_SCALE,
  QUALITY_MUL,
  QUALITY_PCT_SCALE,
  SLOT_PCT_WEIGHTS,
  SLOT_WEIGHTS,
} from './constants';

/**
 * 该等级的主线典型装备品质。
 *
 * 阈值与 `scripts/simulate.ts` 的 typicalQuality 保持一致 ——
 * 两处若分叉，副本门槛与模拟器验收就会互相打架。
 */
export function typicalQualityAt(level: number): Quality {
  if (level < 15) return 'common';
  if (level < 25) return 'fine';
  if (level < 40) return 'rare';
  if (level < 65) return 'epic';
  if (level < 90) return 'legendary';
  if (level < 110) return 'mythic';
  return 'divine';
}

function zeroStats(): Stats {
  return { atk: 0, def: 0, hp: 0, acc: 0, eva: 0, critRate: 0, critDmg: 0, spd: 0 };
}

/** 全身八件该等级该品质装备提供的属性总和（不含强化与词条）。 */
export function expectedGearStats(level: number, quality: Quality): Stats {
  const baseValue = ITEM_BASE * Math.pow(level, ITEM_POW) * QUALITY_MUL[quality] * ITEM_SCALE;
  const pctScale = QUALITY_PCT_SCALE[quality];
  const out = zeroStats();

  for (const slot of Object.keys(SLOT_WEIGHTS) as EquipSlot[]) {
    // 数值型随等级与品质一起长
    for (const [key, weight] of Object.entries(SLOT_WEIGHTS[slot]) as [keyof Stats, number][]) {
      out[key] += baseValue * weight;
    }
    // 百分比型只随品质长，不随等级（ADR-006）
    for (const [key, weight] of Object.entries(SLOT_PCT_WEIGHTS[slot]) as [keyof Stats, number][]) {
      out[key] += pctScale * weight;
    }
  }
  return out;
}

/**
 * 该等级玩家「穿齐主线典型品质装备」时的战力。
 *
 * 不含强化与词条 —— 那两块是玩家自己的投入，
 * 正好留作副本门槛之下的那段余量（见 docs/47 规则二）。
 */
export function expectedFullGearCp(level: number, classId: ClassId = 'swordsman'): number {
  const quality = typicalQualityAt(level);
  return combatPower(addStats(baseStatsFor(classId, level), expectedGearStats(level, quality)));
}
