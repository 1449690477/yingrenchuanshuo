import { describe, expect, it } from 'vitest';
import { reactive } from 'vue';
import { affixValueRange, createFixedPreviewInstance } from '@/core/equipment';
import { captureEquipmentPreset } from '@/core/equipmentPresets';
import { promoteAffix } from '@/core/reforge';
import type { AffixKey, AffixTier, EquipmentInstance } from '@/core/types';
import { ENHANCE_MAX, QUALITY_AFFIX_COUNT } from '@/data/constants';
import { EQUIPMENT, requireEquipment } from '@/data/equipment';
import { SAVE_VERSION, SaveValidationError, createSave, looksLikeSave, parseSave } from '../schema';
import { importFromJson } from '../storage';

function testEquipment(
  defId: string,
  affixes: EquipmentInstance['affixes'],
  pendingAffixChange?: EquipmentInstance['pendingAffixChange'],
): EquipmentInstance {
  return {
    uid: 'e1',
    defId,
    enhance: 0,
    baseRollPermille: 1000,
    enhanceGainPermille: Array<number>(ENHANCE_MAX).fill(0),
    enhanceLuck: {},
    affixes,
    reforgeResonance: 0,
    ...(pendingAffixChange ? { pendingAffixChange } : {}),
    locked: false,
  };
}

function saveWithEquipment(instance: EquipmentInstance) {
  const save = createSave('词条审计少女', 'witch', 77, 1_800_000_000_000);
  save.nextUid = 2;
  save.bag.equipment.push(instance);
  return save;
}

function rolledAffix(
  defId: string,
  key: AffixKey,
  tier: AffixTier,
  element?: EquipmentInstance['affixes'][number]['element'],
): EquipmentInstance['affixes'][number] {
  const range = affixValueRange(key, requireEquipment(defId).level, tier);
  return {
    key,
    tier,
    value: range.min,
    ...(element ? { element } : {}),
  };
}

describe('save schema', () => {
  it('新建存档符合当前完整结构', () => {
    const save = createSave('小樱', 'swordsman', 2026, 1_800_000_000_000);
    expect(parseSave(save)).toEqual(save);
    expect(save.version).toBe(SAVE_VERSION);
    expect(save.equipmentDungeon).toEqual({
      dayKey: '2027-01-15',
      clearsToday: 0,
      totalClears: 0,
      records: {},
      depth: {},
    });
    expect(save.settings.haptics).toBe(true);
    expect(save.player.skillLevels).toEqual({});
    expect(save.equipmentPresets).toEqual({ presets: [], autoSwitch: false });
    expect(save.affection.characters.witch).toMatchObject({
      points: 0,
      mood: 'calm',
      interactionsToday: 0,
      gearPity: 0,
      discoveredGearIds: [],
      completedStoryIds: [],
      choiceHistory: {},
    });
  });

  it('喵喵使用稳定 catkin ID 创建并通过严格校验', () => {
    const save = createSave('喵喵', 'catkin', 20260727, 1_800_000_000_000);
    expect(parseSave(save).player.classId).toBe('catkin');
    expect(looksLikeSave(save)).toBe(true);
  });

  it('能把 Vue 响应式对象解析成可持久化的普通对象', () => {
    const proxy = reactive(createSave('小樱', 'witch', 7, 1_800_000_000_000));
    const parsed = parseSave(proxy);

    expect(parsed).toEqual(proxy);
    expect(parsed).not.toBe(proxy);
  });

  it('缺少关键字段时直接拒绝，不用默认值掩盖坏档', () => {
    const broken = structuredClone(createSave('小樱', 'shaman', 9, 1_800_000_000_000));
    delete (broken.player as Partial<typeof broken.player>).gold;

    expect(() => parseSave(broken)).toThrow(SaveValidationError);
    expect(looksLikeSave(broken)).toBe(false);
  });

  it('非法职业、负金币和过高强化等级都会被拒绝', () => {
    const invalidClass = createSave('小樱', 'swordsman', 1, 1);
    (invalidClass.player as { classId: string }).classId = 'archer';
    expect(looksLikeSave(invalidClass)).toBe(false);

    const negativeGold = createSave('小樱', 'swordsman', 1, 1);
    negativeGold.player.gold = -1;
    expect(looksLikeSave(negativeGold)).toBe(false);

    const invalidEnhance = createSave('小樱', 'swordsman', 1, 1);
    invalidEnhance.bag.equipment.push({
      uid: 'e1',
      defId: 'eq_r1_ring_common',
      enhance: 16,
      baseRollPermille: 1000,
      enhanceGainPermille: Array<number>(ENHANCE_MAX).fill(80),
      enhanceLuck: {},
      affixes: [],
      reforgeResonance: 0,
      locked: false,
    });
    expect(looksLikeSave(invalidEnhance)).toBe(false);
  });

  it('技能等级必须是正整数且不能超过角色等级的一半', () => {
    const save = createSave('研习测试', 'swordsman', 24, 1);
    save.player.level = 20;
    save.player.skillLevels.skill_swordsman_attack = 10;
    expect(parseSave(save).player.skillLevels).toEqual({ skill_swordsman_attack: 10 });

    save.player.skillLevels.skill_swordsman_attack = 11;
    expect(looksLikeSave(save)).toBe(false);

    save.player.skillLevels.skill_swordsman_attack = 0;
    expect(looksLikeSave(save)).toBe(false);
  });

  it('技能表改名后遗留的未知 id 不会让整份存档无法读取', () => {
    const save = createSave('旧技能存档', 'witch', 25, 1);
    save.player.level = 20;
    save.player.skillLevels.skill_已经改名 = 4;
    expect(parseSave(save).player.skillLevels.skill_已经改名).toBe(4);
  });

  it('非法胚子、强化记录和幸运桶都会被拒绝', () => {
    const make = () => {
      const save = createSave('小樱', 'witch', 2, 1);
      save.bag.equipment.push({
        uid: 'e1',
        defId: 'eq_r1_ring_common',
        enhance: 1,
        baseRollPermille: 1000,
        enhanceGainPermille: [80, ...Array<number>(ENHANCE_MAX - 1).fill(0)],
        enhanceLuck: { '2': 17 },
        affixes: [],
        reforgeResonance: 0,
        locked: false,
      });
      return save;
    };

    const badBase = make();
    badBase.bag.equipment[0]!.baseRollPermille = 999;
    expect(looksLikeSave(badBase)).toBe(false);

    const missingReachedGain = make();
    missingReachedGain.bag.equipment[0]!.enhanceGainPermille[0] = 0;
    expect(looksLikeSave(missingReachedGain)).toBe(false);

    const badGainLength = make();
    badGainLength.bag.equipment[0]!.enhanceGainPermille.pop();
    expect(looksLikeSave(badGainLength)).toBe(false);

    const badLuckTarget = make();
    badLuckTarget.bag.equipment[0]!.enhanceLuck['16'] = 20;
    expect(looksLikeSave(badLuckTarget)).toBe(false);

    const zeroLuckBucket = make();
    zeroLuckBucket.bag.equipment[0]!.enhanceLuck['2'] = 0;
    expect(looksLikeSave(zeroLuckBucket)).toBe(false);
  });

  it('v10 可严格持久化随机词条品阶、共鸣值和待决洗练候选', () => {
    const save = createSave('洗练少女', 'witch', 10, 1_800_000_000_000);
    save.nextUid = 2;
    save.bag.equipment.push({
      uid: 'e1',
      defId: 'eq_r1_ring_common',
      enhance: 0,
      baseRollPermille: 1000,
      enhanceGainPermille: Array<number>(ENHANCE_MAX).fill(0),
      enhanceLuck: {},
      affixes: [{ key: 'critRate', value: 1.8, tier: 3 }],
      reforgeResonance: 12,
      pendingAffixChange: {
        operation: 'temper',
        affixIndex: 0,
        candidate: rolledAffix('eq_r1_ring_common', 'critRate', 4),
      },
      locked: false,
    });

    const parsed = parseSave(save);
    expect(parsed.bag.equipment[0]?.pendingAffixChange).toEqual({
      operation: 'temper',
      affixIndex: 0,
      candidate: rolledAffix('eq_r1_ring_common', 'critRate', 4),
    });
    expect(parsed.bag.equipment[0]?.reforgeResonance).toBe(12);
  });

  it('v11 可持久化预留槽职业词条，并约束元素亲和必须绑定系别', () => {
    const save = createSave('专属词条少女', 'witch', 13, 1_800_000_000_000);
    save.nextUid = 2;
    save.bag.equipment.push({
      uid: 'e1',
      defId: 'eq_r2_ring_epic',
      enhance: 0,
      baseRollPermille: 1000,
      enhanceGainPermille: Array<number>(ENHANCE_MAX).fill(0),
      enhanceLuck: {},
      affixes: [
        { key: 'critRate', value: 2.6, tier: 4 },
        rolledAffix('eq_r2_ring_epic', 'wit_veil', 3),
      ],
      reforgeResonance: 0,
      pendingAffixChange: {
        operation: 'inscribe',
        affixIndex: 1,
        candidate: rolledAffix('eq_r2_ring_epic', 'wit_elem', 5, 'thunder'),
      },
      locked: false,
    });

    expect(parseSave(save).bag.equipment[0]?.affixes.map((affix) => affix.key)).toEqual([
      'critRate',
      'wit_veil',
    ]);

    delete save.bag.equipment[0]!.pendingAffixChange!.candidate.element;
    expect(looksLikeSave(save)).toBe(false);
  });

  it('v10 无需迁移即可持久化灵巫输出补位词条', () => {
    const save = createSave('灵击少女', 'shaman', 14, 1_800_000_000_000);
    save.nextUid = 2;
    save.bag.equipment.push({
      uid: 'e1',
      defId: 'eq_r2_ring_epic',
      enhance: 0,
      baseRollPermille: 1000,
      enhanceGainPermille: Array<number>(ENHANCE_MAX).fill(0),
      enhanceLuck: {},
      affixes: [
        rolledAffix('eq_r2_ring_epic', 'critRate', 3),
        rolledAffix('eq_r2_ring_epic', 'sha_spirit', 4),
      ],
      reforgeResonance: 0,
      locked: false,
    });

    expect(parseSave(save).bag.equipment[0]?.affixes.map((affix) => affix.key)).toEqual([
      'critRate',
      'sha_spirit',
    ]);
  });

  it('v10 拒绝缺失或越界品阶，以及非整数或越界共鸣值', () => {
    const make = () => {
      const save = createSave('洗练少女', 'witch', 11, 1_800_000_000_000);
      save.nextUid = 2;
      save.bag.equipment.push({
        uid: 'e1',
        defId: 'eq_r1_ring_common',
        enhance: 0,
        baseRollPermille: 1000,
        enhanceGainPermille: Array<number>(ENHANCE_MAX).fill(0),
        enhanceLuck: {},
        affixes: [{ key: 'atk', value: 1, tier: 1 }],
        reforgeResonance: 0,
        locked: false,
      });
      return save;
    };

    const missingTier = make();
    delete (
      missingTier.bag.equipment[0]!.affixes[0] as Partial<
        (typeof missingTier.bag.equipment)[number]['affixes'][number]
      >
    ).tier;
    expect(looksLikeSave(missingTier)).toBe(false);

    for (const tier of [0, 6, 2.5]) {
      const invalidTier = make();
      invalidTier.bag.equipment[0]!.affixes[0]!.tier = tier as 1;
      expect(looksLikeSave(invalidTier)).toBe(false);
    }
    for (const resonance of [-1, 21, 1.5]) {
      const invalidResonance = make();
      invalidResonance.bag.equipment[0]!.reforgeResonance = resonance;
      expect(looksLikeSave(invalidResonance)).toBe(false);
    }

    const missingResonance = make();
    delete (
      missingResonance.bag.equipment[0] as Partial<(typeof missingResonance.bag.equipment)[number]>
    ).reforgeResonance;
    expect(looksLikeSave(missingResonance)).toBe(false);
  });

  it('v10 待决候选必须严格且索引指向现有随机词条', () => {
    const make = () => {
      const target = { key: 'elemDmg', value: 5, element: 'fire', tier: 3 } as const;
      const save = createSave('洗练少女', 'witch', 12, 1_800_000_000_000);
      save.nextUid = 2;
      save.bag.equipment.push({
        uid: 'e1',
        defId: 'eq_r1_ring_common',
        enhance: 0,
        baseRollPermille: 1000,
        enhanceGainPermille: Array<number>(ENHANCE_MAX).fill(0),
        enhanceLuck: {},
        affixes: [target],
        reforgeResonance: 20,
        pendingAffixChange: {
          operation: 'resonate',
          affixIndex: 0,
          candidate: promoteAffix(target),
        },
        locked: false,
      });
      return save;
    };

    const badIndex = make();
    badIndex.bag.equipment[0]!.pendingAffixChange!.affixIndex = 1;
    expect(looksLikeSave(badIndex)).toBe(false);

    const badOperation = make();
    (
      badOperation.bag.equipment[0]!.pendingAffixChange as unknown as {
        operation: string;
      }
    ).operation = 'reroll';
    expect(looksLikeSave(badOperation)).toBe(false);

    const extraCandidateField = make();
    (
      extraCandidateField.bag.equipment[0]!.pendingAffixChange!.candidate as unknown as Record<
        string,
        unknown
      >
    ).forged = true;
    expect(looksLikeSave(extraCandidateField)).toBe(false);

    const missingElement = make();
    delete missingElement.bag.equipment[0]!.pendingAffixChange!.candidate.element;
    expect(looksLikeSave(missingElement)).toBe(false);
  });

  it('v10 按真实装备品质与固定词条计算随机槽位上限，旧白装可保持零词条', () => {
    const legacyBlank = saveWithEquipment(testEquipment('eq_r1_ring_common', []));
    expect(looksLikeSave(legacyBlank)).toBe(true);
    expect(legacyBlank.bag.equipment[0]!.affixes).toEqual([]);

    const commonOverflow = saveWithEquipment(
      testEquipment('eq_r1_ring_common', [
        { key: 'atk', value: 2, tier: 2 },
        { key: 'def', value: 2, tier: 2 },
      ]),
    );
    expect(() => parseSave(commonOverflow)).toThrow(/随机词条超过 common 品质剩余容量 1/);

    const partialFixedDef = requireEquipment('eq_dungeon_violet_ring_1');
    const remaining =
      QUALITY_AFFIX_COUNT[partialFixedDef.quality] - (partialFixedDef.fixedAffixes?.length ?? 0);
    expect(remaining).toBe(2);
    const withinRemaining = saveWithEquipment(
      testEquipment(partialFixedDef.id, [
        { key: 'atk', value: 10, tier: 2 },
        { key: 'def', value: 8, tier: 3 },
      ]),
    );
    expect(looksLikeSave(withinRemaining)).toBe(true);

    withinRemaining.bag.equipment[0]!.affixes.push({ key: 'hp', value: 80, tier: 4 });
    expect(looksLikeSave(withinRemaining)).toBe(false);
  });

  it('v10 拒绝未知装备、重复词条、与固定词条冲突及固定模板随机词条', () => {
    const unknownDefinition = saveWithEquipment(testEquipment('eq_deleted', []));
    expect(() => parseSave(unknownDefinition)).toThrow(/装备定义不存在/);

    const duplicateRandom = saveWithEquipment(
      testEquipment('eq_r2_ring_epic', [
        { key: 'atk', value: 10, tier: 2 },
        { key: 'atk', value: 12, tier: 3 },
      ]),
    );
    expect(() => parseSave(duplicateRandom)).toThrow(/随机词条键与现有词条重复：atk/);

    const fixedCollision = saveWithEquipment(
      testEquipment('eq_dungeon_violet_ring_1', [{ key: 'critDmg', value: 8, tier: 2 }]),
    );
    expect(() => parseSave(fixedCollision)).toThrow(/随机词条键与现有词条重复：critDmg/);

    // 固定模板的随机词条上限 = 额外槽位数（不再是 0 —— 珍品现在带可洗槽，
    // 见 2026-07-30 品质平衡）。这里按各自槽数 +1 越界来测边界。
    const fixedTemplate = Object.values(EQUIPMENT).find((definition) => definition.fixedTemplate);
    if (!fixedTemplate) throw new Error('[测试配置错误] 缺少完整固定模板装备');
    const overflowKeys = ['lifesteal', 'dmgReduce', 'spd', 'eva'] as const;
    const extraSlots = fixedTemplate.extraAffixSlots ?? 0;
    const forbiddenRandom = saveWithEquipment(
      testEquipment(
        fixedTemplate.id,
        Array.from({ length: extraSlots + 1 }, (_, index) => ({
          key: overflowKeys[index]!,
          value: 1.2,
          tier: 2 as const,
        })),
      ),
    );
    expect(() => parseSave(forbiddenRandom)).toThrow(/完整固定模板的随机词条不得超过额外槽位/);
  });

  it('v10 重铸候选必须换类型，且采用后不能与其他随机或固定词条重复', () => {
    const affixes: EquipmentInstance['affixes'] = [
      { key: 'atk', value: 10, tier: 2 },
      { key: 'elemDmg', value: 6, element: 'fire', tier: 3 },
      { key: 'critRate', value: 2, tier: 1 },
    ];
    const valid = saveWithEquipment(
      testEquipment('eq_r2_ring_epic', structuredClone(affixes), {
        operation: 'reforge',
        affixIndex: 0,
        candidate: rolledAffix('eq_r2_ring_epic', 'def', 4),
      }),
    );
    expect(looksLikeSave(valid)).toBe(true);

    const unchangedKey = structuredClone(valid);
    unchangedKey.bag.equipment[0]!.pendingAffixChange!.candidate = {
      key: 'atk',
      value: 13,
      tier: 4,
    };
    expect(looksLikeSave(unchangedKey)).toBe(false);

    const duplicateOther = structuredClone(valid);
    duplicateOther.bag.equipment[0]!.pendingAffixChange!.candidate = {
      key: 'critRate',
      value: 3,
      tier: 4,
    };
    expect(looksLikeSave(duplicateOther)).toBe(false);

    const duplicateFixed = saveWithEquipment(
      testEquipment('eq_dungeon_violet_ring_1', [{ key: 'atk', value: 10, tier: 2 }], {
        operation: 'reforge',
        affixIndex: 0,
        candidate: { key: 'critDmg', value: 12, tier: 4 },
      }),
    );
    expect(looksLikeSave(duplicateFixed)).toBe(false);
  });

  it('v10 淬炼保持类型与元素，同调还必须恰好提升一级', () => {
    const affixes: EquipmentInstance['affixes'] = [
      { key: 'elemDmg', value: 6, element: 'fire', tier: 3 },
    ];
    const validTemper = saveWithEquipment(
      testEquipment('eq_r2_ring_epic', structuredClone(affixes), {
        operation: 'temper',
        affixIndex: 0,
        candidate: rolledAffix('eq_r2_ring_epic', 'elemDmg', 5, 'fire'),
      }),
    );
    expect(looksLikeSave(validTemper)).toBe(true);

    const changedTemperElement = structuredClone(validTemper);
    changedTemperElement.bag.equipment[0]!.pendingAffixChange!.candidate.element = 'ice';
    expect(looksLikeSave(changedTemperElement)).toBe(false);

    const changedTemperKey = structuredClone(validTemper);
    changedTemperKey.bag.equipment[0]!.pendingAffixChange!.candidate = {
      key: 'def',
      value: 9,
      tier: 5,
    };
    expect(looksLikeSave(changedTemperKey)).toBe(false);

    const resonateTarget = structuredClone(affixes[0]!);
    const validResonate = saveWithEquipment(
      testEquipment('eq_r2_ring_epic', [resonateTarget], {
        operation: 'resonate',
        affixIndex: 0,
        candidate: promoteAffix(resonateTarget),
      }),
    );
    expect(looksLikeSave(validResonate)).toBe(true);

    const skippedTier = structuredClone(validResonate);
    skippedTier.bag.equipment[0]!.pendingAffixChange!.candidate.tier = 5;
    expect(looksLikeSave(skippedTier)).toBe(false);

    const changedResonateElement = structuredClone(validResonate);
    changedResonateElement.bag.equipment[0]!.pendingAffixChange!.candidate.element = 'thunder';
    expect(looksLikeSave(changedResonateElement)).toBe(false);
  });

  it('v11 铭刻校验预留槽与采用后的唯一性，但不按当前职业拒绝切换前候选', () => {
    const switchedClassCandidate = saveWithEquipment(
      testEquipment(
        'eq_r2_ring_epic',
        [
          { key: 'atk', value: 10, tier: 2 },
          { key: 'critRate', value: 2, tier: 2 },
        ],
        {
          operation: 'inscribe',
          affixIndex: 1,
          candidate: rolledAffix('eq_r2_ring_epic', 'swd_guard', 3),
        },
      ),
    );
    expect(switchedClassCandidate.player.classId).toBe('witch');
    expect(looksLikeSave(switchedClassCandidate)).toBe(true);

    const unchangedType = structuredClone(switchedClassCandidate);
    unchangedType.bag.equipment[0]!.pendingAffixChange!.candidate = {
      key: 'atk',
      value: 12,
      tier: 3,
    };
    expect(looksLikeSave(unchangedType)).toBe(false);

    switchedClassCandidate.bag.equipment[0]!.pendingAffixChange!.candidate = {
      key: 'critRate',
      value: 3,
      tier: 3,
    };
    expect(looksLikeSave(switchedClassCandidate)).toBe(false);
  });

  it('v11 拒绝现有职业词条落在通用槽，也拒绝铭刻指向非预留槽', () => {
    const wrongAdoptedSlot = saveWithEquipment(
      testEquipment('eq_r2_ring_epic', [
        rolledAffix('eq_r2_ring_epic', 'wit_power', 3),
        rolledAffix('eq_r2_ring_epic', 'critRate', 3),
      ]),
    );
    expect(() => parseSave(wrongAdoptedSlot)).toThrow(/只能位于品质预留的职业槽/);

    const wrongInscribeIndex = saveWithEquipment(
      testEquipment(
        'eq_r2_ring_epic',
        [rolledAffix('eq_r2_ring_epic', 'atk', 3), rolledAffix('eq_r2_ring_epic', 'critRate', 3)],
        {
          operation: 'inscribe',
          affixIndex: 0,
          candidate: rolledAffix('eq_r2_ring_epic', 'swd_guard', 3),
        },
      ),
    );
    expect(() => parseSave(wrongInscribeIndex)).toThrow(/铭刻只能作用于品质预留的职业槽/);
  });

  it('导入档保留既有 skillMul，但拒绝任何延后词条候选及继续淬炼或同调', () => {
    const legacy = saveWithEquipment(
      testEquipment('eq_r1_ring_common', [{ key: 'skillMul', value: 2.5, tier: 3 }]),
    );
    expect(importFromJson(JSON.stringify(legacy)).bag.equipment[0]!.affixes[0]!.key).toBe(
      'skillMul',
    );

    const deferredCandidate = saveWithEquipment(
      testEquipment('eq_r1_ring_common', [{ key: 'atk', value: 4, tier: 3 }], {
        operation: 'reforge',
        affixIndex: 0,
        candidate: rolledAffix('eq_r1_ring_common', 'skillMul', 3),
      }),
    );
    expect(() => importFromJson(JSON.stringify(deferredCandidate))).toThrow(/尚未开放生成/);

    const legacyTarget = { key: 'skillMul', value: 2.5, tier: 3 } as const;
    const temper = saveWithEquipment(
      testEquipment('eq_r1_ring_common', [legacyTarget], {
        operation: 'temper',
        affixIndex: 0,
        candidate: rolledAffix('eq_r1_ring_common', 'skillMul', 4),
      }),
    );
    const resonate = saveWithEquipment(
      testEquipment('eq_r1_ring_common', [legacyTarget], {
        operation: 'resonate',
        affixIndex: 0,
        candidate: promoteAffix(legacyTarget),
      }),
    );
    expect(() => importFromJson(JSON.stringify(temper))).toThrow(/不能继续养成延后结算词条/);
    expect(() => importFromJson(JSON.stringify(resonate))).toThrow(/不能继续养成延后结算词条/);
  });

  it('导入档严格校验重铸目标槽与铭刻职业池，同时兼容切职前职业候选', () => {
    const professionIntoGeneral = saveWithEquipment(
      testEquipment('eq_r1_ring_common', [{ key: 'atk', value: 4, tier: 3 }], {
        operation: 'reforge',
        affixIndex: 0,
        candidate: rolledAffix('eq_r1_ring_common', 'swd_guard', 3),
      }),
    );
    expect(() => importFromJson(JSON.stringify(professionIntoGeneral))).toThrow(
      /不属于目标通用词条槽/,
    );

    const generalIntoProfession = saveWithEquipment(
      testEquipment(
        'eq_r2_ring_epic',
        [
          { key: 'atk', value: 10, tier: 2 },
          { key: 'critRate', value: 2, tier: 2 },
          { key: 'wit_power', value: 12, tier: 3 },
        ],
        {
          operation: 'reforge',
          affixIndex: 2,
          candidate: rolledAffix('eq_r2_ring_epic', 'def', 3),
        },
      ),
    );
    expect(() => importFromJson(JSON.stringify(generalIntoProfession))).toThrow(
      /不属于目标职业词条槽/,
    );

    const generalInscribe = saveWithEquipment(
      testEquipment('eq_r1_ring_common', [{ key: 'atk', value: 4, tier: 3 }], {
        operation: 'inscribe',
        affixIndex: 0,
        candidate: rolledAffix('eq_r1_ring_common', 'def', 3),
      }),
    );
    expect(() => importFromJson(JSON.stringify(generalInscribe))).toThrow(
      /铭刻候选必须属于职业专属词条池/,
    );
  });

  it('导入档拒绝随机候选越界或偷带额外小数，并精确复算同调数值', () => {
    const validRandom = saveWithEquipment(
      testEquipment('eq_r1_ring_common', [{ key: 'atk', value: 4, tier: 3 }], {
        operation: 'reforge',
        affixIndex: 0,
        candidate: rolledAffix('eq_r1_ring_common', 'def', 3),
      }),
    );
    expect(importFromJson(JSON.stringify(validRandom)).bag.equipment).toHaveLength(1);

    const outsideRange = structuredClone(validRandom);
    outsideRange.bag.equipment[0]!.pendingAffixChange!.candidate.value -= 0.1;
    expect(() => importFromJson(JSON.stringify(outsideRange))).toThrow(/浮动范围或小数精度/);

    const extraPrecision = structuredClone(validRandom);
    extraPrecision.bag.equipment[0]!.pendingAffixChange!.candidate.value += 0.01;
    expect(() => importFromJson(JSON.stringify(extraPrecision))).toThrow(/浮动范围或小数精度/);

    const target = { key: 'critRate', value: 2, tier: 3 } as const;
    const validResonate = saveWithEquipment(
      testEquipment('eq_r1_ring_common', [target], {
        operation: 'resonate',
        affixIndex: 0,
        candidate: promoteAffix(target),
      }),
    );
    expect(importFromJson(JSON.stringify(validResonate)).bag.equipment).toHaveLength(1);

    validResonate.bag.equipment[0]!.pendingAffixChange!.candidate.value += 0.1;
    expect(() => importFromJson(JSON.stringify(validResonate))).toThrow(/同调候选数值必须精确提升/);
  });

  it('导入档拒绝普通词条伪装元素前缀，元素只属于真实属性伤害词条', () => {
    const forged = saveWithEquipment(
      testEquipment('eq_r1_ring_common', [{ key: 'atk', value: 4, tier: 3, element: 'fire' }]),
    );

    expect(() => importFromJson(JSON.stringify(forged))).toThrow(/非属性伤害词条不能携带元素/);
  });

  it('v8 角色进度拒绝负关系值、重复完成记录和空回答', () => {
    const negativeBond = createSave('小樱', 'witch', 8, 1);
    negativeBond.encounters.characters.char_akane = {
      bond: -1,
      completedEncounterIds: [],
      choiceHistory: {},
    };
    expect(looksLikeSave(negativeBond)).toBe(false);

    const duplicateChapter = createSave('小樱', 'witch', 8, 1);
    duplicateChapter.encounters.characters.char_akane = {
      bond: 2,
      completedEncounterIds: ['enc_r1_petalsmith', 'enc_r1_petalsmith'],
      choiceHistory: { enc_r1_petalsmith: 'lasting_grip' },
    };
    expect(looksLikeSave(duplicateChapter)).toBe(false);

    const emptyChoice = createSave('小樱', 'witch', 8, 1);
    emptyChoice.encounters.characters.char_akane = {
      bond: 1,
      completedEncounterIds: ['enc_r1_petalsmith'],
      choiceHistory: { enc_r1_petalsmith: '' },
    };
    expect(looksLikeSave(emptyChoice)).toBe(false);
  });

  it('v8 拒绝与奇遇配置不匹配的待处理回答和角色剧情记忆', () => {
    const invalidPending = createSave('小樱', 'witch', 8, 1);
    invalidPending.encounters.pending.push({
      uid: 'enc_bad',
      encounterId: 'enc_r1_petalsmith',
      regionId: 'r1',
      storyChoiceId: 'deleted_choice',
    });
    expect(looksLikeSave(invalidPending)).toBe(false);

    const invalidHistory = createSave('小樱', 'witch', 8, 1);
    invalidHistory.encounters.characters.char_akane = {
      bond: 1,
      completedEncounterIds: ['enc_r1_petalsmith'],
      choiceHistory: { enc_r1_petalsmith: 'deleted_choice' },
    };
    expect(looksLikeSave(invalidHistory)).toBe(false);

    invalidHistory.encounters.characters.char_akane!.choiceHistory.enc_r1_petalsmith =
      'lasting_grip';
    expect(looksLikeSave(invalidHistory)).toBe(true);
  });

  it('v9 好感记录拒绝非法次数、失效剧情和伪造回答', () => {
    const tooMany = createSave('小樱', 'witch', 9, 1_800_000_000_000);
    tooMany.affection.characters.witch.interactionsToday = 5;
    expect(looksLikeSave(tooMany)).toBe(false);

    const invalidStory = createSave('小樱', 'witch', 9, 1_800_000_000_000);
    invalidStory.affection.characters.witch.completedStoryIds.push('deleted_story');
    invalidStory.affection.characters.witch.choiceHistory.deleted_story = 'deleted_choice';
    expect(looksLikeSave(invalidStory)).toBe(false);

    const invalidChoice = createSave('小樱', 'witch', 9, 1_800_000_000_000);
    invalidChoice.affection.characters.witch.points = 30;
    invalidChoice.affection.characters.witch.completedStoryIds.push('aff_witch_01_star');
    invalidChoice.affection.characters.witch.choiceHistory.aff_witch_01_star = 'deleted_choice';
    expect(looksLikeSave(invalidChoice)).toBe(false);

    invalidChoice.affection.characters.witch.choiceHistory.aff_witch_01_star = 'ask_both';
    expect(looksLikeSave(invalidChoice)).toBe(true);
  });

  it('v9 好感完成剧情必须有对应回答，图鉴与剧情记录不能重复', () => {
    const missingChoice = createSave('小樱', 'swordsman', 9, 1_800_000_000_000);
    missingChoice.affection.characters.swordsman.completedStoryIds.push('aff_swordsman_01_dawn');
    expect(looksLikeSave(missingChoice)).toBe(false);

    const duplicateGear = createSave('小樱', 'catkin', 9, 1_800_000_000_000);
    duplicateGear.affection.characters.catkin.discoveredGearIds.push(
      'eq_affection_catkin_head',
      'eq_affection_catkin_head',
    );
    expect(looksLikeSave(duplicateGear)).toBe(false);
  });

  it('v9 好感图鉴拒绝其他职业装备，剧情完成记录必须包含前置篇章', () => {
    const wrongClassGear = createSave('小樱', 'witch', 9, 1_800_000_000_000);
    wrongClassGear.affection.characters.witch.discoveredGearIds.push(
      'eq_affection_swordsman_morning-oath-sakura-crown',
    );
    expect(looksLikeSave(wrongClassGear)).toBe(false);

    const missingPrerequisite = createSave('小樱', 'catkin', 9, 1_800_000_000_000);
    missingPrerequisite.affection.characters.catkin.points = 300;
    missingPrerequisite.affection.characters.catkin.completedStoryIds.push('aff_catkin_02_glove');
    missingPrerequisite.affection.characters.catkin.choiceHistory.aff_catkin_02_glove =
      'glove_highfive';
    expect(looksLikeSave(missingPrerequisite)).toBe(false);

    missingPrerequisite.affection.characters.catkin.completedStoryIds.unshift('aff_catkin_01_box');
    missingPrerequisite.affection.characters.catkin.choiceHistory.aff_catkin_01_box =
      'reinforce_box';
    expect(looksLikeSave(missingPrerequisite)).toBe(true);
  });

  it('v9 无需迁移即可接受完整九幕记忆，并拒绝跳过第八幕伪造第九幕', () => {
    const complete = createSave('九幕回忆', 'witch', 9, 1_800_000_000_000);
    const progress = complete.affection.characters.witch;
    progress.points = 2_660;
    progress.completedStoryIds.push(
      'aff_witch_01_star',
      'aff_witch_02_observatory',
      'aff_witch_03_recipe',
      'aff_witch_04_miscalculation',
      'aff_witch_05_nightflight',
      'aff_witch_06_constellation',
      'aff_witch_07_gift',
      'aff_witch_08_secret',
      'aff_witch_09_reciprocal',
    );
    Object.assign(progress.choiceHistory, {
      aff_witch_01_star: 'name_star',
      aff_witch_02_observatory: 'came_for_you',
      aff_witch_03_recipe: 'every_secret',
      aff_witch_04_miscalculation: 'review_without_blame',
      aff_witch_05_nightflight: 'shared_pause_signal',
      aff_witch_06_constellation: 'shared_blank',
      aff_witch_07_gift: 'inspect_together',
      aff_witch_08_secret: 'guard_unopened',
      aff_witch_09_reciprocal: 'two_independent_colors',
    });
    expect(looksLikeSave(complete)).toBe(true);

    const skipped = structuredClone(complete);
    skipped.affection.characters.witch.completedStoryIds.splice(7, 1);
    delete skipped.affection.characters.witch.choiceHistory.aff_witch_08_secret;
    expect(looksLikeSave(skipped)).toBe(false);
  });

  it('装备 UID 必须全局唯一，nextUid 必须大于已存在编号', () => {
    const save = createSave('小樱', 'witch', 3, 1);
    const instance = {
      uid: 'e1',
      defId: 'eq_r1_ring_common',
      enhance: 0,
      baseRollPermille: 1000,
      enhanceGainPermille: Array<number>(ENHANCE_MAX).fill(0),
      enhanceLuck: {},
      affixes: [],
      reforgeResonance: 0,
      locked: false,
    };
    save.nextUid = 2;
    save.bag.equipment.push(structuredClone(instance));
    save.equipped.weapon = structuredClone(instance);
    expect(looksLikeSave(save)).toBe(false);

    save.equipped.weapon = null;
    save.nextUid = 1;
    expect(looksLikeSave(save)).toBe(false);

    save.nextUid = 2;
    expect(looksLikeSave(save)).toBe(true);
  });

  it('v11 严格拒绝装备定义槽位与 equipped 键不一致的坏档', () => {
    const wrongSlot = createSave('错槽少女', 'witch', 34, 1_800_000_000_000);
    wrongSlot.nextUid = 2;
    wrongSlot.equipped.weapon = testEquipment('eq_r2_ring_epic', []);

    expect(looksLikeSave(wrongSlot)).toBe(false);
    expect(() => parseSave(wrongSlot)).toThrow(/属于 ring 槽，不能穿戴在 weapon 槽/);
    expect(() => importFromJson(JSON.stringify(wrongSlot))).toThrow(
      /属于 ring 槽，不能穿戴在 weapon 槽/,
    );

    wrongSlot.equipped.weapon = null;
    wrongSlot.equipped.ring = testEquipment('eq_r2_ring_epic', []);
    expect(parseSave(wrongSlot).equipped.ring?.defId).toBe('eq_r2_ring_epic');
  });

  it('装备副本次数、日期和通关合计必须自洽', () => {
    const badDay = createSave('小樱', 'witch', 4, 1_800_000_000_000);
    badDay.equipmentDungeon.dayKey = '2027/01/15';
    expect(looksLikeSave(badDay)).toBe(false);

    const tooManyToday = createSave('小樱', 'witch', 4, 1_800_000_000_000);
    tooManyToday.equipmentDungeon.clearsToday = 4;
    expect(looksLikeSave(tooManyToday)).toBe(false);

    const mismatchedTotal = createSave('小樱', 'witch', 4, 1_800_000_000_000);
    mismatchedTotal.equipmentDungeon.records.equipment_weapon_azure_d1 = {
      clears: 2,
      firstClearedAt: 1_800_000_000_000,
      bestDurationMs: 18_200,
    };
    mismatchedTotal.equipmentDungeon.depth = { azure: 1 };
    mismatchedTotal.equipmentDungeon.totalClears = 1;
    expect(looksLikeSave(mismatchedTotal)).toBe(false);

    mismatchedTotal.equipmentDungeon.totalClears = 2;
    expect(looksLikeSave(mismatchedTotal)).toBe(true);

    const todayExceedsHistory = createSave('小樱', 'witch', 4, 1_800_000_000_000);
    todayExceedsHistory.equipmentDungeon.clearsToday = 1;
    expect(looksLikeSave(todayExceedsHistory)).toBe(false);

    const unknownStage = createSave('小樱', 'witch', 4, 1_800_000_000_000);
    unknownStage.equipmentDungeon.records.equipment_unknown_azure_d1 = {
      clears: 1,
      firstClearedAt: 1_800_000_000_000,
      bestDurationMs: 18_200,
    };
    unknownStage.equipmentDungeon.totalClears = 1;
    expect(looksLikeSave(unknownStage)).toBe(false);

    // 深度不能跳级：有 d2 记录却没有 d1
    const skippedDepth = createSave('小樱', 'witch', 4, 1_800_000_000_000);
    skippedDepth.equipmentDungeon.records.equipment_body_violet_d2 = {
      clears: 1,
      firstClearedAt: 1_800_000_000_000,
      bestDurationMs: 18_200,
    };
    skippedDepth.equipmentDungeon.totalClears = 1;
    skippedDepth.equipmentDungeon.depth = { violet: 2 };
    expect(looksLikeSave(skippedDepth)).toBe(false);

    // depth 声明与记录最深层必须一致 —— 否则改一个就能绕过另一个
    const depthMismatch = createSave('小樱', 'witch', 4, 1_800_000_000_000);
    depthMismatch.equipmentDungeon.records.equipment_body_violet_d1 = {
      clears: 1,
      firstClearedAt: 1_800_000_000_000,
      bestDurationMs: 18_200,
    };
    depthMismatch.equipmentDungeon.totalClears = 1;
    depthMismatch.equipmentDungeon.depth = { violet: 3 };
    expect(looksLikeSave(depthMismatch)).toBe(false);

    // 声明了深度却没有任何记录，同样拒收
    const depthWithoutRecord = createSave('小樱', 'witch', 4, 1_800_000_000_000);
    depthWithoutRecord.equipmentDungeon.depth = { azure: 2 };
    expect(looksLikeSave(depthWithoutRecord)).toBe(false);
  });

  it('装备预设必须完整引用真实、锁定且职业槽位匹配的装备', () => {
    const make = () => {
      const save = createSave('预设少女', 'witch', 18, 1_800_000_000_000);
      const weapon = testEquipment('eq_r1_weapon_common', []);
      weapon.locked = true;
      save.nextUid = 2;
      save.equipped.weapon = weapon;
      save.equipmentPresets.presets = [captureEquipmentPreset('preset-1', 'witch', save.equipped)];
      return save;
    };

    expect(parseSave(make()).equipmentPresets.presets[0]?.equipmentUids.weapon).toBe('e1');

    const duplicate = make();
    duplicate.equipmentPresets.presets[0]!.equipmentUids.head = 'e1';
    expect(() => parseSave(duplicate)).toThrow(/重复引用 e1/);

    const missing = make();
    missing.equipmentPresets.presets[0]!.equipmentUids.weapon = 'e404';
    expect(() => parseSave(missing)).toThrow(/引用了不存在的装备 e404/);

    const unlocked = make();
    unlocked.equipped.weapon!.locked = false;
    expect(() => parseSave(unlocked)).toThrow(/必须锁定/);

    const wrongSlot = make();
    wrongSlot.equipmentPresets.presets[0]!.equipmentUids.weapon = null;
    wrongSlot.equipmentPresets.presets[0]!.equipmentUids.ring = 'e1';
    expect(() => parseSave(wrongSlot)).toThrow(/ring 槽不能引用 weapon 装备/);

    const wrongClass = make();
    const witchWeapon = createFixedPreviewInstance(
      requireEquipment('eq_shop_berry-cream_weapon_witch'),
      'e1',
    );
    witchWeapon.locked = true;
    wrongClass.equipped.weapon = witchWeapon;
    wrongClass.equipmentPresets.presets = [
      captureEquipmentPreset('preset-1', 'catkin', wrongClass.equipped),
    ];
    expect(() => parseSave(wrongClass)).toThrow(/不属于预设职业 catkin/);
  });
});
