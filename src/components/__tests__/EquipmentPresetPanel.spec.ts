// @vitest-environment jsdom

import { createApp, h, nextTick, type App } from 'vue';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { EquipmentInstance } from '@/core/types';
import type { EquipmentPresetState } from '@/core/equipmentPresets';
import EquipmentPresetPanel from '../EquipmentPresetPanel.vue';

const weapon: EquipmentInstance = {
  uid: 'e-fire',
  defId: 'eq_r2_weapon_fine',
  enhance: 0,
  baseRollPermille: 1000,
  enhanceGainPermille: Array<number>(15).fill(0),
  enhanceLuck: {},
  affixes: [],
  reforgeResonance: 0,
  locked: true,
};

const inventory = vi.hoisted(() => ({
  equipmentPresets: { presets: [], autoSwitch: false } as EquipmentPresetState,
  ownedEquipment: vi.fn(),
  captureEquipmentPreset: vi.fn(),
  applyEquipmentPreset: vi.fn(),
  deleteEquipmentPreset: vi.fn(),
  setEquipmentPresetAutoSwitch: vi.fn(),
}));
const player = vi.hoisted(() => ({ player: { classId: 'witch' as const } }));

vi.mock('@/stores/inventory', () => ({ useInventoryStore: () => inventory }));
vi.mock('@/stores/player', () => ({ usePlayerStore: () => player }));

async function flushUi(): Promise<void> {
  await Promise.resolve();
  await nextTick();
}

describe('星衣装备预设面板', () => {
  let app: App<Element> | null = null;
  let host: HTMLDivElement | null = null;

  beforeEach(async () => {
    vi.clearAllMocks();
    inventory.equipmentPresets = {
      presets: [
        {
          id: 'preset-1',
          classId: 'witch',
          equipmentUids: {
            weapon: weapon.uid,
            head: null,
            body: null,
            necklace: null,
            bracelet: null,
            ring: null,
            belt: null,
            shoes: null,
          },
        },
      ],
      autoSwitch: false,
    };
    inventory.ownedEquipment.mockImplementation((uid: string) =>
      uid === weapon.uid ? weapon : null,
    );
    inventory.captureEquipmentPreset.mockReturnValue({
      ok: true,
      preset: inventory.equipmentPresets.presets[0],
      changedSlots: 0,
      cpDelta: 0,
    });
    inventory.applyEquipmentPreset.mockReturnValue({
      ok: true,
      preset: inventory.equipmentPresets.presets[0],
      changedSlots: 1,
      cpDelta: 12,
    });
    inventory.deleteEquipmentPreset.mockReturnValue(true);
    inventory.setEquipmentPresetAutoSwitch.mockReturnValue(true);

    host = document.createElement('div');
    document.body.append(host);
    app = createApp({ render: () => h(EquipmentPresetPanel) });
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

  it('固定展示三套位置，并把职业、武器元素、件数和自动开关说清楚', () => {
    expect(host?.querySelectorAll('.preset-card')).toHaveLength(3);
    expect(host?.textContent).toContain('魔女 · 方案 1');
    expect(host?.textContent).toContain('炎属性武器');
    expect(host?.textContent).toContain('1/8 件');
    expect(host?.textContent).toContain('空白方案 2');
    expect(host?.querySelector('[role="switch"]')?.getAttribute('aria-checked')).toBe('false');
  });

  it('保存、穿戴和自动切换都只调用 store 契约，不在组件里改存档', async () => {
    const saveButton = host?.querySelector<HTMLButtonElement>('[aria-label="覆盖方案 1"]');
    const applyButton = host?.querySelector<HTMLButtonElement>('[aria-label="穿戴方案 1"]');
    const autoButton = host?.querySelector<HTMLButtonElement>('[role="switch"]');
    saveButton?.click();
    applyButton?.click();
    autoButton?.click();
    await flushUi();

    expect(inventory.captureEquipmentPreset).toHaveBeenCalledWith('preset-1');
    expect(inventory.applyEquipmentPreset).toHaveBeenCalledWith('preset-1');
    expect(inventory.setEquipmentPresetAutoSwitch).toHaveBeenCalledWith(true);
    expect(host?.textContent).toContain('已开启');
  });

  it('清空需要连续确认两次，第一次点击不会删除', async () => {
    const deleteButton = host?.querySelector<HTMLButtonElement>('[aria-label="清空方案 1"]');
    deleteButton?.click();
    await flushUi();
    expect(inventory.deleteEquipmentPreset).not.toHaveBeenCalled();
    expect(host?.textContent).toContain('再点一次');

    deleteButton?.click();
    await flushUi();
    expect(inventory.deleteEquipmentPreset).toHaveBeenCalledWith('preset-1');
    expect(host?.textContent).toContain('保护锁保持不变');
  });
});
