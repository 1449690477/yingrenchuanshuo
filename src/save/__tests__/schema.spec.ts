import { describe, expect, it } from 'vitest';
import { reactive } from 'vue';
import { ENHANCE_MAX } from '@/data/constants';
import { SAVE_VERSION, SaveValidationError, createSave, looksLikeSave, parseSave } from '../schema';

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
      defId: 'eq_test',
      enhance: 16,
      baseRollPermille: 1000,
      enhanceGainPermille: Array<number>(ENHANCE_MAX).fill(80),
      enhanceLuck: {},
      affixes: [],
      locked: false,
    });
    expect(looksLikeSave(invalidEnhance)).toBe(false);
  });

  it('非法胚子、强化记录和幸运桶都会被拒绝', () => {
    const make = () => {
      const save = createSave('小樱', 'witch', 2, 1);
      save.bag.equipment.push({
        uid: 'e1',
        defId: 'eq_test',
        enhance: 1,
        baseRollPermille: 1000,
        enhanceGainPermille: [80, ...Array<number>(ENHANCE_MAX - 1).fill(0)],
        enhanceLuck: { '2': 17 },
        affixes: [],
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
  it('装备 UID 必须全局唯一，nextUid 必须大于已存在编号', () => {
    const save = createSave('小樱', 'witch', 3, 1);
    const instance = {
      uid: 'e1',
      defId: 'eq_test',
      enhance: 0,
      baseRollPermille: 1000,
      enhanceGainPermille: Array<number>(ENHANCE_MAX).fill(0),
      enhanceLuck: {},
      affixes: [],
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

  it('装备副本次数、日期和通关合计必须自洽', () => {
    const badDay = createSave('小樱', 'witch', 4, 1_800_000_000_000);
    badDay.equipmentDungeon.dayKey = '2027/01/15';
    expect(looksLikeSave(badDay)).toBe(false);

    const tooManyToday = createSave('小樱', 'witch', 4, 1_800_000_000_000);
    tooManyToday.equipmentDungeon.clearsToday = 4;
    expect(looksLikeSave(tooManyToday)).toBe(false);

    const mismatchedTotal = createSave('小樱', 'witch', 4, 1_800_000_000_000);
    mismatchedTotal.equipmentDungeon.records.equipment_weapon_azure = {
      clears: 2,
      firstClearedAt: 1_800_000_000_000,
      bestDurationMs: 18_200,
    };
    mismatchedTotal.equipmentDungeon.totalClears = 1;
    expect(looksLikeSave(mismatchedTotal)).toBe(false);

    mismatchedTotal.equipmentDungeon.totalClears = 2;
    expect(looksLikeSave(mismatchedTotal)).toBe(true);

    const todayExceedsHistory = createSave('小樱', 'witch', 4, 1_800_000_000_000);
    todayExceedsHistory.equipmentDungeon.clearsToday = 1;
    expect(looksLikeSave(todayExceedsHistory)).toBe(false);

    const unknownStage = createSave('小樱', 'witch', 4, 1_800_000_000_000);
    unknownStage.equipmentDungeon.records.equipment_unknown_azure = {
      clears: 1,
      firstClearedAt: 1_800_000_000_000,
      bestDurationMs: 18_200,
    };
    unknownStage.equipmentDungeon.totalClears = 1;
    expect(looksLikeSave(unknownStage)).toBe(false);

    const missingPrevious = createSave('小樱', 'witch', 4, 1_800_000_000_000);
    missingPrevious.equipmentDungeon.records.equipment_body_violet = {
      clears: 1,
      firstClearedAt: 1_800_000_000_000,
      bestDurationMs: 18_200,
    };
    missingPrevious.equipmentDungeon.totalClears = 1;
    expect(looksLikeSave(missingPrevious)).toBe(false);
  });
});
