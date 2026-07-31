/**
 * 装备副本「深度」的数值配置（docs/66）。
 *
 * 深度是替代等级门槛的**挑战轴**：进不进得去由「打不打得过」决定，
 * 不由等级决定。深度决定三件事 —— 难度、胚子锚点等级、胚子掉率。
 *
 * 本文件只有数据没有逻辑（AGENTS.md 铁律 2）；计算在
 * `src/core/equipmentDungeonDepth.ts`。
 *
 * ⚠ 改这里的任何数字都必须复跑 `npm run balance:equipment-dungeon`
 * 与 docs/66 §六 的 12 项门禁 —— 尤其 G-12 的三条上界。
 */

import type { Quality } from '@/core/types';
import type { EquipmentDungeonTierId } from './equipmentDungeonGear';

/** 每档的深度层数。四档统一，保证 UI 是一张规整的 4×5 网格。 */
export const DEPTH_PER_TIER = 5;

/**
 * 深度锚点：标称等级 = baseLevel + step × (depth − 1)。
 *
 * `step` 按「填满到下一档」推导，不是手填的口味值：
 *   azure  (31−16)/5 = 3
 *   violet (56−31)/5 = 5
 *   auric  (81−56)/5 = 5
 *   crimson 沿用 5（下一档尚不存在，取相邻档步长）
 *
 * `openDepths` 是**当前内容下实际开放的层数**。crimson 只开 1 层：
 * 内容顶 Lv78 < crimson 标称 81，三元 min 之后
 * crimson 全五层锚点都会被压到 78 —— d2~d5 在数值上完全等价于 d1，
 * 开了就是纯重复劳动（docs/66 §七）。
 *
 * **其余四层的配置刻意保留**：区域 8 抬高内容顶那天它们自动生效，
 * 不需要改代码（照 docs/60 §2.3 竞技场装备跟随公式的做法）。
 */
export interface EquipmentDungeonDepthAnchor {
  baseLevel: number;
  step: number;
  openDepths: number;
}

export const EQUIPMENT_DUNGEON_DEPTH_ANCHORS: Readonly<
  Record<EquipmentDungeonTierId, EquipmentDungeonDepthAnchor>
> = {
  azure: { baseLevel: 16, step: 3, openDepths: DEPTH_PER_TIER },
  violet: { baseLevel: 31, step: 5, openDepths: DEPTH_PER_TIER },
  auric: { baseLevel: 56, step: 5, openDepths: DEPTH_PER_TIER },
  crimson: { baseLevel: 81, step: 5, openDepths: 1 },
};

/**
 * 难度系数：怪物按 `expectedFullGearCp(标称等级) × k(depth)` 标定。
 *
 * 玩家的典型养成是强化 1.6× × 词条 1.15× ≈ **1.84×**（docs/65 口径），
 * 所以 d1~d3 是「养成到位就能过」、d4~d5 是「要真投入」。
 *
 * ⚠ 这组是**目标输入不是实测值**，最终由 balance:equipment-dungeon 反标定。
 * 它取代了旧的 `TIER_ENCOUNTER_SCALE` —— 那是一张逐档手填表，
 * 实测跨档极差 3.54×（苍蓝 2.69 / 绛紫 0.76），而且与推荐战力
 * 各调各的、中间没有反馈回路（docs/66 §3.2）。
 */
/**
 * **深度难度目标倍率**：第 d 层的总难度应当是第 1 层的几倍。
 *
 * 这是「体验目标」，不是「怪物系数」—— docs/71 §六.1：
 * 「从体验目标反推怪属性，绝不公式直接算怪、脱离人物」。
 *
 * 上限从哪来：战斗硬上限 90 秒，而 d1 实测 14~20 秒。
 * 超出这个数，最深层就会从「打不过」变成「打不完」——
 * 而超时失败是白打一分钟且毫无反馈，比被打死伤得多（docs/71 §六.4）。
 *
 * **定稿实测均时**（2026-07-31，四职业平均）：
 *   苍蓝 14 / 23 / 33 / 43 / 50s   绛紫 18 / 29 / 42 / 53 / 65s
 *   赤金 20 / 31 / 43 / 56 / 65s   绯樱 20s（当前只开 d1）
 * 全部在 90 秒预算内，最深层留出 25 秒余量给职业与运气的方差。
 */
export const DEPTH_TARGET_MULTIPLIER: readonly number[] = [1.0, 1.5, 2.0, 2.5, 3.0];

/**
 * **深度致死目标倍率**：第 d 层的攻击压力应当是第 1 层的几倍。
 *
 * 两轴分工（docs/66 §3.2）：**血量管节奏、攻击管生死**。
 * 上面那条曲线定「打多久」，这条定「会不会死」——
 * 两者必须分开标定，否则调一个必然带崩另一个。
 *
 * 为什么攻击轴也要反推：入场玩家的装备锚在 d1 的标称等级**不随深度变**
 * （见 core/equipmentDungeonDepth.ts 的三元取小），而怪物等级一路涨到 d5。
 * 于是「怪物攻击 ÷ 玩家战力」这个真正决定生死的量，
 * 各档跨 5 层的自然涨幅完全不同：苍蓝 2.13× 而赤金只有 1.51×。
 *
 * 这正是「苍蓝 d2 就 34% 胜率、赤金 d3 还 100%」的根因 ——
 * 注意此时**两档的战力比几乎相同**（1.22 vs 1.16）。
 * 战力比不是胜负的有效预测量，任何按战力比设的门禁都会看不见这件事。
 *
 * ── 定稿形状（2026-07-31 实测，入场模型 = 该档最弱可能玩家）──
 *   苍蓝 100 / 100 / 100 / 49 / 0%
 *   绛紫 100 / 100 /  98 / 34 / 1%
 *   赤金 100 / 100 / 100 / 86 / 17%
 *
 * 设计意图是**三层可以走过去、一层要试、一层要挣**：
 * 前三层保证入场即可通关（首破必掉胚子，玩法循环先跑起来），
 * d4 是真正的对抗层，d5 要求实打实的养成投入。
 * **d1 是 100% 而不是门禁写的 ≤95%，这是刻意的** ——
 * 每一档的第一层是「你一定过得去」的锚点，用来教会玩法与保证首破掉落；
 * 把它做成会输的层，只会让玩家在还没理解深度是什么之前先被劝退。
 * 门禁那条 d1 ≤95% 需要按此改口径（已知会报违反，@claude-drops ③ 时一并改）。
 *
 * ⚠ **已知残留：赤金仍系统性偏易一层**（d4 86% vs 苍蓝 49% / 绛紫 34%）。
 * 苍蓝与绛紫已经对齐，赤金没有。我没有继续调数把它压下去，
 * 因为那会变成给单档手填补偿 —— 正是这次重构要消灭的东西。
 * 它更可能是主线威胁轴漂移在 Lv56~76 段的残差（docs/65 §六之三），
 * 应当在主线修漂移时一起消失。**若那天它没有消失，才说明副本自身另有形状问题。**
 */
export const DEPTH_ATK_TARGET: readonly number[] = [1.0, 1.06, 1.13, 1.21, 1.3];


/**
 * 深度 1 的怪物基准倍率 —— **四档共用一套**，这是取代手填表的关键。
 *
 * 起点来自旧 `TIER_ENCOUNTER_SCALE` 的辉金档 `{hp: 1.5, atk: 0.85}`
 * （四档里只有它的实测战力比与推荐战力基本吻合），
 * 2026-07-31 按结果侧指标重新标定为 `{hp: 1.25, atk: 0.55}`。
 *
 * **攻击基准从 0.85 降到 0.55 不是「调软了」**：
 * 同批加入了 `depthTierThreatCompensation`，它按档把攻击整体抬起来
 * （绛紫 ×1.5、赤金 ×2.4 量级）以抵消主线威胁轴漂移。
 * 两者是一起标的，**只改其中一个必然失衡**。
 *
 * ⚠ 这两个数与两条目标曲线一起由 `npm run balance:equipment-dungeon`
 * 反标定，**不要手感微调** —— 手感微调正是造出 3.54× 跨档极差的那条路。
 */
export const DEPTH_ENCOUNTER_BASE = { hp: 1.25, atk: 0.55 } as const;

/**
 * 胚子掉率：该深度**已经突破过之后**的常规掉率。
 *
 * 首次突破某深度必掉 1 件（保底），由 core 单独处理 ——
 * peak-end 法则，让「往更深走」这个决策立刻有可见回报（docs/66 §4.2）。
 *
 * ⚠ 深度**绝不**提升烙印晶产量（docs/58 §3.2 原样保留）。
 * 深度若加晶产，docs/58 §七「2/4/6 件到手日 ≈ D2/D4~5/D8~10」直接红，
 * 套装会从「一到两周的流派养成线」退回「解锁日毕业」。
 */
export const DEPTH_BLANK_CHANCE: readonly number[] = [0.12, 0.18, 0.26, 0.36, 0.5];

/** 深度只升不降（docs/40 红线：进度条不许倒退）。重置的只有每日次数。 */
export const DEPTH_NEVER_DECREASES = true;

/**
 * 各区域**实际存在**的装备品质区间（docs/66 §3.5）。
 *
 * 胚子取自玩家当前区域的主线装备定义，所以品质必须夹进该区实有的集合 ——
 * 不能直接用 `typicalQualityAt(锚点)`，因为**公式对，但定义集合有洞**：
 *
 *   r2（Lv10-20）实有 [fine, rare, epic]，
 *   而 Lv10~14 的 typicalQualityAt 返回 common —— 五个等级取不到定义，
 *   直接空指针崩在结算上，而且崩的正是刚接触副本的新手。
 *
 * 这个洞是「按公式推导 + 没人验证覆盖面」的典型产物，
 * 因此本表**必须显式登记、缺表抛错、不许回退默认值**，
 * 并由 `equipmentDungeonDepth.spec.ts` 逐区逐级扫覆盖面：
 * 将来任何区域少一档品质都会当场红。
 *
 * ⚠ 夹取不会造成超模：区域装备本来就是玩家在该区刷主线能掉到的东西，
 * 所以无论夹到哪一档，胚子都是玩家本来就能获得的（docs/66 G-2）。
 */
export interface RegionQualityRange {
  lowest: Quality;
  highest: Quality;
}

export const REGION_BLANK_QUALITY_RANGE: Readonly<Record<string, RegionQualityRange>> = {
  r1: { lowest: 'common', highest: 'rare' },
  r2: { lowest: 'fine', highest: 'epic' },
  r3: { lowest: 'fine', highest: 'epic' },
  r4: { lowest: 'fine', highest: 'epic' },
  r5: { lowest: 'rare', highest: 'legendary' },
  r6: { lowest: 'rare', highest: 'legendary' },
  r7: { lowest: 'epic', highest: 'legendary' },
};
