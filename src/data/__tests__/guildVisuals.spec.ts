import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { GUILD_EXPEDITION_SCENE_ASSET, requireGuildExpeditionVisual } from '../guildVisuals';

describe('公会团本视觉映射', () => {
  it('九种倾向与元素组合都有具体 Boss，并统一进入专属公会战场', () => {
    const bossAssets = new Set<string>();
    for (const tilt of ['shell', 'mirage', 'fury']) {
      for (const element of ['fire', 'ice', 'thunder'] as const) {
        const visual = requireGuildExpeditionVisual(tilt, element);
        expect(visual.sceneAsset).toBe(GUILD_EXPEDITION_SCENE_ASSET);
        expect(visual.bossAsset).toMatch(/^assets\/trial\/.+\.webp$/);
        expect(existsSync(resolve('public', visual.bossAsset))).toBe(true);
        bossAssets.add(visual.bossAsset);
      }
    }
    expect(bossAssets.size).toBe(9);
    expect(existsSync(resolve('public', GUILD_EXPEDITION_SCENE_ASSET))).toBe(true);
  });

  it('未知首领组合直接报错，不回退为通用怪或符号', () => {
    expect(() => requireGuildExpeditionVisual('unknown', 'fire')).toThrow('未登记词条倾向');
    expect(() => requireGuildExpeditionVisual('shell', 'none')).toThrow('不允许使用无属性');
  });
});
