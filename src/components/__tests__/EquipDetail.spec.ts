import { createSSRApp, h } from 'vue';
import { renderToString } from 'vue/server-renderer';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { EquipmentInstance } from '@/core/types';
import { equipmentAdvancementOption as resolveEquipmentAdvancementOption } from '@/data/equipmentAdvancement';
import { requireEquipment } from '@/data/equipment';
import EquipDetail from '../EquipDetail.vue';

const inventory = vi.hoisted(() => ({
  equipped: null,
  contributionCp: vi.fn(() => 0),
  cpDelta: vi.fn(() => 0),
  equip: vi.fn(),
  unequip: vi.fn(),
  decompose: vi.fn(),
  toggleLock: vi.fn(),
  equipmentAdvancementOption: vi.fn(),
}));

vi.mock('@/stores/inventory', () => ({
  useInventoryStore: () => inventory,
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

async function render(
  defId: string,
  from: 'bag' | 'equipped' = 'bag',
): Promise<string> {
  return renderToString(
    createSSRApp({
      render: () => h(EquipDetail, { inst: instance(defId), from }),
    }),
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  inventory.equipmentAdvancementOption.mockReturnValue(undefined);
});

describe('装备详情的武器元素来源', () => {
  it('明确展示真实炎武器与无属性武器', async () => {
    expect(await render('eq_r2_weapon_fine')).toContain('炎属性武器');
    expect(await render('eq_r1_weapon_common')).toContain('无属性武器');
  });

  it('非武器不渲染武器元素标签', async () => {
    const html = await render('eq_r2_ring_fine');
    expect(html).not.toContain('属性武器');
  });

  it('背包与穿戴详情都从同一路线接口展示升阶入口，无路线时不展示', async () => {
    const route = resolveEquipmentAdvancementOption(requireEquipment('eq_r1_weapon_rare'));
    if (!route) throw new Error('[测试配置错误] r1 rare 武器缺少升阶路线');
    inventory.equipmentAdvancementOption.mockReturnValue(route);

    expect(await render('eq_r1_weapon_rare', 'bag')).toContain('跨区升阶');
    expect(await render('eq_r1_weapon_rare', 'equipped')).toContain('跨区升阶');

    inventory.equipmentAdvancementOption.mockReturnValue(undefined);
    expect(await render('eq_r1_weapon_common', 'equipped')).not.toContain('跨区升阶');
  });
});
