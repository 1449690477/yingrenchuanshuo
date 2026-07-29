import { createSSRApp, h } from 'vue';
import { renderToString } from 'vue/server-renderer';
import { describe, expect, it, vi } from 'vitest';
import type { EquipmentInstance } from '@/core/types';
import EquipDetail from '../EquipDetail.vue';

vi.mock('@/stores/inventory', () => ({
  useInventoryStore: () => ({
    equipped: null,
    contributionCp: () => 0,
    cpDelta: () => 0,
    equip: vi.fn(),
    unequip: vi.fn(),
    decompose: vi.fn(),
    toggleLock: vi.fn(),
  }),
}));

vi.mock('@/stores/player', () => ({
  usePlayerStore: () => ({
    player: {
      level: 99,
      classId: 'witch',
    },
  }),
}));

function instance(defId: string): EquipmentInstance {
  return {
    uid: `detail-${defId}`,
    defId,
    enhance: 0,
    baseRollPermille: 1000,
    enhanceGainPermille: Array.from({ length: 15 }, () => 0),
    enhanceLuck: {},
    affixes: [],
    reforgeResonance: 0,
    locked: false,
  };
}

async function render(defId: string): Promise<string> {
  return renderToString(
    createSSRApp({
      render: () => h(EquipDetail, { inst: instance(defId), from: 'bag' }),
    }),
  );
}

describe('装备详情的武器元素来源', () => {
  it('明确展示真实炎武器与无属性武器', async () => {
    expect(await render('eq_r2_weapon_fine')).toContain('炎属性武器');
    expect(await render('eq_r1_weapon_common')).toContain('无属性武器');
  });

  it('非武器不渲染武器元素标签', async () => {
    const html = await render('eq_r2_ring_fine');
    expect(html).not.toContain('属性武器');
  });
});
