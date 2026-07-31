/**
 * 公会委托内容表。
 *
 * 首期只接入服务端能够复算的公会远征评分：不消耗客户端材料，也不产出战力资产。
 * 三张卡是同一场远征的阶梯目标；每名成员每天每档至多计入一次建设。
 */
export interface GuildCommissionDef {
  id: 'expedition-entry' | 'expedition-vanguard' | 'expedition-ace';
  name: string;
  description: string;
  minimumPoints: number;
  contribution: number;
}

/** 全会当天的建设目标；达成只增加展示用公会声望。 */
export const GUILD_COMMISSION_BUILD_TARGET = 1_800;
/** 当天建设完成后由服务端一次性写入公会的展示声望。 */
export const GUILD_COMMISSION_REPUTATION = 20;

export const GUILD_COMMISSION_DEFS: readonly GuildCommissionDef[] = [
  {
    id: 'expedition-entry',
    name: '远征集结',
    description: '完成一次公会远征',
    minimumPoints: 1,
    contribution: 80,
  },
  {
    id: 'expedition-vanguard',
    name: '先锋试炼',
    description: '本次远征达到 400 评分',
    minimumPoints: 400,
    contribution: 160,
  },
  {
    id: 'expedition-ace',
    name: '破阵之锋',
    description: '本次远征达到 800 评分',
    minimumPoints: 800,
    contribution: 280,
  },
] as const;
