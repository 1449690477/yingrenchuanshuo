import type { EquipmentDef } from '@/core/types';
import { BOUTIQUE_THEMES } from '@/data/boutique';
import { requireEquipmentAppearance } from '@/data/characterAppearance';
import { SLOT_LABELS } from '@/data/constants';

export interface EquipmentVisualPresentation {
  label: '专属视觉' | '系列演出' | '外观说明';
  copy: string;
  note: string;
  hasIndependentLayer: boolean;
}

/**
 * 统一商店与背包详情里的玩家可见外观口径。
 *
 * `uniqueEffect` 是内容文案，不等于该件装备已经拥有独立纸娃娃层或逐件机制。
 * UI 必须先看真实 appearance 合同，禁止把 slot-only 商品描述成“穿上立刻出现”。
 */
export function equipmentVisualPresentation(definition: EquipmentDef): EquipmentVisualPresentation {
  const appearance = requireEquipmentAppearance(definition.appearanceId);
  if (appearance.renderMode !== 'slot-only') {
    const includedSlots = appearance.replacementIncludes
      ?.map((slot) => SLOT_LABELS[slot])
      .join('、');
    return {
      label: '专属视觉',
      copy: definition.uniqueEffect ?? '装备后会切换对应的纸娃娃外观。',
      note: includedSlots
        ? `固定属性与外观换肤已真实生效；这件整身外观已经包含${includedSlots}，其它装备的同部位外观不会重复叠加。`
        : '固定属性与外观换肤已真实生效；未接入的技能机制不会在这里冒充已完成。',
      hasIndependentLayer: true,
    };
  }

  if (definition.boutiqueTheme) {
    const theme = BOUTIQUE_THEMES[definition.boutiqueTheme];
    return {
      label: '系列演出',
      copy: `${theme.shortName}饰品本身不单独叠加纸娃娃图层；只有当${theme.shortName}是当前穿戴中品阶最高的精品主题时，才启用该系列的角色互动与战斗演出。`,
      note: '本饰品会真实提供属性；试穿人物不会单独显示项链、腕饰、戒指或腰封，混穿更高品阶主题时也不会切换到本系列演出。',
      hasIndependentLayer: false,
    };
  }

  return {
    label: '外观说明',
    copy: `${definition.name}当前没有独立纸娃娃图层。`,
    note: '装备属性会真实生效；资料中的主题描述不代表已经接入逐件外观或额外战斗机制。',
    hasIndependentLayer: false,
  };
}
