import { describe, expect, it } from 'vitest';
import { TRIAL_TILTS } from '../trialRules';
import { requireTrialVisual, TRIAL_PHASES } from '../trialVisuals';

describe('周常试炼表现配置', () => {
  it('3 种倾向 × 3 种元素都有独立 Boss 资产', () => {
    const assets = new Set<string>();
    for (const tilt of TRIAL_TILTS) {
      for (const element of ['fire', 'ice', 'thunder'] as const) {
        const visual = requireTrialVisual(tilt.id, element);
        expect(visual.bossAsset).toMatch(new RegExp(`assets/trial/${tilt.id}-${element}\\.webp$`));
        expect(visual.sceneAsset).toBe('assets/trial/trial-arena.webp');
        expect(visual.signatureMove.length).toBeGreaterThan(3);
        assets.add(visual.bossAsset);
      }
    }
    expect(assets.size).toBe(9);
  });

  it('四个阶段严格覆盖 60 秒且顺序递增', () => {
    expect(TRIAL_PHASES.map((phase) => phase.at)).toEqual([0, 15, 30, 45]);
  });

  it('未知组合直接报错，不用占位图兜底', () => {
    expect(() => requireTrialVisual('unknown', 'ice')).toThrow('未登记词条倾向');
    expect(() => requireTrialVisual('fury', 'none')).toThrow('不允许使用无属性');
  });
});
