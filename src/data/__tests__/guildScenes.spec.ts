import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { GUILD_HOME_SCENE_ASSET, GUILD_STRONGHOLD_SCENE_ASSET } from '../guildScenes';

describe('公会场景资产契约', () => {
  it.each([GUILD_HOME_SCENE_ASSET, GUILD_STRONGHOLD_SCENE_ASSET])(
    '%s 在 public 中存在',
    (asset) => {
      expect(asset).toMatch(/^assets\/guild\/.+\.webp$/);
      expect(existsSync(resolve(process.cwd(), 'public', asset))).toBe(true);
    },
  );
});
