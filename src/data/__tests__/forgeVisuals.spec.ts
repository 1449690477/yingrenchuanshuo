import { statSync } from 'node:fs';
import { resolve } from 'node:path';
import sharp from 'sharp';
import { describe, expect, it } from 'vitest';
import type { ForgeStage } from '@/core/types';
import { FORGE_STAGE_THRESHOLDS } from '@/data/constants';
import { FORGE_STAGE_VISUALS } from '@/data/forgeVisuals';

const STAGES: readonly ForgeStage[] = ['original', 'gleam', 'radiant', 'starforged', 'sakura'];

describe('锻造阶段视觉素材', () => {
  it('与核心阶段阈值一一对应', () => {
    expect(Object.keys(FORGE_STAGE_VISUALS)).toEqual(STAGES);
    expect(STAGES.map((stage) => FORGE_STAGE_VISUALS[stage].minLevel)).toEqual(
      [...FORGE_STAGE_THRESHOLDS]
        .sort((left, right) => left.minLevel - right.minLevel)
        .map(({ minLevel }) => minLevel),
    );
  });

  it.each(STAGES.slice(1))('%s 光环满足运行时素材硬指标', async (stage) => {
    const asset = FORGE_STAGE_VISUALS[stage].overlayAsset;
    expect(asset).not.toBeNull();

    const path = resolve('public', asset!);
    const metadata = await sharp(path).metadata();
    expect(metadata.width).toBe(256);
    expect(metadata.height).toBe(256);
    expect(metadata.channels).toBe(4);
    expect(statSync(path).size).toBeLessThanOrEqual(120 * 1024);

    const { data, info } = await sharp(path).ensureAlpha().raw().toBuffer({
      resolveWithObject: true,
    });
    const alphaAt = (x: number, y: number) => data[(y * info.width + x) * 4 + 3];
    expect(
      [
        alphaAt(0, 0),
        alphaAt(info.width - 1, 0),
        alphaAt(0, info.height - 1),
        alphaAt(info.width - 1, info.height - 1),
      ],
      `${asset} 四角必须透明`,
    ).toEqual([0, 0, 0, 0]);

    let visiblePixels = 0;
    let greenSpillPixels = 0;
    for (let index = 0; index < data.length; index += 4) {
      const [red, green, blue, alpha] = data.subarray(index, index + 4);
      if (alpha > 0) visiblePixels += 1;
      if (alpha > 8 && green - red > 50 && green - blue > 25) greenSpillPixels += 1;
    }

    expect(visiblePixels).toBeGreaterThan(2_500);
    expect(greenSpillPixels, `${asset} 不得残留明显绿幕边`).toBe(0);
  });
});
