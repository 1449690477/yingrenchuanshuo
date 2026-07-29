import { describe, expect, it } from 'vitest';
import { createSave, SAVE_VERSION, saveDataSchema } from '../schema';
import { ENHANCE_MAX } from '@/data/constants';
import { affectionEquipmentIdsForClass } from '@/data/affectionEquipment';

describe('心虹装备存档校验', () => {
  it('当前版本存档可保存心虹品质设置和装备，不改版本或迁移链', () => {
    const save = createSave('心虹测试', 'witch', 42, Date.UTC(2026, 6, 28));
    save.settings.autoDecomposeBelow = 'prismatic';
    const affectionEquipmentId = affectionEquipmentIdsForClass('witch')[0];
    if (!affectionEquipmentId) throw new Error('[测试配置错误] 魔女缺少心虹装备');
    save.bag.equipment.push({
      uid: 'e-prismatic',
      defId: affectionEquipmentId,
      enhance: 0,
      baseRollPermille: 1000,
      enhanceGainPermille: Array<number>(ENHANCE_MAX).fill(0),
      enhanceLuck: {},
      affixes: [],
      reforgeResonance: 0,
      locked: true,
    });

    expect(saveDataSchema.safeParse(save).success).toBe(true);
    expect(save.version).toBe(SAVE_VERSION);
  });
});
