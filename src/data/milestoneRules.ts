/**
 * 登顶速度榜规则（docs/51 §4 榜 4，主推顺序第二位）。
 *
 * 它衡量「你用多少天到达 Lv N」而不是「你现在多少级」——
 * 今天入坑的新人和一年前的老玩家在同一条起跑线上。
 * docs/51 原话：这是整个方案里唯一能让新玩家「一入坑就能上榜」的机制。
 */

/**
 * 里程碑档位。**这是固定常量，永远不要改已有档位的数值。**
 *
 * 与竞技场装备（那个刻意做成跟随内容顶的公式）相反：里程碑一旦改档位，
 * 已写下的记录就失去可比性 —— 「Lv50 用了 12 天」和「Lv55 用了 12 天」
 * 不是同一件事，混在一张榜上就是骗人。所以新内容只能**追加**更高档位，
 * 不能移动旧档位。
 *
 * 取值依据（sim 逐日曲线：D1≈Lv21 / D5≈Lv34 / D10≈Lv45 / D15≈Lv53 /
 * D20≈Lv58 / D25≈Lv63 / D30≈Lv68；60 天水平线 D60≈Lv79）：
 *   - **20**：典型玩家第一天就能达成 —— 这是「一入坑就能上榜」的兑现，
 *     没有它，新玩家仍要等一周才有榜可上，机制就白设计了
 *   - **40**：约 D8，第一个需要「玩得好」才拉得开差距的档位
 *   - **60**：约 D22，旧内容（顶 Lv65 / 软上限 68）范围内的最高档
 *   - **80**：区域 7 上线后（内容顶 78 / 软上限 81）追加；典型玩家在 60 天
 *     水平线外（D60≈Lv79，按末段 ≈1 级/天外推取 ≈65 天，宁大不小）。
 *     只追加不移动，已有记录完全不受影响。
 */
export const MILESTONE_LEVELS = [20, 40, 60, 80] as const;

export type MilestoneLevel = (typeof MILESTONE_LEVELS)[number];

/** 档位展示名。用「第 N 阶」而不是「Lv N 速通」，避免暗示这是竞速游戏。 */
export const MILESTONE_LABELS: Readonly<Record<number, string>> = {
  20: '初登 Lv20',
  40: '疾行 Lv40',
  60: '登顶 Lv60',
  80: '绝顶 Lv80',
};

const HOUR_MS = 3_600_000;

/**
 * 合理性下界：用时低于此值的成绩记为 `verified = false`（移出展示，不封号，
 * 数据保留待审 —— docs/51 §6 的既有处置口径）。
 *
 * **它的职责是拒绝「Lv60 用了 1 小时」这种荒谬声明，不是去裁决 2 倍的差距。**
 * 服务端无法复算「你何时到达 Lv60」（不像试炼伤害可以逐点重跑），
 * 所以这里只能设硬下界，宁可放过快玩家也不误伤真实玩家。
 *
 * 取值 = sim 典型玩家用时 × 0.2，即允许比典型玩家快 5 倍：
 *   Lv20  典型 ≈ 1.0 天 → 下界 4 小时
 *   Lv40  典型 ≈ 7.7 天 → 下界 36 小时
 *   Lv60  典型 ≈ 22 天  → 下界 100 小时
 *   Lv80  典型 ≈ 65 天（60 天水平线外推）→ 下界 12 天（288 小时）
 *
 * 5 倍余量的依据：挂机游戏的升级速度受每秒击杀上限约束，
 * 满强化肝帝（×2.2~2.35 战力）相对典型玩家（TYPICAL_ENHANCE_MUL 1.6）
 * 大约快 2 倍，5 倍已留出充足空间。
 *
 * 有 `milestoneFloorHasMargin` 的测试守着这条：下界若被调到吃掉典型
 * 玩家的余量，测试立刻红。
 */
export const MILESTONE_MIN_ELAPSED_MS: Readonly<Record<number, number>> = {
  20: 4 * HOUR_MS,
  40: 36 * HOUR_MS,
  60: 100 * HOUR_MS,
  80: 288 * HOUR_MS,
};

/**
 * sim 实测的典型玩家用时（天），仅用于文档与测试参照，不参与运行时计算。
 *
 * 来源：`npm run sim` 逐日曲线插值。改了节奏系数后这里会失真，
 * 但它只是余量断言的参照物，失真会被测试暴露而不是静默漂移。
 */
export const MILESTONE_TYPICAL_DAYS: Readonly<Record<number, number>> = {
  20: 1.0,
  40: 7.7,
  60: 22.0,
  80: 65.0,
};

export function isMilestoneLevel(level: number): level is MilestoneLevel {
  return (MILESTONE_LEVELS as readonly number[]).includes(level);
}
