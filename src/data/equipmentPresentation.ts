import type {
  ClassId,
  EquipmentClassPresentation,
  EquipmentDef,
} from '@/core/types';

/**
 * 解析装备在当前职业下真正展示给玩家的名称与图标。
 *
 * 区域武器的数值与存档共用同一个 defId，但纸娃娃分别使用剑 / 杖 / 扇 / 爪。
 * 因此全职业通用武器必须显式提供四职业表现；缺一项直接报配置错误，禁止
 * 回落到“随便拿一把剑”的旧主流程。
 */
export function equipmentPresentation(
  definition: EquipmentDef,
  classId: ClassId,
): EquipmentClassPresentation {
  if (definition.classId && definition.classId !== classId) {
    throw new Error(
      `[配置错误] ${definition.id} 只属于 ${definition.classId}，不能按 ${classId} 展示`,
    );
  }

  if (definition.slot === 'weapon' && !definition.classId) {
    const presentation = definition.classPresentations?.[classId];
    if (!presentation) {
      throw new Error(`[配置错误] 通用武器 ${definition.id} 缺少 ${classId} 职业表现`);
    }
    return presentation;
  }

  if (definition.classPresentations) {
    throw new Error(`[配置错误] 非通用武器 ${definition.id} 不应登记职业表现`);
  }

  return {
    name: definition.name,
    icon: definition.icon,
  };
}

/**
 * 解析背包、强化、洗练等跨职业装备容器里的玩家可见表现。
 *
 * 通用武器跟随当前职业展示；职业专属装备即使因职业切换留在背包，也必须
 * 继续展示它自身所属职业的名称和图标。这里显式选择展示职业，再交给上面的
 * 严格解析器校验，不吞掉缺配置或错误配置。
 */
export function equipmentDisplayPresentation(
  definition: EquipmentDef,
  activeClassId: ClassId,
): EquipmentClassPresentation {
  return equipmentPresentation(definition, definition.classId ?? activeClassId);
}
