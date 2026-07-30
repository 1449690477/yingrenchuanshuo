/**
 * 烙印激活开关（docs/58 §六「激活批次」）。
 *
 * 材料物品注册 + 副本掉落表切换（claude）与烙印台 UI / 材料掉落展示 /
 * 旧装绝版标（kimi）必须同批上线，任何一边先出都会让玩家看到半成品：
 *   - 开关开着但材料没注册 → 烙印台永远材料不足、材料图标 404
 *   - 掉落表切了但 UI 没切 → 掉落预览还在展示已不掉的整装
 *
 * 激活批次由 claude 统一把本常量翻为 true 并同步推 Pages。
 * 开发/测试期需要预览激活态时，用 vi.mock('@/ui/imprintActivation') 覆盖。
 */
export const IMPRINT_BATCH_ACTIVE = false;
