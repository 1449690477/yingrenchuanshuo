/**
 * 档案进度行的**唯一构造点** —— 战力与它的公式版本戳必须同批写入。
 *
 * ── 为什么要有这个模块 ──
 * `profiles.combat_power` 有**四个** Edge Function 在写：
 * `sync-profile` / `submit-trial` / `arena-snapshot` / `arena-challenge` /
 * `guild-expedition`。我 2026-08-01 加版本戳时**只给 sync-profile 加了**，
 * 因为我以为它是唯一写入点 —— 没有 grep 全部函数就下了结论。
 *
 * ── 漏戳的危害方向与直觉相反（小榜 2026-08-01 18:55 纠正）──
 * 直觉是「漏戳 ⇒ 那行被榜单筛掉 ⇒ 玩家看不见」，属于显性、安全的一侧。
 * **真正危险的是另一侧**：`update` 只改 `combat_power`、不碰 `cp_formula_version`，
 * 于是**戳保持原值不动**。一旦「写这个数的那份 core」与「戳所声称的那一版」
 * 对不上（例如下一次改公式时只重部署了一部分函数），这一行就是
 * **合法的戳 + 错尺的数** —— 它**筛得过、正常显示、而且没有任何人看得出它是错的**。
 *
 * **版本戳存在的全部意义就是防混排；漏戳的这条路径恰好能在戳合法的情况下
 * 把混排放进来。**
 *
 * ── 为什么是一个构造函数，而不是「四处各补一行」──
 * 补四行是靠人记住，**下一个新写入点还会漏**（这次就是这么漏的）。
 * 收成一个函数之后，戳与数**同源同批**、在类型上不可分割：
 * 想写战力就必须调它，调了就自动带上当前版本。**结构上不可能再错开。**
 */

import { CP_FORMULA_VERSION } from './cpFormulaVersion';
import type { ClassId } from './types';

/** 落进 `profiles` 的进度字段。字段名与列名一致，调用方直接展开即可。 */
export interface ProfileProgressRow {
  class_id: ClassId;
  level: number;
  combat_power: number;
  /** 算出上面那个 combat_power 的公式版本 —— 与它同批写入，不可分开。 */
  cp_formula_version: number;
  updated_at: string;
}

/**
 * 构造一行档案进度。
 *
 * @param combatPower **服务端复算**出来的战力（绝不接受客户端上报的数）
 * @param now 便于测试注入；缺省取当前时刻
 */
export function buildProfileProgress(input: {
  classId: ClassId;
  level: number;
  combatPower: number;
  now?: Date;
}): ProfileProgressRow {
  return {
    class_id: input.classId,
    level: input.level,
    combat_power: Math.round(input.combatPower),
    cp_formula_version: CP_FORMULA_VERSION,
    updated_at: (input.now ?? new Date()).toISOString(),
  };
}
