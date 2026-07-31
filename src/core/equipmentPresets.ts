import type { ClassId, Element, EquipmentDef, EquipmentInstance, EquipSlot } from './types';
import { ELEMENT_BEATS, SLOT_ORDER } from '@/data/constants';

export const EQUIPMENT_PRESET_IDS = ['preset-1', 'preset-2', 'preset-3'] as const;
export type EquipmentPresetId = (typeof EQUIPMENT_PRESET_IDS)[number];

export type EquipmentPresetUids = Record<EquipSlot, string | null>;
export type EquippedLoadout = Record<EquipSlot, EquipmentInstance | null>;

export interface EquipmentPreset {
  id: EquipmentPresetId;
  /** 预设只对保存它的职业生效，避免职业专属武器被跨职业自动穿戴。 */
  classId: ClassId;
  equipmentUids: EquipmentPresetUids;
}

export interface EquipmentPresetState {
  presets: EquipmentPreset[];
  autoSwitch: boolean;
}

export interface EquipmentPresetPlanInput {
  preset: EquipmentPreset;
  classId: ClassId;
  playerLevel: number;
  equipped: Readonly<EquippedLoadout>;
  bagEquipment: readonly EquipmentInstance[];
  definitionOf: (defId: string) => EquipmentDef | undefined;
}

export type EquipmentPresetPlanFailure =
  | { ok: false; reason: 'class-mismatch' }
  | { ok: false; reason: 'duplicate-uid'; uid: string }
  | { ok: false; reason: 'missing-equipment'; uid: string }
  | { ok: false; reason: 'wrong-slot'; uid: string; expected: EquipSlot; actual: EquipSlot }
  | { ok: false; reason: 'level-locked'; uid: string; requiredLevel: number }
  | { ok: false; reason: 'profession-locked'; uid: string; requiredClassId: ClassId };

export type EquipmentPresetPlan =
  | EquipmentPresetPlanFailure
  | {
      ok: true;
      equipped: EquippedLoadout;
      bagEquipment: EquipmentInstance[];
      changedSlots: number;
    };

export type AutomaticEquipmentPresetPlan =
  | { status: 'not-needed'; reason: 'untyped-stage' | 'already-countering' }
  | { status: 'not-found'; counterElement: Exclude<Element, 'none'> }
  | { status: 'blocked'; preset: EquipmentPreset; failure: EquipmentPresetPlanFailure }
  | {
      status: 'ready';
      counterElement: Exclude<Element, 'none'>;
      preset: EquipmentPreset;
      plan: Extract<EquipmentPresetPlan, { ok: true }>;
    };

export function createEquipmentPresetState(): EquipmentPresetState {
  return { presets: [], autoSwitch: false };
}

export function emptyEquipmentPresetUids(): EquipmentPresetUids {
  return {
    weapon: null,
    head: null,
    body: null,
    necklace: null,
    bracelet: null,
    ring: null,
    belt: null,
    shoes: null,
  };
}

/** 把当前八槽完整快照成预设；空槽也要保存，应用时才不会偷偷保留旧件。 */
export function captureEquipmentPreset(
  id: EquipmentPresetId,
  classId: ClassId,
  equipped: Readonly<EquippedLoadout>,
): EquipmentPreset {
  return {
    id,
    classId,
    equipmentUids: Object.fromEntries(
      SLOT_ORDER.map((slot) => [slot, equipped[slot]?.uid ?? null]),
    ) as EquipmentPresetUids,
  };
}

/**
 * 原子规划一次整套换装。
 *
 * 先验证全部 UID、槽位、等级与职业，再构造新快照；任何一件不合法都不返回半套结果。
 */
export function planEquipmentPreset(input: EquipmentPresetPlanInput): EquipmentPresetPlan {
  if (input.preset.classId !== input.classId) return { ok: false, reason: 'class-mismatch' };

  const allOwned = [
    ...input.bagEquipment,
    ...SLOT_ORDER.flatMap((slot) => (input.equipped[slot] ? [input.equipped[slot]!] : [])),
  ];
  const ownedByUid = new Map<string, EquipmentInstance>();
  for (const instance of allOwned) {
    if (ownedByUid.has(instance.uid)) {
      return { ok: false, reason: 'duplicate-uid', uid: instance.uid };
    }
    ownedByUid.set(instance.uid, instance);
  }

  const selected = new Set<string>();
  const equipped = emptyEquippedLoadout();
  for (const slot of SLOT_ORDER) {
    const uid = input.preset.equipmentUids[slot];
    if (!uid) continue;
    if (selected.has(uid)) return { ok: false, reason: 'duplicate-uid', uid };

    const instance = ownedByUid.get(uid);
    if (!instance) return { ok: false, reason: 'missing-equipment', uid };
    const definition = input.definitionOf(instance.defId);
    if (!definition) {
      throw new Error(`[配置错误] 装备预设找不到定义：${instance.defId}`);
    }
    if (definition.slot !== slot) {
      return {
        ok: false,
        reason: 'wrong-slot',
        uid,
        expected: slot,
        actual: definition.slot,
      };
    }
    if (definition.level > input.playerLevel) {
      return { ok: false, reason: 'level-locked', uid, requiredLevel: definition.level };
    }
    if (definition.classId && definition.classId !== input.classId) {
      return {
        ok: false,
        reason: 'profession-locked',
        uid,
        requiredClassId: definition.classId,
      };
    }
    selected.add(uid);
    equipped[slot] = instance;
  }

  let changedSlots = 0;
  for (const slot of SLOT_ORDER) {
    if ((input.equipped[slot]?.uid ?? null) !== (equipped[slot]?.uid ?? null)) changedSlots += 1;
  }

  return {
    ok: true,
    equipped,
    bagEquipment: allOwned.filter((instance) => !selected.has(instance.uid)),
    changedSlots,
  };
}

/** 返回克制目标所需的攻击元素；无属性关卡没有推荐元素。 */
export function counterElementForStage(defender: Element): Exclude<Element, 'none'> | null {
  if (defender === 'none') return null;
  for (const element of ['fire', 'ice', 'thunder'] as const) {
    if (ELEMENT_BEATS[element] === defender) return element;
  }
  throw new Error(`[元素配置错误] 找不到克制 ${defender} 的攻击元素`);
}

/**
 * 为目标关卡规划自动切装。当前武器已经克制时保持玩家选择；否则按预设 1→3 稳定查找。
 */
export function planAutomaticEquipmentPreset(
  input: Omit<EquipmentPresetPlanInput, 'preset'> & {
    presets: readonly EquipmentPreset[];
    defenderElement: Element;
  },
): AutomaticEquipmentPresetPlan {
  const counterElement = counterElementForStage(input.defenderElement);
  if (!counterElement) return { status: 'not-needed', reason: 'untyped-stage' };

  const currentWeapon = input.equipped.weapon;
  if (currentWeapon) {
    const definition = input.definitionOf(currentWeapon.defId);
    if (!definition) throw new Error(`[配置错误] 当前武器找不到定义：${currentWeapon.defId}`);
    if (definition.slot !== 'weapon') {
      throw new Error(`[存档错误] ${currentWeapon.uid} 不是武器却穿在 weapon 槽`);
    }
    if (definition.element === counterElement) {
      return { status: 'not-needed', reason: 'already-countering' };
    }
  }

  const ownedByUid = new Map<string, EquipmentInstance>();
  for (const instance of input.bagEquipment) ownedByUid.set(instance.uid, instance);
  for (const slot of SLOT_ORDER) {
    const instance = input.equipped[slot];
    if (instance) ownedByUid.set(instance.uid, instance);
  }

  const orderedPresets = [...input.presets].sort(
    (a, b) => EQUIPMENT_PRESET_IDS.indexOf(a.id) - EQUIPMENT_PRESET_IDS.indexOf(b.id),
  );
  const preset = orderedPresets.find((candidate) => {
    if (candidate.classId !== input.classId) return false;
    const weaponUid = candidate.equipmentUids.weapon;
    if (!weaponUid) return false;
    const weapon = ownedByUid.get(weaponUid);
    if (!weapon) throw new Error(`[存档错误] 预设 ${candidate.id} 引用了不存在的武器 ${weaponUid}`);
    const definition = input.definitionOf(weapon.defId);
    if (!definition) throw new Error(`[配置错误] 装备预设找不到定义：${weapon.defId}`);
    if (definition.slot !== 'weapon') {
      throw new Error(`[存档错误] 预设 ${candidate.id} 的 weapon 槽保存了 ${definition.slot} 装备`);
    }
    return definition.element === counterElement;
  });
  if (!preset) return { status: 'not-found', counterElement };

  const plan = planEquipmentPreset({ ...input, preset });
  if (!plan.ok) return { status: 'blocked', preset, failure: plan };
  return { status: 'ready', counterElement, preset, plan };
}

function emptyEquippedLoadout(): EquippedLoadout {
  return {
    weapon: null,
    head: null,
    body: null,
    necklace: null,
    bracelet: null,
    ring: null,
    belt: null,
    shoes: null,
  };
}
