/**
 * 背包容量管理。
 *
 * 为什么必须有：挂机产出是无限的，背包不设上限的话装备会无限堆积。
 * 实测玩家一天就能堆到 1.5 万件，后果是：
 *   - 存档体积爆炸，IndexedDB 读写越来越慢
 *   - 任何遍历背包的计算（战力评分、一键穿戴）都被拖垮
 *   - 界面渲染直接卡死
 *
 * 策略：超出容量时自动分解**最不值钱的**装备，但有四条硬性保护：
 *   1. 锁定的装备永不分解
 *   2. 史诗（epic）及以上永不自动分解 —— 玩家辛苦刷的东西不能悄悄没了
 *   3. 每个部位至少保留战力最高的一件，避免把唯一的可穿装备清掉
 *   4. 每个部位 × 高阶战斗词条用途动态保留最好的一件
 *
 * 保护条件太强时宁可让背包超出上限，也不能删玩家的好东西。
 */

import type { Affix, Element, EquipmentInstance, EquipSlot, Quality } from './types';
import { isAffixSettlementActive, QUALITY_RANK } from '@/data/constants';
import { PROTECT_TIER_THRESHOLD } from '@/data/reforgeRules';

/**
 * 掉落时自动上锁的品质门槛。
 *
 * ## 原规则错在哪
 *
 * 原来只看胚子等级：`locked: baseRoll.grade === 'miracle'`，完全不看品质。
 * 两个方向都是反的：
 *
 * 1. **白装摇到奇迹会被永久锁死。** 锁定是 `trimBag` 的硬保护，
 *    这些装备再也无法被容量裁剪清掉。奇迹胚子约 2%，而白装又是掉落大头，
 *    背包里会持续沉淀清不掉的白垃圾，容量系统被慢慢腐蚀。
 *    而一件奇迹白装的属性仍然不如一件普通蓝装 —— 留着毫无意义。
 * 2. **传说、神话只要胚子普通就不上锁。** 这恰恰是玩家最怕误删的东西：
 *    它们虽然不会被自动裁剪（见 AUTO_DECOMPOSE_QUALITIES），
 *    但玩家在批量分解里勾中该品质时没有任何保护。
 *
 * ## 现规则
 *
 * 锁定应当对齐「玩家在追什么」，也就是品质：
 * - 传说（legendary）及以上一律上锁 —— 这是追求的目标，绝不能悄悄没了
 * - 奇迹胚子把门槛下调一档到史诗，让真正的惊喜掉落也受保护
 * - 蓝装及以下一律不上锁 —— 它们是消耗品，堆几千件毫无意义
 *
 * 配套提供批量解锁（planBulkLock），后期想清理旧橙装时一键放开即可。
 */
const AUTO_LOCK_MIN_RANK = QUALITY_RANK.legendary;
const MIRACLE_AUTO_LOCK_MIN_RANK = QUALITY_RANK.epic;

/** 一件新掉落的装备是否应当自动上锁。 */
export function shouldAutoLock(quality: Quality, isMiracleRoll: boolean): boolean {
  const rank = QUALITY_RANK[quality];
  if (rank >= AUTO_LOCK_MIN_RANK) return true;
  return isMiracleRoll && rank >= MIRACLE_AUTO_LOCK_MIN_RANK;
}

/**
 * 自动分解会碰的品质。
 *
 * ⚠ 必须包含稀有（蓝装）。
 * 最初只放了白/绿，结果玩家背包里堆的全是蓝色「秘银·XX」，
 * 保护规则把它们全挡下来，1.5 万件一件没删，卡死照旧。
 * 蓝装在中后期就是消耗品，堆几千件毫无意义。
 *
 * 史诗（紫）及以上永不自动分解 —— 那是玩家真正在追的东西。
 */
const AUTO_DECOMPOSE_QUALITIES: ReadonlySet<Quality> = new Set<Quality>(['common', 'fine', 'rare']);

/** 自动分解门槛选项（M4-12 设置页接线）。 */
export interface TrimOptions {
  /**
   * 自动分解的品质门槛（**含该品质**，即「门槛及以下」可自动分解）。
   * - 'none'：关闭自动分解（超出容量时宁可通过其他保护，也不删任何装备）；
   * - 缺省：白 / 绿 / 蓝（= 历史行为，史诗及以上永不自动分解的硬保护不变）。
   */
  autoDecomposeBelow?: Quality | 'none';
}

const NO_AUTO_DECOMPOSE: ReadonlySet<Quality> = new Set<Quality>();

/** 门槛及以下的所有品质（含门槛本身）。 */
function qualitiesUpTo(threshold: Quality): ReadonlySet<Quality> {
  const rank = QUALITY_RANK[threshold];
  return new Set<Quality>(
    (Object.keys(QUALITY_RANK) as Quality[]).filter((q) => QUALITY_RANK[q] <= rank),
  );
}

export interface TrimContext {
  /** 装备的战力评分，越高越值钱 */
  valueOf: (inst: EquipmentInstance) => number;
  /** 装备所属槽位 */
  slotOf: (inst: EquipmentInstance) => EquipSlot | undefined;
  /** 装备品质 */
  qualityOf: (inst: EquipmentInstance) => Quality | undefined;
  /** 武器的基础攻击元素；非武器返回 undefined */
  weaponElementOf: (inst: EquipmentInstance) => Element | undefined;
}

export interface TrimResult {
  /** 保留下来的装备 */
  kept: EquipmentInstance[];
  /** 被自动分解掉的装备 */
  removed: EquipmentInstance[];
}

type CombatProtectionGroup =
  | 'damage-reduction'
  | 'lifesteal'
  | `element:${'fire' | 'ice' | 'thunder'}`;

interface CombatProtectionCandidate {
  inst: EquipmentInstance;
  affix: Affix;
  originalIndex: number;
}

interface WeaponElementProtectionCandidate {
  inst: EquipmentInstance;
  originalIndex: number;
}

export interface BulkDecomposePlan {
  /** 本次确认后会被分解的装备快照 */
  targets: EquipmentInstance[];
  /** 因存在已付费、待确认的洗练候选而受到硬保护的数量 */
  protectedPending: number;
  /** 因锁定而受到硬保护的数量 */
  protectedLocked: number;
  /** 因已强化且未开启许可而受到保护的数量 */
  protectedEnhanced: number;
}

/**
 * 按玩家明确选择的品质生成批量分解计划。
 *
 * 这里只负责筛选，不读取 UI，也不修改背包。调用方应在玩家确认时把 targets
 * 的 uid 做成快照再交给 store，避免确认过程中刚掉落的装备被意外一起分解。
 */
export function planBulkDecompose(
  equipment: readonly EquipmentInstance[],
  selectedQualities: readonly Quality[],
  includeEnhanced: boolean,
  qualityOf: (inst: EquipmentInstance) => Quality | undefined,
): BulkDecomposePlan {
  const selected = new Set(selectedQualities);
  const targets: EquipmentInstance[] = [];
  let protectedPending = 0;
  let protectedLocked = 0;
  let protectedEnhanced = 0;

  for (const inst of equipment) {
    const quality = qualityOf(inst);
    if (!quality || !selected.has(quality)) continue;

    // 待确认候选已经扣过洗练成本；任何分解都会让玩家永久丢失已付费结果。
    // 它的保护优先级高于手动锁定，且必须单独计数给 UI 明示。
    if (inst.pendingAffixChange) {
      protectedPending++;
      continue;
    }
    // 锁定是不可绕过的硬保护，优先级高于所有其他条件。
    if (inst.locked) {
      protectedLocked++;
      continue;
    }
    if (inst.enhance > 0 && !includeEnhanced) {
      protectedEnhanced++;
      continue;
    }
    targets.push(inst);
  }

  return { targets, protectedPending, protectedLocked, protectedEnhanced };
}

export interface BulkLockPlan {
  /** 本次会被改变锁定状态的装备 */
  targets: EquipmentInstance[];
  /** 已经是目标状态、无需改动的数量 */
  alreadyInState: number;
  /** 穿戴中因此被跳过的数量（仅解锁时统计） */
  skippedEquipped: number;
}

/**
 * 按品质生成批量上锁 / 解锁计划。
 *
 * 与批量分解一样，这里只筛选、不改背包，由调用方拿 uid 快照交给 store。
 *
 * 解锁时会跳过穿戴中的装备：玩家解锁通常是为了紧接着批量分解，
 * 把身上正穿的一起放开等于给自己挖坑。想脱下来处理仍可单件解锁。
 */
export function planBulkLock(
  equipment: readonly EquipmentInstance[],
  selectedQualities: readonly Quality[],
  locked: boolean,
  qualityOf: (inst: EquipmentInstance) => Quality | undefined,
  isEquipped: (inst: EquipmentInstance) => boolean = () => false,
): BulkLockPlan {
  const selected = new Set(selectedQualities);
  const targets: EquipmentInstance[] = [];
  let alreadyInState = 0;
  let skippedEquipped = 0;

  for (const inst of equipment) {
    const quality = qualityOf(inst);
    if (!quality || !selected.has(quality)) continue;
    if (inst.locked === locked) {
      alreadyInState++;
      continue;
    }
    if (!locked && isEquipped(inst)) {
      skippedEquipped++;
      continue;
    }
    targets.push(inst);
  }

  return { targets, alreadyInState, skippedEquipped };
}

/**
 * 把背包裁剪到容量以内。
 *
 * @param equipment 背包里的全部装备
 * @param capacity  容量上限
 */
export function trimBag(
  equipment: readonly EquipmentInstance[],
  capacity: number,
  ctx: TrimContext,
  options?: TrimOptions,
): TrimResult {
  if (capacity <= 0 || equipment.length <= capacity) {
    return { kept: [...equipment], removed: [] };
  }

  const autoDecomposeQualities =
    options?.autoDecomposeBelow === undefined
      ? AUTO_DECOMPOSE_QUALITIES
      : options.autoDecomposeBelow === 'none'
        ? NO_AUTO_DECOMPOSE
        : qualitiesUpTo(options.autoDecomposeBelow);

  // ⚠ 战力必须先一次性算好缓存起来。
  // 早先在排序比较器里直接调 ctx.valueOf，1.5 万件会触发约 43 万次战力计算，
  // 直接把页面卡死 —— 和 BagView 当初踩的是同一个坑。
  const valueCache = new Map<string, number>();
  for (const inst of equipment) {
    valueCache.set(inst.uid, ctx.valueOf(inst));
  }
  const cachedValue = (inst: EquipmentInstance): number => valueCache.get(inst.uid) ?? 0;

  // 每个部位战力最高的那件，无论品质都要留住
  const bestPerSlot = new Map<EquipSlot, string>();
  const bestValue = new Map<EquipSlot, number>();
  for (const inst of equipment) {
    const slot = ctx.slotOf(inst);
    if (!slot) continue;
    const v = cachedValue(inst);
    if (!bestValue.has(slot) || v > bestValue.get(slot)!) {
      bestValue.set(slot, v);
      bestPerSlot.set(slot, inst.uid);
    }
  }

  /*
   * 减伤、吸血、元素伤害不属于八项 Stats，不能用固定 CP 权重冒充真实价值。
   * 这里按用途动态保留一个冠军：新掉落更好的会自然替换旧冠军，不写 locked，
   * 因此最多额外保护 8 部位 × (减伤 + 吸血 + 三元素) = 40 个位置。
   */
  const bestCombatAffix = new Map<string, CombatProtectionCandidate>();
  equipment.forEach((inst, originalIndex) => {
    const slot = ctx.slotOf(inst);
    if (!slot) return;
    for (const affix of inst.affixes) {
      const group = combatProtectionGroup(affix);
      if (!group || affix.tier < PROTECT_TIER_THRESHOLD) continue;
      const key = `${slot}:${group}`;
      const candidate = { inst, affix, originalIndex };
      const current = bestCombatAffix.get(key);
      if (!current || isBetterCombatProtectionCandidate(candidate, current, cachedValue)) {
        bestCombatAffix.set(key, candidate);
      }
    }
  });
  const combatAffixChampions = new Set(
    [...bestCombatAffix.values()].map((candidate) => candidate.inst.uid),
  );

  /*
   * 教学与构筑依赖真实武器元素。它不属于八项 Stats，也不能让唯一一把炎/冰/雷
   * 武器因为当前关卡没吃克制就被清掉。每个非无属性系只动态保留评分最高的一把，
   * 最多额外 3 个位置；更好的同系武器会自然替换旧冠军。
   */
  const bestWeaponElement = new Map<
    Exclude<Element, 'none'>,
    WeaponElementProtectionCandidate
  >();
  equipment.forEach((inst, originalIndex) => {
    const element = ctx.weaponElementOf(inst);
    if (!element || element === 'none') return;
    const candidate = { inst, originalIndex };
    const current = bestWeaponElement.get(element);
    if (
      !current ||
      cachedValue(inst) > cachedValue(current.inst) ||
      (cachedValue(inst) === cachedValue(current.inst) &&
        originalIndex < current.originalIndex)
    ) {
      bestWeaponElement.set(element, candidate);
    }
  });
  const weaponElementChampions = new Set(
    [...bestWeaponElement.values()].map((candidate) => candidate.inst.uid),
  );

  const isProtected = (inst: EquipmentInstance): boolean => {
    if (inst.pendingAffixChange) return true;
    if (inst.locked) return true;
    const q = ctx.qualityOf(inst);
    // 品质查不到时按受保护处理，宁可不删也不能误删
    if (!q || !autoDecomposeQualities.has(q)) return true;
    const slot = ctx.slotOf(inst);
    if (slot && bestPerSlot.get(slot) === inst.uid) return true;
    if (combatAffixChampions.has(inst.uid)) return true;
    if (weaponElementChampions.has(inst.uid)) return true;
    return false;
  };

  const protectedItems: EquipmentInstance[] = [];
  const candidates: EquipmentInstance[] = [];
  for (const inst of equipment) {
    (isProtected(inst) ? protectedItems : candidates).push(inst);
  }

  // 需要删掉多少件
  const overflow = equipment.length - capacity;
  if (overflow <= 0 || candidates.length === 0) {
    return { kept: [...equipment], removed: [] };
  }

  // 战力低的先删。用缓存值排序，绝不能在比较器里现算。
  candidates.sort((a, b) => cachedValue(a) - cachedValue(b));
  const removeCount = Math.min(overflow, candidates.length);
  const removed = candidates.slice(0, removeCount);
  const removedIds = new Set(removed.map((e) => e.uid));

  const kept = equipment.filter((e) => !removedIds.has(e.uid));
  return { kept, removed };
}

function combatProtectionGroup(affix: Affix): CombatProtectionGroup | null {
  if (!isAffixSettlementActive(affix.key)) return null;
  switch (affix.key) {
    case 'dmgReduce':
    case 'sha_ward':
      return 'damage-reduction';
    case 'lifesteal':
    case 'sha_drain':
      return 'lifesteal';
    case 'elemDmg':
    case 'wit_elem':
      return affix.element && affix.element !== 'none' ? `element:${affix.element}` : null;
    default:
      return null;
  }
}

function isBetterCombatProtectionCandidate(
  candidate: CombatProtectionCandidate,
  current: CombatProtectionCandidate,
  cachedValue: (inst: EquipmentInstance) => number,
): boolean {
  if (candidate.affix.tier !== current.affix.tier) {
    return candidate.affix.tier > current.affix.tier;
  }
  if (candidate.affix.value !== current.affix.value) {
    return candidate.affix.value > current.affix.value;
  }
  const candidateValue = cachedValue(candidate.inst);
  const currentValue = cachedValue(current.inst);
  if (candidateValue !== currentValue) return candidateValue > currentValue;
  return candidate.originalIndex < current.originalIndex;
}

/** 背包是否已经超出容量 */
export function isOverCapacity(count: number, capacity: number): boolean {
  return capacity > 0 && count > capacity;
}
