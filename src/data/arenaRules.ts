/**
 * 竞技场（玩家互相挑战）的内容配置。
 *
 * 机制与数值口径见 docs/54-竞技场对战设计.md：
 *   - 非对称押注：挑战者押荣誉印记，防守方无感知、无消耗、资产分毫不损
 *   - 顶替排名：挑战者赢则与对手交换排名；段位赛季内只升不降
 *   - 防守成功也有奖励，「被人挑战」是战绩不是受害通知
 *   - 每日 04:00（北京时间，沿用既有日切）结算与挑战次数重置
 *
 * 本文件只有数据没有逻辑（AGENTS.md 铁律 2）；对决与结算逻辑在 src/core/duel.ts。
 */

/** 每日挑战次数。5 次足够形成「试探→调整→冲刺」，也是一个自然的会话结束点。 */
export const ARENA_DAILY_CHALLENGES = 5;

/** 日切时刻：北京时间 04:00，与装备副本 / 好感 / 试炼的周切小时保持一致。 */
export const ARENA_RESET_HOUR_CST = 4;

/**
 * 对决回合上限。
 * 没有它两个高防低攻的搭配会打不完；到达上限按剩余生命百分比判胜，
 * 百分比也相同判防守方胜 —— 挑战者需要明确击败对手（docs/52 §5.2）。
 * 实现口径：慢的一侧打满本数次行动所需的时间窗，见 src/core/duel.ts。
 */
export const ARENA_MAX_ROUNDS = 30;

/** 押注档位（荣誉印记）。 */
export const ARENA_STAKES = [10, 25, 50] as const;

/** 候选对手数量与排名范围：只给排名在自己上方 1~15 名内的 3 个候选（docs/52 §3.2）。 */
export const ARENA_OPPONENT_CANDIDATES = 3;
export const ARENA_OPPONENT_MIN_ABOVE = 1;
export const ARENA_OPPONENT_MAX_ABOVE = 15;

/**
 * 排名差倍率：对手排名比自己高多少，赢了就放大多少（打赢强者的爽感来源）。
 * 取第一个命中的区间。
 */
export interface ArenaRankDiffBand {
  minDiff: number;
  maxDiff: number;
  multiplier: number;
}

export const ARENA_RANK_DIFF_BANDS: readonly ArenaRankDiffBand[] = [
  { minDiff: 1, maxDiff: 3, multiplier: 1.2 },
  { minDiff: 4, maxDiff: 8, multiplier: 1.6 },
  { minDiff: 9, maxDiff: 15, multiplier: 2.2 },
] as const;

/**
 * 连胜倍率：连胜在失败时归零，跨日保留
 * （跨日清零会制造「必须一次打完」的压力，docs/52 §4.2）。
 * 取满足条件的最高档。
 */
export interface ArenaStreakBand {
  streak: number;
  multiplier: number;
}

export const ARENA_STREAK_BANDS: readonly ArenaStreakBand[] = [
  { streak: 5, multiplier: 2.0 },
  { streak: 3, multiplier: 1.5 },
  { streak: 2, multiplier: 1.2 },
] as const;

/**
 * 防守奖励（docs/52 §2.2）：防守方每被挑战一次，无论输赢都是正数。
 * 不实时推送，统一进每日结算的「防线战报」。
 */
export const ARENA_DEFENSE_REWARD_HELD = 8;
export const ARENA_DEFENSE_REWARD_BROKEN = 3;
/** 防守奖励每日上限，防刷（docs/52 §七）。 */
export const ARENA_DEFENSE_REWARD_DAILY_CAP = 200;

/** 同一对手每日只能挑战 1 次，防定点骚扰；复仇机会不受此限（docs/52 §七）。 */
export const ARENA_SAME_OPPONENT_DAILY_LIMIT = 1;

/** 复仇机会有效期（小时）：不消耗每日次数、不需要押注、赢了同样顶替排名。 */
export const ARENA_REVENGE_WINDOW_HOURS = 24;

/**
 * 圣痕套 4 件时防守方的额外减伤（百分点，docs/53 §1.3）。
 * 「认真攒套装的人更难被推下去」—— 套装是排名的护城河，
 * 但只加防守不加进攻，不影响挑战者进攻时的强度平衡。
 */
export const ARENA_SET_DEFENDER_DR_BONUS = 5;

/**
 * 入场补给（荣誉印记）。
 *
 * 冷启动问题：押注只能从荣誉余额出，新玩家 0 荣誉连最小的 10 都押不上，
 * 不解决的话第一天只能干等每日结算 —— 那是「不玩才有收获」的倒挂。
 * 入场即补 100，够两轮标准押注；荣誉不可转让、只能向上挑战，
 * 小号无法通过对战把补给输送给大号（§七 同 IP/设备另行标记）。
 */
export const ARENA_JOIN_HONOR = 100;

/**
 * 段位（docs/52 §4.3 / §九）。
 *
 * 段位是「成就」：赛季内只升不降，永不推送、不动画化排名下降。
 * 精确排名是「当前站位」：活的，会因别人顶替而下移。
 * 奖励箱内容见 src/data/arenaShop.ts 与 docs/53 §4.2。
 */
export interface ArenaTier {
  id: string;
  name: string;
  /** 精确名次门槛（含），如樱冠 = 前 10 */
  topRank: number | null;
  /** 百分比门槛（含），如琥珀 = 前 30% */
  topPercent: number | null;
  dailyHonor: number;
  /** 每日奖励箱数量（箱 id 对应 arenaShop.ts） */
  dailyBoxes: { sacred: number; starlight: number };
}

/** 从高到低排列，判定段位时取第一个满足条件的。 */
export const ARENA_TIERS: readonly ArenaTier[] = [
  { id: 'yingguan', name: '樱冠', topRank: 10, topPercent: null, dailyHonor: 300, dailyBoxes: { sacred: 2, starlight: 0 } },
  { id: 'feiying', name: '绯樱', topRank: 100, topPercent: null, dailyHonor: 200, dailyBoxes: { sacred: 1, starlight: 0 } },
  { id: 'hupo', name: '琥珀', topRank: null, topPercent: 0.3, dailyHonor: 120, dailyBoxes: { sacred: 0, starlight: 2 } },
  { id: 'feiyue', name: '绯月', topRank: null, topPercent: 0.6, dailyHonor: 80, dailyBoxes: { sacred: 0, starlight: 1 } },
  { id: 'qingying', name: '青樱', topRank: null, topPercent: null, dailyHonor: 50, dailyBoxes: { sacred: 0, starlight: 1 } },
] as const;

/** 预估胜率的确定性蒙特卡洛模拟次数（固定种子，见 src/core/duel.ts）。 */
export const ARENA_WIN_CHANCE_SIMULATIONS = 120;
