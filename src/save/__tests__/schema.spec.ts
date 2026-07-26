import { describe, expect, it } from 'vitest';
import { reactive } from 'vue';
import { SAVE_VERSION, SaveValidationError, createSave, looksLikeSave, parseSave } from '../schema';

describe('save schema', () => {
  it('新建存档符合当前完整结构', () => {
    const save = createSave('小樱', 'swordsman', 2026, 1_800_000_000_000);
    expect(parseSave(save)).toEqual(save);
    expect(save.version).toBe(SAVE_VERSION);
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
      affixes: [],
      locked: false,
    });
    expect(looksLikeSave(invalidEnhance)).toBe(false);
  });
});
