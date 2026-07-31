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
import { baseEquipStats, REGIONAL_BLANK_ID, selectStrongestDefinition } from '@/core/equipment';
import { EQUIPMENT } from './equipment';
import {
  ITEM_BASE,
  ITEM_POW,
  ITEM_SCALE,
  QUALITY_MUL,
  QUALITY_PCT_SCALE,
  SLOT_ORDER,
  SLOT_PCT_WEIGHTS,
  SLOT_WEIGHTS,
} from './constants';

// docs/73 A3 批 2-1（修正②）：typicalQualityAt 迁往 qualitySchedule（持有口径），
// 此处 re-export 保持既有调用方（simulate/trial/guildExpedition/arenaEquipment/
// depth-crosscheck 等）的 import 路径不变。
export { typicalQualityAt } from './qualitySchedule';

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
 * 穿齐 8 件真实主线装备定义的属性总和（不含强化与词条）。
 *
 * ★ docs/73 A3 批 2-1（修正②）：放弃「L^1.35 × QUALITY_MUL」解析式，
 * 改为从真实装备定义表**选装计算**（selectStrongestDefinition 公共纯函数）。
 * 主线推荐战力与副本胚子选择走同一条链，量化误差自动吸收（docs/71 §六.3）。
 */
export function expectedGearStatsFromDefinitions(level: number): Stats {
  // 锚点下界 = 最低的区域主线装备等级（当前 r1 common Lv2）：
  // Lv1 的任何典型基准值都低于现存全部装备，选装会找不到候选
  // （与 equipmentDungeonDepth.dungeonMinAnchorLevel 同族，防全域无定义）。
  let floor = Number.POSITIVE_INFINITY;
  for (const def of Object.values(EQUIPMENT)) {
    if (!REGIONAL_BLANK_ID.test(def.id)) continue;
    if (def.level < floor) floor = def.level;
  }
  const anchor = Math.max(level, floor);
  const out = zeroStats();
  for (const slot of SLOT_ORDER) {
    const def = EQUIPMENT[selectStrongestDefinition(slot, anchor)];
    if (!def) throw new Error(`[配置错误] 选装定义缺失：${slot}@Lv${anchor}`);
    const s = baseEquipStats(def);
    for (const key of Object.keys(s) as (keyof Stats)[]) out[key] += s[key];
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
  return combatPower(addStats(baseStatsFor(classId, level), expectedGearStatsFromDefinitions(level)), level);
}

/**
 * 典型强化倍率（docs/56 §3.1）。
 *
 * 强化只放大装备的数值型基础属性（见 core/equipment.ts instanceStats），
 * 全 +15 时为 ×2.2~2.35。取 1.6 对应「八件平均 +9 上下」的普通玩家 ——
 * 全量 +15 是肝帝行为，不能当典型。该值由 sim 的 G3 门禁反向约束：
 * 若逐日「实际战力 ÷ 推荐」越出 [0.9, 1.6]，先调这里，再考虑动曲线。
 */
export const TYPICAL_ENHANCE_MUL = 1.6;

/**
 * 典型词条对总战力的放大（docs/56 §3.1）。
 *
 * 洗练验收实测：全 T5 词条相对新掉落词条提升总战力 12%~25%（见
 * `npm run sim` 词条门禁）。普通玩家介于两者之间，取 1.15。
 */
export const TYPICAL_AFFIX_CP_MUL = 1.15;

/**
 * 该等级玩家「典型完整养成」的战力：满配 × 典型强化 × 典型词条。
 *
 * 与 expectedFullGearCp 的区别：那是「刚穿齐装备、一点没养」的下限口径，
 * 用于装备副本门槛（留 10% 给养成，docs/47）；这里是「养成到普通水平」
 * 的中位口径，用于主线推荐与章节/区域门槛（docs/56 §3）。
 *
 * 强化只乘装备的数值型部分，百分比属性与裸属性不乘 ——
 * 结构必须与 instanceStats 的真实结算一致，否则口径又会裂开。
 */
export function expectedBuildCp(level: number, classId: ClassId = 'swordsman'): number {
  const gear = expectedGearStatsFromDefinitions(level);
  const enhanced: Stats = {
    atk: gear.atk * TYPICAL_ENHANCE_MUL,
    def: gear.def * TYPICAL_ENHANCE_MUL,
    hp: gear.hp * TYPICAL_ENHANCE_MUL,
    acc: gear.acc * TYPICAL_ENHANCE_MUL,
    eva: gear.eva * TYPICAL_ENHANCE_MUL,
    critRate: gear.critRate,
    critDmg: gear.critDmg,
    spd: gear.spd,
  };
  const cp = combatPower(addStats(baseStatsFor(classId, level), enhanced), level);
  return cp * TYPICAL_AFFIX_CP_MUL;
}
