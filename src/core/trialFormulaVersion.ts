/**
 * 周常试炼公式版本戳。
 *
 * `trial_scores.damage` 只保存最终伤害，不保存完整的逐帧战斗过程。技能轮转、
 * 命中边界或持续伤害公式一旦变化，旧成绩就不能用新公式重新证明。因此每次改变
 * `runTrial` 的生产行为，都必须同步提升此版本号；旧成绩保留展示，但审计只能用
 * 产生它的那一版判据，绝不能拿当前上界反判历史结果。
 *
 * 1 = 四职业平均技能倍率模型（2026-08-01 剑士完整技能引擎上线前）
 * 2 = 五职业真实技能轮转、触发/持续伤害，以及固定 60 秒试炼的
 *     独立攻击生存标定（该版本与五职业同批上线，未产生过旧 v2 成绩）
 * 3 = 元素共鸣期望 DPS 折入（docs/83 批 3b）：玩家武器与 Boss 均带元素时，
 *     玩家直接伤害乘 1 + 期望占比（克制 6% / 中性 5%），服务端同一份实现复算。
 * 4 = 灵巫平衡专项（docs/85，2026-08-04）：灵巫默认技能栏改召唤/输出优先
 *     + 召唤数值微调（骷髅 0.40 / 神兽 0.56）——runTrial 的灵巫技能构成
 *     与伤害输出变化，试炼成绩不可与 v3 混排。
 */
export const LEGACY_TRIAL_FORMULA_VERSION = 1;
export const TRIAL_FORMULA_VERSION = 4;

/**
 * 成绩版本戳的唯一构造点。insert、replace 与同分 reverify 都必须展开它，避免某条
 * 写路径只改成绩却留下旧版本号，制造“合法版本戳 + 错公式数字”的不可审计数据。
 */
export function buildTrialFormulaStamp(): Readonly<{ trial_formula_version: number }> {
  return { trial_formula_version: TRIAL_FORMULA_VERSION };
}
