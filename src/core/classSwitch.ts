import type { ClassId, EquipmentDef, EquipmentInstance, EquipSlot } from './types';

export type EquippedLoadout = Record<EquipSlot, EquipmentInstance | null>;

export interface ClassSwitchInput {
  currentClassId: ClassId;
  targetClassId: ClassId;
  equipped: Readonly<EquippedLoadout>;
  bagEquipment: readonly EquipmentInstance[];
  definitionOf: (defId: string) => EquipmentDef | undefined;
}

export interface MovedClassEquipment {
  slot: EquipSlot;
  instance: EquipmentInstance;
  newlyLocked: boolean;
}

export type ClassSwitchPlan =
  | { ok: false; reason: 'same-class' }
  | {
      ok: true;
      equipped: EquippedLoadout;
      bagEquipment: EquipmentInstance[];
      movedEquipment: MovedClassEquipment[];
      newlyLockedCount: number;
    };

/**
 * 规划共享进度下的职业切换。
 *
 * 通用装备继续穿戴；与目标职业不兼容的专属装备完整移回背包并锁定。
 * 这里只返回新快照，不改输入、不读存档、不裁剪背包，也不推进随机数。
 */
export function planClassSwitch(input: ClassSwitchInput): ClassSwitchPlan {
  if (input.currentClassId === input.targetClassId) {
    return { ok: false, reason: 'same-class' };
  }

  const equipped = { ...input.equipped };
  const bagEquipment = [...input.bagEquipment];
  const movedEquipment: MovedClassEquipment[] = [];
  let newlyLockedCount = 0;

  for (const [slot, instance] of Object.entries(input.equipped) as [
    EquipSlot,
    EquipmentInstance | null,
  ][]) {
    if (!instance) continue;

    const definition = input.definitionOf(instance.defId);
    if (!definition) {
      throw new Error(`[配置错误] 切换职业时找不到装备定义：${instance.defId}`);
    }
    if (definition.slot !== slot) {
      throw new Error(`[存档错误] 装备 ${instance.uid} 属于 ${definition.slot}，却穿在 ${slot} 槽`);
    }
    if (!definition.classId || definition.classId === input.targetClassId) continue;

    const newlyLocked = !instance.locked;
    const safeInstance = newlyLocked ? { ...instance, locked: true } : instance;
    equipped[slot] = null;
    bagEquipment.push(safeInstance);
    movedEquipment.push({ slot, instance: safeInstance, newlyLocked });
    if (newlyLocked) newlyLockedCount += 1;
  }

  return {
    ok: true,
    equipped,
    bagEquipment,
    movedEquipment,
    newlyLockedCount,
  };
}
