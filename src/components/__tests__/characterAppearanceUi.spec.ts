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
  variant?: 'showcase' | 'battle' | 'avatar';
  action?:
    'idle' | 'attack' | 'cast' | 'react' | 'dash' | 'flurry' | 'spin' | 'counter' | 'victory';
  reduceMotion?: boolean;
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

  it('樱酱战斗态挂载专属动作特效层，且不挂喵喵特效层', async () => {
    const html = await render({
      classId: 'kenshi',
      level: 30,
      equipped: emptyEquipped(),
      variant: 'battle',
      action: 'dash',
    });

    expect(html).toContain('class-kenshi');
    expect(html).toContain('action-dash');
    expect(html).toContain('kenshi-motion-fx');
    expect(html).toContain('kenshi-blade-arc');
    expect(html).toContain('kenshi-frost-seal');
    expect(html).not.toContain('catkin-motion-fx');
    expect(html).toContain('modular/kenshi/base.png');
  });

  it('樱酱穿区域衣装时以完整 body 替换底模，不再叠加第二个人物', async () => {
    const equipped = emptyEquipped();
    equipped.body = instance('eq_r1_body_rare');
    equipped.head = instance('eq_r1_head_common');
    equipped.weapon = instance('eq_r1_weapon_common');

    const html = await render({ classId: 'kenshi', level: 20, equipped });

    expect(html).not.toContain('modular/kenshi/base.png');
    expect(html).not.toContain('slot-body');
    expect(html).toContain('modular/kenshi/r1-body.png');
    // 2026-08-02 改判：整身图自带成套头饰，头饰层不再叠加（docs/81）。
    expect(html).not.toContain('slot-head');
    expect(html).toContain('slot-weapon');
  });

  it('樱酱圣痕戒指与心虹项链会挂载对应纸娃娃层', async () => {
    const equipped = emptyEquipped();
    equipped.ring = instance('eq_arena_kenshi_blinkbloom-return-ring');
    equipped.necklace = instance('eq_affection_kenshi_blue-bell-swordheart-necklace');

    const html = await render({ classId: 'kenshi', level: 60, equipped });

    expect(html).toContain('slot-ring');
    expect(html).toContain('slot-necklace');
    expect(html).toContain('modular/arena/kenshi/blinkbloom-return-ring.png');
    expect(html).toContain('modular/affection/kenshi/blue-bell-swordheart-necklace.png');
  });
});
