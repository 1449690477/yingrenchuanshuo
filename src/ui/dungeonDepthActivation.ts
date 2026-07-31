/**
 * 副本深度 UI 激活开关（docs/66 §八 第 6 步）。
 *
 * **2026-07-31 已翻 true 并上线。** 翻开的前提是四件同时完成：
 *   ① K 曲线标定定稿（claude 8b1f336，形状为「三层走过去、一层要试、一层要挣」）
 *   ② UI 删 stub 直连 store 契约三件套（claude-drops e4f58d3）
 *   ③ 平衡门禁 DEPTH_GATES_CALIBRATED 翻 true 且退出码 0（含两条具名豁免）
 *   ④ 全量 verify 绿
 *
 * ⚠ 若需回滚，把本常量改回 false 即可 —— 深度的存档字段（v16 的
 * `equipmentDungeon.depth`）与 store 契约都不受开关影响，回滚只影响界面，
 * **不会丢玩家已经打出来的深度进度**。
 *
 * 开发/测试需要覆盖时用 vi.mock('@/ui/dungeonDepthActivation')。
 */
export const DUNGEON_DEPTH_UI_ACTIVE = true;
