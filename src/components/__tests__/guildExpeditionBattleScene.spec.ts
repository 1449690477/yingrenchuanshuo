import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const scene = readFileSync(
  new URL('../guild/GuildExpeditionBattleScene.vue', import.meta.url),
  'utf8',
);

describe('公会团本战斗表现', () => {
  it('使用专属 3:2 场景、真实角色纸娃娃与具体 Boss 素材', () => {
    expect(scene).toContain('aspect-ratio: 3 / 2');
    expect(scene).toContain('<CharacterAppearance');
    expect(scene).toContain(':src="bossUrl"');
    expect(scene).toContain('requireGuildExpeditionVisual');
    expect(scene).not.toContain('通用怪');
    expect(scene).not.toContain('fallback');
  });

  it('只压缩播放服务端结果，总伤害、承伤、时长与贡献均来自实际战果', () => {
    expect(scene).toContain('result.damage');
    expect(scene).toContain('result.damageTaken');
    expect(scene).toContain('result?.durationSec');
    expect(scene).toContain('result.improvedBy');
    expect(scene).toContain('splitExact');
    expect(scene).not.toContain('Math.random');
  });

  it('具备跳过、低动效、血条、打击反馈与结果状态', () => {
    expect(scene).toContain('function skip()');
    expect(scene).toContain('prefers-reduced-motion: reduce');
    expect(scene).toContain('role="progressbar"');
    expect(scene).toContain('damage-float');
    expect(scene).toContain('远征归来');
    expect(scene).toContain('虽败仍有贡献');
    // 纸娃娃包含多层装备图片，逐击只能切动作，不能整棵重建。
    expect(scene).not.toContain(':key="`hero-${actionKey}`"');
  });
});
