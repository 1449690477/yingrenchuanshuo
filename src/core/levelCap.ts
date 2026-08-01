/**
 * 等级的**结构上限** —— 从内容数据推出来，不是拍的数。
 *
 * ── 为什么需要它 ──
 * 服务端多处在用 `level` 当判据标尺（战力上界、试炼伤害上界都是等级的函数），
 * 而 `level` 是**客户端自报的**：`sync-profile` 收下它、只做范围校验，
 * 没有任何独立验证。所以那个范围就是整条防线的宽度。
 *
 * 2026-08-01 实查：范围写的是 `min(1).max(120)`，而玩家实际能到的最高等级是 **81**
 * （210 关最高 Lv78 + `LEVEL_SOFT_CAP_MARGIN`）。**中间 39 级空档** ——
 * 谁都可以报 Lv120，把自己的战力/伤害上界抬到内容顶之上，
 * 而这一切在收权限迁移之后**依然成立**：那份迁移堵的是直接 PATCH，
 * 堵不住「走正规接口报一个不可能的等级」。
 * 线上已经有两行 `level = 100` 的档案，就是这个空档的实物。
 *
 * ── 为什么不写死 81 ──
 * 区域 8 一上线内容顶就变，写死的数会把**合法玩家**挡在门外 ——
 * 那比放过一个作弊者坏得多（docs/65：宁可放过肝帝，绝不误伤真人）。
 * 所以这里从 `STAGE_LIST` 现算：内容一加，上限自动跟上。
 *
 * ── 这条不引入新的部署耦合 ──
 * 有人会担心「内容扩了但 Edge Function 没重新打包，合法玩家会被拒」。
 * 不成立：Edge Function 的 `_core.ts` **本来就把关卡数据打包进去了**
 * （试炼 Boss、装备、战力全靠它），内容变了不重新打包，
 * 早在这条上限之前就已经算错了 —— `edge:build` 的确定性自检守的正是这一点。
 * 换句话说：这条上限跟着 core 走，而 core 必须跟着内容走，本来就是同一条纪律。
 */

import { STAGE_LIST } from '../data/stages';
import { levelSoftCap } from './progression';

/**
 * 玩家**物理上可能达到**的最高等级。
 *
 * = 全内容最高关卡等级 + 软上限余量。等级追内容、不许反超（docs/56 §2），
 * 所以超过它的等级不是「很强」，是**不可能**。
 */
export const STRUCTURAL_MAX_LEVEL: number = levelSoftCap(
  STAGE_LIST.reduce((max, stage) => (stage.level > max ? stage.level : max), 1),
);

/**
 * 这个等级是否可能属于一个真实玩家。
 *
 * 与战力上界同一条职责边界：**它拒绝的是物理上不可能，不是「练得比别人快」。**
 * 等级是判据标尺的自变量，标尺本身不可信时，后面所有基于它的判定都无从谈起。
 */
export function isStructurallyPossibleLevel(level: number): boolean {
  return Number.isInteger(level) && level >= 1 && level <= STRUCTURAL_MAX_LEVEL;
}
