import type {
  CombatBonuses,
  Element,
  EquipmentDef,
  EquipmentInstance,
  EquipSlot,
  Stats,
} from './types';
import { zeroStats } from './formula';

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
  /** 加到技能倍率上的绝对值，例如 0.08 表示平均技能倍率 +0.08。 */
  skillMultiplierBonus?: number;
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
    if (!equipmentDefinition.setId) continue;

    const cachedDefinition = definitions.get(equipmentDefinition.setId);
    const setDefinition = cachedDefinition ?? setDefOf(equipmentDefinition.setId);
    if (!setDefinition) {
      throw new Error(`[配置错误] 装备引用了未登记套装：${equipmentDefinition.setId}`);
    }
    if (setDefinition.id !== equipmentDefinition.setId) {
      throw new Error(
        `[配置错误] 套装查询键与定义 ID 不一致：${equipmentDefinition.setId} / ${setDefinition.id}`,
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
    previousPieces = bonus.pieces;
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
