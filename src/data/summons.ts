/**
 * 召唤物战斗配置。
 *
 * 本表只描述可复现的战斗数值，不持有运行时状态；持续时间同时登记在技能效果中，
 * 数据测试会守住两处一致，避免客户端与服务端各自猜一套召唤规则。
 */

import type { ClassId, Element } from '@/core/types';

export type SummonTargeting = 'primary-enemy' | 'lowest-hp-enemy';

export interface SummonDefinition {
  id: string;
  name: string;
  ownerClass: ClassId;
  /** 每次普通攻击相对于主人的攻击力倍率。 */
  attackMultiplier: number;
  attackIntervalSec: number;
  element: Element;
  targeting: SummonTargeting;
  durationSec: number;
  /** 召唤物是否进入敌人的合法受击目标池。 */
  damageable: boolean;
  /** 进入受击目标池后的抽取权重；主人权重由 core 固定为 1。 */
  targetWeight: number;
  /** 可受击召唤物继承主人的生命上限比例。 */
  maxHpRatio: number;
  /** 可受击召唤物继承主人的防御比例。 */
  defenseRatio: number;
  /** 暴击、命中和吸血均不暗中继承；需要时必须显式改表。 */
  inheritedStats: readonly ('atk' | 'hp' | 'def')[];
  maxConcurrent: number;
}

export const SUMMON_DEFINITIONS = [
  {
    id: 'summon_shaman_skeleton',
    name: '灵铃骷髅',
    ownerClass: 'shaman',
    // 2026-08-04 灵巫平衡专项（docs/85）：召唤骷髅 0.45→0.40——
    // 默认栏回归召唤流后，词条极值下灵巫偏离 N5 带，降 11% 压回 16.94%
    // （再降非线性反弹，0.40 为实测最优；收紧条件=N5 回 15% 后恢复）。
    attackMultiplier: 0.40,
    attackIntervalSec: 2,
    element: 'none',
    targeting: 'primary-enemy',
    durationSec: 60,
    damageable: true,
    targetWeight: 0.05,
    maxHpRatio: 0.35,
    defenseRatio: 0.55,
    inheritedStats: ['atk', 'hp', 'def'],
    maxConcurrent: 1,
  },
  {
    id: 'summon_shaman_divine_beast',
    name: '雷纹神兽',
    ownerClass: 'shaman',
    // 2026-08-04 灵巫平衡专项（docs/85）：雷纹神兽 0.62→0.56（同骷髅批次，
    // 降 10%，实测与骷髅同组最优）。
    attackMultiplier: 0.56,
    attackIntervalSec: 1.8,
    element: 'thunder',
    targeting: 'lowest-hp-enemy',
    durationSec: 90,
    damageable: true,
    targetWeight: 0.05,
    maxHpRatio: 0.55,
    defenseRatio: 0.75,
    inheritedStats: ['atk', 'hp', 'def'],
    maxConcurrent: 1,
  },
] as const satisfies readonly SummonDefinition[];

const SUMMON_DEFINITION_BY_ID = new Map<string, SummonDefinition>(
  SUMMON_DEFINITIONS.map((definition): [string, SummonDefinition] => [
    definition.id,
    definition,
  ]),
);

export function summonDefinition(summonId: string): SummonDefinition | undefined {
  return SUMMON_DEFINITION_BY_ID.get(summonId);
}