import type {
  CombatBonuses,
  Element,
  EquipmentDef,
  EquipmentInstance,
  EquipSlot,
  Stats,
} from './types';
import { zeroStats } from './formula';
import type { PeriodicStatusRefresh } from './combatStatus';

export type EquipmentSetCombatBonus = Partial<Omit<CombatBonuses, 'elementDamage'>> & {
  elementDamage?: Partial<CombatBonuses['elementDamage']>;
};

/**
 * 每个“已经确认命中的直接伤害段”独立判定的追加元素伤害。
 *
 * 这是逐伤害段契约，不是逐技能/逐次施法契约。多段技能未来只需让每一段分别
 * 调用战斗解析器，就不会把六段连击错误地压成一次触发机会。
 */
export interface OnHitElementalDamageTrigger {
  id: string;
  kind: 'elemental-damage';
  chance: number;
  atkMultiplier: number;
  element: Exclude<Element, 'none'>;
}

/**
 * 受到致命伤害后免于倒下并按最大生命回复。
 *
 * 触发次数属于一次真实战斗实例；开始下一关/下一次挑战时由 simulateFight
 * 创建新状态，因此不会把次数写进存档，也不会跨关残留。
 */
export interface OnLethalRecoveryTrigger {
  id: string;
  kind: 'lethal-recovery';
  healRatio: number;
  activationsPerFight: number;
}

/**
 * 每个已经确认暴击的直接伤害段触发一次回复与持续伤害。
 *
 * 持续伤害使用施加瞬间的单跳伤害快照；之后只由战斗状态时钟推进，不再次
 * 命中、暴击、吸血或触发任何逐击 / 暴击效果。
 */
export interface OnCritPeriodicDamageTrigger {
  id: string;
  kind: 'crit-periodic-damage';
  healMaxHpRatio: number;
  statusId: string;
  atkMultiplierPerTick: number;
  ticks: number;
  durationSec: number;
  maxStacks: number;
  refresh: PeriodicStatusRefresh;
  element?: Element;
}

export interface EquipmentSetBonus {
  pieces: 2 | 4 | 6 | 8;
  label: string;
  description: string;
  statPercent?: Partial<Stats>;
  statFlat?: Partial<Stats>;
  /** 不进入八项 Stats 的减伤、吸血与分系元素伤害百分点。 */
  combatBonuses?: EquipmentSetCombatBonus;
  /** 每个直接真实命中独立触发；不得折算进 skillMultiplierBonus。 */
  onHitTriggers?: readonly OnHitElementalDamageTrigger[];
  /** 每场战斗独立计数的致命伤保护。 */
  onLethalTriggers?: readonly OnLethalRecoveryTrigger[];
  /** 每个直接真实暴击独立触发；持续伤害不得折算进平均技能倍率。 */
  onCritTriggers?: readonly OnCritPeriodicDamageTrigger[];
  /** 加到技能倍率上的绝对值，例如 0.08 表示平均技能倍率 +0.08。 */
  skillMultiplierBonus?: number;
  /**
   * 纯外观档：只给称号与外观，**不产生任何战斗收益**（docs/58 §四）。
   *
   * 为什么要显式声明而不是「没配战斗字段就算外观」：
   * 「没配」和「故意不配」在代码里长得一模一样，后人很容易顺手补一个
   * statPercent 上去，而那正是本次重构要防的事 —— 烙印让集齐 8 件变得容易，
   * 8 件若还给战斗加成就是白送的战力台阶。声明出来才能用测试锁住。
   */
  cosmeticOnly?: true;
  /** 达成该档位授予的称号（静态展示，不做称号系统）。 */
  title?: string;
}

/**
 * 核心层只关心结算所需的通用套装契约。
 *
 * 装备副本档位、区域来源等内容字段由各自 data 表扩展，不能反向写进核心逻辑。
 */
export interface EquipmentSetDefinition {
  id: string;
  name: string;
  /** 该套装实际存在的槽位；用于拒绝把腰带/鞋等误计进六件套。 */
  pieceSlots: readonly EquipSlot[];
  bonuses: readonly EquipmentSetBonus[];
}

export type EquipmentSetDefinitionResolver = (setId: string) => EquipmentSetDefinition | undefined;

export interface ActiveEquipmentSet {
  definition: EquipmentSetDefinition;
  equippedPieces: number;
  activeBonuses: readonly EquipmentSetBonus[];
  nextBonus: EquipmentSetBonus | null;
}

export interface EquipmentSetResolution {
  sets: readonly ActiveEquipmentSet[];
  statPercent: Stats;
  statFlat: Stats;
  combatBonuses: CombatBonuses;
  onHitTriggers: readonly OnHitElementalDamageTrigger[];
  onLethalTriggers: readonly OnLethalRecoveryTrigger[];
  onCritTriggers: readonly OnCritPeriodicDamageTrigger[];
  skillMultiplierBonus: number;
}

/**
 * 按当前八个穿戴槽统计套装。
 *
 * 输入只读，输出全新对象；同一槽无法重复计数，背包中的未穿戴装备不会生效。
 */
export function resolveEquipmentSetBonuses(
  equipped: readonly (EquipmentInstance | null)[],
  defOf: (defId: string) => EquipmentDef | undefined,
  setDefOf: EquipmentSetDefinitionResolver,
): EquipmentSetResolution {
  const counts = new Map<string, number>();
  const definitions = new Map<string, EquipmentSetDefinition>();
  for (const instance of equipped) {
    if (!instance) continue;
    const equipmentDefinition = defOf(instance.defId);
    if (!equipmentDefinition) {
      throw new Error(`[配置错误] 装备定义不存在：${instance.defId}`);
    }
    // 烙印优先于定义（docs/58 核心一刀）：普通装备烙上套装后
    // 与原生套装件在结算里完全同权。定义级 setId 的旧副本装保持原路径。
    const setId = instance.imprintSetId ?? equipmentDefinition.setId;
    if (!setId) continue;

    const cachedDefinition = definitions.get(setId);
    const setDefinition = cachedDefinition ?? setDefOf(setId);
    if (!setDefinition) {
      throw new Error(`[配置错误] 装备引用了未登记套装：${setId}`);
    }
    if (setDefinition.id !== setId) {
      throw new Error(
        `[配置错误] 套装查询键与定义 ID 不一致：${setId} / ${setDefinition.id}`,
      );
    }
    if (!setDefinition.pieceSlots.includes(equipmentDefinition.slot)) {
      throw new Error(
        `[配置错误] 套装 ${setDefinition.id} 不包含部位 ${equipmentDefinition.slot}：${equipmentDefinition.id}`,
      );
    }
    if (!cachedDefinition) {
      assertSetDefinition(setDefinition);
      definitions.set(setDefinition.id, setDefinition);
    }
    counts.set(setDefinition.id, (counts.get(setDefinition.id) ?? 0) + 1);
  }

  const statPercent = zeroStats();
  const statFlat = zeroStats();
  const combatBonuses = zeroSetCombatBonuses();
  const onHitTriggers: OnHitElementalDamageTrigger[] = [];
  const onLethalTriggers: OnLethalRecoveryTrigger[] = [];
  const onCritTriggers: OnCritPeriodicDamageTrigger[] = [];
  let skillMultiplierBonus = 0;
  const sets: ActiveEquipmentSet[] = [];

  for (const [setId, equippedPieces] of counts) {
    const definition = definitions.get(setId)!;
    const activeBonuses = definition.bonuses.filter((bonus) => equippedPieces >= bonus.pieces);
    const nextBonus = definition.bonuses.find((bonus) => equippedPieces < bonus.pieces) ?? null;
    for (const bonus of activeBonuses) {
      addPartialStats(statPercent, bonus.statPercent);
      addPartialStats(statFlat, bonus.statFlat);
      addSetCombatBonuses(combatBonuses, bonus.combatBonuses);
      for (const trigger of bonus.onHitTriggers ?? []) {
        if (onHitTriggers.some((existing) => existing.id === trigger.id)) {
          throw new Error(`[配置错误] 重复的逐击触发 ID：${trigger.id}`);
        }
        onHitTriggers.push(trigger);
      }
      for (const trigger of bonus.onLethalTriggers ?? []) {
        if (onLethalTriggers.some((existing) => existing.id === trigger.id)) {
          throw new Error(`[配置错误] 重复的致命伤触发 ID：${trigger.id}`);
        }
        onLethalTriggers.push(trigger);
      }
      for (const trigger of bonus.onCritTriggers ?? []) {
        if (onCritTriggers.some((existing) => existing.id === trigger.id)) {
          throw new Error(`[配置错误] 重复的暴击触发 ID：${trigger.id}`);
        }
        onCritTriggers.push(trigger);
      }
      skillMultiplierBonus += bonus.skillMultiplierBonus ?? 0;
    }
    sets.push({ definition, equippedPieces, activeBonuses, nextBonus });
  }

  sets.sort((left, right) => right.equippedPieces - left.equippedPieces);
  return {
    sets,
    statPercent,
    statFlat,
    combatBonuses,
    onHitTriggers,
    onLethalTriggers,
    onCritTriggers,
    skillMultiplierBonus,
  };
}

/** 百分比先作用于原属性，再加固定值；暴击率等百分点只走固定值。 */
export function applyEquipmentSetStats(stats: Stats, resolution: EquipmentSetResolution): Stats {
  return {
    atk: stats.atk * (1 + resolution.statPercent.atk) + resolution.statFlat.atk,
    def: stats.def * (1 + resolution.statPercent.def) + resolution.statFlat.def,
    hp: stats.hp * (1 + resolution.statPercent.hp) + resolution.statFlat.hp,
    acc: stats.acc * (1 + resolution.statPercent.acc) + resolution.statFlat.acc,
    eva: stats.eva * (1 + resolution.statPercent.eva) + resolution.statFlat.eva,
    critRate: stats.critRate * (1 + resolution.statPercent.critRate) + resolution.statFlat.critRate,
    critDmg: stats.critDmg * (1 + resolution.statPercent.critDmg) + resolution.statFlat.critDmg,
    spd: stats.spd * (1 + resolution.statPercent.spd) + resolution.statFlat.spd,
  };
}

function addPartialStats(target: Stats, source: Partial<Stats> | undefined): void {
  if (!source) return;
  for (const key of Object.keys(target) as (keyof Stats)[]) {
    target[key] += source[key] ?? 0;
  }
}

function zeroSetCombatBonuses(): CombatBonuses {
  return {
    damageReduction: 0,
    lifesteal: 0,
    elementDamage: { fire: 0, ice: 0, thunder: 0 },
  };
}

function addSetCombatBonuses(
  target: CombatBonuses,
  source: EquipmentSetCombatBonus | undefined,
): void {
  if (!source) return;
  target.damageReduction += source.damageReduction ?? 0;
  target.lifesteal += source.lifesteal ?? 0;
  target.elementDamage.fire += source.elementDamage?.fire ?? 0;
  target.elementDamage.ice += source.elementDamage?.ice ?? 0;
  target.elementDamage.thunder += source.elementDamage?.thunder ?? 0;
}

function assertSetDefinition(definition: EquipmentSetDefinition): void {
  if (definition.pieceSlots.length === 0) {
    throw new Error(`[配置错误] 套装没有登记任何部位：${definition.id}`);
  }
  if (new Set(definition.pieceSlots).size !== definition.pieceSlots.length) {
    throw new Error(`[配置错误] 套装部位重复：${definition.id}`);
  }
  let previousPieces = 0;
  const triggerIds = new Set<string>();
  const lethalTriggerIds = new Set<string>();
  const critTriggerIds = new Set<string>();
  for (const bonus of definition.bonuses) {
    if (bonus.pieces <= previousPieces || bonus.pieces > definition.pieceSlots.length) {
      throw new Error(`[配置错误] 套装激活件数非法：${definition.id} / ${bonus.pieces}`);
    }
    for (const trigger of bonus.onHitTriggers ?? []) {
      assertOnHitElementalDamageTrigger(trigger);
      if (triggerIds.has(trigger.id)) {
        throw new Error(`[配置错误] 重复的逐击触发 ID：${trigger.id}`);
      }
      triggerIds.add(trigger.id);
    }
    for (const trigger of bonus.onLethalTriggers ?? []) {
      assertOnLethalRecoveryTrigger(trigger);
      if (lethalTriggerIds.has(trigger.id)) {
        throw new Error(`[配置错误] 重复的致命伤触发 ID：${trigger.id}`);
      }
      lethalTriggerIds.add(trigger.id);
    }
    for (const trigger of bonus.onCritTriggers ?? []) {
      assertOnCritPeriodicDamageTrigger(trigger);
      if (critTriggerIds.has(trigger.id)) {
        throw new Error(`[配置错误] 重复的暴击触发 ID：${trigger.id}`);
      }
      critTriggerIds.add(trigger.id);
    }
    previousPieces = bonus.pieces;
  }
}

export function assertOnLethalRecoveryTrigger(trigger: OnLethalRecoveryTrigger): void {
  if (trigger.kind !== 'lethal-recovery') {
    throw new Error(`[配置错误] 未知致命伤触发类型：${trigger.id}`);
  }
  if (!trigger.id.trim()) {
    throw new Error('[配置错误] 致命伤触发缺少稳定 ID');
  }
  if (!Number.isFinite(trigger.healRatio) || trigger.healRatio <= 0 || trigger.healRatio > 1) {
    throw new Error(`[配置错误] 致命伤回复比例必须在 (0, 1]：${trigger.id}`);
  }
  if (
    !Number.isSafeInteger(trigger.activationsPerFight) ||
    trigger.activationsPerFight <= 0
  ) {
    throw new Error(`[配置错误] 致命伤触发次数必须是正整数：${trigger.id}`);
  }
}

export function assertOnHitElementalDamageTrigger(trigger: OnHitElementalDamageTrigger): void {
  if (trigger.kind !== 'elemental-damage') {
    throw new Error(`[配置错误] 未知逐击触发类型：${trigger.id}`);
  }
  if (!trigger.id.trim()) {
    throw new Error('[配置错误] 逐击触发缺少稳定 ID');
  }
  if (!Number.isFinite(trigger.chance) || trigger.chance < 0 || trigger.chance > 1) {
    throw new Error(`[配置错误] 逐击触发概率必须在 0~1：${trigger.id}`);
  }
  if (!Number.isFinite(trigger.atkMultiplier) || trigger.atkMultiplier <= 0) {
    throw new Error(`[配置错误] 逐击触发攻击倍率必须为正数：${trigger.id}`);
  }
  if (!(['fire', 'ice', 'thunder'] as readonly Element[]).includes(trigger.element)) {
    throw new Error(`[配置错误] 追加元素伤害不能是无属性：${trigger.id}`);
  }
}

export function assertOnCritPeriodicDamageTrigger(trigger: OnCritPeriodicDamageTrigger): void {
  if (trigger.kind !== 'crit-periodic-damage') {
    throw new Error(`[配置错误] 未知暴击触发类型：${trigger.id}`);
  }
  if (!trigger.id.trim() || !trigger.statusId.trim()) {
    throw new Error('[配置错误] 暴击持续伤害缺少稳定 ID');
  }
  if (
    !Number.isFinite(trigger.healMaxHpRatio) ||
    trigger.healMaxHpRatio < 0 ||
    trigger.healMaxHpRatio > 1
  ) {
    throw new Error(`[配置错误] 暴击回复比例必须在 [0, 1]：${trigger.id}`);
  }
  if (!Number.isFinite(trigger.atkMultiplierPerTick) || trigger.atkMultiplierPerTick < 0) {
    throw new Error(`[配置错误] 持续伤害单跳倍率必须是非负数：${trigger.id}`);
  }
  if (!Number.isSafeInteger(trigger.ticks) || trigger.ticks <= 0) {
    throw new Error(`[配置错误] 持续伤害跳数必须是正整数：${trigger.id}`);
  }
  if (!Number.isFinite(trigger.durationSec) || trigger.durationSec <= 0) {
    throw new Error(`[配置错误] 持续伤害时长必须为正数：${trigger.id}`);
  }
  const durationMs = trigger.durationSec * 1_000;
  if (!Number.isSafeInteger(durationMs) || durationMs % trigger.ticks !== 0) {
    throw new Error(`[配置错误] 持续伤害时长必须能均分为整数毫秒 tick：${trigger.id}`);
  }
  if (!Number.isSafeInteger(trigger.maxStacks) || trigger.maxStacks <= 0) {
    throw new Error(`[配置错误] 持续伤害层数上限必须是正整数：${trigger.id}`);
  }
}
