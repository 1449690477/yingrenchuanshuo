import { describe, expect, it } from 'vitest';
import {
  BGM_MANIFEST,
  BgmPlayer,
  hasBgm,
  resolveBgm,
  type BgmAudioLike,
} from '../bgm';

class FakeAudio implements BgmAudioLike {
  static instances: FakeAudio[] = [];
  static failNext = false;

  loop = false;
  currentTime = 0;
  paused = true;

  constructor(public src: string) {
    FakeAudio.instances.push(this);
  }

  async play(): Promise<void> {
    if (FakeAudio.failNext) {
      FakeAudio.failNext = false;
      throw new Error(' simulated load failure ');
    }
    this.paused = false;
  }

  pause(): void {
    this.paused = true;
  }
}

function createPlayer() {
  FakeAudio.instances = [];
  FakeAudio.failNext = false;
  return new BgmPlayer((src) => new FakeAudio(src));
}

/** 测试期临时登记一条合法曲目，用毕即删，验证「有真实曲目且开启才播」的行为。 */
const TEST_BGM = '__test__idle-theme';
const TEST_BGM_2 = '__test__boss-theme';
const TEST_SRC = 'assets/system/bgm/__test__/idle-theme.ogg';
const TEST_SRC_2 = 'assets/system/bgm/__test__/boss-theme.ogg';

function withTestBgm(run: () => void | Promise<void>) {
  const manifest = BGM_MANIFEST as Record<string, string>;
  manifest[TEST_BGM] = TEST_SRC;
  manifest[TEST_BGM_2] = TEST_SRC_2;
  const done = () => {
    delete manifest[TEST_BGM];
    delete manifest[TEST_BGM_2];
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

describe('M4-11 背景音乐框架：默认关闭与单实例循环', () => {
  it('清单登记的路径都在系统 BGM 目录内；未登记的 bgmId 查不到曲目', () => {
    for (const [bgmId, src] of Object.entries(BGM_MANIFEST)) {
      expect(src, bgmId).toMatch(/^assets\/system\/bgm\//);
    }
    expect(resolveBgm('__never_registered__')).toBeNull();
    expect(hasBgm('__never_registered__')).toBe(false);
  });

  it('默认关闭 BGM：新实例未开启时 play 一律 disabled，不创建音频实例', async () => {
    await withTestBgm(async () => {
      const player = createPlayer();
      expect(player.isEnabled).toBe(false);
      const result = await player.play(TEST_BGM);
      expect(result).toEqual({ ok: false, reason: 'disabled' });
      expect(FakeAudio.instances).toHaveLength(0);
      expect(player.playingBgmId).toBeNull();
    });
  });

  it('开启后播放循环曲目；清单为空时即使开启也返回 no-cue', async () => {
    await withTestBgm(async () => {
      const player = createPlayer();
      player.setEnabled(true);
      expect(await player.play(TEST_BGM)).toEqual({ ok: true });
      expect(player.playingBgmId).toBe(TEST_BGM);
      expect(FakeAudio.instances[0].loop).toBe(true);
      expect(FakeAudio.instances[0].paused).toBe(false);
    });
    // 清单为空的诚实状态（无测试登记）
    const player = createPlayer();
    player.setEnabled(true);
    expect(await player.play('anything')).toEqual({ ok: false, reason: 'no-cue' });
  });

  it('切曲先停旧曲：绝不两首叠播', async () => {
    await withTestBgm(async () => {
      const player = createPlayer();
      player.setEnabled(true);
      await player.play(TEST_BGM);
      await player.play(TEST_BGM_2);
      expect(player.playingBgmId).toBe(TEST_BGM_2);
      expect(FakeAudio.instances).toHaveLength(2);
      expect(FakeAudio.instances[0].paused).toBe(true); // 旧曲已停
      expect(FakeAudio.instances[1].paused).toBe(false); // 新曲在播
    });
  });

  it('关闭开关立即停掉在播曲目；stop 后状态归零', async () => {
    await withTestBgm(async () => {
      const player = createPlayer();
      player.setEnabled(true);
      await player.play(TEST_BGM);
      player.setEnabled(false);
      expect(player.playingBgmId).toBeNull();
      expect(FakeAudio.instances[0].paused).toBe(true);
      expect(FakeAudio.instances[0].currentTime).toBe(0);
    });
  });

  it('加载失败不抛异常：记入 failedBgmIds 可查询，状态回滚不留半播', async () => {
    await withTestBgm(async () => {
      const player = createPlayer();
      player.setEnabled(true);
      FakeAudio.failNext = true;
      const result = await player.play(TEST_BGM);
      expect(result).toEqual({ ok: false, reason: 'load-failed' });
      expect(player.hasFailed(TEST_BGM)).toBe(true);
      expect(player.playingBgmId).toBeNull();
      // 失败不影响下一次尝试
      expect(await player.play(TEST_BGM)).toEqual({ ok: true });
    });
  });
});
