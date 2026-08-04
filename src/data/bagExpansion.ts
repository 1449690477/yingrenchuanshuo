/**
 * M6-7 · 背包扩容数值表（docs/14：容量上限 + 扩容）。
 *
 * 内容与代码分离（铁律 2）：本文件只描述扩容的经济参数，
 * 档位推导与判定逻辑在 core/bagExpansion.ts。
 *
 * 设计口径：
 * - 初始容量 = 既有 BAG_CAPACITY（300），每次扩容 +50，封顶 800；
 * - 价格金币递增（×1.2/档，取整到千），对齐强化/商店的长期养成消耗，
 *   不参与 docs/10 产出曲线建模（信息型福利，不做焦虑运营）。
 */

/** 初始背包容量（与 constants.ts 的 BAG_CAPACITY 保持一致，单一事实源在 core）。 */
export const BAG_BASE_CAPACITY = 300;

/** 每次扩容增加的容量。 */
export const BAG_CAPACITY_STEP = 50;

/** 扩容封顶容量（防无限膨胀；M6-7 明确定义上限）。 */
export const BAG_MAX_CAPACITY = 800;

/** 首次扩容价格（金币）。 */
export const BAG_EXPANSION_BASE_COST = 100_000;

/** 每档价格增长率（1.2 = 每档 +20%）。 */
export const BAG_EXPANSION_COST_GROWTH = 1.2;
