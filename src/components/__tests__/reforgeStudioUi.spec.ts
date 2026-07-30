import { createSSRApp, h, type Component } from 'vue';
import { renderToString } from 'vue/server-renderer';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { EquipmentInstance } from '@/core/types';
import { EQUIPMENT } from '@/data/equipment';
import ReforgeStudio from '../reforge/ReforgeStudio.vue';

const inventory = vi.hoisted(() => ({
  bag: {
    items: {} as Record<string, number>,
    equipment: [] as EquipmentInstance[],
  },
  equipped: null as Record<string, EquipmentInstance | null> | null,
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
  uidSuffix = '',
): EquipmentInstance {
  return {
    uid: `ui-${defId}${uidSuffix}`,
    defId,
    enhance: 0,
    baseRollPermille: 1000,
    enhanceGainPermille: Array.from({ length: 15 }, () => 0),
    enhanceLuck: {},
    affixes,
    reforgeResonance: 8,
    ...(pendingAffixChange ? { pendingAffixChange } : {}),
    locked: false,
  };
}

async function render(component: Component, props: Record<string, unknown> = {}): Promise<string> {
  return renderToString(createSSRApp({ render: () => h(component, props) }));
}

beforeEach(() => {
  vi.clearAllMocks();
  inventory.bag.equipment = [];
  inventory.equipped = null;
  player.player.level = 20;
});

describe('星辉洗练坊独立界面', () => {
  it('首推横幅展示推荐装备、建议操作与一键选用', async () => {
    inventory.bag.equipment = [
      instance(randomDefinition.id, [
        { key: 'skillMul', tier: 2, value: 2 },
        { key: 'atk', tier: 3, value: 15 },
      ]),
    ];

    const html = await render(ReforgeStudio);

    expect(html).toContain('advisor-banner');
    expect(html).toContain('洗练推荐');
    expect(html).toContain(randomDefinition.name);
    expect(html).toContain('先换掉');
    expect(html).toContain('死词条');
    expect(html).toContain('按推荐选用');
  });

  it('装备轨按建议优先级排序，并给出评分徽章与建议小标', async () => {
    inventory.bag.equipment = [
      instance(
        randomDefinition.id,
        [
          { key: 'atk', tier: 5, value: 25 },
          { key: 'def', tier: 5, value: 25 },
          { key: 'hp', tier: 5, value: 25 },
        ],
        undefined,
        '-good',
      ),
      // 死词条放在非职业槽（史诗职业槽 = 最后一条），推荐重铸
      instance(
        randomDefinition.id,
        [
          { key: 'skillMul', tier: 1, value: 1 },
          { key: 'atk', tier: 3, value: 15 },
        ],
        undefined,
        '-dead',
      ),
    ];

    const html = await render(ReforgeStudio);

    expect(html).toContain('gear-card');
    expect(html).toContain('gear-grade');
    // 只有带死词条的装备挂建议小标；全 T5 装备不给建议
    expect(html.match(/建议重铸/g)).toHaveLength(1);
    // 首推横幅指向带死词条的装备，其卡片排在轨道最前
    expect(html).toContain('先换掉');
    expect(html.indexOf('建议重铸')).toBeLessThan(
      html.indexOf('-good') === -1 ? Infinity : html.indexOf('-good'),
    );
  });

  it('全部装备词条组良好时显示安抚横幅，不出现选用按钮', async () => {
    inventory.bag.equipment = [
      instance(randomDefinition.id, [
        { key: 'atk', tier: 5, value: 25 },
        { key: 'wit_elem', tier: 5, value: 13.6, element: 'ice' },
        { key: 'def', tier: 5, value: 25 },
      ]),
    ];

    const html = await render(ReforgeStudio);

    expect(html).toContain('词条组状态良好');
    expect(html).not.toContain('按推荐选用');
  });

  it('洗练台展示四种操作、共鸣条与词条行', async () => {
    inventory.bag.equipment = [
      instance(randomDefinition.id, [
        { key: 'atk', tier: 2, value: 12 },
        { key: 'def', tier: 3, value: 18 },
      ]),
    ];

    const html = await render(ReforgeStudio);

    expect(html).toContain('重铸');
    expect(html).toContain('淬炼');
    expect(html).toContain('铭刻');
    expect(html).toContain('同调');
    expect(html).toContain('共鸣值');
    expect(html).toContain('8 / 20');
    // 这组词条（T2/T3）的建议是同调，操作台开局就跟着建议走
    expect(html).toContain('已选择');
    expect(html).toContain('同调一次');
  });

  it('开局操作台与首推一致：建议随机操作时进入随机模式', async () => {
    inventory.bag.equipment = [
      instance(randomDefinition.id, [
        // 待开放的死词条（技能倍率待 M3-4 结算）→ 建议重铸（随机操作）
        { key: 'skillMul', tier: 2, value: 18 },
        { key: 'atk', tier: 1, value: 8 },
      ]),
    ];

    const html = await render(ReforgeStudio);

    // 卡片写着「建议重铸」而页签停在别的操作，玩家点下去就会做错操作还扣材料
    expect(html).toContain('建议重铸');
    expect(html).toContain('参与随机');
    expect(html).toContain('重铸一次');
  });

  it('随机操作会提示洗掉好词条的概率', async () => {
    inventory.bag.equipment = [
      instance(randomDefinition.id, [
        // 一条 T5 + 两条低阶：随机操作有三分之一概率把 T5 洗掉
        { key: 'atk', tier: 5, value: 40 },
        { key: 'skillMul', tier: 1, value: 1 },
        { key: 'wit_power', tier: 1, value: 8 },
      ]),
    ];

    const html = await render(ReforgeStudio);

    expect(html).toContain('data-testid="protect-warn"');
    expect(html).toContain('33%');
    expect(html).toContain('定契保护');
  });

  it('已付费候选优先展示新旧对比与采用/保留选择', async () => {
    inventory.bag.equipment = [
      instance(randomDefinition.id, [{ key: 'atk', tier: 2, value: 12 }], {
        operation: 'reforge',
        affixIndex: 0,
        candidate: { key: 'def', tier: 4, value: 22 },
      }),
    ];

    const html = await render(ReforgeStudio);

    expect(html).toContain('洗练结果已保留在存档');
    expect(html).toContain('原词条');
    expect(html).toContain('新候选');
    expect(html).toContain('保留原词条');
    expect(html).toContain('替换为新词条');
    // 待决期间不渲染操作台
    expect(html).not.toContain('重铸一次');
  });

  it('调用方指定 UID 时优先打开该装备及其待确认候选', async () => {
    const recommended = instance(
      randomDefinition.id,
      [
        { key: 'skillMul', tier: 1, value: 1 },
        { key: 'atk', tier: 1, value: 8 },
      ],
      undefined,
      '-recommended',
    );
    const requested = instance(
      randomDefinition.id,
      [{ key: 'atk', tier: 2, value: 12 }],
      {
        operation: 'reforge',
        affixIndex: 0,
        candidate: { key: 'def', tier: 4, value: 22 },
      },
      '-requested',
    );
    inventory.bag.equipment = [recommended, requested];

    const html = await render(ReforgeStudio, { initialUid: requested.uid });

    expect(html).toContain('洗练结果已保留在存档');
    expect(html).toContain('替换为新词条');
    expect(html).not.toContain('重铸一次');
  });
  it('等级不足时提示解锁条件，不渲染推荐与装备轨', async () => {
    player.player.level = 5;
    inventory.bag.equipment = [
      instance(randomDefinition.id, [{ key: 'skillMul', tier: 2, value: 2 }]),
    ];

    const html = await render(ReforgeStudio);

    expect(html).toContain('Lv12');
    expect(html).toContain('洗练坊才会开张');
    expect(html).not.toContain('gear-card');
  });

  it('没有可洗练装备时显示空态引导', async () => {
    inventory.bag.equipment = [instance(fixedDefinition.id, [])];

    const html = await render(ReforgeStudio);

    expect(html).toContain('还没有带随机词条的装备');
    expect(html).not.toContain('gear-card');
  });
});
