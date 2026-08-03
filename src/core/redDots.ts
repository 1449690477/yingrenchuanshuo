/**
 * 红点系统核心（M3-11）。
 *
 * 红点的本质：对“有可处理事项”的提示状态。
 * 本模块是纯函数：输入各系统的“可做数量”，输出 6 个
 * 底部标签的红点开关（铁律 1：不读存档、不触 UI）。
 *
 * 规则第一版取最小可用集（避免过度设计）：
 * - idle（挂机）：奇遇待处理数 > 0
 * - bag（背包）：待确认洗炼数 > 0
 * - growth（养成）：第一版固定 false，等 M3-5 升级 UI 接入技能可升级
 * - dungeon（副本）：今日剩余次数 > 0
 * - rank（排行）：未上报里程碑数 > 0
 * - more（更多）：好感今日可互动次数 > 0
 */
export type RedDotKey = 'idle' | 'bag' | 'growth' | 'dungeon' | 'rank' | 'more';

export interface RedDotInput {
  /** 挂机：奇遇待处理数。 */
  pendingEncounters: number;
  /** 背包：带待确认洗炼的装备数。 */
  pendingAffixCount: number;
  /** 副本：装备副本今日剩余次数。 */
  dungeonAttemptsRemaining: number;
  /** 排行：未上报里程碑数。 */
  pendingMilestones: number;
  /** 更多：好感今日可互动次数。 */
  affectionRemaining: number;
}

export type RedDotState = Readonly<Record<RedDotKey, boolean>>;

/** 从可做数量推导红点状态：只有 0 与 >0 两种输出。 */
export function redDotState(input: RedDotInput): RedDotState {
  return {
    idle: input.pendingEncounters > 0,
    bag: input.pendingAffixCount > 0,
    growth: false,
    dungeon: input.dungeonAttemptsRemaining > 0,
    rank: input.pendingMilestones > 0,
    more: input.affectionRemaining > 0,
  };
}
