import { describe, expect, it } from 'vitest';
import {
  captureEquipmentPreset,
  createEquipmentPresetState,
  planAutomaticEquipmentPreset,
  planEquipmentPreset,
  type EquippedLoadout,
} from '../equipmentPresets';
import type { ClassId, Element, EquipmentDef, EquipmentInstance, EquipSlot } from '../types';

const DEFINITIONS: Record<string, EquipmentDef> = {
  fireSword: definition('fireSword', 'weapon', 'fire', 'swordsman'),
  iceSword: definition('iceSword', 'weapon', 'ice', 'swordsman'),
  thunderSword: definition('thunderSword', 'weapon', 'thunder', 'swordsman'),
  fireStaff: definition('fireStaff', 'weapon', 'fire', 'witch'),
  body: definition('body', 'body'),
  highRing: definition('highRing', 'ring', undefined, undefined, 50),
};

describe('装备预设纯规划', () => {
  it('新状态为空且默认不自动切换', () => {
    expect(createEquipmentPresetState()).toEqual({ presets: [], autoSwitch: false });
  });

  it('保存当前八槽，空槽也作为明确快照写入', () => {
    const fire = instance('fire-1', 'fireSword');
    const body = instance('body-1', 'body');
    const preset = captureEquipmentPreset('preset-1', 'swordsman', loadout({ weapon: fire, body }));
    expect(preset).toEqual({
      id: 'preset-1',
      classId: 'swordsman',
      equipmentUids: {
        weapon: 'fire-1',
        head: null,
        body: 'body-1',
        necklace: null,
        bracelet: null,
        ring: null,
        belt: null,
        shoes: null,
      },
    });
  });

  it('先验证完整套装再一次性换装，并把预设空槽真正卸空', () => {
    const fire = instance('fire-1', 'fireSword');
    const ice = instance('ice-1', 'iceSword');
    const body = instance('body-1', 'body');
    const equipped = loadout({ weapon: fire, body });
    const bag = [ice];
    const preset = captureEquipmentPreset('preset-1', 'swordsman', loadout({ weapon: ice }));
    const beforeEquipped = structuredClone(equipped);
    const beforeBag = structuredClone(bag);

    const result = planEquipmentPreset({
      preset,
      classId: 'swordsman',
      playerLevel: 20,
      equipped,
      bagEquipment: bag,
      definitionOf: (id) => DEFINITIONS[id],
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.equipped.weapon).toBe(ice);
    expect(result.equipped.body).toBeNull();
    expect(result.bagEquipment.map((item) => item.uid)).toEqual(['fire-1', 'body-1']);
    expect(result.changedSlots).toBe(2);
    expect(equipped).toEqual(beforeEquipped);
    expect(bag).toEqual(beforeBag);
  });

  it('缺件、重复 UID、错槽、等级和职业不符都拒绝整套，不产出半套结果', () => {
    const fire = instance('fire-1', 'fireSword');
    const body = instance('body-1', 'body');
    const base = {
      classId: 'swordsman' as const,
      playerLevel: 20,
      equipped: loadout({ weapon: fire }),
      bagEquipment: [body],
      definitionOf: (id: string) => DEFINITIONS[id],
    };

    expect(
      planEquipmentPreset({
        ...base,
        preset: {
          ...captureEquipmentPreset('preset-1', 'swordsman', loadout()),
          equipmentUids: {
            ...captureEquipmentPreset('preset-1', 'swordsman', loadout()).equipmentUids,
            weapon: 'missing',
          },
        },
      }),
    ).toEqual({ ok: false, reason: 'missing-equipment', uid: 'missing' });

    expect(
      planEquipmentPreset({
        ...base,
        preset: {
          ...captureEquipmentPreset('preset-1', 'swordsman', loadout()),
          equipmentUids: {
            ...captureEquipmentPreset('preset-1', 'swordsman', loadout()).equipmentUids,
            weapon: 'fire-1',
            body: 'fire-1',
          },
        },
      }),
    ).toEqual({ ok: false, reason: 'duplicate-uid', uid: 'fire-1' });

    expect(
      planEquipmentPreset({
        ...base,
        preset: {
          ...captureEquipmentPreset('preset-1', 'swordsman', loadout()),
          equipmentUids: {
            ...captureEquipmentPreset('preset-1', 'swordsman', loadout()).equipmentUids,
            weapon: 'body-1',
          },
        },
      }),
    ).toMatchObject({ ok: false, reason: 'wrong-slot', uid: 'body-1' });

    expect(
      planEquipmentPreset({
        ...base,
        bagEquipment: [instance('ring-1', 'highRing')],
        preset: captureEquipmentPreset(
          'preset-1',
          'swordsman',
          loadout({ ring: instance('ring-1', 'highRing') }),
        ),
      }),
    ).toEqual({ ok: false, reason: 'level-locked', uid: 'ring-1', requiredLevel: 50 });

    expect(
      planEquipmentPreset({
        ...base,
        preset: captureEquipmentPreset('preset-1', 'witch', loadout()),
      }),
    ).toEqual({ ok: false, reason: 'class-mismatch' });
  });

  it('自动切换只选当前职业且能克制目标的第一套预设', () => {
    const fireSword = instance('fire-1', 'fireSword');
    const iceSword = instance('ice-1', 'iceSword');
    const fireStaff = instance('staff-1', 'fireStaff');
    const presets = [
      captureEquipmentPreset('preset-1', 'witch', loadout({ weapon: fireStaff })),
      captureEquipmentPreset('preset-2', 'swordsman', loadout({ weapon: iceSword })),
      captureEquipmentPreset('preset-3', 'swordsman', loadout({ weapon: fireSword })),
    ];

    const result = planAutomaticEquipmentPreset({
      presets,
      defenderElement: 'ice',
      classId: 'swordsman',
      playerLevel: 20,
      equipped: loadout({ weapon: iceSword }),
      bagEquipment: [fireSword, fireStaff],
      definitionOf: (id) => DEFINITIONS[id],
    });

    expect(result.status).toBe('ready');
    if (result.status !== 'ready') return;
    expect(result.preset.id).toBe('preset-3');
    expect(result.counterElement).toBe('fire');
    expect(result.plan.equipped.weapon).toBe(fireSword);
  });

  it('即使导入存档打乱数组顺序，也固定按方案 1 → 3 选择', () => {
    const current = instance('ice-current', 'iceSword');
    const fireOne = instance('fire-1', 'fireSword');
    const fireTwo = instance('fire-2', 'fireSword');
    const presetOne = captureEquipmentPreset('preset-1', 'swordsman', loadout({ weapon: fireOne }));
    const presetTwo = captureEquipmentPreset('preset-2', 'swordsman', loadout({ weapon: fireTwo }));

    const result = planAutomaticEquipmentPreset({
      presets: [presetTwo, presetOne],
      defenderElement: 'ice',
      classId: 'swordsman',
      playerLevel: 20,
      equipped: loadout({ weapon: current }),
      bagEquipment: [fireOne, fireTwo],
      definitionOf: (id) => DEFINITIONS[id],
    });

    expect(result.status).toBe('ready');
    if (result.status !== 'ready') return;
    expect(result.preset.id).toBe('preset-1');
  });

  it('无属性关卡或当前已克制时保持当前套装，没有匹配预设时明确返回 not-found', () => {
    const fire = instance('fire-1', 'fireSword');
    const common = {
      presets: [] as const,
      classId: 'swordsman' as const,
      playerLevel: 20,
      equipped: loadout({ weapon: fire }),
      bagEquipment: [] as EquipmentInstance[],
      definitionOf: (id: string) => DEFINITIONS[id],
    };
    expect(planAutomaticEquipmentPreset({ ...common, defenderElement: 'none' })).toEqual({
      status: 'not-needed',
      reason: 'untyped-stage',
    });
    expect(planAutomaticEquipmentPreset({ ...common, defenderElement: 'ice' })).toEqual({
      status: 'not-needed',
      reason: 'already-countering',
    });
    expect(planAutomaticEquipmentPreset({ ...common, defenderElement: 'fire' })).toEqual({
      status: 'not-found',
      counterElement: 'thunder',
    });
  });
});

function definition(
  id: string,
  slot: EquipSlot,
  element?: Element,
  classId?: ClassId,
  level = 1,
): EquipmentDef {
  const common = {
    id,
    name: id,
    quality: 'epic' as const,
    level,
    icon: `assets/${id}.png`,
    appearanceId: id,
    ...(classId ? { classId } : {}),
  };
  return slot === 'weapon' ? { ...common, slot, element: element ?? 'none' } : { ...common, slot };
}

function instance(uid: string, defId: string): EquipmentInstance {
  return {
    uid,
    defId,
    enhance: 0,
    baseRollPermille: 1000,
    enhanceGainPermille: Array<number>(15).fill(0),
    enhanceLuck: {},
    affixes: [],
    reforgeResonance: 0,
    locked: true,
  };
}

function loadout(
  values: Partial<Record<EquipSlot, EquipmentInstance | null>> = {},
): EquippedLoadout {
  return {
    weapon: null,
    head: null,
    body: null,
    necklace: null,
    bracelet: null,
    ring: null,
    belt: null,
    shoes: null,
    ...values,
  };
}
