/**
 * M4-2 · 签到奖励表（铁律 2：内容与代码分离，数值全部在这里填）。
 *
 * 设计口径（docs/40 / docs/41 红线）：
 * - 信息型福利，不做焦虑运营：断签不重置、不清零、不惩罚；
 *   玩家哪天想起来哪天签，7 天奖励按签到次序循环推进。
 * - 签到是挂机产出的补充福利，不是主要经济来源；数值刻意保守，
 *   不参与 docs/10 的产出曲线建模（模拟器不计入签到）。
 */

import { ENHANCE_MATERIAL_IDS } from './constants';

/** 一次签到可发放的奖励形状（与背包 / 体力既有结算口径一致）。 */
export interface SignInReward {
  /** 金币。 */
  gold?: number;
  /** 体力（入账时按体力上限截断，与每日补给同口径）。 */
  stamina?: number;
  /** 材料 / 消耗品：itemId → 数量（沿用 bag.items 的既有 id）。 */
  items?: Readonly<Record<string, number>>;
}

/** 七日循环奖励：签满 7 天后回到第 1 天继续循环，不设断签惩罚。 */
export const SIGN_IN_CYCLE_REWARDS: readonly SignInReward[] = [
  { gold: 2000 },
  { stamina: 20 },
  { items: { [ENHANCE_MATERIAL_IDS.stone]: 2 } },
  { gold: 3000 },
  { stamina: 30 },
  { items: { [ENHANCE_MATERIAL_IDS.ore]: 20 } },
  { gold: 8000, items: { [ENHANCE_MATERIAL_IDS.lucky]: 1 } },
];

/** 月度累计里程碑：自然月内累计签到达标当天随签到一并发放（只发一次）。 */
export const SIGN_IN_MONTH_MILESTONES: readonly { days: number; reward: SignInReward }[] = [
  { days: 7, reward: { gold: 10000 } },
  { days: 14, reward: { items: { [ENHANCE_MATERIAL_IDS.stone]: 8 } } },
  { days: 21, reward: { stamina: 60 } },
  { days: 28, reward: { gold: 30000, items: { [ENHANCE_MATERIAL_IDS.lucky]: 1 } } },
];
