import { describe, expect, it } from 'vitest';
import {
  SFX_MANIFEST,
  SfxPlayer,
  hasSfx,
  resolveSfx,
  type SfxAudioLike,
} from '../sfx';

class FakeAudio implements SfxAudioLike {
  static instances: FakeAudio[] = [];
  static failNext = false;

  volume = 1;
  played = false;

  constructor(public src: string) {
    FakeAudio.instances.push(this);
  }

  async play(): Promise<void> {
    if (FakeAudio.failNext) {
      FakeAudio.failNext = false;
      throw new Error(' simulated load failure ');
    }
    this.played = true;
  }
}

function createPlayer() {
  FakeAudio.instances = [];
  FakeAudio.failNext = false;
  return new SfxPlayer((src) => new FakeAudio(src));
}

/** 测试期临时登记一条合法 sfx，用毕即删，验证「有真实音频才出声」的行为。 */
const TEST_SFX = '__test__click';
const TEST_SRC = 'assets/system/sfx/__test__/click.ogg';

function withTestSfx(run: () => void | Promise<void>) {
  (SFX_MANIFEST as Record<string, string>)[TEST_SFX] = TEST_SRC;
  const done = () => {
    delete (SFX_MANIFEST as Record<string, string>)[TEST_SFX];
  };
  try {
    const result = run();
    if (result instanceof Promise) return result.finally(done);
    done();
  } catch (error) {
    done();
    throw error;
  }
  return undefined;
}

describe('M4-11 音效框架：显式清单与开关门禁', () => {
  it('清单登记的路径都在系统音效目录内；未登记的 sfxId 查不到音频', () => {
    for (const [sfxId, src] of Object.entries(SFX_MANIFEST)) {
      expect(src, sfxId).toMatch(/^assets\/system\/sfx\//);
    }
    expect(resolveSfx('__never_registered__')).toBeNull();
    expect(hasSfx('__never_registered__')).toBe(false);
  });

  it('清单为空是诚实状态：任何 play 都返回 no-cue，不制造假路径 404', async () => {
    const player = createPlayer();
    const result = await player.play('anything');
    expect(result).toEqual({ ok: false, reason: 'no-cue' });
    expect(FakeAudio.instances).toHaveLength(0);
  });

  it('登记过的 sfx 正常播放，且允许多声交叠（不做单实例抢占）', async () => {
    await withTestSfx(async () => {
      const player = createPlayer();
      const first = await player.play(TEST_SFX);
      const second = await player.play(TEST_SFX);
      expect(first).toEqual({ ok: true });
      expect(second).toEqual({ ok: true });
      expect(FakeAudio.instances).toHaveLength(2);
      expect(FakeAudio.instances.every((a) => a.played)).toBe(true);
    });
  });

  it('开关关闭后 play 一律 disabled，不创建任何音频实例', async () => {
    await withTestSfx(async () => {
      const player = createPlayer();
      player.setEnabled(false);
      const result = await player.play(TEST_SFX);
      expect(result).toEqual({ ok: false, reason: 'disabled' });
      expect(FakeAudio.instances).toHaveLength(0);
      player.setEnabled(true);
      expect(await player.play(TEST_SFX)).toEqual({ ok: true });
    });
  });

  it('加载失败不抛异常：记入 failedSfxIds 可查询，返回 load-failed', async () => {
    await withTestSfx(async () => {
      const player = createPlayer();
      FakeAudio.failNext = true;
      const result = await player.play(TEST_SFX);
      expect(result).toEqual({ ok: false, reason: 'load-failed' });
      expect(player.hasFailed(TEST_SFX)).toBe(true);
      // 失败不影响下一次尝试
      expect(await player.play(TEST_SFX)).toEqual({ ok: true });
    });
  });
});
