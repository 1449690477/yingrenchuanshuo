/**
 * 战力上界（docs/65 §六之二 方向 B · 纵深防御）。
 *
 * 背景：`profiles` 的写策略是 for all，已登录玩家可以直接 PATCH 自己那一行，
 * 也就是**战力榜的名次此刻是客户端自填的**。方向 A 收权限（改由 Edge
 * Function 用服务端复算的战力写入），本模块是方向 B：即便将来某个新写入点
 * 又把权限放开，离谱的数字仍然进不了榜。
 *
 * 与 core 其余模块同规：不碰 Vue / Pinia / storage / DOM。
 *
 * ── 这条上界的职责边界 ──
 * **它拒绝的是「物理上不可能」，不是「比别人强得多」。**
 * 与秘境榜下界、里程碑下界同一条原则：宁可放过肝帝，绝不误伤真人。
 * 满强化满词条的玩家本来就该排在榜首，那是他应得的。
 *
 * ── 为什么不是「典型战力 × 一个系数」 ──
 * docs/65 §六之二 原案写的是 `combat_power ≤ expectedBuildCp(level) × 上限系数`。
 * 我按那个形状写了第一版，然后用真实数据造满配build 去验，当场被否：
 * **「结构上界 ÷ 典型养成」这个比值随等级从 5.0 一路塌到 1.2**（实测）：
 *
 *   Lv16  ×4.6~5.3    低等级时「能穿到的最强」远高于「该等级的典型」——
 *                     16 级就能穿装备副本掉的高品质件，再全 +15
 *   Lv40  ×2.6~3.0
 *   Lv78  ×1.2~1.3    内容顶附近典型品质已经接近天花板，余量几乎没有
 *
 * 同一职业跨等级差 4 倍，而同一等级跨职业只差 10% 左右 ——
 * 也就是说这个量**是等级的函数，不是一个常数**。任何平坦系数
 * 要么在低等级松到形同虚设（5 倍空间随便填），要么在满级紧到误伤肝帝。
 * **形状就是错的**，所以改成从「该等级该职业真正能穿到的最强一套」推上界。
 */

import { expectedBuildCp } from '../data/expectedPower';
import { EQUIPMENT } from '../data/equipment';
import { ENHANCE_GAIN_MAX, ENHANCE_MAX, SLOT_ORDER } from '../data/constants';
import { buildTrialCombatant } from './trial';
import { itemBaseValue } from './equipment';
import type { ClassId, EquipmentInstance, EquipSlot } from './types';

/**
 * 词条与套装效果的余量。
 *
 * 结构上界那套探针**不带词条**（词条值域按品阶随机，不适合塞进一个
 * 「最强」构造里），而全 T5 词条相对新掉落词条最多再 +25%
 * （见 TYPICAL_AFFIX_CP_MUL 的注释与洗练验收实测）。取 1.5 留出
 * 词条 + 将来新套装静态加成的空间。
 */
export const COMBAT_POWER_HEADROOM = 1.5;

/** 该槽位在该等级能穿到的最强定义：按真实基准值排序，不按名字或品质猜。 */
function strongestDefFor(slot: EquipSlot, level: number, classId: ClassId) {
  let best: { id: string; value: number } | null = null;
  for (const def of Object.values(EQUIPMENT)) {
    if (def.slot !== slot) continue;
    if (def.level > level) continue;
    if (def.classId !== undefined && def.classId !== classId) continue;
    const value = itemBaseValue(def.level, def.quality);
    if (!best || value > best.value) best = { id: def.id, value };
  }
  return best?.id ?? null;
}

/** 物理上最强的一件：基础值满掷 + 全 +15 且每级都掷出最高增益。 */
function maxedInstance(defId: string, uid: string): EquipmentInstance {
  return {
    uid,
    defId,
    enhance: ENHANCE_MAX,
    baseRollPermille: 1000,
    // 每级都掷「奇迹」档上限，累计会撞上 ENHANCE_TOTAL_GAIN_CAP_PERMILLE，
    // 也就是强化倍率的结构性天花板 ×2.35
    enhanceGainPermille: Array<number>(ENHANCE_MAX).fill(ENHANCE_GAIN_MAX),
    enhanceLuck: {},
    affixes: [],
    reforgeResonance: 0,
    locked: false,
  };
}

const maxCpCache = new Map<string, number>();

/**
 * 该等级该职业**物理上能达到的最高战力**（不含词条，词条走 HEADROOM）。
 *
 * 每槽取真实基准值最高的可穿定义、满掷、全 +15 吃满强化上限，
 * 再交给与试炼、竞技场同一个 buildTrialCombatant 算战力 ——
 * 用的是玩家实际结算那条链路，不是另立一套公式。
 *
 * 结果按 (等级, 职业) 记忆化：Edge Function 每次上报都会调它。
 */
export function structuralMaxCombatPower(level: number, classId: ClassId): number {
  const key = `${level}:${classId}`;
  const cached = maxCpCache.get(key);
  if (cached !== undefined) return cached;

  const equipped = SLOT_ORDER.map((slot, index) => {
    const defId = strongestDefFor(slot, level, classId);
    return defId ? maxedInstance(defId, `cp-ceiling-${index}`) : null;
  });
  const cp = buildTrialCombatant({
    name: '上界探针',
    classId,
    level,
    equipped,
  }).combatPower;
  maxCpCache.set(key, cp);
  return cp;
}

/** 该等级该职业允许出现的最高战力。 */
export function combatPowerCeiling(level: number, classId: ClassId): number {
  return structuralMaxCombatPower(level, classId) * COMBAT_POWER_HEADROOM;
}

/**
 * 这条战力值是否可能属于一个真实玩家。
 *
 * 等级不合法（越界、非整数）时一律判不可信 —— 上界是等级的函数，
 * 等级本身不可信时上界就无从谈起，而「先把等级伪造上去、再报一个对得上的
 * 战力」正是最自然的绕过路径。
 */
export function isPlausibleCombatPower(
  combatPower: number,
  level: number,
  classId: ClassId,
): boolean {
  if (!Number.isFinite(combatPower) || combatPower < 0) return false;
  if (!Number.isInteger(level) || level < 1 || level > 120) return false;
  return combatPower <= combatPowerCeiling(level, classId);
}

/**
 * 只用于文档与测试参照：结构上界相当于典型养成的多少倍。
 *
 * 实测这个比值随职业在 1.3~3.5 之间变化 —— 正是它把「平坦系数」那个
 * 形状否掉的。运行时判定不使用本函数。
 */
export function combatPowerCeilingRatio(level: number, classId: ClassId): number {
  return structuralMaxCombatPower(level, classId) / expectedBuildCp(level, classId);
}
