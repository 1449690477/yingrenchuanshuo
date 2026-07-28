import { describe, expect, it } from 'vitest';
import { planClassSwitch, type EquippedLoadout } from '../classSwitch';
import type { ClassId, EquipmentDef, EquipmentInstance, EquipSlot } from '../types';

const DEFINITIONS: Record<string, EquipmentDef> = {
  universalBody: definition('universalBody', 'body'),
  sword: definition('sword', 'weapon', 'swordsman'),
  staff: definition('staff', 'weapon', 'witch'),
};

describe('planClassSwitch', () => {
  it('通用装备原槽保留，旧职业专属装备完整回包并自动锁定', () => {
    const body = instance('body-1', 'universalBody', true);
    const sword = instance('sword-1', 'sword', false);
    sword.enhance = 12;
    sword.enhanceGainPermille[0] = 88;
    sword.enhanceLuck['13'] = 77;
    sword.affixes = [{ key: 'atk', value: 321, tier: 3 }];
    const staff = instance('staff-1', 'staff', false);
    const equipped = loadout({ body, weapon: sword });
    const bag = [staff];
    const beforeEquipped = structuredClone(equipped);
    const beforeBag = structuredClone(bag);

    const result = planClassSwitch({
      currentClassId: 'swordsman',
      targetClassId: 'witch',
      equipped,
      bagEquipment: bag,
      definitionOf: (id) => DEFINITIONS[id],
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.equipped.body).toBe(body);
    expect(result.equipped.weapon).toBeNull();
    expect(result.bagEquipment.map((item) => item.uid)).toEqual(['staff-1', 'sword-1']);
    expect(result.bagEquipment[1]).toMatchObject({
      uid: 'sword-1',
      enhance: 12,
      enhanceLuck: { '13': 77 },
      affixes: [{ key: 'atk', value: 321 }],
      locked: true,
    });
    expect(result.movedEquipment).toHaveLength(1);
    expect(result.newlyLockedCount).toBe(1);
    expect(equipped).toEqual(beforeEquipped);
    expect(bag).toEqual(beforeBag);
  });

  it('目标职业专属装备与已经锁定的回包装备不会被误改', () => {
    const staff = instance('staff-1', 'staff', false);
    const sword = instance('sword-1', 'sword', true);
    const result = planClassSwitch({
      currentClassId: 'swordsman',
      targetClassId: 'witch',
      equipped: loadout({ weapon: staff, head: sword }),
      bagEquipment: [],
      definitionOf: (id) =>
        id === 'sword' ? { ...DEFINITIONS.sword!, slot: 'head' } : DEFINITIONS[id],
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.equipped.weapon).toBe(staff);
    expect(result.equipped.head).toBeNull();
    expect(result.bagEquipment[0]).toBe(sword);
    expect(result.newlyLockedCount).toBe(0);
  });

  it('满背包也只追加安全回收装备，不做隐式裁剪或分解', () => {
    const bag = Array.from({ length: 300 }, (_, index) =>
      instance(`bag-${index}`, 'universalBody', false),
    );
    const result = planClassSwitch({
      currentClassId: 'swordsman',
      targetClassId: 'catkin',
      equipped: loadout({ weapon: instance('sword-1', 'sword', false) }),
      bagEquipment: bag,
      definitionOf: (id) => DEFINITIONS[id],
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.bagEquipment).toHaveLength(301);
    expect(new Set(result.bagEquipment.map((item) => item.uid)).size).toBe(301);
  });

  it('切到当前职业时不产生事务计划', () => {
    expect(
      planClassSwitch({
        currentClassId: 'shaman',
        targetClassId: 'shaman',
        equipped: loadout(),
        bagEquipment: [],
        definitionOf: (id) => DEFINITIONS[id],
      }),
    ).toEqual({ ok: false, reason: 'same-class' });
  });

  it('装备定义缺失或槽位错乱时立即报错，不用兜底掩盖坏档', () => {
    const equipped = loadout({ weapon: instance('missing-1', 'missing', false) });
    expect(() =>
      planClassSwitch({
        currentClassId: 'swordsman',
        targetClassId: 'witch',
        equipped,
        bagEquipment: [],
        definitionOf: () => undefined,
      }),
    ).toThrow('找不到装备定义');

    expect(() =>
      planClassSwitch({
        currentClassId: 'swordsman',
        targetClassId: 'witch',
        equipped: loadout({ head: instance('sword-1', 'sword', false) }),
        bagEquipment: [],
        definitionOf: (id) => DEFINITIONS[id],
      }),
    ).toThrow('却穿在 head 槽');
  });
});

function definition(id: string, slot: EquipSlot, classId?: ClassId): EquipmentDef {
  return {
    id,
    name: id,
    slot,
    quality: 'epic',
    level: 1,
    icon: `assets/${id}.png`,
    appearanceId: id,
    ...(classId ? { classId } : {}),
  };
}

function instance(uid: string, defId: string, locked: boolean): EquipmentInstance {
  return {
    uid,
    defId,
    enhance: 0,
    baseRollPermille: 1000,
    enhanceGainPermille: Array<number>(15).fill(0),
    enhanceLuck: {},
    affixes: [],
    reforgeResonance: 0,
    locked,
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
