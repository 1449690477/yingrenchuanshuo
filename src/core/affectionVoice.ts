/**
 * A-4 语音播放框架：真实音频存在时才出现控制项。
 *
 * 设计约束（派单硬性要求）：
 * - cueId → 真实音频路径的显式清单，不许约定式拼路径、不许 404 兜底；
 * - 单一 audio 实例负责播放/暂停/重播/静音；
 * - 切句、关闭弹窗时必须停止；
 * - 加载失败给出可访问的失败提示（failedCueIds 可查询）；
 * - 浏览器未收到用户手势前禁止自动出声：框架只提供手动 play，不做自动播放；
 * - sfx 关闭时不播放：play() 前由调用方把静音/开关状态传给 setMuted；
 * - 没有合法真实音频的台词，组件端不渲染语音按钮（hasAffectionVoice 为 false）。
 *
 * 首批真实语音已落地：剑姬第十幕五句角色台词（旁白不配音，符合 galgame
 * 惯例）。后续配音只需把文件放进 public/assets/affection/voice/ 并在
 * AFFECTION_VOICE_MANIFEST 登记 cueId → 路径。
 */

/** cueId 约定：`${storyId}#open-${行号}` 或 `${storyId}#resp-${choiceId}-${行号}`。 */
export function affectionOpeningCueId(storyId: string, lineIndex: number): string {
  return `${storyId}#open-${lineIndex}`;
}

export function affectionResponseCueId(
  storyId: string,
  choiceId: string,
  lineIndex: number,
): string {
  return `${storyId}#resp-${choiceId}-${lineIndex}`;
}

/** 显式清单：只有登记在册、且文件真实存在的 cueId 才会被组件渲染。 */
export const AFFECTION_VOICE_MANIFEST: Readonly<Record<string, string>> = {
  // 剑姬 · 第十幕「替她挑一条剑穗」（温暖中文女声；旁白不配音，符合 galgame 惯例）
  'aff_swordsman_10_market#open-1':
    'assets/affection/voice/aff_swordsman_10_market/open-1.mp3',
  'aff_swordsman_10_market#resp-pick_quiet_color-1':
    'assets/affection/voice/aff_swordsman_10_market/resp-pick_quiet_color-1.mp3',
  'aff_swordsman_10_market#resp-pick_quiet_color-2':
    'assets/affection/voice/aff_swordsman_10_market/resp-pick_quiet_color-2.mp3',
  'aff_swordsman_10_market#resp-let_her_test_swing-1':
    'assets/affection/voice/aff_swordsman_10_market/resp-let_her_test_swing-1.mp3',
  'aff_swordsman_10_market#resp-ask_before_touch-1':
    'assets/affection/voice/aff_swordsman_10_market/resp-ask_before_touch-1.mp3',
} as const;

export function resolveAffectionVoice(cueId: string): string | null {
  return AFFECTION_VOICE_MANIFEST[cueId] ?? null;
}

export function hasAffectionVoice(cueId: string): boolean {
  return resolveAffectionVoice(cueId) !== null;
}

/** 可测试的 Audio 抽象：默认用浏览器 Audio，测试注入假实现。 */
export interface AffectionVoiceAudioLike {
  src: string;
  muted: boolean;
  currentTime: number;
  paused: boolean;
  play(): Promise<void>;
  pause(): void;
}

export type AffectionVoiceAudioFactory = (src: string) => AffectionVoiceAudioLike;

const defaultFactory: AffectionVoiceAudioFactory = (src) => {
  const AudioCtor = (globalThis as { Audio?: new (src: string) => AffectionVoiceAudioLike }).Audio;
  if (!AudioCtor) {
    throw new Error('当前环境没有 Audio，无法播放语音');
  }
  return new AudioCtor(src);
};

export type AffectionVoicePlayResult =
  | { ok: true }
  | { ok: false; reason: 'no-cue' | 'blocked' | 'load-failed' };

export class AffectionVoicePlayer {
  private audio: AffectionVoiceAudioLike | null = null;
  private currentCueId: string | null = null;
  private muted = false;
  private readonly failedCueIds = new Set<string>();

  constructor(private readonly createAudio: AffectionVoiceAudioFactory = defaultFactory) {}

  get playingCueId(): string | null {
    return this.currentCueId;
  }

  get isMuted(): boolean {
    return this.muted;
  }

  hasFailed(cueId: string): boolean {
    return this.failedCueIds.has(cueId);
  }

  setMuted(muted: boolean): void {
    this.muted = muted;
    if (this.audio) this.audio.muted = muted;
  }

  /** 播放指定 cue；已在播同一句时重播。播放前会先停止当前句。 */
  async play(cueId: string): Promise<AffectionVoicePlayResult> {
    const src = resolveAffectionVoice(cueId);
    if (!src) return { ok: false, reason: 'no-cue' };

    this.stop();
    const audio = this.createAudio(src);
    audio.muted = this.muted;
    this.audio = audio;
    this.currentCueId = cueId;
    try {
      await audio.play();
      return { ok: true };
    } catch {
      this.failedCueIds.add(cueId);
      if (this.audio === audio) {
        this.audio = null;
        this.currentCueId = null;
      }
      return { ok: false, reason: 'load-failed' };
    }
  }

  pause(): void {
    this.audio?.pause();
  }

  /** 重播当前句；没有当前句时静默忽略。 */
  async replay(): Promise<AffectionVoicePlayResult> {
    if (!this.currentCueId) return { ok: false, reason: 'no-cue' };
    return this.play(this.currentCueId);
  }

  /** 切句/关弹窗时调用：停止并释放当前音频。 */
  stop(): void {
    if (this.audio) {
      this.audio.pause();
      this.audio.currentTime = 0;
    }
    this.audio = null;
    this.currentCueId = null;
  }
}
