import { createSSRApp, h, type Component } from 'vue';
import { renderToString } from 'vue/server-renderer';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { EquipmentInstance } from '@/core/types';
import { EQUIPMENT } from '@/data/equipment';
import BagView from '@/views/BagView.vue';
import EquipDetail from '../EquipDetail.vue';
import ReforgePanel from '../ReforgePanel.vue';

const inventory = vi.hoisted(() => ({
  bag: {
    items: {} as Record<string, number>,
    equipment: [] as EquipmentInstance[],
  },
  equipped: null,
  contributionCp: vi.fn(() => 128),
  cpDelta: vi.fn(() => 16),
  equip: vi.fn(),
  unequip: vi.fn(),
  decompose: vi.fn(),
  toggleLock: vi.fn(),
  equipBest: vi.fn(() => 0),
  startAffixChange: vi.fn(),
  resolveAffixChange: vi.fn(),
}));

const player = vi.hoisted(() => ({
  player: {
    level: 20,
    gold: 10_000,
    classId: 'witch' as const,
  },
}));

const game = vi.hoisted(() => ({
  currentStage: { chapterId: '1-5' },
}));

vi.mock('@/stores/inventory', () => ({
  useInventoryStore: () => inventory,
}));
vi.mock('@/stores/player', () => ({
  usePlayerStore: () => player,
}));
vi.mock('@/stores/game', () => ({
  useGameStore: () => game,
}));

const definitions = Object.values(EQUIPMENT);
const randomDefinition = definitions.find(
  (definition) => definition.quality === 'epic' && !definition.fixedTemplate,
);
const fixedDefinition = definitions.find((definition) => definition.fixedTemplate);

if (!randomDefinition) throw new Error('[测试配置错误] 缺少可洗练史诗装备');
if (!fixedDefinition) throw new Error('[测试配置错误] 缺少完整固定模板装备');

function instance(
  defId: string,
  affixes: EquipmentInstance['affixes'],
  pendingAffixChange?: EquipmentInstance['pendingAffixChange'],
): EquipmentInstance {
  return {
    uid: `ui-${defId}`,
    defId,
    enhance: 0,
    baseRollPermille: 1000,
    enhanceGainPermille: Array.from({ length: 15 }, () => 0),
    enhanceLuck: {},
    affixes,
    reforgeResonance: pendingAffixChange ? 5 : 20,
    ...(pendingAffixChange ? { pendingAffixChange } : {}),
    locked: false,
  };
}

async function render(component: Component, props: Record<string, unknown>): Promise<string> {
  return renderToString(createSSRApp({ render: () => h(component, props) }));
}

beforeEach(() => {
  vi.clearAllMocks();
  inventory.bag.equipment = [];
});

describe('洗练组件产品红线', () => {
  it('装备详情展示品阶、元素、职业归属与满共鸣，并开放洗练入口', async () => {
    const html = await render(EquipDetail, {
      inst: instance(randomDefinition.id, [
        { key: 'elemDmg', tier: 4, value: 8.5, element: 'fire' },
        { key: 'wit_elem', tier: 5, value: 13.6, element: 'ice' },
      ]),
      from: 'bag',
    });

    expect(html).toContain('T4 卓越');
    expect(html).toContain('属性伤害·炎');
    expect(html).toContain('魔女专属');
    expect(html).toContain('共鸣 20/20');
    expect(html).toContain('词条洗练');
  });

  it('旧档技能倍率仍可严格展示，并明确只能换掉、不能继续养成', async () => {
    const legacy = instance(randomDefinition.id, [{ key: 'skillMul', tier: 3, value: 2.5 }]);
    const detailHtml = await render(EquipDetail, { inst: legacy, from: 'bag' });
    const reforgeHtml = await render(ReforgePanel, { inst: legacy });

    expect(detailHtml).toContain('技能倍率');
    expect(detailHtml).toContain('待 M3-4 技能结算');
    expect(reforgeHtml).toContain('待 M3-4 技能结算');
    expect(reforgeHtml).toContain('通用槽可通过重铸换掉');
    expect(reforgeHtml).toContain('预留职业槽也可通过铭刻换掉');
    expect(reforgeHtml).toContain('淬炼、同调不会继续投入');
  });

  it('通用装备上的其他职业专属词条明确标注当前不生效', async () => {
    const html = await render(EquipDetail, {
      inst: instance(randomDefinition.id, [{ key: 'swd_guard', tier: 3, value: 28 }]),
      from: 'bag',
    });

    expect(html).toContain('剑姬专属');
    expect(html).toContain('当前职业不生效');
  });

  it('完整固定模板明确标注不可洗练，且不渲染洗练入口', async () => {
    const html = await render(EquipDetail, {
      inst: instance(fixedDefinition.id, []),
      from: 'bag',
    });

    expect(html).toContain('完整固定 · 不可洗练');
    expect(html).not.toContain('词条洗练');
  });

  it('已付费候选必须先同时展示原词条与新候选，再给采用或保留选择', async () => {
    const html = await render(ReforgePanel, {
      inst: instance(randomDefinition.id, [{ key: 'atk', tier: 2, value: 12 }], {
        operation: 'reforge',
        affixIndex: 0,
        candidate: { key: 'wit_elem', tier: 4, value: 10.6, element: 'thunder' },
      }),
    });

    expect(html).toContain('洗练结果已保留在存档');
    expect(html).toContain('原词条');
    expect(html).toContain('新候选');
    expect(html).toContain('保留原样');
    expect(html).toContain('采用新词条');
  });

  it('装备详情把待决候选显示为硬保护，不能再手动解锁或分解', async () => {
    const pendingInstance = instance(randomDefinition.id, [{ key: 'atk', tier: 2, value: 12 }], {
      operation: 'reforge',
      affixIndex: 0,
      candidate: { key: 'def', tier: 3, value: 18 },
    });
    const html = await render(EquipDetail, {
      inst: pendingInstance,
      from: 'bag',
    });

    expect(html).toContain('候选保护中');
    expect(html).toMatch(/<button[^>]*disabled[^>]*>[\s\S]*?候选保护中[\s\S]*?<\/button>/);
    expect(html).toMatch(/<button[^>]*disabled[^>]*>[\s\S]*?先确认洗练[\s\S]*?<\/button>/);
  });

  it('背包列表给已付费候选独立角标，但仍沿用原有装备列表', async () => {
    inventory.bag.equipment = [
      instance(randomDefinition.id, [{ key: 'atk', tier: 2, value: 12 }], {
        operation: 'reforge',
        affixIndex: 0,
        candidate: { key: 'def', tier: 3, value: 18 },
      }),
    ];

    const html = await render(BagView, {});

    expect(html).toContain(randomDefinition.name);
    expect(html).toContain('洗练待确认');
    expect(html).toContain('pending-affix-badge');
  });
});
