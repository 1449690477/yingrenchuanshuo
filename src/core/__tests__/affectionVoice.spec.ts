import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  AFFECTION_VOICE_MANIFEST,
  AffectionVoicePlayer,
  affectionOpeningCueId,
  affectionResponseCueId,
  hasAffectionVoice,
  resolveAffectionVoice,
  type AffectionVoiceAudioLike,
} from '../affectionVoice';

class FakeAudio implements AffectionVoiceAudioLike {
  static instances: FakeAudio[] = [];
  static failNext = false;

  muted = false;
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
  return new AffectionVoicePlayer((src) => new FakeAudio(src));
}

/** 测试期临时登记一条合法 cue，用毕即删，验证「有真实音频才渲染」的行为。 */
const TEST_CUE = affectionOpeningCueId('aff_swordsman_10_market', 0);
const TEST_SRC = 'assets/affection/voice/__test__/sample.ogg';

function withTestCue(run: () => void | Promise<void>) {
  (AFFECTION_VOICE_MANIFEST as Record<string, string>)[TEST_CUE] = TEST_SRC;
  const done = () => {
    delete (AFFECTION_VOICE_MANIFEST as Record<string, string>)[TEST_CUE];
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

describe('A-4 语音框架：cueId 与显式清单', () => {
  it('cueId 约定稳定：开场与回应各行独立', () => {
    expect(affectionOpeningCueId('aff_witch_12_meteor', 2)).toBe('aff_witch_12_meteor#open-2');
    expect(affectionResponseCueId('aff_witch_12_meteor', 'wish_for_her', 1)).toBe(
      'aff_witch_12_meteor#resp-wish_for_her-1',
    );
  });

  it('清单登记的每条 cue 都指向真实存在的音频文件，未登记的台词查不到音频', () => {
    const entries = Object.entries(AFFECTION_VOICE_MANIFEST);
    expect(entries.length).toBeGreaterThan(0);
    for (const [cueId, src] of entries) {
      // cueId 必须遵守 open/resp 约定，路径必须在好感语音目录内
      expect(cueId, cueId).toMatch(/#(?:open-\d+|resp-[a-z0-9_]+-\d+)$/);
      expect(src, cueId).toMatch(/^assets\/affection\/voice\//);
      // 红线：不许 404 兜底——登记的文件必须真实存在于 public/
      expect(existsSync(resolve('public', src)), cueId).toBe(true);
    }
    // 未登记的台词（含旁白行）依旧查不到音频，组件不渲染控制项
    expect(resolveAffectionVoice(affectionOpeningCueId('aff_swordsman_10_market', 0))).toBeNull();
    expect(
      hasAffectionVoice(affectionResponseCueId('aff_catkin_12_night_train', 'wave_at_train', 1)),
    ).toBe(false);
  });

  it('登记的 cue 必须能解析出显式路径', () =>
    withTestCue(() => {
      expect(resolveAffectionVoice(TEST_CUE)).toBe(TEST_SRC);
      expect(hasAffectionVoice(TEST_CUE)).toBe(true);
    }));
});

describe('A-4 语音框架：单一实例播放行为', () => {
  it('未登记的 cue 直接拒播，不创建音频实例', async () => {
    const player = createPlayer();
    expect(await player.play('not-registered#open-0')).toEqual({ ok: false, reason: 'no-cue' });
    expect(FakeAudio.instances).toHaveLength(0);
    expect(player.playingCueId).toBeNull();
  });

  it('播放新句前自动停止上一句，静音状态贯穿实例', () =>
    withTestCue(async () => {
      const player = createPlayer();
      player.setMuted(true);
      expect(await player.play(TEST_CUE)).toEqual({ ok: true });
      expect(FakeAudio.instances).toHaveLength(1);
      expect(FakeAudio.instances[0]!.src).toBe(TEST_SRC);
      expect(FakeAudio.instances[0]!.muted).toBe(true);
      expect(player.playingCueId).toBe(TEST_CUE);

      const secondCue = affectionOpeningCueId('aff_swordsman_10_market', 1);
      (AFFECTION_VOICE_MANIFEST as Record<string, string>)[secondCue] = 'assets/affection/voice/__test__/sample2.ogg';
      expect(await player.play(secondCue)).toEqual({ ok: true });
      expect(FakeAudio.instances[0]!.paused).toBe(true);
      expect(FakeAudio.instances[0]!.currentTime).toBe(0);
      expect(FakeAudio.instances[1]!.muted).toBe(true);
      expect(player.playingCueId).toBe(secondCue);
      delete (AFFECTION_VOICE_MANIFEST as Record<string, string>)[secondCue];
    }));

  it('暂停与重播作用于当前句', () =>
    withTestCue(async () => {
      const player = createPlayer();
      await player.play(TEST_CUE);
      player.pause();
      expect(FakeAudio.instances[0]!.paused).toBe(true);
      expect(await player.replay()).toEqual({ ok: true });
      expect(player.playingCueId).toBe(TEST_CUE);
    }));

  it('停止后清空当前句，重播静默忽略', () =>
    withTestCue(async () => {
      const player = createPlayer();
      await player.play(TEST_CUE);
      player.stop();
      expect(player.playingCueId).toBeNull();
      expect(await player.replay()).toEqual({ ok: false, reason: 'no-cue' });
    }));

  it('加载失败会被记录并可查询，用于可访问的失败提示', () =>
    withTestCue(async () => {
      const player = createPlayer();
      FakeAudio.failNext = true;
      expect(await player.play(TEST_CUE)).toEqual({ ok: false, reason: 'load-failed' });
      expect(player.hasFailed(TEST_CUE)).toBe(true);
      expect(player.playingCueId).toBeNull();
    }));
});
