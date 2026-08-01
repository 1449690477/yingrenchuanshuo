/**
 * sync-profile Edge Function 的共享 core 打包入口。
 *
 * 见 submit-trial/_core-entry.ts 的说明：本文件是 esbuild 入口，
 * `npm run edge:build` 把它打成自包含的 _core.ts 供 Deno import。
 *
 * **为什么档案同步也要走服务端复算**：profiles.combat_power 是战力榜的
 * 排序键，而 profiles 的 RLS 写策略是 for all —— 玩家可以直接 PATCH
 * 自己那一行。把战力改成「由服务端从搭配快照现算」之后，
 * 客户端连报都不报这个数，也就没什么可伪造的（docs/65 §六之二 方向 A）。
 *
 * 用的是与 submit-trial 完全相同的一套装备硬校验 + 同一个
 * buildTrialCombatant —— 两个函数对同一份快照必须算出同一个战力，
 * edge:build 的自检会逐点比对这一点。
 */

export {
  buildTrialCombatant,
  trialEquipmentSnapshotIssue,
  type TrialBuild,
} from '../../../src/core/trial';
export { equipmentInstanceSchema } from '../../../src/save/schema';
export { getEquipment } from '../../../src/data/equipment';
export { SLOT_ORDER } from '../../../src/data/constants';
export { CLASS_IDS } from '../../../src/core/types';
export type { ClassId, EquipmentInstance } from '../../../src/core/types';

// 展示层那道上界（方向 B）也打包进来：服务端算完之后再自查一次，
// 万一将来 core 的战力口径改动让某个真实搭配越过上界，
// 这里会当场记 verified=false 而不是让榜单默默收下一个越界值。
export { isPlausibleCombatPower, combatPowerCeiling } from '../../../src/core/combatPowerBound';

// 战力公式版本戳（批3-3）：写 combat_power 的同时记下它是哪版公式算的。
// 必须从 core 打包进来而不是在 Edge 侧写死一个字面量 —— 版本号与公式在
// 同一个打包产物里，物理上不可能出现「函数用新公式算、却盖旧版本戳」。
export { CP_FORMULA_VERSION } from '../../../src/core/cpFormulaVersion';

// 等级的结构上限（从关卡数据推导）。level 是战力/伤害上界的自变量，而它由
// 客户端上报 —— 载荷校验的那个范围就是整条防线的宽度，必须跟着内容走。
export { STRUCTURAL_MAX_LEVEL, isStructurallyPossibleLevel } from '../../../src/core/levelCap';

// 作弊证据的分级与行构造（docs/78）。判定留在 core，Edge 只做 insert ——
// 五条上报路径共用同一套闸门与措辞，避免同一口径五处实现。
export {
  buildCheatEvidenceRow,
  judgeCheatEvidence,
  type CheatEvidenceInput,
} from '../../../src/core/cheatEvidence';
