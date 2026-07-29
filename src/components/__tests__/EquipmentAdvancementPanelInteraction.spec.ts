// @vitest-environment jsdom

import { createApp, h, nextTick, type App } from 'vue';
import { afterEach, beforeEach, describe, expect, it, vi, type Mock } from 'vitest';
import type { EquipmentInstance } from '@/core/types';
import {
  equipmentAdvancementOption as resolveEquipmentAdvancementOption,
  type EquipmentAdvancementOption,
} from '@/data/equipmentAdvancement';
import { requireEquipment } from '@/data/equipment';
import { equipmentDisplayPresentation } from '@/data/equipmentPresentation';
import EquipmentAdvancementPanel from '../EquipmentAdvancementPanel.vue';

const resolvedRoute = resolveEquipmentAdvancementOption(requireEquipment('eq_r1_weapon_rare'));
if (!resolvedRoute) throw new Error('[测试配置错误] r1 rare 武器缺少 r2 升阶目标');
const route: EquipmentAdvancementOption = resolvedRoute;

const inventory = vi.hoisted(() => ({
  bag: {
    items: {
      honey_bee: 20,
      crystal_altar: 5,
    } as Record<string, number>,
  },
  equipmentAdvancementOption: vi.fn(),
  advanceEquipment: vi.fn(),
}));

const player = vi.hoisted(() => ({
  player: {
    level: 120,
    gold: 10_000,
    classId: 'swordsman' as const,
  },
}));

vi.mock('@/stores/inventory', () => ({
  useInventoryStore: () => inventory,
}));

vi.mock('@/stores/player', () => ({
  usePlayerStore: () => player,
}));

function makeInstance(): EquipmentInstance {
  return {
    uid: 'advancement-interaction',
    defId: route.source.id,
    enhance: 3,
    baseRollPermille: 1020,
    enhanceGainPermille: Array.from({ length: 15 }, () => 0),
    enhanceLuck: {},
    affixes: [{ key: 'atk', tier: 3, value: 18 }],
    reforgeResonance: 0,
    locked: false,
  };
}

async function flushUi(): Promise<void> {
  await Promise.resolve();
  await nextTick();
}

describe('跨区升阶面板耐久提交交互', () => {
  let app: App<Element> | null = null;
  let host: HTMLDivElement | null = null;
  let instance: EquipmentInstance;
  let onClose: Mock<() => void>;
  let onUpgraded: Mock<(result: { targetName: string; cpDelta: number }) => void>;

  beforeEach(async () => {
    vi.clearAllMocks();
    inventory.equipmentAdvancementOption.mockReturnValue(route);
    inventory.bag.items = { honey_bee: 20, crystal_altar: 5 };
    player.player.level = 120;
    player.player.gold = 10_000;
    instance = makeInstance();
    onClose = vi.fn<() => void>();
    onUpgraded = vi.fn<(result: { targetName: string; cpDelta: number }) => void>();
    host = document.createElement('div');
    document.body.append(host);
    app = createApp({
      render: () =>
        h(EquipmentAdvancementPanel, {
          inst: instance,
          onClose,
          onUpgraded,
        }),
    });
    app.mount(host);
    await flushUi();
  });

  afterEach(() => {
    app?.unmount();
    app = null;
    host?.remove();
    host = null;
    document.body.innerHTML = '';
  });

  it('Promise 未完成前不报成功、不可双击且关闭/Esc/外侧点击都被锁住', async () => {
    let finishWrite: ((result: unknown) => void) | undefined;
    inventory.advanceEquipment.mockReturnValueOnce(
      new Promise((resolve) => {
        finishWrite = resolve;
      }),
    );

    const confirm = document.body.querySelector<HTMLButtonElement>('.confirm-button');
    const close = document.body.querySelector<HTMLButtonElement>('.close-button');
    const sheet = document.body.querySelector<HTMLElement>('.advance-sheet');
    const overlay = document.body.querySelector<HTMLElement>('.advance-overlay');
    if (!confirm || !close || !sheet || !overlay) throw new Error('升阶面板未完整挂载');

    confirm.click();
    await flushUi();

    expect(inventory.advanceEquipment).toHaveBeenCalledTimes(1);
    expect(onUpgraded).not.toHaveBeenCalled();
    expect(sheet.getAttribute('aria-busy')).toBe('true');
    expect(close.disabled).toBe(true);
    expect(confirm.textContent).toContain('正在安全写入');

    confirm.click();
    close.click();
    overlay.click();
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    await flushUi();
    expect(inventory.advanceEquipment).toHaveBeenCalledTimes(1);
    expect(onClose).not.toHaveBeenCalled();

    finishWrite!({
      ok: true,
      equipment: instance,
      wallet: { gold: 6_400, items: { honey_bee: 5, crystal_altar: 2 } },
      cost: {
        gold: 3_600,
        items: { honey_bee: 15, crystal_altar: 3 },
      },
      sourceDefId: route.source.id,
      targetDefId: route.target.id,
      cpDelta: 123,
    });
    await flushUi();

    expect(onUpgraded).toHaveBeenCalledOnce();
    expect(onUpgraded).toHaveBeenCalledWith({
      targetName: equipmentDisplayPresentation(route.target, 'swordsman').name,
      cpDelta: 123,
    });
    expect(sheet.getAttribute('aria-busy')).toBe('false');
    expect(close.disabled).toBe(false);
  });

  it('写盘失败不发成功事件，恢复可关闭与可重试状态并显示零半扣说明', async () => {
    inventory.advanceEquipment.mockResolvedValueOnce({
      ok: false,
      reason: 'persistence-failed',
    });

    const confirm = document.body.querySelector<HTMLButtonElement>('.confirm-button');
    const close = document.body.querySelector<HTMLButtonElement>('.close-button');
    if (!confirm || !close) throw new Error('升阶面板未完整挂载');

    confirm.click();
    await flushUi();

    expect(onUpgraded).not.toHaveBeenCalled();
    expect(document.body.textContent).toContain('金币、材料与装备已全部恢复');
    expect(confirm.disabled).toBe(false);
    expect(close.disabled).toBe(false);
  });
});
