import { createSSRApp, h } from 'vue';
import { renderToString } from 'vue/server-renderer';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ActiveEquipmentSet } from '@/core/equipmentSets';
import type { EquipSlot, EquipmentInstance } from '@/core/types';
import { equipmentAdvancementOption as resolveEquipmentAdvancementOption } from '@/data/equipmentAdvancement';
import { requireEquipment } from '@/data/equipment';
import { REGION_CRIMSON_SET } from '@/data/regionEquipmentSets';
import EquipDetail from '../EquipDetail.vue';

const inventory = vi.hoisted(() => ({
  equipped: null as Partial<Record<EquipSlot, EquipmentInstance | null>> | null,
  contributionCp: vi.fn(() => 0),
  cpDelta: vi.fn(() => 0),
  currentScore: vi.fn((_item: EquipmentInstance) => 128),
  baseScore: vi.fn((_item: EquipmentInstance) => 96),
  equip: vi.fn(),
  unequip: vi.fn(),
  decompose: vi.fn(),
  toggleLock: vi.fn(),
  equipmentAdvancementOption: vi.fn(),
}));

const playerStore = vi.hoisted(() => ({
  player: {
    level: 99,
    classId: 'witch' as const,
  },
  equipmentSetResolution: {
    sets: [] as ActiveEquipmentSet[],
  },
}));

vi.mock('@/stores/inventory', () => ({
  useInventoryStore: () => inventory,
}));

vi.mock('@/stores/player', () => ({
  usePlayerStore: () => playerStore,
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
  inventory.equipped = null;
  inventory.cpDelta.mockReturnValue(0);
  inventory.currentScore.mockReturnValue(128);
  inventory.baseScore.mockReturnValue(96);
  playerStore.equipmentSetResolution.sets = [];
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

  it('分别展示包含强化的当前评分与统一按 +0 计算的装备底子', async () => {
    const html = await render('eq_r2_weapon_fine');
    expect(html).toContain('当前评分');
    expect(html).toContain('装备底子');
    expect(html).toContain('统一按 +0 比较');
  });

  it('强化旧装当前更强但新装底子更好时，同时给出真实换装结果与培养提示', async () => {
    const worn = instance('eq_r1_weapon_common');
    worn.enhance = 9;
    worn.enhanceGainPermille = [
      ...Array<number>(9).fill(82),
      ...Array<number>(6).fill(0),
    ];
    inventory.equipped = { weapon: worn };
    inventory.cpDelta.mockReturnValue(-240);
    inventory.baseScore.mockImplementation((item) => (item.uid === worn.uid ? 70 : 96));

    const html = await render('eq_r2_weapon_fine');
    expect(html).toContain('立即换装战力');
    expect(html).toContain('的 +0 底子');
    expect(html).toContain('当前穿戴含 +9 强化投入');
    expect(html).toContain('建议先锁定并培养');
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

  it('绯焰件详情展示当前穿戴进度和真实 2/4/6 件效果，未穿戴时也不隐藏来源', async () => {
    playerStore.equipmentSetResolution.sets = [
      {
        definition: REGION_CRIMSON_SET,
        equippedPieces: 2,
        activeBonuses: REGION_CRIMSON_SET.bonuses.slice(0, 1),
        nextBonus: REGION_CRIMSON_SET.bonuses[1]!,
      },
    ];

    const html = await render('eq_set_region_crimson_weapon');
    expect(html).toContain('绯焰套');
    expect(html).toContain('攻击 +8%');
    expect(html).toContain('暴击率 +6%，炎属性伤害 +12%');
    expect(html).toContain('15% 概率追加 120% 攻击力');
    expect(html).toContain('再穿 2 件');
  });
});
