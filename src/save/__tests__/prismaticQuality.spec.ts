import { describe, expect, it } from 'vitest';
import { createSave, saveDataSchema } from '../schema';
import { ENHANCE_MAX } from '@/data/constants';

describe('心虹装备存档校验', () => {
  it('v9 存档可保存心虹品质设置和装备，不改版本或迁移链', () => {
    const save = createSave('心虹测试', 'witch', 42, Date.UTC(2026, 6, 28));
    save.settings.autoDecomposeBelow = 'prismatic';
    save.bag.equipment.push({
      uid: 'e-prismatic',
      defId: 'eq_affection_witch_ring',
      enhance: 0,
      baseRollPermille: 1000,
      enhanceGainPermille: Array<number>(ENHANCE_MAX).fill(0),
      enhanceLuck: {},
      affixes: [],
      locked: true,
    });

    expect(saveDataSchema.safeParse(save).success).toBe(true);
    expect(save.version).toBe(9);
  });
});
