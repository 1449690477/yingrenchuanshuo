import { readFileSync } from 'node:fs';
import { createSSRApp, h } from 'vue';
import { renderToString } from 'vue/server-renderer';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { equipmentAdvancementCost } from '@/core/equipmentAdvancement';
import type { EquipmentInstance } from '@/core/types';
import {
  equipmentAdvancementOption as resolveEquipmentAdvancementOption,
  type EquipmentAdvancementOption,
} from '@/data/equipmentAdvancement';
import { requireEquipment } from '@/data/equipment';
import EquipmentAdvancementPanel from '../EquipmentAdvancementPanel.vue';

const sourceDefinition = requireEquipment('eq_r1_weapon_rare');
const routeOption = resolveEquipmentAdvancementOption(sourceDefinition);
if (!routeOption) throw new Error('[测试配置错误] r1 rare 武器缺少 r2 升阶目标');
const region3FineWeapon = requireEquipment('eq_r3_weapon_fine');
const region34RouteOption = resolveEquipmentAdvancementOption(region3FineWeapon);
if (!region34RouteOption) throw new Error('[测试配置错误] r3 fine 武器缺少 r4 升阶目标');

const inventory = vi.hoisted(() => ({
  bag: {
    items: {
      honey_bee: 23,
      crystal_altar: 4,
    } as Record<string, number>,
    equipment: [] as EquipmentInstance[],
  },
  equipmentAdvancementOption: vi.fn<() => EquipmentAdvancementOption | undefined>(),
  advanceEquipment: vi.fn(),
}));

const player = vi.hoisted(() => ({
  player: {
    level: 120,
    gold: 999_999,
    classId: 'swordsman' as const,
  },
}));

vi.mock('@/stores/inventory', () => ({
  useInventoryStore: () => inventory,
}));

vi.mock('@/stores/player', () => ({
  usePlayerStore: () => player,
}));

function makeInstance(overrides: Partial<EquipmentInstance> = {}): EquipmentInstance {
  return {
    uid: 'advancement-ui-source',
    defId: sourceDefinition.id,
    enhance: 7,
    baseRollPermille: 1080,
    enhanceGainPermille: Array.from({ length: 15 }, (_, index) => index + 1),
    enhanceLuck: { 8: 2 },
    affixes: [
      { key: 'atk', tier: 3, value: 18 },
      { key: 'critRate', tier: 2, value: 2.4 },
    ],
    reforgeResonance: 9,
    locked: true,
    ...overrides,
  };
}

async function renderPanel(inst = makeInstance()): Promise<string> {
  return renderToString(
    createSSRApp({
      render: () => h(EquipmentAdvancementPanel, { inst }),
    }),
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  inventory.equipmentAdvancementOption.mockReturnValue(routeOption);
  inventory.bag.items = {
    honey_bee: 23,
    crystal_altar: 4,
  };
  player.player.level = 120;
  player.player.gold = 999_999;
});

describe('跨区装备升阶移动端面板', () => {
  it('用真实路线展示旧装、目标、穿戴条件和三项实际成本', async () => {
    const html = await renderPanel();
    const cost = equipmentAdvancementCost(routeOption.target, routeOption.requirement);

    expect(html).toContain(sourceDefinition.name);
    expect(html).toContain(routeOption.target.name);
    expect(html).toContain(`Lv${routeOption.target.level}`);
    expect(html).toContain('蜂娘蜜');
    expect(html).toContain('祭坛结晶');
    expect(html).toContain('23 / 15');
    expect(html).toContain('4 / 3');
    expect(html).toContain(String(cost.gold));
    expect(html).toContain('确认升阶');
  });

  it('明确展示会保留的强化、词条、共鸣与分解锁', async () => {
    const html = await renderPanel();

    expect(html).toContain('原样保留投入');
    expect(html).toContain('强化 +7');
    expect(html).toContain('2 条现有词条');
    expect(html).toContain('洗练共鸣 9');
    expect(html).toContain('分解保护已锁定');
    expect(html).toContain('不会重掷词条');
  });

  it('权威元素数据明确变化时提示炎属性武器升阶为无属性', async () => {
    inventory.equipmentAdvancementOption.mockReturnValue(region34RouteOption);

    const html = await renderPanel(makeInstance({ defId: region3FineWeapon.id }));

    expect(html).toContain('基础攻击属性变化');
    expect(html).toContain('炎属性');
    expect(html).toContain('无属性');
    expect(html).toContain('升阶后采用目标武器的基础攻击属性');
    expect(html).toContain('强化、洗练与现有词条仍原样保留');
  });

  it('等级或材料不足时显示真实缺口并禁用确认', async () => {
    player.player.level = routeOption.target.level - 1;
    let html = await renderPanel();
    expect(html).toContain(`角色达到 Lv${routeOption.target.level}`);
    expect(html).toMatch(/<button[^>]*confirm-button[^>]*disabled/);

    player.player.level = 120;
    inventory.bag.items.honey_bee = 2;
    html = await renderPanel();
    expect(html).toContain('蜂娘蜜不足，还差 13');
    expect(html).toMatch(/<button[^>]*confirm-button[^>]*disabled/);
  });

  it('待确认洗练候选是硬锁，不会用一条模糊的材料不足掩盖', async () => {
    inventory.bag.items.honey_bee = 0;
    const html = await renderPanel(
      makeInstance({
        pendingAffixChange: {
          operation: 'reforge',
          affixIndex: 0,
          candidate: { key: 'def', tier: 4, value: 28 },
        },
      }),
    );

    expect(html).toContain('有待确认的洗练候选');
    expect(html).not.toContain('蜂娘蜜不足，还差 15');
    expect(html).toMatch(/<button[^>]*confirm-button[^>]*disabled/);
  });

  it('没有同品质目标时明确说明原因，绝不暗中改变品质', async () => {
    inventory.equipmentAdvancementOption.mockReturnValue(undefined);
    const html = await renderPanel();

    expect(html).toContain('暂无同品质目标');
    expect(html).toContain('不会自动改变品质');
    expect(html).toContain('下一地区没有同部位、同品质目标');
  });

  it('接线锁定来源快照、防重复提交、焦点约束和减弱动效', () => {
    const panelSource = readFileSync(
      new URL('../EquipmentAdvancementPanel.vue', import.meta.url),
      'utf8',
    );
    const bagSource = readFileSync(new URL('../../views/BagView.vue', import.meta.url), 'utf8');

    expect(panelSource).toContain('const expectedSourceDefId = props.inst.defId');
    expect(panelSource).toContain(
      'await inventory.advanceEquipment(props.inst.uid, expectedSourceDefId)',
    );
    expect(panelSource).toContain("case 'source-changed'");
    expect(panelSource).toContain("case 'persistence-pending'");
    expect(panelSource).toContain("case 'persistence-conflict'");
    expect(panelSource).toContain("case 'persistence-failed'");
    expect(panelSource).toContain('createFocusTrap(sheet');
    expect(panelSource).toContain('escapeDeactivates: () => !submitting.value');
    expect(panelSource).toContain('clickOutsideDeactivates: () => !submitting.value');
    expect(panelSource).toContain('if (submitting.value) return');
    expect(panelSource).toContain(':aria-busy="submitting"');
    expect(panelSource).toContain('returnFocusOnDeactivate: true');
    expect(panelSource).toContain('@media (prefers-reduced-motion: reduce)');
    expect(panelSource).toContain('.confirm-button:active:not(:disabled)');

    expect(bagSource).toContain('class="advance-quick"');
    expect(bagSource).toContain('v-if="row.canAdvance"');
    expect(bagSource).toContain('resolveEquipmentAdvancementOption(def)');
    expect(bagSource).toContain("class=\"{ 'has-advance': row.canAdvance }\"");
    expect(bagSource).toContain('<EquipmentAdvancementPanel');
    expect(bagSource).toContain('@upgraded="onEquipmentUpgraded"');
  });
});
