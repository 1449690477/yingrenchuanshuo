/**
 * 装备副本「深度阶梯」UI 激活开关（docs/66 §八 第 6 步）。
 *
 * 当前为 false：深度 UI 已就位，但对玩家**零可见变化**。
 * 接线批次（docs/66 §八 第 5 步，claude-drops）把存档切成深度进度、
 * game store 接上 evaluateDungeonDepth / runEquipmentDungeonDepth 之后，
 * 由接线方把本常量翻为 true 并同步推 Pages —— 与烙印激活批次
 * （src/ui/imprintActivation.ts）同一条先例。
 *
 * 翻 true 时必须连带删除 stub（src/ui/dungeonDepthAdapter.ts），
 * 契约测试锁死 false 断言，防止「开关开着、stub 还在」的半成品状态。
 *
 * 开发/测试期需要预览激活态时，用 vi.mock('@/ui/dungeonDepthActivation') 覆盖。
 */
export const DUNGEON_DEPTH_UI_ACTIVE = false;
