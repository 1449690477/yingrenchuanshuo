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
import {
  ENHANCE_GAIN_MAX,
  ENHANCE_MAX,
  EQUIPMENT_BASE_ROLL_MAX,
  PROFESSION_AFFIX_POOLS,
  QUALITY_AFFIX_COUNT,
  SLOT_ORDER,
} from '../data/constants';
import { buildTrialCombatant } from './trial';
import { affixValueRange, itemBaseValue, REGIONAL_BLANK_ID } from './equipment';
import type { Affix, AffixKey, ClassId, EquipmentInstance, EquipSlot } from './types';

/**
 * 套装静态加成与版本漂移的余量。**词条不再走这里** —— 2026-08-01 起
 * 探针本身带满 T5 词条（见下方 A 版构造），这只剩两件事要兜：
 * ①套装静态加成（不进探针的那部分）②客户端与 Edge 打包版本短暂不一致。
 *
 * 为什么必须收窄：CP 换乘法尺后实测「满 T5 真人 ÷ 无词条探针」最高 2.40
 * （小满 17:52 从上方保证的解析值；小榜 17:53 实构 build 读到 1.48），
 * 旧口径「探针不带词条 × 1.5」在新尺下**拦真人** —— 12 格全被拦，
 * 而 sync-profile 撞上界是 500 + 记一条作弊证据（小督 17:55 链路实查）。
 * 词条进了探针之后，这个系数只需覆盖 ①②，取小督 09:26 口径带 1.1~1.3 的中值。
 */
export const COMBAT_POWER_HEADROOM = 1.2;

/** 该槽位在该等级能穿到的最强定义：按真实基准值排序，不按名字或品质猜。 */
function strongestDefFor(slot: EquipSlot, level: number, classId: ClassId) {
  // docs/73 batch2-1 A3: anchor floor same as expectedGearStatsFromDefinitions.
  // Lv1 base value is below every real definition, so selection finds nothing
  // and the structural ceiling collapses below typical build (ratio 0.90).
  // Use the lowest definition level as floor so the ceiling never < typical.
  let floor = Number.POSITIVE_INFINITY;
  for (const def of Object.values(EQUIPMENT)) {
    if (!REGIONAL_BLANK_ID.test(def.id)) continue;
    if (def.classId !== undefined && def.classId !== classId) continue;
    if (def.level < floor) floor = def.level;
  }
  const anchor = Number.isFinite(floor) ? Math.max(level, floor) : level;

  let best: { id: string; value: number } | null = null;
  for (const def of Object.values(EQUIPMENT)) {
    if (def.slot !== slot) continue;
    if (def.level > anchor) continue;
    if (def.classId !== undefined && def.classId !== classId) continue;
    const value = itemBaseValue(def.level, def.quality);
    if (!best || value > best.value) best = { id: def.id, value };
  }
  return best?.id ?? null;
}

/** 物理上最强的一件：基础值满掷 + 全 +15 且每级都掷出最高增益。 */
function maxedInstance(defId: string, uid: string, affixes: readonly Affix[]): EquipmentInstance {
  return {
    uid,
    defId,
    enhance: ENHANCE_MAX,
    // ⚠ 满掷是 EQUIPMENT_BASE_ROLL_MAX(1200)，不是 1000。
    // 旧探针写 1000 —— 「奇迹」档（1121~1200‰）的真实掉落能越过探针，
    // 上界从下方漏风。这不是本次换尺暴露的，是一直就错的。
    baseRollPermille: EQUIPMENT_BASE_ROLL_MAX,
    // 每级都掷「奇迹」档上限，累计会撞上 ENHANCE_TOTAL_GAIN_CAP_PERMILLE，
    // 也就是强化倍率的结构性天花板 ×2.35
    enhanceGainPermille: Array<number>(ENHANCE_MAX).fill(ENHANCE_GAIN_MAX),
    enhanceLuck: {},
    affixes: [...affixes],
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
/**
 * A 版词条构造（2026-08-01，小满 09:21 六条口径 + 小督 09:25 上界法）：
 * 每槽按该件品质的词条容量塞满 **同一个键** 的 T5 满值，对候选键逐一
 * 全量重算取最大 —— 「纯键取最大」。
 *
 * 为什么是纯键而不是搜索混合：小满实测纯 spd / 纯 hp 分别是输出侧与
 * 生存侧的全局最大、混合更差（几何平均的两轴各自被单键推到头）；
 * 候选键取通用池全集 ∪ 该职业专属池 —— 是真实可掉键的**超集**，
 * 超集上的最大值只会 ≥ 真实最优，上界方向永远安全。
 *
 * 词条值取 affixValueRange(key, L, 5).max，**不再额外乘 1.03** ——
 * 值域公式里 ±3% 方差已含在 max 里，再乘一次就是把方差算两遍
 * （小榜 17:55 抓过这个：spd T5 的 min 与 max 四舍五入后同为 0.05）。
 */
const GENERIC_PROBE_KEYS: readonly AffixKey[] = [
  'atk', 'def', 'hp', 'acc', 'eva', 'critRate', 'critDmg', 'spd',
  'dmgReduce', 'elemDmg', 'lifesteal', 'skillMul',
];

function probeKeysFor(classId: ClassId): readonly AffixKey[] {
  const profession = PROFESSION_AFFIX_POOLS[classId].map((entry) => entry.key);
  return [...GENERIC_PROBE_KEYS, ...profession];
}

function pureAffixesFor(key: AffixKey, level: number, quality: string): Affix[] {
  const count = QUALITY_AFFIX_COUNT[quality as keyof typeof QUALITY_AFFIX_COUNT] ?? 0;
  const value = affixValueRange(key, level, 5).max;
  return Array.from({ length: count }, () => ({
    key,
    tier: 5 as const,
    value,
    // elemDmg 与 wit_elem（魔女专属，内部同走元素伤害结算）必须绑元素，
    // 否则 applyCombatAffix 直接抛错。选哪一系对上界无差 —— 参考怪无属性，
    // elementMultiplier 对三系一视同仁。
    ...(key === 'elemDmg' || key === 'wit_elem' ? { element: 'fire' as const } : {}),
  }));
}

export function structuralMaxCombatPower(level: number, classId: ClassId): number {
  const cacheKey = `${level}:${classId}`;
  const cached = maxCpCache.get(cacheKey);
  if (cached !== undefined) return cached;

  const slotDefs = SLOT_ORDER.map((slot) => strongestDefFor(slot, level, classId));
  let max = 0;
  for (const affixKey of probeKeysFor(classId)) {
    const equipped = slotDefs.map((defId, index) => {
      if (!defId) return null;
      const def = EQUIPMENT[defId]!;
      return maxedInstance(
        defId,
        `cp-ceiling-${index}`,
        pureAffixesFor(affixKey, level, def.quality),
      );
    });
    const cp = buildTrialCombatant({
      name: '上界探针',
      classId,
      level,
      equipped,
    }).combatPower;
    if (cp > max) max = cp;
  }
  maxCpCache.set(cacheKey, max);
  return max;
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
