import { createSSRApp, h } from 'vue';
import { renderToString } from 'vue/server-renderer';
import { describe, expect, it } from 'vitest';
import type { ClassId, EquipmentInstance } from '@/core/types';
import { ENHANCE_MAX } from '@/data/constants';
import type { EquippedRecord } from '@/data/characterAppearance';
import CharacterAppearance from '../CharacterAppearance.vue';

function instance(defId: string): EquipmentInstance {
  return {
    uid: `test-${defId}`,
    defId,
    enhance: 0,
    baseRollPermille: 1000,
    enhanceGainPermille: Array.from({ length: ENHANCE_MAX }, () => 0),
    enhanceLuck: {},
    affixes: [],
    reforgeResonance: 0,
    locked: false,
  };
}

const emptyEquipped = (): EquippedRecord => ({
  weapon: null,
  head: null,
  body: null,
  necklace: null,
  bracelet: null,
  ring: null,
  belt: null,
  shoes: null,
});

interface AppearanceTestProps {
  classId: ClassId;
  level: number;
  equipped?: EquippedRecord | null;
}

async function render(props: AppearanceTestProps) {
  const app = createSSRApp(h(CharacterAppearance, props));
  return renderToString(app);
}

describe('角色换装组件的图层标记', () => {
  it('喵喵试穿精品店帽子时帽层带 above-face 标记，压到安全脸层之上', async () => {
    const equipped = emptyEquipped();
    equipped.head = instance('eq_shop_rose-night_head');

    const html = await render({ classId: 'catkin', level: 20, equipped });

    expect(html).toContain('slot-head');
    expect(html).toContain('above-face');
  });

  it('区域草帽未声明提层，喵喵戴上仍压在安全脸层后方', async () => {
    const equipped = emptyEquipped();
    equipped.head = instance('eq_r2_head_fine');

    const html = await render({ classId: 'catkin', level: 20, equipped });

    expect(html).toContain('slot-head');
    expect(html).not.toContain('above-face');
  });

  it('装备可见鞋层时底模与脸层都换用无靴底图', async () => {
    const equipped = emptyEquipped();
    equipped.shoes = instance('eq_shop_moon-sugar_shoes');

    const html = await render({ classId: 'shaman', level: 20, equipped });

    expect(html).toContain('base-noshoes.png');
    expect(html).not.toContain('modular/shaman/base.png');
  });

  it('未装备鞋层时继续使用原始底模', async () => {
    const html = await render({ classId: 'shaman', level: 20, equipped: emptyEquipped() });

    expect(html).toContain('modular/shaman/base.png');
    expect(html).not.toContain('base-noshoes.png');
  });
});
