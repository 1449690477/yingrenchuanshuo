// @vitest-environment jsdom
/* eslint-disable vue/one-component-per-file */

import { createApp, h, nextTick, type App } from 'vue';
import { afterEach, beforeEach, describe, expect, it, vi, type Mock } from 'vitest';
import type { EquipSlot, EquipmentInstance } from '@/core/types';
import { requireEquipment } from '@/data/equipment';
import CrimsonForgePanel from '../CrimsonForgePanel.vue';

const focusTrapState = vi.hoisted(() => ({
  active: false,
  onDeactivate: null as null | (() => void),
}));

vi.mock('focus-trap', () => ({
  createFocusTrap: (_element: HTMLElement, options: { onDeactivate?: () => void }) => {
    focusTrapState.onDeactivate = options.onDeactivate ?? null;
    return {
      get active() {
        return focusTrapState.active;
      },
      activate() {
        focusTrapState.active = true;
      },
      deactivate(overrides?: { onDeactivate?: () => void }) {
        focusTrapState.active = false;
        (overrides?.onDeactivate ?? focusTrapState.onDeactivate)?.();
      },
    };
  },
}));

const inventory = vi.hoisted(() => ({
  bag: {
    items: { frag_crimson: 240 } as Record<string, number>,
    equipment: [] as EquipmentInstance[],
  },
  equipped: {
    weapon: null,
    head: null,
    body: null,
    necklace: null,
    bracelet: null,
    ring: null,
    belt: null,
    shoes: null,
  } as Record<EquipSlot, EquipmentInstance | null>,
  craftEquipmentSetPiece: vi.fn(),
}));

const player = vi.hoisted(() => ({
  player: {
    level: 52,
    classId: 'catkin' as const,
  },
}));

vi.mock('@/stores/inventory', () => ({
  useInventoryStore: () => inventory,
}));

vi.mock('@/stores/player', () => ({
  usePlayerStore: () => player,
}));

function instance(defId: string, uid = defId): EquipmentInstance {
  return {
    uid,
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

async function flushUi(): Promise<void> {
  await Promise.resolve();
  await nextTick();
  await Promise.resolve();
}

describe('绯焰套通用碎片自选重铸面板', () => {
  let app: App<Element> | null = null;
  let host: HTMLDivElement | null = null;
  let onCrafted: Mock<(result: { equipmentName: string; targetSlot: EquipSlot }) => void>;

  beforeEach(async () => {
    vi.clearAllMocks();
    focusTrapState.active = false;
    focusTrapState.onDeactivate = null;
    inventory.bag.items = { frag_crimson: 240 };
    inventory.bag.equipment = [instance('eq_set_region_crimson_weapon', 'owned-weapon')];
    for (const slot of Object.keys(inventory.equipped) as EquipSlot[]) {
      inventory.equipped[slot] = null;
    }
    inventory.equipped.head = instance('eq_set_region_crimson_head', 'equipped-head');
    player.player.level = 52;
    onCrafted = vi.fn();
    host = document.createElement('div');
    document.body.append(host);
    app = createApp({
      render: () => h(CrimsonForgePanel, { onCrafted }),
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

  async function openForge(): Promise<void> {
    const launch = document.querySelector<HTMLButtonElement>('.forge-launch');
    if (!launch) throw new Error('缺少绯焰重铸入口');
    launch.click();
    await flushUi();
  }

  it('从材料页入口明确展示 40 枚通用碎片、六个确定部位和权威 2/4/6 件效果', async () => {
    expect(document.body.textContent).toContain('绯焰重铸台');
    expect(document.body.textContent).toContain('240/40');
    expect(document.querySelector('.forge-sheet')).toBeNull();

    await openForge();

    expect(document.body.textContent).toContain('维斯塔焰羽爪');
    expect(document.body.textContent).not.toContain('维斯塔誓焰刃');
    expect(
      document.body.querySelector<HTMLImageElement>(
        'img[src*="assets/equipment/weapons/r5-set-weapon/catkin.png"]',
      ),
    ).not.toBeNull();
    const choices = [...document.querySelectorAll<HTMLButtonElement>('.slot-choice')];
    expect(choices).toHaveLength(6);
    expect(document.querySelector('.slot-grid')?.getAttribute('role')).toBe('group');
    expect(choices[0]?.getAttribute('aria-pressed')).toBe('true');
    expect(choices.slice(1).every((choice) => choice.getAttribute('aria-pressed') === 'false')).toBe(
      true,
    );
    expect(choices.map((choice) => choice.textContent?.replace(/\s+/g, ' ').trim())).toEqual(
      expect.arrayContaining([
        expect.stringContaining('武器'),
        expect.stringContaining('头冠'),
        expect.stringContaining('衣裙'),
        expect.stringContaining('项链'),
        expect.stringContaining('戒指'),
        expect.stringContaining('手镯'),
      ]),
    );
    expect(document.body.textContent).toContain('已经拥有 1 件同部位绯焰装备');
    expect(document.body.textContent).toContain('攻击 +8%');
    expect(document.body.textContent).toContain('暴击率 +6%，炎属性伤害 +12%');
    expect(document.body.textContent).toContain('15% 概率追加 120% 攻击力');
    expect(document.body.textContent).toContain('部位确定');
    expect(focusTrapState.active).toBe(true);
  });

  it('按玩家选中的部位提交同一耐久接口，写盘完成前锁住双击、关闭和外侧点击', async () => {
    let finishWrite: ((result: unknown) => void) | undefined;
    inventory.craftEquipmentSetPiece.mockReturnValueOnce(
      new Promise((resolve) => {
        finishWrite = resolve;
      }),
    );
    await openForge();

    const ring = [...document.querySelectorAll<HTMLButtonElement>('.slot-choice')].find((button) =>
      button.getAttribute('aria-label')?.startsWith('戒指'),
    );
    if (!ring) throw new Error('缺少戒指选项');
    ring.click();
    await flushUi();

    const confirm = document.querySelector<HTMLButtonElement>('.confirm-button');
    const close = document.querySelector<HTMLButtonElement>('.close-button');
    const overlay = document.querySelector<HTMLElement>('.forge-overlay');
    const sheet = document.querySelector<HTMLElement>('.forge-sheet');
    if (!confirm || !close || !overlay || !sheet) throw new Error('重铸面板未完整挂载');

    expect(confirm.textContent).toContain('重铸戒指');
    confirm.click();
    await flushUi();

    expect(inventory.craftEquipmentSetPiece).toHaveBeenCalledWith('craft_set_crimson', 'ring');
    expect(inventory.craftEquipmentSetPiece).toHaveBeenCalledTimes(1);
    expect(sheet.getAttribute('aria-busy')).toBe('true');
    expect(confirm.textContent).toContain('正在安全写入');
    expect(close.disabled).toBe(true);
    expect(onCrafted).not.toHaveBeenCalled();

    confirm.click();
    close.click();
    overlay.click();
    await flushUi();
    expect(inventory.craftEquipmentSetPiece).toHaveBeenCalledTimes(1);
    expect(document.querySelector('.forge-sheet')).not.toBeNull();

    finishWrite!({
      ok: true,
      recipeId: 'craft_set_crimson',
      setId: 'set_region_crimson',
      targetSlot: 'ring',
      targetDefId: 'eq_set_region_crimson_ring',
      equipment: instance('eq_set_region_crimson_ring', 'crafted-ring'),
      wallet: { items: { frag_crimson: 200 } },
      cost: { itemId: 'frag_crimson', count: 40 },
      nextRngState: 123,
    });
    await flushUi();

    expect(onCrafted).toHaveBeenCalledWith({
      equipmentName: requireEquipment('eq_set_region_crimson_ring').name,
      targetSlot: 'ring',
    });
    expect(document.body.textContent).toContain('重铸完成，已安全放入背包');
    expect(sheet.getAttribute('aria-busy')).toBe('false');
    expect(close.disabled).toBe(false);
  });

  it('写盘失败说明碎片和装备都已恢复，并恢复可重试与可关闭状态', async () => {
    inventory.craftEquipmentSetPiece.mockResolvedValueOnce({
      ok: false,
      reason: 'persistence-failed',
    });
    await openForge();

    const confirm = document.querySelector<HTMLButtonElement>('.confirm-button');
    const close = document.querySelector<HTMLButtonElement>('.close-button');
    if (!confirm || !close) throw new Error('重铸按钮未挂载');
    confirm.click();
    await flushUi();

    expect(onCrafted).not.toHaveBeenCalled();
    expect(document.body.textContent).toContain('碎片与装备已全部恢复');
    expect(confirm.disabled).toBe(false);
    expect(close.disabled).toBe(false);
  });

  it('碎片不足时只展示真实缺口，不能调用合成接口', async () => {
    app?.unmount();
    app = null;
    inventory.bag.items = { frag_crimson: 39 };
    app = createApp({
      render: () => h(CrimsonForgePanel, { onCrafted }),
    });
    app.mount(host!);
    await flushUi();
    await openForge();

    const confirm = document.querySelector<HTMLButtonElement>('.confirm-button');
    if (!confirm) throw new Error('重铸按钮未挂载');
    expect(confirm.disabled).toBe(true);
    expect(confirm.textContent).toContain('还差 1 枚');
    confirm.click();
    await flushUi();
    expect(inventory.craftEquipmentSetPiece).not.toHaveBeenCalled();
  });

  it('同一图鉴管线接入幽影八槽、四来源与 2/4/6/8 件真实效果', async () => {
    app?.unmount();
    app = null;
    inventory.bag.items = { frag_shadow: 55 };
    inventory.bag.equipment = [];
    for (const slot of Object.keys(inventory.equipped) as EquipSlot[]) {
      inventory.equipped[slot] = null;
    }
    app = createApp({
      render: () =>
        h(CrimsonForgePanel, {
          recipeId: 'craft_set_shadow',
          onCrafted,
        }),
    });
    app.mount(host!);
    await flushUi();

    expect(document.body.textContent).toContain('幽影祀塔 · 套装图鉴');
    expect(document.body.textContent).toContain('幽影重铸台');
    expect(document.body.textContent).toContain('55/55');
    await openForge();

    expect(document.querySelector('.forge-sheet.is-shadow')).not.toBeNull();
    expect(document.querySelectorAll('.slot-choice')).toHaveLength(8);
    expect(document.body.textContent).toContain('幽影祭司');
    expect(document.body.textContent).toContain('幽影教主·诺瓦');
    expect(document.body.textContent).toContain('生命 +10%');
    expect(document.body.textContent).toContain('伤害减免 +6%');
    expect(document.body.textContent).toContain('暴击伤害 +20%');
    expect(document.body.textContent).toContain('回复 30% 最大生命');
  });

  it('血月八槽复用同一接口，八件只展示静态称号徽记而不承诺战斗效果', async () => {
    app?.unmount();
    app = null;
    inventory.bag.items = { frag_bloodmoon: 55 };
    inventory.bag.equipment = [];
    for (const slot of Object.keys(inventory.equipped) as EquipSlot[]) {
      inventory.equipped[slot] = null;
    }
    app = createApp({
      render: () =>
        h(CrimsonForgePanel, {
          recipeId: 'craft_set_bloodmoon',
          onCrafted,
        }),
    });
    app.mount(host!);
    await flushUi();

    expect(document.body.textContent).toContain('血月峡谷 · 套装图鉴');
    expect(document.body.textContent).toContain('血月重铸台');
    expect(document.body.textContent).toContain('55/55');
    await openForge();

    expect(document.querySelector('.forge-sheet.is-bloodmoon')).not.toBeNull();
    expect(document.querySelectorAll('.slot-choice')).toHaveLength(8);
    expect(document.body.textContent).toContain('血雾魔女');
    expect(document.body.textContent).toContain('血月恶魔·莉莉姆');
    expect(document.body.textContent).toContain('攻击 +10%');
    expect(document.body.textContent).toContain('暴击率 +8%');
    expect(document.body.textContent).toContain('技能伤害 +18%');
    expect(document.body.textContent).toContain('血月的眷属');
    expect(document.body.textContent).toContain('称号与血月徽记不提供战斗属性');
    expect(document.body.textContent).not.toContain('暴击时回复');
    expect(document.body.textContent).not.toContain('流血');
    expect(
      document.querySelector<HTMLImageElement>(
        'img[src="/assets/equipment/sets/r7-bloodmoon/badge.png"]',
      ),
    ).not.toBeNull();
  });

  it('保持竖屏安全区、极窄屏布局、减弱动效和成熟焦点陷阱门禁', async () => {
    const source = await Promise.all([import('node:fs/promises'), import('node:path')]).then(
      ([{ readFile }, { resolve }]) =>
        readFile(resolve('src/components/CrimsonForgePanel.vue'), 'utf8'),
    );

    expect(source).toContain('createFocusTrap(sheet');
    expect(source).toContain('{{ recipe.fragmentCount }} 枚通用碎片');
    expect(source).toContain('grid-auto-rows: max-content');
    expect(source).toContain('calc(100dvh - max(24px, env(safe-area-inset-top)))');
    expect(source).toContain('@media (max-width: 350px)');
    expect(source).toContain('@media (prefers-reduced-motion: reduce)');
    expect(source).toContain('max(13px, env(safe-area-inset-bottom))');
  });
});
