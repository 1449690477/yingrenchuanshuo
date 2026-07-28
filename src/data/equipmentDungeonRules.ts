/** 装备副本的全局规则。数值集中在数据层，核心逻辑只读取。 */
export const EQUIPMENT_DUNGEON_RULES = {
  /** 八个门户共享每日成功领取次数；失败不扣。 */
  dailyClears: 3,
  /** 北京时间凌晨 4 点日切，避开玩家午夜正好战斗时被重置。 */
  resetHourCst: 4,
  /** 单场最多 90 秒，防止双方打不动。 */
  maxFightSeconds: 90,
  /** 击败随从后恢复 12% 最大生命，给第二波守关者留公平缓冲。 */
  betweenWaveHealRatio: 0.12,
  /** 每个关卡首次胜利额外执行一次同表掉落，帮助玩家启动新档位。 */
  firstClearBonusRolls: 1,
} as const;
